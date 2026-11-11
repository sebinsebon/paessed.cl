const { test, expect } = require("@playwright/test");
const catalog = require("../lib/default-catalog.json").questions;

async function readState(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("paessed-learning", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("state").objectStore("state").get("current");
      read.onerror = () => reject(read.error);
      read.onsuccess = () => { resolve(read.result); db.close(); };
    };
  }));
}
async function choose(page, id, correct = true) {
  const meta = catalog.find((question) => question.id === id);
  if (!meta) throw new Error(`Unknown catalog question ${id}`);
  const letter = correct ? meta.correct : meta.correct === "A" ? "B" : "A";
  await expect(page.getByTestId("learning-paper-stem")).toHaveAttribute("data-question-id", id);
  const radio = page.getByRole("radio").nth(letter.charCodeAt(0) - 65);
  await expect(radio).toBeVisible();
  if (await radio.getAttribute("aria-checked") !== "true" || await radio.getAttribute("data-answer-status") !== "neutral") await radio.click();
  await expect(radio).toHaveAttribute("aria-checked", "true");
}
async function noHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

async function answerFeedback(page, id, correct) {
  const meta = catalog.find(question => question.id === id);
  const green = page.getByRole("radio").nth(meta.correct.charCodeAt(0) - 65);
  await expect(green).toHaveAttribute("data-answer-status", "correct");
  const greenColor = await green.evaluate(el => getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number));
  expect(greenColor[1]).toBeGreaterThan(greenColor[0]);
  await expect(page.locator('[role="radio"][data-answer-status="correct"]')).toHaveCount(1);
  await expect(page.locator('[role="radio"][data-answer-status="incorrect"]')).toHaveCount(correct ? 0 : 1);
  if (!correct) {
    const wrongLetter = meta.correct === "A" ? "B" : "A";
    const red = page.getByRole("radio").nth(wrongLetter.charCodeAt(0) - 65);
    await expect(red).toHaveAttribute("data-answer-status", "incorrect");
    await expect(red).toHaveAttribute("aria-checked", "true");
    const redColor = await red.evaluate(el => getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number));
    expect(redColor[0]).toBeGreaterThan(redColor[1]);
  }
}

