import test from "node:test";
import assert from "node:assert/strict";
import { authDestination, configuredOrigin, flowNonce, nonceHash, signValue, validFlow, verifyValue } from "../lib/auth/security.ts";
import { completeAuthCallback, parseAuthCallback, redirectTypeOf, validateCallbackIdentity } from "../lib/auth/callback.ts";

const secret = "test-only-secret-32-characters-long-enough";
test("auth state rejects tampering, expiration and malformed tokens", () => {
  const now = Date.now(), payload = { nonce: flowNonce(), purpose: "link", userId: "account-a", exp: now + 10000 };
  const signed = signValue(payload, secret);
  assert.deepEqual(verifyValue(signed, secret, now), payload);
  assert.equal(verifyValue(signed, "a-different-signing-key-with-at-least-32-chars", now), null);
  assert.equal(verifyValue(signed + ".extra", secret, now), null);
  assert.equal(verifyValue(signed.slice(0, -1) + "!", secret, now), null);
  assert.equal(verifyValue(signed, secret, now + 10001), null);
  assert.equal(verifyValue(signValue({ ...payload, exp: now + 4_000_000 }, secret), secret, now), null);
  assert.equal(verifyValue("__proto__.x", secret, now), null);
});
test("OAuth flow is bound to purpose and browser nonce", () => {
  const nonce = flowNonce(), other = flowNonce();
  assert.equal(validFlow({ nonce, purpose: "link" }, nonce), true);
  assert.equal(validFlow({ nonce, purpose: "link" }, other), false);
  assert.equal(validFlow({ nonce, purpose: "redirect" }, nonce), false);
  assert.equal(validFlow(null, nonce), false);
  assert.match(nonceHash(nonce), /^[a-f0-9]{64}$/);
  assert.notEqual(nonceHash(nonce), nonceHash(other));
});
test("OAuth destinations never accept external destinations", () => {
  assert.equal(authDestination("signin"), "/bienvenida");
  assert.equal(authDestination("signup"), "/bienvenida");
  assert.equal(authDestination("recover"), "/auth/password");
  assert.equal(authDestination("link"), "/app/perfil");
  assert.equal(configuredOrigin("https://paessed.cl"), "https://paessed.cl");
  assert.equal(configuredOrigin("http://localhost:3000"), "http://localhost:3000");
  for (const value of [undefined, "http://paessed.cl", "https://paessed.cl/evil", "https://user:password@paessed.cl", "https://paessed.cl?next=https://evil.com", "javascript:alert(1)"]) assert.throws(() => configuredOrigin(value));
});
test("callback requests reject missing browser state, expired state, duplicate inputs and external returns", () => {
  const nonce = flowNonce(), now = Date.now();
  const cookie = signValue({ nonce, purpose: "link", userId: "user-a", exp: now + 10000 }, secret);
  const base = `https://paessed.cl/auth/callback?flow=${nonce}&code=one-time-code&sb_flow_id=${"a".repeat(32)}`;
  const parsed = parseAuthCallback(new URL(base), cookie, secret, now);
  assert.equal(parsed.code, "one-time-code");
  assert.equal(parsed.userId, "user-a");
  assert.equal(parsed.cancelled, false);
  for (const suffix of ["&next=https://evil.com", "&redirect_to=//evil.com", "&code=other", "&flow=other", "&sb_flow_id=other", "&owner_id=user-b"]) assert.throws(() => parseAuthCallback(new URL(base + suffix), cookie, secret, now));
  assert.throws(() => parseAuthCallback(new URL(base), undefined, secret, now));
  assert.throws(() => parseAuthCallback(new URL(base), cookie, secret, now + 10001));
  assert.throws(() => parseAuthCallback(new URL(base.replace("a".repeat(32), "invalid")), cookie, secret, now));
});
test("OAuth cancellation consumes only its verified flow; no code is exchanged", () => {
  const nonce = flowNonce(), cookie = signValue({ nonce, purpose: "signin", userId: null, exp: Date.now() + 10000 }, secret);
  const callback = parseAuthCallback(new URL(`https://paessed.cl/auth/callback?flow=${nonce}&error=access_denied&error_description=cancelled`), cookie, secret);
  assert.equal(callback.cancelled, true);
  assert.equal(callback.code, null);
});
test("link and reauthentication preserve the same user; recovery requires recovery verifier", () => {
  const base = { purpose: "link", userId: "user-a", nonce: flowNonce(), code: "code", flowId: null, cancelled: false };
  const result = { userId: "user-a", verified: true, hasGoogle: true, redirectType: null };
  assert.doesNotThrow(() => validateCallbackIdentity(base, result));
  assert.throws(() => validateCallbackIdentity(base, { ...result, userId: "user-b" }));
  assert.throws(() => validateCallbackIdentity(base, { ...result, verified: false }));
  assert.throws(() => validateCallbackIdentity(base, { ...result, hasGoogle: false }));
  assert.throws(() => validateCallbackIdentity({ ...base, purpose: "reauth" }, { ...result, userId: "user-b" }));
  assert.throws(() => validateCallbackIdentity({ ...base, purpose: "recover", userId: null }, result));
  assert.doesNotThrow(() => validateCallbackIdentity({ ...base, purpose: "recover", userId: null }, { ...result, redirectType: "recovery" }));
});

