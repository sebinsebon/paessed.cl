import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = resolve(import.meta.dirname, "..");

test("real IndexedDB: persistence, cross-tab atomicity, backup merge, notifications, corruption protection", async () => {
  const server = createServer(async (req, res) => {
    try {
      if (req.url === "/") { res.setHeader("Content-Type", "text/html"); res.end("<!doctype html><title>Learning repository test</title>"); return; }
      const path = resolve(root, `.${req.url}`);
      if (!path.startsWith(`${root}\\lib\\`) || !path.endsWith(".ts")) { res.statusCode = 404; res.end(); return; }
      const source = await readFile(path, "utf8");
      const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
      res.setHeader("Content-Type", "application/javascript"); res.end(js);
    } catch (error) { res.statusCode = 500; res.end(String(error)); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const one = await context.newPage(), two = await context.newPage();
    const url = `http://127.0.0.1:${server.address().port}`;
    for (const page of [one, two]) {
      await page.goto(url);
      await page.evaluate(async () => {
        window.repo = await import("/lib/learning/repository.ts");
        const { M1_UNITS } = await import("/lib/m1-curriculum.ts");
        window.catalog = M1_UNITS.flatMap(u => Array.from({ length: 10 }, (_, i) => ({ id: `${u.id}:${i}`, examId: "test", number: i + 1, axisId: u.axisId, unitId: u.id, correct: "A", eligible: true, revision: "1" })));
      });
    }
    const states = await Promise.all([one, two].map(page => page.evaluate(() => window.repo.readLearningState())));
    assert.equal(states[0].learnerId, states[1].learnerId, "initial learner UUID created atomically");
    await two.evaluate(() => { window.notifications = 0; window.repo.subscribeLearning(() => { window.notifications++; }); });
    await Promise.all([one, two].map((page, side) => page.evaluate(async side => {
      await Promise.all(Array.from({ length: 20 }, (_, i) => window.repo.dispatchLearning({ type: "external-attempt", questionId: window.catalog[side * 20 + i].id, sessionId: `exam-${side}`, mode: "exam", answer: "A" }, window.catalog)));
    }, side)));
    await two.waitForFunction(() => window.notifications > 0);
    let state = await one.evaluate(() => window.repo.readLearningState());
    assert.equal(state.attempts.length, 40, "concurrent tabs retain all 40 answers");
    assert.equal(state.attempts.filter(a => a.eligible).length, 40);
    await one.reload();
    await one.evaluate(async () => { window.repo = await import("/lib/learning/repository.ts"); });
    assert.equal((await one.evaluate(() => window.repo.readLearningState())).attempts.length, 40, "reload resumes stored state");
    const backup = await one.evaluate(() => window.repo.exportLearningState());
    const freshContext = await browser.newContext();
    const fresh = await freshContext.newPage();
    await fresh.goto(url);
    await fresh.evaluate(async () => { window.repo = await import("/lib/learning/repository.ts"); await window.repo.readLearningState(); });
    const adopted = await fresh.evaluate(value => window.repo.restoreLearningState(value), backup);
    assert.equal(adopted.learnerId, backup.learnerId, "fresh browser adopts backup learner UUID");
    assert.equal(adopted.attempts.length, 40);
    await freshContext.close();
    const restored = await one.evaluate(value => window.repo.restoreLearningState(value), backup);
    assert.equal(restored.attempts.length, 40);
    const restoredAgain = await one.evaluate(value => window.repo.restoreLearningState(JSON.stringify(value)), backup);
    assert.equal(restoredAgain.attempts.length, 40, "repeated restore is evidence-idempotent");
    await two.evaluate(async () => {
      const state = await window.repo.readLearningState();
      const attempt = state.attempts[0];
      await window.repo.dispatchLearning({ type: "expose", questionId: attempt.questionId, sessionId: attempt.sessionId, mode: "exam", assisted: true }, window.catalog);
    });
    const afterHelp = await one.evaluate(() => window.repo.exportLearningState());
    assert.equal(afterHelp.attempts.filter(a => a.eligible).length, 40, "later solution review preserves original evidence");
    const afterHelpMerged = await one.evaluate(value => window.repo.restoreLearningState(value), afterHelp);
    assert.equal(afterHelpMerged.attempts.filter(a => a.eligible).length, 40, "backup merge preserves assistance chronology");
    const different = { ...backup, learnerId: "another-learner" };
    assert.match(await one.evaluate(async value => { try { await window.repo.restoreLearningState(value); return "accepted"; } catch (e) { return e.message; } }, different), /otro estudiante/);
    const bad = { ...backup, attempts: [{ nope: true }] };
    assert.match(await one.evaluate(async value => { try { await window.repo.restoreLearningState(value); return "accepted"; } catch (e) { return e.message; } }, bad), /dañados/);
    assert.equal((await one.evaluate(() => window.repo.readLearningState())).attempts.length, 40, "rejected restore preserves stored data");
    await one.evaluate(() => new Promise((resolve, reject) => {
      const open = indexedDB.open("paessed-learning", 1);
      open.onsuccess = () => { const tx = open.result.transaction("state", "readwrite"); tx.objectStore("state").put({ broken: true }, "current"); tx.oncomplete = () => { open.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    }));
    assert.match(await one.evaluate(async () => { try { await window.repo.readLearningState(); return "accepted"; } catch (e) { return e.message; } }), /dañados/);
    const raw = await one.evaluate(() => new Promise(resolve => {
      const open = indexedDB.open("paessed-learning", 1); open.onsuccess = () => { const req = open.result.transaction("state").objectStore("state").get("current"); req.onsuccess = () => { resolve(req.result); open.result.close(); }; };
    }));
    assert.deepEqual(raw, { broken: true }, "corrupt record is retained, never silently reset");
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
