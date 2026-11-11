const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { catalog, seed, readState } = require('./learning-mobile-helpers.cjs');
const exam = require('../lib/default-catalog.json').exams[0];
const firstMeta = catalog.find(q => q.examId === exam.id && q.number === 1);
const shortMeta = catalog.find(q => q.examId === exam.id && q.number === 2);
const errors = new WeakMap();
test.beforeEach(({ page }) => {
  const messages = []; errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /Maximum update depth|Cannot update a component|Hydration failed|tree hydrated/.test(message.text())) messages.push(message.text()); });
});
test.afterEach(({ page }) => { expect(errors.get(page), 'No React runtime errors').toEqual([]); });

async function importPackage(page, file = path.join(__dirname, 'fixtures/tesla-renderer.paessed')) {
  await page.goto('/app/ensayos/importar');
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByRole('button', { name: 'Importar ensayo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Importado', exact: true })).toBeVisible();
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('paessed-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result; const read = db.transaction('imported-exams').objectStore('imported-exams').getAll(); read.onsuccess = () => { db.close(); resolve(read.result[0].summary.id); }; };
  }));
}

async function openContext(page, context) {
  let importedId;
  if (context === 'learning') await seed(page, shortMeta);
  else if (context.startsWith('diagnostic')) {
    await page.goto(context === 'diagnostic-inicio' ? '/app/inicio' : '/app/aprender');
    if (context === 'diagnostic-inicio') await page.getByRole('link', { name: 'Preparar mi ruta', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar al diagnóstico', exact: true }).click();
    await expect(page).toHaveURL(/\/diagnostico$/);
  } else if (context === 'default') await page.goto(exam.href);
  else if (context === 'demo') await page.goto('/app/ensayos/nuevo');
  else if (context === 'imported') {
    const id = await importPackage(page);
    importedId = id;
    await page.evaluate(id => localStorage.setItem('paessed-imported-essay-progress-v1-' + id, JSON.stringify({ index: 1, answers: {}, bookmarks: [], strokes: {} })), id);
    await page.goto('/app/ensayos/importado/' + id);
  } else {
    await page.goto('/app/playground');
    await page.getByLabel('Primera pregunta').selectOption(shortMeta.id);
    await page.getByRole('button', { name: /Comenzar práctica/ }).click();
  }
  await expect(options(page).first()).toBeVisible();
  await expect(page.getByTestId('learning-ink-sheet')).toHaveAttribute('data-ink-ready', 'true');
  return { importedId };
}

function options(page) {
  return page.locator('[role="radio"], [role="group"][aria-label="Alternativas de respuesta"] > button');
}

async function paperGeometry(page, mobile) {
  const shell = page.getByTestId('learning-session');
  await expect(shell).toBeVisible();
  const layout = await shell.evaluate(el => {
    const main = el.querySelector('[data-testid="learning-question-scroll"]');
    const footer = el.querySelector('[data-testid="learning-session-actions"]');
    const canvas = el.querySelector('canvas');
    const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
    return { shell: rect(el), header: rect(el.querySelector('header')), main: rect(main), footer: rect(footer), canvas: rect(canvas),
      docWidth: document.documentElement.scrollWidth, innerWidth, innerHeight, paddingBottom: parseFloat(getComputedStyle(main).paddingBottom), scrollWidth: main.scrollWidth, clientWidth: main.clientWidth };
  });
  expect(layout.docWidth).toBeLessThanOrEqual(layout.innerWidth + 1);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.shell.x).toBeCloseTo(0, 0);
  expect(layout.shell.y).toBeCloseTo(0, 0);
  expect(layout.footer.bottom).toBeLessThanOrEqual(layout.innerHeight + 1);
  expect(layout.canvas.bottom, 'the writing surface reaches the blank bottom of the paper').toBeGreaterThanOrEqual(layout.main.bottom - layout.paddingBottom - 1);
  if (mobile) expect(layout.header.height).toBeLessThanOrEqual(60);
  return layout;
}

for (const context of ['learning', 'diagnostic-inicio', 'diagnostic-aprender', 'default', 'imported', 'demo', 'playground']) {
  for (const width of [320, 390, 1440]) test(`${context}: shared paper, pen and preserved semantics at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await openContext(page, context);
    await paperGeometry(page, width < 768);
    const pencil = page.getByRole('button', { name: 'Activar lápiz', exact: true });
    await pencil.click();
    await expect(page.getByRole('dialog', { name: 'Herramientas de dibujo', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Desactivar lápiz', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Desactivar lápiz', exact: true }).click();
    await expect(pencil).toBeVisible();
    await expect(page.getByRole('group', { name: 'Zoom de la hoja anotada', exact: true })).toHaveCount(0);
    const option = options(page).first();
    await option.click();
    await expect.poll(() => option.evaluate(el => el.getAttribute('aria-checked') || el.getAttribute('aria-pressed'))).toBe('true');
    if (context.startsWith('diagnostic')) {
      await expect(page.getByRole('button', { name: 'Preguntar a la IA', exact: true })).toHaveCount(0);
      await expect(page.locator('[data-answer-status="correct"], [data-answer-status="incorrect"]')).toHaveCount(0);
      await page.getByRole('button', { name: 'Confirmar y continuar', exact: true }).click();
      await expect.poll(async () => Object.keys((await readState(page)).diagnostic.answers).length).toBe(1);
      await expect(page.locator('[data-answer-status="correct"], [data-answer-status="incorrect"]')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Preguntar a la IA', exact: true })).toHaveCount(0);
    } else if (context === 'default') {
      await options(page).nth(1).click();
      await expect(options(page).nth(1)).toHaveAttribute('aria-checked', 'true');
      await options(page).nth(1).click();
      await expect(options(page).nth(1)).toHaveAttribute('aria-checked', 'false');
      await page.reload();
      await expect(options(page).nth(1)).toHaveAttribute('aria-checked', 'false');
      await expect(page.locator('[role="radio"][aria-checked="true"]')).toHaveCount(0);
      await options(page).nth(1).click();
      await page.reload();
      await expect(options(page).nth(1)).toHaveAttribute('aria-checked', 'true');
      expect((await readState(page)).attempts).toHaveLength(0);
    } else if (context === 'playground') {
      await page.getByRole('button', { name: 'Comprobar respuesta', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmar respuesta', exact: true }).click();
      await expect.poll(async () => (await readState(page)).attempts.length).toBe(1);
    }
    await expect(page.getByTestId('learning-ink-sheet')).toHaveAttribute('data-ink-ready', 'true');
    await expect(options(page).first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${context}-${width}.png`) });
  });
}

