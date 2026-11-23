const { test, expect } = require('@playwright/test');
const { catalog, NODE_ID, seed } = require('./learning-mobile-helpers.cjs');

test('phone pencil starts enabled, menu tools remain separate and eraser removes only touched strokes', async ({ page }, testInfo) => {
  const meta = catalog[0];
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seed(page, meta);
  const sheet = page.getByTestId('learning-ink-sheet');
  await expect(sheet).toHaveAttribute('data-ink-ready', 'true');
  await expect(page.getByTestId('mobile-review-dock')).toHaveCount(0);
  const pen = page.getByRole('button', { name: 'Desactivar lápiz', exact: true });
  await expect(pen).toBeVisible();
  await expect(pen).toHaveAttribute('aria-pressed', 'true');
  const penBox = await pen.boundingBox();
  expect(penBox.x).toBeGreaterThan(290);
  expect(penBox.y + penBox.height).toBeLessThanOrEqual(844);
  await expect(page.getByRole('button', { name: 'Goma de borrar', exact: true })).toHaveCount(0);

  const canvas = sheet.locator('canvas');
  const box = await canvas.boundingBox();
  const draw = async y => {
    await page.mouse.move(box.x + 30, box.y + y);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + y, { steps: 5 });
    await page.mouse.up();
  };
  await draw(30); await draw(70);
  const key = `paessed-learning-ink:${NODE_ID}:${meta.id}`;
  const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).strokes, key);
  await expect.poll(async () => (await read()).length).toBe(2);
  const keep = (await read())[1];

  const menu = page.getByRole('button', { name: 'Abrir menú de la pregunta', exact: true });
  await menu.click();
  const eraser = page.getByRole('dialog').getByRole('button', { name: 'Goma de borrar', exact: true });
  await expect(eraser).toBeVisible();
  await eraser.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Activar lápiz', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(canvas).toHaveCSS('cursor', /eraser\\.svg/);
  await page.mouse.click(box.x + 60, box.y + 30);
  await expect.poll(read).toEqual([keep]);

  await page.getByRole('button', { name: 'Activar lápiz', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Desactivar lápiz', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await menu.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ajustes del lápiz', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Herramientas de dibujo', exact: true });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('animation-name', /pen-dialog-in/);
  await page.screenshot({ path: testInfo.outputPath('mobile-pen-settings.png') });
  await panel.getByRole('button', { name: 'Listo, dibujar', exact: true }).click();
  await page.getByRole('button', { name: 'Desactivar lápiz', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Activar lápiz', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('answer button depresses while held, before selecting on release, even with the pencil already active', async ({ page }) => {
  const meta = catalog[0];
  await seed(page, meta);
  const pencil = page.getByRole('button', { name: 'Desactivar lápiz', exact: true });
  await expect(pencil).toHaveAttribute('aria-pressed', 'true');
  const option = page.getByRole('radio').first();
  await option.scrollIntoViewIfNeeded();
  const box = await option.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect(option).toHaveAttribute('data-press-preview', 'true');
  await expect(option).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => option.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).a)).toBeLessThan(.99);
  await page.mouse.up();
  await expect(option).toHaveAttribute('aria-checked', 'true');
  await expect(option).not.toHaveAttribute('data-press-preview', 'true');
  const key = `paessed-learning-ink:${NODE_ID}:${meta.id}`;
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null')?.strokes?.length ?? 0, key)).toBe(0);
  await expect(page.getByTestId('mobile-review-dock')).toBeVisible();
  // Releasing the finger triggers selection; keyboard still toggles the same choice.
  await option.focus();
  await page.keyboard.press('Space');
  await expect(option).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('mobile-review-dock')).toHaveCount(0);
  // A drag beginning inside an option is not a selection or a drawing stroke.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect(option).toHaveAttribute('data-press-preview', 'true');
  await page.mouse.move(x + 45, y + 2, { steps: 5 });
  await expect(option).not.toHaveAttribute('data-press-preview', 'true');
  await page.mouse.up();
  await expect(option).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null')?.strokes?.length ?? 0, key)).toBe(0);
});

