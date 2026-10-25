const { test, expect } = require("@playwright/test");

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
