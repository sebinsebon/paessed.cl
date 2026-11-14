import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { database, type Query } from "./db.ts";
import { HttpError } from "./http.ts";

export function configuredLimit(name: string, fallback: number): number {
  const raw = process.env[`LIMIT_${name}`];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1) throw new HttpError(503, "Configuración de cuotas inválida.");
  return Number(raw);
}
export function ipKey(request: Request): string {
  const secret = process.env.IP_HMAC_SECRET;
  if (!secret || secret.length < 32) throw new HttpError(503, "Falta configurar la protección de solicitudes.");
  // Only deployment-provided headers are trusted, never a client-selected header.
  let ip: string | null;
  if (process.env.TRUSTED_PROXY === "vercel" && process.env.VERCEL === "1") ip = request.headers.get("x-vercel-forwarded-for");
  else if (process.env.TRUSTED_PROXY === "cloudflare") ip = request.headers.get("cf-connecting-ip");
  else if (new URL(request.url).hostname === "localhost" || new URL(request.url).hostname === "127.0.0.1") ip = "127.0.0.1";
  else throw new HttpError(503, "Debe configurarse un proxy de confianza.");
  if (!ip || !isIP(ip.trim())) throw new HttpError(400, "Dirección de origen inválida.");
  return createHmac("sha256", secret).update(ip.trim()).digest("hex");
}
export async function consume(query: Query, key: string, limit: number, window: number, amount = 1): Promise<void> {
  const rows = await query("select paessed.consume_limit($1,$2,$3,$4) as allowed", [key, limit, window, amount]);
  if (!rows[0]?.allowed) throw new HttpError(429, "Se alcanzó una cuota temporal. Tu trabajo permanece guardado localmente.", window);
}
export async function enforceIpRequestLimit(request: Request, scope: "auth" | "progress", driver = database()): Promise<void> {
  const hash=ipKey(request);
  const denied=await driver.transaction(async query=>{
    await query("select pg_advisory_xact_lock(874122)");
    const existing=await query("select key from paessed.rate_limit_counters where key=$1 and expires_at>now()",[`ip:${hash}`]);
    if(!existing.length){
      const count=await query("select count(*)::int as n from paessed.rate_limit_counters where key like 'ip:%' and expires_at>now()");
      if(Number(count[0]?.n)>=configuredLimit("IP_KEYS",10000))throw new HttpError(429,"Capacidad temporal de solicitudes alcanzada.",60);
    }
    await query("insert into paessed.rate_limit_counters(key,count,expires_at) values($1,0,now()+interval '1 hour') on conflict(key) do update set expires_at=now()+interval '1 hour',touched_at=now()",[`ip:${hash}`]);
    const result=await query("select paessed.consume_limit($1,$2,60,1) as allowed",[`${scope}:${hash}`,configuredLimit(scope==="auth"?"AUTH_IP_MINUTE":"PROGRESS_IP_MINUTE",scope==="auth"?20:600)]);
    return !result[0]?.allowed;
  });
  if(denied)throw new HttpError(429,"Se alcanzó una cuota temporal. Tu trabajo permanece guardado localmente.",60);
}
export async function enforceProgressIpLimit(request: Request): Promise<void> { await enforceIpRequestLimit(request,"progress"); }
/** Sync routes call the IP guard before identity lookup, then this per-user guard. */
export async function enforceRequestLimit(request: Request, scope: "auth" | "read" | "write", userId?: string): Promise<void> {
  if(scope==="auth"){await enforceIpRequestLimit(request,"auth");return;}
  if(!userId)throw new HttpError(401,"Inicia sesión para sincronizar.");
  const rows=await database().transaction(query=>query("select paessed.consume_limit($1,$2,60,1) as allowed",[`${scope}:${userId}`,configuredLimit(scope==="read"?"READ_USER_MINUTE":"WRITE_USER_MINUTE",scope==="read"?120:60)]));
  if(!rows[0]?.allowed)throw new HttpError(429,"Se alcanzó una cuota temporal. Tu trabajo permanece guardado localmente.",60);
}

/** Only fixed technical codes are accepted; never pass personal request data. */
export async function technicalEvent(query: Query, code: "sync-accepted" | "sync-conflict"): Promise<void> {
  const allowed=await query("select paessed.consume_limit('technical-events-day',10000,86400,1) as allowed");
  if(allowed[0]?.allowed) await query("insert into paessed.technical_events(code) values($1)",[code]);
  else await query("select paessed.consume_limit($1,2147483647,86400,1)",[`technical-excess:${code}`]);
}
