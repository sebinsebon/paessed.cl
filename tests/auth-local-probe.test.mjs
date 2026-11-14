import test from "node:test";
import assert from "node:assert/strict";
import { localSupabaseOrigin, verifyLocalSupabase } from "../scripts/verify-local-supabase.mjs";

test("local permission verifier cannot target a hosted or credential-bearing origin", async () => {
  assert.equal(localSupabaseOrigin("http://127.0.0.1:54321"), "http://127.0.0.1:54321");
  for (const origin of ["https://rqeuczrmkkehxzipkynq.supabase.co", "http://localhost.evil.test", "http://user:secret@localhost:54321", "http://localhost:54321/path", "http://localhost:54321?url=https://evil.test"]) {
    assert.throws(() => localSupabaseOrigin(origin));
    let requested = false;
    await assert.rejects(verifyLocalSupabase({ LOCAL_SUPABASE_URL: origin, LOCAL_SUPABASE_PUBLISHABLE_KEY: "test-public-key" }, async () => { requested = true; throw new Error("Must not be called"); }));
    assert.equal(requested, false);
  }
});

test("local permission verifier checks HTTP denials and never sends administrative credentials", async () => {
  const paths = [];
  const report = await verifyLocalSupabase({ LOCAL_SUPABASE_PUBLISHABLE_KEY: "public-local-key", SUPABASE_SECRET_KEY: "admin-must-not-be-sent" }, async (url, options) => {
    assert.equal(options.headers.apikey, "public-local-key");
    assert.ok(!JSON.stringify(options).includes("admin-must-not-be-sent"));
    paths.push(url);
    if (url.endsWith("/storage/v1/bucket") && !options.method) return Response.json([]);
    if (url.includes("/storage/")) return Response.json({ error: "not authorized" }, { status: 403 });
    return Response.json({ error: "private schema" }, { status: options.headers["Content-Profile"] || options.headers["Accept-Profile"] ? 406 : 404 });
  });
  assert.equal(report.results.length, 5);
  assert.equal(report.authenticatedTested, false);
  assert.equal(paths.length, 6);
});
