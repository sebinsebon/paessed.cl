const { test, expect } = require("@playwright/test");
const { enableLocalApp } = require("./local-app-fixture.cjs");
const catalog = require("../lib/default-catalog.json");

const accountA = "11111111-1111-4111-8111-111111111111";
const accountB = "22222222-2222-4222-8222-222222222222";
const emptySync = {
  revision: 0, generation: 0, catalogRevision: "gold-0.7-sync-1",
  acknowledgements: [], changes: [], conflicts: [], hasMore: false, cursor: 0,
};

function hold() {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  return { pending, release };
}

function account(id) {
  const displayName = id === accountA ? "Cuenta Uno" : "Cuenta Dos";
  return { configured: true, user: { id, email: "piloto@example.test", providers: ["email"] }, profile: { displayName, timezone: "America/Santiago" } };
}

for (const width of [390, 1440]) {
  for (const theme of ["light", "dark"]) {
    test(`Inicio verifica esperas rápidas y lentas a ${width} px en tema ${theme}`, async ({ page, baseURL }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: theme === "dark" ? "reduce" : "no-preference" });
      await enableLocalApp(page, baseURL);
      await page.addInitScript(theme => localStorage.setItem("paessed-theme", theme), theme);
      await page.addInitScript(() => {
        window.loadingFrames = [];
        function record(time) {
          const placeholder = document.querySelector("main [data-loading-placeholder]");
          if (placeholder) {
            const bounds = placeholder.getBoundingClientRect();
            window.loadingFrames.push({
              time, visibility: getComputedStyle(placeholder).visibility,
              x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
            });
          }
          requestAnimationFrame(record);
        }
        requestAnimationFrame(record);
      });
      const identity = hold();
      await page.route("**/api/auth/session", async route => {
        await identity.pending;
        await route.fulfill({ json: account(accountA) });
      });
      await page.route("**/api/sync?**", route => route.fulfill({ json: emptySync }));
      try {
        await page.goto("/app/inicio");
        const nav = page.getByRole("link", { name: "Aprender", exact: true }).filter({ visible: true }).first();
        await expect(nav).toBeVisible();
        const before = await nav.boundingBox();
        const placeholder = page.locator("main [data-loading-placeholder]").first();
        await expect(placeholder).toBeVisible();
        const frames = await page.evaluate(() => window.loadingFrames);
        const first = frames.find(frame => frame.visibility === "hidden");
        const visible = frames.find(frame => frame.visibility === "visible");
        expect(first).toBeDefined();
        expect(visible.time - first.time).toBeGreaterThan(145);
        expect([visible.x, visible.y, visible.width, visible.height]).toEqual([first.x, first.y, first.width, first.height]);
        if (theme === "dark") await expect(placeholder.locator("span").first()).toHaveCSS("animation-name", "none");
        await expect(page.getByRole("heading", { name: /¡Hola/ })).toHaveCount(0);
        await page.screenshot({ path: info.outputPath("inicio-espera.png") });
        identity.release();
        await expect(page.getByRole("heading", { name: /¡Hola, Cuenta Uno!/ })).toBeVisible();
        expect(await nav.boundingBox()).toEqual(before);
        await page.reload();
        await expect(page.getByRole("heading", { name: /¡Hola, Cuenta Uno!/ })).toBeVisible();
        expect(await page.evaluate(() => window.loadingFrames.some(frame => frame.visibility === "visible"))).toBe(false);
      } finally {
        identity.release();
      }
    });
  }
}

