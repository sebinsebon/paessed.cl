import { readDiagnosticState, validateLearningState } from "../learning/repository.ts";
import { ACCOUNT_STORES, LOCAL_CHANGED, databaseName, devSandboxActive, enqueueOperation, enqueueLearningRestore, getSyncOwner, listPendingOperations, listPracticeSessions, listSavedQuestions, notifyLocalChange, openLocalDatabase, readSyncMeta, setSyncOwner, type QueuedOperation, type SyncMeta } from "./local.ts";
import type { SyncResponse } from "./contracts";
import type { OnboardingStatus, OnboardingSubmission } from "./contracts";

export type SyncStatusValue = { state: "guest" | "idle" | "syncing" | "paused" | "error"; pending: number; message: string; conflicts: number };
let status: SyncStatusValue = { state: "guest", pending: 0, message: "Progreso guardado en este dispositivo", conflicts: 0 };
const subscribers = new Set<() => void>();
let authenticated = false, retryAt = 0, failures = 0;
let running: Promise<void> | undefined;
let runningOwner: string | null = null;
let identityRequest: Promise<{ owner: string | null }> | undefined;
let activeRequest: AbortController | undefined;
let capacityWarning = false;
export function getSyncStatus() { return status; }
export function subscribeSyncStatus(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener); }; }
function updateStatus(patch: Partial<SyncStatusValue>) { status = { ...status, ...patch }; for (const listener of subscribers) listener(); }
const identityStorageKey = () => `${devSandboxActive() ? "paessed-dev:" : ""}paessed-sync-owner`;

async function readIdentity(): Promise<{ owner: string | null }> {
  if (devSandboxActive()) {
    const account = (await import("../auth/dev-accounts.ts")).selectedDevAccount();
    activeRequest?.abort(); setSyncOwner(account?.id ?? null); authenticated = false;
    updateStatus({ state: "guest", pending: 0, conflicts: 0, message: account ? `Cuenta de prueba · ${account.name}` : "Progreso del entorno de desarrollo" });
    return { owner: account?.id ?? null };
  }
  let cached: string | null = null;
  try { cached = localStorage.getItem(identityStorageKey()); } catch { /* Storage may be disabled. IndexedDB reports an actionable error separately. */ }
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("Sesión no disponible");
    const data = await response.json();
    if (data.user?.id) {
      if (getSyncOwner() !== data.user.id) activeRequest?.abort();
      setSyncOwner(data.user.id); authenticated = true;
      try { localStorage.setItem(identityStorageKey(), data.user.id); } catch { /* IndexedDB still retains the scoped work. */ }
      updateStatus({ state: "idle", message: "Progreso guardado en este dispositivo" });
      await synchronize();
      return { owner: data.user.id };
    }
    activeRequest?.abort();
    cached = null;
    try { localStorage.removeItem(identityStorageKey()); } catch { /* A verified guest still uses guest storage. */ }
  } catch { /* An expired or unreachable session never turns account data into guest data. */ }
  setSyncOwner(cached); authenticated = false;
  updateStatus({ state: cached ? "paused" : "guest", message: cached ? "Sincronización en pausa. Inicia sesión para enviar los cambios pendientes." : "Progreso guardado en este dispositivo" });
  return { owner: cached };
}
export function initializeSyncIdentity(): Promise<{ owner: string | null }> {
  identityRequest ??= readIdentity().finally(() => { identityRequest = undefined; });
  return identityRequest;
}

