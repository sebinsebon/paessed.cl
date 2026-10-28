const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__aiOpened = "";
    window.__aiPrompt = "";
    window.open = (url) => { window.__aiOpened = String(url); return null; };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text) => { window.__aiPrompt = text; } },
    });
  });
});

test("AI help is off by default and can be enabled for both an essay and Playground", async ({ page }) => {
  await page.goto("/app/ensayos/nuevo");
  await expect(page.getByRole("button", { name: "Preguntar a la IA" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ajustes de apariencia de la hoja" }).click();
  await page.getByRole("checkbox", { name: "Activar Preguntar a la IA" }).check();
  await page.getByRole("button", { name: "Cerrar ajustes" }).click();
  await expect(page.getByRole("button", { name: "Preguntar a la IA" })).toBeVisible();
  await page.getByRole("button", { name: "Preguntar a la IA" }).click();
  const promptDialog = page.getByRole("dialog", { name: "Prompt para preguntar a la IA" });
  await expect(promptDialog.getByLabel("Prompt completo + ejercicio")).toHaveValue(/Pregunta 1/);
  await expect(promptDialog.getByLabel("Prompt completo + ejercicio")).toHaveValue(/Alternativas:/);
  await promptDialog.getByRole("button", { name: "Copiar prompt" }).click();
  await expect(promptDialog.getByRole("status")).toContainText("Copiado");
  await promptDialog.getByRole("button", { name: "Abrir ChatGPT" }).click();
  await expect.poll(() => page.evaluate(() => window.__aiOpened)).toBe("https://chatgpt.com/");
  await expect.poll(() => page.evaluate(() => window.__aiPrompt)).toContain("Pregunta 1");
  await expect.poll(() => page.evaluate(() => window.__aiPrompt)).toContain("Alternativas:");
  await promptDialog.getByRole("button", { name: "Cerrar" }).click();

  await page.goto("/app/playground");
  await page.getByRole("button", { name: /Comenzar práctica/ }).click();
  await expect(page.getByRole("button", { name: "Preguntar a la IA" })).toBeVisible();
  await page.getByRole("button", { name: "Preguntar a la IA" }).click();
  const playgroundPrompt = page.getByRole("dialog", { name: "Prompt para preguntar a la IA" });
  await playgroundPrompt.getByLabel("¿Qué IA quieres usar?").selectOption("gemini");
  await expect(playgroundPrompt.getByLabel("Prompt completo + ejercicio")).toHaveValue(/Enunciado:/);
  await playgroundPrompt.getByRole("button", { name: "Copiar prompt" }).click();
  await playgroundPrompt.getByRole("button", { name: "Abrir Gemini" }).click();
  await expect.poll(() => page.evaluate(() => window.__aiOpened)).toBe("https://gemini.google.com/app");
  await expect.poll(() => page.evaluate(() => window.__aiPrompt)).toContain("Enunciado:");
  await playgroundPrompt.getByRole("button", { name: "Cerrar" }).click();
  await page.getByRole("button", { name: "Preguntar a la IA" }).click();
  await expect(playgroundPrompt.getByLabel("¿Qué IA quieres usar?")).toHaveValue("gemini");
});

test("sheet theme is shared between Ensayos and Playground and AI settings show only the switch", async ({ page }) => {
  await page.goto("/app/ensayos/nuevo");
  await page.getByRole("button", { name: "Ajustes de apariencia de la hoja" }).click();
  await page.getByRole("button", { name: "Hoja oscura" }).click();
  await page.goto("/app/playground");
  await page.getByRole("button", { name: /Comenzar práctica/ }).click();
  await page.getByRole("button", { name: "Ajustes de apariencia y filtros de preguntas" }).click();
  await expect(page.getByRole("button", { name: /Hoja oscura/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("checkbox", { name: "Activar Preguntar a la IA" })).toBeVisible();
  await expect(page.getByLabel("Proveedor de IA")).toHaveCount(0);
});

test("an imported exam copies its question without exposing its hidden solution", async ({ page }) => {
  await page.goto("/app/ensayos/importar");
  await page.evaluate(() => localStorage.setItem("paessed-ai-assistance-v1", JSON.stringify({ enabled: true, provider: "claude", customUrl: "" })));
  const buffer = fs.readFileSync(path.join(__dirname, "fixtures/tesla-renderer.paessed"));
  await page.locator('input[type="file"]').setInputFiles({ name: "TESLA.paessed", mimeType: "application/zip", buffer });
  await page.getByRole("button", { name: "Importar ensayo", exact: true }).click();
  await page.getByRole("link", { name: "Ver en Mis ensayos", exact: true }).click();
  await page.getByRole("link", { name: /Practicar: ENSAYO TESLA/ }).click();
  await page.getByRole("button", { name: "Preguntar a la IA" }).click();
  const promptDialog = page.getByRole("dialog", { name: "Prompt para preguntar a la IA" });
  await expect(promptDialog.getByLabel("¿Qué IA quieres usar?")).toHaveValue("claude");
  await expect(promptDialog.getByLabel("Prompt completo + ejercicio")).toHaveValue(/Alternativas:/);
  await promptDialog.getByRole("button", { name: "Copiar prompt" }).click();
  await promptDialog.getByRole("button", { name: "Abrir Claude" }).click();
  await expect.poll(() => page.evaluate(() => window.__aiOpened)).toBe("https://claude.ai/new");
  const prompt = await page.evaluate(() => window.__aiPrompt);
  expect(prompt).toContain("Alternativas:");
  expect(prompt).toContain("Enunciado:");
  expect(prompt).not.toContain("correct_answer");
  expect(prompt).not.toContain("explanation");
});
