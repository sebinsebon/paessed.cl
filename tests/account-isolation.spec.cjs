const { test, expect } = require("@playwright/test");
const { enableLocalApp } = require("./local-app-fixture.cjs");
const { exams, questions } = require("../lib/default-catalog.json");

const accountA = "11111111-1111-4111-8111-111111111111";
const accountB = "22222222-2222-4222-8222-222222222222";
const exam = exams[0];
const question = questions.find(item => item.examId === exam.id);
const emptySync = { revision: 0, generation: 0, catalogRevision: "gold-0.7-sync-1", changes: [], acknowledgements: [], conflicts: [], hasMore: false, cursor: 0 };

function hold() {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  return { pending, release, requests: 0, finished: 0 };
}

async function openAccounts(page, baseURL) {
  await enableLocalApp(page, baseURL);
  const other = await page.context().newPage();
  await other.goto(baseURL + "/login");
  await page.bringToFront();
  let owner = accountA;
  let blocked;
  let status = 200;
  await page.route("**/api/auth/session", async route => {
    const id = owner;
    const code = status;
    const waiting = blocked;
    if (waiting) { waiting.requests++; await waiting.pending; }
    const displayName = id === accountA ? "Cuenta A" : "Cuenta B";
    await route.fulfill({ status: code, json: {
      configured: true, user: id ? { id, email: id === accountA ? "alumna-a@example.test" : "alumna-b@example.test", providers: ["email"] } : null,
      profile: { displayName },
    } }).catch(error => { if (!waiting) throw error; }).finally(() => { if (waiting) waiting.finished++; });
  });
  await page.route("**/api/sync?**", route => route.fulfill({ json: emptySync }));
  return {
    set(next, gate, response = 200) { owner = next; blocked = gate; status = response; },
    async select(next, gate, response = 200) {
      this.set(next, gate, response);
      await other.evaluate(value => {
        if (value) localStorage.setItem("paessed-sync-owner", value);
        else localStorage.removeItem("paessed-sync-owner");
      }, next);
    },
  };
}

