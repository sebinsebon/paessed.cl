import { z } from "zod";
import { cookies } from "next/headers";
import { authAdmin, authClient, authConfigured, beginAuthFlow, markReauthenticated, requireAccount, requireRecent } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { HttpError, handleError, json, readJson, sameOrigin } from "@/lib/server/http";
import { enforceRequestLimit } from "@/lib/server/limits";
import { AUTH_FLOW_COOKIE, REAUTH_COOKIE } from "@/lib/auth/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const email = z.string().trim().email().max(254);
const password = z.string().min(8).max(128);
const captcha = { captchaToken: z.string().max(4096).optional() };
const schemas = {
  login: z.object({ email, password, ...captcha }).strict(),
  register: z.object({ email, password, name: z.string().trim().min(2).max(80), ...captcha }).strict(),
  recover: z.object({ email, ...captcha }).strict(),
  google: z.object(captcha).strict(),
  "link-google": z.object({}).strict(),
  reauth: z.object({ password, ...captcha }).strict(),
  "reauth-google": z.object(captcha).strict(),
  password: z.object({ password }).strict(),
  profile: z.object({ displayName: z.string().trim().min(2).max(80), timezone: z.literal("America/Santiago") }).strict(),
  logout: z.object({}).strict(),
  delete: z.object({ confirmation: z.literal("ELIMINAR") }).strict(),
};
function failAuth(error: unknown) {
  if (!error) return;
  if (typeof error === "object" && "status" in error && error.status === 429) throw new HttpError(429, "Alcanzaste el límite de autenticación. Espera antes de volver a intentar.", 60);
  if (typeof error === "object" && "code" in error && ["identity_already_exists", "identity_already_linked"].includes(String(error.code))) throw new HttpError(409, "Google ya pertenece a una cuenta. Ambas cuentas y sus datos se conservan; no se pueden fusionar aquí.");
  throw new HttpError(400, "No se pudo completar la autenticación. Revisa tus datos y vuelve a intentar.");
}
function captchaRequired(token?: string) { if (process.env.TURNSTILE_SECRET_KEY && !token) throw new HttpError(400, "Completa la verificación antes de continuar."); }
async function verifyOAuthCaptcha(token?: string) {
  captchaRequired(token);
  if (!process.env.TURNSTILE_SECRET_KEY) return;
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token! }), signal: AbortSignal.timeout(10_000) });
  const result = await response.json();
  if (!response.ok || result.success !== true) throw new HttpError(400, "La verificación venció. Vuelve a completarla.");
}

/** Emit only a fixed stage and a short technical error code; never log IPs, cookies, tokens or SQL details. */
function logUnexpectedAuthFailure(method: "GET" | "POST", stage: string, error: unknown) {
  if (error instanceof HttpError) return;
  const rawCode = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
  const code = typeof rawCode === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(rawCode) ? rawCode : "unknown";
  if (code === "28P01") {
    // Report only structural yes/no checks; never emit a username, URL or password.
    let shape = "malformed_url";
    try {
      const value = process.env.DATABASE_URL;
      if (!value) shape = "missing_url";
      else {
        const uri = new URL(value);
        shape = [
          `user_v2=${uri.username === "paessed_app_v2.rqeuczrmkkehxzipkynq"}`,
          `host_ok=${uri.hostname === "aws-1-us-east-2.pooler.supabase.com"}`,
          `port_ok=${uri.port === "6543"}`,
          `database_ok=${uri.pathname === "/postgres"}`,
          `ssl_ok=${uri.searchParams.get("sslmode") === "require"}`,
          `hex_password_ok=${/^[a-f0-9]{64}$/i.test(uri.password)}`,
        ].join(" ");
      }
    } catch { /* Keep credentials and malformed URLs out of logs. */ }
    console.error("PAESSED_AUTH_DIAGNOSTIC", method, stage, code, shape);
    return;
  }
  console.error("PAESSED_AUTH_DIAGNOSTIC", method, stage, code);
}

