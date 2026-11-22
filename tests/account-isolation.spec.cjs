const { test, expect } = require("@playwright/test");
const JSZip = require("jszip");
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
    if (code === "disconnected") return route.abort("connectionfailed");
    const displayName = id === accountA ? "Cuenta A" : "Cuenta B";
    await route.fulfill({ status: code, json: {
      configured: true, user: id ? { id, email: id === accountA ? "alumna-a@example.test" : "alumna-b@example.test", providers: ["email"] } : null,
      profile: { displayName },
    } }).catch(error => { if (!waiting) throw error; }).finally(() => { if (waiting) waiting.finished++; });
  });
  await page.route("**/api/sync?**", route => route.fulfill({ json: emptySync }));
  return {
    other,
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

test("Inicio y Perfil comparten la consulta de sesión de la entrada privada", async ({ page, baseURL }) => {
  await enableLocalApp(page, baseURL);
  let sessions = 0;
  await page.route("**/api/auth/session", route => {
    sessions++;
    return route.fulfill({ json: { configured: true, user: { id: accountA, providers: ["email"] }, profile: { displayName: "Cuenta A" } } });
  });
  await page.route("**/api/sync?**", route => route.fulfill({ json: emptySync }));
  await page.goto("/app/inicio");
  await expect(greeting(page)).toContainText("Cuenta A");
  expect(sessions).toBe(1);
  for (const path of ["ensayos", "inicio", "perfil", "inicio", "perfil"]) {
    if (path === "perfil") await page.getByRole("button", { name: "Abrir perfil" }).filter({ visible: true }).first().click();
    await page.locator(`a[href="/app/${path}"]:visible`).first().click();
    await expect(page).toHaveURL(new RegExp(`/app/${path}$`));
    if (path === "perfil") await expect(page.getByRole("textbox", { name: "Nombre", exact: true })).toHaveValue("Cuenta A");
    if (path === "inicio") await expect(greeting(page)).toContainText("Cuenta A");
  }
  expect(sessions).toBe(1);
});

test("dos pestañas verifican su propia sesión y reutilizan el resultado al abrir Inicio", async ({ page, baseURL }) => {
  const other = await page.context().newPage();
  await other.goto(baseURL + "/login");
  await other.evaluate(owner => localStorage.setItem("paessed-sync-owner", owner), accountA);
  const sessions = [0, 0];
  const tabs = [page, other];
  for (const [index, tab] of tabs.entries()) {
    await enableLocalApp(tab, baseURL);
    await tab.route("**/api/auth/session", route => {
      sessions[index]++;
      return route.fulfill({ json: { configured: true, user: { id: accountA, providers: ["email"] }, profile: { displayName: "Cuenta A" } } });
    });
    await tab.route("**/api/sync?**", route => route.fulfill({ json: emptySync }));
  }
  await Promise.all(tabs.map(tab => tab.goto("/app/ensayos")));
  await Promise.all(tabs.map(async tab => {
    await expect(tab.getByRole("heading", { name: "Tus ensayos" })).toBeVisible();
    await tab.locator('a[href="/app/inicio"]:visible').first().evaluate(link => link.click());
    await expect(greeting(tab)).toContainText("Cuenta A");
  }));
  expect(sessions).toEqual([1, 1]);
});

test("guardar Perfil actualiza la sesión compartida con una sola revalidación", async ({ page, baseURL }) => {
  await enableLocalApp(page, baseURL);
  let sessions = 0;
  let displayName = "Cuenta A";
  await page.route("**/api/auth/session", route => {
    sessions++;
    return route.fulfill({ json: { configured: true, user: { id: accountA, providers: ["email"] }, profile: { displayName } } });
  });
  await page.route("**/api/sync?**", route => route.fulfill({ json: emptySync }));
  await page.route("**/api/auth/profile", route => {
    expect(route.request().headers()["x-paessed-account"]).toBe(accountA);
    displayName = "Nombre confirmado";
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/app/perfil");
  const name = page.getByRole("textbox", { name: "Nombre", exact: true });
  await expect(name).toHaveValue("Cuenta A");
  const opened = sessions;
  await name.fill("Nombre enviado");
  await page.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(name).toHaveValue("Nombre confirmado");
  await page.locator('a[href="/app/inicio"]:visible').first().click();
  await expect(greeting(page)).toContainText("Nombre confirmado");
  expect(sessions - opened).toBe(1);
});

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

test("confirmar el acceso en otra pestaña invalida el perfil anterior antes de la bienvenida", async ({ page, baseURL }) => {
  const session = await openAccounts(page, baseURL);
  await enableLocalApp(session.other, baseURL);
  await session.other.reload();
  await session.other.getByRole("button", { name: "Continuar con correo" }).click();
  await session.other.getByLabel("Correo", { exact: true }).fill("cuenta-b@example.test");
  await session.other.getByLabel("Contraseña", { exact: true }).fill("prueba-1234");
  await page.bringToFront();
  await page.goto("/app/inicio");
  await expect(greeting(page)).toContainText("Cuenta A");
  const next = hold();
  await session.other.route("**/bienvenida", route => route.fulfill({ contentType: "text/html", body: "<title>Bienvenida pendiente</title>" }));
  await session.other.route("**/api/auth/login", route => {
    session.set(accountB, next);
    return route.fulfill({ json: { ok: true, redirect: "/bienvenida" } });
  });
  try {
    await session.other.getByRole("button", { name: "Entrar", exact: true }).evaluate(button => button.form.requestSubmit());
    await expect(session.other).toHaveTitle("Bienvenida pendiente");
    await expect.poll(() => next.requests, { timeout: 3000 }).toBeGreaterThan(0);
    await expect(page.getByRole("heading", { name: "¡Hola!", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Cuenta A/ })).toHaveCount(0);
    session.set(accountB);
    next.release();
    await expect(greeting(page)).toContainText("Cuenta B");
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

test("al volver a la pestaña se oculta la vista anterior aunque aún no haya aviso de cambio", async ({ page, baseURL }) => {
  const session = await openAccounts(page, baseURL);
  await page.goto("/app/inicio");
  await expect(greeting(page)).toContainText("Cuenta A");
  await seedProgress(page);
  await page.reload();
  await expect(history(page)).toContainText(exam.title);
  const next = hold();
  try {
    session.set(accountB, next);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => next.requests).toBeGreaterThan(0);
    await expect(page.getByRole("heading", { name: "¡Hola!", exact: true })).toBeVisible();
    await expect(page.getByText(exam.title, { exact: true })).toBeHidden();
    await expect(page.getByRole("heading", { name: /Cuenta A/ })).toHaveCount(0);
    session.set(accountB);
    next.release();
    await expect(greeting(page)).toContainText("Cuenta B");
    await expect(page.getByText(exam.title, { exact: true })).toHaveCount(0);
  } finally { next.release(); }
});

test("una sesión en memoria se vuelve a verificar al vencer su vigencia", async ({ page, baseURL }) => {
  await page.clock.install();
  const session = await openAccounts(page, baseURL);
  await page.goto("/app/inicio");
  await expect(greeting(page)).toContainText("Cuenta A");
  await seedProgress(page);
  await page.reload();
  await expect(history(page)).toContainText(exam.title);
  session.set(accountA, undefined, 401);
  await page.clock.fastForward(5 * 60_000);
  await expect(page.getByRole("alert").filter({ hasText: "Tu sesión venció" })).toBeVisible();
  await expect(greeting(page)).toHaveText("¡Hola!");
  await expect(history(page)).not.toContainText(exam.title);
});

test("reconectar vuelve a comprobar el propietario y conserva el trabajo local", async ({ page, baseURL }) => {
  const session = await openAccounts(page, baseURL);
  await page.goto("/app/inicio");
  await expect(greeting(page)).toContainText("Cuenta A");
  await seedProgress(page);
  await page.reload();
  await expect(history(page)).toContainText(exam.title);
  const next = hold();
  try {
    await page.context().setOffline(true);
    await expect(history(page)).toContainText(exam.title);
    session.set(accountB, next);
    await page.context().setOffline(false);
    await expect.poll(() => next.requests).toBeGreaterThan(0);
    await expect(page.getByRole("heading", { name: "¡Hola!", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Cuenta A/ })).toHaveCount(0);
    await expect(page.getByText(exam.title, { exact: true })).toBeHidden();
    session.set(accountB);
    next.release();
    await expect(greeting(page)).toContainText("Cuenta B");
    await expect(history(page)).not.toContainText(exam.title);
    await session.select(accountA);
    await expect(history(page)).toContainText(exam.title);
  } finally {
    next.release();
    await page.context().setOffline(false);
  }
});

test("el historial del navegador vuelve a verificar la identidad restaurada", async ({ page, baseURL }) => {
  const session = await openAccounts(page, baseURL);
  await page.goto("/app/inicio");
  await expect(greeting(page)).toContainText("Cuenta A");
  await seedProgress(page);
  await page.reload();
  await expect(history(page)).toContainText(exam.title);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  await expect(greeting(page)).toHaveText("¡Hola!");
  await expect(history(page)).not.toContainText(exam.title);
  session.set(null);
  const request = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/session");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  expect((await (await request).json()).user).toBeNull();
  await expect(greeting(page)).not.toContainText("Cuenta A");
  await expect(history(page)).not.toContainText(exam.title);
});

test("errores de sesión y recargas conservan el almacenamiento sin abrir áreas privadas", async ({ page, baseURL }) => {
  const session = await openAccounts(page, baseURL);
  await page.goto("/app/inicio");
  await expect(greeting(page)).toContainText("Cuenta A");
  await seedProgress(page);
  for (const [code, path] of [[503, "/app/playground"], [401, "/app/perfil"], [503, "/app/aprender"], [503, "/diagnostico/resultado"], [401, "/app/ensayos/resultado"]]) {
    session.set(accountA, undefined, code);
    await page.goto(path);
    await expect(page.getByText(code === 401 ? /Tu sesión venció/ : /No se pudo comprobar tu sesión/).first()).toBeVisible();
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
  await page.evaluate(owner => {
    localStorage.setItem(`paessed-account:${owner}:paessed-last-exam`, JSON.stringify({
      correct: 64, wrong: 1, omitted: 0, secondsLeft: 1800, score: 986,
    }));
  }, accountB);
  await page.reload();
  await expect(score).toHaveText("986 pts");
  await session.select(null);
  await expect(score).toHaveText("711 pts");
  await page.reload();
  await expect(score).toHaveText("711 pts");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("paessed-last-exam")).score)).toBe(998);
});

test("una recarga sin conexión a sesión protege el historial y lo recupera al verificar la cuenta", async ({ page, baseURL }) => {
  const session = await openAccounts(page, baseURL);
  await page.goto("/app/inicio");
  await expect(greeting(page)).toContainText("Cuenta A");
  await seedProgress(page);
  await page.reload();
  await expect(history(page)).toContainText(exam.title);
  session.set(accountA, undefined, "disconnected");
  await page.reload();
  const retry = page.getByRole("button", { name: "Reintentar sesión" });
  await expect(retry).toBeVisible();
  await expect(greeting(page)).toHaveText("¡Hola!");
  await expect(page.getByRole("link", { name: "Hacer un ensayo" }).filter({ visible: true })).toBeVisible();
  await expect(history(page)).not.toContainText(exam.title);
  await expect(page.locator("#tour-progress dd")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("paessed-sync-owner"))).toBe(accountA);
  session.set(accountA);
  await retry.click();
  await expect(greeting(page)).toContainText("Cuenta A");
  await expect(history(page)).toContainText(exam.title);
});

test("un respaldo antiguo elegido en Perfil recupera el resultado demo solo para esa cuenta", async ({ page, baseURL }) => {
  const session = await openAccounts(page, baseURL);
  const result = JSON.stringify({ correct: 61, wrong: 3, omitted: 1, score: 945, secondsLeft: 1000, completedAt: "2026-11-01T12:00:00Z" });
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify({
    format: "paessed-browser-backup", version: 1, createdAt: "2026-11-01T12:00:00Z",
    categories: ["sessions"], items: [{ key: "paessed-last-exam", category: "sessions", value: result }], exams: [],
  }));
  await page.goto("/app/perfil");
  await expect(page.getByTestId("backup-panel")).toHaveAttribute("data-ready", "true");
  await page.locator('input[aria-label="Seleccionar respaldo PAESSED"]').setInputFiles({
    name: "respaldo-demo-v1.zip", mimeType: "application/zip", buffer: await zip.generateAsync({ type: "nodebuffer" }),
  });
  await page.getByRole("button", { name: "Restaurar datos" }).click();
  await page.getByRole("button", { name: "Confirmar restauración" }).click();
  await expect(page.getByText(/Restauración terminada/)).toBeVisible();
  await page.goto("/app/ensayos/resultado");
  const score = page.locator("main h1");
  await expect(score).toHaveText("945 pts");
  await session.select(accountB);
  await expect(score).toHaveText("711 pts");
  await session.select(accountA);
  await expect(score).toHaveText("945 pts");
  expect(await page.evaluate(() => localStorage.getItem("paessed-last-exam"))).toBeNull();
});
