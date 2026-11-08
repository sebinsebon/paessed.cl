import { createLearningState, reduceLearning } from "./engine.ts";
import { M1_AXES, M1_UNITS } from "../m1-curriculum.ts";
import type { LearningAction, LearningQuestion, LearningState } from "./types";

const DB = "paessed-learning";
const STORE = "state";
const KEY = "current";
let connection: Promise<IDBDatabase> | undefined;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | undefined;
const bad = (): never => { throw new Error("El respaldo o los datos de Aprender están dañados o tienen un formato incompatible. Conserva una copia para recuperarlos."); };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const date = (value: unknown) => string(value) && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const integer = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && Number(value) >= min;
const bool = (value: unknown) => typeof value === "boolean";
const modes = ["diagnostic", "learn", "playground", "exam"];
const axisIds = M1_AXES.map(a => a.id as string);
const unitById = new Map(M1_UNITS.map(u => [u.id as string, u.axisId as string]));
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(string) && new Set(value).size === value.length; }
function answers(value: unknown, ids: string[]) { return object(value) && Object.entries(value).every(([id, answer]) => ids.includes(id) && string(answer)); }
/** Validate untrusted storage/backups before any reducer sees them. Never reset corrupt data. */
export function validateLearningState(value: unknown): LearningState {
  if (!object(value) || value.version !== 1 || !string(value.learnerId) || !integer(value.seed) || value.seed > 0xffffffff || !integer(value.revision) || ![1, 2, 3].includes(Number(value.goal))) return bad();
  if (typeof value.goal !== "number") return bad();
  if (value.pendingGoal !== undefined && (!object(value.pendingGoal) || ![1, 2, 3].includes(Number(value.pendingGoal.goal)) || typeof value.pendingGoal.goal !== "number" || typeof value.pendingGoal.effectiveDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.pendingGoal.effectiveDate) || !Number.isFinite(Date.parse(value.pendingGoal.effectiveDate)))) return bad();
  if (!Array.isArray(value.attempts) || !Array.isArray(value.exposures) || !Array.isArray(value.nodes)) return bad();
  const attemptIds = new Set(), sessionQuestions = new Set(), eligibleQuestions = new Set();
  for (const a of value.attempts) {
    if (!object(a) || ![a.id, a.questionId, a.sessionId, a.revision, a.answer].every(string) || !modes.includes(String(a.mode)) || !axisIds.includes(String(a.axisId)) || unitById.get(String(a.unitId)) !== a.axisId || !bool(a.correct) || !bool(a.eligible) || !bool(a.assisted) || !date(a.at)) return bad();
    const pair = JSON.stringify([a.sessionId, a.questionId]);
    if (attemptIds.has(a.id) || sessionQuestions.has(pair) || (a.eligible && (a.assisted || eligibleQuestions.has(a.questionId)))) return bad();
    attemptIds.add(a.id); sessionQuestions.add(pair);
    if (a.eligible) eligibleQuestions.add(a.questionId);
  }
  const exposureIds = new Set();
  for (const e of value.exposures) {
    if (!object(e) || ![e.questionId, e.sessionId].every(string) || !modes.includes(String(e.mode)) || !bool(e.assisted) || !date(e.at) || (e.assistedAt !== undefined && (!date(e.assistedAt) || !e.assisted || String(e.assistedAt) < String(e.at)))) return bad();
    const pair = JSON.stringify([e.sessionId, e.questionId]);
    if (exposureIds.has(pair)) return bad();
    exposureIds.add(pair);
  }
  const nodeIds = new Set(), positions = new Set();
  let inProgress = 0;
  for (const n of value.nodes) {
    if (!object(n) || !string(n.id) || !integer(n.position) || !["M", "R"].includes(String(n.type)) || !axisIds.includes(String(n.axisId)) || unitById.get(String(n.unitId)) !== n.axisId || !strings(n.questionIds) || n.questionIds.length > 5 || !["future", "active", "correction", "completed"].includes(String(n.state)) || !integer(n.index) || n.index > n.questionIds.length || !answers(n.answers, n.questionIds) || !object(n.corrections)) return bad();
    if (nodeIds.has(n.id) || positions.has(n.position)) return bad();
    nodeIds.add(n.id); positions.add(n.position);
    if (n.startedAt !== undefined && !date(n.startedAt)) return bad();
    if (n.completedAt !== undefined && !date(n.completedAt)) return bad();
    if (n.originalCorrect !== undefined && (!integer(n.originalCorrect) || n.originalCorrect > 5)) return bad();
    if (n.xp !== undefined && (!integer(n.xp) || n.xp > 25 || n.xp % 5)) return bad();
    if ((n.exploration !== undefined && !bool(n.exploration)) || (n.substitution !== undefined && !bool(n.substitution))) return bad();
    for (const [id, c] of Object.entries(n.corrections)) if (!n.questionIds.includes(id) || !Object.hasOwn(n.answers!, id) || !object(c) || !integer(c.tries) || !bool(c.resolved) || !bool(c.viaSolution) || (c.viaSolution && (!c.resolved || c.tries < 2))) return bad();
    if (n.state === "future" && (Object.keys(n.answers!).length || Object.keys(n.corrections).length || n.startedAt || n.completedAt || n.index)) return bad();
    if (n.state !== "future" && (!date(n.startedAt) || n.questionIds.length !== 5 || n.index !== Object.keys(n.answers!).length)) return bad();
    if (["correction", "completed"].includes(String(n.state)) && (Object.keys(n.answers!).length !== 5 || !integer(n.originalCorrect) || Object.keys(n.corrections).length !== 5 - n.originalCorrect)) return bad();
    if (n.state === "completed" && (!date(n.completedAt) || !integer(n.xp) || Object.values(n.corrections).some(c => !(c as { resolved: boolean }).resolved))) return bad();
    if (n.state === "active" || n.state === "correction") inProgress++;
  }
  if (inProgress > 1) return bad();
  const d = value.diagnostic;
  if (d !== null && (!object(d) || !string(d.id) || !strings(d.questionIds) || d.questionIds.length !== 16 || !answers(d.answers, d.questionIds) || !date(d.startedAt) || (d.completedAt !== undefined && (!date(d.completedAt) || Object.keys(d.answers!).length !== 16)))) return bad();
  return JSON.parse(JSON.stringify(value)) as LearningState;
}
function open(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error("Aprender necesita IndexedDB. Habilita el almacenamiento del navegador para conservar tu progreso."));
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      if (!request.result.objectStoreNames.contains("exam-sessions")) request.result.createObjectStore("exam-sessions");
    };
    request.onerror = () => { connection = undefined; reject(request.error ?? new Error("No se pudo abrir el progreso de Aprender.")); };
    request.onblocked = () => { connection = undefined; reject(new Error("Otra pestaña bloquea el almacenamiento de Aprender. Ciérrala y vuelve a intentar.")); };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); connection = undefined; };
      resolve(db);
    };
  });
  return connection;
}
function broadcast() {
  for (const listener of listeners) { try { listener(); } catch { /* A subscriber cannot roll back a committed transaction. */ } }
  getChannel()?.postMessage("updated");
}
function getChannel() {
  if (!channel && typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(DB);
    channel.onmessage = () => { for (const listener of listeners) { try { listener(); } catch { /* Isolate consumers. */ } } };
  }
  return channel;
}
export function subscribeLearning(cb: () => void): () => void {
  listeners.add(cb); getChannel();
  return () => { listeners.delete(cb); };
}
async function transaction(update?: (state: LearningState) => LearningState): Promise<LearningState> {
  const db = await open();
  return new Promise((resolve, reject) => {
    // Read and reducer run within one write transaction; another tab cannot read
    // an old revision and overwrite an answer committed by this transaction.
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.get(KEY);
    let result: LearningState, failure: unknown, changed = false;
    request.onsuccess = () => {
      try {
        const before = request.result === undefined ? createLearningState() : validateLearningState(request.result);
        result = update ? validateLearningState(update(before)) : before;
        changed = request.result === undefined || JSON.stringify(before) !== JSON.stringify(result);
        if (changed) store.put(result, KEY);
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => { if (changed) broadcast(); resolve(result); };
    tx.onabort = tx.onerror = () => reject(failure ?? tx.error ?? new Error("No se pudo guardar el progreso de Aprender. Vuelve a intentar."));
  });
}
export function readLearningState(): Promise<LearningState> { return transaction(); }
export function dispatchLearning(action: LearningAction, catalog: LearningQuestion[]): Promise<LearningState> { return transaction(state => reduceLearning(state, action, catalog)); }
export function exportLearningState(): Promise<LearningState> { return readLearningState(); }

function mergeStates(current: LearningState, incoming: LearningState): LearningState {
  const unused = !current.attempts.length && !current.exposures.length && !current.diagnostic && current.nodes.every(n => n.state === "future");
  if (current.learnerId !== incoming.learnerId && unused) return validateLearningState(incoming);
  if (current.learnerId !== incoming.learnerId) throw new Error("Este respaldo pertenece a otro estudiante. No se puede mezclar con el progreso de este navegador.");
  if (current.seed !== incoming.seed) return bad();
  const result = JSON.parse(JSON.stringify(current.revision >= incoming.revision ? current : incoming)) as LearningState;
  const attempts = new Map(current.attempts.map(a => [a.id, { ...a }]));
  for (const a of incoming.attempts) {
    const existing = attempts.get(a.id);
    if (existing && (existing.questionId !== a.questionId || existing.sessionId !== a.sessionId || existing.answer !== a.answer || existing.correct !== a.correct || existing.axisId !== a.axisId || existing.unitId !== a.unitId || existing.mode !== a.mode || existing.revision !== a.revision)) throw new Error("El respaldo contiene respuestas originales incompatibles con el progreso guardado.");
    attempts.set(a.id, existing ? { ...existing, assisted: existing.assisted || a.assisted, eligible: existing.eligible && a.eligible } : { ...a });
  }
  result.attempts = [...attempts.values()].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const seenEligible = new Set<string>();
  for (const a of result.attempts) { if (seenEligible.has(a.questionId) || a.assisted) a.eligible = false; if (a.eligible) seenEligible.add(a.questionId); }
  const exposures = new Map(current.exposures.map(e => [JSON.stringify([e.sessionId, e.questionId]), { ...e }]));
  for (const e of incoming.exposures) {
    const key = JSON.stringify([e.sessionId, e.questionId]), existing = exposures.get(key);
    const assistedTimes = [existing?.assistedAt ?? (existing?.assisted ? existing.at : undefined), e.assistedAt ?? (e.assisted ? e.at : undefined)].filter((at): at is string => !!at).sort();
    exposures.set(key, existing ? { ...existing, at: existing.at < e.at ? existing.at : e.at, assisted: existing.assisted || e.assisted, ...(assistedTimes.length ? { assistedAt: assistedTimes[0] } : {}) } : { ...e });
  }
  result.exposures = [...exposures.values()].sort((a, b) => a.at.localeCompare(b.at) || a.questionId.localeCompare(b.questionId));
  for (const a of result.attempts) if (result.exposures.some(e => e.questionId === a.questionId && e.sessionId === a.sessionId && e.assisted && (e.assistedAt ?? e.at) < a.at)) { a.assisted = true; a.eligible = false; }
  const rank = { future: 0, active: 1, correction: 2, completed: 3 };
  const nodes = new Map(current.nodes.map(n => [n.id, JSON.parse(JSON.stringify(n)) as typeof n]));
  for (const n of incoming.nodes) {
    const existing = nodes.get(n.id);
    if (!existing || existing.state === "future") { nodes.set(n.id, JSON.parse(JSON.stringify(n))); continue; }
    if (n.state === "future") continue;
    if (JSON.stringify(existing.questionIds) !== JSON.stringify(n.questionIds) || existing.position !== n.position || existing.type !== n.type || existing.axisId !== n.axisId || existing.unitId !== n.unitId) throw new Error("El respaldo contiene un nodo iniciado incompatible con el progreso guardado.");
    for (const [id, answer] of Object.entries(n.answers)) {
      if (Object.hasOwn(existing.answers, id) && existing.answers[id] !== answer) throw new Error("El respaldo contiene respuestas originales incompatibles con el progreso guardado.");
      existing.answers[id] = answer;
    }
    if (rank[n.state] > rank[existing.state]) { existing.state = n.state; existing.completedAt = n.completedAt; existing.originalCorrect = n.originalCorrect; existing.xp = n.xp; }
    existing.index = Object.keys(existing.answers).length;
    for (const [id, c] of Object.entries(n.corrections)) {
      const old = existing.corrections[id];
      existing.corrections[id] = old ? { tries: Math.max(old.tries, c.tries), resolved: old.resolved || c.resolved, viaSolution: old.viaSolution || c.viaSolution } : { ...c };
    }
  }
  result.nodes = [...nodes.values()].sort((a, b) => a.position - b.position);
  if (current.diagnostic && incoming.diagnostic) {
    if (current.diagnostic.id !== incoming.diagnostic.id || JSON.stringify(current.diagnostic.questionIds) !== JSON.stringify(incoming.diagnostic.questionIds)) throw new Error("Los diagnósticos del respaldo y del navegador son incompatibles.");
    result.diagnostic = JSON.parse(JSON.stringify(current.diagnostic));
    for (const [id, answer] of Object.entries(incoming.diagnostic.answers)) {
      if (Object.hasOwn(result.diagnostic!.answers, id) && result.diagnostic!.answers[id] !== answer) throw new Error("El respaldo contiene respuestas de diagnóstico incompatibles.");
      result.diagnostic!.answers[id] = answer;
    }
    result.diagnostic!.completedAt ??= incoming.diagnostic.completedAt;
  } else result.diagnostic = current.diagnostic ?? incoming.diagnostic;
  result.revision = Math.max(current.revision, incoming.revision) + 1;
  return validateLearningState(result);
}
export function restoreLearningState(value: unknown): Promise<LearningState> {
  let parsed: unknown = value;
  if (typeof value === "string") { try { parsed = JSON.parse(value); } catch { return Promise.reject(new Error("El archivo de respaldo no contiene JSON válido.")); } }
  let incoming: LearningState;
  try { incoming = validateLearningState(parsed); } catch (error) { return Promise.reject(error); }
  return transaction(state => mergeStates(state, incoming));
}
