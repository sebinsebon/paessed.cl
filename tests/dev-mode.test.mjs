import test from "node:test";
import assert from "node:assert/strict";
import { devModeAvailable } from "../lib/auth/dev-mode.ts";
import { databaseName, scopedStorageKey, openLocalDatabase } from "../lib/sync/local.ts";

test("developer shortcuts are explicit and unavailable in production, including forged environment opt-ins", () => {
  assert.equal(devModeAvailable({ NODE_ENV: "development" }), false);
  assert.equal(devModeAvailable({ NODE_ENV: "development", PAESSED_DEV_MODE: "true" }), true);
  assert.equal(devModeAvailable({ NODE_ENV: "production", VERCEL_ENV: "preview", PAESSED_DEV_MODE: "true" }), true);
  assert.equal(devModeAvailable({ NODE_ENV: "production", PAESSED_DEV_MODE: "true" }), false);
  assert.equal(devModeAvailable({ NODE_ENV: "development", VERCEL_ENV: "production", APP_ENV: "local", PAESSED_DEV_MODE: "true" }), false);
  assert.equal(devModeAvailable({ NODE_ENV: "development", APP_ENV: "production", PAESSED_DEV_MODE: "true" }), false);
});

test("developer sandbox keeps learning and storage keys separate from real guests and accounts", async () => {
  const previousWindow = globalThis.window;
  try {
    globalThis.window = { __PAESSED_DEV_SANDBOX__: false };
    const guest = databaseName(null);
    const account = databaseName("11111111-1111-4111-8111-111111111111");
    globalThis.window.__PAESSED_DEV_SANDBOX__ = true;
    assert.notEqual(databaseName(null), guest);
    assert.notEqual(databaseName("11111111-1111-4111-8111-111111111111"), account);
    assert.equal(scopedStorageKey("saved"), "paessed-dev:saved");
    assert.equal(databaseName(null), "paessed-dev:paessed-learning");
    await assert.rejects(openLocalDatabase(null), /IndexedDB/);
  } finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
});
