import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { chromium } from "playwright";
import ts from "typescript";
import catalogData from "../lib/default-catalog.json" with { type: "json" };
import { incorporateGuestDiagnostic } from "../lib/server/onboarding.ts";

const root = resolve(import.meta.dirname, "..");
const owner = "11111111-1111-4111-8111-111111111111";
async function harness(work) {
  const server = createServer(async (request, response) => {
    try {
      if (request.url === "/") { response.setHeader("Content-Type", "text/html"); response.end("<!doctype html><title>Diagnostic handoff</title>"); return; }
      const path = resolve(root, `.${request.url}`);
      if (!path.startsWith(`${root}${sep}lib${sep}`) || !path.endsWith(".ts")) { response.statusCode = 404; response.end(); return; }
      response.setHeader("Content-Type", "application/javascript");
      response.end(ts.transpileModule(await readFile(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
    } catch (error) { response.statusCode = 500; response.end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async ({ owner, catalog }) => {
      window.repo = await import("/lib/learning/repository.ts");
      window.local = await import("/lib/sync/local.ts");
      window.client = await import("/lib/sync/client.ts");
      window.catalog = catalog; window.owner = owner;
      window.reply = patch => ({ revision: 1, generation: 0, catalogRevision: "gold-0.7-sync-1", acknowledgements: [], changes: [], conflicts: [], hasMore: false, cursor: 1, ...patch });
    }, { owner, catalog: catalogData.questions });
    await work(page);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}

test("an empty diagnostic draft is not presented as guest progress to import", () => harness(async page => {
  const result = await page.evaluate(async () => {
    window.local.setSyncOwner(null);
    await window.repo.readLearningState();
    const before = await window.client.guestProgressSummary();
    const started = await window.repo.dispatchDiagnostic({ type: "start-diagnostic" }, window.catalog);
    const empty = await window.client.guestProgressSummary();
    const q = window.catalog.find(q => q.id === started.diagnostic.questionIds[0]);
    await window.repo.dispatchDiagnostic({ type: "answer-diagnostic", questionId: q.id, answer: q.correct }, window.catalog);
    return { before, empty, answered: await window.client.guestProgressSummary() };
  });
  assert.equal(result.before.learning, false);
  assert.equal(result.empty.learning, false);
  assert.equal(result.empty.attempts, 0);
  assert.equal(result.answered.learning, true);
  assert.equal(result.answered.attempts, 1);
}));

test("signed-in 16q diagnostic is isolated until consent; no preserves prior mastery, sync projects receipt and suppresses second import", () => harness(async page => {
  const before = await page.evaluate(async () => {
    window.local.setSyncOwner(window.owner);
    const first = window.catalog.find(q => q.eligible);
    await window.repo.dispatchLearning({type:"external-attempt",questionId:first.id,answer:first.correct,mode:"exam",sessionId:crypto.randomUUID()},window.catalog);
    return window.repo.readLearningState();
  });
  const proof = await page.evaluate(async () => {
    const queued = await window.local.listPendingOperations();
    let draft = await window.repo.dispatchDiagnostic({type:"start-diagnostic"},window.catalog);
    for (const id of draft.diagnostic.questionIds) draft = await window.repo.dispatchDiagnostic({type:"answer-diagnostic",questionId:id,answer:window.catalog.find(q=>q.id===id).correct},window.catalog);
    await window.repo.dispatchDiagnostic({type:"complete-diagnostic"},window.catalog);
    return { state:await window.repo.readLearningState(), owner:window.local.getSyncOwner(), queued:await window.local.listPendingOperations(), beforeQueued:queued, submission:await window.client.readCompletedDiagnostic() };
  });
  assert.equal(proof.owner, owner, "active account is never switched to guest");
  assert.deepEqual(proof.state, before, "all 16 draft answers leave account mastery unchanged before consent");
  assert.deepEqual(proof.queued, proof.beforeQueued, "diagnostic draft never queues account learning mutations");
  const declined = incorporateGuestDiagnostic(before, { ...proof.submission, includeEvidence: false });
  assert.deepEqual(declined.attempts, before.attempts);
  await page.evaluate(async state => {
    const db = await window.local.openLocalDatabase(window.owner);
    await new Promise((resolve,reject)=>{const tx=db.transaction("outbox","readwrite");tx.objectStore("outbox").clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    await window.client.persistSyncResponse(window.owner,window.reply({revision:2,cursor:2,changes:[{revision:2,kind:"learning",key:"current",value:state}]}));
  }, declined);
  const summary = await page.evaluate(() => window.client.guestProgressSummary());
  assert.deepEqual(summary, { attempts: 0, sessions: 0, completedNodes: 0, savedQuestions: 0, learning: false });
  const persisted = await page.evaluate(() => window.repo.readLearningState());
  assert.equal(persisted.initialDiagnostic.includeEvidence, false);
  assert.equal(persisted.diagnostic, null, "declined account has a completion marker without diagnostic contribution");
  assert.equal((await page.evaluate(() => window.client.readCompletedDiagnostic())).diagnostic.id, proof.submission.diagnostic.id, "guest originals survive both auth and handoff");
}));

test("account diagnostic revisions survive reload and stay out of other accounts and guest storage", () => harness(async page => {
  const draft = await page.evaluate(async () => {
    const first = await window.repo.dispatchDiagnostic({ type: "start-diagnostic" }, window.catalog, window.owner);
    const q = window.catalog.find(question => question.id === first.diagnostic.questionIds[0]);
    await window.repo.dispatchDiagnostic({ type: "answer-diagnostic", questionId: q.id, answer: q.correct }, window.catalog, window.owner);
    return { id: first.diagnostic.id, question: q.id, answer: q.correct };
  });
  await page.reload();
  const persisted = await page.evaluate(async owner => {
    const repo = await import("/lib/learning/repository.ts");
    const { setSyncOwner, listPendingOperations } = await import("/lib/sync/local.ts");
    const other = crypto.randomUUID();
    setSyncOwner(other);
    return { matching: (await repo.readDiagnosticState(owner)).diagnostic, other: (await repo.readDiagnosticState(other)).diagnostic,
      guest: (await repo.readDiagnosticState()).diagnostic, account: (await repo.readLearningState(owner)).diagnostic, queued: await listPendingOperations(owner) };
  }, owner);
  assert.equal(persisted.matching.id, draft.id);
  assert.deepEqual(persisted.matching.answers, { [draft.question]: draft.answer });
  assert.equal(persisted.other, null);
  assert.equal(persisted.guest, null);
  assert.equal(persisted.account, null);
  assert.deepEqual(persisted.queued, []);
}));

test("manual synchronization retry drains signed-in pending answers after failure before handoff", () => harness(async page => {
  const result = await page.evaluate(async () => {
    const initial = window.local.createAccountLearningState(window.owner);
    let fail = true, pushes = 0;
    window.fetch = async (url, init) => {
      if (String(url).includes("/api/auth/session")) return Response.json({user:{id:window.owner}});
      if (init?.method === "POST") {
        pushes++;
        if (fail) return Response.json({error:"temporary"},{status:503});
        const {operations} = JSON.parse(init.body);
        return Response.json(window.reply({revision:2,cursor:2,acknowledgements:operations.map(o=>({id:o.id,sequence:o.sequence,status:"accepted"})),changes:[{revision:2,kind:"learning",key:"current",value:{...initial,revision:1}}]}));
      }
      return Response.json(window.reply({changes:[{revision:1,kind:"learning",key:"current",value:initial}]}));
    };
    await window.client.initializeSyncIdentity();
    const q = window.catalog.find(q=>q.eligible);
    await window.repo.dispatchLearning({type:"external-attempt",questionId:q.id,answer:q.correct,mode:"exam",sessionId:crypto.randomUUID()},window.catalog);
    await window.client.synchronize(true);
    const failed = (await window.local.listPendingOperations()).length;
    fail = false;
    await window.client.synchronize(true);
    return {failed,remaining:(await window.local.listPendingOperations()).length,pushes};
  });
  assert.equal(result.failed, 1);
  assert.equal(result.remaining, 0);
  assert.equal(result.pushes, 2);
}));

test("development diagnostic uses sandbox IndexedDB and never touches normal identity or guest state", () => harness(async page => {
  const result = await page.evaluate(async () => {
    localStorage.setItem("paessed-sync-owner",window.owner);
    await window.repo.readDiagnosticState();
    window.__PAESSED_DEV_SANDBOX__ = true;
    window.fetch = async () => { throw new Error("sandbox must not make an identity request"); };
    const identity = await window.client.initializeSyncIdentity();
    await window.repo.dispatchDiagnostic({type:"start-diagnostic"},window.catalog);
    return {identity,breadcrumb:localStorage.getItem("paessed-sync-owner"),names:(await indexedDB.databases()).map(d=>d.name),draft:(await window.repo.readDiagnosticState()).diagnostic};
  });
  assert.equal(result.identity.owner, null);
  assert.equal(result.breadcrumb, owner);
  assert.ok(result.names.includes("paessed-dev:paessed-learning"));
  assert.ok(result.names.includes("paessed-learning"));
  assert.equal(result.draft.questionIds.length, 16);
  assert.equal(await page.evaluate(async () => { window.__PAESSED_DEV_SANDBOX__ = false; return (await window.repo.readDiagnosticState()).diagnostic; }), null);
}));