test('blank space below a short question accepts ink and exiting preserves natural scroll without selecting an option', async ({ page }) => {
  await seed(page, shortMeta);
  const canvas = page.getByTestId('learning-ink-sheet').locator('canvas');
  const layout = await paperGeometry(page, true);
  const lastOption = await options(page).last().boundingBox();
  const y = layout.main.bottom - 45;
  expect(y).toBeGreaterThan(lastOption.y + lastOption.height + 12);
  await page.getByRole('button', { name: 'Activar lápiz', exact: true }).click();
  await page.mouse.move(40, y);
  await page.mouse.down();
  await page.mouse.move(130, y - 20, { steps: 8 });
  await page.mouse.up();
  const ink = await canvas.evaluate(el => {
    const ctx = el.getContext('2d'); const pixels = ctx.getImageData(0, Math.floor(el.height * 0.7), el.width, Math.floor(el.height * 0.3)).data;
    return pixels.some((value, i) => i % 4 === 3 && value > 0);
  });
  expect(ink).toBe(true);
  await page.getByRole('button', { name: 'Desactivar lápiz', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Zoom de la hoja anotada', exact: true })).toHaveCount(0);
  await expect(page.locator('[role="radio"][aria-checked="true"]')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 450 });
  const scroll = page.getByTestId('learning-question-scroll');
  await scroll.hover(); await page.mouse.wheel(0, 300);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(20);
  await expect(page.locator('[role="radio"][aria-checked="true"]')).toHaveCount(0);
  await expect(page.getByTestId('learning-session-actions')).toBeInViewport();
});

test('nested fraction alternatives keep separate clickable areas on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const meta = catalog.find(q => q.examId === 'm1-regular-2023' && q.number === 44);
  await seed(page, meta);
  const radios = page.getByRole('radio');
  const hitTargets = await radios.evaluateAll(elements => elements.map(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[role=radio]');
    return { ownCenter: hit === el, height: r.height };
  }));
  expect(hitTargets.every(target => target.ownCenter), JSON.stringify(hitTargets)).toBe(true);
  for (let index = 0; index < await radios.count(); index++) {
    await radios.nth(index).click({ timeout: 5000 });
    await expect(radios.nth(index)).toHaveAttribute('aria-checked', 'true');
  }
});

