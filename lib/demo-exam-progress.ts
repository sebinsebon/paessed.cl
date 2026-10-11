/**
 * Resumable progress for the prototype 65-question M1 essay.
 * Local-only by design: the imported .paessed viewer has a separate data flow.
 */
export const DEMO_EXAM_STORAGE_KEY = "paessed-demo-exam-progress-v1";
export const DEMO_EXAM_EVENT = "paessed-demo-exam-progress-changed";
export const DEMO_EXAM_QUESTION_COUNT = 65;
export const DEMO_EXAM_DURATION_SECONDS = 2 * 60 * 60 + 20 * 60;

export type SavedInkStroke = {
  color: string;
  points: Array<{ x: number; y: number }>;
};

export type DemoExamProgress = {
  version: 1;
  questionIndex: number;
  answers: Array<number | null>;
  flagged: boolean[];
  secondsLeft: number;
  strokesByQuestion: Record<number, SavedInkStroke[]>;
  savedAt: number;
};

export function parseDemoExamProgress(value: unknown): DemoExamProgress | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<DemoExamProgress>;
  if (candidate.version !== 1 ||
      !Number.isInteger(candidate.questionIndex) ||
      (candidate.questionIndex ?? -1) < 0 ||
      (candidate.questionIndex ?? DEMO_EXAM_QUESTION_COUNT) >= DEMO_EXAM_QUESTION_COUNT ||
      !Array.isArray(candidate.answers) ||
      candidate.answers.length !== DEMO_EXAM_QUESTION_COUNT ||
      !candidate.answers.every((answer) => answer === null || (Number.isInteger(answer) && answer >= 0 && answer < 4)) ||
      !Array.isArray(candidate.flagged) ||
      candidate.flagged.length !== DEMO_EXAM_QUESTION_COUNT ||
      !candidate.flagged.every((flag) => typeof flag === "boolean") ||
      !Number.isInteger(candidate.secondsLeft) ||
      (candidate.secondsLeft ?? -1) < 0 ||
      (candidate.secondsLeft ?? DEMO_EXAM_DURATION_SECONDS + 1) > DEMO_EXAM_DURATION_SECONDS ||
      !Number.isFinite(candidate.savedAt) ||
      !candidate.strokesByQuestion ||
      typeof candidate.strokesByQuestion !== "object" ||
      Array.isArray(candidate.strokesByQuestion)) return null;

  // Skip corrupted/old drawings rather than rejecting otherwise valid answers.
  const validStrokes: Record<number, SavedInkStroke[]> = {};
  for (const [key, value] of Object.entries(candidate.strokesByQuestion)) {
    const position = Number(key);
    if (!Number.isInteger(position) || position < 0 || position >= DEMO_EXAM_QUESTION_COUNT ||
        !Array.isArray(value)) continue;
    validStrokes[position] = value.filter((stroke): stroke is SavedInkStroke =>
      Boolean(stroke && typeof stroke === "object" &&
        typeof stroke.color === "string" &&
        Array.isArray(stroke.points) &&
        stroke.points.every((point: { x: number; y: number }) =>
          point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
          point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1))
    );
  }
  return {
    version: 1,
    questionIndex: candidate.questionIndex!,
    answers: candidate.answers,
    flagged: candidate.flagged,
    secondsLeft: candidate.secondsLeft!,
    strokesByQuestion: validStrokes,
    savedAt: candidate.savedAt!,
  };
}

export function readDemoExamProgress(): DemoExamProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(DEMO_EXAM_STORAGE_KEY);
    return stored ? parseDemoExamProgress(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

export function writeDemoExamProgress(progress: DemoExamProgress): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(DEMO_EXAM_STORAGE_KEY, JSON.stringify(progress));
    window.dispatchEvent(new Event(DEMO_EXAM_EVENT));
    return true;
  } catch {
    // Ink can exceed browser storage limits; keep answers and timer if so.
    try {
      window.localStorage.setItem(DEMO_EXAM_STORAGE_KEY,
        JSON.stringify({ ...progress, strokesByQuestion: {} }));
      window.dispatchEvent(new Event(DEMO_EXAM_EVENT));
      return true;
    } catch {
      return false;
    }
  }
}

export function clearDemoExamProgress() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DEMO_EXAM_STORAGE_KEY);
    window.dispatchEvent(new Event(DEMO_EXAM_EVENT));
  } catch {
    // Storage may be disabled.
  }
}

export function answeredDemoExamCount(progress: Pick<DemoExamProgress, "answers">): number {
  return progress.answers.filter((answer) => answer !== null).length;
}
