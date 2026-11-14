import catalogData from "../default-catalog.json" with { type: "json" };
import { M1_UNITS } from "../m1-curriculum.ts";
import { hasCompletedInitialDiagnostic } from "./engine.ts";
import { validateLearningState } from "./repository.ts";
import type { LearningQuestion, LearningState } from "./types";
import { onboardingSchema, type OnboardingStatus, type OnboardingSubmission } from "../sync/contracts.ts";
import { HttpError } from "../http-error.ts";

const catalog = new Map((catalogData.questions as LearningQuestion[]).map(q => [q.id, q]));

export function onboardingStatus(state?: LearningState): OnboardingStatus {
  return {
    complete: !!state && hasCompletedInitialDiagnostic(state),
    hasEvidence: !!state?.attempts.length || !!state?.exposures.length || !!state?.nodes.some(n => n.state !== "future"),
    hasDiagnostic: !!state?.diagnostic || !!state?.initialDiagnostic,
    handoffComplete: !!state?.initialDiagnostic,
    handledDiagnosticIds: [...new Set([...(state?.diagnosticHandoffs ?? []).map(r => r.sourceId), ...(state?.initialDiagnostic ? [state.initialDiagnostic.sourceId] : [])])],
  };
}

export function validateGuestDiagnostic(value: unknown): OnboardingSubmission {
  const parsed = onboardingSchema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, "Completa un diagnóstico válido de 16 preguntas antes de incorporarlo.");
  const submission = parsed.data, d = submission.diagnostic;
  const ids = new Set(d.questionIds);
  const questions = d.questionIds.map(id => catalog.get(id));
  if (ids.size !== 16 || Object.keys(d.answers).length !== 16 || Object.keys(d.answers).some(id => !ids.has(id)) ||
    questions.some(q => !q?.eligible) || M1_UNITS.some(unit => questions.filter(q => q?.unitId === unit.id).length !== 1) ||
    submission.priorQuestionIds.some(id => !ids.has(id)) || submission.assistedQuestionIds.some(id => !ids.has(id)) ||
    Date.parse(d.startedAt) > Date.parse(d.completedAt) || Date.parse(d.completedAt) > Date.now() + 300_000) {
    throw new HttpError(400, "El diagnóstico debe contener una respuesta original por cada uno de los 16 subejes.");
  }
  return submission;
}

/** One bounded handoff. Never replaces a route, an original answer or prior mastery. */
export function incorporateGuestDiagnostic(input: LearningState, value: unknown, now = new Date().toISOString()): LearningState {
  const submission = validateGuestDiagnostic(value);
  if (onboardingStatus(input).handledDiagnosticIds.includes(submission.diagnostic.id)) return input;
  const receipts = [...(input.diagnosticHandoffs ?? [])];
  if (input.initialDiagnostic && !receipts.some(r => r.sourceId === input.initialDiagnostic!.sourceId)) receipts.push(input.initialDiagnostic);
  if (receipts.length >= 64) throw new HttpError(429, "Se alcanzó el límite de diagnósticos incorporados. Tu diagnóstico sigue guardado en este dispositivo.");
  const state = structuredClone(input), d = submission.diagnostic;
  // An empty account needs this first signal automatically. Existing accounts choose.
  const status = onboardingStatus(input);
  const includeEvidence = !status.hasEvidence && !status.hasDiagnostic || submission.includeEvidence;
  if (includeEvidence) {
    for (const id of d.questionIds) {
      const q = catalog.get(id)!;
      if (state.attempts.some(a => a.sessionId === d.id && a.questionId === id)) continue;
      // Retain prior guest exposure as a fact, so later restore/rebuild cannot
      // accidentally promote a repeated guest answer into fresh evidence.
      if (submission.priorQuestionIds.includes(id)) {
        const priorSession = `guest-prior:${id}`;
        if (!state.exposures.some(e => e.questionId === id && e.sessionId === priorSession)) {
          state.exposures.push({ questionId: id, sessionId: priorSession, mode: "diagnostic", at: now, assisted: false });
        }
      }
      const assisted = submission.assistedQuestionIds.includes(id) || state.exposures.some(e => e.questionId === id && e.sessionId === d.id && e.assisted);
      const eligible = q.eligible && !assisted && !submission.priorQuestionIds.includes(id) &&
        !state.attempts.some(a => a.questionId === id) && !state.exposures.some(e => e.questionId === id && e.sessionId !== d.id);
      state.attempts.push({ id: `${d.id}:${id}`, questionId: id, sessionId: d.id, mode: "diagnostic", axisId: q.axisId,
        unitId: q.unitId, revision: q.revision, answer: d.answers[id], correct: d.answers[id] === q.correct,
        eligible, assisted, at: now });
      if (!state.exposures.some(e => e.questionId === id && e.sessionId === d.id)) {
        state.exposures.push({ questionId: id, sessionId: d.id, mode: "diagnostic", at: now, assisted });
      }
    }
    state.diagnostic ??= structuredClone(d);
  }
  state.initialDiagnostic = { sourceId: d.id, completedAt: now, includeEvidence };
  state.diagnosticHandoffs = [...receipts, state.initialDiagnostic];
  state.revision++;
  return validateLearningState(state);
}
