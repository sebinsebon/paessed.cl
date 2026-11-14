// Captures the integrated application in an isolated browser using E2E state.
// Never writes to the user's browser profile or application data.
const { chromium } = require("playwright");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      storageState: path.resolve("tests/test-results/learning-ui/learning-ui-real-diagnosti-4ec0d-ection-resume-and-earned-XP-chromium/learning-state.json"),
      viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3100/app/aprender");
    await page.getByTestId("learning-route").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(__dirname, "app-ruta-desktop.png"), fullPage: true });
    await page.locator('[data-testid="learning-route-node"][data-state="current"]').click();
    await page.getByRole("button", { name: "Comenzar nodo", exact: true }).click();
    await page.getByRole("radio").first().waitFor();
    await page.getByRole("button", { name: "Ajustes de apariencia de la hoja", exact: true }).click();
    await page.getByRole("button", { name: "Hoja clara", exact: true }).click();
    await page.screenshot({ path: path.join(__dirname, "app-pregunta-desktop.png") });
    await page.getByRole("button", { name: "Guardar y cerrar sesión", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Abrir perfil", exact: true }).click();
    await page.getByRole("button", { name: "Cambiar a tema oscuro", exact: true }).click();
    await page.getByRole("button", { name: "Cerrar perfil", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(__dirname, "app-ruta-mobile.png"), fullPage: true });
    await page.locator('[data-testid="learning-route-node"][data-state="current"]').click();
    await page.getByRole("button", { name: "Retomar sesión", exact: true }).click();
    await page.getByRole("radio").first().waitFor();
    await page.getByRole("button", { name: "Ajustes de apariencia de la hoja", exact: true }).click();
    await page.getByRole("button", { name: "Hoja oscura", exact: true }).click();
    await page.screenshot({ path: path.join(__dirname, "app-pregunta-mobile.png") });
    console.log("Captured four views of the integrated application; no user profile modified.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
