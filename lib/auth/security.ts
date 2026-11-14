import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type AuthPurpose = "signin" | "signup" | "recover" | "link" | "reauth";
export const AUTH_FLOW_COOKIE = "paessed-auth-flow";
export const REAUTH_COOKIE = "paessed-reauth";
const purposes: AuthPurpose[] = ["signin", "signup", "recover", "link", "reauth"];
export function flowNonce(): string { return randomBytes(32).toString("base64url"); }
export function nonceHash(nonce: string): string { return createHash("sha256").update(nonce).digest("hex"); }
export function signValue(value: Record<string, unknown>, secret: string): string {
  if (secret.length < 32) throw new Error("AUTH_FLOW_SECRET debe tener al menos 32 caracteres.");
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
export function verifyValue(value: string | undefined, secret: string, now = Date.now()): Record<string, unknown> | null {
  if (!value || value.length > 2048 || secret.length < 32) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const result = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!result || typeof result !== "object" || Array.isArray(result) || typeof result.exp !== "number" || result.exp <= now || result.exp > now + 3_600_000) return null;
    return result;
  } catch { return null; }
}
export function validFlow(value: Record<string, unknown> | null, nonce: string | null): value is Record<string, unknown> & { purpose: AuthPurpose; nonce: string } {
  return !!value && typeof nonce === "string" && /^[A-Za-z0-9_-]{43}$/.test(nonce) && value.nonce === nonce && purposes.includes(value.purpose as AuthPurpose);
}
/** Return destinations are fixed by the server; never accept next/redirect URL inputs. */
export function authDestination(purpose: AuthPurpose): string {
  return purpose === "recover" ? "/auth/password" : purpose === "link" || purpose === "reauth" ? "/app/perfil" : "/bienvenida";
}
export function configuredOrigin(value: string | undefined): string {
  if (!value) throw new Error("Falta APP_ORIGIN.");
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error("APP_ORIGIN debe ser un origen HTTPS explícito (HTTP solo en localhost).");
  return url.origin;
}