/** Record the destination and any explicit choice before attempting a guest handoff. */
type GuestDiagnosticHandoff = { owner: string; choice: OnboardingSubmission["includeEvidence"]; confirmed?: boolean };
export async function guestDiagnosticHandoff(id: string, update?: GuestDiagnosticHandoff) {
  const db = await openLocalDatabase(null);
  return new Promise<GuestDiagnosticHandoff | undefined>((resolve, reject) => {
    const tx = db.transaction("meta", update ? "readwrite" : "readonly"), store = tx.objectStore("meta");
    const key = `diagnostic-handoff:${id}`, request = store.get(key);
    let value: typeof update;
    request.onsuccess = () => {
      value = request.result;
      if (update && (!value || value.owner === update.owner && !value.confirmed)) {
        value = value && value.choice !== "if-empty" ? { ...value, ...(update.confirmed ? { confirmed: true } : {}) } : update;
        store.put(value, key);
      }
    };
    tx.oncomplete = () => resolve(value);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

export async function readCompletedDiagnostic(owner: string | null = null): Promise<Omit<OnboardingSubmission, "includeEvidence"> | null> {
  const state = await readDiagnosticState(owner), d = state.diagnostic;
  if (!d?.completedAt) return null;
  if (d.questionIds.some(id => !state.attempts.some(a => a.sessionId === d.id && a.questionId === id && a.mode === "diagnostic" && a.answer === d.answers[id]))) {
    throw new Error("El diagnóstico no coincide con sus respuestas guardadas. Conserva un respaldo para recuperarlo.");
  }
  return { diagnostic: { ...d, completedAt: d.completedAt },
    priorQuestionIds: d.questionIds.filter(id => state.exposures.some(e => e.questionId === id && e.sessionId !== d.id) || state.attempts.some(a => a.questionId === id && a.sessionId !== d.id)),
    assistedQuestionIds: d.questionIds.filter(id => state.attempts.some(a => a.questionId === id && a.sessionId === d.id && a.assisted)),
  };
}

export async function readOnboardingStatus(owner: string): Promise<OnboardingStatus> {
  if (devSandboxActive()) return (await import("../auth/dev-accounts.ts")).devOnboardingStatus(owner);
  return onboardingRequest(owner);
}
async function onboardingRequest(owner: string, submission?: OnboardingSubmission): Promise<OnboardingStatus> {
  if (getSyncOwner() !== owner) throw new Error("La cuenta cambió. Vuelve a abrir tu cuenta.");
  let response: Response;
  try {
    response = await fetch("/api/onboarding", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15_000),
      method: submission ? "POST" : "GET", headers: { "X-PAESSED-Account": owner, ...(submission ? { "Content-Type": "application/json" } : {}) },
      ...(submission ? { body: JSON.stringify(submission) } : {}) });
  } catch {
    throw new Error("No pudimos conectar con tu cuenta. Comprueba tu conexión y vuelve a intentarlo.");
  }
  if (getSyncOwner() !== owner) throw new Error("La cuenta cambió. Tus respuestas siguen guardadas.");
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? "El servidor no pudo confirmar tu diagnóstico.");
  if (submission) { await persistSyncResponse(owner, data.sync); await synchronize(); return data.status; }
  return data;
}
export async function submitGuestDiagnostic(owner: string, submission: OnboardingSubmission): Promise<OnboardingStatus> {
  if (devSandboxActive()) return (await import("../auth/dev-accounts.ts")).devSubmitDiagnostic(owner, submission);
  await synchronize();
  if ((await listPendingOperations(owner)).some(o => ["learning", "restore-learning", "reset"].includes(o.action.type))) {
    throw new Error("Primero debemos sincronizar tu ruta actual. Tus respuestas están guardadas; vuelve a intentarlo.");
  }
  return onboardingRequest(owner, submission);
}

