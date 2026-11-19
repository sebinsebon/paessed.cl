import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import catalogData from "../lib/default-catalog.json" with { type: "json" };
import { createLearningState, getProfile, getLearningStats, hasCompletedInitialDiagnostic, planLearning, reduceLearning } from "../lib/learning/engine.ts";
import { validateLearningState } from "../lib/learning/repository.ts";
import { incorporateGuestDiagnostic, validateGuestDiagnostic, onboardingStatus, getOnboardingStatus } from "../lib/server/onboarding.ts";
import { createSyncService, rebuildImportedState } from "../lib/server/sync-service.ts";
import { CATALOG_REVISION, learningStateSchema, onboardingSchema } from "../lib/sync/contracts.ts";
import { db, database } from "../lib/server/db.ts";

const catalog = catalogData.questions;
const at = "2026-11-10T14:00:00.000Z", later = "2026-11-10T14:20:00.000Z";
function guest() {
  let state = reduceLearning(createLearningState(at), { type: "start-diagnostic" }, catalog, at);
  for (const id of state.diagnostic.questionIds) state = reduceLearning(state, { type: "answer-diagnostic", questionId: id, answer: catalog.find(q => q.id === id).correct }, catalog, at);
  return reduceLearning(state, { type: "complete-diagnostic" }, catalog, later);
}
const original = guest();
const submission = (includeEvidence = true, state = original) => ({ diagnostic: structuredClone(state.diagnostic), priorQuestionIds: [], assistedQuestionIds: [], includeEvidence });
function existingAccount() {
  let state = planLearning(createLearningState(at), catalog, at);
  const q = catalog.find(q => q.id === original.diagnostic.questionIds[0]);
  state = reduceLearning(state, { type: "external-attempt", questionId: q.id, sessionId: randomUUID(), mode: "exam", answer: "A" }, catalog, at);
  const node = state.nodes[0];
  state = reduceLearning(state, { type: "start-node", nodeId: node.id }, catalog, at);
  return reduceLearning(state, { type: "answer", nodeId: node.id, questionId: node.questionIds[0], answer: "B" }, catalog, at);
}

test("the Postgres.js connection commits a diagnostic once and a fresh cursor recovers it", async () => {
  const pg = new PGlite();
  const socket = new PGLiteSocketServer({ db: pg, port: 0, host: "127.0.0.1" });
  const oldUrl = process.env.DATABASE_URL;
  let connection;
  try {
    await pg.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz,created_at timestamptz default now());");
    await pg.exec(await readFile(new URL("../supabase/migrations/20261111230120_account_sync_mvp.sql", import.meta.url), "utf8"));
    const owner = randomUUID();
    await pg.query("insert into auth.users(id) values($1)", [owner]);
    await socket.start();
    process.env.DATABASE_URL = `postgres://postgres:postgres@${socket.getServerConn()}/postgres`;
    connection = db();
    const driver = database(), service = createSyncService(driver);
    assert.equal((await service.pull(owner, 0)).revision, 1);
    const first = await service.incorporateDiagnostic(owner, submission("if-empty"));
    const replay = await service.incorporateDiagnostic(owner, submission("if-empty"));
    assert.equal(first.sync.revision, replay.sync.revision);
    const recovered = (await service.pull(owner, 0)).changes.find(change => change.kind === "learning").value;
    assert.deepEqual(recovered.diagnostic, original.diagnostic);
    assert.equal(recovered.diagnosticHandoffs.length, 1);
    assert.equal(recovered.attempts.length, 16);
    const count = await driver.query("select count(*)::int as count from paessed.original_answers");
    assert.equal(count[0].count, 16);
    const questionId = original.diagnostic.questionIds[0];
    await service.push(owner, [{ id: randomUUID(), deviceId: randomUUID(), sequence: 1, baseRevision: first.sync.revision, generation: 0, contractVersion: 1,
      catalogRevision: CATALOG_REVISION, at: later, action: { type: "saved-question", questionId, deleted: false } }]);
    const bookmark = (await service.pull(owner, 0)).changes.find(change => change.kind === "saved-question");
    assert.equal(bookmark.key, questionId);
  } finally {
    if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
    await connection?.end({ timeout: 2 });
    await socket.stop();
    await pg.close();
  }
});

