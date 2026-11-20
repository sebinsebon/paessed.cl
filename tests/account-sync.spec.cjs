const { test, expect } = require("@playwright/test");
const catalog = require("../lib/default-catalog.json");
const JSZip = require("jszip");
const { enableLocalApp } = require("./local-app-fixture.cjs");
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
test.beforeEach(async ({ page, baseURL }) => { await enableLocalApp(page, baseURL); });
async function readAccount(page, user, store) {
  return page.evaluate(({ user, store }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(user ? `paessed-account-${user}-v3` : "paessed-learning", 1);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction(store); const read = tx.objectStore(store).getAll(); tx.oncomplete = () => { resolve(read.result); db.close(); }; tx.onerror = () => reject(tx.error); };
    request.onerror = () => reject(request.error);
  }), { user, store });
}
test("guest, separate accounts, explicit logout and pending queues stay isolated", async ({ page }) => {
  let user = null;
  await page.route("**/api/auth/session", route => route.fulfill({ json: { configured: true, user: user ? { id: user, email: "piloto@example.test", providers: ["email"] } : null, profile: { displayName: "Piloto", timezone: "America/Santiago" } } }));
  await page.route("**/api/auth/logout", route => {
    expect(route.request().headers()["x-paessed-account"]).toBe(B);
    user = null;
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/sync**", route => route.request().method() === "GET" ? route.fulfill({ json: { revision: 0, generation: 0, catalogRevision: "gold-0.7-sync-1", acknowledgements: [], changes: [], conflicts: [], hasMore: false, cursor: 0 } }) : route.fulfill({ status: 429, headers: { "Retry-After": "3600" }, json: { error: "Cuota temporal" } }));
  await page.goto("/app/perfil");
  await page.getByRole("button", { name: "3 nodos", exact: true }).click();
  await expect.poll(async () => (await readAccount(page, null, "state"))[0]?.goal).toBe(3);
  user = A; await page.reload();
  const importDialog = page.getByRole("dialog", { name: "Tienes progreso en este dispositivo" });
  await expect(importDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "2 nodos", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "1 nodo", exact: true }).click();
  await expect.poll(async () => (await readAccount(page, A, "outbox")).length).toBeGreaterThan(0);
  user = B; await page.reload();
  await expect(importDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "2 nodos", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect((await readAccount(page, A, "state"))[0].goal).toBe(1);
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app/perfil");
  await expect(page.getByRole("button", { name: "3 nodos", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect((await readAccount(page, A, "outbox")).length).toBeGreaterThan(0);
});

test("an open profile keeps the account shown on screen when another tab changes the active account", async ({ page }) => {
  let user = A;
  await page.route("**/api/auth/session", route => route.fulfill({ json: {
    configured: true, user: { id: user, email: "piloto@example.test", providers: ["email"] },
    profile: { displayName: "Cuenta Uno", timezone: "America/Santiago" },
  } }));
  await page.route("**/api/sync**", route => route.fulfill({ json: {
    revision: 0, generation: 0, catalogRevision: "gold-0.7-sync-1", acknowledgements: [], changes: [], conflicts: [], hasMore: false, cursor: 0,
  } }));
  let requestedAccount;
  await page.route("**/api/auth/profile", route => {
    requestedAccount = route.request().headers()["x-paessed-account"];
    return route.fulfill({ status: 409, json: { error: "La cuenta cambió en otra pestaña." } });
  });
  await page.goto("/app/perfil");
  const name = page.getByRole("textbox", { name: "Nombre", exact: true });
  await expect(name).toHaveValue("Cuenta Uno");
  user = B;
  await name.fill("Nombre en la pestaña de la cuenta uno");
  await page.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "La cuenta cambió" })).toBeVisible();
  expect(requestedAccount).toBe(A);
});
test("Playground resumes confirmed answers and sync traffic contains progress references only", async ({ page }) => {
  const traffic = [];
  await page.route("**/api/auth/session", route => route.fulfill({ json: { configured: true, user: { id: A, email: "piloto@example.test", providers: ["email"] }, profile: { displayName: "Piloto", timezone: "America/Santiago" } } }));
  await page.route("**/api/sync**", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { revision: 0, generation: 0, catalogRevision: "gold-0.7-sync-1", acknowledgements: [], changes: [], conflicts: [], hasMore: false, cursor: 0 } });
    traffic.push({ headers: route.request().headers(), body: route.request().postDataJSON() });
    return route.fulfill({ status: 429, headers: { "Retry-After": "3600" }, json: { error: "Cuota temporal" } });
  });
  const question = catalog.questions.find(q => q.eligible);
  await page.goto("/app/playground");
  await page.getByLabel("Primera pregunta").selectOption(question.id);
  await page.getByRole("button", { name: /Comenzar práctica/ }).click();
  await page.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Comprobar respuesta", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar respuesta", exact: true }).click();
  await expect.poll(async () => (await readAccount(page, A, "playground-sessions"))[0]?.confirmed ?? []).toContain(question.id);
  await expect.poll(() => traffic.length).toBeGreaterThan(0);
  for (const request of traffic) {
    expect(request.headers["x-paessed-account"]).toBe(A);
    expect(JSON.stringify(request.body)).not.toMatch(/"(?:strokes|points|stem|explanation|archive|finalJson|fileName|asset_id|password|access_token)"/);
    expect(request.body.operations.every(operation => !Object.hasOwn(operation, "ownerId"))).toBe(true);
  }
  await page.reload();
  await page.getByRole("button", { name: "Continuar práctica", exact: true }).click();
  await expect(page.getByRole("radio").first()).toHaveAttribute("aria-checked", "true");
  expect((await readAccount(page, A, "outbox")).length).toBeGreaterThan(0);
});

test("legacy version 2 backups restore the learning state through the current profile", async ({ page }) => {
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify({ format: "paessed-browser-backup", version: 2, createdAt: "2026-11-01T12:00:00Z", categories: ["learning"], items: [], exams: [],
    learning: { state: { version: 1, learnerId: A, seed: 42, revision: 0, goal: 3, attempts: [], exposures: [], nodes: [], diagnostic: null }, sessions: {} } }));
  await page.goto("/app/perfil");
  await expect(page.getByTestId("backup-panel")).toHaveAttribute("data-ready", "true");
  const input = page.locator('input[aria-label="Seleccionar respaldo PAESSED"]');
  const backup = await zip.generateAsync({ type: "nodebuffer" });
  await input.setInputFiles({ name: "respaldo-incompleto.zip", mimeType: "application/zip", buffer: backup.subarray(0, -12) });
  await expect(page.getByText(/directorio final ausente/)).toBeVisible();
  await expect(page.getByRole("button", { name: "2 nodos", exact: true })).toHaveAttribute("aria-pressed", "true");
  await input.setInputFiles({ name: "respaldo-v2.zip", mimeType: "application/zip", buffer: backup });
  await expect(page.getByTestId("backup-import-preview")).toBeVisible();
  await page.getByRole("button", { name: "Restaurar datos", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar restauración", exact: true }).click();
  await expect(page.getByText(/Restauración terminada/)).toBeVisible();
  await expect(page.getByRole("button", { name: "3 nodos", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/backend-profile.png", fullPage: true });
});
