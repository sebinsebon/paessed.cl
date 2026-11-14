import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import * as http from "../lib/server/http.ts";
import { validateGuestDiagnostic } from "../lib/server/onboarding.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const source = await readFile(new URL("../app/api/onboarding/route.ts", import.meta.url), "utf8");
function handlers({ signedIn = true } = {}) {
  const calls = [], exports = {};
  const mocks = {
    "@/lib/server/http": http,
    "@/lib/server/auth": { requireAccount: async () => { calls.push("identity"); if (!signedIn) throw new http.HttpError(401, "Inicia sesión"); return { user: { id: owner } }; } },
    "@/lib/server/limits": { enforceProgressIpLimit: async () => { calls.push("ip"); }, enforceRequestLimit: async () => { calls.push("quota"); } },
    "@/lib/server/onboarding": { getOnboardingStatus: async id => { calls.push(id); return { complete: false, handledDiagnosticIds: [] }; } },
    "@/lib/server/sync-service": { createSyncService: () => ({ incorporateDiagnostic: async (id, body) => { calls.push("incorporate"); return validateGuestDiagnostic(body); } }) },
  };
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("require", "exports", js)(id => { assert.ok(mocks[id], `unexpected dependency ${id}`); return mocks[id]; }, exports);
  return { ...exports, calls };
}
const request = (method = "GET", body, headers = {}, suffix = "") => new Request(`http://localhost/api/onboarding${suffix}`, {
  method, headers: { "X-PAESSED-Account": owner, ...(method === "POST" ? { Origin: "http://localhost", "Content-Type": "application/json" } : {}), ...headers },
  ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body ?? {}) } : {}),
});

test("onboarding GET requires verified identity, binds account and uses private no-store responses", async () => {
  const denied = handlers({ signedIn: false });
  assert.equal((await denied.GET(request())).status, 401);
  assert.deepEqual(denied.calls, ["ip", "identity"]);
  const route = handlers();
  const mismatch = await route.GET(request("GET", undefined, { "X-PAESSED-Account": "22222222-2222-4222-8222-222222222222" }));
  assert.equal(mismatch.status, 409);
  const response = await route.GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await response.json(), { complete: false, handledDiagnosticIds: [] });
  assert.equal((await route.GET(request("GET", undefined, {}, "?owner=another"))).status, 400);
});

test("onboarding POST enforces sameOrigin before identity/database work and rejects wrong-account requests", async () => {
  const route = handlers();
  assert.equal((await route.POST(request("POST", {}, { Origin: "https://evil.example" }))).status, 403);
  assert.deepEqual(route.calls, []);
  assert.equal((await route.POST(request("POST", {}, { "Sec-Fetch-Site": "cross-site" }))).status, 403);
  assert.equal((await route.POST(request("POST", {}, { "X-PAESSED-Account": "someone-else" }))).status, 409);
  assert.equal(route.calls.includes("incorporate"), false);
  assert.equal((await handlers({ signedIn: false }).POST(request("POST"))).status, 401);
});

test("onboarding POST rejects arbitrary booleans, incomplete diagnostics and malformed/oversized JSON", async () => {
  const route = handlers();
  assert.equal((await route.POST(request("POST", { complete: true, includeEvidence: false }))).status, 400);
  assert.equal((await route.POST(request("POST", { diagnostic: { completedAt: new Date().toISOString() }, includeEvidence: true }))).status, 400);
  assert.equal((await route.POST(request("POST", "{"))).status, 400);
  assert.equal((await route.POST(request("POST", { data: "x".repeat(24 * 1024) }))).status, 413);
  assert.equal((await route.POST(request("POST", {}, { "Content-Type": "text/plain" }))).status, 400);
  assert.equal((await route.POST(request("POST", {}, { "Content-Encoding": "gzip" }))).status, 400);
});
