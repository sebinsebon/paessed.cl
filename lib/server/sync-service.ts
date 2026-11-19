import { createHash, randomUUID } from "node:crypto";
import catalogData from "../default-catalog.json" with { type: "json" };
import { createLearningState, planLearning, reduceLearning } from "../learning/engine.ts";
import { validateLearningState } from "../learning/repository.ts";
import type { LearningAction, LearningQuestion, LearningState } from "../learning/types";
import { CATALOG_REVISION, type SyncChange, type SyncConflict, type SyncOperation, type SyncResponse, type SyncAction } from "../sync/contracts.ts";
import { database, type Database, type Query } from "./db.ts";
import { configuredLimit, consume, technicalEvent } from "./limits.ts";
import { HttpError } from "./http.ts";
import { incorporateGuestDiagnostic, onboardingStatus, validateGuestDiagnostic } from "./onboarding.ts";
import type { OnboardingStatus } from "../sync/contracts";

const catalog = catalogData.questions as LearningQuestion[];
const byId = new Map(catalog.map(q => [q.id, q]));
const eligibleCatalog = catalog.filter(q => q.eligible);
type Account = { owner_id: string; revision: number; generation: number; reset_revision: number; active_route: string };
type Session = Extract<SyncAction, { type: "session" }>;
type ConflictRow = { id: string; kind: string; revision: number; current_value: unknown; alternative: unknown; resolved: boolean };
class Divergence extends Error { kind: string; constructor(kind: string) { super(kind); this.kind=kind; } }
const clone = <T>(value: T): T => structuredClone(value);
// Bind serialized JSON as text so Postgres.js does not JSON-encode it again.
const encoded = (value: unknown) => JSON.stringify(value);
/** Key order must not turn a retry into a different operation. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function operationDigest(operation: SyncOperation): string { return createHash("sha256").update(canonicalJson(operation)).digest("hex"); }
export function initialLearningState(ownerId: string): LearningState {
  const state = createLearningState(); state.learnerId = ownerId;
  let hash = 2166136261; for (let i = 0; i < ownerId.length; i++) hash = Math.imul(hash ^ ownerId.charCodeAt(i), 16777619);
  state.seed = hash >>> 0;
  return planLearning(state, eligibleCatalog);
}
const conflictValue = (row: ConflictRow): SyncConflict => ({ id: row.id, kind: row.kind, revision: Number(row.revision), current: row.current_value, alternative: row.alternative, resolved: row.resolved });
async function initialize(query: Query, ownerId: string): Promise<Account> {
  await query("insert into paessed.profiles(owner_id) values($1) on conflict do nothing", [ownerId]);
  await query("insert into paessed.account_sync_state(owner_id,revision) values($1,1) on conflict do nothing", [ownerId]);
  const rows = await query("select * from paessed.account_sync_state where owner_id=$1 for update", [ownerId]);
  const account = rows[0] as unknown as Account;
  account.revision = Number(account.revision); account.generation = Number(account.generation);
  await query("insert into paessed.learning_states(owner_id,generation,revision,state) values($1,$2,$3,$4::text::jsonb) on conflict do nothing", [ownerId,account.generation,account.revision,encoded(initialLearningState(ownerId))]);
  return account;
}
async function readState(query: Query, ownerId: string): Promise<LearningState> {
  const rows = await query("select state from paessed.learning_states where owner_id=$1", [ownerId]);
  return validateLearningState(rows[0].state);
}
async function storeState(query: Query, ownerId: string, account: Account, state: LearningState, previous?: LearningState): Promise<void> {
  if (previous && canonicalJson(state) === canonicalJson(previous)) return;
  await query("update paessed.learning_states set state=$2::text::jsonb,revision=$3,generation=$4,updated_at=now() where owner_id=$1",[ownerId,encoded(state),account.revision,account.generation]);
  for (const attempt of state.attempts) {
    if(previous?.attempts.some(a=>a.id===attempt.id))continue;
    await query("insert into paessed.original_answers(owner_id,generation,route_id,session_id,question_id,answer,evidence) values($1,$2,$3,$4,$5,$6,$7::text::jsonb) on conflict do nothing",[ownerId,account.generation,account.active_route,attempt.sessionId,attempt.questionId,attempt.answer,encoded(attempt)]);
  }
  for (const exposure of state.exposures) {
    if(previous?.exposures.some(e=>e.sessionId===exposure.sessionId&&e.questionId===exposure.questionId&&canonicalJson(e)===canonicalJson(exposure)))continue;
    await query("insert into paessed.question_exposures(owner_id,generation,route_id,session_id,question_id,state) values($1,$2,$3,$4,$5,$6::text::jsonb) on conflict(owner_id,generation,route_id,session_id,question_id) do update set state=excluded.state",[ownerId,account.generation,account.active_route,exposure.sessionId,exposure.questionId,encoded(exposure)]);
  }
}
function validateReference(id: string, sourceId?: string): void {
  const question = byId.get(id);
  if (sourceId?.startsWith("default:")) {
    if (!question || question.examId !== sourceId.slice(8)) throw new HttpError(400,"La pregunta no pertenece a la fuente Gold.");
  } else if (sourceId?.startsWith("sha256:")) {
    if (id.split(":")[1] !== sourceId.slice(7)) throw new HttpError(400,"La pregunta no pertenece al archivo personal.");
  } else if (!question && !/^(?:personal|demre):[a-f0-9]{64}:[1-9][0-9]{0,3}$/.test(id)) throw new HttpError(400,"Referencia de pregunta inválida.");
}
async function registeredSession(query: Query, ownerId: string, account: Account, sessionId: string, mode: string, questionId: string, importedAt?: string): Promise<void> {
  if (!/^[a-f0-9-]{36}$/i.test(sessionId)) throw new HttpError(400,"La sesión educativa no existe.");
  const rows = await query("select id from paessed.practice_sessions where owner_id=$1 and id=$2::uuid and generation=$3 and mode=$4",[ownerId,sessionId,account.generation,mode]);
  if (!rows.length) {
    const question=byId.get(questionId);if(!question)throw new HttpError(400,"La pregunta Gold no existe.");
    const open=await query("select id,mode,source_id from paessed.practice_sessions where owner_id=$1 and generation=$2 and completed_at is null",[ownerId,account.generation]);
    const sourceId=mode==="playground"?"playground":`default:${question.examId}`;
    if(!importedAt&&open.some(s=>s.mode===mode&&s.source_id===sourceId))throw new Divergence("open-session");
    if(!importedAt&&open.length>=configuredLimit("OPEN_SESSIONS",20))throw new HttpError(429,"Tienes demasiadas sesiones abiertas.",60);
    await consume(query,`sessions:${ownerId}`,configuredLimit("SESSIONS_DAY",100),86400);
    const ids=(mode==="playground"?catalog:catalog.filter(q=>q.examId===question.examId)).map(q=>q.id);
    await query("insert into paessed.practice_sessions(owner_id,id,mode,source_id,generation,revision,state,provisional,completed_at) values($1,$2,$3,$4,$5,$6,$7::text::jsonb,true,$8)",[ownerId,sessionId,mode,sourceId,account.generation,account.revision,encoded({id:sessionId,index:0,answers:{},questionIds:ids,...(importedAt?{completedAt:importedAt}:{})}),importedAt??null]);
    // Imported children each get a cursor position; a large revision group must not block paging.
    account.revision++;
  }
}
function checkAnswerConflict(state: LearningState, action: LearningAction): void {
  let existing: string | undefined;
  if (action.type === "answer") existing = state.nodes.find(n=>n.id===action.nodeId)?.answers[action.questionId];
  if (action.type === "answer-diagnostic") existing = state.diagnostic?.answers[action.questionId];
  if (action.type === "external-attempt") existing = state.attempts.find(a=>a.sessionId===action.sessionId&&a.questionId===action.questionId)?.answer;
  if (existing !== undefined && "answer" in action && existing !== action.answer) throw new Divergence("original-answer");
}
/** A selected alternative uses a new immutable branch; the former projection remains recoverable. */
function selectedLearningAlternative(input: LearningState, action: LearningAction): LearningState {
  const branch=clone(input);
  if(action.type!=="external-attempt"&&action.type!=="answer"&&action.type!=="answer-diagnostic") return reduceLearning(branch,action,catalog);
  const sessionId=action.type==="external-attempt"?action.sessionId:action.type==="answer"?action.nodeId:branch.diagnostic?.id;
  const original=branch.attempts.find(a=>a.sessionId===sessionId&&a.questionId===action.questionId);
  if(!original)return reduceLearning(branch,action,catalog);
  original.answer=action.answer;
  if(action.type==="answer-diagnostic"&&branch.diagnostic)branch.diagnostic.answers[action.questionId]=action.answer;
  if(action.type==="answer"){
    const node=branch.nodes.find(n=>n.id===action.nodeId);
    if(!node)throw new HttpError(409,"La ruta alternativa no está disponible.");
    node.answers[action.questionId]=action.answer;
    const wrong=node.questionIds.filter(id=>node.answers[id]&&node.answers[id]!==byId.get(id)?.correct);
    node.corrections=Object.fromEntries(wrong.map(id=>[id,node.corrections[id]??{tries:0,resolved:false,viaSolution:false}]));
    if (Object.keys(node.answers).length === 5) node.originalCorrect = 5 - wrong.length;
    if(Object.keys(node.answers).length===5&&Object.values(node.corrections).some(c=>!c.resolved)){
      node.state="correction";delete node.completedAt;delete node.xp;
      const later=new Set(branch.nodes.filter(n=>n.position>node.position).map(n=>n.id));
      branch.nodes=branch.nodes.filter(n=>n.position<=node.position);
      branch.attempts=branch.attempts.filter(a=>!later.has(a.sessionId));
      branch.exposures=branch.exposures.filter(e=>!later.has(e.sessionId));
    }
  }
  return planLearning(rebuildImportedState(branch),eligibleCatalog);
}
/** Imported metrics are never trusted. Rebuild originals, eligibility and node XP from Gold. */
export function rebuildImportedState(input: LearningState): LearningState {
  const source = clone(validateLearningState(input));
  // A later generic guest restore must respect the earlier explicit decision
  // not to incorporate that diagnostic, even when it carries other work too.
  const declined = new Set([...(source.diagnosticHandoffs ?? []), ...(source.initialDiagnostic ? [source.initialDiagnostic] : [])].filter(receipt => !receipt.includeEvidence).map(receipt => receipt.sourceId));
  source.attempts = source.attempts.filter(attempt => !declined.has(attempt.sessionId));
  source.exposures = source.exposures.filter(exposure => !declined.has(exposure.sessionId));
  if (source.diagnostic && declined.has(source.diagnostic.id)) source.diagnostic = null;
  const result = clone(source);
  const seen = new Set<string>();
  // Equal timestamps retain submission order, which the mastery calculation weights.
  result.attempts = [...source.attempts].sort((a,b)=>a.at.localeCompare(b.at)).map(a=>{
    const q = byId.get(a.questionId);
    if (!q) throw new HttpError(400,"La evidencia importada debe corresponder al catálogo Gold.");
    const exposures = source.exposures.filter(e=>e.questionId===a.questionId&&e.at<=a.at);
    const assisted = a.assisted || exposures.some(e=>e.sessionId===a.sessionId&&e.assisted&&(e.assistedAt??e.at)<=a.at);
    const eligible = q.eligible&&!assisted&&!seen.has(a.questionId)&&!exposures.some(e=>e.sessionId!==a.sessionId);
    seen.add(a.questionId);
    return { ...a, id: `${a.sessionId}:${a.questionId}`, axisId:q.axisId,unitId:q.unitId,revision:q.revision,correct:a.answer===q.correct,eligible,assisted };
  });
  for (const e of result.exposures) if (!byId.has(e.questionId)) throw new HttpError(400,"Exposición importada fuera del catálogo.");
  for (const node of result.nodes) {
    if (node.questionIds.some(id=>!byId.has(id))) throw new HttpError(400,"Ruta importada fuera del catálogo.");
    if (node.state !== "future") {
      const originals = result.attempts.filter(a=>a.sessionId===node.id);
      if (Object.entries(node.answers).some(([id,answer])=>!originals.some(a=>a.questionId===id&&a.answer===answer))) throw new HttpError(400,"La ruta importada no coincide con sus respuestas originales.");
      node.originalCorrect = originals.filter(a=>a.correct).length;
      if (node.state==="completed") node.xp=originals.filter(a=>a.eligible&&!a.assisted).length*5;
    }
  }
  if (result.diagnostic && Object.entries(result.diagnostic.answers).some(([id,answer])=>!result.attempts.some(a=>a.sessionId===result.diagnostic!.id&&a.questionId===id&&a.answer===answer))) throw new HttpError(400,"Diagnóstico sin evidencia original.");
  return validateLearningState(result);
}
function mergeImport(current: LearningState, incoming: LearningState): LearningState {
  const unused = !current.initialDiagnostic&&!current.attempts.length&&!current.exposures.length&&!current.diagnostic&&current.nodes.every(n=>n.state==="future");
  const rebuilt = rebuildImportedState({ ...incoming, initialDiagnostic: current.initialDiagnostic, diagnosticHandoffs: current.diagnosticHandoffs });
  // Completion receipts come from the validated onboarding endpoint. Restoring
  // a client JSON boolean cannot bypass the initial diagnostic requirement.
  rebuilt.initialDiagnostic = current.initialDiagnostic;
  rebuilt.diagnosticHandoffs = current.diagnosticHandoffs;
  if (unused) return rebuilt;
  if (current.seed!==rebuilt.seed||current.learnerId!==rebuilt.learnerId) throw new Divergence("learning-route");
  const merged = clone(current);
  for (const a of rebuilt.attempts) {
    const old=merged.attempts.find(x=>x.sessionId===a.sessionId&&x.questionId===a.questionId);
    if (old&&old.answer!==a.answer) throw new Divergence("original-answer");
    if (!old) merged.attempts.push(a);
  }
  for (const e of rebuilt.exposures) {
    const old=merged.exposures.find(x=>x.sessionId===e.sessionId&&x.questionId===e.questionId);
    if (!old) merged.exposures.push(e); else {old.assisted ||= e.assisted;old.assistedAt ??= e.assistedAt;}
  }
  for (const n of rebuilt.nodes.filter(n=>n.state!=="future")) {
    const old=merged.nodes.find(x=>x.id===n.id);
    if (old&&old.state!=="future"&&canonicalJson(old)!==canonicalJson(n)) throw new Divergence("learning-route");
    if (old) Object.assign(old,n);else merged.nodes.push(n);
  }
  if (merged.diagnostic&&rebuilt.diagnostic&&canonicalJson(merged.diagnostic)!==canonicalJson(rebuilt.diagnostic)) throw new Divergence("learning-route");
  merged.diagnostic ??= rebuilt.diagnostic;
  merged.initialDiagnostic ??= rebuilt.initialDiagnostic;
  merged.diagnosticHandoffs = current.diagnosticHandoffs;
  merged.revision=Math.max(merged.revision,rebuilt.revision)+1;
  return rebuildImportedState(merged);
}
async function sessionAction(query: Query,ownerId:string,account:Account,action:Session,state:LearningState, operation?: SyncOperation): Promise<LearningState> {
  const existingRows=await query("select state,mode,source_id,revision,provisional,generation,last_device_id,answer_devices,answer_revisions from paessed.practice_sessions where owner_id=$1 and id=$2",[ownerId,action.session.id]);
  const existing=existingRows[0];
  if(existing&&(existing.mode!==action.mode||(!existing.provisional&&existing.source_id!==action.sourceId)||Number(existing.generation)!==account.generation)) throw new HttpError(400,"La identidad de sesión ya tiene otra fuente o generación.");
  const old=existing?.state as Session["session"]|undefined;
  if (old?.sourceRevision && action.session.sourceRevision && old.sourceRevision !== action.session.sourceRevision) throw new Divergence("source-revision");
  const devices = { ...(existing?.answer_devices as Record<string, string> ?? {}) };
  const revisions = { ...(existing?.answer_revisions as Record<string, number> ?? {}) };
  const stale = !!existing && !existing.provisional && !!operation && operation.baseRevision < Number(existing.revision);
  for (const [id, answer] of Object.entries(action.session.answers)) {
    if (stale && old?.answers[id] !== undefined && old.answers[id] !== answer && (devices[id] ?? existing?.last_device_id) !== operation!.deviceId && Number(revisions[id] ?? existing?.revision) > operation!.baseRevision) throw new Divergence("session-draft");
    if (old?.answers[id] !== answer) { devices[id] = operation?.deviceId ?? "resolved"; revisions[id] = account.revision; }
  }
  const incomingAnswers = { ...action.session.answers };
  if (stale) for (const [id, answer] of Object.entries(old?.answers ?? {})) {
    if (incomingAnswers[id] === undefined && (devices[id] ?? existing?.last_device_id) !== operation!.deviceId) incomingAnswers[id] = answer;
  }
  const ids=action.session.questionIds??(old?.questionIds??catalog.filter(q=>q.examId===action.sourceId.slice(8)).map(q=>q.id));
  if(!ids.length||ids.length>1000||new Set(ids).size!==ids.length||action.session.index>=ids.length) throw new HttpError(400,"Orden o posición de sesión inválidos.");
  ids.forEach(id=>validateReference(id,action.sourceId));
  if(Object.keys(action.session.answers).some(id=>!ids.includes(id))||action.session.assisted?.some(id=>!ids.includes(id))||action.session.confirmed?.some(id=>!ids.includes(id)||!action.session.answers[id])) throw new HttpError(400,"Respuesta fuera de la sesión.");
  if(!existing?.provisional&&old?.questionIds&&canonicalJson(old.questionIds)!==canonicalJson(ids)) throw new Divergence("session-order");
  if(old?.confirmed?.some(id=>old.answers[id]!==incomingAnswers[id]))throw new Divergence("original-answer");
  if(!existing?.provisional&&old?.completedAt&&canonicalJson(old.answers)!==canonicalJson(incomingAnswers)) throw new Divergence("original-answer");
  if(!existing){
    const open=await query("select id,source_id,mode from paessed.practice_sessions where owner_id=$1 and generation=$2 and completed_at is null",[ownerId,account.generation]);
    if(open.some(x=>x.mode===action.mode&&x.source_id===action.sourceId)) throw new Divergence("open-session");
    if(open.length>=configuredLimit("OPEN_SESSIONS",20))throw new HttpError(429,"Tienes demasiadas sesiones abiertas.",60);
    await consume(query,`sessions:${ownerId}`,configuredLimit("SESSIONS_DAY",100),86400);
  }
  const value={...action.session,answers:incomingAnswers,questionIds:ids,assisted:[...new Set([...(old?.assisted??[]),...(action.session.assisted??[])])],confirmed:[...new Set([...(old?.confirmed??[]),...(action.session.confirmed??[])])]};
  if(!existing?.provisional&&old?.completedAt)value.completedAt=old.completedAt;
  let next=state;
  if(value.completedAt||value.confirmed.length){
    for(const [id,answer]of Object.entries(value.answers)){
      if(!(action.mode==="exam"&&value.completedAt)&&!value.confirmed.includes(id))continue;
      const prior=state.attempts.find(a=>a.sessionId===value.id&&a.questionId===id);
      if(prior&&prior.answer!==answer)throw new Divergence("original-answer");
      if(byId.has(id))next=reduceLearning(next,{type:"external-attempt",questionId:id,answer,sessionId:value.id,mode:action.mode,assisted:value.assisted.includes(id)},catalog,value.completedAt);
      else await query("insert into paessed.original_answers(owner_id,generation,route_id,session_id,question_id,answer,evidence) values($1,$2,$3,$4,$5,$6,$7::text::jsonb) on conflict do nothing",[ownerId,account.generation,account.active_route,value.id,id,answer,encoded({eligible:false,sourceRevision:value.sourceRevision??null})]);
    }
  }
  await query("insert into paessed.practice_sessions(owner_id,id,mode,source_id,generation,revision,state,completed_at,last_device_id,answer_devices,answer_revisions) values($1,$2,$3,$4,$5,$6,$7::text::jsonb,$8,$9,$10::text::jsonb,$11::text::jsonb) on conflict(owner_id,id) do update set revision=excluded.revision,source_id=excluded.source_id,state=excluded.state,completed_at=excluded.completed_at,provisional=false,last_device_id=excluded.last_device_id,answer_devices=excluded.answer_devices,answer_revisions=excluded.answer_revisions",[ownerId,value.id,action.mode,action.sourceId,account.generation,account.revision,encoded(value),value.completedAt??null,operation?.deviceId??null,encoded(devices),encoded(revisions)]);
  return next;
}
async function apply(query:Query,ownerId:string,account:Account,operation:SyncOperation,state:LearningState,importing:boolean):Promise<LearningState>{
  const action=operation.action;
  const previousRevision = account.revision - 1;
  if(operation.generation!==account.generation)throw new Divergence("generation");
  if(operation.baseRevision>previousRevision)throw new HttpError(400,"Revisión base futura.");
  if(action.type==="learning"){
    const a=action.action;checkAnswerConflict(state,a);
    if ("nodeId" in a && !state.nodes.some(node => node.id === a.nodeId)) throw new HttpError(400, "El nodo educativo no existe.");
    if(a.type==="expose"||a.type==="external-attempt"){
      if(a.mode==="exam"||a.mode==="playground")await registeredSession(query,ownerId,account,a.sessionId,a.mode,a.questionId);
      else if(a.sessionId!==state.diagnostic?.id&&!state.nodes.some(n=>n.id===a.sessionId))throw new HttpError(400,"La sesión educativa no existe.");
    }
    if("questionId" in a&&!byId.has(a.questionId))throw new HttpError(400,"Solo Gold contribuye al aprendizaje.");
    try{return reduceLearning(state,a,catalog,operation.at);}catch(error){if(operation.baseRevision<previousRevision)throw new Divergence("learning-route");throw new HttpError(400,error instanceof Error?error.message:"Transición inválida.");}
  }
  if(action.type==="session")return sessionAction(query,ownerId,account,action,state,operation);
  if(action.type==="saved-question"){
    validateReference(action.questionId);
    await query("insert into paessed.saved_questions(owner_id,question_id,generation,deleted,revision) values($1,$2,$3,$4,$5) on conflict(owner_id,question_id,generation) do update set deleted=excluded.deleted,revision=excluded.revision",[ownerId,action.questionId,account.generation,action.deleted,account.revision]);return state;
  }
  if(action.type==="reset"){
    if (operation.baseRevision !== previousRevision) {
      const foreign = await query("select exists(select 1 from paessed.sync_operations where owner_id=$1 and revision>$2 and device_id<>$3) or exists(select 1 from paessed.sync_conflicts where owner_id=$1 and revision>$2) as changed",[ownerId,operation.baseRevision,operation.deviceId]);
      if (foreign[0]?.changed) throw new Divergence("generation");
    }
    account.generation++;account.reset_revision=account.revision;
    await query("update paessed.account_sync_state set generation=$2,reset_revision=$3 where owner_id=$1",[ownerId,account.generation,account.revision]);
    return initialLearningState(ownerId);
  }
  if(!importing)throw new HttpError(400,"La incorporación requiere confirmación explícita.");
  const merged=mergeImport(state,action.state);
  const external=new Map(action.state.attempts.filter(a=>a.mode==="exam"||a.mode==="playground").map(a=>[a.sessionId,a]));
  for(const attempt of external.values())await registeredSession(query,ownerId,account,attempt.sessionId,attempt.mode,attempt.questionId,attempt.at);
  return merged;
}

