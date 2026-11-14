import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("cleanup retains unexpired daily quotas and removes only expired idle counters", async () => {
  const pg = new PGlite();
  try {
    await pg.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz,created_at timestamptz default now());");
    await pg.exec(await readFile(new URL("../supabase/migrations/20261111230120_account_sync_mvp.sql", import.meta.url), "utf8"));
    await pg.exec(`insert into paessed.rate_limit_counters(key,count,expires_at,touched_at) values
      ('education-day:account',19999,now()+interval '20 hours',now()-interval '2 hours'),
      ('sessions:account',99,now()+interval '20 hours',now()-interval '2 hours'),
      ('expired-idle',5,now()-interval '2 hours',now()-interval '2 hours'),
      ('expired-recent',5,now()-interval '1 minute',now()-interval '30 minutes');`);
    await pg.query("select paessed.cleanup_batch(1000)");
    const rows = (await pg.query("select key,count from paessed.rate_limit_counters order by key")).rows;
    assert.deepEqual(rows.map(row => row.key), ["education-day:account", "expired-recent", "sessions:account"]);
    assert.equal(Number(rows.find(row => row.key === "education-day:account").count), 19999);
    assert.equal(Number(rows.find(row => row.key === "sessions:account").count), 99);
    assert.equal((await pg.query("select paessed.consume_limit('education-day:account',20000,86400,2) as allowed")).rows[0].allowed, false);
  } finally { await pg.close(); }
});
