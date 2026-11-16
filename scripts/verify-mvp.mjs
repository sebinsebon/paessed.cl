import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());
let failed = false;
function check(ok, message) { console.log(`${ok ? "OK" : "PENDIENTE"} ${message}`); if (!ok) failed = true; }
const required = ["APP_ORIGIN", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "DATABASE_URL", "AUTH_FLOW_SECRET", "IP_HMAC_SECRET"];
for (const key of required) check(!!process.env[key], key);
for (const key of ["AUTH_FLOW_SECRET", "IP_HMAC_SECRET"]) if (process.env[key]) check(process.env[key].length >= 32, `${key}: mínimo 32 caracteres`);
check(!process.env.AUTH_FLOW_SECRET || process.env.AUTH_FLOW_SECRET !== process.env.IP_HMAC_SECRET, "Secretos de autenticación y solicitudes distintos");
check(process.env.PAESSED_DEV_MODE !== "true", "Login real: modo dev desactivado");
if (process.env.APP_ORIGIN) {
  try { const url = new URL(process.env.APP_ORIGIN); check(url.protocol === "https:" || ["localhost", "127.0.0.1"].includes(url.hostname), "Origen HTTPS o loopback local"); }
  catch { check(false, "APP_ORIGIN válido"); }
}
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  try {
    const response = await fetch(new URL("/auth/v1/settings", process.env.NEXT_PUBLIC_SUPABASE_URL), { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error();
    const settings = await response.json();
    check(settings.external?.google === true, "Proveedor Google habilitado en Supabase");
  } catch { check(false, "Consultar configuración pública de Auth (revisar URL, clave y conectividad)"); }
}
if (process.env.DATABASE_URL) {
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 10, onnotice: () => {} });
  try {
    const rows = await sql`select to_regclass('paessed.profiles') is not null as profiles, to_regclass('paessed.auth_flows') is not null as flows`;
    check(rows[0].profiles && rows[0].flows, "Migración de cuentas aplicada");
    const sessionCheck = await sql`select paessed.session_is_valid('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, false) as valid`;
    check(sessionCheck[0]?.valid === false, "Conexión del servidor puede validar sesiones revocadas");
  } catch { check(false, "Conexión de datos, migración y permisos del servidor"); }
  finally { await sql.end({ timeout: 2 }); }
}
console.log("La prueba final requiere entrar con Google en un navegador, volver a Paessed y comprobar la persistencia tras recargar. Este script no simula ese acceso.");
process.exitCode = failed ? 1 : 0;
