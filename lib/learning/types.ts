import type { M1AxisId, M1UnitId } from "../m1-curriculum";

export type DailyGoal = 1 | 2 | 3;
export type LearningMode = "diagnostic" | "learn" | "playground" | "exam";
export type LearningQuestion = {
  id: string; examId: string; number: number; axisId: M1AxisId;
  unitId: M1UnitId; revision: string; correct: string; eligible: boolean;
};
export type Exposure = { questionId: string; sessionId: string; mode: LearningMode; at: string; assisted: boolean; assistedAt?: string };
export type LearningAttempt = {
  id: string; questionId: string; sessionId: string; mode: LearningMode;
  axisId: M1AxisId; unitId: M1UnitId; revision: string; answer: string;
  correct: boolean; eligible: boolean; assisted: boolean; at: string;
};
export type Correction = { tries: number; resolved: boolean; viaSolution: boolean };
export type LearningNode = {
  id: string; position: number; type: "M" | "R"; axisId: M1AxisId;
  unitId: M1UnitId; questionIds: string[];
  state: "future" | "active" | "correction" | "completed";
  index: number; answers: Record<string, string>; corrections: Record<string, Correction>;
  startedAt?: string; completedAt?: string; originalCorrect?: number; xp?: number;
  exploration?: boolean; substitution?: boolean;
};
export type DiagnosticSession = {
  id: string; questionIds: string[]; answers: Record<string, string>;
  startedAt: string; completedAt?: string;
};
export type LearningState = {
  version: 1; learnerId: string; seed: number; revision: number;
  goal: DailyGoal; pendingGoal?: { goal: DailyGoal; effectiveDate: string };
  attempts: LearningAttempt[]; exposures: Exposure[]; nodes: LearningNode[];
  diagnostic: DiagnosticSession | null;
};
export type UnitProfile = { unitId: M1UnitId; axisId: M1AxisId; count: number; percent: number | null };
export type AxisProfile = {
  axisId: M1AxisId; count: number; percent: number | null; calibrated: boolean;
  coveredUnits: number; totalUnits: number;
};
export type LearningProfile = { axes: AxisProfile[]; units: UnitProfile[] };
export type LearningAction =
  | { type: "set-goal"; goal: DailyGoal }
  | { type: "start-node"; nodeId: string }
  | { type: "answer"; nodeId: string; questionId: string; answer: string }
  | { type: "retry"; nodeId: string; questionId: string; answer: string }
  | { type: "review"; nodeId: string; questionId: string }
  | { type: "complete-node"; nodeId: string }
  | { type: "start-diagnostic" }
  | { type: "answer-diagnostic"; questionId: string; answer: string }
  | { type: "complete-diagnostic" }
  | { type: "external-attempt"; questionId: string; answer: string; mode: LearningMode; sessionId: string; assisted?: boolean }
  | { type: "expose"; questionId: string; mode: LearningMode; sessionId: string; assisted?: boolean };