test("Actualizar la cuenta conserva el contenido y cambiarla vuelve a cargar el progreso", async ({ page, baseURL }) => {
  await enableLocalApp(page, baseURL);
  let owner = accountA;
  let waitForSync;
  await page.route("**/api/auth/session", route => route.fulfill({ json: account(owner) }));
  await page.route("**/api/sync?**", async route => {
    await waitForSync?.pending;
    await route.fulfill({ json: emptySync });
  });
  await page.goto("/app/inicio");
  const headingA = page.getByRole("heading", { name: /¡Hola, Cuenta Uno!/ });
  await expect(headingA).toBeVisible();
  const before = await headingA.boundingBox();
  waitForSync = hold();
  try {
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    const status = page.getByRole("status").filter({ hasText: "Actualizando tu progreso…" });
    await expect(status).toBeVisible();
    await expect(headingA).toBeVisible();
    expect(await headingA.boundingBox()).toEqual(before);
    waitForSync.release();
    await expect(status).toHaveCount(0);
    owner = accountB;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("heading", { name: /¡Hola, Cuenta Dos!/ })).toBeVisible();
    await expect(headingA).toHaveCount(0);
  } finally {
    waitForSync.release();
  }
});

test("El acceso cambia el texto de inmediato, conserva su ancho y bloquea el segundo envío", async ({ page, baseURL }) => {
  await enableLocalApp(page, baseURL);
  const response = hold();
  let requests = 0;
  await page.route("**/api/auth/login", async route => {
    requests++;
    await response.pending;
    await route.fulfill({ status: 400, json: { error: "Acceso temporalmente en pausa" } });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Continuar con correo" }).click();
  await page.getByLabel("Correo", { exact: true }).fill("piloto@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("prueba-1234");
  const button = page.getByRole("button", { name: "Entrar", exact: true });
  await expect(button).toBeEnabled();
  const before = await button.boundingBox();
  try {
    const result = await button.evaluate(button => {
      const form = button.form;
      form.requestSubmit();
      form.requestSubmit();
      return new Promise(resolve => requestAnimationFrame(() => {
        const indicator = button.querySelector("svg");
        resolve({ disabled: button.disabled, text: button.querySelector("[role=status]").textContent,
          visibility: getComputedStyle(indicator).visibility, delay: getComputedStyle(indicator).animationDelay });
      }));
    });
    expect(result).toMatchObject({ disabled: true, text: "Ingresando…", visibility: "hidden", delay: "0.15s" });
    const busy = page.getByRole("button", { name: "Ingresando…", exact: true });
    await expect(busy.locator("svg")).toBeVisible();
    expect((await busy.boundingBox()).width).toBe(before.width);
    response.release();
    await expect(page.getByRole("alert").filter({ hasText: "Acceso temporalmente en pausa" })).toBeVisible();
    await expect(button).toBeEnabled();
    expect(requests).toBe(1);
  } finally {
    response.release();
  }
});

test("La hoja de Playground conserva el encabezado y vuelve a pedir la pregunta al reintentar", async ({ page, baseURL }, info) => {
  await enableLocalApp(page, baseURL);
  await page.route("**/api/auth/session", route => route.fulfill({ json: { configured: true, user: null } }));
  const response = hold();
  await page.route("**/default/gold/**", async route => {
    await response.pending;
    await route.fulfill({ status: 503, body: "Banco en pausa" });
  });
  const first = catalog.questions.find(question => question.eligible);
  await page.goto("/app/playground");
  await page.getByLabel("Primera pregunta").selectOption(first.id);
  await page.getByRole("button", { name: /Comenzar práctica/ }).click();
  const close = page.getByRole("button", { name: "Guardar y cerrar sesión" }).filter({ visible: true }).first();
  const skeleton = page.locator("[data-loading-placeholder]").first();
  try {
    await expect(skeleton).toBeVisible();
    await expect(page.getByText("Saltar pregunta", { exact: true })).toHaveCount(0);
    const headerPosition = await close.boundingBox();
    await page.screenshot({ path: info.outputPath("playground-pregunta-espera.png") });
    response.release();
    await expect(page.getByRole("alert").filter({ hasText: "No se pudo cargar" })).toBeVisible();
    expect(await close.boundingBox()).toEqual(headerPosition);
    await page.unroute("**/default/gold/**");
    await page.getByRole("button", { name: "Reintentar carga" }).click();
    await expect(page.getByRole("radio").first()).toBeVisible();
    expect(await close.boundingBox()).toEqual(headerPosition);
  } finally {
    response.release();
  }
});
