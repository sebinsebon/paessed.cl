const { test, expect } = require("@playwright/test");
const index = require("../lib/default-catalog.json").questions.filter(q => q.eligible);
const metas = index.filter(q => q.examId === index[0].examId).slice(0, 3);
const prefix = "paessed-imported-essay-progress-v1-";
async function seed(page, { legacy = false, unrelated = false } = {}) {
  await page.goto("/app/ensayos");
  await page.evaluate(async ({ metas, legacy, unrelated, prefix }) => {
    localStorage.setItem("paessed-ai-assistance-v1", JSON.stringify({ enabled: true, provider: "chatgpt", customUrl: "" }));
    const id = "evidence-import";
    const data = { sources: unrelated ? [] : [{ id: "exam", sha256: metas[0].id.split(":")[1] }], questions: metas.map((q, i) => ({ number: q.number, stem: `Pregunta de prueba importada ${i + 1}`, options: ["uno", "dos", "tres", "cuatro"], answer: { status: i === 2 ? "pending" : "verified", label: q.correct } })) };
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("paessed-local", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("imported-exams", { keyPath: "summary.id" });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result; const tx = db.transaction("imported-exams", "readwrite"); tx.objectStore("imported-exams").put({ summary: { id, title: "Prueba importada de evidencia", fileName: "fixture.json", questionCount: 3, idCount: 3, answerCount: 3, assetCount: 0, referencedAssetCount: 0, importedAt: new Date().toISOString(), sourceKind: "json", issues: [], preview: [] }, finalJson: data }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    });
    if (legacy) localStorage.setItem(prefix + id, JSON.stringify({ index: 0, answers: { 0: metas[0].correct }, bookmarks: [], strokes: {} }));
  }, { metas, legacy, unrelated, prefix });
  await page.goto("/app/ensayos/importado/evidence-import");
  await expect(page.getByRole("radio").first()).toBeVisible();
}
async function state(page) {
  return page.evaluate(() => new Promise(resolve => { const request = indexedDB.open("paessed-learning", 1); request.onsuccess = () => { const db = request.result; if (!db.objectStoreNames.contains("state")) { db.close(); resolve(null); return; } const get = db.transaction("state").objectStore("state").get("current"); get.onsuccess = () => { db.close(); resolve(get.result ?? null); }; }; }));
}
async function choose(page, letter) { await page.getByRole("radio").nth(letter.charCodeAt(0) - 65).click(); }
async function deliver(page) {
  if (!await page.getByRole("button", { name: "Entregar ensayo", exact: true }).isVisible()) await page.getByRole("button", { name: "Abrir menú de la pregunta", exact: true }).click();
  await page.getByRole("button", { name: "Entregar ensayo", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar entrega", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ensayo entregado", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(prefix => JSON.parse(localStorage.getItem(prefix + "evidence-import")).evidenceDelivered, prefix)).toBe(true);
}
test("original delivered answers only; assistance excludes, unverified keys ignored, reload stays immutable", async ({ page }) => {
  await seed(page);
  await expect.poll(async () => (await state(page))?.exposures.length).toBe(1);
  await choose(page, metas[0].correct);
  expect((await state(page)).attempts).toHaveLength(0);
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page.getByRole("button", { name: "Preguntar a la IA", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await choose(page, metas[1].correct);
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await choose(page, "A");
  await deliver(page);
  let saved = await state(page);
  expect(saved.attempts).toHaveLength(2);
  expect(saved.attempts.filter(a => a.eligible)).toHaveLength(1);
  expect(saved.attempts.find(a => a.questionId === metas[1].id).assisted).toBe(true);
  const originals = saved.attempts;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ensayo entregado", exact: true })).toBeVisible();
  await expect(page.getByRole("radio").first()).toBeDisabled();
  await page.getByRole("button", { name: "Pregunta anterior", exact: true }).click();
  await page.getByRole("button", { name: "Pregunta anterior", exact: true }).click();
  await page.getByRole("button", { name: "Preguntar a la IA", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  saved = await state(page);
  expect(saved.attempts).toEqual(originals);
});
test("legacy answers remain viewable and cannot become new eligible evidence", async ({ page }) => {
  await seed(page, { legacy: true });
  await deliver(page);
  const saved = await state(page);
  expect(saved.attempts).toHaveLength(1);
  expect(saved.attempts[0].eligible).toBe(false);
  expect(saved.exposures.some(e => e.sessionId.startsWith("legacy-import:"))).toBe(true);
});
test("unrelated imports keep the viewer and delivery without invented correctness or mastery", async ({ page }) => {
  await seed(page, { unrelated: true });
  await choose(page, "A");
  await deliver(page);
  await expect(page.getByText("Este archivo no tiene respuestas evaluables con clave verificada del banco Default.", { exact: true })).toBeVisible();
  expect((await state(page))?.attempts ?? []).toHaveLength(0);
});
