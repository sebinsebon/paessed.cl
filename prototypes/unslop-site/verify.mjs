import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { expect } from "@playwright/test";
import { chromium, devices, webkit } from "playwright";
import { groups } from "./site/screens.mjs";

const site = new URL("./site/", import.meta.url);
const captures = groups.flatMap(([, items]) => items.map(([id]) => id))
  .flatMap(id => ["desktop", "movil"].flatMap(format => ["claro", "oscuro"].flatMap(theme =>
    ["actual", "propuesta"].map(view => `screens/${id}-${format}-${theme}-${view}.webp`))));
const files = new Set([
  ...captures, "index.html", "gallery.css", "gallery.mjs", "screens.mjs",
  "assets/paessed-logo.svg", "assets/plus-jakarta-sans-latin-wght-normal.woff2",
]);
const contentTypes = {
  html: "text/html; charset=utf-8", css: "text/css", mjs: "text/javascript",
  woff2: "font/woff2", svg: "image/svg+xml", webp: "image/webp",
};
const publicUrl = process.argv[2];
const server = publicUrl ? null : createServer(async (request, response) => {
  const file = request.url === "/" ? "index.html" : request.url.slice(1);
  if (!files.has(file)) { response.writeHead(404).end(); return; }
  try {
    const data = await readFile(new URL(file, site));
    response.writeHead(200, { "Content-Type": contentTypes[file.split(".").at(-1)], "Content-Length": data.length });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch {
    response.writeHead(404).end();
  }
});
if (server) await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = publicUrl ?? `http://127.0.0.1:${server.address().port}/`;

try {
  for (const [name, browserType, contextOptions] of [
    ["desktop", chromium, { viewport: { width: 1440, height: 900 } }],
    ["mobile", webkit, devices["iPhone 13"]],
  ]) {
    const browser = await browserType.launch();
    try {
      const context = await browser.newContext(contextOptions);
      const page = await context.newPage();
      const failures = [];
      page.on("pageerror", error => failures.push(error.message));
      assert.equal((await page.goto(base)).status(), 200);
      await expect(page.getByRole("heading", { name: "Portada", exact: true })).toBeVisible();
      const image = page.locator("#capture");
      const restoredWidth = name === "mobile" ? 390 : 1440;
      await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBe(restoredWidth);
      if (name === "mobile") {
        await page.getByLabel("Pantalla", { exact: true }).selectOption("dashboard");
      } else {
        const dashboard = page.getByRole("link", { name: "Inicio · Dashboard", exact: true });
        await dashboard.focus();
        await page.keyboard.press("Enter");
      }
      await expect(page.getByRole("heading", { name: "Inicio · Dashboard", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Actual", exact: true }).click();
      await page.getByRole("button", { name: "Oscuro", exact: true }).click();
      const format = name === "mobile" ? "movil" : "desktop";
      await expect(image).toHaveAttribute("src", `screens/dashboard-${format}-oscuro-actual.webp`);
      await expect.poll(() => image.evaluate((img, width) => img.complete && img.naturalWidth === width, restoredWidth)).toBe(true);
      await page.getByRole("button", { name: name === "mobile" ? "Escritorio" : "Móvil", exact: true }).click();
      await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth)).toBe(name === "mobile" ? 1440 : 390);
      await page.goto(new URL("#playground-practica", base).href);
      await expect(page.getByRole("heading", { name: "Pregunta de Playground", exact: true })).toBeVisible();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(failures, []);

      if (name === "desktop") {
        for (let offset = 0; offset < captures.length; offset += 16) {
          await Promise.all(captures.slice(offset, offset + 16).map(async file => {
            const response = await context.request.head(new URL(file, base).href);
            assert.equal(response.status(), 200, file);
            assert.match(response.headers()["content-type"], /^image\/webp\b/);
          }));
        }
      }

      console.log(`${name}: navegación, diseño, dispositivo, tema y captura verificados`);
    } finally {
      await browser.close();
    }
  }
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
}
