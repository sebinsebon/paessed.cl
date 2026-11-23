const { test, expect } = require('@playwright/test');
const { enableLocalApp } = require('./local-app-fixture.cjs');
const bank = require('../lib/default-catalog.json');

// All four question contexts share one mobile ink/review frame. Their action semantics differ.
test('diagnostic on a phone has only a fixed pencil before selecting, then confirms without revealing', async ({ page, baseURL }) => {
  await enableLocalApp(page, baseURL);
  await page.goto('/diagnostico');
  await page.getByRole('button', { name: 'Empezar diagnóstico' }).click();
  await expect(page.getByRole('radio').first()).toBeVisible();
  const dock = page.getByTestId('mobile-review-dock');
  const pencil = page.getByRole('button', { name: 'Desactivar lápiz', exact: true });
  await expect(pencil).toBeVisible();
  await expect(dock).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirmar y continuar' })).toHaveCount(0);
  const before = await page.getByTestId('learning-question-scroll').evaluate(el => el.clientHeight);
  const pencilBefore = await pencil.boundingBox();
  await page.getByRole('radio').first().click();
  await expect(dock).toBeVisible();
  const action = dock.getByRole('button', { name: 'Confirmar y continuar' });
  await expect(action).toBeEnabled();
  await expect(action).toHaveCSS('background-color', 'rgb(16, 185, 129)');
  const pencilAfter = await pencil.boundingBox();
  expect(pencilAfter.x).toBeCloseTo(pencilBefore.x, 0);
  expect(pencilAfter.y).toBeCloseTo(pencilBefore.y, 0);
  expect(await page.getByTestId('learning-question-scroll').evaluate(el => el.clientHeight)).toBe(before);
  await action.click();
  await expect(page.getByTestId('learning-session').getByText('2/16', { exact: true })).toBeVisible();
  await expect(page.locator('[role="radio"][data-answer-status="correct"]')).toHaveCount(0);
});

test('Default exams retain navigation without selecting an answer, but only one contextual bottom action', async ({ page, baseURL }) => {
  await enableLocalApp(page, baseURL);
  await page.goto(bank.exams[0].href);
  await expect(page.getByRole('radio').first()).toBeVisible();
  const dock = page.getByTestId('mobile-review-dock');
  await expect(page.getByRole('button', { name: 'Desactivar lápiz', exact: true })).toBeVisible();
  await expect(dock).toHaveCount(0);

  await page.getByRole('button', { name: 'Abrir menú de la pregunta' }).click();
  const dialog = page.getByRole('dialog', { name: 'Herramientas de la pregunta' });
  await expect(dialog.getByText('Navegación del ensayo')).toBeVisible();
  await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByTestId('learning-session')).toContainText('2 de');
  await expect(dock).toHaveCount(0);

  await page.getByRole('radio').first().click();
  await expect(dock).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Siguiente', exact: true })).toHaveCount(1);
  await expect(dock.getByRole('button', { name: 'Pregunta anterior' })).toHaveCount(0);
  await expect(page.locator('[role="radio"][data-answer-status="correct"]')).toHaveCount(0);
});

test('Playground uses the same fixed pencil and presents Comprobar only after selection', async ({ page, baseURL }) => {
  await enableLocalApp(page, baseURL);
  const question = bank.questions.find(q => q.eligible && q.correct);
  await page.goto('/app/playground');
  await page.getByLabel('Primera pregunta').selectOption(question.id);
  await page.getByRole('button', { name: /Comenzar práctica/ }).click();
  await expect(page.getByRole('radio').first()).toBeVisible();

  const dock = page.getByTestId('mobile-review-dock');
  await expect(dock).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Desactivar lápiz', exact: true })).toBeVisible();
  await page.getByRole('radio').first().click();
  await expect(dock).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Comprobar respuesta' })).toBeEnabled();
  await expect(dock.getByRole('button', { name: 'Comprobar respuesta' })).toHaveCSS('background-color', 'rgb(16, 185, 129)');
  // Playground retains its existing two-phase confirmation rather than advancing silently.
  await dock.getByRole('button', { name: 'Comprobar respuesta' }).click();
  await expect(dock.getByRole('button', { name: 'Confirmar respuesta' })).toBeVisible();
});
