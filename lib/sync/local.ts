import type { LearningState } from "../learning/types";
import type { SyncOperation } from "./contracts";
import { CATALOG_REVISION } from "./protocol.ts";

// The guest database keeps its original name and version. Account caches never
// share a key or a database with it, including when a session expires.
let owner: string | null = null;
const connections = new Map<string, Promise<IDBDatabase>>();
export const ACCOUNT_STORES = ["state", "exam-sessions", "playground-sessions", "saved-questions", "outbox", "meta", "conflicts", "remote"];
export const LOCAL_CHANGED = "paessed-sync-local-change";
export type SyncMeta = { deviceId: string; sequence: number; revision: number; generation: number; catalogRevision: string; cursor: number };
export type PracticeSession = { id: string; index: number; questionIds?: string[]; answers: Record<string, string>; completedAt?: string; assisted?: string[]; confirmed?: string[]; evidenceDelivered?: boolean; sourceRevision?: string };
export type QueuedOperation = SyncOperation & { importOnly?: boolean };

export function getSyncOwner() { return owner; }
export function setSyncOwner(value: string | null) {
  if (value !== null && !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)) throw new Error("Cuenta inválida.");
  if (owner === value) return;
  owner = value;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("paessed-sync-owner-change"));
}
export function devSandboxActive() { return typeof window !== "undefined" && (window as Window & { __PAESSED_DEV_SANDBOX__?: boolean }).__PAESSED_DEV_SANDBOX__ === true; }
export function databaseName(value: string | null = owner) { return `${devSandboxActive() ? "paessed-dev:" : ""}${value ? `paessed-account-${value}-v3` : "paessed-learning"}`; }
export function initialMeta(): SyncMeta { return { deviceId: crypto.randomUUID(), sequence: 0, revision: 0, generation: 0, catalogRevision: CATALOG_REVISION, cursor: 0 }; }
export function scopedStorageKey(key: string) { return `${devSandboxActive() ? "paessed-dev:" : ""}${owner ? `paessed-account:${owner}:${key}` : key}`; }
export function createAccountLearningState(value: string): LearningState {
  let seed = 2166136261;
  for (let i = 0; i < value.length; i++) seed = Math.imul(seed ^ value.charCodeAt(i), 16777619);
  return { version: 1, learnerId: value, seed: seed >>> 0, revision: 0, goal: 2, attempts: [], exposures: [], nodes: [], diagnostic: null };
}
export function openLocalDatabase(value: string | null = owner, sidecar = false): Promise<IDBDatabase> {
  const name = value ? databaseName(value) : sidecar ? `${devSandboxActive() ? "paessed-dev:" : ""}paessed-guest-practice-v3` : databaseName(null);
  if (!globalThis.indexedDB) return Promise.reject(new Error("Habilita IndexedDB para conservar el progreso local."));
  let connection = connections.get(name);
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        for (const store of ACCOUNT_STORES) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
        request.transaction!.objectStore("meta").put(initialMeta(), "sync");
      };
      request.onerror = () => { connections.delete(name); reject(request.error); };
      request.onblocked = () => { connections.delete(name); reject(new Error("Cierra otras pestañas de PAESSED para abrir el progreso.")); };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); connections.delete(name); };
        resolve(db);
      };
    });
    connections.set(name, connection);
  }
  return connection;
}
export function notifyLocalChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCAL_CHANGED));
}
/** Must run inside the transaction that stores the user's work. */
type PendingAction = { action: SyncOperation["action"]; importOnly: boolean; at: string };
const transactionMetadata = new WeakMap<IDBTransaction, { meta?: SyncMeta; waiting: PendingAction[] }>();
export function enqueueOperation(tx: IDBTransaction, action: SyncOperation["action"], importOnly = false, at = new Date().toISOString()): void {
  if (devSandboxActive()) return;
  const metaStore = tx.objectStore("meta");
  let cached = transactionMetadata.get(tx);
  const write = (meta: SyncMeta, pending: PendingAction) => {
    meta.sequence++;
    const operation: QueuedOperation = { id: crypto.randomUUID(), deviceId: meta.deviceId, sequence: meta.sequence, baseRevision: meta.revision, generation: meta.generation, contractVersion: 1, catalogRevision: CATALOG_REVISION, at:pending.at, action:pending.action, ...(pending.importOnly ? { importOnly: true } : {}) };
    tx.objectStore("outbox").put(operation, operation.sequence);
    if (pending.action.type === "reset") meta.generation++;
    metaStore.put(meta, "sync");
  };
  if(cached?.meta){write(cached.meta,{action,importOnly,at});return;}
  if(cached){cached.waiting.push({action,importOnly,at});return;}
  cached={waiting:[{action,importOnly,at}]};transactionMetadata.set(tx,cached);
  const request=metaStore.get("sync");
  request.onsuccess=()=>{cached!.meta=(request.result??initialMeta())as SyncMeta;for(const pending of cached!.waiting)write(cached!.meta,pending);cached!.waiting=[];};
}
/** Independent valid projections keep each import operation below the wire limit. */
export function partitionLearningRestore(state: LearningState): LearningState[] {
  const base = { ...state, nodes: [], attempts: [], exposures: [], diagnostic: null } as LearningState;
  const groups: LearningState[] = [], usedAttempts = new Set<string>(), usedExposures = new Set<string>();
  const exposureKey = (e: LearningState["exposures"][number]) => JSON.stringify([e.sessionId, e.questionId]);
  const sessionGroup = (sessionId: string, node?: LearningState["nodes"][number], diagnostic?: LearningState["diagnostic"]) => {
    const attempts = state.attempts.filter(a => a.sessionId === sessionId), exposures = state.exposures.filter(e => e.sessionId === sessionId);
    attempts.forEach(a => usedAttempts.add(a.id)); exposures.forEach(e => usedExposures.add(exposureKey(e)));
    groups.push({ ...base, attempts, exposures, nodes: node ? [node] : [], diagnostic: diagnostic ?? null });
  };
  if (state.diagnostic) sessionGroup(state.diagnostic.id, undefined, state.diagnostic);
  for (const node of state.nodes) sessionGroup(node.id, node);
  const remaining = state.attempts.filter(a => !usedAttempts.has(a.id));
  for (let i = 0; i < remaining.length; i += 50) {
    const attempts = remaining.slice(i, i + 50), pairs = new Set(attempts.map(a => JSON.stringify([a.sessionId, a.questionId])));
    const exposures = state.exposures.filter(e => pairs.has(exposureKey(e)) && !usedExposures.has(exposureKey(e)));
    exposures.forEach(e => usedExposures.add(exposureKey(e)));
    groups.push({ ...base, attempts, exposures });
  }
  const exposures = state.exposures.filter(e => !usedExposures.has(exposureKey(e)));
  for (let i = 0; i < exposures.length; i += 100) groups.push({ ...base, exposures: exposures.slice(i, i + 100) });
  if (!groups.length) groups.push(base);
  for (const group of groups) if (new TextEncoder().encode(JSON.stringify(group)).byteLength > 200_000) throw new Error("Una sesión del respaldo excede el límite de incorporación. El original se conserva para recuperarlo.");
  return groups;
}
export function enqueueLearningRestore(tx: IDBTransaction, state: LearningState): void {
  for (const part of partitionLearningRestore(state)) enqueueOperation(tx, { type: "restore-learning", state: part }, true);
}
export async function readSyncMeta(value: string | null = owner): Promise<SyncMeta> {
  const db = await openLocalDatabase(value, !value);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readonly"), request = tx.objectStore("meta").get("sync");
    tx.oncomplete = () => resolve(request.result ?? initialMeta()); tx.onerror = () => reject(tx.error);
  });
}
export async function listPendingOperations(value: string | null = owner): Promise<QueuedOperation[]> {
  if (!value) return [];
  const db = await openLocalDatabase(value);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readonly"), request = tx.objectStore("outbox").getAll();
    tx.oncomplete = () => resolve(request.result); tx.onerror = () => reject(tx.error);
  });
}
export function validatePracticeSession(value: PracticeSession) {
  const reference = (id: unknown): id is string => typeof id === "string" && /^(?:demre|personal):[a-f\d]{64}:[1-9]\d{0,3}$/.test(id);
  const refs = (ids: unknown): ids is string[] => Array.isArray(ids) && ids.length <= 1000 && ids.every(reference) && new Set(ids).size === ids.length;
  if (!value || typeof value.id !== "string" || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value.id) || !Number.isSafeInteger(value.index) || value.index < 0 || value.index > 999 || !value.answers || typeof value.answers !== "object" || Array.isArray(value.answers) || Object.keys(value.answers).length > 1000 || Object.entries(value.answers).some(([id,v]) => !reference(id) || typeof v !== "string" || !/^[A-E]$/.test(v)) || value.questionIds !== undefined && (!refs(value.questionIds) || !value.questionIds.length || value.index >= value.questionIds.length) || value.assisted !== undefined && !refs(value.assisted) || value.confirmed !== undefined && (!refs(value.confirmed) || value.confirmed.some(id => !Object.hasOwn(value.answers,id))) || value.completedAt !== undefined && (typeof value.completedAt !== "string" || !Number.isFinite(Date.parse(value.completedAt))) || value.evidenceDelivered !== undefined && typeof value.evidenceDelivered !== "boolean" || value.sourceRevision !== undefined && !/^[a-f\d]{64}$/.test(value.sourceRevision)) throw new Error("Sesión de práctica inválida.");
}
export async function readPlaygroundSession(sourceId = "playground"): Promise<PracticeSession | null> {
  return readPracticeSession("playground", sourceId);
}
export async function readPracticeSession(mode: "exam" | "playground", sourceId: string): Promise<PracticeSession | null> {
  const db = await openLocalDatabase(owner, !owner);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("playground-sessions", "readonly"), request = tx.objectStore("playground-sessions").get(`${mode}:${sourceId}`);
    tx.oncomplete = () => resolve(request.result ?? null); tx.onerror = () => reject(tx.error);
  });
}
export async function savePlaygroundSession(sourceId: string, session: PracticeSession): Promise<void> {
  return savePracticeSession("playground", sourceId, session);
}
export async function savePracticeSession(mode: "exam" | "playground", sourceId: string, session: PracticeSession): Promise<void> {
  validatePracticeSession(session);
  if (!sourceId || sourceId.length > 160) throw new Error("Fuente de práctica inválida.");
  // Select fields explicitly: neither question content nor drawings can enter an outbox.
  const value: PracticeSession = { id: session.id, index: session.index, answers: { ...session.answers }, ...(session.questionIds ? { questionIds: [...session.questionIds] } : {}), ...(session.completedAt ? { completedAt: session.completedAt } : {}), ...(session.assisted ? { assisted: [...session.assisted] } : {}), ...(session.confirmed ? { confirmed: [...session.confirmed] } : {}), ...(session.evidenceDelivered !== undefined ? { evidenceDelivered: session.evidenceDelivered } : {}), ...(session.sourceRevision ? {sourceRevision:session.sourceRevision} : {}) };
  const capturedOwner = owner, db = await openLocalDatabase(capturedOwner, !capturedOwner);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(capturedOwner ? ["playground-sessions", "outbox", "meta"] : ["playground-sessions"], "readwrite");
    const store=tx.objectStore("playground-sessions"),request=store.get(`${mode}:${sourceId}`);
    request.onsuccess=()=>{if(JSON.stringify(request.result)===JSON.stringify(value))return;store.put(value, `${mode}:${sourceId}`);if (capturedOwner) enqueueOperation(tx, { type: "session", mode, sourceId, session: value });};
    tx.oncomplete = () => { notifyLocalChange(); resolve(); }; tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
export async function listPracticeSessions(value: string | null = owner): Promise<Array<{mode:"exam"|"playground";sourceId:string;session:PracticeSession}>> {
  const db=await openLocalDatabase(value,!value);
  return new Promise((resolve,reject)=>{const tx=db.transaction("playground-sessions","readonly"),store=tx.objectStore("playground-sessions"),keys=store.getAllKeys(),values=store.getAll();tx.oncomplete=()=>resolve(keys.result.map((key,i)=>{const text=String(key),colon=text.indexOf(":");return {mode:text.slice(0,colon)as"exam"|"playground",sourceId:text.slice(colon+1),session:values.result[i]};}));tx.onerror=()=>reject(tx.error);});
}
export async function listSavedQuestions(value: string | null = owner): Promise<string[]> {
  const db = await openLocalDatabase(value, !value);
  if(!value && typeof localStorage!=="undefined") {
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction(["meta","saved-questions"],"readwrite"),meta=tx.objectStore("meta"),request=meta.get("legacy-saved-migrated");request.onsuccess=()=>{if(request.result)return;try{const values=JSON.parse(localStorage.getItem("paessed-playground-saved-questions")??"[]");if(!Array.isArray(values))throw new Error("Preguntas guardadas inválidas.");for(const questionId of values){if(typeof questionId!=="string"||!/^(?:demre|personal):[a-f\d]{64}:\d+$/.test(questionId))continue;const store=tx.objectStore("saved-questions"),existing=store.get(questionId);existing.onsuccess=()=>{if(existing.result===undefined)store.put({questionId,deleted:false},questionId);};}meta.put(true,"legacy-saved-migrated");}catch{ /* Preserve malformed originals for manual recovery. */ }};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction("saved-questions", "readonly"), request = tx.objectStore("saved-questions").getAll();
    tx.oncomplete = () => resolve(request.result.filter(v => !v.deleted).map(v => v.questionId)); tx.onerror = () => reject(tx.error);
  });
}
export async function saveQuestion(questionId: string, saved: boolean): Promise<void> {
  if (!/^(?:demre|personal):[a-f\d]{64}:\d+$/.test(questionId)) throw new Error("Referencia de pregunta inválida.");
  const capturedOwner = owner, db = await openLocalDatabase(capturedOwner, !capturedOwner);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(capturedOwner ? ["saved-questions", "outbox", "meta"] : ["saved-questions"], "readwrite");
    const action = { type: "saved-question" as const, questionId, deleted: !saved };
    const store = tx.objectStore("saved-questions"), request = store.get(questionId);
    request.onsuccess = () => { if (request.result?.deleted === action.deleted) return; store.put(action, questionId); if (capturedOwner) enqueueOperation(tx, action); };
    tx.oncomplete = () => { notifyLocalChange(); resolve(); }; tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
