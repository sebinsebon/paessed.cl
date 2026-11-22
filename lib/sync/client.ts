import { readDiagnosticState, validateLearningState } from "../learning/repository.ts";
import { ACCOUNT_STORES, LOCAL_CHANGED, LOCAL_OWNER_CHANGED, databaseName, devSandboxActive, enqueueOperation, enqueueLearningRestore, getSyncOwner, listPendingOperations, listPracticeSessions, listSavedQuestions, notifyLocalChange, openLocalDatabase, readGuestSavedQuestions, readSyncMeta, setSyncOwner, type QueuedOperation, type SyncMeta } from "./local.ts";
import type { SyncResponse } from "./contracts";
import type { OnboardingStatus, OnboardingSubmission } from "./contracts";
import { fetchSession, type AccountInfo } from "../auth/session-fetch.ts";
import { readSessionRevision, SESSION_REVISION_COOKIE } from "../auth/session-revision.ts";

export type SyncStatusValue = { state: "guest" | "idle" | "syncing" | "paused" | "error"; pending: number; message: string; conflicts: number };
let status: SyncStatusValue = { state: "guest", pending: 0, message: "Progreso guardado en este dispositivo", conflicts: 0 };
const subscribers = new Set<() => void>();
let authenticated = false, retryAt = 0, failures = 0;
let running: Promise<void> | undefined;
let runningOwner: string | null = null;
let runningEpoch = 0;
type VerifiedIdentity = { status: "verified"; epoch: number; owner: string | null };
type SyncIdentity = { status: "checking" | "unavailable"; epoch: number } |
  VerifiedIdentity;
const initialIdentity: SyncIdentity = { status: "checking", epoch: 0 };
let identity: SyncIdentity = initialIdentity;
let verifiedAccount: AccountInfo | null = null;
let verifiedRevision: string | null = null;
const SESSION_FRESHNESS_MS = 5 * 60_000;
let verifiedUntil = 0;
let identityExpiry: ReturnType<typeof setTimeout> | undefined;
let identityWatchers = 0;
let syncIdentityWatchers = 0;
let identityRequest: { controller: AbortController; revision: string | null; promise: Promise<VerifiedIdentity | undefined> } | undefined;
let bootstrap: { epoch: number; promise: Promise<void> } | undefined;
const identityListeners = new Set<() => void>();
let importController: AbortController | undefined;
let activeRequest: AbortController | undefined;
let capacityWarning = false;
export function getSyncStatus() { return status; }
export function subscribeSyncStatus(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener); }; }
function updateStatus(patch: Partial<SyncStatusValue>) { status = { ...status, ...patch }; for (const listener of subscribers) listener(); }
const identityStorageKey = () => `${devSandboxActive() ? "paessed-dev:" : ""}paessed-sync-owner`;

export function getSyncIdentity() { return identity; }
export function getInitialSyncIdentity() { return initialIdentity; }
export function invalidateSyncIdentity() { invalidateIdentity("checking"); }
function browserSessionRevision() {
  return typeof document !== "undefined" && !devSandboxActive() ? readSessionRevision(document.cookie) : null;
}
export function matchesBrowserSession() {
  return verifiedRevision === browserSessionRevision();
}
export function getVerifiedAccount() {
  return identity.status === "verified" && identity.owner === getSyncOwner() && matchesBrowserSession() ? verifiedAccount : null;
}
export function subscribeSyncIdentity(listener: () => void) {
  identityListeners.add(listener);
  return () => { identityListeners.delete(listener); };
}
function cancelGuestImports() {
  const controller = importController;
  importController = undefined;
  controller?.abort();
}
function publishIdentity(next: SyncIdentity) {
  const previous = identity;
  identity = next;
  if (next.status !== "verified") {
    verifiedAccount = null;
    verifiedUntil = 0;
  }
  if (next.status !== "verified" || next.epoch !== previous.epoch) cancelGuestImports();
  scheduleIdentityExpiry();
  for (const listener of identityListeners) listener();
}
function cancelIdentityRequest() {
  identityRequest?.controller.abort();
  identityRequest = undefined;
}
function invalidateIdentity(status: "checking" | "unavailable") {
  cancelIdentityRequest();
  activeRequest?.abort();
  authenticated = false;
  bootstrap = undefined;
  publishIdentity({ status, epoch: identity.epoch + 1 });
}
function confirmIdentity(account: AccountInfo, remote: boolean, revision: string | null): VerifiedIdentity {
  const owner = account.user?.id ?? null;
  const changed = owner !== getSyncOwner();
  if (changed) {
    activeRequest?.abort();
    retryAt = 0;
    failures = 0;
    capacityWarning = false;
  }
  setSyncOwner(owner);
  authenticated = remote && !!owner;
  verifiedAccount = account;
  verifiedRevision = revision;
  verifiedUntil = Date.now() + SESSION_FRESHNESS_MS;
  const verified: VerifiedIdentity = { status: "verified", owner, epoch: identity.epoch + Number(changed) };
  publishIdentity(verified);
  if (changed || !authenticated || status.state === "paused" && status.message.startsWith("Tu sesión venció")) {
    updateStatus({ state: owner ? "idle" : "guest", pending: 0, conflicts: 0, message: "Progreso guardado en este dispositivo" });
  }
  return verified;
}

