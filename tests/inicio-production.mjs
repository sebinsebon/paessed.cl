import assert from "node:assert/strict";

// Run against a local `next start` with VERCEL_ENV=production and PAESSED_DEV_MODE=true.
const base = process.env.PAESSED_BASE_URL ?? "http://127.0.0.1:3211";
const response = await fetch(`${base}/api/dev-mode`, {
  method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ enabled: true }),
});
assert.equal(response.status, 404);
const home = await fetch(base, { headers: { Cookie: "paessed-dev-mode=1" } });
const html = await home.text();
assert.equal(home.status, 200);
assert.ok(!html.includes("Herramientas de desarrollo"));
assert.ok(!html.includes("window.__PAESSED_DEV_SANDBOX__ = true"));
const app = await fetch(`${base}/app/inicio`, { headers: { Cookie: "paessed-dev-mode=1" }, redirect: "manual" });
assert.equal(app.status, 307);
assert.equal(new URL(app.headers.get("location"), base).pathname, "/login");
console.log("Production checks passed: dev endpoint 404, no dev panel, forged dev cookie cannot access dashboard.");
