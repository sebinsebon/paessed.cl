const { expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');
const index = require('../lib/default-catalog.json');
const catalog = index.questions.filter(q => q.eligible);
const NODE_ID = 'mobile-validation-node';
const at = '2026-11-08T12:00:00.000Z';
let bank;

async function readBank() {
  if (!bank) bank = Promise.all(index.exams.map(async exam => {
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(__dirname, '../public', exam.packageUrl)));
    const data = JSON.parse(await zip.file('final.json').async('string'));
    return catalog.filter(q => q.examId === exam.id).map(meta => ({ meta, original: data.questions.find(q => Number(q.number) === meta.number) }));
  })).then(groups => groups.flat());
  return bank;
}

function fixtureState(meta, correction = false) {
  const questions = [meta, ...catalog.filter(q => q.id !== meta.id).slice(0, 4)];
  const diagnostic = catalog.slice(0, 16);
  return {
    version: 1, learnerId: 'mobile-validation', seed: 42, revision: 100, goal: 2, attempts: [], exposures: [],
    diagnostic: { id: 'mobile-diagnostic', questionIds: diagnostic.map(q => q.id), answers: Object.fromEntries(diagnostic.map(q => [q.id, q.correct])), startedAt: at, completedAt: at },
    nodes: [{ id: NODE_ID, position: 0, type: 'M', axisId: meta.axisId, unitId: meta.unitId,
      questionIds: questions.map(q => q.id), state: correction ? 'correction' : 'active', index: correction ? 5 : 0,
      answers: correction ? Object.fromEntries(questions.map(q => [q.id, q.correct === 'A' ? 'B' : 'A'])) : {},
      corrections: correction ? Object.fromEntries(questions.map(q => [q.id, { tries: 0, resolved: false, viaSolution: false }])) : {},
      startedAt: at, ...(correction ? { originalCorrect: 0 } : {}),
    }],
  };
}

async function writeState(page, value) {
  await page.evaluate(value => new Promise((resolve, reject) => {
    const request = indexedDB.open('paessed-learning', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('state'); request.result.createObjectStore('exam-sessions'); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('state', 'readwrite');
      const store = tx.objectStore('state');
      const read = store.get('current');
      read.onsuccess = () => { value.revision = Math.max(value.revision, (read.result?.revision || 0) + 1); store.put(value, 'current'); };
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => { db.close(); const channel = new BroadcastChannel('paessed-learning'); channel.postMessage('updated'); channel.close(); resolve(); };
    };
  }), value);
}

async function readState(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('paessed-learning', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result; const read = db.transaction('state').objectStore('state').get('current'); read.onsuccess = () => { db.close(); resolve(read.result); }; };
  }));
}

async function openNode(page, correction = false) {
  await page.locator('[data-testid="learning-route-node"][data-state="current"]').click();
  await page.getByRole('button', { name: 'Retomar sesión', exact: true }).click();
  if (correction) await page.getByRole('button', { name: 'Corregir mis errores', exact: true }).click();
}

async function seed(page, meta = catalog[0], { correction = false, theme = 'light' } = {}) {
  await page.goto('/app/aprender');
  await expect(page.getByRole('heading', { name: /Prepara tu ruta de M1|Aprender/, exact: true })).toBeVisible();
  await page.evaluate(theme => localStorage.setItem('paessed-question-paper-theme', theme), theme);
  await writeState(page, fixtureState(meta, correction));
  await page.reload();
  await openNode(page, correction);
  await ready(page, meta);
}

async function ready(page, meta) {
  await expect(page.getByTestId('learning-paper-stem')).toHaveAttribute('data-question-id', meta.id, { timeout: 60000 });
  await expect(page.getByRole('radio').first()).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.querySelectorAll('[data-testid="learning-paper-stem"] img')).map(img => img.decode().catch(() => {}))); });
  // Two frames let ResizeObserver measurements settle without a fixed sleep.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function geometry(page, { mobile = true } = {}) {
  const data = await page.evaluate(() => {
    const session = document.querySelector('[data-testid="learning-session"]');
    const scroll = document.querySelector('[data-testid="learning-question-scroll"]');
    const footer = document.querySelector('[data-testid="learning-session-actions"]');
    const options = [...document.querySelectorAll('[role="radio"]')];
    const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    return { documentWidth: document.documentElement.scrollWidth, width: innerWidth, height: innerHeight,
      session: rect(session), scroll: rect(scroll), scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth, footer: rect(footer),
      options: options.map(el => ({ ...rect(el), fontSize: getComputedStyle(el).fontSize })),
      brokenImages: [...session.querySelectorAll('img')].filter(img => !img.complete || img.naturalWidth === 0).length,
    };
  });
  expect(data.documentWidth, 'document must not overflow horizontally').toBeLessThanOrEqual(data.width + 1);
  expect(data.scrollWidth, 'question scroll container must not overflow horizontally').toBeLessThanOrEqual(data.clientWidth + 1);
  expect(data.footer.bottom).toBeLessThanOrEqual(data.height + 1);
  expect(data.footer.top).toBeGreaterThanOrEqual(0);
  expect(data.brokenImages).toBe(0);
  for (const option of data.options) {
    expect(option.left).toBeGreaterThanOrEqual(-1);
    expect(option.right).toBeLessThanOrEqual(data.width + 1);
    if (mobile) expect(option.height).toBeGreaterThanOrEqual(47.5);
  }
  return data;
}

module.exports = { catalog, NODE_ID, readBank, fixtureState, writeState, readState, openNode, seed, ready, geometry };
