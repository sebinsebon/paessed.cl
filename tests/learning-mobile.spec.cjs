const { test, expect } = require('@playwright/test');
const { catalog, NODE_ID, readBank, seed, ready, geometry, readState, openNode } = require('./learning-mobile-helpers.cjs');

const confirm = page => page.getByRole('button', { name: /^(Comprobar|Confirmar respuesta|Confirmar nuevo intento)$/ });

test('figure zoom and tool dialogs restore their trigger focus', async ({ page }) => {
  const { meta } = (await readBank()).find(q => JSON.stringify(q.original.stem).includes('"type":"image"'));
  await seed(page, meta);
  await expect(page.getByTestId('learning-ink-sheet')).toHaveAttribute('data-ink-ready', 'true');
  const trigger = page.getByRole('button', { name: /^Ampliar figura/ }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Ampliar figura', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Ampliar figura más', exact: true }).click();
  await expect(dialog).toContainText('125 %');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  const menu = page.getByRole('button', { name: 'Abrir menú de la pregunta', exact: true });
  await menu.click();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
});

test('phone widths, landscape, desktop boundaries, keyboard and immutable answer', async ({ page }, testInfo) => {
  const meta = catalog[0];
  await seed(page, meta);
  await expect(confirm(page)).toBeDisabled();
  for (const [width, height] of [[320, 740], [360, 800], [375, 812], [390, 844], [430, 932], [844, 390], [768, 1024], [1024, 768], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    await ready(page, meta);
    await geometry(page, { mobile: width <= 767 });
    await expect(page.getByTestId('learning-session-actions')).toBeInViewport();
    const header = await page.getByTestId('learning-session').locator('header').boundingBox();
    if (width <= 767) expect(header.height).toBeLessThanOrEqual(60);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('radio').first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio').nth(1)).toBeFocused();
  await expect(page.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true');
  const wrong = meta.correct === 'A' ? 'B' : 'A';
  await page.getByRole('radio').nth(wrong.charCodeAt(0) - 65).click();
  await confirm(page).click();
  await expect(page.locator('[data-answer-status="incorrect"]')).toHaveCount(1);
  await expect(page.locator('[data-answer-status="correct"]')).toHaveCount(1);
  await geometry(page);
  await page.screenshot({ path: testInfo.outputPath('wrong-mobile-light.png') });
  const saved = await readState(page);
  expect(saved.attempts).toHaveLength(1);
  await page.getByRole('button', { name: 'Preguntar a la IA', exact: true }).click();
  const ai = page.getByRole('dialog', { name: 'Prompt para preguntar a la IA', exact: true });
  await expect(ai).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ai-mobile-light.png') });
  await expect(ai.getByRole('button', { name: 'Cerrar', exact: true })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Preguntar a la IA', exact: true })).toBeFocused();
  expect((await readState(page)).attempts).toEqual(saved.attempts);
  await page.getByRole('button', { name: 'Abrir menú de la pregunta', exact: true }).click();
  await page.getByRole('button', { name: 'Apariencia', exact: true }).click();
  await page.getByRole('button', { name: 'Hoja oscura', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: testInfo.outputPath('wrong-mobile-dark.png') });
  await page.getByRole('button', { name: 'Preguntar a la IA', exact: true }).click();
  await expect(ai).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ai-mobile-dark.png') });
  await page.keyboard.press('Escape');
  await page.reload();
  await openNode(page);
  expect((await readState(page)).attempts).toEqual(saved.attempts);
  expect((await readState(page)).nodes.find(n => n.id === NODE_ID).answers[meta.id]).toBe(wrong);
});

test('original package failure and retry never enable confirmation prematurely', async ({ page }) => {
  await page.route('**/default/gold/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  // Seed without waiting for the resources that this test deliberately blocks.
  const { fixtureState, writeState } = require('./learning-mobile-helpers.cjs');
  await page.goto('/app/aprender');
  await writeState(page, fixtureState(catalog[0]));
  await page.reload();
  await openNode(page);
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo cargar' })).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  expect((await readState(page)).attempts).toHaveLength(0);
  await page.unroute('**/default/gold/**');
  await page.getByRole('button', { name: 'Reintentar carga', exact: true }).click();
  await ready(page, catalog[0]);
  await expect(confirm(page)).toBeDisabled();
  await page.getByRole('radio').first().click();
  await expect(confirm(page)).toBeEnabled();
});

test('five alternatives retain their labels and selection while resizing', async ({ page }) => {
  const { meta, original } = (await readBank()).find(q => q.original.options.length === 5);
  await seed(page, meta);
  await expect(page.getByRole('radio')).toHaveCount(5);
  await page.getByRole('radio').last().click();
  for (const width of [320, 430, 375]) {
    await page.setViewportSize({ width, height: 844 });
    await ready(page, meta);
    await geometry(page);
    await expect(page.getByRole('radio').last()).toHaveAttribute('aria-checked', 'true');
    for (let i = 0; i < 5; i++) await expect(page.getByRole('radio').nth(i)).toContainText(original.options[i].label);
  }
});

test('ink stays aligned through feedback, rotation, reload and pointer cancellation', async ({ page }) => {
  const meta = catalog[0];
  await seed(page, meta);
  const sheet = page.getByTestId('learning-ink-sheet');
  await expect(sheet).toHaveAttribute('data-ink-ready', 'true');
  await page.getByRole('button', { name: 'Activar lápiz', exact: true }).click();
  await page.getByRole('button', { name: 'Listo, dibujar', exact: true }).click();
  const canvas = sheet.locator('canvas');
  const box = await canvas.boundingBox();
  const draw = async () => {
    await page.mouse.move(box.x + 35, box.y + 35);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + 60, { steps: 5 });
    await page.mouse.up();
  };
  await draw();
  const key = `paessed-learning-ink:${NODE_ID}:${meta.id}`;
  const readInk = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key);
  await expect.poll(async () => (await readInk())?.strokes?.length).toBe(1);
  const saved = await readInk();
  expect(saved.version).toBe(2);
  expect(saved.width).toBeGreaterThan(0);
  expect(saved.height).toBeGreaterThan(0);
  await page.mouse.move(box.x + 35, box.y + 35);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 40);
  await canvas.dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  expect((await readInk()).strokes).toEqual(saved.strokes);
  await page.mouse.move(box.x + 35, box.y + 35);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 40);
  // A second contact outside the canvas must cancel the unfinished stroke too.
  await page.locator('body').dispatchEvent('pointerdown', { pointerId: 9, pointerType: 'touch', isPrimary: false });
  await page.mouse.up();
  expect((await readInk()).strokes).toEqual(saved.strokes);
  await page.getByRole('button', { name: 'Desplazar', exact: true }).click();
  const original = await sheet.evaluate(el => ({ width: el.offsetWidth, height: el.offsetHeight, font: getComputedStyle(el.querySelector('[data-testid="learning-paper-stem"]')).fontSize }));
  for (const viewport of [{ width: 844, height: 390 }, { width: 320, height: 740 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await sheet.evaluate(el => ({ width: el.offsetWidth, height: el.offsetHeight, font: getComputedStyle(el.querySelector('[data-testid="learning-paper-stem"]')).fontSize }))).toEqual(original);
    expect((await readInk()).strokes).toEqual(saved.strokes);
  }
  await page.getByRole('radio').first().click();
  await confirm(page).click();
  expect(await sheet.evaluate(el => ({ width: el.offsetWidth, height: el.offsetHeight, font: getComputedStyle(el.querySelector('[data-testid="learning-paper-stem"]')).fontSize }))).toEqual(original);
  await page.reload();
  await openNode(page);
  expect(await readInk()).toEqual(saved);
});

test('ink storage failure warns and preserves in-memory marks when the session reopens', async ({ page }) => {
  const meta = catalog[0];
  await seed(page, meta);
  const key = `paessed-learning-ink:${NODE_ID}:${meta.id}`;
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('paessed-learning-ink:')) throw new DOMException('Test quota failure', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await expect(page.getByTestId('learning-ink-sheet')).toHaveAttribute('data-ink-ready', 'true');
  await page.getByRole('button', { name: 'Activar lápiz', exact: true }).click();
  await page.getByRole('button', { name: 'Listo, dibujar', exact: true }).click();
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x + 25, box.y + 25);
  await page.mouse.down();
  await page.mouse.move(box.x + 75, box.y + 45, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole('alert').filter({ hasText: 'siguen en memoria' })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
  await page.getByRole('button', { name: 'Guardar y cerrar sesión', exact: true }).click();
  await openNode(page);
  await expect(page.getByTestId('learning-ink-sheet')).toHaveAttribute('data-ink-locked', 'true');
  const pixels = await page.locator('canvas').evaluate(canvas => {
    const values = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0; for (let i = 3; i < values.length; i += 4) if (values[i]) visible++;
    return visible;
  });
  expect(pixels).toBeGreaterThan(20);
});

test('optional timer counts active time, pauses hidden/help/menu, freezes and resumes without closed time', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-08T12:00:00Z') });
  const meta = catalog[0];
  await seed(page, meta);
  await page.clock.pauseAt(new Date('2026-11-08T12:01:00Z'));
  await expect(page.getByTestId('learning-question-timer')).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir menú de la pregunta', exact: true }).click();
  await page.getByRole('button', { name: 'Mostrar cronómetro', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('learning-question-timer')).toBeVisible();
  const key = `paessed-learning-timer:${NODE_ID}:${meta.id}:original:0`;
  const readTimer = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key);
  await page.clock.runFor(5000);
  const active = await readTimer();
  expect(active.elapsedMs).toBeGreaterThanOrEqual(4900);
  expect(active.elapsedMs).toBeLessThan(6000);
  await page.getByRole('button', { name: 'Abrir menú de la pregunta', exact: true }).click();
  const beforeMenu = await readTimer();
  await page.clock.runFor(10000);
  expect((await readTimer()).elapsedMs).toBe(beforeMenu.elapsedMs);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  const hidden = await readTimer();
  await page.clock.runFor(10000);
  expect((await readTimer()).elapsedMs).toBe(hidden.elapsedMs);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(2000);
  await page.getByRole('button', { name: 'Guardar y cerrar sesión', exact: true }).click();
  const closed = await readTimer();
  await page.clock.runFor(60000);
  await page.clock.resume();
  await page.reload();
  await openNode(page);
  await ready(page, meta);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
  await expect(page.getByTestId('learning-question-timer')).toBeVisible();
  expect((await readTimer()).elapsedMs).toBeLessThan(closed.elapsedMs + 1000);
  await page.getByRole('radio').first().click();
  await confirm(page).click();
  await expect.poll(async () => (await readTimer())?.frozen).toBe(true);
  const frozen = await readTimer();
  await page.clock.runFor(30000);
  expect(await readTimer()).toEqual(frozen);
});
