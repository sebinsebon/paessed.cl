const { test, expect } = require("@playwright/test");
const catalog = require("../lib/default-catalog.json");
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("paessed-dashboard-tour-seen", "1"));
});
async function expectDiagnosticLink(page) {
  await expect(page.getByRole("link", { name: "Hacer diagnóstico", exact: true })).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}

async function seedCompletedDiagnostic(page, database = "paessed-learning", wrongEvery = 0) {
  const units = new Map();
  for (const q of catalog.questions) if (q.eligible && !units.has(q.unitId)) units.set(q.unitId, q);
  await page.evaluate(({questions, database, wrongEvery}) => new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("state", "readwrite"), store = tx.objectStore("state"), read = store.get("current");
      read.onsuccess = () => {
        const state = read.result, at = new Date().toISOString(), id = `${state.learnerId}:diagnostic`;
        const answers = Object.fromEntries(questions.map((q, index) => [q.id, wrongEvery && index % wrongEvery === 0 ? q.correct === "A" ? "B" : "A" : q.correct]));
        state.diagnostic = { id, questionIds: questions.map(q => q.id), answers, startedAt: at, completedAt: at };
        state.attempts = questions.map(q => ({ id: `${id}:${q.id}`, questionId: q.id, sessionId: id, mode: "diagnostic", axisId: q.axisId, unitId: q.unitId, revision: q.revision, answer: answers[q.id], correct: answers[q.id] === q.correct, eligible: true, assisted: false, at }));
        state.exposures = questions.map(q => ({ questionId: q.id, sessionId: id, mode: "diagnostic", at, assisted: false }));
        state.nodes = []; state.revision++; store.put(state, "current");
      };
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  }), {questions: [...units.values()], database, wrongEvery});
}

test("public routes require real accounts while diagnostic remains open", async ({ page, request }) => {
  await page.goto("/app/inicio");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Inicia sesión", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continuar como invitado" })).toHaveCount(0);
  await page.getByRole("button", { name: "Olvidé mi contraseña", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recupera tu acceso" })).toBeVisible();
  await page.goto("/diagnostico");
  await expect(page).toHaveURL(/\/diagnostico$/);
  await expect(page.getByRole("heading", { name: "Diagnóstico M1" })).toBeVisible();
  const response = await request.post("/api/onboarding", { headers: { Origin: new URL(page.url()).origin }, data: {} });
  // An unconfigured local backend returns 503 before an identity can be read.
  expect([401, 503]).toContain(response.status());
  expect(await response.json()).toHaveProperty("error");
});

test("dev bypass requires same-origin server opt-in and isolates browser data", async ({ page, request }) => {
  const denied = await request.post("/api/dev-mode", { headers: { Origin: "https://other.example" }, data: { enabled: true } });
  expect(denied.status()).toBe(403);
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("paessed-theme", "light"));
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/inicio$/);
  await expect(page.getByRole("heading", { name: /¡Hola/ })).toBeVisible();
  await expectDiagnosticLink(page);
  await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).map(db => db.name))).toContain("paessed-dev:paessed-learning");
  const names = await page.evaluate(async () => (await indexedDB.databases()).map(db => db.name));
  expect(names).not.toContain("paessed-learning");
  await page.getByRole("button", { name: "DEV · activo", exact: true }).click();
  await page.getByRole("button", { name: "Salir del modo dev" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => window.__PAESSED_DEV_SANDBOX__)).toBeUndefined();
  await page.goto("/app/aprender");
  await expect(page).toHaveURL(/\/login$/);
});

