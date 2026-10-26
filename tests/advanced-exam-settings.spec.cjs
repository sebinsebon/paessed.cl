const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const JSZip = require("jszip");

test("Ensayos starts in Default once, then remembers the last tab across visits", async ({ page }) => {
  await page.goto("/app/ensayos");
  const defaultTab = page.getByRole("button", { name: /^Default\s+\d+$/ });
  const localTab = page.getByRole("button", { name: /^Local\s+\d+$/ });
  await expect(defaultTab).toHaveAttribute("aria-pressed", "true");

  await localTab.click();
  await page.goto("/app/inicio");
  await page.goto("/app/ensayos");
  await expect(localTab).toHaveAttribute("aria-pressed", "true");

  await defaultTab.click();
  await page.reload();
  await expect(defaultTab).toHaveAttribute("aria-pressed", "true");
});

test("advanced question edits require acknowledgement and support exam backup restoration", async ({ page }) => {
  await page.goto("/app/ensayos/importar");
  const fixture = fs.readFileSync(path.join(__dirname, "fixtures/tesla-renderer.paessed"));
  await page.locator('input[type="file"]').setInputFiles({
    name: "TESLA.paessed", mimeType: "application/zip", buffer: fixture,
  });
  await page.getByRole("button", { name: "Importar ensayo", exact: true }).click();
  await page.getByRole("button", { name: "Ver en Mis ensayos", exact: true }).click();
  await page.getByRole("button", { name: /^Detalles/ }).click();
  await page.getByRole("button", { name: /Abrir ajustes del ensayo/ }).click();

  await page.getByRole("button", { name: "Modo avanzado" }).click();
  await expect(page.getByText("¿Activar el modo avanzado?")).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Respaldar y continuar" }).click();
  const zipBytes = fs.readFileSync(await (await downloadEvent).path());
  const archive = await JSZip.loadAsync(zipBytes);
  const manifest = JSON.parse(await archive.file("manifest.json").async("string"));
  expect(manifest.format).toBe("paessed-exam-backup");
  expect(manifest.examId).toBeTruthy();
  expect(archive.file("final.json")).toBeTruthy();
  expect(archive.file("original.bin")).toBeTruthy();

  const editor = page.locator("#exam-advanced-json");
  await expect(editor).toBeVisible();
  const question = JSON.parse(await editor.inputValue());
  question.issues = [...(Array.isArray(question.issues) ? question.issues : []), "ADVANCED_UI_TEST"];
  await editor.fill(JSON.stringify(question, null, 2));
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(/Contenido avanzado guardado/)).toBeVisible();

  await page.getByRole("button", { name: "Respaldos" }).click();
  await page.locator('input[aria-label="Seleccionar respaldo de este ensayo"]').setInputFiles({
    name: "TESLA-respaldo.zip", mimeType: "application/zip", buffer: zipBytes,
  });
  await expect(page.getByText("TESLA-respaldo.zip")).toBeVisible();
  await page.getByRole("button", { name: "Restaurar esta copia" }).click();
  await expect(page.getByRole("alertdialog", { name: "¿Sobrescribir este ensayo?" })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar restauración" }).click();
  await expect(page.getByText(/Respaldo restaurado/)).toBeVisible();

  await page.getByRole("button", { name: "Modo avanzado" }).click();
  await expect(editor).toBeVisible();
  const restored = JSON.parse(await editor.inputValue());
  expect(restored.issues ?? []).not.toContain("ADVANCED_UI_TEST");
});
