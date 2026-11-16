import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type User } from "@supabase/supabase-js";
import { db } from "./db";
import { HttpError } from "./http";
import { AUTH_FLOW_COOKIE, REAUTH_COOKIE, configuredOrigin, flowNonce, nonceHash, signValue, verifyValue, type AuthPurpose } from "../auth/security";

export function authConfigured(): boolean { return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY); }
export function authOrigin(): string { return configuredOrigin(process.env.APP_ORIGIN); }
export function flowSecret(): string {
  const secret = process.env.AUTH_FLOW_SECRET;
  if (!secret || secret.length < 32) throw new HttpError(503, "La sincronización de cuentas aún no está configurada.");
  return secret;
}
export async function authClient(readOnly = false) {
  if (!authConfigured()) throw new HttpError(503, "Las cuentas aún no están configuradas. Puedes continuar como invitado.");
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { flowType: "pkce", autoRefreshToken: false, detectSessionInUrl: false },
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: authOrigin().startsWith("https://"), path: "/" },
    cookies: { getAll: () => jar.getAll(), setAll: (values) => { if (!readOnly) values.forEach(({ name, value, options }) => jar.set(name, value, options)); } },
  });
}
export function authAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new HttpError(503, "La administración de cuentas aún no está configurada.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function sessionId(token: string): string {
  try { const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); if (typeof payload.session_id === "string" && /^[0-9a-f-]{36}$/i.test(payload.session_id)) return payload.session_id; } catch { /* Only inspect after Auth verifies the token. */ }
  throw new HttpError(401, "La sesión no es válida. Vuelve a iniciar sesión.");
}
/** getUser verifies identity; the private database function also rejects revoked sessions. */
export async function requireAccount(_request: Request, readOnly = false): Promise<{ user: User; accessToken: string }> {
  const client = await authClient(readOnly);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || !user.email_confirmed_at) throw new HttpError(401, "Inicia sesión con un correo verificado para sincronizar.");
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new HttpError(401, "Tu sesión venció. Tu trabajo sigue guardado en este dispositivo.");
  const id = sessionId(session.access_token);
  const rows = await db()`select paessed.session_is_valid(${id}::uuid, ${user.id}::uuid, false) as valid`;
  if (!rows[0]?.valid) throw new HttpError(401, "La sesión fue revocada. Vuelve a iniciar sesión.");
  return { user, accessToken: session.access_token };
}
export async function requireRecent(account: {user: {id: string}; accessToken: string }, recoveryOnly = false): Promise<void> {
  const id = sessionId(account.accessToken), jar = await cookies();
  const receipt = verifyValue(jar.get(REAUTH_COOKIE)?.value, flowSecret());
  if (receipt?.userId === account.user.id && receipt.sessionId === id && (!recoveryOnly || receipt.purpose === "recover")) return;
  if (!recoveryOnly) {
    const rows = await db()`select paessed.session_is_valid(${id}::uuid, ${account.user.id}::uuid, true) as valid`;
    if (rows[0]?.valid) return;
  }
  throw new HttpError(403, recoveryOnly ? "Abre el enlace de recuperación para añadir o cambiar tu contraseña." : "Confirma tu identidad antes de continuar.");
}
export async function markReauthenticated(userId: string, accessToken: string, purpose: "recover" | "reauth") {
  (await cookies()).set(REAUTH_COOKIE, signValue({ userId, sessionId: sessionId(accessToken), purpose, exp: Date.now() + 300_000 }, flowSecret()), { httpOnly: true, secure: authOrigin().startsWith("https://"), sameSite: "lax", maxAge: 300, path: "/" });
}
export async function beginAuthFlow(purpose: AuthPurpose, userId?: string): Promise<string> {
  const nonce = flowNonce();
  await db().begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext('paessed:auth-flows-cap'))`;
    await tx`delete from paessed.auth_flows where nonce_hash in (select nonce_hash from paessed.auth_flows where expires_at < now() or consumed_at is not null order by expires_at limit 1000)`;
    const count = await tx`select count(*)::integer as total from paessed.auth_flows`;
    if (count[0].total >= 10000) throw new HttpError(429, "Hay demasiados accesos en curso. Intenta nuevamente más tarde.", 60);
    await tx`insert into paessed.auth_flows (nonce_hash,user_id,purpose,expires_at) values (${nonceHash(nonce)},${userId ?? null}::uuid,${purpose},now()+interval '30 minutes')`;
  });
  (await cookies()).set(AUTH_FLOW_COOKIE, signValue({ nonce, purpose, userId: userId ?? null, exp: Date.now() + 1_800_000 }, flowSecret()), { httpOnly: true, secure: authOrigin().startsWith("https://"), sameSite: "lax", maxAge: 1800, path: "/" });
  return `${authOrigin()}/auth/callback?flow=${nonce}`;
}
