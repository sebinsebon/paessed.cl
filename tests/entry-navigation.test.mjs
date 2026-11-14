import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { HttpError } from "../lib/http-error.ts";

const source = await readFile(new URL("../lib/server/entry.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function entry({ signedIn = true, dev = false } = {}) {
  const result = {}, calls = [];
  const modules = {
    "server-only": {},
    "next/headers": { cookies: async () => ({ get: () => dev ? { value: "1" } : undefined, getAll: () => signedIn ? [{ name: "sb-test-auth-token", value: "fixture" }] : [] }) },
    "next/navigation": { redirect: href => { throw new Error(`redirect:${href}`); } },
    "./auth": { authConfigured: () => true, requireAccount: async () => { calls.push("verify"); if (!signedIn) throw new HttpError(401, "No session"); return { user: { id: "verified-user" } }; } },
    "./http": { HttpError },
    "../auth/dev-mode": { DEV_MODE_COOKIE: "paessed-dev-mode", devModeAvailable: () => dev },
  };
  new Function("require", "exports", compiled)(name => { assert.ok(modules[name], `Unexpected dependency ${name}`); return modules[name]; }, result);
  return { ...result, calls };
}

test("a verified account may enter the dashboard without a diagnostic; the UI explains the missing prerequisite", async () => {
  const app = entry();
  await app.requireAppEntry();
  assert.deepEqual(app.calls, ["verify"]);
  await assert.rejects(app.redirectSignedIn(), /redirect:\/bienvenida/);
});
test("opening the dashboard still requires a real account, except the explicitly enabled developer sandbox", async () => {
  await assert.rejects(entry({ signedIn: false }).requireAppEntry(), /redirect:\/login/);
  const sandbox = entry({ signedIn: false, dev: true });
  await sandbox.requireAppEntry();
  assert.deepEqual(sandbox.calls, []);
});