function currentOwner(owner: string, epoch: number) {
  return identity.epoch === epoch && owner === getSyncOwner() && matchesBrowserSession();
}

async function readIdentity(signal: AbortSignal, revision: string | null): Promise<VerifiedIdentity | undefined> {
  try {
    const remote = !devSandboxActive();
    const account = remote ? await fetchSession(signal) : (await import("../auth/dev-accounts.ts")).devAccountInfo();
    if (signal.aborted) return;
    if (revision !== browserSessionRevision()) return verifyIdentity(true);
    const verified = confirmIdentity(account, remote, revision);
    if (!remote) {
      updateStatus({ state: "guest", pending: 0, conflicts: 0, message: account.user ? `Cuenta de prueba · ${account.profile?.displayName}` : "Progreso del entorno de desarrollo" });
    } else {
      try {
        if (verified.owner) localStorage.setItem(identityStorageKey(), verified.owner);
        else localStorage.removeItem(identityStorageKey());
      } catch { /* IndexedDB still retains the scoped work. */ }
    }
    return verified;
  } catch (error) {
    if (!signal.aborted) {
      if (revision !== browserSessionRevision()) return verifyIdentity(true);
      sessionUnavailable(error instanceof Error && error.message.startsWith("Tu sesión venció") ? error.message : undefined);
    }
  }
}

function verifyIdentity(revalidate = false): Promise<VerifiedIdentity | undefined> {
  const revision = browserSessionRevision();
  if (identityRequest && identityRequest.revision === revision) return identityRequest.promise;
  if (identityRequest || identity.status === "verified" && verifiedRevision !== revision) invalidateIdentity("checking");
  if (!revalidate && identity.status === "verified" && getVerifiedAccount() &&
      (Date.now() < verifiedUntil || !navigator.onLine)) return Promise.resolve(identity);
  if (identity.status !== "checking") publishIdentity({ status: "checking", epoch: identity.epoch });
  const controller = new AbortController();
  const promise = readIdentity(controller.signal, revision).finally(() => {
    if (identityRequest?.controller === controller) identityRequest = undefined;
  });
  identityRequest = { controller, revision, promise };
  return promise;
}

/** The landing page only needs the verified account, without starting a sync pull. */
export function loadAccountPresentation() {
  return verifyIdentity(true);
}

export async function initializeSyncIdentity(revalidate = false): Promise<{ owner: string | null }> {
  const previousBootstrap = bootstrap;
  const verified = await verifyIdentity(revalidate);
  if (!verified || identity !== verified) return { owner: null };
  if (authenticated && previousBootstrap?.epoch === verified.epoch && bootstrap === previousBootstrap) await synchronize();
  else await ensureSyncBootstrap(verified);
  const current = getSyncIdentity();
  return { owner: current.status === "verified" && current.epoch === verified.epoch &&
    current.owner === verified.owner && current.owner === getSyncOwner() && matchesBrowserSession() ? current.owner : null };
}

/** Each verified epoch joins its own initial pull before preparing the workspace. */
export function ensureSyncBootstrap(verified: VerifiedIdentity) {
  if (identity !== verified || !authenticated || !matchesBrowserSession()) return;
  if (bootstrap?.epoch === verified.epoch) return bootstrap.promise;
  const promise = synchronize();
  bootstrap = { epoch: verified.epoch, promise };
  return promise;
}