/** Acknowledgements, cursor and remote projection are persisted together. */
export async function persistSyncResponse(owner: string, response: SyncResponse): Promise<void> {
  const db = await openLocalDatabase(owner);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ACCOUNT_STORES, "readwrite"), outbox = tx.objectStore("outbox");
    let failure: unknown;
    for (const acknowledgement of response.acknowledgements ?? []) {
      const request = outbox.get(acknowledgement.sequence);
      request.onsuccess = () => {
        const queued = request.result as QueuedOperation | undefined;
        if (queued?.id === acknowledgement.id) {
          if (acknowledgement.status === "conflict") tx.objectStore("conflicts").put({ id: `local:${queued.id}`, kind: "pending-operation", alternative: queued.action, revision: response.revision, resolved: true }, `local:${queued.id}`);
          outbox.delete(acknowledgement.sequence);
        }
      };
    }
    // Reads issued after deletions execute once the acknowledgement handlers have
    // scheduled those deletions. Use a request barrier before projecting.
    const barrier = outbox.getAll();
    barrier.onsuccess = () => {
      const remainingRequest = outbox.getAll();
      remainingRequest.onsuccess = () => {
        try {
          const remaining = remainingRequest.result as QueuedOperation[];
          const pendingLearning = remaining.some(o => ["learning", "restore-learning", "reset"].includes(o.action.type));
          for (const change of response.changes ?? []) {
            if (change.kind === "conflict") tx.objectStore("conflicts").put(change.value, change.key);
            tx.objectStore("remote").put(change, `${change.kind}:${change.key}`);
            if (change.kind === "learning" && !pendingLearning) tx.objectStore("state").put(validateLearningState(change.value), "current");
            if (change.kind === "session") {
              const v = change.value as { mode: "exam" | "playground"; sourceId: string; session: unknown };
              const pending = remaining.some(o => o.action.type === "session" && o.action.mode === v.mode && o.action.sourceId === v.sourceId);
              if (!pending) {
                tx.objectStore("playground-sessions").put(v.session, `${v.mode}:${v.sourceId}`);
                if (v.mode === "exam" && v.sourceId.startsWith("default:")) tx.objectStore("exam-sessions").put(v.session, v.sourceId.slice(8));
              }
            }
            if (change.kind === "saved-question") {
              if (!remaining.some(o => o.action.type === "saved-question" && o.action.questionId === change.key)) tx.objectStore("saved-questions").put(change.value, change.key);
            }
            if (change.kind === "reset" && !remaining.length) {
              for (const store of ["exam-sessions", "playground-sessions", "saved-questions"]) tx.objectStore(store).clear();
            }
          }
          for (const conflict of response.conflicts ?? []) tx.objectStore("conflicts").put(conflict, conflict.id);
          // The newest shadow survives pages containing only acknowledgements.
          if (!pendingLearning && !(response.changes ?? []).some(c => c.kind === "learning")) {
            const shadow = tx.objectStore("remote").get("learning:current");
            shadow.onsuccess = () => { if (shadow.result) tx.objectStore("state").put(validateLearningState(shadow.result.value), "current"); };
          }
          const shadows = tx.objectStore("remote").getAll();
          shadows.onsuccess = () => {
            try {
              const values = shadows.result as SyncResponse["changes"];
              const resetRevision = Math.max(0, ...values.filter(change => change.kind === "reset").map(change => change.revision));
              if (resetRevision && !remaining.length) for (const store of ["exam-sessions", "playground-sessions", "saved-questions"]) tx.objectStore(store).clear();
              for (const change of values) {
                if (change.revision <= resetRevision && change.kind !== "learning") continue;
                if (change.kind === "session") {
                  const value = change.value as {mode:"exam"|"playground";sourceId:string;session:unknown};
                  if (!remaining.some(o => o.action.type === "session" && o.action.mode === value.mode && o.action.sourceId === value.sourceId)) {
                    tx.objectStore("playground-sessions").put(value.session, `${value.mode}:${value.sourceId}`);
                    if (value.mode === "exam" && value.sourceId.startsWith("default:")) tx.objectStore("exam-sessions").put(value.session, value.sourceId.slice(8));
                  }
                } else if (change.kind === "saved-question" && !remaining.some(o => o.action.type === "saved-question" && o.action.questionId === change.key)) tx.objectStore("saved-questions").put(change.value, change.key);
              }
            } catch (error) { failure = error; tx.abort(); }
          };
          const request = tx.objectStore("meta").get("sync");
          request.onsuccess = () => {
            const meta = request.result as SyncMeta;
            tx.objectStore("meta").put({ ...meta, revision: Math.max(meta.revision, response.revision), generation: Math.max(meta.generation, response.generation), catalogRevision: response.catalogRevision, cursor: response.cursor }, "sync");
          };
        } catch (error) { failure = error; tx.abort(); }
      };
    };
    tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(failure ?? tx.error);
  });
  if (getSyncOwner() === owner && typeof window !== "undefined" && ((response.changes ?? []).length || (response.acknowledgements ?? []).length)) {
    window.dispatchEvent(new Event("paessed-learning-change"));
    const channel = new BroadcastChannel(databaseName(owner)); channel.postMessage("updated"); channel.close();
  }
}

