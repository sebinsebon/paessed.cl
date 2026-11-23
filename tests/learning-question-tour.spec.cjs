const { test, expect } = require('@playwright/test');
const { seed, openNode } = require('./learning-mobile-helpers.cjs');

test('first mobile question offers a five-step spotlight only once and can replay from the menu', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seed(page, undefined, { tutorial: true });
  const guide = page.getByTestId('question-tour-panel');
  await expect(guide).toBeVisible();
  await expect(guide).toHaveAttribute('data-step', 'pencil');
  await expect(guide).toContainText('El lápiz ya está activo');
  await expect(page.getByTestId('mobile-floating-pencil')).toHaveAttribute('aria-pressed', 'true');

  for (const step of ['ink', 'answers', 'tools', 'actions']) {
    await guide.getByRole('button', { name: 'Siguiente' }).click();
    await expect(guide).toHaveAttribute('data-step', step);
    if (step === 'ink') {
      const demo = guide.getByTestId('question-tour-ink-demo');
      await expect(demo).toBeVisible();
      await expect(demo).toHaveAttribute('data-device', 'touch');
      await expect(demo).toContainText('Doble toque');
      await expect(demo.getByTestId('ink-demo-stroke')).toHaveCSS('animation-name', /ink-draw/);
      await expect(demo.getByTestId('ink-demo-pointer')).toHaveCSS('animation-name', /cursor-path/);
      await expect(demo.getByTestId('ink-demo-stage')).toHaveAttribute('data-replay', '0');
      await demo.getByRole('button', { name: 'Repetir demostración' }).click();
      await expect(demo.getByTestId('ink-demo-stage')).toHaveAttribute('data-replay', '1');
      await page.screenshot({ path: testInfo.outputPath('question-tour-ink-mobile.png') });
    }
  }
  await expect(guide).toContainText('Responde cuando estés listo');
  await expect(guide.getByTestId('question-tour-ink-demo')).toHaveCount(0);
  await guide.getByRole('button', { name: 'Atrás' }).click();
  await expect(guide).toHaveAttribute('data-step', 'tools');
  await guide.getByRole('button', { name: 'Siguiente' }).click();
  await guide.getByRole('button', { name: 'Entendido' }).click();
  await expect(guide).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('paessed-question-tour-v1-mobile'))).toBe('1');

  await page.reload();
  await openNode(page);
  await expect(page.getByTestId('learning-paper-stem')).toBeVisible();
  await expect(guide).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir menú de la pregunta' }).click();
  await expect(page.getByRole('button', { name: 'Dibujar sobre la pregunta' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Recorrido de ayuda' }).click();
  await expect(guide).toHaveAttribute('data-step', 'pencil');
  await guide.getByRole('button', { name: 'Omitir' }).click();
  await expect(guide).toHaveCount(0);
});

test('desktop tour highlights the top toolbox, drawing starts on, and answer actions remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, undefined, { tutorial: true });
  const guide = page.getByTestId('question-tour-panel');
  await expect(guide).toHaveAttribute('data-step', 'pencil');
  await expect(guide).toContainText('barra superior');
  await expect(page.getByTestId('pen-toolbox')).toHaveAttribute('data-expanded', 'true');
  await guide.getByRole('button', { name: 'Siguiente' }).click();
  const demo = guide.getByTestId('question-tour-ink-demo');
  await expect(guide).toHaveAttribute('data-step', 'ink');
  await expect(demo).toHaveAttribute('data-device', 'mouse');
  await expect(demo).toContainText('Doble clic');
  await expect(demo.getByRole('button', { name: 'Repetir demostración' })).toBeVisible();
  await guide.getByRole('button', { name: 'Omitir' }).click();
  expect(await page.evaluate(() => localStorage.getItem('paessed-question-tour-v1-desktop'))).toBe('1');

  const option = page.getByRole('radio').first();
  await expect(option).toBeEnabled();
  await option.click();
  await expect(option).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Comprobar', exact: true })).toBeEnabled();
  await page.getByTestId('desktop-question-menu').click();
  await expect(page.getByRole('button', { name: 'Lápiz sobre la pregunta' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Recorrido de ayuda' }).click();
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: 'Omitir' }).click();
});
