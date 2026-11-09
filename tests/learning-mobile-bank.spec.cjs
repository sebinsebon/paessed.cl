const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { catalog, readBank, fixtureState, writeState, seed, ready, geometry } = require('./learning-mobile-helpers.cjs');

// The real, hash-verified Gold packages are rendered by the production workspace.
// A valid correction node allows changing its pending question without adding a
// test-only application route or changing the content of any exercise.
for (const width of [320, 390, 430]) test(`bank sweep: ${catalog.length} original questions at ${width}px`, async ({ page }, testInfo) => {
  test.skip(process.env.PAESSED_FULL_BANK !== '1', 'Set PAESSED_FULL_BANK=1 for the complete bank acceptance sweep.');
  test.setTimeout(30 * 60 * 1000);
  await page.setViewportSize({ width, height: 844 });
  const bank = await readBank();
  const report = [];
  await seed(page, bank[0].meta, { correction: true });
  for (const { meta, original } of bank) {
    await writeState(page, fixtureState(meta, true));
    await ready(page, meta);
    expect(await page.getByRole('radio').count(), meta.id).toBe(original.options.length);
    const box = await geometry(page);
    for (const radio of await page.getByRole('radio').all()) {
      await radio.evaluate(element => element.scrollIntoView({ behavior: 'instant', block: 'nearest' }));
      await expect(radio).toBeInViewport();
    }
    report.push({ id: meta.id, exam: meta.examId, number: meta.number, width, options: box.options.length, overflow: box.scrollWidth - box.clientWidth });
  }
  fs.writeFileSync(testInfo.outputPath(`bank-${width}.json`), JSON.stringify(report, null, 2));
  expect(report).toHaveLength(catalog.length);
});

test('twelve representative original exercises in light and dark', async ({ page }, testInfo) => {
  test.setTimeout(240000);
  const bank = await readBank();
  const selected = [];
  const add = predicate => { const found = bank.find(q => !selected.includes(q) && predicate(q.original)); if (found) selected.push(found); };
  add(q => q.options.length === 5);
  add(q => JSON.stringify(q.stem).includes('"type":"image"'));
  add(q => JSON.stringify(q.stem).includes('"type":"table"'));
  add(q => JSON.stringify(q.options).includes('"type":"image"'));
  add(q => JSON.stringify(q.options).includes('"type":"table"'));
  add(q => JSON.stringify(q).includes('frac'));
  add(q => JSON.stringify(q).includes('sqrt'));
  add(q => JSON.stringify(q).includes('matrix'));
  add(q => JSON.stringify(q.stem).length > 1500);
  add(q => q.options.some(o => JSON.stringify(o.blocks).length > 400));
  for (const q of bank) { if (selected.length >= 12) break; if (!selected.includes(q)) selected.push(q); }
  expect(selected).toHaveLength(12);
  for (const theme of ['light', 'dark']) {
    await seed(page, selected[0].meta, { correction: true, theme });
    for (const { meta } of selected) {
      await writeState(page, fixtureState(meta, true));
      await ready(page, meta);
      await geometry(page);
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${meta.examId}-${meta.number}.png`) });
      const scroll = page.getByTestId('learning-question-scroll');
      if (await scroll.evaluate(el => el.scrollHeight > el.clientHeight)) {
        await page.getByRole('radio').last().scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`${theme}-${meta.examId}-${meta.number}-alternatives.png`) });
      }
    }
    await page.getByRole('button', { name: 'Guardar y cerrar sesión', exact: true }).click();
  }
  fs.writeFileSync(testInfo.outputPath('representative-questions.json'), JSON.stringify(selected.map(q => q.meta), null, 2));
});