export async function GET(request: Request, context: { params: Promise<{ action: string }> }) {
  let stage = "configuration";
  try {
    if ((await context.params).action !== "session") throw new HttpError(404, "Ruta no encontrada.");
    if (!authConfigured()) return json({ user: null, configured: false });
    stage = "rate_limit";
    await enforceRequestLimit(request, "auth");
    stage = "session";
    const jar = await cookies();
    if (!jar.getAll().some(c => c.name.startsWith("sb-") && c.name.includes("auth-token"))) return json({ user: null, configured: true });
    const { user } = await requireAccount(request);
    const profile = await db()`select display_name,timezone from paessed.profiles where owner_id=${user.id}::uuid`;
    return json({ configured: true, user: { id: user.id, email: user.email, providers: [...new Set(user.identities?.map(i => i.provider) ?? [])] }, profile: { displayName: profile[0]?.display_name ?? "", timezone: profile[0]?.timezone ?? "America/Santiago" } });
  } catch (error) {
    logUnexpectedAuthFailure("GET", stage, error);
    return handleError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  let stage = "origin";
  try {
    sameOrigin(request);
    stage = "rate_limit";
    await enforceRequestLimit(request, "auth");
    stage = "action";
    const action = (await context.params).action;
    if (!Object.hasOwn(schemas, action)) throw new HttpError(404, "Ruta no encontrada.");
    const value = await readJson(request, 8192);
    const parsed = schemas[action as keyof typeof schemas].safeParse(value);
    if (!parsed.success) throw new HttpError(400, "La solicitud contiene datos inválidos o campos desconocidos.");
    const client = await authClient();
    if (action === "login") {
      const input = schemas.login.parse(value); captchaRequired(input.captchaToken);
      const { data, error } = await client.auth.signInWithPassword({ email: input.email, password: input.password, options: { captchaToken: input.captchaToken } }); failAuth(error);
      if (!data.user?.email_confirmed_at) throw new HttpError(403, "Verifica tu correo antes de iniciar sesión.");
      return json({ ok: true, redirect: "/bienvenida" });
    }
    if (action === "register") {
      const input = schemas.register.parse(value); captchaRequired(input.captchaToken);
      const redirect = await beginAuthFlow("signup");
      const { data, error } = await client.auth.signUp({ email: input.email, password: input.password, options: { emailRedirectTo: redirect, captchaToken: input.captchaToken, data: { display_name: input.name } } }); failAuth(error);
      if (data.session) await client.auth.signOut({ scope: "local" });
      return json({ ok: true, message: "Revisa tu correo para verificar la cuenta. Abre el enlace en este navegador." });
    }
    if (action === "recover") {
      const input = schemas.recover.parse(value); captchaRequired(input.captchaToken);
      const redirectTo = await beginAuthFlow("recover");
      const { error } = await client.auth.resetPasswordForEmail(input.email, { redirectTo, captchaToken: input.captchaToken }); failAuth(error);
      return json({ ok: true, message: "Si existe una cuenta con ese correo, recibirás un enlace. Ábrelo en este navegador." });
    }
    if (action === "google") {
      const input = schemas.google.parse(value); await verifyOAuthCaptcha(input.captchaToken);
      const redirectTo = await beginAuthFlow("signin");
      const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo, scopes: "openid email profile", skipBrowserRedirect: true, queryParams: { prompt: "select_account" } } }); failAuth(error);
      return json({ url: data.url });
    }
    if (action === "logout") {
      // An already revoked or expired session must still be able to clear its own cookies.
      const { error } = await client.auth.signOut({ scope: "global" }); failAuth(error);
      const jar = await cookies(); jar.delete(REAUTH_COOKIE); jar.delete(AUTH_FLOW_COOKIE);
      return json({ ok: true });
    }
    const account = await requireAccount(request);
    if (action === "reauth") {
      const input = schemas.reauth.parse(value); captchaRequired(input.captchaToken);
      if (!account.user.email) throw new HttpError(400, "Usa Google para confirmar tu identidad.");
      const { data, error } = await client.auth.signInWithPassword({ email: account.user.email, password: input.password, options: { captchaToken: input.captchaToken } }); failAuth(error);
      if (!data.session || data.user?.id !== account.user.id) { await client.auth.signOut({ scope: "local" }); throw new HttpError(403, "No se pudo confirmar la misma cuenta."); }
      await markReauthenticated(account.user.id, data.session.access_token, "reauth");
      return json({ ok: true, message: "Identidad confirmada durante cinco minutos." });
    }
    if (action === "reauth-google") {
      if (!account.user.identities?.some(i => i.provider === "google")) throw new HttpError(400, "Esta cuenta aún no tiene Google vinculado.");
      const input = schemas["reauth-google"].parse(value); await verifyOAuthCaptcha(input.captchaToken);
      const redirectTo = await beginAuthFlow("reauth", account.user.id);
      const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo, scopes: "openid email profile", skipBrowserRedirect: true, queryParams: { prompt: "select_account", max_age: "0" } } }); failAuth(error);
      return json({ url: data.url });
    }
    if (action === "link-google") {
      await requireRecent(account);
      if (account.user.identities?.some(i => i.provider === "google")) throw new HttpError(400, "Google ya está vinculado a tu cuenta.");
      const redirectTo = await beginAuthFlow("link", account.user.id);
      const { data, error } = await client.auth.linkIdentity({ provider: "google", options: { redirectTo, scopes: "openid email profile", skipBrowserRedirect: true, queryParams: { prompt: "select_account" } } }); failAuth(error);
      return json({ url: data.url });
    }
    if (action === "password") {
      await requireRecent(account, true);
      const { error } = await client.auth.updateUser({ password: schemas.password.parse(value).password }); failAuth(error);
      (await cookies()).delete(REAUTH_COOKIE);
      return json({ ok: true, message: "Contraseña guardada." });
    }
    if (action === "profile") {
      const input = schemas.profile.parse(value);
      await db()`insert into paessed.profiles (owner_id,display_name,timezone) values (${account.user.id}::uuid,${input.displayName},${input.timezone}) on conflict (owner_id) do update set display_name=excluded.display_name,timezone=excluded.timezone,updated_at=now()`;
      return json({ ok: true, message: "Perfil guardado." });
    }
    if (action === "delete") {
      await requireRecent(account);
      const admin = authAdmin();
      // Revoke first: app APIs also check auth.sessions, so old JWTs cannot keep writing.
      const revoked = await admin.auth.admin.signOut(account.accessToken, "global"); failAuth(revoked.error);
      const removed = await admin.auth.admin.deleteUser(account.user.id); failAuth(removed.error);
      await client.auth.signOut({ scope: "local" });
      const jar = await cookies(); jar.delete(REAUTH_COOKIE); jar.delete(AUTH_FLOW_COOKIE);
      return json({ ok: true, message: "Cuenta eliminada. Tus archivos personales locales se conservan." });
    }
    throw new HttpError(404, "Ruta no encontrada.");
  } catch (error) {
    logUnexpectedAuthFailure("POST", stage, error);
    return handleError(error);
  }
}
