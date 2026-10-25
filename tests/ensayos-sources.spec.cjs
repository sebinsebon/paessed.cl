const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

test("Default and Local show separate exam collections", async ({ page }) => {
  await page.goto("/app/ensayos");
  const defaultButton = page.getByRole("button", { name: /^Default\s+\d+$/ });
  const localButton = page.getByRole("button", { name: /^Local\s+\d+$/ });

  await expect(defaultButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Ensayo M1 Invierno 2026" })).toBeVisible();
  await expect(page.getByText("El catálogo Gold está en preparación.")).toBeVisible();

  await localButton.click();
  await expect(localButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Ensayo M1 Invierno 2026" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Aún no tienes ensayos locales" })).toBeVisible();
  await expect(page.getByText("Arrástralo aquí")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /^Local\s+\d+$/ })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/app/ensayos?source=default");
  await expect(page.getByRole("button", { name: /^Default\s+\d+$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Ensayo M1 Invierno 2026" })).toBeVisible();

  await page.goto("/app/ensayos?source=local");
  await expect(page.getByRole("button", { name: /^Local\s+\d+$/ })).toHaveAttribute("aria-pressed", "true");
});

test("the import action opens the local library flow", async ({ page }) => {
  await page.goto("/app/ensayos?source=default");
  await page.getByRole("button", { name: "Importar ensayo" }).click();
  await expect(page.getByRole("button", { name: "Volver a Ensayos" })).toBeVisible();
  await page.getByRole("button", { name: "Volver a Ensayos" }).click();
  await expect(page.getByRole("button", { name: /^Local\s+\d+$/ })).toHaveAttribute("aria-pressed", "true");
});

test("Local details show file weight and progress, then delete only after confirmation", async ({ page }) => {
  await page.goto("/app/ensayos?source=local");
  await page.getByRole("button", { name: "Importar ensayo", exact: true }).first().click();
  const buffer = fs.readFileSync(path.join(__dirname, "fixtures/tesla-renderer.paessed"));
  await page.locator('input[type="file"]').setInputFiles({
    name: "TESLA.paessed", mimeType: "application/zip", buffer,
  });
  await page.getByRole("button", { name: "Importar ensayo", exact: true }).click();
  await page.getByRole("button", { name: "Ver en Mis ensayos", exact: true }).click();

  await page.getByRole("button", { name: /^Detalles/ }).click();
  await expect(page.getByText("Tamaño del archivo")).toBeVisible();
  await expect(page.getByText("Sin iniciar", { exact: true })).toBeVisible();
  await expect(page.getByText("0/65", { exact: true })).toBeVisible();
  const id = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("paessed-local");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const all = database.transaction("imported-exams").objectStore("imported-exams").getAll();
      all.onerror = () => reject(all.error);
      all.onsuccess = () => { resolve(all.result[0].summary.id); database.close(); };
    };
  }));
  await page.evaluate((examId) => localStorage.setItem(
    "paessed-imported-essay-progress-v1-" + examId,
    JSON.stringify({ index: 1, answers: { 0: "A", 1: "B" }, bookmarks: [], strokes: {} }),
  ), id);
  await page.reload();
  await page.getByRole("button", { name: /^Detalles/ }).click();
  await expect(page.getByText("En progreso", { exact: true })).toBeVisible();
  await expect(page.getByText("2/65", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^Eliminar ensayo/ }).click();
  await expect(page.getByRole("alertdialog", { name: "¿Eliminar este ensayo?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("heading", { name: "ENSAYO TESLA" })).toBeVisible();

  await page.getByRole("button", { name: /^Eliminar ensayo/ }).click();
  await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
  await expect(page.getByRole("heading", { name: "Aún no tienes ensayos locales" })).toBeVisible();
  const state = await page.evaluate((examId) => new Promise((resolve, reject) => {
    const request = indexedDB.open("paessed-local");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const item = database.transaction("imported-exams").objectStore("imported-exams").get(examId);
      item.onerror = () => reject(item.error);
      item.onsuccess = () => {
        resolve({ exists: Boolean(item.result), progress: localStorage.getItem("paessed-imported-essay-progress-v1-" + examId) });
        database.close();
      };
    };
  }), id);
  expect(state).toEqual({ exists: false, progress: null });
});
