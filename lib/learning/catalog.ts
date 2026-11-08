import data from "../default-catalog.json";
import { DEFAULT_EXAMS } from "../default-exams";
import { readPaessed, sha256 } from "../paessed-package";
import { convertImportedExamQuestions, type BankQuestion } from "../playground-imports";
import type { ImportedExamRecord } from "../local-imports";
import { M1_UNITS } from "../m1-curriculum";
import type { LearningQuestion } from "./types";
export { canonicalQuestionId as canonicalImportedQuestion } from "../question-identity";

export const DEFAULT_QUESTION_INDEX = data.questions as LearningQuestion[];
const loads = new Map<string, Promise<ImportedExamRecord>>();
const content = new Map<string, BankQuestion[]>();

export async function loadLearningCatalog(): Promise<LearningQuestion[]> {
  return DEFAULT_QUESTION_INDEX.filter(q => q.eligible);
}

/** Reviewed packages are fetched once, and verified before rendering. */
export function loadDefaultExam(id: string): Promise<ImportedExamRecord> {
  const entry = DEFAULT_EXAMS.find(e => e.id === id);
  if (!entry) return Promise.reject(new Error("Ensayo Default no encontrado."));
  const existing = loads.get(id);
  if (existing) return existing;
  const pending = (async () => {
    const response = await fetch(entry.packageUrl, { cache: "force-cache" });
    if (!response.ok) throw new Error("No se pudo cargar el ensayo Default. Reintenta con conexión.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (await sha256(bytes) !== entry.sha256) throw new Error("El ensayo no coincide con la entrega Gold revisada.");
    const parsed = await readPaessed(bytes);
    return {
      summary: { id: entry.id, title: entry.title, fileName: entry.packageUrl.split("/").pop()!,
        fileSizeBytes: bytes.byteLength, questionCount: entry.questionCount,
        idCount: entry.questionCount, answerCount: entry.questionCount, verifiedAnswerCount: entry.questionCount,
        assetCount: parsed.blobs.size, referencedAssetCount: parsed.blobs.size,
        importedAt: "2026-11-04T00:00:00Z", sourceKind: "paessed", issues: parsed.validation.warnings, preview: [] },
      finalJson: parsed.data, archive: new Blob([bytes]),
    } satisfies ImportedExamRecord;
  })();
  loads.set(id, pending);
  pending.catch(() => { loads.delete(id); });
  return pending;
}

export async function loadQuestionContent(meta: LearningQuestion) {
  const record = await loadDefaultExam(meta.examId);
  let questions = content.get(meta.examId);
  if (!questions) {
    questions = convertImportedExamQuestions(meta.examId, record.summary.title, record.finalJson);
    const originals = (record.finalJson as { questions: Array<{ number: string; explanation?: { status?: string; blocks?: unknown[] } }> }).questions;
    questions = questions.map((q, i) => {
      const identity = DEFAULT_QUESTION_INDEX.find(m => m.examId === meta.examId && m.number === q.number);
      const explanation = originals[i]?.explanation;
      return { ...q, id: identity?.id ?? q.id, sourceId: "default:" + meta.examId,
        explanationStatus: explanation?.status ?? "missing",
        explanationBlocks: explanation?.blocks?.length ? explanation.blocks : undefined };
    });
    content.set(meta.examId, questions);
  }
  const question = questions.find(q => q.id === meta.id);
  if (!question) throw new Error("Pregunta no encontrada en el ensayo revisado.");
  return { question, record };
}

/** Lightweight filter metadata; full content loads when a question opens. */
export function defaultBankPlaceholders(): BankQuestion[] {
  return DEFAULT_QUESTION_INDEX.map(q => {
    const unit = M1_UNITS.find(u => u.id === q.unitId)!;
    const exam = DEFAULT_EXAMS.find(e => e.id === q.examId)!;
    return { id: q.id, number: q.number, year: exam.year, collection: exam.title,
      sourceId: "default:" + q.examId, axis: unit.axisName, topic: unit.name, unitId: q.unitId,
      stem: "Cargando pregunta del banco Default…", options: [], correct: q.correct, explanation: "" };
  });
}