test('double tap on a stroke crossing an option erases it instead of selecting the answer', async ({ page }) => {
  const meta = catalog[0];
  await seed(page, meta);
  const option = page.getByRole('radio').first();
  await option.scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Desactivar lápiz', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const bounds = await option.boundingBox();
  const x = bounds.x + Math.min(55, bounds.width / 3);
  const y = bounds.y + bounds.height / 2;
  const storageKey = `paessed-learning-ink:${NODE_ID}:${meta.id}`;
  const count = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null')?.strokes?.length ?? 0, storageKey);
  const drawAcross = async () => {
    await page.mouse.move(x, bounds.y - 12);
    await page.mouse.down();
    await page.mouse.move(x, y + 8, { steps: 12 });
    await page.mouse.up();
    await expect.poll(count).toBe(1);
  };

  await drawAcross();
  await page.mouse.click(x, y, { clickCount: 2, delay: 55 });
  await expect.poll(count).toBe(0);
  await expect(option).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('mobile-review-dock')).toHaveCount(0);

  // A SINGLE tap on ink is still a valid selection, after the brief double-tap window.
  await drawAcross();
  await page.mouse.click(x, y);
  await expect.poll(() => option.getAttribute('aria-checked')).toBe('true');
  await expect.poll(count).toBe(1);
  await expect(page.getByTestId('mobile-review-dock')).toBeVisible();
});

test('review and next animate in only after choosing an alternative; the button sits above ink', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seed(page);
  const review = page.getByTestId('mobile-review-dock');
  const pencil = page.getByRole('button', { name: 'Desactivar lápiz', exact: true });
  await expect(pencil).toBeVisible();
  await expect(review).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Comprobar', exact: true })).toHaveCount(0);

  const initialPencil = await pencil.boundingBox();
  const scroll = page.getByTestId('learning-question-scroll');
  const initialHeight = await scroll.evaluate(el => el.clientHeight);
  const firstOption = page.getByRole('radio').first();
  await firstOption.click();
  await expect(review).toBeVisible();
  await firstOption.click();
  await expect(review).toHaveCount(0);
  await firstOption.click();
  await expect(review).toBeVisible();
  const action = review.getByRole('button', { name: 'Comprobar', exact: true });
  await expect(action).toBeEnabled();
  await expect(action).toHaveCSS('background-color', 'rgb(16, 185, 129)');
  const afterSelection = await pencil.boundingBox();
  expect(afterSelection.x).toBeCloseTo(initialPencil.x, 0);
  expect(afterSelection.y).toBeCloseTo(initialPencil.y, 0);
  expect(await scroll.evaluate(el => el.clientHeight)).toBe(initialHeight);
  const layering = await page.evaluate(() => ({
    footer: parseInt(getComputedStyle(document.querySelector('[data-testid="learning-session-actions"]')).zIndex, 10),
    canvas: parseInt(getComputedStyle(document.querySelector('[data-testid="learning-ink-sheet"] canvas')).zIndex, 10),
  }));
  expect(layering.footer).toBeGreaterThan(layering.canvas);

  await action.click();
  const next = review.getByRole('button', { name: /Continuar|Siguiente pregunta|Ver resultado/ });
  await expect(next).toBeVisible();
  await expect(review).toHaveCSS('opacity', '1');
});

test('mobile ink pans with two touches and draws directly over lower alternatives', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Multi-touch pointer events require CDP touch emulation');
  const meta = catalog[0];
  await page.setViewportSize({ width: 390, height: 560 });
  await seed(page, meta);
  const sheet = page.getByTestId('learning-ink-sheet');
  await expect(sheet).toHaveAttribute('data-ink-ready', 'true');
  await expect(page.getByRole('button', { name: 'Desactivar lápiz', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // Force enough paper to require scrolling even with a short sample question.
  await sheet.evaluate(element => { element.style.paddingBottom = '800px'; });
  const scroll = page.getByTestId('learning-question-scroll');
  await expect.poll(() => scroll.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(300);
  const canvas = sheet.locator('canvas');
  const bounds = await canvas.boundingBox();
  const x1 = bounds.x + 70, x2 = bounds.x + 170, y = bounds.y + 150;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ x: p.x, y: p.y, id: p.id })) });

  await send('touchStart', [{ id: 1, x: x1, y }]);
  await send('touchStart', [{ id: 1, x: x1, y }, { id: 2, x: x2, y }]);
  for (let i = 1; i <= 12; i++) {
    await send('touchMove', [{ id: 1, x: x1, y: y - i * 18 }, { id: 2, x: x2, y: y - i * 18 }]);
  }
  await send('touchEnd', [{ id: 1, x: x1, y: y - 216 }]);
  await send('touchEnd', []);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  const storageKey = `paessed-learning-ink:${NODE_ID}:${meta.id}`;
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null')?.strokes?.length ?? 0, storageKey)).toBe(0);

  const option = page.getByRole('radio').first();
  await option.scrollIntoViewIfNeeded();
  const optionBox = await option.boundingBox();
  const canvasBox = await canvas.boundingBox();
  // The ink layer must cover the alternative itself, not stop after the stem.
  expect(canvasBox.left).toBeLessThanOrEqual(optionBox.left);
  expect(canvasBox.right).toBeGreaterThanOrEqual(optionBox.right);
  expect(canvasBox.top).toBeLessThanOrEqual(optionBox.top);
  expect(canvasBox.bottom).toBeGreaterThanOrEqual(optionBox.bottom);
  const targetY = optionBox.y + optionBox.height / 2;
  const targetX = optionBox.x + 30;
  await send('touchStart', [{ id: 3, x: targetX, y: targetY }]);
  await send('touchEnd', []);
  await expect(option).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null')?.strokes?.length ?? 0, storageKey)).toBe(0);
  await expect(page.getByTestId('mobile-review-dock')).toBeVisible();

  // A stroke that starts OUTSIDE a button may continue over it.
  await page.mouse.move(optionBox.x + 30, optionBox.y - 12);
  await page.mouse.down();
  await page.mouse.move(optionBox.x + 80, optionBox.y + 22, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null')?.strokes?.length ?? 0, storageKey)).toBe(1);
  await expect(option).toHaveAttribute('aria-checked', 'true');
  const dock = await page.getByTestId('mobile-review-dock').boundingBox();
  const canvasAfter = await canvas.boundingBox();
  expect(dock.y + dock.height).toBeLessThanOrEqual(560);
  expect(canvasAfter.height).toBeGreaterThan(0);
  // The action is on a higher layer, and remains clickable with the pencil enabled.
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.getByTestId('mobile-review-dock')).toBeVisible();
});

