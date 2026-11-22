import { getSyncIdentity, invalidateSyncIdentity, isAccountMismatch, sessionUnavailable } from "../sync/client";

export async function authAction(action: string, data: Record<string, unknown> = {}, accountId?: string): Promise<{ ok?: boolean; message?: string; url?: string; redirect?: string }> {
  if (typeof window !== "undefined" && (window as Window & { __PAESSED_DEV_SANDBOX__?: boolean }).__PAESSED_DEV_SANDBOX__) return (await import("./dev-accounts.ts")).devAuthAction(action, data);
  const headers = new Headers({ "Content-Type": "application/json" });
  if (accountId) headers.set("X-Paessed-Account", accountId);
  const epoch = getSyncIdentity().epoch;
  const response = await fetch(`/api/auth/${action}`, { method: "POST", credentials: "same-origin", headers, body: JSON.stringify(data) });
  const result = await response.json();
  if (accountId && getSyncIdentity().epoch === epoch && (response.status === 401 || isAccountMismatch(response.status, result.error))) {
    sessionUnavailable(isAccountMismatch(response.status, result.error) ? result.error : undefined);
  }
  if (!response.ok) throw new Error(result.error ?? "No se pudo completar la solicitud.");
  if (action === "login" || action === "logout" || action === "delete") {
    try { localStorage.removeItem("paessed-sync-owner"); }
    catch { /* This tab still discards its old identity without storage. */ }
    if (action === "login") invalidateSyncIdentity();
    else window.dispatchEvent(new Event("paessed-auth-signed-out"));
  }
  if (action === "profile") window.dispatchEvent(new Event("paessed-account-change"));
  return result;
}