test("completed guest diagnostic survives the registration boundary", async ({ page }, info) => {
  await page.goto("/diagnostico");
  await expect(page.getByRole("heading", { name: "Diagnóstico M1" })).toBeVisible();
  await seedCompletedDiagnostic(page);
  await page.goto("/diagnostico/resultado");
  await expect(page.getByRole("heading", { name: "Tu punto de partida" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("resultado-light.png"), fullPage: true });
  await page.getByRole("button", { name: "Usar tema oscuro", exact: true }).click();
  await page.screenshot({ path: info.outputPath("resultado-dark.png"), fullPage: true });
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Crea tu cuenta", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/diagnostico\/resultado$/);
  await page.goto("/app/inicio");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/diagnostico/resultado");
  await expect(page.getByRole("heading", { name: "Tu punto de partida" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear cuenta", exact: true })).toBeVisible();
});

test("diagnostic results explain real answers per axis and expand subejes without changing evidence", async ({ page }, info) => {
  await page.goto("/diagnostico");
  await expect(page.getByRole("heading", { name: "Diagnóstico M1", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("diagnostic-intro.png"), fullPage: true });
  await seedCompletedDiagnostic(page, "paessed-learning", 3);
  await page.goto("/diagnostico/resultado");
  await expect(page.getByRole("heading", { name: "Tu punto de partida", exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText("10 de 16");
  await expect(page.getByRole("heading", { name: "Tu mapa de M1", exact: true })).toBeVisible();
  const answers = page.getByRole("list", { name: "Respuestas en Números" });
  await expect(answers.getByRole("listitem")).toHaveCount(3);
  const expand = page.getByRole("button", { name: "Ver subejes de Números", exact: true });
  await expand.click();
  const collapse = page.getByRole("button", { name: "Ocultar subejes de Números", exact: true });
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("heading", { name: "Qué significa", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("diagnostic-map-expanded.png"), fullPage: true });
  await collapse.click();
  await expect(page.getByRole("heading", { name: "Qué significa", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("button", { name: "Usar tema oscuro", exact: true }).click();
  await page.screenshot({ path: info.outputPath("diagnostic-map-mobile-dark.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("declining mastery contribution still unlocks Aprender without repeating diagnosis", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/inicio$/);
  await expect(page.getByRole("heading", { name: /¡Hola/ })).toBeVisible();
  await expectDiagnosticLink(page);
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("paessed-dev:paessed-learning", 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("state", "readwrite"), store = tx.objectStore("state"), read = store.get("current");
      read.onsuccess = () => { const state = read.result; state.initialDiagnostic = { sourceId: "guest:completed-diagnostic", completedAt: new Date().toISOString(), includeEvidence: false }; state.revision++; store.put(state, "current"); };
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
  }));
  await page.goto("/app/aprender");
  await expect(page.getByRole("heading", { name: "Diagnóstico M1" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /diagnóstico/i })).toHaveCount(0);
  await expect(page.getByText("Tu punto de partida", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Ruta de aprendizaje M1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Empezar sesión", exact: true })).toBeVisible();
});

test("landing and account forms fit mobile and desktop without hydration failures", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Ejemplo de tu progreso", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Aprender", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ensayos", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Playground", exact: true })).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Diagnóstico M1", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`), fullPage: true });
    await page.goto("/registro");
    await expect(page.getByRole("heading", { name: "Crea tu cuenta", exact: true })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText("Paessed");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`registro-${width}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});

test("mastery demo moves, pauses and supports keyboard and drag without personal data", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const carousel = page.getByRole("group", { name: "Ejes de Matemática M1; usa las flechas o arrastra" });
  const track = carousel.locator(":scope > div");
  await carousel.scrollIntoViewIfNeeded();
  const position = () => track.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
  const start = await position();
  await expect.poll(async () => Math.abs(await position() - start)).toBeGreaterThan(5);
  await expect(page.getByRole("button", { name: /Pausar carrusel|Eje anterior|Eje siguiente/ })).toHaveCount(0);
  await carousel.hover();
  const paused = await position();
  const samples = await track.evaluate(el => new Promise(resolve => {
    const values = [];
    function frame() { values.push(new DOMMatrixReadOnly(getComputedStyle(el).transform).m41); if (values.length === 12) resolve(values); else requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
  }));
  expect(samples.every(value => Math.abs(value - paused) < 1)).toBe(true);
  await carousel.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => Math.abs(await position() - paused)).toBeGreaterThan(100);
  const beforeDrag = await position(), box = await carousel.boundingBox();
  await page.mouse.move(box.x + 200, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 50, { steps: 12 });
  await page.mouse.up();
  expect(Math.abs(await position() - beforeDrag)).toBeGreaterThan(80);
  const names = await page.evaluate(async () => (await indexedDB.databases()).map(db => db.name));
  expect(names).not.toContain("paessed-learning");
});

async function activateDev(page, destination = "Dashboard") {
  await page.goto("/");
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await page.getByRole("button", { name: destination, exact: true }).click();
  await expect(page.getByRole("button", { name: "DEV · activo", exact: true })).toBeVisible();
  if (destination === "Dashboard") await expectDiagnosticLink(page);
}
async function registerTestAccount(page, email = "estudiante@example.test", name = "Estudiante", reminder = true, destination = /\/app\/inicio$/) {
  await page.goto("/registro");
  await page.getByRole("button", { name: "Continuar con correo", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill(name);
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("never-save-this-password");
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill("never-save-this-password");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page).toHaveURL(destination);
  if (reminder) await expectDiagnosticLink(page);
}
async function devAccountState(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const owner = localStorage.getItem("paessed-dev:active-account");
    const request = indexedDB.open(`paessed-dev:paessed-account-${owner}-v3`, 1);
    request.onsuccess = () => { const db = request.result, tx = db.transaction("state"), read = tx.objectStore("state").get("current"); tx.oncomplete = () => { db.close(); resolve(read.result); }; tx.onerror = () => reject(tx.error); };
    request.onerror = () => reject(request.error);
  }));
}

test("a new account explores Inicio without interruption, then resumes at the next question", async ({ page }, info) => {
  await activateDev(page);
  await registerTestAccount(page);
  await expect(page.getByRole("heading", { name: /¡Hola/ })).toBeVisible();
  await expect(page.locator("#tour-domains")).toBeVisible();
  await expect(page.locator("#tour-exams")).toBeVisible();
  await expect(page.getByText("Sin ensayos rendidos").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("742 pts", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Tu próxima conquista empieza aquí." })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("dashboard-restored.png"), fullPage: true });
  await page.getByRole("link", { name: "Hacer diagnóstico", exact: true }).click();
  await expect(page).toHaveURL(/\/diagnostico$/);
  await expect(page.getByRole("heading", { name: "Diagnóstico M1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Empezar diagnóstico", exact: true }).click();
  await page.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Confirmar y continuar", exact: true }).click();
  await expect(page.getByText(/Diagnóstico · 2 de 16/).first()).toBeVisible();
  await page.goto("/app/inicio");
  await expect(page.getByText("1 de 16 respuestas guardadas en este navegador.")).toBeVisible();
  await page.getByRole("link", { name: "Retomar diagnóstico", exact: true }).click();
  await expect(page.getByText(/Diagnóstico · 2 de 16/).first()).toBeVisible();
  for (let question = 2; question <= 16; question++) {
    await page.getByRole("radio").first().click();
    await page.getByRole("button", { name: "Confirmar y continuar", exact: true }).click();
    if (question < 16) await expect(page.getByText(new RegExp(`Diagnóstico · ${question + 1} de 16`)).first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Guardar y ver resultados", exact: true }).click();
  await expect(page).toHaveURL(/\/diagnostico\/resultado$/);
  await expect(page.getByText("Tus respuestas están guardadas en tu cuenta.")).toBeVisible();
  await page.getByRole("link", { name: "Volver a Inicio", exact: true }).click();
  await expect(page.getByRole("link", { name: "Ver resultado del diagnóstico", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hacer diagnóstico", exact: true })).toHaveCount(0);
});

test("one shared theme defaults to light and survives public routes, dashboard and another tab", async ({ page, context }, info) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.getByRole("button", { name: "Empezar mi diagnóstico" })).toHaveCSS("background-color", "rgb(249, 115, 22)");
  await expect(page.getByText("PREPÁRATE CON UN PLAN.")).toHaveCount(0);
  const hero = page.locator("main");
  const carousel = page.getByRole("region", { name: "Demostración de tu dominio M1" });
  const [heroBox, carouselBox] = await Promise.all([hero.boundingBox(), carousel.boundingBox()]);
  expect(carouselBox.y).toBeLessThan(600);
  expect(carouselBox.x).toBeGreaterThan(heroBox.x + heroBox.width / 3);
  await page.getByRole("button", { name: "Usar tema oscuro", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({ path: info.outputPath("landing-dark.png"), fullPage: true });
  for (const route of ["/registro", "/diagnostico"]) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.screenshot({ path: info.outputPath(`${route.slice(1)}-dark.png`), fullPage: true });
  }
  const other = await context.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: "Usar tema claro", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await other.close();
  await activateDev(page);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.goto("/");
  await page.getByRole("button", { name: "Usar tema oscuro", exact: true }).click();
  await page.goto("/app/inicio");
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("dev starts an actual learning session with no account and an unfinished diagnostic", async ({ page }) => {
  await activateDev(page, "Diagnóstico");
  await expect(page.getByRole("heading", { name: "Diagnóstico M1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Empezar diagnóstico", exact: true }).click();
  await expect.poll(() => page.getByRole("radio").count()).toBeGreaterThan(0);
  await page.goto("/app/aprender");
  await expect(page.getByRole("region", { name: "Ruta de aprendizaje M1" })).toBeVisible();
  await page.getByRole("button", { name: "Empezar sesión", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Comenzar nodo", exact: true }).click();
  await expect.poll(() => page.getByRole("radio").count()).toBeGreaterThan(0);
  const state = await page.evaluate(() => new Promise(resolve => { const r = indexedDB.open("paessed-dev:paessed-learning", 1); r.onsuccess = () => { const d = r.result, t = d.transaction("state"), q = t.objectStore("state").get("current"); t.oncomplete = () => { d.close(); resolve(q.result); }; }; }));
  expect(state.diagnostic.completedAt).toBeUndefined();
  expect(state.initialDiagnostic).toBeUndefined();
  expect(state.nodes.some(node => node.state === "active")).toBe(true);
});

test("dev registration, logout, email login and Google simulation make no remote auth calls", async ({ page }) => {
  const remote = [];
  await activateDev(page, "Registro");
  page.on("request", request => { if (/\/api\/(auth|sync|onboarding)|\/auth\/v1|accounts\.google/.test(request.url())) remote.push(request.url()); });
  await registerTestAccount(page);
  const firstId = await page.evaluate(() => localStorage.getItem("paessed-dev:active-account"));
  await page.goto("/app/perfil");
  await expect(page.getByText("estudiante@example.test", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "3 nodos", exact: true }).click();
  await expect.poll(async () => (await devAccountState(page))?.goal).toBe(3);
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Continuar con correo", exact: true }).click();
  await page.getByLabel("Correo", { exact: true }).fill("estudiante@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("never-save-this-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/inicio$/);
  await expect(page.getByRole("heading", { name: /¡Hola/ })).toBeVisible();
  await expectDiagnosticLink(page);
  expect((await devAccountState(page)).goal).toBe(3);
  await page.goto("/login");
  await page.getByRole("button", { name: "Continuar con Google", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/inicio$/);
  await expect(page.getByRole("heading", { name: /¡Hola/ })).toBeVisible();
  await expectDiagnosticLink(page);
  expect((await devAccountState(page)).goal).toBe(2);
  await page.getByRole("button", { name: "DEV · activo", exact: true }).click();
  await page.getByLabel("Cuenta de prueba", { exact: true }).selectOption(firstId);
  await expect(page.getByRole("heading", { name: /¡Hola/ })).toBeVisible();
  await expectDiagnosticLink(page);
  await expect.poll(async () => (await devAccountState(page))?.goal).toBe(3);
  const saved = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  expect(saved).not.toContain("never-save-this-password");
  expect(remote).toEqual([]);
  await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).map(item => item.name))).not.toContain("paessed-learning");
});

test("unconfigured login can activate test mode directly from its card", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Activar modo de prueba", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continuar con Google", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Continuar con Google", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/inicio$/);
  await expect(page.getByRole("button", { name: "DEV · activo", exact: true })).toBeVisible();
});

test("a new dev account automatically keeps its completed diagnostic", async ({ page }) => {
  await activateDev(page, "Diagnóstico");
  await expect(page.getByRole("heading", { name: "Diagnóstico M1", exact: true })).toBeVisible();
  await seedCompletedDiagnostic(page, "paessed-dev:paessed-learning");
  await page.goto("/diagnostico/resultado");
  await expect(page.getByRole("heading", { name: "Tu punto de partida", exact: true })).toBeVisible();
  await registerTestAccount(page, "estudiante@example.test", "Estudiante", false, /\/diagnostico\/resultado$/);
  const state = await devAccountState(page);
  expect(state.attempts).toHaveLength(16);
  expect(state.initialDiagnostic.includeEvidence).toBe(true);
  await page.goto("/app/aprender");
  await expect(page.getByRole("region", { name: "Ruta de aprendizaje M1" })).toBeVisible();
});

test("an empty account retries its completed guest diagnostic without showing a choice", async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === "current" && value?.initialDiagnostic && sessionStorage.getItem("fail-diagnostic-save")) {
        throw new DOMException("Envío interrumpido", "AbortError");
      }
      return put.call(this, value, key);
    };
  });
  await activateDev(page, "Diagnóstico");
  await expect(page.getByRole("heading", { name: "Diagnóstico M1", exact: true })).toBeVisible();
  await seedCompletedDiagnostic(page, "paessed-dev:paessed-learning");
  await page.evaluate(() => sessionStorage.setItem("fail-diagnostic-save", "1"));
  await page.goto("/registro");
  await page.getByRole("button", { name: "Continuar con correo", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Estudiante");
  await page.getByLabel("Correo", { exact: true }).fill("retry@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("never-save-this-password");
  const confirmation = page.getByLabel("Confirmar contraseña", { exact: true });
  await confirmation.fill("a-different-password");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByText("Las contraseñas no coinciden.", { exact: true })).toBeVisible();
  await expect(confirmation).toBeFocused();
  await confirmation.fill("never-save-this-password");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText("Envío interrumpido");
  await expect(page.getByRole("heading", { name: "¿Sumar este diagnóstico a tu avance?" })).toHaveCount(0);
  await expect(alert).toContainText("respuestas");
  await page.evaluate(() => sessionStorage.removeItem("fail-diagnostic-save"));
  await page.getByRole("button", { name: "Reintentar", exact: true }).dblclick();
  await expect(page).toHaveURL(/\/diagnostico\/resultado$/);
  await expect(page.getByRole("heading", { name: "Tu punto de partida" })).toBeVisible();
  const state = await devAccountState(page);
  expect(state.attempts).toHaveLength(16);
  expect(state.diagnosticHandoffs).toHaveLength(1);
});

for (const include of [true, false]) test(`existing dev account ${include ? "incorporates" : "declines"} diagnostic evidence without resetting progress`, async ({ page }) => {
  await activateDev(page);
  await page.getByRole("button", { name: "DEV · activo", exact: true }).click();
  await page.getByRole("button", { name: "Usar cuenta con progreso", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/inicio$/);
  await expect(page.getByRole("heading", { name: /¡Hola/ })).toBeVisible();
  await expectDiagnosticLink(page);
  const before = await devAccountState(page);
  expect(before.attempts).toHaveLength(16);
  await page.goto("/diagnostico");
  await expect(page.getByRole("heading", { name: "Diagnóstico M1", exact: true })).toBeVisible();
  await seedCompletedDiagnostic(page, "paessed-dev:paessed-learning");
  await page.goto("/diagnostico/resultado");
  await page.getByRole("link", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "¿Sumar este diagnóstico a tu avance?", exact: true })).toBeVisible();
  await page.getByRole("button", { name: include ? "Sí, incorporar respuestas" : "No, mantener mi dominio actual", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/inicio$/);
  const after = await devAccountState(page);
  expect(after.attempts.slice(0, before.attempts.length)).toEqual(before.attempts);
  expect(after.attempts).toHaveLength(include ? 32 : 16);
  expect(after.initialDiagnostic.includeEvidence).toBe(include);
  await page.goto("/app/aprender");
  await expect(page.getByRole("region", { name: "Ruta de aprendizaje M1" })).toBeVisible();
});

test("landing opens account dialogs, explains the diagnostic and resumes it after registering", async ({ page }, info) => {
  await activateDev(page);
  await page.goto("/");
  await expect(page.getByText("Escribe sobre la pregunta", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Ya tengo cuenta", exact: true }).click();
  const login = page.getByRole("dialog", { name: "Inicia sesión", exact: true });
  await expect(login).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await login.getByRole("button", { name: "Más tarde", exact: true }).click();
  const start = page.getByRole("button", { name: "Empezar mi diagnóstico", exact: true });
  await start.click();
  const register = page.getByRole("dialog", { name: "Crea tu cuenta", exact: true });
  await expect(register).toContainText("16 preguntas");
  await expect(register).toContainText("guardar tu punto de partida");
  await expect(page.locator("#auth-title")).toBeFocused();
  await register.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Inicia sesión", exact: true })).toContainText("16 preguntas");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.screenshot({ path: info.outputPath("auth-diagnostic-modal.png") });
  await register.getByRole("button", { name: "Continuar con correo", exact: true }).click();
  await register.getByLabel("Nombre", { exact: true }).fill("Mi cuenta");
  await register.getByLabel("Correo", { exact: true }).fill("modal@example.test");
  await register.getByLabel("Contraseña", { exact: true }).fill("never-store-password");
  await register.getByLabel("Confirmar contraseña", { exact: true }).fill("never-store-password");
  await register.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page).toHaveURL(/\/diagnostico$/);
  await expect(page.getByRole("heading", { name: "Diagnóstico M1", exact: true })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Mi perfil, Mi cuenta", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir al dashboard", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Mi perfil, Mi cuenta", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/perfil$/);
});

test("login stays centered, has a back link and copyright at the bottom left", async ({ page }, info) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    const card = page.locator('section[aria-labelledby="auth-title"]');
    const box = await card.boundingBox(), footer = await page.getByRole("contentinfo").boundingBox();
    const canvasWidth = await page.evaluate(() => document.body.getBoundingClientRect().width);
    expect(Math.abs(box.x + box.width / 2 - canvasWidth / 2)).toBeLessThan(2);
    expect(Math.abs(box.y + box.height / 2 - 450)).toBeLessThan(2);
    expect(footer.y + footer.height).toBe(900);
    expect(footer.x).toBeLessThan(40);
    await page.screenshot({ path: info.outputPath(`login-centered-${width}.png`) });
    await page.getByRole("link", { name: "Volver", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  }
});

test("the diagnostic link leaves other Inicio actions available on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await activateDev(page);
  const start = page.getByRole("link", { name: "Hacer diagnóstico", exact: true });
  await expect(start).toBeInViewport();
  await start.focus();
  await page.keyboard.press("Tab");
  await expect(start).not.toBeFocused();
  await page.getByRole("link", { name: "Hacer un ensayo", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/app\/ensayos$/);
});

async function prepareGuestImport(page) {
  await activateDev(page);
  await page.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open("paessed-dev:paessed-learning", 1);
    r.onsuccess = () => { const db = r.result, tx = db.transaction("state", "readwrite"), store = tx.objectStore("state"), get = store.get("current"); get.onsuccess = () => { const s = get.result; s.goal = 3; s.revision++; store.put(s, "current"); }; tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
  }));
  await registerTestAccount(page, "import@example.test", "Importar", false);
  const progress = page.getByRole("dialog", { name: "Tienes progreso en este dispositivo", exact: true });
  await expect(progress).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: "Nos falta tu punto de partida" })).toHaveCount(0);
  return progress;
}

test("progress choices require reading time, expire unchanged, then confirmation precedes diagnostic", async ({ page }, info) => {
  const progress = await prepareGuestImport(page);
  await page.clock.install();
  await progress.getByRole("button", { name: "No guardar", exact: true }).click();
  await expect(progress.getByRole("button", { name: "CONFIRMAR EN 5 S", exact: true })).toBeDisabled();
  await page.clock.fastForward(5000);
  await expect(progress.getByRole("button", { name: "CONFIRMAR", exact: true })).toBeEnabled();
  await expect(progress.getByRole("button", { name: "CONFIRMAR", exact: true })).toHaveCSS("background-color", "rgb(185, 28, 28)");
  await page.clock.fastForward(5000);
  await expect(progress).toContainText("No se hizo ningún cambio");
  await expect(progress.getByRole("button", { name: "No guardar", exact: true })).toBeVisible();
  await progress.getByRole("button", { name: "No guardar", exact: true }).click();
  await page.clock.fastForward(5000);
  await page.screenshot({ path: info.outputPath("progress-confirm.png") });
  await progress.getByRole("button", { name: "CONFIRMAR", exact: true }).click();
  await expect(progress).toHaveCount(0);
  await expectDiagnosticLink(page);
  await page.reload();
  await expectDiagnosticLink(page);
  await expect(progress).toHaveCount(0);
});

test("deferring progress keeps originals and asks again on another visit without shifting the shell", async ({ page }, info) => {
  const progress = await prepareGuestImport(page);
  await page.clock.install();
  await page.screenshot({ path: info.outputPath("progress-import-modal.png") });
  await progress.getByRole("button", { name: "Más tarde", exact: true }).click();
  await page.clock.fastForward(5000);
  await progress.getByRole("button", { name: "CONFIRMAR", exact: true }).click();
  await expectDiagnosticLink(page);
  await page.goto("/app/ensayos");
  await expect(page.getByRole("heading", { name: "Tus ensayos", exact: true })).toBeVisible();
  const shellHeader = page.locator("header").first();
  expect((await shellHeader.boundingBox()).y).toBeLessThan(20);
  await page.reload();
  await expect(progress).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
});

test("conflicting versions are reviewed before import and diagnosis, with no write until confirmed", async ({ page }) => {
  await prepareGuestImport(page);
  const conflict = { id: "ui-versions", kind: "learning", resolved: false, current: { type: "learning" }, alternative: { type: "learning" } };
  await page.evaluate(conflict => new Promise((resolve, reject) => {
    const owner = localStorage.getItem("paessed-dev:active-account"), r = indexedDB.open(`paessed-dev:paessed-account-${owner}-v3`, 1);
    r.onsuccess = () => { const db = r.result, tx = db.transaction("conflicts", "readwrite"); tx.objectStore("conflicts").put(conflict, conflict.id); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
  }), conflict);
  const resolutions = [];
  await page.route("**/api/sync/conflicts/ui-versions/resolve", route => {
    resolutions.push(route.request().postDataJSON());
    return route.fulfill({ json: { revision: 1, generation: 0, catalogRevision: "gold-0.7-sync-1", acknowledgements: [], changes: [], conflicts: [{ ...conflict, resolved: true }], hasMore: false, cursor: 1 } });
  });
  await page.reload();
  const versions = page.getByRole("dialog", { name: "Hay dos versiones de tu progreso", exact: true });
  await expect(versions).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: "Tienes progreso en este dispositivo", exact: true })).toHaveCount(0);
  await versions.getByText("Comparar versiones", { exact: true }).click();
  await expect(versions.getByText("Tu cuenta:", { exact: true })).toBeVisible();
  await page.clock.install();
  await versions.getByRole("button", { name: "No guardar", exact: true }).click();
  expect(resolutions).toEqual([]);
  await page.clock.fastForward(5000);
  await versions.getByRole("button", { name: "CONFIRMAR", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Tienes progreso en este dispositivo", exact: true })).toBeVisible();
  expect(resolutions).toEqual([{ choice: "current" }]);
  await expect(page.locator("dialog[open]")).toHaveCount(1);
});
