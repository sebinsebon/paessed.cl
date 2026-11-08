import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createLearningState, getLearningStats, getProfile, planLearning, reduceLearning } from "../lib/learning/engine.ts";
import { M1_AXES } from "../lib/m1-curriculum.ts";
const source = JSON.parse(await readFile(new URL("../lib/default-catalog.json", import.meta.url), "utf8"));
const catalog = source.questions.filter(q => q.eligible);
const start = "2026-03-01T16:00:00.000Z";
const axes = M1_AXES.map(a => a.id);
const rows = [];
for (const days of [30, 60, 90]) for (const goal of [1, 2, 3]) {
  let state = planLearning({ ...createLearningState(start), learnerId: "simulation", seed: 42, goal }, catalog, start);
  let calibrationDay = null;
  for (let day = 0; day < days; day++) {
    const at = new Date(Date.parse(start) + day * 86400000).toISOString();
    const act = action => { state = reduceLearning(state, action, catalog, at); };
    for (let slot = 0; slot < goal; slot++) {
      const node = state.nodes.find(n => n.state !== "completed");
      act({ type: "start-node", nodeId: node.id });
      node.questionIds.forEach((questionId, i) => {
        const q = catalog.find(q => q.id === questionId);
        const axis = axes.indexOf(q.axisId);
        const chance = Math.min(.9, [.4, .5, .6, .7][axis] + day * .002);
        const random = ((node.position * 37 + i * 23 + day * 13) % 100) / 100;
        const wrong = q.correct === "A" ? "B" : "A";
        act({ type: "answer", nodeId: node.id, questionId, answer: random < chance ? q.correct : wrong });
      });
      const current = state.nodes.find(n => n.id === node.id);
      for (const [questionId, correction] of Object.entries(current.corrections)) {
        if (correction.resolved) continue;
        act({ type: "retry", nodeId: node.id, questionId, answer: catalog.find(q => q.id === questionId).correct });
      }
      act({ type: "complete-node", nodeId: node.id });
      if (calibrationDay === null && getProfile(state).axes.every(a => a.calibrated)) calibrationDay = day + 1;
    }
  }
  const at = new Date(Date.parse(start) + (days - 1) * 86400000).toISOString();
  const stats = getLearningStats(state, at);
  const completed = state.nodes.filter(n => n.state === "completed");
  const valid = state.attempts.filter(a => a.eligible);
  const r = completed.filter(n => n.type === "R");
  assert.equal(completed.length, days * goal);
  assert.equal(stats.streak, days);
  assert.equal(new Set(valid.map(a => a.questionId)).size, valid.length);
  assert.equal(stats.xp, valid.length * 5);
  assert.equal(state.nodes.filter(n => n.state !== "completed").length, 7);
  const percentages = getProfile(state).axes.map(a => a.percent ?? 0);
  rows.push(`| ${days} | ${goal} | ${completed.length} | ${stats.xp} | ${valid.length} | ${state.attempts.length - valid.length} | ${calibrationDay ?? "—"} | ${percentages.map(v => v.toFixed(1)).join(" / ")} | ${r.filter(n => n.exploration).length}/${r.length} |`);
}
const report = `# Aprender: simulación reproducible\n\nComando: \`node --experimental-strip-types tests/learning-simulation.mjs\`. Semilla 42; catálogo real de ${catalog.length} preguntas elegibles; inicio 1 de marzo de 2026, un estudiante independiente por fila.\n\nHipótesis de simulación: práctica diaria sin diagnóstico; probabilidad sintética inicial de acierto por eje 40/50/60/70 %, con incremento de 0,2 puntos diarios y tope 90 %. Las correcciones se resuelven al primer reintento y no cambian la respuesta original ni el dominio. Son escenarios de verificación del motor, no predicciones pedagógicas ni una validación empírica de su eficacia.\n\n| Días | Meta | Nodos completados | XP | Evidencias únicas | Intentos repetidos | Día 4 ejes calibrados | Dominio N / A / G / D (%) | R exploración / total |\n| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |\n${rows.join("\n")}\n\nEn las nueve ejecuciones se verificó: cantidad exacta de nodos y racha; siete próximos/actuales; ausencia de evidencia duplicada; XP igual a cinco por primera respuesta elegible en nodos completados. Al agotarse preguntas nuevas se conserva la práctica y la racha, y las repeticiones dejan de sumar dominio o XP. Los nodos M siguen una rotación equitativa; R cambia de exploración a debilidades cuando cada eje reúne 15 respuestas válidas.\n\nLas pruebas adicionales cubren saltos de día sin decaimiento por calendario, cambios de meta efectivos al día siguiente, límites 30/10 puntos de grupos débiles, puntaje original 3/5 inmutable, dos fallos antes de revisar una solución, restauración y concurrencia real de IndexedDB entre pestañas.\n`;
await mkdir(new URL("../docs/", import.meta.url), { recursive: true });
await writeFile(new URL("../docs/learning-simulation.md", import.meta.url), report);
console.log(report);
