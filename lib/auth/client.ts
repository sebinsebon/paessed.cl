export type AccountInfo = { configured: boolean; user: null | { id: string; email?: string; providers: string[] }; profile?: { displayName: string; timezone: string } };
export async function getAccount(): Promise<AccountInfo> {
  if (typeof window !== "undefined" && (window as Window & { __PAESSED_DEV_SANDBOX__?: boolean }).__PAESSED_DEV_SANDBOX__) return (await import("./dev-accounts.ts")).devAccountInfo();
  const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error(response.status === 401 ? "Tu sesión venció. Inicia sesión para reanudar los envíos." : "No se pudo comprobar la cuenta. Tu progreso sigue en este dispositivo.");
  return response.json();
}
export async function authAction(action: string, data: Record<string, unknown> = {}, accountId?: string): Promise<{ ok?: boolean; message?: string; url?: string; redirect?: string }> {
  if (typeof window !== "undefined" && (window as Window & { __PAESSED_DEV_SANDBOX__?: boolean }).__PAESSED_DEV_SANDBOX__) return (await import("./dev-accounts.ts")).devAuthAction(action, data);
  const headers = new Headers({ "Content-Type": "application/json" });
  if (accountId) headers.set("X-Paessed-Account", accountId);
  const response = await fetch(`/api/auth/${action}`, { method: "POST", credentials: "same-origin", headers, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "No se pudo completar la solicitud.");
  if (action === "logout" || action === "delete") {
    localStorage.removeItem("paessed-sync-owner");
    window.dispatchEvent(new Event("paessed-auth-signed-out"));
  }
  if (action === "logout" || action === "delete" || action === "profile") window.dispatchEvent(new Event("paessed-account-change"));
  return result;
}