test('growing the writing viewport preserves old ink and accepts ink in the new blank space', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 550 });
  await seed(page, shortMeta);
  await page.getByRole('button', { name: 'Activar lápiz', exact: true }).click();
  const canvas = page.getByTestId('learning-ink-sheet').locator('canvas');
  const draw = async y => {
    await page.mouse.move(45, y); await page.mouse.down();
    await page.mouse.move(130, y, { steps: 8 }); await page.mouse.up();
  };
  const box = await canvas.boundingBox();
  await draw(box.y + 70);
  const inkKey = await page.evaluate(() => Object.keys(localStorage).find(key => key.startsWith('paessed-learning-ink:')));
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), inkKey);
  await expect.poll(async () => (await saved())?.strokes.length).toBe(1);
  const before = await saved();
  await page.setViewportSize({ width: 390, height: 1000 });
  await expect.poll(async () => (await saved()).height).toBeGreaterThan(before.height);
  const after = await saved();
  after.strokes[0].points.forEach((point, index) => expect(point.y * after.height).toBeCloseTo(before.strokes[0].points[index].y * before.height, 1));
  const expanded = await canvas.boundingBox();
  await draw(expanded.y + expanded.height - 45);
  await expect.poll(async () => (await saved()).strokes.length).toBe(2);
  const last = (await saved()).strokes[1].points[0];
  expect(last.y * (await saved()).height).toBeGreaterThan(before.height);
  const final = await saved();
  const oldY = before.strokes[0].points[0].y * before.height;
  const paintedAt = y => canvas.evaluate((el, y) => {
    const scale = el.height / el.getBoundingClientRect().height;
    const top = Math.max(0, Math.floor((y - 5) * scale));
    return el.getContext('2d').getImageData(0, top, el.width, Math.ceil(10 * scale)).data.some((value, i) => i % 4 === 3 && value > 0);
  }, y);
  expect(await paintedAt(oldY)).toBe(true);
  await page.reload();
  await page.locator('[data-testid="learning-route-node"][data-state="current"]').click();
  await page.getByRole('button', { name: 'Retomar sesión', exact: true }).click();
  await expect(page.getByTestId('learning-ink-sheet')).toHaveAttribute('data-ink-locked', 'true');
  expect((await saved()).strokes).toEqual(final.strokes);
  expect(await paintedAt(oldY)).toBe(true);
});

