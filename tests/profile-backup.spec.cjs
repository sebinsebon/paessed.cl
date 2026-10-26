const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const JSZip = require("jszip");

test("Perfil exports only selected slices and restores drawings without replacing answers", async ({ page }) => {
  const key = "paessed-imported-essay-progress-v1-backup-test";
  await page.goto("/app/perfil");
  await page.evaluate((storageKey) => {
    localStorage.setItem(storageKey, JSON.stringify({
      index: 1, answers: { "0": "A" }, bookmarks: [1],
      strokes: { "0": [{ color: "#2563eb", points: [{ x: 0.2, y: 0.3 }] }] },
    }));
  }, key);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Copias de seguridad" })).toBeVisible();

  await page.getByRole("checkbox", { name: "Exportar Respuestas y sesiones" }).uncheck();
  await page.getByRole("checkbox", { name: "Exportar Preguntas marcadas" }).uncheck();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar respaldo" }).click();
  const download = await downloadEvent;
  const archive = fs.readFileSync(await download.path());
  const zip = await JSZip.loadAsync(archive);
  const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
  expect(manifest.format).toBe("paessed-browser-backup");
  expect(manifest.categories).toEqual(["drawings"]);
  expect(manifest.exams).toHaveLength(0);
  expect(manifest.items).toHaveLength(1);
  expect(Object.keys(JSON.parse(manifest.items[0].value))).toEqual(["strokes"]);

  await page.evaluate((storageKey) => {
    localStorage.setItem(storageKey, JSON.stringify({
      index: 2, answers: { "0": "B" }, bookmarks: [2], strokes: {},
    }));
  }, key);
  await page.locator('input[aria-label="Seleccionar respaldo PAESSED"]').setInputFiles({
    name: "PAESSED_respaldo.zip", mimeType: "application/zip", buffer: archive,
  });
  await expect(page.getByTestId("backup-import-preview")).toBeVisible();
  await page.getByRole("button", { name: "Restaurar datos" }).click();
  await expect(page.getByRole("alertdialog", { name: "¿Restaurar esta copia?" })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar restauración" }).click();
  await expect(page.getByText(/Restauración terminada/)).toBeVisible();
  const result = await page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)), key);
  expect(result.answers).toEqual({ "0": "B" });
  expect(result.bookmarks).toEqual([2]);
  expect(result.strokes["0"]).toHaveLength(1);
});

test("Perfil can export and reimport the source archive of a local exam", async ({ page }) => {
  await page.goto("/app/ensayos/importar");
  const buffer = fs.readFileSync(path.join(__dirname, "fixtures/tesla-renderer.paessed"));
  await page.locator('input[type="file"]').setInputFiles({
    name: "TESLA.paessed", mimeType: "application/zip", buffer,
  });
  await page.getByRole("button", { name: "Importar ensayo", exact: true }).click();
  await page.getByRole("button", { name: "Importado", exact: true }).waitFor();
  await page.goto("/app/perfil");
  await expect(page.getByText("ENSAYO TESLA", { exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar respaldo" }).click();
  const archive = fs.readFileSync(await (await downloadEvent).path());
  const zip = await JSZip.loadAsync(archive);
  const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
  expect(manifest.exams).toHaveLength(1);
  expect(manifest.exams[0].archivePath).toBeTruthy();
  expect((await zip.file(manifest.exams[0].archivePath).async("nodebuffer")).length).toBe(buffer.length);

  await page.getByRole("button", { name: "Eliminar ensayo ENSAYO TESLA" }).click();
  await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
  await expect(page.getByText("No tienes ensayos importados en este navegador.")).toBeVisible();

  await page.locator('input[aria-label="Seleccionar respaldo PAESSED"]').setInputFiles({
    name: "PAESSED_respaldo.zip", mimeType: "application/zip", buffer: archive,
  });
  await page.getByRole("button", { name: "Restaurar datos" }).click();
  await page.getByRole("button", { name: "Confirmar restauración" }).click();
  await expect(page.getByText("ENSAYO TESLA", { exact: true })).toBeVisible();
});