export async function listSyncConflicts(includeResolved = false): Promise<Array<{ id: string; kind: string; resolved: boolean; current?: unknown; alternative?: unknown }>> {
  const owner = getSyncOwner(); if (!owner) return [];
  const db = await openLocalDatabase(owner);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("conflicts", "readonly"), request = tx.objectStore("conflicts").getAll();
    tx.oncomplete = () => resolve(request.result.filter(c => !c.id.startsWith("local:") && (includeResolved || !c.resolved))); tx.onerror = () => reject(tx.error);
  });
}
function retryAfter(response: Response) {
  const value = response.headers.get("Retry-After"), seconds = Number(value);
  return value ? Number.isFinite(seconds) ? seconds * 1000 : Math.max(0, Date.parse(value) - Date.now()) : 0;
}
async function fetchSync(url: string, init?: RequestInit, owner = getSyncOwner()): Promise<SyncResponse> {
  if (!owner) throw new Error("Inicia sesión para sincronizar.");
  const controller = new AbortController(); activeRequest = controller;
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const headers = new Headers(init?.headers); headers.set("X-PAESSED-Account", owner);
  let response: Response;
  try { response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init, headers, signal: controller.signal }); }
  finally { clearTimeout(timeout); if (activeRequest === controller) activeRequest = undefined; }
  if (owner !== getSyncOwner()) throw new Error("La cuenta cambió. El trabajo pendiente permanece en su cuenta original.");
  if (!response.ok) {
    retryAt = Date.now() + Math.max(retryAfter(response), Math.min(60000, 1000 * 2 ** Math.min(++failures, 6)));
    if (response.status === 401) { authenticated = false; updateStatus({ state: "paused", message: "Tu sesión venció. El trabajo pendiente sigue guardado en esta cuenta." }); }
    else if (response.status === 429) updateStatus({ state: "paused", message: "Límite temporal alcanzado. El progreso local está guardado y se reintentará automáticamente." });
    else if (response.status === 413) updateStatus({ state: "error", message: "El lote pendiente es demasiado grande. Se conserva completo en este dispositivo." });
    throw new Error(response.status === 503 ? "La sincronización remota está temporalmente en pausa." : "No se pudo sincronizar. El progreso local sigue guardado.");
  }
  return response.json();
}
async function syncNow() {
  const owner = getSyncOwner();
  if (!owner || !authenticated || Date.now() < retryAt || typeof navigator !== "undefined" && !navigator.onLine) return;
  updateStatus({ state: "syncing", message: "Sincronizando…" });
  try {
    let more = true;
    while (more && owner === getSyncOwner()) {
      const meta = await readSyncMeta(owner);
      const response = await fetchSync(`/api/sync?cursor=${meta.cursor}`, undefined, owner);
      await persistSyncResponse(owner, response); more = response.hasMore;
      capacityWarning = !!response.capacity?.warning;
      if (response.capacity?.writesPaused) {
        updateStatus({state:"paused",pending:(await listPendingOperations(owner)).length,message:"La cuenta alcanzó el umbral de capacidad remota. Tu progreso y sus cambios pendientes siguen guardados en este dispositivo."});
        return;
      }
    }
    let pending = await listPendingOperations(owner);
    while (pending.length && owner === getSyncOwner()) {
      const meta = await readSyncMeta(owner);
      const importOnly = !!pending[0].importOnly, batch: QueuedOperation[] = [];
      for (const operation of pending.slice(0, 50)) {
        if (!!operation.importOnly !== importOnly) break;
        const candidate = [...batch, operation].map(({ importOnly: _local, ...wire }) => wire);
        if (new TextEncoder().encode(JSON.stringify({ operations: candidate, ...(importOnly ? { confirmed: true } : {}) })).byteLength > 245760) break;
        batch.push(operation);
      }
      if (!batch.length) throw new Error("Una operación pendiente supera el tamaño permitido. Se conserva localmente para su recuperación.");
      const response = await fetchSync(importOnly ? "/api/sync/import" : "/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operations: batch.map(({ importOnly: _local, ...wire }) => wire), cursor: meta.cursor, ...(importOnly ? { confirmed: true } : {}) }) }, owner);
      if (!(response.acknowledgements ?? []).length) throw new Error("El servidor no confirmó el lote. Se conserva para reintentar.");
      await persistSyncResponse(owner, response);
      pending = await listPendingOperations(owner);
    }
    failures = 0; retryAt = 0;
    updateStatus({ state: "idle", pending: pending.length, conflicts: (await listSyncConflicts()).length, message: capacityWarning ? "Progreso sincronizado. La capacidad remota superó el 70 %; se suspenderán nuevos envíos al 85 %." : "Progreso sincronizado" });
  } catch (error) {
    if (status.state === "syncing") updateStatus({ state: "error", message: error instanceof Error ? error.message : "El progreso pendiente permanece guardado." });
    updateStatus({ pending: (await listPendingOperations(owner)).length });
  }
}
export async function synchronize(force = false): Promise<void> {
  if (force) retryAt = 0;
  const owner = getSyncOwner(); if (!owner) return;
  if (running) { const previousOwner = runningOwner; await running; if (previousOwner !== owner && getSyncOwner() === owner) return synchronize(); return; }
  runningOwner = owner;
  running = (async () => {
    if (navigator.locks) await navigator.locks.request(`paessed-sync:${owner}`, { ifAvailable: true }, async lock => { if (lock) await syncNow(); });
    else await syncNow();
  })().finally(() => { running = undefined; });
  return running;
}
export function startSync(): () => void {
  let debounce: ReturnType<typeof setTimeout> | undefined, maximum: ReturnType<typeof setTimeout> | undefined;
  const send = () => { clearTimeout(debounce); clearTimeout(maximum); maximum = undefined; void synchronize(); };
  const changed = () => {
    void listPendingOperations().then(p => updateStatus({ pending: p.length }));
    clearTimeout(debounce); debounce = setTimeout(send, 2000);
    maximum ??= setTimeout(send, 10000);
  };
  const resume = () => { if (document.visibilityState === "visible") void initializeSyncIdentity(); };
  const signedOut = () => { authenticated = false; activeRequest?.abort(); setSyncOwner(null); updateStatus({state:"guest",pending:0,conflicts:0,message:"Progreso de invitado guardado en este dispositivo"}); };
  const accountStorage = (event: StorageEvent) => { if (event.key !== identityStorageKey()) return; if (!event.newValue) signedOut(); else resume(); };
  const channel = getSyncOwner() ? new BroadcastChannel(databaseName()) : null;
  if (channel) channel.onmessage = changed;
  window.addEventListener(LOCAL_CHANGED, changed); window.addEventListener("online", resume); window.addEventListener("focus", resume); document.addEventListener("visibilitychange", resume);
  window.addEventListener("paessed-auth-signed-out", signedOut); window.addEventListener("storage", accountStorage);
  const interval = setInterval(() => { if (document.visibilityState === "visible") void synchronize(); }, 60000);
  return () => { clearTimeout(debounce); clearTimeout(maximum); clearInterval(interval); channel?.close(); window.removeEventListener(LOCAL_CHANGED, changed); window.removeEventListener("online", resume); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); window.removeEventListener("paessed-auth-signed-out", signedOut); window.removeEventListener("storage", accountStorage); };
}
export async function resolveSyncConflict(id: string, choice: "incoming" | "current") {
  const owner = getSyncOwner(); if (!owner) return;
  const response = await fetchSync(`/api/sync/conflicts/${encodeURIComponent(id)}/resolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice }) });
  await persistSyncResponse(owner, response); await synchronize();
}

export async function guestProgressSummary(): Promise<{ attempts: number; sessions: number; completedNodes: number; savedQuestions: number; learning: boolean }> {
  const db = await openLocalDatabase(null);
  const owner = getSyncOwner();
  const [practice, saved, learning] = await Promise.all([listPracticeSessions(null), listSavedQuestions(null), new Promise<{attempts:number;sessions:number;completedNodes:number;learning:boolean}>((resolve, reject) => {
    const tx = db.transaction(["state", "exam-sessions"], "readonly"), state = tx.objectStore("state").get("current"), sessions = tx.objectStore("exam-sessions").count();
    tx.oncomplete = () => {
      const value = state.result, diagnostic = value?.diagnostic;
      resolve({ attempts: value?.attempts?.filter((a: { mode: string }) => !owner || a.mode !== "diagnostic").length ?? 0,
        sessions: sessions.result, completedNodes: value?.nodes?.filter((n: { state: string }) => n.state === "completed").length ?? 0,
        learning: value?.goal !== undefined && value.goal !== 2 || !owner && (!!diagnostic?.completedAt || Object.keys(diagnostic?.answers ?? {}).length > 0) });
    }; tx.onerror = () => reject(tx.error);
  })]);
  return { ...learning, sessions: learning.sessions + practice.length, savedQuestions: saved.length };
}
/** Only called after the account's explicit summary/confirmation. Guest originals remain untouched. */
export async function importGuestProgress(): Promise<void> {
  const owner = getSyncOwner(); if (!owner) throw new Error("Inicia sesión para incorporar tu progreso.");
  const guest = await openLocalDatabase(null);
  const snapshot = await new Promise<{ state: unknown; sessions: unknown[]; keys: IDBValidKey[] }>((resolve, reject) => {
    const tx = guest.transaction(["state", "exam-sessions"], "readonly"), state = tx.objectStore("state").get("current"), sessions = tx.objectStore("exam-sessions").getAll(), keys = tx.objectStore("exam-sessions").getAllKeys();
    tx.oncomplete = () => resolve({ state: state.result, sessions: sessions.result, keys: keys.result }); tx.onerror = () => reject(tx.error);
  });
  const state = snapshot.state ? validateLearningState(snapshot.state) : undefined;
  if (state) {
    // Guest diagnostic answers use the dedicated handoff and its recorded choice.
    state.diagnostic = null;
    state.attempts = state.attempts.filter(a => a.mode !== "diagnostic");
    state.exposures = state.exposures.filter(e => e.mode !== "diagnostic");
  }
  const [practice, saved] = await Promise.all([listPracticeSessions(null), listSavedQuestions(null)]);
  if (getSyncOwner() !== owner) throw new Error("La cuenta cambió. Vuelve a confirmar la incorporación.");
  const db = await openLocalDatabase(owner);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["outbox", "meta"], "readwrite");
    if (state && (state.attempts.length || state.exposures.length || state.nodes.some(node => node.state !== "future") || state.goal !== 2 || state.pendingGoal)) {
      enqueueLearningRestore(tx, state);
    }
    snapshot.sessions.forEach((session, i) => enqueueOperation(tx, { type: "session", mode: "exam", sourceId: `default:${snapshot.keys[i]}`, session: session as never }, true));
    practice.forEach(record => enqueueOperation(tx, { type: "session", ...record }, true));
    saved.forEach(questionId => enqueueOperation(tx, { type: "saved-question", questionId, deleted: false }, true));
    tx.objectStore("meta").put(true, "guest-import-confirmed");
    tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error);
  });
  notifyLocalChange(); await synchronize();
}