test('complete paessed archive preserves its bytes and figures after reload', async ({ page }, testInfo) => {
  const fs = require('node:fs');
  const crypto = require('node:crypto');
  const JSZip = require('jszip');
  const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/tesla-renderer.paessed'));
  const zip = await JSZip.loadAsync(bytes);
  const original = JSON.parse(await zip.file('final.json').async('string'));
  const id = await importPackage(page);
  const stored = await page.evaluate(id => new Promise((resolve, reject) => {
    const request = indexedDB.open('paessed-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction('imported-exams').objectStore('imported-exams').get(id);
      read.onsuccess = async () => {
        const record = read.result; db.close();
        const bytes = record.archive instanceof Blob ? await record.archive.arrayBuffer() : record.archive;
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        resolve({ data: record.finalJson, count: record.summary.assetCount, hash: [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') });
      };
    };
  }), id);
  expect(stored.data).toEqual(original);
  expect(stored.count).toBe(18);
  expect(stored.hash).toBe(crypto.createHash('sha256').update(bytes).digest('hex'));
  await page.goto('/app/ensayos/importado/' + id);
  await expect(page.getByTestId('learning-ink-sheet')).toHaveAttribute('data-ink-ready', 'true');
  await page.getByRole('button', { name: 'Abrir menú de la pregunta', exact: true }).click();
  await page.getByLabel('Ir a pregunta', { exact: true }).selectOption('24');
  await page.keyboard.press('Escape');
  const images = page.getByTestId('learning-paper-stem').locator('img');
  await expect(images).toHaveCount(1);
  await expect.poll(() => images.evaluateAll(els => els.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  await page.reload();
  await expect(page.getByTestId('learning-ink-sheet')).toHaveAttribute('data-ink-ready', 'true');
  const hashes = await images.evaluateAll(images => Promise.all(images.map(async image => {
    const digest = await crypto.subtle.digest('SHA-256', await (await fetch(image.src)).arrayBuffer());
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  })));
  const question = original.questions.find(q => Number(q.number) === 25);
  expect(hashes).toEqual(question.stem.filter(block => block.type === 'image').map(block => original.assets.find(asset => asset.id === block.asset_id).sha256));
  await page.screenshot({ path: testInfo.outputPath('imported-original-figure.png') });
});

for (const context of ['demo', 'imported']) test(`${context}: clearing, navigation and reload preserve editable answers`, async ({ page }) => {
  const { importedId } = await openContext(page, context);
  const key = context === 'demo' ? 'paessed-demo-exam-progress-v1' : 'paessed-imported-essay-progress-v1-' + importedId;
  const position = context === 'demo' ? 0 : 1;
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key);
  await options(page).first().click();
  await expect(options(page).first()).toHaveAttribute('aria-checked', 'true');
  await options(page).first().click();
  await expect(options(page).first()).toHaveAttribute('aria-checked', 'false');
  await expect.poll(async () => context === 'demo' ? (await saved())?.answers[position] : Object.hasOwn((await saved())?.answers || {}, String(position))).toBe(context === 'demo' ? null : false);
  await page.reload();
  await expect(options(page).first()).toHaveAttribute('aria-checked', 'false');
  await options(page).nth(2).click();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(options(page).first()).toBeVisible();
  await page.getByRole('button', { name: 'Pregunta anterior', exact: true }).click();
  await expect(options(page).nth(2)).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(options(page).nth(2)).toHaveAttribute('aria-checked', 'true');
  const before = await saved();
  expect(before.answers[position]).toBe(context === 'demo' ? 2 : 'C');
});

test('default exam delivers only current editable answers and reload does not duplicate attempts', async ({ page }) => {
  await openContext(page, 'default');
  await options(page).nth(1).click();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await options(page).first().click();
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await expect(options(page).nth(1)).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Abrir menú de la pregunta', exact: true }).click();
  await page.getByRole('button', { name: 'Entregar ensayo', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '¿Entregar el ensayo?', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ensayo finalizado', exact: true })).toBeVisible();
  await expect.poll(async () => (await readState(page)).attempts.length).toBe(2);
  const attempts = (await readState(page)).attempts;
  expect(attempts.find(a => a.questionId === firstMeta.id).answer).toBe('B');
  expect(attempts.find(a => a.questionId === shortMeta.id).answer).toBe('A');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ensayo finalizado', exact: true })).toBeVisible();
  expect((await readState(page)).attempts).toEqual(attempts);
});

test('imported exam delivery freezes the edited answer and survives reload', async ({ page }) => {
  const { importedId } = await openContext(page, 'imported');
  const key = 'paessed-imported-essay-progress-v1-' + importedId;
  await options(page).first().click();
  await options(page).nth(1).click();
  await page.getByRole('button', { name: 'Abrir menú de la pregunta', exact: true }).click();
  await page.getByRole('button', { name: 'Entregar ensayo', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ensayo entregado', exact: true })).toBeVisible();
  await expect(options(page).nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(options(page).nth(1)).toBeDisabled();
  const answers = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).submittedAnswers, key);
  expect(answers['1']).toBe('B');
  const attempts = (await readState(page))?.attempts ?? [];
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ensayo entregado', exact: true })).toBeVisible();
  await expect(options(page).nth(1)).toBeDisabled();
  expect((await readState(page))?.attempts ?? []).toEqual(attempts);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).submittedAnswers, key)).toEqual(answers);
});

test('a new demo exam never restores the previous session ink', async ({ page }) => {
  await openContext(page, 'demo');
  const sessionKey = 'paessed-demo-ink-session:practice';
  const oldSession = await page.evaluate(key => localStorage.getItem(key), sessionKey);
  const canvas = page.getByTestId('learning-ink-sheet').locator('canvas');
  const box = await canvas.boundingBox();
  await page.getByRole('button', { name: 'Activar lápiz', exact: true }).click();
  await page.mouse.move(box.x + 30, box.y + 30); await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 50, { steps: 8 }); await page.mouse.up();
  await page.getByRole('button', { name: 'Abrir menú de la pregunta', exact: true }).click();
  await page.getByRole('button', { name: 'Finalizar ensayo', exact: true }).click();
  await page.getByRole('button', { name: 'Entregar ensayo', exact: true }).click();
  await expect(page).toHaveURL(/\/ensayos\/resultado$/);
  await expect(page.getByText('Ensayo completado', { exact: true })).toBeVisible();
  // A fresh tab shares persisted progress but cannot reuse the previous React tree.
  const fresh = await page.context().newPage();
  fresh.on('pageerror', error => errors.get(page).push(error.message));
  await openContext(fresh, 'demo');
  const nextSession = await fresh.evaluate(key => localStorage.getItem(key), sessionKey);
  expect(oldSession).toBeTruthy(); expect(nextSession).toBeTruthy(); expect(nextSession).not.toBe(oldSession);
  expect(await fresh.getByTestId('learning-ink-sheet').locator('canvas').evaluate(el => el.getContext('2d').getImageData(0, 0, el.width, el.height).data.some((value, i) => i % 4 === 3 && value > 0))).toBe(false);
});

test('Playground keeps unverified imported answers neutral', async ({ page }) => {
  const id = await importPackage(page, { name: 'pending-key.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ questions: [{ number: 1, stem: 'Pregunta sin clave verificada', options: ['uno', 'dos', 'tres', 'cuatro'], answer: { status: 'pending', label: 'A' } }] })) });
  await page.goto('/app/playground');
  await page.getByLabel('Primera pregunta').selectOption('imported:' + id + ':0');
  await page.getByRole('button', { name: /Comenzar práctica/ }).click();
  await expect(page.getByTestId('learning-ink-sheet')).toHaveAttribute('data-ink-ready', 'true');
  await options(page).first().click();
  await page.getByRole('button', { name: 'Comprobar respuesta', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar respuesta', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'esta pregunta no tiene clave verificada' })).toBeVisible();
  await expect(page.locator('[role=radio][data-answer-status=neutral]')).toHaveCount(4);
  await expect(page.locator('[data-answer-status=correct], [data-answer-status=incorrect]')).toHaveCount(0);
  expect((await readState(page))?.attempts ?? []).toEqual([]);
});

test('external AI pauses the optional question timer and closing it resumes time', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    localStorage.setItem('paessed-learning-timer-enabled', 'true');
    localStorage.setItem('paessed-ai-assistance-v1', JSON.stringify({ enabled: true, provider: 'chatgpt', customUrl: '' }));
  });
  await openContext(page, 'demo');
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
  const timer = page.getByTestId('learning-question-timer');
  await page.clock.runFor(3000);
  const before = await timer.textContent();
  await page.getByRole('button', { name: 'Preguntar a la IA', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Prompt para preguntar a la IA', exact: true })).toBeVisible();
  await page.clock.runFor(10000);
  expect(await timer.textContent()).toBe(before);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.clock.runFor(2000);
  expect(await timer.textContent()).not.toBe(before);
});
