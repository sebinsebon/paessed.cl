import { M1_AXES, M1_UNITS } from "../m1-curriculum.ts";
import type { M1AxisId, M1UnitId } from "../m1-curriculum";
import type { DailyGoal, LearningAction, LearningAttempt, LearningNode, LearningProfile, LearningQuestion, LearningState } from "./types";

const axes = M1_AXES.map(a => a.id);
const units = M1_UNITS;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const timestamp = (now?: string) => {
  const date = new Date(now ?? Date.now());
  if (!Number.isFinite(date.getTime())) throw new Error("Fecha de aprendizaje inválida.");
  return date.toISOString();
};

/** Day boundaries follow the learner's local timezone, including DST. */
export function localDate(now?: string): string {
  const date = new Date(timestamp(now));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function nextDay(now: string) {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  return localDate(date.toISOString());
}
function previousDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return localDate(new Date(y, m - 1, d - 1, 12).toISOString());
}
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function createLearningState(now?: string): LearningState {
  timestamp(now);
  const learnerId = globalThis.crypto?.randomUUID?.() ?? `learner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { version: 1, learnerId, seed: hash(learnerId), revision: 0, goal: 2, attempts: [], exposures: [], nodes: [], diagnostic: null };
}

export function getProfile(state: LearningState): LearningProfile {
  const eligible = state.attempts.filter(a => a.eligible && !a.assisted);
  const profileUnits = units.map(unit => {
    const attempts = eligible.filter(a => a.unitId === unit.id);
    let weight = 0, correct = 0;
    attempts.forEach((attempt, i) => {
      const w = 0.95 ** ((attempts.length - 1 - i) / 5);
      weight += w;
      correct += Number(attempt.correct) * w;
    });
    return { unitId: unit.id, axisId: unit.axisId, count: attempts.length, percent: weight ? 100 * correct / weight : null };
  });
  return { units: profileUnits, axes: M1_AXES.map(axis => {
    const all = profileUnits.filter(u => u.axisId === axis.id);
    const observed = all.filter(u => u.percent !== null);
    const count = all.reduce((sum, u) => sum + u.count, 0);
    return { axisId: axis.id, count, percent: observed.length ? observed.reduce((sum, u) => sum + u.percent!, 0) / observed.length : null, calibrated: count >= 15, coveredUnits: observed.length, totalUnits: all.length };
  }) };
}

// Each seeded block has exactly four maintenance and three reinforcement nodes.
// Rejecting triples also considers the previous block's trailing two positions.
const typeCache = new Map<number, ("M" | "R")[]>();
function nodeTypes(seed: number, length: number): ("M" | "R")[] {
  if (!typeCache.has(seed)) { if (typeCache.size > 32) typeCache.clear(); typeCache.set(seed, []); }
  const result = typeCache.get(seed)!;
  for (let block = result.length / 7; result.length < length; block++) {
    const candidates: ("M" | "R")[][] = [];
    function visit(path: ("M" | "R")[], m: number, r: number) {
      if (path.length === 7) { candidates.push(path); return; }
      for (const type of ["M", "R"] as const) {
        if ((type === "M" ? m : r) === 0) continue;
        const tail = [...result.slice(-2), ...path];
        if (tail.at(-1) === type && tail.at(-2) === type) continue;
        visit([...path, type], m - Number(type === "M"), r - Number(type === "R"));
      }
    }
    visit([], 4, 3);
    result.push(...candidates[hash(`${seed}:${block}`) % candidates.length]);
  }
  return result.slice(0, length);
}
function countNodes(nodes: LearningNode[], axisId?: M1AxisId, unitId?: M1UnitId, type?: "M" | "R") {
  return nodes.filter(n => (!axisId || n.axisId === axisId) && (!unitId || n.unitId === unitId) && (!type || n.type === type)).length;
}
function selectTarget(profile: LearningProfile, prior: LearningNode[], type: "M" | "R") {
  let axisId: M1AxisId;
  let exploration = false;
  if (type === "M") {
    axisId = [...axes].sort((a, b) => countNodes(prior, a, undefined, "M") - countNodes(prior, b, undefined, "M") || axes.indexOf(a) - axes.indexOf(b))[0];
  } else {
    const uncalibrated = profile.axes.filter(a => !a.calibrated);
    exploration = uncalibrated.length > 0;
    let group = uncalibrated;
    if (!exploration) {
      const sorted = [...profile.axes].sort((a, b) => a.percent! - b.percent! || axes.indexOf(a.axisId) - axes.indexOf(b.axisId));
      group = sorted[1].percent! - sorted[0].percent! >= 30
        ? sorted.slice(0, 1)
        : sorted.filter((a, i) => i < 2 || a.percent! - sorted[0].percent! <= 10);
    }
    const lastR = [...prior].reverse().find(n => n.type === "R");
    const alternatives = group.filter(a => a.axisId !== lastR?.axisId);
    if (alternatives.length) group = alternatives;
    group.sort((a, b) => (exploration ? a.count - b.count : 0) || countNodes(prior, a.axisId, undefined, "R") - countNodes(prior, b.axisId, undefined, "R") || axes.indexOf(a.axisId) - axes.indexOf(b.axisId));
    axisId = group[0].axisId;
  }
  const axisUnits = profile.units.filter(u => u.axisId === axisId);
  axisUnits.sort((a, b) => {
    if (type === "R") {
      if ((a.count === 0) !== (b.count === 0)) return a.count === 0 ? -1 : 1;
      if (exploration && a.count !== b.count) return a.count - b.count;
    }
    return countNodes(prior, undefined, a.unitId, type) - countNodes(prior, undefined, b.unitId, type) || (type === "R" ? (a.percent ?? 0) - (b.percent ?? 0) : 0) || units.findIndex(u => u.id === a.unitId) - units.findIndex(u => u.id === b.unitId);
  });
  return { axisId, unitId: axisUnits[0].unitId, exploration };
}
function selectQuestions(state: LearningState, catalog: LearningQuestion[], prior: LearningNode[], unitId: M1UnitId, salt: string) {
  const seen = new Map<string, string>();
  for (const e of state.exposures) if ((seen.get(e.questionId) ?? "") < e.at) seen.set(e.questionId, e.at);
  for (const a of state.attempts) if ((seen.get(a.questionId) ?? "") < a.at) seen.set(a.questionId, a.at);
  const reserved = new Set(prior.filter(n => n.state !== "completed").flatMap(n => n.questionIds));
  const unique = [...new Map(catalog.filter(q => q.eligible).map(q => [q.id, q])).values()];
  function sorted(list: LearningQuestion[]) {
    return list.sort((a, b) => Number(reserved.has(a.id)) - Number(reserved.has(b.id)) || Number(seen.has(a.id)) - Number(seen.has(b.id)) || (seen.get(a.id) ?? "").localeCompare(seen.get(b.id) ?? "") || hash(`${state.seed}:${salt}:${a.id}`) - hash(`${state.seed}:${salt}:${b.id}`) || a.id.localeCompare(b.id));
  }
  const sameUnit = sorted(unique.filter(q => q.unitId === unitId));
  const chosen = sameUnit.slice(0, 5);
  if (chosen.length < 5) chosen.push(...sorted(unique.filter(q => q.unitId !== unitId)).slice(0, 5 - chosen.length));
  return { questionIds: chosen.map(q => q.id), substitution: sameUnit.length < 5 };
}
export function planLearning(input: LearningState, catalog: LearningQuestion[], now?: string): LearningState {
  const state = clone(input);
  const today = localDate(now);
  if (state.pendingGoal && state.pendingGoal.effectiveDate <= today) {
    state.goal = state.pendingGoal.goal;
    delete state.pendingGoal;
  }
  const frozen = state.nodes.filter(n => n.state !== "future").sort((a, b) => a.position - b.position);
  const current = frozen.filter(n => n.state !== "completed").length;
  const first = frozen.length ? Math.max(...frozen.map(n => n.position)) + 1 : 0;
  const types = nodeTypes(state.seed, first + Math.max(0, 7 - current));
  const profile = getProfile(state);
  const planned = [...frozen];
  for (let position = first; position < types.length; position++) {
    const target = selectTarget(profile, planned, types[position]);
    const selection = selectQuestions(state, catalog, planned, target.unitId, String(position));
    planned.push({ id: `${state.learnerId}:node:${position}`, position, type: types[position], ...target, ...selection, state: "future", index: 0, answers: {}, corrections: {} });
  }
  state.nodes = planned;
  return state;
}
function expose(state: LearningState, questionId: string, sessionId: string, mode: LearningAttempt["mode"], assisted: boolean, at: string) {
  const existing = state.exposures.find(e => e.questionId === questionId && e.sessionId === sessionId);
  if (existing) {
    if (assisted && !existing.assisted) existing.assistedAt = at;
    existing.assisted ||= assisted;
  } else state.exposures.push({ questionId, sessionId, mode, at, assisted, ...(assisted ? { assistedAt: at } : {}) });
  // Reviewing help after a confirmed answer cannot rewrite that original.
}
function record(state: LearningState, question: LearningQuestion, sessionId: string, mode: LearningAttempt["mode"], answer: string, at: string, assisted = false) {
  if (state.attempts.some(a => a.questionId === question.id && a.sessionId === sessionId)) return;
  const prior = state.exposures.filter(e => e.questionId === question.id);
  const help = assisted || prior.some(e => e.sessionId === sessionId && e.assisted);
  const eligible = question.eligible && !help && !prior.some(e => e.sessionId !== sessionId) && !state.attempts.some(a => a.questionId === question.id);
  expose(state, question.id, sessionId, mode, help, at);
  state.attempts.push({ id: `${sessionId}:${question.id}`, questionId: question.id, sessionId, mode, axisId: question.axisId, unitId: question.unitId, revision: question.revision, answer, correct: answer === question.correct, eligible, assisted: help, at });
}
function complete(state: LearningState, node: LearningNode, at: string) {
  if (node.state === "completed") return;
  if (node.questionIds.length !== 5 || node.questionIds.some(id => !Object.hasOwn(node.answers, id)) || Object.values(node.corrections).some(c => !c.resolved)) throw new Error("Completa las cinco respuestas y sus correcciones antes de continuar.");
  node.state = "completed";
  node.completedAt = at;
  node.xp = state.attempts.filter(a => a.sessionId === node.id && a.eligible && !a.assisted).length * 5;
}
export function reduceLearning(input: LearningState, action: LearningAction, catalog: LearningQuestion[], now?: string): LearningState {
  const at = timestamp(now);
  const state = input.nodes.length ? clone(input) : planLearning(input, catalog, at);
  const question = (id: string) => {
    const q = catalog.find(q => q.id === id);
    if (!q) throw new Error("La pregunta no está disponible en el catálogo.");
    return q;
  };
  if (action.type === "set-goal") {
    if (![1, 2, 3].includes(action.goal)) throw new Error("Meta diaria inválida.");
    if (!state.diagnostic && !state.attempts.length && !state.nodes.some(n => n.startedAt)) { state.goal = action.goal; delete state.pendingGoal; }
    else state.pendingGoal = { goal: action.goal, effectiveDate: nextDay(at) };
  } else if (action.type === "expose") {
    question(action.questionId);
    if (action.mode === "diagnostic" && action.assisted) throw new Error("El diagnóstico se responde sin ayuda.");
    expose(state, action.questionId, action.sessionId, action.mode, !!action.assisted, at);
  } else if (action.type === "external-attempt") {
    if (!["exam", "playground"].includes(action.mode)) throw new Error("Modo externo inválido.");
    if (action.assisted) expose(state, action.questionId, action.sessionId, action.mode, true, at);
    record(state, question(action.questionId), action.sessionId, action.mode, action.answer, at, action.assisted);
  } else if (action.type === "start-diagnostic") {
    if (!state.diagnostic) {
      const chosen = units.map(u => selectQuestions(state, catalog.filter(q => q.unitId === u.id), [], u.id, `diagnostic:${u.id}`).questionIds[0]);
      if (chosen.some(id => !id)) throw new Error("Faltan preguntas para el diagnóstico de 16 subejes.");
      state.diagnostic = { id: `${state.learnerId}:diagnostic`, questionIds: chosen, answers: {}, startedAt: at };
    }
  } else if (action.type === "answer-diagnostic") {
    const d = state.diagnostic;
    if (!d || d.completedAt || !d.questionIds.includes(action.questionId)) throw new Error("Pregunta de diagnóstico inválida.");
    if (!Object.hasOwn(d.answers, action.questionId)) {
      d.answers[action.questionId] = action.answer;
      record(state, question(action.questionId), d.id, "diagnostic", action.answer, at);
    }
  } else if (action.type === "complete-diagnostic") {
    if (!state.diagnostic || state.diagnostic.questionIds.length !== 16 || state.diagnostic.questionIds.some(id => !Object.hasOwn(state.diagnostic!.answers, id))) throw new Error("Responde las 16 preguntas antes de terminar el diagnóstico.");
    state.diagnostic.completedAt ??= at;
  } else {
    const node = state.nodes.find(n => n.id === action.nodeId);
    if (!node) throw new Error("Nodo de aprendizaje no disponible.");
    if (action.type === "start-node") {
      if (node.state === "future") {
        if (state.nodes.some(n => n.position < node.position && n.state !== "completed")) throw new Error("Completa el nodo anterior para continuar.");
        if (state.diagnostic && !state.diagnostic.completedAt) throw new Error("Termina el diagnóstico antes de comenzar un nodo.");
        if (node.questionIds.length !== 5) throw new Error("No hay cinco preguntas disponibles para este nodo.");
        node.state = "active"; node.startedAt = at;
      }
    } else if (action.type === "answer") {
      if (!node.questionIds.includes(action.questionId)) throw new Error("La pregunta no pertenece a este nodo.");
      if (!Object.hasOwn(node.answers, action.questionId)) {
        if (node.state !== "active" || node.questionIds[node.index] !== action.questionId) throw new Error("Responde la pregunta actual del nodo.");
        node.answers[action.questionId] = action.answer;
        record(state, question(action.questionId), node.id, "learn", action.answer, at);
        node.index = Object.keys(node.answers).length;
        if (node.index === 5) {
          node.originalCorrect = node.questionIds.filter(id => state.attempts.find(a => a.questionId === id && a.sessionId === node.id)?.correct).length;
          for (const id of node.questionIds) if (!state.attempts.find(a => a.questionId === id && a.sessionId === node.id)?.correct) node.corrections[id] = { tries: 0, resolved: false, viaSolution: false };
          node.state = "correction";
          if (!Object.keys(node.corrections).length) complete(state, node, at);
        }
      }
    } else if (action.type === "retry" || action.type === "review") {
      const correction = node.corrections[action.questionId];
      if (node.state !== "correction" || !correction) throw new Error("Esta pregunta no necesita corrección.");
      if (!correction.resolved) {
        if (action.type === "review") {
          if (correction.tries < 2) throw new Error("Intenta corregir la pregunta dos veces antes de revisar la solución.");
          correction.resolved = true; correction.viaSolution = true;
        } else if (action.answer === question(action.questionId).correct) correction.resolved = true;
        else correction.tries++;
      }
    } else if (action.type === "complete-node") complete(state, node, at);
  }
  const result = planLearning(state, catalog, at);
  result.revision = input.revision + Number(JSON.stringify({ ...result, revision: 0 }) !== JSON.stringify({ ...input, revision: 0 }));
  return result;
}
export function getLearningStats(state: LearningState, now?: string): { today: number; streak: number; xp: number; goal: DailyGoal } {
  const todayDate = localDate(now);
  const days = new Set(state.nodes.filter(n => n.state === "completed" && n.completedAt).map(n => localDate(n.completedAt)));
  let day = days.has(todayDate) ? todayDate : previousDay(todayDate), streak = 0;
  while (days.has(day)) { streak++; day = previousDay(day); }
  return { today: state.nodes.filter(n => n.state === "completed" && n.completedAt && localDate(n.completedAt) === todayDate).length, streak, xp: state.nodes.reduce((sum, n) => sum + (n.state === "completed" ? n.xp ?? 0 : 0), 0), goal: state.pendingGoal && state.pendingGoal.effectiveDate <= todayDate ? state.pendingGoal.goal : state.goal };
}