test("later guest restores cannot silently incorporate a previously declined diagnostic", () => {
  const before = existingAccount();
  const declined = incorporateGuestDiagnostic(before, submission(false), later);
  const restored = rebuildImportedState({ ...declined, diagnostic: structuredClone(original.diagnostic),
    attempts: [...declined.attempts, ...original.attempts.map(attempt => ({ ...attempt, eligible: false }))],
    exposures: [...declined.exposures, ...original.exposures],
  });
  assert.deepEqual(getProfile(restored), getProfile(declined));
  assert.deepEqual(restored.nodes, rebuildImportedState(declined).nodes);
  assert.equal(restored.attempts.some(attempt => attempt.sessionId === original.diagnostic.id), false);
  assert.equal(restored.diagnostic, null);
  assert.equal(hasCompletedInitialDiagnostic(restored), true);
});

test("restore preserves answer order when two questions were answered in the same millisecond", () => {
  const state = structuredClone(original);
  state.attempts.sort((a, b) => b.id.localeCompare(a.id));
  assert.equal(new Set(state.attempts.map(a => a.at)).size, 1);
  assert.deepEqual(rebuildImportedState(state).attempts.map(a => a.id), state.attempts.map(a => a.id));
});

test("empty account automatically includes the completed 16q diagnostic, preserving identity and future nodes", () => {
  const before = planLearning(createLearningState(at), catalog, at);
  const after = incorporateGuestDiagnostic(before, submission(false), later);
  assert.equal(after.learnerId, before.learnerId);
  assert.deepEqual(after.nodes, before.nodes);
  assert.equal(after.attempts.length, 16);
  assert.equal(after.attempts.filter(a => a.eligible).length, 16);
  assert.equal(after.initialDiagnostic.includeEvidence, true);
  assert.equal(hasCompletedInitialDiagnostic(after), true);
  assert.equal(getLearningStats(after, later).xp, 0);
  assert.equal(learningStateSchema.safeParse(after).success, true);
  assert.deepEqual(before.attempts, [], "input is immutable");
});

test("yes adds catalog-derived originals without rewriting history, nodes, original answers or duplicate mastery", () => {
  const before = existingAccount();
  const after = incorporateGuestDiagnostic(before, submission(), later);
  assert.deepEqual(after.nodes, before.nodes, "active node answers, corrections and future nodes survive exactly");
  assert.deepEqual(after.attempts.slice(0, before.attempts.length), before.attempts);
  assert.equal(getLearningStats(after, later).xp, getLearningStats(before, later).xp);
  const duplicate = after.attempts.find(a => a.sessionId === original.diagnostic.id && a.questionId === original.diagnostic.questionIds[0]);
  assert.equal(duplicate.eligible, false);
  assert.equal(after.attempts.filter(a => a.eligible && a.questionId === duplicate.questionId).length, 1);
  assert.equal(duplicate.correct, duplicate.answer === catalog.find(q => q.id === duplicate.questionId).correct);
  assert.equal(validateLearningState(after).attempts.length, before.attempts.length + 16);
});

test("no marks completion separately and preserves the complete mastery projection and active node", () => {
  const before = existingAccount(), after = incorporateGuestDiagnostic(before, submission(false), later);
  assert.deepEqual(after.attempts, before.attempts);
  assert.deepEqual(after.exposures, before.exposures);
  assert.deepEqual(after.nodes, before.nodes);
  assert.deepEqual(getProfile(after), getProfile(before));
  assert.equal(after.diagnostic, null);
  assert.equal(after.initialDiagnostic.includeEvidence, false);
  assert.equal(hasCompletedInitialDiagnostic(after), true);
  const resumed = reduceLearning(after, { type: "start-diagnostic" }, catalog, later);
  assert.equal(resumed.diagnostic, null, "start-diagnostic cannot force a declined diagnostic again");
  assert.equal(learningStateSchema.safeParse(after).success, true);
});

