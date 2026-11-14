import type { AccountInfo } from "./client";
import { createAccountLearningState, devSandboxActive, getSyncOwner, notifyLocalChange, openLocalDatabase, setSyncOwner } from "../sync/local.ts";
import type { OnboardingSubmission, OnboardingStatus } from "../sync/contracts";

type DevAccount = { id: string; email: string; name: string; providers: string[] };
const ACCOUNTS = "paessed-dev:accounts-v1", ACTIVE = "paessed-dev:active-account";
function guard() { if (!devSandboxActive()) throw new Error("Activa el modo dev para usar cuentas de prueba."); }
function accounts(): DevAccount[] {
  guard();
  const value = JSON.parse(localStorage.getItem(ACCOUNTS) ?? "[]");
  if (!Array.isArray(value)) throw new Error("No se pudieron leer las cuentas de prueba.");
  return value.filter(a => typeof a?.id === "string" && /^[a-f\d-]{36}$/i.test(a.id) && typeof a.email === "string" && typeof a.name === "string" && Array.isArray(a.providers));
}
export function selectedDevAccount(): DevAccount | null {
  if (!devSandboxActive()) return null;
  const id = localStorage.getItem(ACTIVE);
  return accounts().find(account => account.id === id) ?? null;
}
export function listDevAccounts() { return accounts().map(({ id, email, name }) => ({ id, email, name })); }
export function switchDevAccount(id: string | null) {
  guard();
  const account = id ? accounts().find(item => item.id === id) : null;
  if (id && !account) throw new Error("No existe esa cuenta de prueba.");
  select(account ?? null);
}
export async function loadDevProgressFixture() {
  guard();
  let account = accounts().find(item => item.email === "progreso@paessed.test");
  if (!account) { await devAuthAction("register", { email: "progreso@paessed.test", name: "Estudiante de prueba" }); account = selectedDevAccount()!; }
  else select(account);
  const db = await openLocalDatabase(account.id);
  const { state } = await devLearningState(account.id);
  if (state.attempts.length) return;
  const [{ reduceLearning }, { default: catalog }] = await Promise.all([import("../learning/engine.ts"), import("../default-catalog.json")]);
  const units = new Set<string>();
  let next = state;
  const sessionId = crypto.randomUUID();
  for (const question of catalog.questions) {
    if (!question.eligible || units.has(question.unitId)) continue;
    units.add(question.unitId);
    next = reduceLearning(next, { type: "external-attempt", mode: "exam", questionId: question.id, answer: units.size % 3 ? question.correct : "A", sessionId }, catalog.questions as import("../learning/types").LearningQuestion[]);
  }
  await new Promise<void>((resolve, reject) => { const tx = db.transaction("state", "readwrite"); tx.objectStore("state").put(next, "current"); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  notifyLocalChange();
}
export function devAccountInfo(): AccountInfo {
  const account = selectedDevAccount();
  return { configured: true, user: account ? { id: account.id, email: account.email, providers: account.providers } : null,
    ...(account ? { profile: { displayName: account.name, timezone: "America/Santiago" } } : {}) };
}
function select(account: DevAccount | null) {
  if (account) localStorage.setItem(ACTIVE, account.id); else localStorage.removeItem(ACTIVE);
  setSyncOwner(account?.id ?? null);
  window.dispatchEvent(new Event("paessed-account-change"));
}
/** Simulation only. Passwords, CAPTCHA tokens and OAuth tokens are never retained. */
export async function devAuthAction(action: string, values: Record<string, unknown>) {
  guard();
  const all = accounts();
  if (["register", "login", "google"].includes(action)) {
    const email = action === "google" ? "google@paessed.test" : String(values.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Escribe un correo de prueba válido.");
    let account = all.find(item => item.email === email);
    if (action === "register" && account) throw new Error("Esa cuenta de prueba ya existe. Inicia sesión.");
    if (action === "login" && !account) throw new Error("No existe esa cuenta de prueba. Créala primero.");
    if (!account) {
      account = { id: crypto.randomUUID(), email, name: action === "google" ? "Cuenta Google de prueba" : String(values.name ?? "").trim(), providers: [action === "google" ? "google" : "email"] };
      if (account.name.length < 2) throw new Error("Escribe un nombre de al menos dos caracteres.");
      all.push(account); localStorage.setItem(ACCOUNTS, JSON.stringify(all));
    }
    select(account);
    return { ok: true, redirect: "/bienvenida" };
  }
  const account = selectedDevAccount();
  if (action === "logout" || action === "delete") {
    if (action === "delete" && account) localStorage.setItem(ACCOUNTS, JSON.stringify(all.filter(item => item.id !== account.id)));
    select(null); window.dispatchEvent(new Event("paessed-auth-signed-out"));
    return { ok: true, redirect: "/login" };
  }
  if (action === "profile" && account) {
    account.name = String(values.displayName ?? "").trim();
    if (account.name.length < 2) throw new Error("Escribe un nombre de al menos dos caracteres.");
    localStorage.setItem(ACCOUNTS, JSON.stringify(all.map(item => item.id === account.id ? account : item)));
    window.dispatchEvent(new Event("paessed-account-change"));
    return { ok: true, message: "Perfil de prueba guardado." };
  }
  if (action === "link-google" && account) {
    account.providers = [...new Set([...account.providers, "google"])];
    localStorage.setItem(ACCOUNTS, JSON.stringify(all.map(item => item.id === account.id ? account : item)));
    return { ok: true, message: "Google vinculado en la simulación." };
  }
  return { ok: true, message: action === "recover" ? "Recuperación simulada. No se envían correos en modo dev." : "Operación de prueba completada. No se guardan contraseñas." };
}

async function devLearningState(owner: string) {
  guard();
  if (selectedDevAccount()?.id !== owner || getSyncOwner() !== owner) throw new Error("La cuenta de prueba cambió.");
  const db = await openLocalDatabase(owner);
  return { db, state: await new Promise<import("../learning/types").LearningState>((resolve, reject) => {
    const tx = db.transaction("state", "readonly"), request = tx.objectStore("state").get("current");
    tx.oncomplete = () => resolve(request.result ?? createAccountLearningState(owner)); tx.onerror = () => reject(tx.error);
  }) };
}
export async function devOnboardingStatus(owner: string): Promise<OnboardingStatus> {
  const { state } = await devLearningState(owner);
  const { onboardingStatus } = await import("../learning/diagnostic-handoff.ts");
  return onboardingStatus(state);
}
export async function devSubmitDiagnostic(owner: string, submission: OnboardingSubmission): Promise<OnboardingStatus> {
  const { db } = await devLearningState(owner);
  const { incorporateGuestDiagnostic, onboardingStatus } = await import("../learning/diagnostic-handoff.ts");
  const state = await new Promise<import("../learning/types").LearningState>((resolve, reject) => {
    const tx = db.transaction("state", "readwrite"), store = tx.objectStore("state"), request = store.get("current");
    let result: import("../learning/types").LearningState, failure: unknown;
    request.onsuccess = () => { try { result = incorporateGuestDiagnostic(request.result ?? createAccountLearningState(owner), submission); store.put(result, "current"); } catch (error) { failure = error; tx.abort(); } };
    tx.oncomplete = () => resolve(result); tx.onerror = tx.onabort = () => reject(failure ?? tx.error);
  });
  notifyLocalChange();
  return onboardingStatus(state);
}