export function createSyncService(driver:Database=database()){
  async function pullWith(query:Query,ownerId:string,cursor:number,acknowledgements:SyncResponse["acknowledgements"] = []):Promise<SyncResponse>{
    const accounts=await query("select * from paessed.account_sync_state where owner_id=$1",[ownerId]);
    const account=accounts[0] as unknown as Account;
    if(cursor>Number(account.revision))throw new HttpError(400,"Cursor futuro.");
    const limit=50;
    const rows=await query(`select revision,kind,key,value from (
      select revision,'learning'::text as kind,'current'::text as key,state as value from paessed.learning_states where owner_id=$1 and revision>$2
      union all select revision,'session',mode||':'||source_id,jsonb_build_object('mode',mode,'sourceId',source_id,'session',state) from paessed.practice_sessions where owner_id=$1 and generation=$3 and revision>$2
      union all select revision,'saved-question',question_id,jsonb_build_object('questionId',question_id,'deleted',deleted) from paessed.saved_questions where owner_id=$1 and generation=$3 and revision>$2
      union all select reset_revision,'reset','current',jsonb_build_object('generation',generation) from paessed.account_sync_state where owner_id=$1 and reset_revision>$2
      union all select revision,'conflict',id::text,jsonb_build_object('id',id,'kind',kind,'revision',revision,'current',current_value,'alternative',alternative,'resolved',resolved) from paessed.sync_conflicts where owner_id=$1 and revision>$2
    ) changes order by revision,kind,key limit $4`,[ownerId,cursor,account.generation,limit+1]);
    // Include all entities sharing the boundary revision in the next page rather than skip them.
    const hasMore=rows.length>limit;let page=rows.slice(0,limit);
    if(hasMore){const boundary=Number(rows[limit].revision);page=page.filter(r=>Number(r.revision)<boundary);if(!page.length)throw new HttpError(503,"El cambio requiere un nuevo bootstrap.");}
    const changes=page.map(r=>({...r,revision:Number(r.revision)})) as unknown as SyncChange[];
    const conflicts = changes.filter(change => change.kind === "conflict").map(change => change.value as SyncConflict);
    const cap=(await query("select warning,writes_paused from paessed.capacity_state where singleton"))[0];
    return {revision:Number(account.revision),generation:Number(account.generation),catalogRevision:CATALOG_REVISION,acknowledgements,changes,conflicts,hasMore,cursor:hasMore?Number(page.at(-1)?.revision??cursor):Number(account.revision),capacity:{warning:!!cap?.warning,writesPaused:!!cap?.writes_paused}};
  }
  return {
    async incorporateDiagnostic(ownerId: string, submission: unknown): Promise<{ status: OnboardingStatus; sync: SyncResponse }> {
      const validated = validateGuestDiagnostic(submission);
      return driver.transaction(async query => {
        // All learning writers share this account row lock, including concurrent handoffs.
        const account = await initialize(query, ownerId), previous = await readState(query, ownerId);
        const state = incorporateGuestDiagnostic(previous, validated);
        if (state !== previous) {
          await query("select paessed.refresh_capacity()");
          const capacity = (await query("select writes_paused from paessed.capacity_state where singleton"))[0];
          if (capacity?.writes_paused || process.env.SYNC_WRITES_PAUSED === "true") throw new HttpError(429, "La sincronización está en pausa. Tu diagnóstico sigue guardado.", 3600);
          const cost = Math.max(1, state.attempts.length - previous.attempts.length);
          await consume(query, `education-minute:${ownerId}`, configuredLimit("EDUCATION_MINUTE", 600), 60, cost);
          await consume(query, `education-day:${ownerId}`, configuredLimit("EDUCATION_DAY", 20000), 86400, cost);
          account.revision++;
          await storeState(query, ownerId, account, state, previous);
          await query("update paessed.account_sync_state set revision=$2,updated_at=now() where owner_id=$1", [ownerId, account.revision]);
        }
        return { status: onboardingStatus(state), sync: await pullWith(query, ownerId, 0) };
      });
    },
    async pull(ownerId:string,cursor=0):Promise<SyncResponse>{
      return driver.transaction(async query=>{await initialize(query,ownerId);await query("select paessed.refresh_capacity()");return pullWith(query,ownerId,cursor);});
    },
    async push(ownerId:string,operations:SyncOperation[],cursor=0,importing=false):Promise<SyncResponse>{
      return driver.transaction(async query=>{
        const account=await initialize(query,ownerId);let state=await readState(query,ownerId);
        await query("select paessed.refresh_capacity()");
        const acknowledgements:SyncResponse["acknowledgements"]=[];
        for(const operation of operations){
          const digest=operationDigest(operation);
          const receipt=(await query("select * from paessed.sync_operations where id=$1 or (owner_id=$2 and device_id=$3 and sequence=$4)",[operation.id,ownerId,operation.deviceId,operation.sequence]))[0];
          if(receipt){if(receipt.owner_id!==ownerId||receipt.id!==operation.id||receipt.digest!==digest)throw new HttpError(400,"Un identificador confirmado se reutilizó con contenido distinto.");acknowledgements.push({id:operation.id,sequence:operation.sequence,status:receipt.status as "accepted"|"conflict"});continue;}
          const capacity=(await query("select writes_paused from paessed.capacity_state where singleton"))[0];
          if(capacity?.writes_paused||process.env.SYNC_WRITES_PAUSED==="true")throw new HttpError(429,"La sincronización está en pausa por capacidad. Tu cola local permanece guardada.",3600);
          const device=(await query("select * from paessed.sync_devices where owner_id=$1 and id=$2",[ownerId,operation.deviceId]))[0];
          if(!device){
            const count=(await query("select count(*)::int as n from paessed.sync_devices where owner_id=$1",[ownerId]))[0];
            if(Number(count.n)>=configuredLimit("DEVICES",10))throw new HttpError(429,"Se alcanzó el máximo de dispositivos de esta cuenta.",3600);
            await query("insert into paessed.sync_devices(owner_id,id) values($1,$2)",[ownerId,operation.deviceId]);
          }
          if(operation.sequence!==Number(device?.last_sequence??0)+1)throw new HttpError(400,"Secuencia de dispositivo fuera de orden.");
          if(!Number.isFinite(Date.parse(operation.at))||Date.parse(operation.at)>Date.now()+300000)throw new HttpError(400,"Fecha de operación inválida.");
          const action=operation.action;
          const importedCost=action.type==="restore-learning"?action.state.attempts.filter(a=>!state.attempts.some(old=>old.sessionId===a.sessionId&&old.questionId===a.questionId)).length+action.state.exposures.filter(e=>!state.exposures.some(old=>old.sessionId===e.sessionId&&old.questionId===e.questionId)).length+action.state.nodes.filter(n=>n.state!=="future"&&!state.nodes.some(old=>old.id===n.id&&old.state!=="future")).length:0;
          const confirmedCost=action.type==="session"?Object.keys(action.session.answers).filter(id=>(action.mode==="exam"&&action.session.completedAt||action.session.confirmed?.includes(id))&&!state.attempts.some(a=>a.sessionId===action.session.id&&a.questionId===id)).length:0;
          const cost=Math.max(1,importedCost+confirmedCost);
          await consume(query,`education-minute:${ownerId}`,configuredLimit("EDUCATION_MINUTE",600),60,cost);
          await consume(query,`education-day:${ownerId}`,configuredLimit("EDUCATION_DAY",20000),86400,cost);
          account.revision++;
          let status:"accepted"|"conflict"="accepted";
          // A savepoint prevents a semantic conflict from retaining partial session writes.
          await query("savepoint operation_apply");
          try{const previous=state;state=await apply(query,ownerId,account,operation,state,importing);await storeState(query,ownerId,account,state,operation.action.type==="reset"?undefined:previous);await query("release savepoint operation_apply");}
          catch(error){
            await query("rollback to savepoint operation_apply");await query("release savepoint operation_apply");
            if(!(error instanceof Divergence))throw error;
            status="conflict";
            await query("insert into paessed.sync_conflicts(owner_id,id,generation,kind,revision,current_value,alternative) values($1,$2,$3,$4,$5,$6::text::jsonb,$7::text::jsonb)",[ownerId,randomUUID(),account.generation,error.kind,account.revision,encoded(state),encoded(operation.action)]);
          }
          await query("update paessed.account_sync_state set revision=$2,updated_at=now() where owner_id=$1",[ownerId,account.revision]);
          await query("update paessed.sync_devices set last_sequence=$3,last_seen_at=now() where owner_id=$1 and id=$2",[ownerId,operation.deviceId,operation.sequence]);
          await query("insert into paessed.sync_operations(owner_id,id,device_id,sequence,generation,digest,status,revision,payload) values($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb)",[ownerId,operation.id,operation.deviceId,operation.sequence,operation.generation,digest,status,account.revision,encoded(operation.action)]);
          await technicalEvent(query,status==="accepted"?"sync-accepted":"sync-conflict");
          acknowledgements.push({id:operation.id,sequence:operation.sequence,status});
        }
        return pullWith(query,ownerId,cursor,acknowledgements);
      });
    },
    async resolve(ownerId:string,id:string,choice:"incoming"|"current"):Promise<SyncResponse>{
      return driver.transaction(async query=>{
        const account=await initialize(query,ownerId);
        const conflict=(await query("select * from paessed.sync_conflicts where owner_id=$1 and id=$2 for update",[ownerId,id]))[0];
        if(!conflict)throw new HttpError(404,"Conflicto no encontrado.");
        if(conflict.resolved)return pullWith(query,ownerId,0);
        await query("select paessed.refresh_capacity()");
        const capacity = (await query("select writes_paused from paessed.capacity_state where singleton"))[0];
        if (capacity?.writes_paused || process.env.SYNC_WRITES_PAUSED === "true") throw new HttpError(429, "La sincronización está en pausa por capacidad. Tu cola local permanece guardada.", 3600);
        if(Number(conflict.generation)!==account.generation&&choice==="incoming")throw new HttpError(409,"Este trabajo pertenece a una generación archivada; puedes conservarlo como alternativa.");
        account.revision++;
        if(choice==="incoming"){
          const action=conflict.alternative as SyncAction;
          const latest = await readState(query, ownerId);
          const displaced = action.type === "session" ? await query("select state,source_id,mode from paessed.practice_sessions where owner_id=$1 and (id=$2 or (mode=$3 and source_id=$4 and generation=$5 and completed_at is null))",[ownerId,action.session.id,action.mode,action.sourceId,account.generation]) : [];
          const preserved = { learning: latest, practice: displaced.map(row => ({ mode: row.mode, sourceId: row.source_id, session: row.state })) };
          await query("insert into paessed.sync_conflicts(owner_id,id,generation,kind,revision,current_value,alternative,resolved,choice,resolved_at) values($1,$2,$3,'preserved-before-resolution',$4,$5::text::jsonb,'{}'::jsonb,true,'current',now())",[ownerId,randomUUID(),account.generation,account.revision,encoded(preserved)]);
          account.active_route=randomUUID();
          await query("update paessed.account_sync_state set active_route=$2 where owner_id=$1",[ownerId,account.active_route]);
          if(action.type==="restore-learning")await storeState(query,ownerId,account,rebuildImportedState({...action.state,initialDiagnostic:latest.initialDiagnostic,diagnosticHandoffs:latest.diagnosticHandoffs}));
          else if(action.type==="learning"){
            const next=selectedLearningAlternative(latest,action.action);
            await storeState(query,ownerId,account,next);
          }else if(action.type==="session"){
            let branch=clone(latest);
            for(const [questionId,answer]of Object.entries(action.session.answers)){
              const old=branch.attempts.find(a=>a.sessionId===action.session.id&&a.questionId===questionId);
              if(old)old.answer=answer;
            }
            branch=rebuildImportedState(branch);
            await query("delete from paessed.practice_sessions where owner_id=$1 and (id=$2 or (mode=$3 and source_id=$4 and generation=$5 and completed_at is null))",[ownerId,action.session.id,action.mode,action.sourceId,account.generation]);
            const next=await sessionAction(query,ownerId,account,action,branch);
            await storeState(query,ownerId,account,next);
          }else if (action.type === "reset") {
            account.generation++; account.reset_revision = account.revision;
            await query("update paessed.account_sync_state set generation=$2,reset_revision=$3 where owner_id=$1",[ownerId,account.generation,account.revision]);
            await storeState(query,ownerId,account,initialLearningState(ownerId));
          }else throw new HttpError(409,"Esta alternativa requiere mantener la generación activa.");
        }
        await query("update paessed.sync_conflicts set resolved=true,choice=$3,resolved_at=now(),revision=$4 where owner_id=$1 and id=$2",[ownerId,id,choice,account.revision]);
        await query("update paessed.account_sync_state set revision=$2 where owner_id=$1",[ownerId,account.revision]);
        return pullWith(query,ownerId,0);
      });
    }
  };
}