async function seedProgress(page) {
  await page.evaluate(({ id, examId, question, date }) => new Promise((resolve, reject) => {
    const open = indexedDB.open("paessed-account-" + id + "-v3", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(["exam-sessions", "state"], "readwrite");
      tx.objectStore("exam-sessions").put({
        id: "previous-account-exam", index: 0, answers: { [question.id]: question.correct }, completedAt: date,
      }, examId);
      tx.objectStore("state").put({ version: 1, learnerId: id, seed: 12, revision: 1, goal: 2,
        diagnostic: null, nodes: [], exposures: [], attempts: [{
          id: "previous-account-attempt", questionId: question.id, sessionId: "previous-account-exam",
          mode: "exam", axisId: question.axisId, unitId: question.unitId, revision: question.revision,
          answer: question.correct, correct: true, eligible: true, assisted: false, at: date,
        }],
      }, "current");
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), { id: accountA, examId: exam.id, question, date: "2026-11-01T00:00:00Z" });
}

const greeting = page => page.locator("main h1").filter({ hasText: "¡Hola" });
const history = page => page.locator("#tour-exams");

test("un cambio en otra pestaña oculta el historial en todos los frames del regreso a Inicio", async ({ page, baseURL }) => {
  await page.addInitScript(() => Object.defineProperty(AbortSignal, "any", { value: undefined }));
  const session = await openAccounts(page, baseURL);
  await page.goto("/app/ensayos");
  await expect(page.getByRole("heading", { name: "Tus ensayos" })).toBeVisible();
  await seedProgress(page);
  const next = hold();
  try {
    await session.select(accountB, next);
    await expect.poll(() => next.requests).toBeGreaterThan(0);
    await page.evaluate(title => {
      window.previousHistorySeen = false;
      const watch = () => {
        window.previousHistorySeen ||= document.querySelector("#tour-exams")?.textContent.includes(title) ?? false;
      };
      watch();
      new MutationObserver(watch).observe(document.body, { subtree: true, childList: true, characterData: true });
    }, exam.title);
    await page.locator('a[href="/app/inicio"]:visible').first().click();
    await expect(greeting(page)).toHaveText("¡Hola!");
    await expect(page.getByRole("link", { name: "Hacer un ensayo" }).filter({ visible: true })).toBeVisible();
    await expect(page.locator('[id="tour-progress"] dd')).toHaveCount(0);
    await expect(page.locator("#tour-domains [data-loading-placeholder]")).toBeVisible();
    await expect(page.locator("#diagnostic-reminder-title")).toHaveCount(0);
    expect(await page.evaluate(() => window.previousHistorySeen)).toBe(false);
    session.set(accountB);
    next.release();
    await expect(greeting(page)).toContainText("Cuenta B");
    await expect(history(page)).not.toContainText(exam.title);
    expect(await page.evaluate(() => window.previousHistorySeen)).toBe(false);
  } finally {
    next.release();
  }
});

test("un cambio rápido A → B → A ignora B aunque su respuesta llegue al final", async ({ page, baseURL }) => {
  const session = await openAccounts(page, baseURL);
  await page.goto("/app/inicio");
  await expect(greeting(page)).toContainText("Cuenta A");
  await seedProgress(page);
  await page.reload();
  await expect(history(page)).toContainText(exam.title);
  const lateB = hold(), newA = hold();
  try {
    await session.select(accountB, lateB);
    await expect.poll(() => lateB.requests).toBeGreaterThan(0);
    await expect(greeting(page)).toHaveText("¡Hola!");
    await expect(history(page)).not.toContainText(exam.title);
    await session.select(accountA, newA);
    await expect.poll(() => newA.requests).toBeGreaterThan(0);
    await expect(history(page)).not.toContainText(exam.title);
    session.set(accountA);
    newA.release();
    await expect(greeting(page)).toContainText("Cuenta A");
    await expect(history(page)).toContainText(exam.title);
    await page.evaluate(() => {
      window.lateAccountSeen = false;
      new MutationObserver(() => {
        window.lateAccountSeen ||= document.body.textContent.includes("Cuenta B");
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    lateB.release();
    await expect.poll(() => lateB.finished).toBeGreaterThan(0);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(greeting(page)).toContainText("Cuenta A");
    expect(await page.evaluate(() => window.lateAccountSeen)).toBe(false);
    await page.reload();
    await expect(greeting(page)).toContainText("Cuenta A");
    await expect(history(page)).toContainText(exam.title);
  } finally {
    lateB.release(); newA.release();
  }
});

test("errores de sesión y recargas conservan el almacenamiento sin abrir áreas privadas", async ({ page, baseURL }) => {
  const session = await openAccounts(page, baseURL);
  await page.goto("/app/inicio");
  await expect(greeting(page)).toContainText("Cuenta A");
  await seedProgress(page);
  for (const [code, path] of [[503, "/app/playground"], [401, "/app/perfil"], [503, "/app/aprender"], [503, "/diagnostico/resultado"], [401, "/app/ensayos/resultado"]]) {
    session.set(accountA, undefined, code);
    await page.goto(path);
    await expect(page.getByText("No se pudo comprobar tu sesión.", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("alumna-a@example.test")).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Nombre", exact: true })).toHaveCount(0);
    await expect(history(page)).toHaveCount(0);
    await expect(page.getByText("Respuestas registradas")).toHaveCount(0);
  }
  session.set(accountA);
  await page.goto("/app/inicio");
  await expect(greeting(page)).toContainText("Cuenta A");
  await expect(history(page)).toContainText(exam.title);
  await session.select(null);
  await expect(greeting(page)).toHaveText(/^¡Hola!/);
  await expect(history(page)).not.toContainText(exam.title);
});

test("el resultado demo está aislado y el resultado antiguo no se atribuye a un invitado", async ({ page, baseURL }) => {
  const session = await openAccounts(page, baseURL);
  await page.goto("/app/inicio");
  await expect(greeting(page)).toContainText("Cuenta A");
  await page.evaluate(owner => {
    const result = { correct: 65, wrong: 0, omitted: 0, secondsLeft: 3600 };
    localStorage.setItem(`paessed-account:${owner}:paessed-last-exam-v2`, JSON.stringify({ ...result, score: 999 }));
    localStorage.setItem("paessed-last-exam", JSON.stringify({ ...result, score: 998 }));
  }, accountA);
  const score = page.locator("main h1");
  await page.goto("/app/ensayos/resultado");
  await expect(score).toHaveText("999 pts");
  await session.select(accountB);
  await expect(score).toHaveText("711 pts");
  await session.select(null);
  await expect(score).toHaveText("711 pts");
  await page.reload();
  await expect(score).toHaveText("711 pts");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("paessed-last-exam")).score)).toBe(998);
});