async function openCurrentNode(page, resume = false) {
  await page.locator('[data-testid="learning-route-node"][data-state="current"]').click();
  await page.getByRole("button", { name: resume ? "Retomar sesión" : "Comenzar nodo", exact: true }).click();
  const session = page.getByTestId("learning-session");
  await expect(session).toBeVisible();
  await expect.poll(() => session.evaluate(el => {
    const r = el.getBoundingClientRect();
    return Math.abs(r.x) < 1 && Math.abs(r.y) < 1 && Math.abs(r.width - innerWidth) < 1 && Math.abs(r.height - innerHeight) < 1;
  })).toBe(true);
  await expect(page.locator(".paessed-mobile-nav")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abrir perfil", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("learning-session-actions")).toBeInViewport();
  await expect(page.getByRole("radio").first()).toBeVisible();
  const sheetGeometry = await page.getByTestId("learning-paper-stem").evaluate(el => ({ left: el.getBoundingClientRect().left, radius: getComputedStyle(el.closest("article")).borderRadius, viewport: innerWidth }));
  expect(sheetGeometry.radius).toBe("0px");
  // PAESSED's spacing scale is configurable; the sheet must stay near the edge,
  // rather than returning to the centered learning card.
  expect(sheetGeometry.left).toBeLessThanOrEqual(sheetGeometry.viewport * 0.07);
  await expect(page.getByRole("button", { name: page.viewportSize().width <= 767 ? "Abrir menú de la pregunta" : "Ajustes de apariencia de la hoja", exact: true })).toBeInViewport();
}

test("real diagnostic, original 3/5, correction, resume and earned XP", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.__learningAiOpened = "";
    window.__learningAiPrompt = "";
    window.open = url => { window.__learningAiOpened = String(url); return null; };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.__learningAiPrompt = text; } } });
  });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/app/aprender");
  await expect(page.getByRole("heading", { name: "Prepara tu ruta de M1" })).toBeVisible();
  await page.getByRole("button", { name: /^5 preguntas/ }).click();
  await page.getByRole("button", { name: "Continuar al diagnóstico" }).click();
  await expect(page).toHaveURL(/\/diagnostico$/);
  for (let index = 0; index < 16; index++) {
    const state = await readState(page);
    const id = state.diagnostic.questionIds[index];
    await choose(page, id, index % 3 !== 0);
    await expect(page.getByText("Alternativa correcta:", { exact: false })).toHaveCount(0);
    await page.getByRole("button", { name: "Confirmar y continuar" }).click();
    await expect.poll(async () => Object.keys((await readState(page)).diagnostic.answers).length).toBe(index + 1);
    if (index === 2) {
      await page.reload();
      await expect(page.getByRole("heading", { name: "Retoma donde quedaste." })).toBeVisible();
      await page.getByRole("button", { name: "Continuar diagnóstico" }).click();
    }
  }
  await page.getByRole("button", { name: "Ver mi diagnóstico" }).click();
  await expect(page).toHaveURL(/\/diagnostico\/resultado$/);
  await expect(page.getByRole("heading", { name: "Este es tu punto de partida." })).toBeVisible();
  await expect(page.getByText("Lectura provisional", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("learning-diagnostic-result.png"), fullPage: true });
  const afterDiagnostic = await readState(page);
  expect(afterDiagnostic.attempts.filter((attempt) => attempt.mode === "diagnostic")).toHaveLength(16);
  expect(new Set(afterDiagnostic.attempts.map((attempt) => attempt.unitId)).size).toBe(16);
  await page.getByRole("link", { name: "Comenzar mi ruta" }).click();
  await expect(page.getByRole("heading", { name: "Aprender", exact: true })).toBeVisible();
  await expect(page.getByTestId("learning-route-node")).toHaveCount(7);
  await page.screenshot({ path: testInfo.outputPath("learning-desktop-light.png"), fullPage: true });
  const beforePreview = await readState(page);
  await page.locator('[data-testid="learning-route-node"][data-state="future"]').first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("learning-session")).toHaveCount(0);
  await page.keyboard.press("Escape");
  expect((await readState(page)).nodes).toEqual(beforePreview.nodes);
  await openCurrentNode(page);
  await page.screenshot({ path: testInfo.outputPath("learning-session-desktop.png"), fullPage: true });
  let current = (await readState(page)).nodes.find((node) => node.state === "active");
  const firstNodeId = current.id;
  await page.getByRole("button", { name: "Guardar esta pregunta", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("paessed-playground-saved-questions") || "[]"))).toContain(current.questionIds[0]);
  await page.getByRole("button", { name: "Quitar pregunta de guardadas", exact: true }).click();
  await page.getByRole("button", { name: "Abrir mapa de preguntas", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Mapa de preguntas del nodo", exact: true })).toContainText("0/5 respondidas");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Ajustes de apariencia de la hoja", exact: true }).click();
  await page.getByRole("button", { name: "Hoja oscura", exact: true }).click();
  await expect.poll(() => page.getByTestId("learning-session").evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(17, 24, 39)");
  // The preference must also be honored by the original Ensayos viewer.
  const essay = await page.context().newPage();
  await essay.goto("/app/ensayos/nuevo");
  await essay.getByRole("button", { name: "Ajustes de apariencia de la hoja", exact: true }).click();
  await expect(essay.getByRole("button", { name: "Hoja oscura", exact: true })).toHaveAttribute("aria-pressed", "true");
  await essay.close();
  await page.getByRole("button", { name: "Abrir menú de la pregunta", exact: true }).click();
  await page.getByRole("button", { name: "Lápiz sobre la pregunta", exact: true }).click();
  await page.getByRole("button", { name: "Color de tinta #e11d48", exact: true }).click();
  await page.getByRole("button", { name: "Listo, dibujar", exact: true }).click();
  await expect(page.getByRole("radio").first()).toBeDisabled();
  const canvas = page.locator("canvas");
  const canvasBox = await canvas.boundingBox();
  await page.mouse.move(canvasBox.x + 35, canvasBox.y + 35);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 80, canvasBox.y + 60, { steps: 5 });
  await page.mouse.up();
  const inkKey = `paessed-learning-ink:${firstNodeId}:${current.questionIds[0]}`;
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{"strokes":[]}').strokes.length, inkKey)).toBe(1);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).strokes[0].color, inkKey)).toBe("#e11d48");
  await expect(page.getByRole("dialog", { name: "Herramientas de dibujo", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir menú de la pregunta", exact: true }).click();
  await page.getByRole("button", { name: "Lápiz sobre la pregunta", exact: true }).click();
  await page.getByRole("button", { name: "Deshacer último trazo", exact: true }).click();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{"strokes":[]}').strokes.length, inkKey)).toBe(0);
  await page.getByRole("button", { name: "Listo, dibujar", exact: true }).click();
  await page.mouse.move(canvasBox.x + 35, canvasBox.y + 35);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 80, canvasBox.y + 60, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{"strokes":[]}').strokes.length, inkKey)).toBe(1);
  await page.getByRole("button", { name: "Guardar y cerrar sesión" }).click();
  await openCurrentNode(page, true);
  await expect.poll(() => page.getByTestId("learning-session").evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(17, 24, 39)");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{"strokes":[]}').strokes.length, inkKey)).toBe(1);
  for (let index = 0; index < 5; index++) {
    current = (await readState(page)).nodes.find((node) => node.id === firstNodeId);
    await choose(page, current.questionIds[index], index < 3);
    await expect(page.locator('[role="radio"][data-answer-status="correct"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Preguntar a la IA", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: page.viewportSize().width <= 767 ? "Comprobar" : "Confirmar respuesta", exact: true }).click();
    await expect.poll(async () => Object.keys((await readState(page)).nodes.find((node) => node.id === firstNodeId).answers).length).toBe(index + 1);
    await expect(page.getByText("Alternativa correcta:", { exact: false })).toHaveCount(0);
    await answerFeedback(page, current.questionIds[index], index < 3);
    await expect(page.getByRole("button", { name: "Preguntar a la IA", exact: true })).toHaveCount(index < 3 ? 0 : 1);
    if (index === 3) {
      const originalAttempt = (await readState(page)).attempts.find(attempt => attempt.questionId === current.questionIds[index] && attempt.sessionId === firstNodeId);
      await page.getByRole("button", { name: "Preguntar a la IA", exact: true }).click();
      const ai = page.getByRole("dialog", { name: "Prompt para preguntar a la IA", exact: true });
      await expect(ai).toBeVisible();
      await expect(ai.getByLabel("Prompt completo + ejercicio", { exact: true })).toHaveValue(/Enunciado:/);
      await expect(ai.getByLabel("Prompt completo + ejercicio", { exact: true })).not.toHaveValue(/Alternativa correcta:/);
      await ai.getByLabel("¿Qué IA quieres usar?", { exact: true }).selectOption("gemini");
      await ai.getByRole("button", { name: "Copiar prompt", exact: true }).click();
      expect(await page.evaluate(() => window.__learningAiPrompt)).toContain("Alternativas:");
      await ai.getByRole("button", { name: "Abrir Gemini", exact: true }).click();
      expect(await page.evaluate(() => window.__learningAiOpened)).toBe("https://gemini.google.com/app");
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("paessed-ai-assistance-v1")))).toMatchObject({ enabled: false, provider: "gemini" });
      await ai.getByRole("button", { name: "Cerrar", exact: true }).click();
      await expect(page.getByRole("button", { name: "Preguntar a la IA", exact: true })).toBeFocused();
      await expect.poll(async () => (await readState(page)).exposures.find(exposure => exposure.questionId === current.questionIds[index] && exposure.sessionId === firstNodeId)?.assisted).toBe(true);
      expect((await readState(page)).attempts.find(attempt => attempt.id === originalAttempt.id)).toEqual(originalAttempt);
      await page.setViewportSize({ width: 390, height: 844 });
      await noHorizontalOverflow(page);
      await expect(page.getByRole("button", { name: "Preguntar a la IA", exact: true })).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath("learning-ai-after-error-mobile.png"), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: testInfo.outputPath("learning-feedback-wrong-dark.png"), fullPage: true });
      await page.getByRole("button", { name: "Ajustes de apariencia de la hoja", exact: true }).click();
      await page.getByRole("button", { name: "Hoja clara", exact: true }).click();
      await answerFeedback(page, current.questionIds[index], false);
      await page.screenshot({ path: testInfo.outputPath("learning-feedback-wrong-light.png"), fullPage: true });
      await page.getByRole("button", { name: "Ajustes de apariencia de la hoja", exact: true }).click();
      await page.getByRole("button", { name: "Hoja oscura", exact: true }).click();
    }
    if (index === 1) {
      const saved = await readState(page);
      expect(saved.exposures.filter((exposure) => exposure.sessionId === firstNodeId)).toHaveLength(2);
      await page.reload();
      await openCurrentNode(page, true);
    } else {
      await page.getByRole("button", { name: index === 4 ? "Ver mi resultado" : "Siguiente pregunta", exact: true }).click();
    }
  }
  await expect(page.getByRole("heading", { name: "Ahora viene el aprendizaje." })).toBeVisible();
  await expect(page.getByText("correctas en tus respuestas originales", { exact: true })).toBeVisible();
  current = (await readState(page)).nodes.find((node) => node.id === firstNodeId);
  expect(current.originalCorrect).toBe(3);
  await page.getByRole("button", { name: "Corregir mis errores" }).click();
  await expect(page.getByRole("button", { name: "Preguntar a la IA", exact: true })).toBeVisible();
  const errorIds = Object.keys(current.corrections);
  for (let retry = 0; retry < 2; retry++) {
    await choose(page, errorIds[0], false);
    await page.getByRole("button", { name: "Confirmar nuevo intento" }).click();
    await expect.poll(async () => (await readState(page)).nodes.find((node) => node.id === firstNodeId).corrections[errorIds[0]].tries).toBe(retry + 1);
    await answerFeedback(page, errorIds[0], false);
  }
  await expect(page.getByText("Alternativa correcta:", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Revisé la solución" }).click();
  await choose(page, errorIds[1], true);
  await page.getByRole("button", { name: "Confirmar nuevo intento" }).click();
  await answerFeedback(page, errorIds[1], true);
  await page.getByRole("button", { name: "Ver mi resultado", exact: true }).click();
  await page.getByRole("button", { name: "Completar nodo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "¡Nodo completado!" })).toBeVisible();
  const completed = (await readState(page)).nodes.find((node) => node.id === firstNodeId);
  expect(completed.originalCorrect).toBe(3);
  expect(completed.corrections[errorIds[0]].viaSolution).toBe(true);
  expect(completed.corrections[errorIds[1]].viaSolution).toBe(false);
  const earned = (await readState(page)).attempts.filter((attempt) => attempt.sessionId === firstNodeId && attempt.eligible && !attempt.assisted).length * 5;
  expect(completed.xp).toBe(earned);
  await page.getByRole("button", { name: "Volver a mi ruta" }).click();
  await page.context().storageState({ path: testInfo.outputPath("learning-state.json"), indexedDB: true });
  for (const width of [768, 430, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await noHorizontalOverflow(page);
    const nodesFit = await page.getByTestId("learning-route-node").evaluateAll(nodes => nodes.every(node => {
      const rect = node.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    }));
    expect(nodesFit).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir perfil", exact: true }).click();
  await page.getByRole("button", { name: "Cambiar a tema oscuro", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar perfil", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await noHorizontalOverflow(page);
  await expect(page.getByTestId("learning-route-node")).toHaveCount(7);
  await expect(page.locator('[data-testid="learning-route-node"][data-state="completed"]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("learning-mobile-dark.png"), fullPage: true });
  await page.getByRole("button", { name: "Mapa M1", exact: true }).click();
  await expect(page.getByText("En calibración", { exact: false }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await openCurrentNode(page);
  await page.screenshot({ path: testInfo.outputPath("learning-session-mobile-dark.png"), fullPage: true });
  const secondNode = (await readState(page)).nodes.find((node) => node.state === "active");
  for (let index = 0; index < 5; index++) {
    await expect(page.getByRole("radio").first()).toBeVisible();
    if (index === 0) {
      await page.getByRole("radio").first().focus();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("radio").nth(1)).toHaveAttribute("aria-checked", "true");
      await expect(page.getByRole("radio").nth(1)).toBeFocused();
    }
    await choose(page, secondNode.questionIds[index], true);
    await noHorizontalOverflow(page);
    await page.getByRole("button", { name: "Comprobar", exact: true }).click();
    await answerFeedback(page, secondNode.questionIds[index], true);
    await page.getByRole("button", { name: index === 4 ? "Ver resultado" : "Continuar", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "¡Nodo completado!" })).toBeVisible();
  expect((await readState(page)).nodes.find((node) => node.id === secondNode.id).originalCorrect).toBe(5);
  await page.screenshot({ path: testInfo.outputPath("learning-perfect-mobile-dark.png"), fullPage: true });
  expect(browserErrors).toEqual([]);
});

test("package loading failure is visible and retry preserves unanswered diagnostic", async ({ page }) => {
  await page.route("**/default/gold/**", (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }));
  await page.goto("/diagnostico");
  await page.getByRole("button", { name: "Continuar al diagnóstico" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No se pudo cargar" })).toBeVisible();
  expect(Object.keys((await readState(page)).diagnostic.answers)).toHaveLength(0);
  expect((await readState(page)).exposures).toHaveLength(0);
  await page.unroute("**/default/gold/**");
  await page.getByRole("button", { name: "Reintentar carga" }).click();
  await expect(page.getByRole("radio").first()).toBeVisible();
  await expect.poll(async () => (await readState(page)).exposures.length).toBe(1);
  expect(Object.keys((await readState(page)).diagnostic.answers)).toHaveLength(0);
});
