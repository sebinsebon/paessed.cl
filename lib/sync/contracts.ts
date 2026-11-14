import { z } from "zod";
import type { LearningAction, LearningState } from "../learning/types";
import { CATALOG_REVISION } from "./protocol.ts";
import { validateLearningState } from "../learning/repository.ts";
export { CATALOG_REVISION };

const id = z.string().min(1).max(180).regex(/^[A-Za-z0-9:_-]+$/);
const questionId = z.string().regex(/^(?:demre|personal):[a-f0-9]{64}:[1-9][0-9]{0,3}$/);
const answer = z.string().regex(/^[A-E]$/);
const at = z.string().datetime({ offset: true });
const mode = z.enum(["diagnostic", "learn", "playground", "exam"]);
const learningActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("set-goal"), goal: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  z.strictObject({ type: z.literal("start-node"), nodeId: id }),
  z.strictObject({ type: z.literal("answer"), nodeId: id, questionId, answer }),
  z.strictObject({ type: z.literal("retry"), nodeId: id, questionId, answer }),
  z.strictObject({ type: z.literal("review"), nodeId: id, questionId }),
  z.strictObject({ type: z.literal("complete-node"), nodeId: id }),
  z.strictObject({ type: z.literal("start-diagnostic") }),
  z.strictObject({ type: z.literal("answer-diagnostic"), questionId, answer }),
  z.strictObject({ type: z.literal("complete-diagnostic") }),
  z.strictObject({ type: z.literal("external-attempt"), questionId, answer, mode, sessionId: id, assisted: z.boolean().optional() }),
  z.strictObject({ type: z.literal("expose"), questionId, mode, sessionId: id, assisted: z.boolean().optional() }),
]);
const attempts = z.strictObject({ id, questionId, sessionId: id, mode, axisId: id, unitId: id, revision: z.string().min(1).max(100), answer, correct: z.boolean(), eligible: z.boolean(), assisted: z.boolean(), at });
const exposure = z.strictObject({ questionId, sessionId: id, mode, at, assisted: z.boolean(), assistedAt: at.optional() });
const answers = z.record(questionId, answer).refine(v => Object.keys(v).length <= 1000, "Demasiadas respuestas");
const correction = z.strictObject({ tries: z.number().int().min(0).max(10000), resolved: z.boolean(), viaSolution: z.boolean() });
const diagnosticSessionSchema = z.strictObject({ id: id.max(100), questionIds: z.array(questionId).length(16), answers, startedAt: at, completedAt: at });
/** Only the 16 originals and exposure facts cross the guest/account boundary. */
export const onboardingSchema = z.strictObject({
  diagnostic: diagnosticSessionSchema,
  priorQuestionIds: z.array(questionId).max(16).default([]),
  assistedQuestionIds: z.array(questionId).max(16).default([]),
  includeEvidence: z.boolean(),
});
export type OnboardingSubmission = z.infer<typeof onboardingSchema>;
export type OnboardingStatus = { complete: boolean; hasEvidence: boolean; hasDiagnostic: boolean; handoffComplete: boolean; handledDiagnosticIds: string[] };
const node = z.strictObject({ id, position: z.number().int().nonnegative().max(100000), type: z.enum(["M", "R"]), axisId: id, unitId: id,
  questionIds: z.array(questionId).max(5), state: z.enum(["future", "active", "correction", "completed"]), index: z.number().int().min(0).max(5),
  answers, corrections: z.record(questionId, correction), startedAt: at.optional(), completedAt: at.optional(), originalCorrect: z.number().int().min(0).max(5).optional(), xp: z.number().int().min(0).max(25).optional(), exploration: z.boolean().optional(), substitution: z.boolean().optional() });
export const learningStateSchema = z.strictObject({ version: z.literal(1), learnerId: id, seed: z.number().int().min(0).max(4294967295), revision: z.number().int().nonnegative(), goal: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  pendingGoal: z.strictObject({ goal: z.union([z.literal(1), z.literal(2), z.literal(3)]), effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).optional(),
  initialDiagnostic: z.strictObject({ sourceId: id, completedAt: at, includeEvidence: z.boolean() }).optional(),
  diagnosticHandoffs: z.array(z.strictObject({ sourceId: id, completedAt: at, includeEvidence: z.boolean() })).max(64).optional(),
  attempts: z.array(attempts).max(1000), exposures: z.array(exposure).max(2000), nodes: z.array(node).max(1000),
  diagnostic: z.strictObject({ id, questionIds: z.array(questionId).length(16), answers, startedAt: at, completedAt: at.optional() }).nullable() }).transform((value, ctx): LearningState => {
    try { return validateLearningState(value); }
    catch { ctx.addIssue({ code: "custom", message: "Estado de aprendizaje inválido." }); return z.NEVER; }
  });
export const sessionSchema = z.strictObject({ id: z.uuid(), index: z.number().int().min(0).max(999), questionIds: z.array(questionId).min(1).max(1000).optional(),
  answers, completedAt: at.optional(), assisted: z.array(questionId).max(1000).optional(), confirmed: z.array(questionId).max(1000).optional(), evidenceDelivered: z.boolean().optional(), sourceRevision: z.string().regex(/^[a-f0-9]{64}$/).optional() });
export const sourceIdSchema = z.string().regex(/^(?:default:m1-(?:invierno|regular|pdt)-\d{4}|sha256:[a-f0-9]{64}|playground:gold|playground)$/);
export const syncActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("learning"), action: learningActionSchema }),
  z.strictObject({ type: z.literal("session"), mode: z.enum(["exam", "playground"]), sourceId: sourceIdSchema, session: sessionSchema }),
  z.strictObject({ type: z.literal("saved-question"), questionId, deleted: z.boolean() }),
  z.strictObject({ type: z.literal("reset") }),
  z.strictObject({ type: z.literal("restore-learning"), state: learningStateSchema }),
]);
export const operationSchema = z.strictObject({ id: z.uuid(), deviceId: z.uuid(), sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), baseRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), generation: z.number().int().nonnegative(), contractVersion: z.literal(1), catalogRevision: z.literal(CATALOG_REVISION), at, action: syncActionSchema });
export const batchSchema = z.strictObject({ operations: z.array(operationSchema).min(1).max(50), cursor: z.number().int().nonnegative().optional() });
export const importSchema = z.strictObject({ operations: z.array(operationSchema).min(1).max(50), confirmed: z.literal(true), cursor: z.number().int().nonnegative().optional() });
export type SyncAction = { type: "learning"; action: LearningAction } | { type: "session"; mode: "exam" | "playground"; sourceId: string; session: z.infer<typeof sessionSchema> } | { type: "saved-question"; questionId: string; deleted: boolean } | { type: "reset" } | { type: "restore-learning"; state: LearningState };
export type SyncOperation = Omit<z.infer<typeof operationSchema>, "action"> & { action: SyncAction };
export type SyncChange = { revision: number; kind: "learning" | "session" | "saved-question" | "reset" | "conflict"; key: string; value: unknown };
export type SyncConflict = { id: string; kind: string; revision: number; current: unknown; alternative: unknown; resolved: boolean };
export type SyncResponse = { revision: number; generation: number; catalogRevision: string; acknowledgements: Array<{ id: string; sequence: number; status: "accepted" | "conflict" }>; changes: SyncChange[]; conflicts: SyncConflict[]; hasMore: boolean; cursor: number; capacity?: { warning: boolean; writesPaused: boolean } };