test("source-specific receipts permit a second diagnosis and make old accepted/declined replays harmless", () => {
  const first = incorporateGuestDiagnostic(existingAccount(), submission(false), later);
  const secondSubmission = submission(true, guest());
  const second = incorporateGuestDiagnostic(first, secondSubmission, later);
  assert.equal(second.diagnosticHandoffs.length, 2);
  assert.equal(onboardingStatus(second).handledDiagnosticIds.length, 2);
  assert.equal(incorporateGuestDiagnostic(second, submission(true), later), second, "old rejection cannot turn into contribution");
  assert.equal(incorporateGuestDiagnostic(second, secondSubmission, later), second, "accepted replay cannot add answers");
  const thirdSubmission = { ...secondSubmission, diagnostic: { ...secondSubmission.diagnostic, id: `${randomUUID()}:diagnostic` } };
  const third = incorporateGuestDiagnostic(second, thirdSubmission, later);
  assert.equal(third.attempts.filter(a => a.eligible).length, second.attempts.filter(a => a.eligible).length, "same questions from another diagnosis cannot inflate mastery");
});

test("an account that previously declined still requires a choice for a new diagnostic", () => {
  const first = incorporateGuestDiagnostic(existingAccount(), submission(false), later);
  first.attempts = []; first.exposures = []; first.nodes = [];
  const after = incorporateGuestDiagnostic(first, submission(false, guest()), later);
  assert.equal(after.initialDiagnostic.includeEvidence, false);
  assert.equal(after.attempts.length, 0);
  assert.equal(onboardingStatus(after).hasDiagnostic, true);
});

test("guest prior exposure and help remain ineligible after server rebuild", () => {
  const request = submission();
  const [prior, helped] = request.diagnostic.questionIds;
  request.priorQuestionIds = [prior]; request.assistedQuestionIds = [helped];
  const state = incorporateGuestDiagnostic(createLearningState(at), request, later);
  for (const id of [prior, helped]) {
    assert.equal(state.attempts.find(a => a.questionId === id).eligible, false);
    assert.equal(rebuildImportedState(state).attempts.find(a => a.questionId === id).eligible, false);
  }
  assert.equal(state.attempts.filter(a => a.eligible).length, 14);
});

test("existing legacy diagnostic completion remains compatible and a partially active diagnostic cannot block accepted handoff", () => {
  assert.equal(hasCompletedInitialDiagnostic(original), true);
  assert.equal(learningStateSchema.safeParse(original).success, true);
  let active = reduceLearning(createLearningState(at), { type: "start-diagnostic" }, catalog, at);
  const d = structuredClone(active.diagnostic);
  active = incorporateGuestDiagnostic(active, submission(false), later);
  assert.deepEqual(active.diagnostic, d);
  assert.equal(hasCompletedInitialDiagnostic(active), true);
  assert.doesNotThrow(() => reduceLearning(active, { type: "start-node", nodeId: active.nodes[0].id }, catalog, later));
});

test("invalid, unfinished, duplicate, off-catalog and forged metric payloads are rejected", () => {
  const changes = [
    value => { delete value.diagnostic.completedAt; },
    value => { delete value.diagnostic.answers[value.diagnostic.questionIds[0]]; },
    value => { value.diagnostic.questionIds[0] = value.diagnostic.questionIds[1]; },
    value => { value.diagnostic.answers.extra = "A"; },
    value => { value.diagnostic.questionIds[0] = `personal:${"f".repeat(64)}:999`; },
    value => { value.diagnostic.startedAt = "2099-01-01T00:00:00Z"; },
    value => { value.diagnostic.completedAt = "2099-01-01T00:00:00Z"; },
    value => { value.correct = true; value.eligible = true; },
    value => { value.priorQuestionIds = [`personal:${"f".repeat(64)}:1`]; },
    value => { value.diagnostic.answers[value.diagnostic.questionIds[0]] = "correct"; },
  ];
  for (const change of changes) { const value = submission(); change(value); assert.throws(() => validateGuestDiagnostic(value), error => error.status === 400); }
  const wrongUnit = submission();
  const first = catalog.find(q => q.id === wrongUnit.diagnostic.questionIds[0]);
  const replacement = catalog.find(q => q.eligible && q.unitId === first.unitId && !wrongUnit.diagnostic.questionIds.includes(q.id));
  const removed = wrongUnit.diagnostic.questionIds[1]; wrongUnit.diagnostic.questionIds[1] = replacement.id;
  delete wrongUnit.diagnostic.answers[removed]; wrongUnit.diagnostic.answers[replacement.id] = "A";
  assert.throws(() => validateGuestDiagnostic(wrongUnit), error => error.status === 400);
  assert.equal(onboardingSchema.safeParse(submission()).success, true);
});

