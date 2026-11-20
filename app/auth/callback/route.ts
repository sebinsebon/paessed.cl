import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_FLOW_COOKIE, authDestination, canSetGooglePassword, nonceHash } from "@/lib/auth/security";
import { completeAuthCallback, parseAuthCallback, redirectTypeOf } from "@/lib/auth/callback";
import { authClient, authConfigured, authOrigin, flowSecret, markReauthenticated } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { enforceRequestLimit } from "@/lib/server/limits";
import { handleError, HttpError, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!authConfigured() || !process.env.APP_ORIGIN) return json({ error: "Las cuentas aún no están configuradas. Vuelve al inicio e ingresa como invitado." }, 400);
  const jar = await cookies();
  try {
    await enforceRequestLimit(request, "auth");
    const url = new URL(request.url);
    const flow = parseAuthCallback(url, jar.get(AUTH_FLOW_COOKIE)?.value, flowSecret());
    const client = await authClient();
    const data = await completeAuthCallback(flow, {
      consume: async () => {
        const rows = await db()`update paessed.auth_flows set consumed_at=now() where nonce_hash=${nonceHash(flow.nonce)} and purpose=${flow.purpose} and expires_at>now() and consumed_at is null returning user_id,purpose`;
        jar.delete(AUTH_FLOW_COOKIE);
        return rows.length === 1 ? { userId: rows[0].user_id ?? null, purpose: rows[0].purpose } : null;
      },
      exchange: async () => {
        const { data, error } = await client.auth.exchangeCodeForSession(flow.code!, flow.flowId ? { flowId: flow.flowId } : undefined);
        if (error || !data.user || !data.session) throw new Error("Invalid code");
        return { value: { user: data.user, session: data.session }, identity: { userId: data.user.id, verified: !!data.user.email_confirmed_at, hasGoogle: !!data.user.identities?.some(i => i.provider === "google"), redirectType: redirectTypeOf(data) } };
      },
      rejectSession: async () => { await client.auth.signOut({ scope: "local" }); },
    });
    const setupPassword = flow.setupPassword === true && canSetGooglePassword(data.user);
    if (flow.purpose === "recover" || flow.purpose === "reauth") {
      await markReauthenticated(data.user.id, data.session.access_token, setupPassword ? "google-password" : flow.purpose);
    }
    const result = NextResponse.redirect(new URL(authDestination(flow.purpose, setupPassword), authOrigin()));
    result.headers.set("Cache-Control", "private, no-store");
    result.headers.set("Referrer-Policy", "no-referrer");
    return result;
  } catch (error) {
    if (error instanceof HttpError) return handleError(error);
    jar.delete(AUTH_FLOW_COOKIE);
    let origin: string;
    try { origin = authOrigin(); } catch { return json({ error: "Configuración de retorno inválida." }, 400); }
    const result = NextResponse.redirect(new URL("/login?authError=1", origin));
    result.headers.set("Cache-Control", "private, no-store");
    result.headers.set("Referrer-Policy", "no-referrer");
    return result;
  }
}
