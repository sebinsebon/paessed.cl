import { validFlow, verifyValue, type AuthPurpose } from "./security.ts";

export type AuthCallback = { purpose: AuthPurpose; nonce: string; userId: string | null; code: string | null; flowId: string | null; cancelled: boolean; setupPassword?: true };
/** Parse only fixed callback inputs. Nonce consumption is a separate atomic database update. */
export function parseAuthCallback(url: URL, cookie: string | undefined, secret: string, now = Date.now()): AuthCallback {
  const allowed = ["flow", "code", "sb_flow_id", "error", "error_code", "error_description"];
  for (const key of url.searchParams.keys()) if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) throw new Error("Invalid callback parameters");
  const flow = verifyValue(cookie, secret, now), nonce = url.searchParams.get("flow");
  if (!validFlow(flow, nonce) || (flow.userId !== null && flow.userId !== undefined && typeof flow.userId !== "string")) throw new Error("Invalid callback state");
  if (flow.setupPassword !== undefined && (flow.setupPassword !== true || flow.purpose !== "reauth" || !flow.userId)) throw new Error("Invalid password setup state");
  const code = url.searchParams.get("code"), flowId = url.searchParams.get("sb_flow_id");
  if (flowId !== null && !/^[a-f0-9]{32}$/.test(flowId)) throw new Error("Invalid PKCE flow ID");
  if (code !== null && (!code || code.length > 4096)) throw new Error("Invalid authorization code");
  return {
    purpose: flow.purpose,
    nonce: nonce!,
    userId: typeof flow.userId === "string" ? flow.userId : null,
    code,
    flowId,
    cancelled: url.searchParams.has("error") || !code,
    ...(flow.setupPassword === true ? { setupPassword: true } : {}),
  };
}
export function validateCallbackIdentity(flow: AuthCallback, result: { userId: string; verified: boolean; hasGoogle: boolean; redirectType: string | null }) {
  if (!result.verified || (flow.userId && flow.userId !== result.userId) ||
      ((flow.purpose === "link" || flow.purpose === "reauth") && (!flow.userId || !result.hasGoogle)) ||
      (flow.purpose === "recover" && result.redirectType !== "recovery")) throw new Error("Identity does not match the verified flow");
}

/** The pinned SDK includes redirectType at runtime, but omits it in its public result type. */
export function redirectTypeOf(result: unknown): string | null {
  return result && typeof result === "object" && "redirectType" in result && typeof result.redirectType === "string" ? result.redirectType : null;
}

export async function completeAuthCallback<T>(flow: AuthCallback, dependencies: {
  consume: () => Promise<{ userId: string | null; purpose: string } | null>;
  exchange: () => Promise<{ value: T; identity: Parameters<typeof validateCallbackIdentity>[1] }>;
  rejectSession: () => Promise<void>;
}): Promise<T> {
  const consumed = await dependencies.consume();
  if (!consumed || consumed.userId !== flow.userId || consumed.purpose !== flow.purpose) throw new Error("Reused or mismatched flow");
  if (flow.cancelled || !flow.code) throw new Error("Cancelled flow");
  const result = await dependencies.exchange();
  try { validateCallbackIdentity(flow, result.identity); }
  catch { await dependencies.rejectSession(); throw new Error("Different identity or unverified recovery"); }
  return result.value;
}
