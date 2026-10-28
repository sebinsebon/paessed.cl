const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

test("Perfil measures local categories and removes drawings without touching answers", async ({ page }) => {
  await page.goto("/app/perfil");
  await page.evaluate(() => {
    localStorage.setItem("paessed-imported-essay-progress-v1-test", JSON.stringify({
      index: 1,
      answers: { "0": "A" },
      bookmarks: [1],
      strokes: { "0": [{ color: "#2563eb", points: [{ x: 0.2, y: 0.3 }] }] },
    }));
    localStorage.setItem("paessed-diagnostic", JSON.stringify({ correct: 3, total: 5 }));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Almacenamiento local" })).toBeVisible();
  await expect(page.getByTestId("storage-category-drawings")).toContainText("Dibujos");
  await page.getByTestId("storage-category-drawings").getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByRole("alertdialog", { name: "¿Eliminar estos datos?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("paessed-imported-essay-progress-v1-test")));
  expect(before.strokes["0"]).toHaveLength(1);

  await page.getByTestId("storage-category-drawings").getByRole("button", { name: "Borrar" }).click();
  await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("paessed-imported-essay-progress-v1-test")));
  expect(after.strokes).toEqual({});
  expect(after.answers).toEqual({ "0": "A" });
  expect(after.bookmarks).toEqual([1]);
  await expect(page.getByTestId("storage-category-drawings")).toContainText("0 B");
});

test("Perfil lists stored exam weight and deletes only a confirmed local package", async ({ page }) => {
  await page.goto("/app/ensayos/importar");
  const buffer = fs.readFileSync(path.join(__dirname, "fixtures/tesla-renderer.paessed"));
  await page.locator('input[type="file"]').setInputFiles({ name: "TESLA.paessed", mimeType: "application/zip", buffer });
  await page.getByRole("button", { name: "Importar ensayo", exact: true }).click();
  await page.getByRole("button", { name: "Importado", exact: true }).waitFor();
  await page.goto("/app/perfil");
  await expect(page.getByRole("heading", { name: "Almacenamiento local" })).toBeVisible();
  await expect(page.getByText("ENSAYO TESLA", { exact: true })).toBeVisible();
  const exam = page.getByRole("button", { name: /Eliminar ensayo ENSAYO TESLA/ });
  await exam.click();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(exam).toBeVisible();

  await exam.click();
  await page.getByRole("button", { name: "Eliminar definitivamente" }).click();
  await expect(page.getByText("No tienes ensayos importados en este navegador.")).toBeVisible();
  await expect(page.getByTestId("storage-category-exams")).toContainText("0 B");
});