test("receipts are bounded without evicting declined IDs and opening replay holes", () => {
  const state = existingAccount();
  state.diagnosticHandoffs = Array.from({length:64}, () => ({ sourceId: `${randomUUID()}:diagnostic`, completedAt: later, includeEvidence: false }));
  state.initialDiagnostic = state.diagnosticHandoffs[0];
  assert.throws(() => incorporateGuestDiagnostic(state, submission()), error => error.status === 429);
  const replay = submission(); replay.diagnostic.id = state.diagnosticHandoffs[0].sourceId;
  assert.equal(incorporateGuestDiagnostic(state, replay), state);
});

test("PostgreSQL transaction persists completion/evidence, returns sync changes and rejects forged restore markers", async t => {
  const pg = new PGlite();
  try {
    await pg.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz,created_at timestamptz default now());");
    await pg.exec(await readFile(new URL("../supabase/migrations/20261111230120_account_sync_mvp.sql", import.meta.url), "utf8"));
    const query = async (text, params = []) => (await pg.query(text, params)).rows;
    const driver = { query, transaction: work => pg.transaction(tx => work(async (text, params = []) => (await tx.query(text, params)).rows)) };
    const service = createSyncService(driver);
    const owner = randomUUID(); await query("insert into auth.users(id) values($1)", [owner]);
    assert.equal((await getOnboardingStatus(owner, driver)).complete, false);
    const response = await service.incorporateDiagnostic(owner, submission(false));
    assert.equal(response.status.complete, true);
    assert.equal(response.sync.changes.find(c => c.kind === "learning").value.initialDiagnostic.includeEvidence, true);
    assert.equal((await getOnboardingStatus(owner, driver)).complete, true);
    assert.equal(Number((await query("select count(*) as n from paessed.original_answers"))[0].n), 16);
    const replay = await service.incorporateDiagnostic(owner, submission(false));
    assert.equal(replay.sync.revision, response.sync.revision);
    assert.equal(Number((await query("select count(*) as n from paessed.original_answers"))[0].n), 16);
    const no = submission(false, guest());
    await service.incorporateDiagnostic(owner, no);
    let authoritative = (await query("select state from paessed.learning_states where owner_id=$1", [owner]))[0].state;
    assert.equal(authoritative.diagnosticHandoffs.length, 2);
    assert.equal(authoritative.initialDiagnostic.includeEvidence, false);
    assert.equal(authoritative.attempts.length, 16);
    await service.incorporateDiagnostic(owner, { ...no, includeEvidence: true });
    assert.equal((await getOnboardingStatus(owner, driver)).handledDiagnosticIds.length, 2);
    const other = randomUUID(); await query("insert into auth.users(id) values($1)", [other]);
    const forged = planLearning(createLearningState(at), catalog, at);
    forged.initialDiagnostic = { sourceId: "fake", completedAt: later, includeEvidence: false };
    forged.diagnosticHandoffs = [forged.initialDiagnostic];
    await service.push(other, [{id:randomUUID(),deviceId:randomUUID(),sequence:1,baseRevision:1,generation:0,contractVersion:1,catalogRevision:CATALOG_REVISION,at:new Date().toISOString(),action:{type:"restore-learning",state:forged}}], 0, true);
    assert.equal((await getOnboardingStatus(other, driver)).complete, false, "client completion receipts cannot authorize app access");
    await query("update paessed.learning_states set state=$2::jsonb where owner_id=$1", [other, JSON.stringify(original)]);
    assert.equal((await getOnboardingStatus(other, driver)).complete, true, "authoritative legacy diagnostic remains complete");
    const before = (await service.pull(owner)).revision;
    process.env.SYNC_WRITES_PAUSED = "true";
    try {
      await service.incorporateDiagnostic(owner, submission());
      await assert.rejects(service.incorporateDiagnostic(owner, submission(true, guest())), error => error.status === 429);
    } finally { delete process.env.SYNC_WRITES_PAUSED; }
    assert.equal((await service.pull(owner)).revision, before, "capacity failure rolls back completion and evidence");
  } finally { await pg.close(); }
});
