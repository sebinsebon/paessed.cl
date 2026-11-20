import nextEnv from "@next/env";
import postgres from "postgres";
import { databaseTlsOptions } from "../lib/server/db-tls.ts";
import { connectsToSupabaseProject, permitsBackend, PRODUCTION_ORIGIN, PRODUCTION_PROJECT } from "../lib/server/deployment-backend.ts";

nextEnv.loadEnvConfig(process.cwd());
let failed = false;
function check(ok, message) { console.log(`${ok ? "OK" : "PENDIENTE"} ${message}`); if (!ok) failed = true; }
const required = ["APP_ORIGIN", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "DATABASE_URL", "AUTH_FLOW_SECRET", "IP_HMAC_SECRET"];
const production = process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production";
if (production) {
  required.push("SUPABASE_SECRET_KEY");
  check(process.env.APP_ORIGIN === PRODUCTION_ORIGIN, "Dominio oficial de producción");
  check(process.env.NEXT_PUBLIC_SUPABASE_URL === `https://${PRODUCTION_PROJECT}.supabase.co`, "Auth usa el Supabase productivo");
  check(process.env.TRUSTED_PROXY === "vercel", "Proxy Vercel");
  check(connectsToSupabaseProject(process.env.DATABASE_URL, PRODUCTION_PROJECT), "PostgreSQL usa el Supabase productivo");
}
const safeBackend = permitsBackend();
check(safeBackend, "El preview usa el backend de pruebas");
const turnstileSite = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const turnstileServer = !!process.env.TURNSTILE_SECRET_KEY;
check(turnstileSite === turnstileServer, "Turnstile requiere ambas claves o se mantiene diferido");
if (!turnstileSite && !turnstileServer) console.log("DIFERIDO Turnstile. Las cuotas de PAESSED y Supabase Auth siguen aplicando.");
for (const key of required) check(!!process.env[key], key);
for (const key of ["AUTH_FLOW_SECRET", "IP_HMAC_SECRET"]) if (process.env[key]) check(process.env[key].length >= 32, `${key}: mínimo 32 caracteres`);
check(!process.env.AUTH_FLOW_SECRET || process.env.AUTH_FLOW_SECRET !== process.env.IP_HMAC_SECRET, "Secretos de autenticación y solicitudes distintos");
check(process.env.PAESSED_DEV_MODE !== "true", "Login real: modo dev desactivado");
if (process.env.APP_ORIGIN) {
  try { const url = new URL(process.env.APP_ORIGIN); check(url.protocol === "https:" || ["localhost", "127.0.0.1"].includes(url.hostname), "Origen HTTPS o loopback local"); }
  catch { check(false, "APP_ORIGIN válido"); }
}
if (safeBackend && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  try {
    const response = await fetch(new URL("/auth/v1/settings", process.env.NEXT_PUBLIC_SUPABASE_URL), { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error();
    const settings = await response.json();
    check(settings.external?.google === true, "Proveedor Google habilitado en Supabase");
    if (production) check(settings.external?.email === true && settings.mailer_autoconfirm === false && !settings.disable_signup, "Registro y confirmación de correo habilitados");
  } catch { check(false, "Consultar configuración pública de Auth (revisar URL, clave y conectividad)"); }
}
if (safeBackend && process.env.DATABASE_URL) {
  let sql;
  try {
    sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, ssl: databaseTlsOptions(), connect_timeout: 10, onnotice: () => {} });
    const rows = await sql`select to_regclass('paessed.profiles') is not null as profiles, to_regclass('paessed.auth_flows') is not null as flows`;
    check(rows[0].profiles && rows[0].flows, "Migración de cuentas aplicada");
    const sessionCheck = await sql`select paessed.session_is_valid('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, false) as valid`;
    check(sessionCheck[0]?.valid === false, "Conexión del servidor puede validar sesiones revocadas");
    const [role] = await sql`select pg_has_role(current_user, 'paessed_server', 'USAGE') as app_role,
      has_table_privilege(current_user, c.oid, 'SELECT') as read_sessions,
      (select rolsuper or rolbypassrls from pg_roles where rolname = current_user) as bypass_rls
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='auth' and c.relname='sessions'`;
    check(role.app_role && !role.read_sessions && !role.bypass_rls, "Rol de aplicación restringido y sin lectura de auth.sessions");
  } catch { check(false, "Conexión de datos, migración y permisos del servidor"); }
  finally { await sql?.end({ timeout: 2 }); }
}
console.log("La prueba final requiere entrar con Google en un navegador, volver a Paessed y comprobar la persistencia tras recargar. Este script no simula ese acceso.");
process.exitCode = failed ? 1 : 0;
