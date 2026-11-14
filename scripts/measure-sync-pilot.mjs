// Local simulation only: no network, project credentials or hosted database.
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import catalog from "../lib/default-catalog.json" with { type: "json" };
import { createSyncService } from "../lib/server/sync-service.ts";
import { CATALOG_REVISION } from "../lib/sync/protocol.ts";

const learners = Number(process.env.PILOT_LEARNERS ?? 10);
const sessionsPerLearner = Number(process.env.PILOT_SESSIONS ?? 8);
if (!Number.isInteger(learners) || learners < 1 || learners > 100 || !Number.isInteger(sessionsPerLearner) || sessionsPerLearner < 1 || sessionsPerLearner > 20) throw new Error("PILOT_LEARNERS: 1..100; PILOT_SESSIONS: 1..20.");
const pg = new PGlite();
try {
  await pg.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz,created_at timestamptz default now());");
  await pg.exec(await readFile(new URL("../supabase/migrations/20261111230120_account_sync_mvp.sql", import.meta.url), "utf8"));
  let sqlQueries = 0, databaseResultBytes = 0, responseBytes = 0, operationBytes = 0;
  const query = async (connection, text, params = []) => {
    const result = (await connection.query(text, params)).rows;
    sqlQueries++; databaseResultBytes += Buffer.byteLength(JSON.stringify(result)); return result;
  };
  const driver = { query: (text, params) => query(pg, text, params), transaction: work => pg.transaction(tx => work((text, params) => query(tx, text, params))) };
  const service = createSyncService(driver);
  const questions = catalog.questions.filter(q => q.eligible);
  const baseline = Number((await pg.query("select pg_database_size(current_database()) as bytes")).rows[0].bytes);
  const startedAt = performance.now();
  for (let learner = 0; learner < learners; learner++) {
    const owner = randomUUID(), deviceId = randomUUID();
    await pg.query("insert into auth.users(id) values($1)", [owner]);
    let latest = await service.pull(owner); responseBytes += Buffer.byteLength(JSON.stringify(latest));
    for (let i = 0; i < sessionsPerLearner; i++) {
      const chosen = questions.slice(i * 5, i * 5 + 5);
      const session = { id: randomUUID(), index: 4, questionIds: chosen.map(q => q.id), answers: Object.fromEntries(chosen.map(q => [q.id, q.correct])), confirmed: chosen.map(q => q.id), completedAt: new Date().toISOString() };
      const operation = { id: randomUUID(), deviceId, sequence: i + 1, baseRevision: latest.revision, generation: 0, contractVersion: 1, catalogRevision: CATALOG_REVISION, at: new Date().toISOString(), action: { type: "session", mode: "playground", sourceId: "playground", session } };
      operationBytes += Buffer.byteLength(JSON.stringify(operation));
      latest = await service.push(owner, [operation], latest.cursor);
      responseBytes += Buffer.byteLength(JSON.stringify(latest));
    }
    const unchanged = await service.pull(owner, latest.cursor);
    if (unchanged.changes.length) throw new Error("Unchanged incremental reads must be empty.");
    responseBytes += Buffer.byteLength(JSON.stringify(unchanged));
  }
  const databaseBytes = Number((await pg.query("select pg_database_size(current_database()) as bytes")).rows[0].bytes);
  const originals = Number((await pg.query("select count(*) as n from paessed.original_answers")).rows[0].n);
  process.stdout.write(JSON.stringify({ engine: "PostgreSQL local via PGlite", learners, sessions: learners * sessionsPerLearner, originals, elapsedMs: Math.round(performance.now() - startedAt), sqlQueries, syntheticRequestBytes: operationBytes, applicationResponseBytes: responseBytes, serializedDatabaseResultBytes: databaseResultBytes, localDatabaseBytes: databaseBytes, localDatabaseGrowthBytes: databaseBytes - baseline, note: "Synthetic local measurements; excludes transport overhead, billed Supabase egress and provider Auth traffic." }, null, 2) + "\n");
} finally { await pg.close(); }
