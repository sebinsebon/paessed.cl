import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { chromium, devices, webkit } from "playwright";

const output = new URL("../../out/unslop-m1/", import.meta.url);
const contentTypes = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  svg: "image/svg+xml",
  woff2: "font/woff2",
};
const staticPaths = new Set([
  "/", "/demo.js", "/demo.css", "/assets/paessed-logo.svg", "/assets/trophy.svg",
  "/assets/plus-jakarta-sans-latin-wght-normal.woff2",
]);

const [target, captures] = process.argv.slice(2);
const publicUrl = target === "--local" ? undefined : target;
const headers = JSON.parse(await readFile(new URL("vercel.json", import.meta.url), "utf8")).headers[0].headers;
const server = publicUrl ? null : createServer(async (request, response) => {
  try {
    if (!staticPaths.has(request.url)) {
      response.writeHead(404).end();
      return;
    }
    const path = request.url === "/" ? "index.html" : request.url.slice(1);
    const content = await readFile(new URL(path, output));
    for (const { key, value } of headers) response.setHeader(key, value);
    response.setHeader("Content-Type", contentTypes[path.split(".").at(-1)]);
    response.end(content);
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
});
if (server) await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
if (captures) await mkdir(captures, { recursive: true });
const base = new URL(publicUrl || `http://127.0.0.1:${server.address().port}`);

const formats = [
  { name: "desktop", browserType: chromium, contextOptions: { viewport: { width: 1440, height: 900 } } },
  { name: "mobile", browserType: webkit, contextOptions: devices["iPhone 13"] },
];

try {
  for (const { name, browserType, contextOptions } of formats) {
    const browser = await browserType.launch();
    try {
      const context = await browser.newContext({ ...contextOptions, reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      const requests = [];
      let takingScreenshot = false;
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        // WebKit's screenshot preparation injects a style even without a caret.
        if (takingScreenshot && message.text().startsWith("Refused to apply a stylesheet because its hash")) return;
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("request", request => requests.push(request));

      const initial = await page.goto(base.href);
      assert.equal(initial.status(), 200, `anonymous GET opens the demo at ${base.href} (${initial.url()})`);
      assert.match(initial.headers()["content-security-policy"], /connect-src 'none'/);
      const actual = page.getByRole("button", { name: "Actual", exact: true });
      const proposal = page.getByRole("button", { name: "Propuesta", exact: true });
      const start = page.getByRole("button", { name: "Continuar ensayo" });
      const finish = page.getByRole("button", { name: "Finalizar ensayo", exact: true });
      const correctOption = page.getByRole("radio", { name: /92\.000/ });
      const wrongOption = page.getByRole("radio", { name: /88\.000/ });
      const dialog = page.getByRole("dialog", { name: "¿Finalizar el ensayo?" });

      async function checkWidth() {
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `horizontal overflow on ${name}`);
      }
      async function capture(screen, mode) {
        await checkWidth();
        if (!captures) return;
        takingScreenshot = true;
        await page.screenshot({ path: join(captures, `${mode}-${screen}-${name}.png`), fullPage: true, caret: "initial" });
        takingScreenshot = false;
      }
      async function checkResult({ score, correct, wrong, answer, verdict }) {
        await expect(page.getByRole("heading", { name: `${score} pts`, exact: true })).toBeFocused();
        await expect(page.locator("#right-total")).toHaveText(String(correct));
        await expect(page.locator("#wrong-total")).toHaveText(String(wrong));
        await expect(page.locator("#omitted-total")).toHaveText("0");
        await expect(page.locator("#chosen-answer")).toHaveText(answer);
        await expect(page.locator("#verdict")).toHaveText(verdict);
      }

      await expect(proposal).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("heading", { name: "Tu preparación M1" })).toBeVisible();
      await expect(page.locator("#count-home")).toHaveText("64/65");
      await capture("inicio", "propuesta");
      await actual.click();
      await expect(page.getByRole("heading", { name: /Tu meta es de 780 pts/ })).toBeVisible();
      await capture("inicio", "actual");
      await proposal.click();
      if (name === "desktop") {
        // Real tab traversal from the comparison controls through this screen.
        await page.keyboard.press("Tab");
        await expect(page.getByRole("button", { name: "Reiniciar demo" })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(start).toBeFocused();
        assert.equal(await start.evaluate(button => getComputedStyle(button).outlineStyle), "solid");
        await page.keyboard.press("Enter");
        await expect(page.locator("#question-title")).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(wrongOption).toBeFocused();
        assert.equal(await wrongOption.evaluate(input => getComputedStyle(input.parentElement).outlineStyle), "solid");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("ArrowDown");
      } else {
        await start.tap();
        await correctOption.tap();
      }
      await expect(correctOption).toBeChecked();
      for (const view of [proposal, actual]) {
        await view.click();
        await expect(page.locator("#question-title")).toBeVisible();
        await expect(correctOption).toBeChecked();
        await expect(page.locator("#count-question")).toHaveText("65/65");
        for (const item of await page.locator(".price-figure, .options label").all()) {
          const bounds = await item.boundingBox();
          assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= contextOptions.viewport.width);
        }
        await capture("pregunta", view === actual ? "actual" : "propuesta");
      }
      await page.getByRole("button", { name: "Guardar y salir" }).click();
      await expect(page.locator("#count-home")).toHaveText("65/65");
      await start.click();
      await expect(correctOption).toBeChecked();
      if (name === "desktop") {
        await page.setViewportSize({ width: 390, height: 550 });
        await page.keyboard.press("Tab");
        await expect(correctOption).toBeFocused();
        await page.keyboard.press("ArrowDown");
        const lastOption = page.getByRole("radio", { name: /95\.000/ });
        await expect(lastOption).toBeFocused();
        const lastBounds = await lastOption.boundingBox();
        const finishBounds = await finish.boundingBox();
        assert.ok(lastBounds.y >= 0 && lastBounds.y + lastBounds.height <= Math.min(550, finishBounds.y));
        await page.keyboard.press("ArrowUp");
        await expect(correctOption).toBeChecked();
        await page.setViewportSize(contextOptions.viewport);
        await page.keyboard.press("Tab");
        await expect(finish).toBeFocused();
        await page.keyboard.press("Enter");
      } else {
        await finish.tap();
      }
      await expect(dialog).toBeVisible();
      if (name === "desktop") await page.keyboard.press("Escape");
      else await dialog.getByRole("button", { name: "Seguir revisando" }).tap();
      await expect(dialog).toBeHidden();
      await expect(correctOption).toBeChecked();
      const deliver = dialog.getByRole("button", { name: "Entregar ensayo" });
      if (name === "desktop") {
        await expect(finish).toBeFocused();
        await page.keyboard.press("Enter");
        await page.keyboard.press("Tab");
        await expect(deliver).toBeFocused();
        await page.keyboard.press("Enter");
      } else {
        await finish.tap();
        await deliver.tap();
      }
      await checkResult({ score: 765, correct: 48, wrong: 17, answer: "C · $92.000", verdict: "Correcta" });
      await capture("resultado", "actual");
      await proposal.click();
      await expect(page.locator("#verdict")).toHaveText("Correcta");
      await capture("resultado", "propuesta");
      await page.getByRole("button", { name: "Volver al Inicio" }).click();
      await expect(page.locator("#last-result")).toHaveText("765 pts");
      await page.getByRole("button", { name: "Ver resultado" }).click();
      await expect(page.locator("#score")).toHaveText("765");

      await page.getByRole("button", { name: "Reiniciar demo" }).click();
      await expect(proposal).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("#count-home")).toHaveText("64/65");
      await start.click();
      await expect(correctOption).not.toBeChecked();
      await wrongOption.click();
      await finish.click();
      await dialog.getByRole("button", { name: "Entregar ensayo" }).click();
      await checkResult({ score: 751, correct: 47, wrong: 18, answer: "A · $88.000", verdict: "Incorrecta" });
      await actual.click();
      await expect(page.locator("#verdict")).toHaveText("Incorrecta");
      await checkWidth();

      await page.reload();
      await expect(proposal).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("#count-home")).toHaveText("64/65");
      assert.deepEqual(errors, []);
      for (const request of requests) {
        const url = new URL(request.url());
        assert.equal(url.origin, base.origin, request.url());
        assert.equal(request.method(), "GET", request.url());
        assert.ok(staticPaths.has(url.pathname), request.url());
      }
      assert.equal((await context.request.get(new URL("/app/inicio", base).href)).status(), 404);
      assert.equal((await context.request.get(new URL("/api/account", base).href)).status(), 404);
      console.log(`${name}: comparison, correct/incorrect answers, reset, keyboard or touch and static-only requests verified`);
    } finally {
      await browser.close();
    }
  }
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
}