test('fast eraser movement removes every crossed stroke, without bringing earlier strokes back', async ({ page }) => {
  await seed(page, catalog[0]);
  await expect(page.getByRole('button', { name: 'Desactivar lápiz', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const canvas = page.getByTestId('learning-ink-sheet').locator('canvas');
  const box = await canvas.boundingBox();
  for (const offset of [30, 75, 120]) {
    await page.mouse.move(box.x + 35, box.y + offset);
    await page.mouse.down();
    await page.mouse.move(box.x + 115, box.y + offset, { steps: 5 });
    await page.mouse.up();
  }
  const storageKey = `paessed-learning-ink:${NODE_ID}:${catalog[0].id}`;
  const count = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null')?.strokes?.length ?? 0, storageKey);
  await expect.poll(count).toBe(3);
  await page.getByRole('button', { name: 'Abrir menú de la pregunta', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Goma de borrar', exact: true }).click();
  await page.mouse.move(box.x + 74, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 74, box.y + 120, { steps: 9 });
  await page.mouse.up();
  await expect.poll(count).toBe(0);
});

test('pen quick actions remain visible until pencil is toggled off, including on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  const desktopBefore = await page.evaluate(() => {
    const button = document.querySelector('header [aria-label="Activar lápiz"]');
    const header = button.closest('header');
    const rect = element => { const { left, top, width, height } = element.getBoundingClientRect(); return { left, top, width, height }; };
    return { button: rect(button), header: rect(header) };
  });
  await page.getByRole('button', { name: 'Activar lápiz', exact: true }).click();
  const desktopEraser = page.getByRole('button', { name: 'Goma de borrar', exact: true });
  const desktopSettings = page.getByRole('button', { name: 'Ajustes del lápiz', exact: true });
  const desktopPencil = page.getByRole('button', { name: 'Desactivar lápiz', exact: true });
  await expect(desktopEraser).toBeVisible();
  await expect(desktopSettings).toBeVisible();
  await expect(page.getByTestId('pen-toolbox').first()).toHaveCSS('width', '48px');
  const desktopPositions = await Promise.all([desktopSettings, desktopEraser, desktopPencil].map(button => button.boundingBox()));
  expect(desktopPositions[0].x).toBeLessThan(desktopPositions[1].x);
  expect(desktopPositions[1].right).toBeLessThanOrEqual(desktopPositions[2].x + 2);
  expect(desktopPositions[2].x).toBeCloseTo(desktopBefore.button.left, 0);
  expect(desktopPositions[2].y).toBeCloseTo(desktopBefore.button.top, 0);
  expect(desktopPositions[2].width).toBeCloseTo(desktopBefore.button.width, 0);
  const desktopHeaderAfter = await page.evaluate(() => {
    const header = document.querySelector('header [aria-label="Desactivar lápiz"]').closest('header');
    const { height, width } = header.getBoundingClientRect();
    return { height, width };
  });
  expect(desktopHeaderAfter.height).toBeCloseTo(desktopBefore.header.height, 0);
  expect(desktopHeaderAfter.width).toBeCloseTo(desktopBefore.header.width, 0);

  // Wait until the spring settles before asserting seamless geometry.
  await expect.poll(() => page.evaluate(() => {
    const anchor = document.querySelector('header [data-testid="pen-toolbox"]');
    const pencil = anchor.querySelector('[aria-label="Desactivar lápiz"]').getBoundingClientRect();
    const tray = anchor.querySelector('[class*="penFlyout"]').getBoundingClientRect();
    return Math.abs(pencil.left - tray.right) + Math.abs(pencil.top - tray.top);
  })).toBeLessThanOrEqual(1.5);
  // The tray and pencil must read as ONE continuous box, not two rounded cards.
  const connected = await page.evaluate(() => {
    const anchor = document.querySelector('header [data-testid="pen-toolbox"]');
    const pencil = anchor.querySelector('[aria-label="Desactivar lápiz"]');
    const flyout = anchor.querySelector('[class*="penFlyout"]');
    const penRect = pencil.getBoundingClientRect();
    const trayRect = flyout.getBoundingClientRect();
    return {
      leftRadius: getComputedStyle(pencil).borderTopLeftRadius,
      pencilLeftBorder: getComputedStyle(pencil).borderLeftWidth,
      flyoutRightBorder: getComputedStyle(flyout).borderRightWidth,
      topGap: Math.abs(penRect.top - trayRect.top),
      joinedGap: Math.abs(penRect.left - trayRect.right),
    };
  });
  expect(connected.leftRadius).toBe('0px');
  expect(connected.pencilLeftBorder).toBe('0px');
  expect(connected.flyoutRightBorder).toBe('0px');
  expect(connected.topGap).toBeLessThan(1);
  expect(connected.joinedGap).toBeLessThanOrEqual(1.5);

  await desktopEraser.click();
  await expect(desktopEraser).toHaveAttribute('aria-pressed', 'true');
  await expect(desktopPencil).toHaveAttribute('aria-pressed', 'false');
  const selection = await page.evaluate(() => {
    const anchor = document.querySelector('header [data-testid="pen-toolbox"]');
    const pencil = anchor.querySelector('[aria-label="Desactivar lápiz"]');
    const eraser = anchor.querySelector('[aria-label="Goma de borrar"]');
    const flyout = anchor.querySelector('[class*="penFlyout"]');
    return {
      tool: anchor.getAttribute('data-active-tool'),
      pencilBg: getComputedStyle(pencil).backgroundColor,
      eraserBg: getComputedStyle(eraser).backgroundColor,
      flyoutBg: getComputedStyle(flyout).backgroundColor,
      pencilColor: getComputedStyle(pencil).color,
      eraserColor: getComputedStyle(eraser).color,
    };
  });
  expect(selection.tool).toBe('eraser');
  expect(selection.pencilBg).toBe(selection.flyoutBg);
  expect(selection.eraserBg).not.toBe(selection.pencilBg);
  expect(selection.eraserColor).not.toBe(selection.pencilColor);
  await desktopPencil.click();
  await expect(page.getByRole('button', { name: 'Goma de borrar', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ajustes del lápiz', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('radio').first()).toBeEnabled();
});

test('pencil settings respect reduced motion preferences', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page);
  await expect(page.getByRole('button', { name: 'Desactivar lápiz', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Abrir menú de la pregunta', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ajustes del lápiz', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Herramientas de dibujo' })).toHaveCSS('animation-name', 'none');
});

for (const correct of [true, false]) test(`selection toggles before confirmation, ${correct ? 'correct' : 'incorrect'} particles are decorative and temporary`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const meta = catalog[0];
  await seed(page, meta);
  const option = page.getByRole('radio').nth(correct ? meta.correct.charCodeAt(0) - 65 : (meta.correct === 'A' ? 1 : 0));
  const check = page.getByRole('button', { name: 'Comprobar', exact: true });
  await option.click(); await expect(check).toBeEnabled();
  await option.click(); await expect(option).toHaveAttribute('aria-checked', 'false');
  await expect(check).toHaveCount(0);
  await option.focus(); await page.keyboard.press('Space');
  await expect(option).toHaveAttribute('aria-checked', 'true');
  await check.click();
  const effect = page.getByTestId('answer-effects');
  await expect(effect).toHaveAttribute('data-result', correct ? 'correct' : 'incorrect');
  await expect(effect).toHaveAttribute('aria-hidden', 'true');
  await expect(option).toBeDisabled();
  await expect(effect).toHaveCount(0);
});

test('reduced motion hides decorative particles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page);
  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.getByTestId('answer-effects')).not.toBeVisible();
});
