import test from "node:test";
import assert from "node:assert/strict";
import { M1_AXES, M1_UNITS } from "../lib/m1-curriculum.ts";
import { createLearningState, getProfile, planLearning, reduceLearning, getLearningStats, localDate } from "../lib/learning/engine.ts";
import { validateLearningState } from "../lib/learning/repository.ts";

const NOW = "2026-03-01T16:00:00.000Z";
export const catalog = M1_UNITS.flatMap(u => Array.from({ length: 36 }, (_, i) => ({ id: `${u.id}:${i}`, examId: "fixture", number: i + 1, axisId: u.axisId, unitId: u.id, revision: "1", correct: "A", eligible: true })));
function initial() { return planLearning({ ...createLearningState(NOW), learnerId: "fixture", seed: 42 }, catalog, NOW); }
function act(state, action, at = NOW) { return reduceLearning(state, action, catalog, at); }
function finish(state, right = 5, at = NOW) {
  const id = state.nodes.find(n => n.state !== "completed").id;
  state = act(state, { type: "start-node", nodeId: id }, at);
  const questionIds = state.nodes.find(n => n.id === id).questionIds;
  questionIds.forEach((questionId, i) => { state = act(state, { type: "answer", nodeId: id, questionId, answer: i < right ? "A" : "B" }, at); });
  if (right < 5) {
    questionIds.slice(right).forEach(questionId => { state = act(state, { type: "retry", nodeId: id, questionId, answer: "A" }, at); });
    state = act(state, { type: "complete-node", nodeId: id }, at);
  }
  return state;
}
test("seven reproducible previews, seeded quotas, no three equal types across blocks", () => {
  let state = initial();
  assert.equal(state.nodes.length, 7);
  assert.deepEqual(planLearning(state, catalog, NOW), state);
  for (let i = 0; i < 28; i++) state = finish(state);
  for (let i = 0; i < 28; i += 7) {
    const block = state.nodes.slice(i, i + 7);
    assert.equal(block.filter(n => n.type === "M").length, 4);
    assert.equal(block.filter(n => n.type === "R").length, 3);
  }
  for (let i = 2; i < state.nodes.length; i++) assert.ok(new Set(state.nodes.slice(i - 2, i + 1).map(n => n.type)).size > 1);
  assert.equal(state.nodes.filter(n => n.state !== "completed").length, 7);
});
test("maintenance rotates all axes and their units equitably", () => {
  let state = initial();
  for (let i = 0; i < 84; i++) state = finish(state);
  const nodes = state.nodes.filter(n => n.type === "M");
  const counts = M1_AXES.map(a => nodes.filter(n => n.axisId === a.id).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  for (const axis of M1_AXES) {
    const unitCounts = axis.units.map(u => nodes.filter(n => n.unitId === u.id).length);
    assert.ok(Math.max(...unitCounts) - Math.min(...unitCounts) <= 1);
  }
});
test("3/5 score is frozen, correction starts after five originals, review after two failures", () => {
  let state = initial(), id = state.nodes[0].id;
  state = act(state, { type: "start-node", nodeId: id });
  const ids = state.nodes[0].questionIds;
  for (let i = 0; i < 4; i++) state = act(state, { type: "answer", nodeId: id, questionId: ids[i], answer: i < 3 ? "A" : "B" });
  assert.equal(state.nodes[0].state, "active");
  assert.deepEqual(state.nodes[0].corrections, {});
  assert.throws(() => act(state, { type: "retry", nodeId: id, questionId: ids[3], answer: "A" }));
  state = act(state, { type: "answer", nodeId: id, questionId: ids[4], answer: "B" });
  assert.equal(state.nodes[0].originalCorrect, 3);
  assert.equal(state.nodes[0].corrections[ids[3]].tries, 0);
  const original = structuredClone(state.attempts);
  state = act(state, { type: "answer", nodeId: id, questionId: ids[3], answer: "A" });
  assert.equal(state.nodes[0].answers[ids[3]], "B");
  assert.throws(() => act(state, { type: "complete-node", nodeId: id }));
  assert.throws(() => act(state, { type: "review", nodeId: id, questionId: ids[3] }));
  for (let i = 0; i < 2; i++) state = act(state, { type: "retry", nodeId: id, questionId: ids[3], answer: "C" });
  state = act(state, { type: "review", nodeId: id, questionId: ids[3] });
  state = act(state, { type: "retry", nodeId: id, questionId: ids[4], answer: "A" });
  state = act(state, { type: "complete-node", nodeId: id });
  assert.equal(state.nodes[0].originalCorrect, 3);
  assert.equal(state.nodes[0].xp, 25);
  assert.deepEqual(state.attempts, original);
  assert.equal(state.nodes[0].corrections[ids[3]].viaSolution, true);
  validateLearningState(state);
});
test("all five correct completes immediately, repeated submissions and completion are idempotent", () => {
  const state = finish(initial());
  assert.equal(state.nodes[0].state, "completed");
  assert.equal(state.nodes[0].originalCorrect, 5);
  assert.equal(state.attempts.length, 5);
  assert.deepEqual(act(state, { type: "complete-node", nodeId: state.nodes[0].id }), state);
});
test("active and completed content stay frozen when other modes add evidence", () => {
  let state = finish(initial());
  const completed = structuredClone(state.nodes[0]);
  const activeId = state.nodes[1].id;
  state = act(state, { type: "start-node", nodeId: activeId });
  const active = structuredClone(state.nodes[1]);
  state = act(state, { type: "external-attempt", questionId: catalog.at(-1).id, sessionId: "exam-1", mode: "exam", answer: "B" });
  assert.deepEqual(state.nodes[0], completed);
  assert.deepEqual(state.nodes[1], active);
});
test("diagnostic resumes 16 unique units, keeps immutable answers, requires all answers, no help", () => {
  let state = act(initial(), { type: "start-diagnostic" });
  const diagnostic = structuredClone(state.diagnostic);
  assert.equal(new Set(diagnostic.questionIds.map(id => catalog.find(q => q.id === id).unitId)).size, 16);
  assert.throws(() => act(state, { type: "complete-diagnostic" }));
  state = act(state, { type: "answer-diagnostic", questionId: diagnostic.questionIds[0], answer: "B" });
  state = act(state, { type: "start-diagnostic" });
  assert.equal(state.diagnostic.answers[diagnostic.questionIds[0]], "B");
  state = act(state, { type: "answer-diagnostic", questionId: diagnostic.questionIds[0], answer: "A" });
  assert.equal(state.diagnostic.answers[diagnostic.questionIds[0]], "B");
  for (const id of diagnostic.questionIds.slice(1)) state = act(state, { type: "answer-diagnostic", questionId: id, answer: "A" });
  state = act(state, { type: "complete-diagnostic" });
  assert.equal(state.attempts.filter(a => a.eligible).length, 16);
  assert.equal(getLearningStats(state, NOW).xp, 0);
  validateLearningState(state);
});
test("first exposure in same session counts, exposure in another mode excludes, assistance monotonic", () => {
  let state = initial();
  const q = catalog[0];
  state = act(state, { type: "expose", questionId: q.id, sessionId: "one", mode: "exam" });
  state = act(state, { type: "external-attempt", questionId: q.id, sessionId: "one", mode: "exam", answer: "A" });
  assert.equal(state.attempts[0].eligible, true);
  state = act(state, { type: "external-attempt", questionId: q.id, sessionId: "two", mode: "playground", answer: "B" });
  assert.equal(state.attempts[1].eligible, false);
  state = act(state, { type: "external-attempt", questionId: q.id, sessionId: "two", mode: "playground", answer: "A" });
  assert.equal(state.attempts.length, 2);
  assert.equal(state.attempts[1].answer, "B");
  state = act(state, { type: "expose", questionId: catalog[1].id, sessionId: "help", mode: "playground", assisted: true });
  state = act(state, { type: "expose", questionId: catalog[1].id, sessionId: "help", mode: "playground", assisted: false });
  state = act(state, { type: "external-attempt", questionId: catalog[1].id, sessionId: "help", mode: "playground", answer: "A" });
  assert.equal(state.attempts[2].eligible, false);
  assert.equal(state.attempts[2].assisted, true);
  state = act(state, { type: "expose", questionId: catalog[2].id, sessionId: "peek", mode: "exam" });
  state = act(state, { type: "external-attempt", questionId: catalog[2].id, sessionId: "new", mode: "playground", answer: "A" });
  assert.equal(state.attempts[3].eligible, false);
});
test("axis percent is equal unit mean, confidence reaches 15, weights use valid same-unit evidence only", () => {
  let state = initial();
  const list = catalog.filter(q => q.unitId === M1_UNITS[0].id);
  for (const [i, q] of list.slice(0, 14).entries()) state = act(state, { type: "external-attempt", questionId: q.id, sessionId: "exam", mode: "exam", answer: "A" });
  const other = catalog.find(q => q.unitId === M1_UNITS[1].id);
  state = act(state, { type: "external-attempt", questionId: other.id, sessionId: "exam", mode: "exam", answer: "B" });
  let profile = getProfile(state);
  assert.equal(profile.axes[0].percent, 50);
  assert.equal(profile.axes[0].calibrated, true);
  state = act(state, { type: "external-attempt", questionId: list[14].id, sessionId: "exam", mode: "exam", answer: "B" });
  profile = getProfile(state);
  const expected = Array.from({ length: 14 }, (_, i) => .95 ** ((14 - i) / 5)).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(profile.units[0].percent - 100 * expected / (expected + 1)) < 1e-10);
  assert.deepEqual(getProfile(planLearning(state, catalog, "2027-03-01T16:00:00Z")), profile);
});
test("help after original confirmation preserves evidence and XP; help before original excludes it", () => {
  let state = finish(initial());
  const original = structuredClone(state.attempts[0]);
  const xp = getLearningStats(state, NOW).xp;
  state = act(state, { type: "expose", questionId: original.questionId, sessionId: original.sessionId, mode: "learn", assisted: true }, "2026-03-01T16:01:00Z");
  assert.deepEqual(state.attempts[0], original);
  assert.equal(getLearningStats(state, NOW).xp, xp);
  assert.equal(state.exposures.find(e => e.questionId === original.questionId).assistedAt, "2026-03-01T16:01:00.000Z");
  state = act(state, { type: "external-attempt", questionId: original.questionId, sessionId: original.sessionId, mode: "exam", answer: "B", assisted: true }, "2026-03-01T16:02:00Z");
  assert.deepEqual(state.attempts[0], original, "late duplicate assistance cannot rewrite confirmed original");
  const fresh = catalog.find(q => !state.attempts.some(a => a.questionId === q.id));
  state = act(state, { type: "expose", questionId: fresh.id, sessionId: "help-first", mode: "playground", assisted: true }, "2026-03-01T17:00:00Z");
  state = act(state, { type: "external-attempt", questionId: fresh.id, sessionId: "help-first", mode: "playground", answer: "A" }, "2026-03-01T17:01:00Z");
  assert.equal(state.attempts.at(-1).eligible, false);
  assert.equal(state.attempts.at(-1).assisted, true);
  validateLearningState(state);
});
test("reinforcement explores uncalibrated axes and avoids consecutive reinforcement axes", () => {
  let state = initial();
  for (let i = 0; i < 21; i++) state = finish(state);
  const r = state.nodes.filter(n => n.type === "R");
  for (let i = 1; i < r.length; i++) if (r[i].exploration) assert.notEqual(r[i].axisId, r[i - 1].axisId);
});
test("calibrated reinforcement uses 30-point weakest-axis gap, otherwise lowest group", () => {
  function scored(scores) {
    const state = initial();
    for (const [axisIndex, axis] of M1_AXES.entries()) {
      const qs = catalog.filter(q => q.axisId === axis.id).slice(0, 20);
      qs.forEach((q, i) => {
        state.attempts.push({ id: `a:${q.id}`, questionId: q.id, sessionId: "e", mode: "exam", axisId: q.axisId, unitId: q.unitId, revision: q.revision, answer: i < scores[axisIndex] / 5 ? "A" : "B", correct: i < scores[axisIndex] / 5, eligible: true, assisted: false, at: NOW });
      });
    }
    return planLearning(state, catalog, NOW);
  }
  const one = scored([0, 100, 100, 100]);
  assert.ok(one.nodes.filter(n => n.type === "R").every(n => n.axisId === "numeros" && !n.exploration));
  const two = scored([0, 0, 100, 100]);
  assert.deepEqual(new Set(two.nodes.filter(n => n.type === "R").map(n => n.axisId)), new Set(["numeros", "algebra"]));
  const three = scored([0, 0, 0, 100]);
  assert.deepEqual(new Set(three.nodes.filter(n => n.type === "R").map(n => n.axisId)), new Set(["numeros", "algebra", "geometria"]));
});
test("question selection uses five distinct eligible canonical IDs, substitutes sparse unit", () => {
  let state = initial();
  assert.ok(state.nodes.every(n => n.questionIds.length === 5 && new Set(n.questionIds).size === 5));
  const sparse = catalog.filter(q => q.unitId !== state.nodes[0].unitId || q.number < 3);
  state = planLearning(state, sparse, NOW);
  assert.equal(state.nodes[0].substitution, true);
  assert.equal(state.nodes[0].questionIds.length, 5);
});
test("saturation allows repetitions but never new mastery or XP for repeated IDs", () => {
  const small = M1_UNITS.flatMap(u => catalog.filter(q => q.unitId === u.id).slice(0, 5));
  let state = planLearning(initial(), small, NOW);
  for (let i = 0; i < 80; i++) {
    const node = state.nodes.find(n => n.state !== "completed");
    state = reduceLearning(state, { type: "start-node", nodeId: node.id }, small, NOW);
    for (const id of node.questionIds) state = reduceLearning(state, { type: "answer", nodeId: node.id, questionId: id, answer: "A" }, small, NOW);
  }
  assert.equal(state.attempts.filter(a => a.eligible).length, 80);
  assert.equal(getLearningStats(state, NOW).xp, 400);
  assert.equal(state.attempts.length, 400);
  validateLearningState(state);
});
test("local streak counts completion days, repetitions count, missed day resets without mastery decay", () => {
  let state = finish(initial(), 5, NOW);
  state = finish(state, 5, "2026-03-02T16:00:00Z");
  state = finish(state, 5, "2026-03-02T17:00:00Z");
  assert.equal(getLearningStats(state, "2026-03-02T18:00:00Z").streak, 2);
  assert.equal(getLearningStats(state, "2026-03-02T18:00:00Z").today, 2);
  assert.equal(getLearningStats(state, "2026-03-03T18:00:00Z").streak, 2);
  assert.equal(getLearningStats(state, "2026-03-04T18:00:00Z").streak, 0);
  const profile = getProfile(state);
  assert.deepEqual(getProfile(planLearning(state, catalog, "2026-06-01T16:00:00Z")), profile);
  assert.equal(localDate(NOW), localDate(new Date(NOW).toISOString()));
});
test("goal changes apply tomorrow once work began and initial choice is immediate", () => {
  let state = act(initial(), { type: "set-goal", goal: 3 });
  assert.equal(state.goal, 3);
  state = finish(state);
  state = act(state, { type: "set-goal", goal: 1 });
  assert.equal(getLearningStats(state, NOW).goal, 3);
  assert.equal(getLearningStats(state, "2026-03-02T16:00:00Z").goal, 1);
  state = planLearning(state, catalog, "2026-03-02T16:00:00Z");
  assert.equal(state.goal, 1);
  assert.equal(state.pendingGoal, undefined);
});
test("strict backup validation rejects malformed, duplicates, impossible correction and incomplete completed node", () => {
  const good = finish(initial(), 3);
  assert.deepEqual(validateLearningState(good), good);
  for (const mutate of [s => { s.version = 2; }, s => { s.attempts.push(s.attempts[0]); }, s => { s.nodes[0].corrections[Object.keys(s.nodes[0].corrections)[0]].viaSolution = true; }, s => { delete s.nodes[0].answers[s.nodes[0].questionIds[0]]; }, s => { s.nodes[0].axisId = "invalid"; }, s => { s.goal = "2"; }]) {
    const broken = structuredClone(good); mutate(broken); assert.throws(() => validateLearningState(broken), /dañados/);
  }
});
for (const days of [30, 60, 90]) for (const goal of [1, 2, 3]) test(`${days} days at goal ${goal}: progression, streak, bounded eligible evidence`, () => {
  let state = act(initial(), { type: "set-goal", goal });
  let last;
  for (let d = 0; d < days; d++) {
    last = new Date(Date.parse(NOW) + d * 86400000).toISOString();
    for (let n = 0; n < goal; n++) state = finish(state, 5, last);
  }
  assert.equal(state.nodes.filter(n => n.state === "completed").length, days * goal);
  assert.equal(getLearningStats(state, last).streak, days);
  assert.equal(getLearningStats(state, last).today, goal);
  assert.ok(state.attempts.filter(a => a.eligible).length <= catalog.length);
  assert.equal(new Set(state.attempts.filter(a => a.eligible).map(a => a.questionId)).size, state.attempts.filter(a => a.eligible).length);
  validateLearningState(state);
});