function scheduleIdentityExpiry() {
  clearTimeout(identityExpiry);
  if (identityWatchers && identity.status === "verified" && identity.owner) {
    identityExpiry = setTimeout(resumeIdentity, Math.max(0, verifiedUntil - Date.now()));
  }
}
function resumeIdentity() {
  if (recheckBrowserSession() || document.visibilityState !== "visible" || !navigator.onLine || identityRequest) return;
  refreshIdentity();
}
function refreshIdentity() {
  const previousEpoch = identity.epoch;
  void verifyIdentity(true).then(verified => {
    if (!verified || identity !== verified || !syncIdentityWatchers || !authenticated || !matchesBrowserSession()) return;
    if (verified.epoch === previousEpoch && bootstrap?.epoch === verified.epoch) return synchronize();
    return ensureSyncBootstrap(verified);
  });
}
export function recheckBrowserSession(): boolean {
  const revision = browserSessionRevision();
  const changed = identityRequest ? identityRequest.revision !== revision : identity.status === "verified" && verifiedRevision !== revision;
  if (!changed) return false;
  invalidateIdentity("checking");
  if (navigator.onLine) refreshIdentity();
  return true;
}
function browserCookieChanged(event: CookieChangeEvent) {
  if ([...event.changed, ...event.deleted].some(cookie => cookie.name === SESSION_REVISION_COOKIE)) recheckBrowserSession();
}
function pageHidden(event: PageTransitionEvent) {
  if (event.persisted) invalidateIdentity("checking");
}
function pageRestored(event: PageTransitionEvent) {
  if (event.persisted) resumeIdentity();
}
function signedOut() {
  invalidateIdentity("checking");
  confirmIdentity({ configured: true, user: null }, false, browserSessionRevision());
}
function accountChanged() {
  const previous = getSyncOwner();
  if (devSandboxActive() && (identity.status !== "verified" || identity.owner !== getSyncOwner())) {
    invalidateIdentity("checking");
  } else {
    // A GET started before the successful profile write may still contain the old name.
    cancelIdentityRequest();
  }
  void verifyIdentity(true).then(verified => {
    if (verified && verified.owner !== previous && syncIdentityWatchers) void ensureSyncBootstrap(verified);
  });
}
function accountStorage(event: StorageEvent) {
  if (event.key !== identityStorageKey() && !(devSandboxActive() && event.key === "paessed-dev:active-account")) return;
  if (event.newValue && identity.status === "verified" && event.newValue === identity.owner) return;
  invalidateIdentity("checking");
  refreshIdentity();
}
export function sessionUnavailable(message = "No se pudo comprobar tu sesión. Tu progreso sigue guardado en este dispositivo.") {
  invalidateIdentity("unavailable");
  updateStatus({ state: "paused", message });
}
export function isAccountMismatch(status: number, error: unknown) {
  return status === 409 && typeof error === "string" && error.startsWith("La cuenta cambió en otra pestaña.");
}
export function watchSyncIdentity(synchronizeOnRefresh = true) {
  if (synchronizeOnRefresh) ++syncIdentityWatchers;
  if (++identityWatchers === 1) {
    window.addEventListener("online", resumeIdentity);
    window.addEventListener("focus", resumeIdentity);
    window.addEventListener("pagehide", pageHidden);
    window.addEventListener("pageshow", pageRestored);
    document.addEventListener("visibilitychange", resumeIdentity);
    window.addEventListener("paessed-auth-signed-out", signedOut);
    window.addEventListener("paessed-account-change", accountChanged);
    window.addEventListener("storage", accountStorage);
    window.cookieStore?.addEventListener("change", browserCookieChanged);
    scheduleIdentityExpiry();
  }
  return () => {
    if (synchronizeOnRefresh) --syncIdentityWatchers;
    if (--identityWatchers !== 0) return;
    clearTimeout(identityExpiry);
    window.removeEventListener("online", resumeIdentity);
    window.removeEventListener("focus", resumeIdentity);
    window.removeEventListener("pagehide", pageHidden);
    window.removeEventListener("pageshow", pageRestored);
    document.removeEventListener("visibilitychange", resumeIdentity);
    window.removeEventListener("paessed-auth-signed-out", signedOut);
    window.removeEventListener("paessed-account-change", accountChanged);
    window.removeEventListener("storage", accountStorage);
    window.cookieStore?.removeEventListener("change", browserCookieChanged);
  };
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
  const epoch = identity.epoch;
  if (identity.status !== "verified" || !currentOwner(owner, epoch)) throw new Error("La cuenta cambió. Vuelve a abrir tu cuenta.");
  let response: Response;
  try {
    response = await fetch("/api/onboarding", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15_000),
      method: submission ? "POST" : "GET", headers: { "X-PAESSED-Account": owner, ...(submission ? { "Content-Type": "application/json" } : {}) },
      ...(submission ? { body: JSON.stringify(submission) } : {}) });
  } catch {
    throw new Error("No pudimos conectar con tu cuenta. Comprueba tu conexión y vuelve a intentarlo.");
  }
  const data = await response.json().catch(() => null);
  if (!currentOwner(owner, epoch)) throw new Error("La cuenta cambió. Tus respuestas siguen guardadas.");
  if (response.status === 401 || isAccountMismatch(response.status, data?.error)) sessionUnavailable(data?.error);
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
  const epoch = identity.epoch;
  const controller = new AbortController(); activeRequest = controller;
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const headers = new Headers(init?.headers); headers.set("X-PAESSED-Account", owner);
  let response: Response;
  try { response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init, headers, signal: controller.signal }); }
  finally { clearTimeout(timeout); if (activeRequest === controller) activeRequest = undefined; }
  if (!currentOwner(owner, epoch)) throw new Error("La cuenta cambió. El trabajo pendiente permanece en su cuenta original.");
  if (!response.ok) {
    retryAt = Date.now() + Math.max(retryAfter(response), Math.min(60000, 1000 * 2 ** Math.min(++failures, 6)));
    if (response.status === 401) sessionUnavailable("Tu sesión venció. El trabajo pendiente sigue guardado en esta cuenta.");
    else if (response.status === 409) {
      const data = await response.json().catch(() => null);
      if (currentOwner(owner, epoch) && isAccountMismatch(response.status, data?.error)) sessionUnavailable(data.error);
    }
    else if (response.status === 429) updateStatus({ state: "paused", message: "Límite temporal alcanzado. El progreso local está guardado y se reintentará automáticamente." });
    else if (response.status === 413) updateStatus({ state: "error", message: "El lote pendiente es demasiado grande. Se conserva completo en este dispositivo." });
    throw new Error(response.status === 503 ? "La sincronización remota está temporalmente en pausa." : "No se pudo sincronizar. El progreso local sigue guardado.");
  }
  const data = await response.json();
  if (!currentOwner(owner, epoch)) throw new Error("La cuenta cambió. El trabajo pendiente permanece en su cuenta original.");
  return data;
}
async function syncNow(owner: string, epoch: number) {
  const current = () => currentOwner(owner, epoch);
  if (!current() || !authenticated || Date.now() < retryAt || typeof navigator !== "undefined" && !navigator.onLine) return;
  updateStatus({ state: "syncing", message: "Sincronizando…" });
  try {
    let more = true;
    while (more && current()) {
      const meta = await readSyncMeta(owner);
      if (!current()) return;
      const response = await fetchSync(`/api/sync?cursor=${meta.cursor}`, undefined, owner);
      await persistSyncResponse(owner, response);
      if (!current()) return;
      more = response.hasMore;
      capacityWarning = !!response.capacity?.warning;
      if (response.capacity?.writesPaused) {
        const pending = (await listPendingOperations(owner)).length;
        if (current()) updateStatus({state:"paused",pending,message:"La cuenta alcanzó el umbral de capacidad remota. Tu progreso y sus cambios pendientes siguen guardados en este dispositivo."});
        return;
      }
    }
    let pending = await listPendingOperations(owner);
    while (pending.length && current()) {
      const meta = await readSyncMeta(owner);
      if (!current()) return;
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
    if (!current()) return;
    const conflicts = (await listSyncConflicts()).length;
    if (!current()) return;
    failures = 0; retryAt = 0;
    updateStatus({ state: "idle", pending: pending.length, conflicts, message: capacityWarning ? "Progreso sincronizado. La capacidad remota superó el 70 %; se suspenderán nuevos envíos al 85 %." : "Progreso sincronizado" });
  } catch (error) {
    if (!current()) return;
    if (status.state === "syncing") updateStatus({ state: "error", message: error instanceof Error ? error.message : "El progreso pendiente permanece guardado." });
    const pending = (await listPendingOperations(owner)).length;
    if (current()) updateStatus({ pending });
  }
}
export async function synchronize(force = false): Promise<void> {
  if (force) retryAt = 0;
  const owner = getSyncOwner(); if (!owner) return;
  const epoch = identity.epoch;
  if (running) {
    const same = runningOwner === owner && runningEpoch === epoch;
    await running;
    if (!same && currentOwner(owner, epoch)) return synchronize();
    return;
  }
  runningOwner = owner;
  runningEpoch = epoch;
  running = (async () => {
    if (navigator.locks) await navigator.locks.request(`paessed-sync:${owner}`, { ifAvailable: true }, async lock => { if (lock) await syncNow(owner, epoch); });
    else await syncNow(owner, epoch);
  })().finally(() => { running = undefined; });
  return running;
}
export function startSync(): () => void {
  const stopWatching = watchSyncIdentity();
  let debounce: ReturnType<typeof setTimeout> | undefined, maximum: ReturnType<typeof setTimeout> | undefined;
  const send = () => { clearTimeout(debounce); clearTimeout(maximum); maximum = undefined; void synchronize(); };
  const changed = () => {
    const owner = getSyncOwner();
    void listPendingOperations(owner).then(p => { if (owner === getSyncOwner()) updateStatus({ pending: p.length }); });
    clearTimeout(debounce); debounce = setTimeout(send, 2000);
    maximum ??= setTimeout(send, 10000);
  };
  const channel = getSyncOwner() ? new BroadcastChannel(databaseName()) : null;
  if (channel) channel.onmessage = changed;
  window.addEventListener(LOCAL_CHANGED, changed);
  const interval = setInterval(() => { if (document.visibilityState === "visible") void synchronize(); }, 60000);
  return () => { stopWatching(); clearTimeout(debounce); clearTimeout(maximum); clearInterval(interval); channel?.close(); window.removeEventListener(LOCAL_CHANGED, changed); };
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
type ImportIdentity = { owner: string; epoch: number; signal: AbortSignal };
const changedImportIdentity = () => new Error("La cuenta cambió. Vuelve a confirmar la incorporación.");
function verifiedImportIdentity() {
  if (identity.status !== "verified" || !identity.owner || identity.owner !== getSyncOwner()) throw changedImportIdentity();
  if (!importController) {
    importController = new AbortController();
    window.addEventListener(LOCAL_OWNER_CHANGED, cancelGuestImports, { once: true, signal: importController.signal });
  }
  return { owner: identity.owner, epoch: identity.epoch, signal: importController.signal };
}
function isCurrentImport({ owner, epoch, signal }: ImportIdentity) {
  return !signal.aborted && identity.status === "verified" && identity.owner === owner && currentOwner(owner, epoch);
}
async function recordGuestImport(
  verified: ImportIdentity,
  decision: true | "declined",
  queue?: (tx: IDBTransaction) => void,
): Promise<boolean> {
  if (!isCurrentImport(verified)) throw changedImportIdentity();
  const db = await openLocalDatabase(verified.owner);
  if (!isCurrentImport(verified)) throw changedImportIdentity();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(queue ? ["outbox", "meta"] : ["meta"], "readwrite");
    let failure: unknown;
    let recorded = false;
    const cancelIfInvalid = () => {
      if (isCurrentImport(verified)) return false;
      failure = changedImportIdentity();
      try {
        tx.abort();
      } catch (error) {
        // IndexedDB can already be committing when the next browser event is delivered.
        if (!(error instanceof DOMException && error.name === "InvalidStateError")) throw error;
      }
      return true;
    };
    verified.signal.addEventListener("abort", cancelIfInvalid, { once: true });
    const cleanup = () => verified.signal.removeEventListener("abort", cancelIfInvalid);
    tx.oncomplete = () => { cleanup(); resolve(recorded); };
    tx.onabort = () => { cleanup(); reject(failure ?? tx.error ?? new Error("No se pudo guardar la incorporación.")); };
    const meta = tx.objectStore("meta");
    const choice = meta.get("guest-import-confirmed");
    choice.onsuccess = () => {
      if (cancelIfInvalid() || choice.result) return;
      try {
        queue?.(tx);
        meta.put(decision, "guest-import-confirmed");
        recorded = true;
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
  });
}

export async function declineGuestImport(): Promise<void> {
  await recordGuestImport(verifiedImportIdentity(), "declined");
}

/** Only called after the account's explicit summary/confirmation. Guest originals remain untouched. */
export async function importGuestProgress(): Promise<void> {
  const verified = verifiedImportIdentity();
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
  const [practice, saved] = await Promise.all([listPracticeSessions(null), readGuestSavedQuestions()]);
  const recorded = await recordGuestImport(verified, true, tx => {
    if (state && (state.attempts.length || state.exposures.length || state.nodes.some(node => node.state !== "future") || state.goal !== 2 || state.pendingGoal)) {
      enqueueLearningRestore(tx, state);
    }
    snapshot.sessions.forEach((session, i) => enqueueOperation(tx, { type: "session", mode: "exam", sourceId: `default:${snapshot.keys[i]}`, session: session as never }, true));
    practice.forEach(record => enqueueOperation(tx, { type: "session", ...record }, true));
    saved.forEach(questionId => enqueueOperation(tx, { type: "saved-question", questionId, deleted: false }, true));
  });
  if (recorded && isCurrentImport(verified)) {
    notifyLocalChange();
    await synchronize();
  }
}
