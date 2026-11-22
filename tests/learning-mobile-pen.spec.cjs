const { test, expect } = require('@playwright/test');
const { catalog, NODE_ID, seed } = require('./learning-mobile-helpers.cjs');

test('pen reveals eraser and separate settings; the eraser removes only touched strokes', async ({ page }, testInfo) => {
  const meta = catalog[0];
  await seed(page, meta);
  const sheet = page.getByTestId('learning-ink-sheet');
  await expect(sheet).toHaveAttribute('data-ink-ready', 'true');
  const pen = page.getByRole('button', { name: 'Activar lápiz', exact: true });
  await expect(page.getByRole('button', { name: 'Goma de borrar', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ajustes del lápiz', exact: true })).toHaveCount(0);

  await pen.click();
  const eraser = page.getByRole('button', { name: 'Goma de borrar', exact: true });
  const settings = page.getByRole('button', { name: 'Ajustes del lápiz', exact: true });
  await expect(eraser).toBeVisible();
  await expect(eraser).toHaveAttribute('aria-pressed', 'false');
  await expect(settings).toBeVisible();
  await expect(settings).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('pen-active.png') });

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

  await eraser.click();
  await expect(eraser).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.click(box.x + 60, box.y + 30);
  await expect.poll(read).toEqual([keep]);

  // Tapping the eraser again switches back to drawing instead of clearing the page.
  await eraser.click();
  await expect(eraser).toHaveAttribute('aria-pressed', 'false');
  await settings.click();
  const panel = page.getByRole('dialog', { name: 'Herramientas de dibujo', exact: true });
  await expect(panel).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pen-settings.png') });
  await panel.getByRole('button', { name: 'Color de tinta #e11d48', exact: true }).click();
  await panel.getByRole('button', { name: 'Listo, dibujar', exact: true }).click();

  await page.getByRole('button', { name: 'Desactivar lápiz', exact: true }).click();
  await expect(eraser).toHaveCount(0);
  await expect(settings).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Activar lápiz', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('radio').first()).toBeEnabled();
});

test('pen quick actions remain visible until pencil is toggled off, including on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  await page.getByRole('button', { name: 'Activar lápiz', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Goma de borrar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajustes del lápiz', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Desactivar lápiz', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Goma de borrar', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ajustes del lápiz', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('radio').first()).toBeEnabled();
});

for (const correct of [true, false]) test(`selection toggles before confirmation, ${correct ? 'correct' : 'incorrect'} particles are decorative and temporary`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const meta = catalog[0];
  await seed(page, meta);
  const option = page.getByRole('radio').nth(correct ? meta.correct.charCodeAt(0) - 65 : (meta.correct === 'A' ? 1 : 0));
  const check = page.getByRole('button', { name: 'Comprobar', exact: true });
  await option.click(); await expect(check).toBeEnabled();
  await option.click(); await expect(option).toHaveAttribute('aria-checked', 'false');
  await expect(check).toBeDisabled();
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