test("callback transaction consumes once before exchange and rejects replay without a second exchange", async () => {
  const flow = { purpose: "signin", userId: null, nonce: flowNonce(), code: "one-time-code", flowId: null, cancelled: false };
  let consumed = false, exchanges = 0;
  const dependencies = {
    consume: async () => { if (consumed) return null; consumed = true; return { purpose: "signin", userId: null }; },
    exchange: async () => { exchanges++; return { value: "session-a", identity: { userId: "user-a", verified: true, hasGoogle: true, redirectType: null } }; },
    rejectSession: async () => { throw new Error("Unexpected rejected session"); },
  };
  assert.equal(await completeAuthCallback(flow, dependencies), "session-a");
  await assert.rejects(completeAuthCallback(flow, dependencies), /Reused/);
  assert.equal(exchanges, 1);
});

test("cancelled and mismatched callback flows never exchange authorization codes", async () => {
  let exchanges = 0;
  const flow = { purpose: "link", userId: "user-a", nonce: flowNonce(), code: "one-time-code", flowId: null, cancelled: true };
  const dependencies = {
    consume: async () => ({ purpose: "link", userId: "user-a" }),
    exchange: async () => { exchanges++; throw new Error("Unexpected exchange"); },
    rejectSession: async () => {},
  };
  await assert.rejects(completeAuthCallback(flow, dependencies), /Cancelled/);
  await assert.rejects(completeAuthCallback({ ...flow, cancelled: false }, { ...dependencies, consume: async () => ({ purpose: "link", userId: "user-b" }) }), /mismatched/);
  assert.equal(exchanges, 0);
});

test("wrong account, unverified email and non-recovery codes discard the returned session", async () => {
  const flow = { purpose: "link", userId: "user-a", nonce: flowNonce(), code: "code", flowId: null, cancelled: false };
  let rejected = 0;
  for (const variant of [
    { flow, identity: { userId: "user-b", verified: true, hasGoogle: true, redirectType: null } },
    { flow, identity: { userId: "user-a", verified: false, hasGoogle: true, redirectType: null } },
    { flow: { ...flow, purpose: "recover", userId: null }, identity: { userId: "user-a", verified: true, hasGoogle: true, redirectType: null } },
  ]) {
    await assert.rejects(completeAuthCallback(variant.flow, {
      consume: async () => ({ purpose: variant.flow.purpose, userId: variant.flow.userId }),
      exchange: async () => ({ value: "forbidden-session", identity: variant.identity }),
      rejectSession: async () => { rejected++; },
    }), /Different identity/);
  }
  assert.equal(rejected, 3);
  assert.equal(redirectTypeOf({ redirectType: "recovery" }), "recovery");
  for (const value of [null, {}, { redirectType: {} }, { redirectType: 123 }]) assert.equal(redirectTypeOf(value), null);
});
