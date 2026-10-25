export type ImportedExamSummary = {
  id: string;
  title: string;
  fileName: string;
  fileSizeBytes?: number;
  questionCount: number;
  idCount: number;
  answerCount: number;
  verifiedAnswerCount?: number;
  curriculumCount?: number;
  curriculumPendingCount?: number;
  curriculumDoubtfulCount?: number;
  assetCount: number;
  referencedAssetCount: number;
  importedAt: string;
  sourceKind: "paessed" | "zip" | "json";
  issues: string[];
  preview: Array<{ id: string; text: string }>;
};

export type ImportedExamRecord = {
  summary: ImportedExamSummary;
  finalJson: unknown;
  archive?: Blob;
};

function refreshed(record:ImportedExamRecord):ImportedExamRecord {
  const data=record.finalJson as {format?:unknown;questions?:Array<{answer?:{label?:unknown;status?:unknown};curriculum?:{eje?:unknown;subeje?:unknown;en_temario?:unknown}}>};
  if(data?.format!=='paessed-benchmark'||!Array.isArray(data.questions))return record;
  const questions=data.questions;
  return {...record,summary:{...record.summary,
    answerCount:questions.filter(q=>typeof q.answer?.label==='string'&&q.answer.label.length>0).length,
    verifiedAnswerCount:questions.filter(q=>typeof q.answer?.label==='string'&&q.answer.status==='verified').length,
    curriculumCount:questions.filter(q=>typeof q.curriculum?.eje==='string'&&typeof q.curriculum.subeje==='string').length,
    curriculumPendingCount:questions.filter(q=>!q.curriculum?.eje||!q.curriculum?.subeje).length,
    curriculumDoubtfulCount:questions.filter(q=>!!q.curriculum?.eje&&q.curriculum.en_temario==='dudoso').length,
  }};
}

const DB_NAME = "paessed-local";
const DB_VERSION = 1;
const STORE = "imported-exams";
export const IMPORTED_EXAM_PROGRESS_PREFIX = "paessed-imported-essay-progress-v1-";

export type ImportedExamProgressSummary = {
  answeredCount: number;
  status: "not-started" | "in-progress" | "all-answered" | "completed";
  completedAt?: string;
};

export function readImportedExamProgress(id: string, questionCount: number): ImportedExamProgressSummary {
  const empty: ImportedExamProgressSummary = { answeredCount: 0, status: "not-started" };
  try {
    const stored = localStorage.getItem(IMPORTED_EXAM_PROGRESS_PREFIX + id);
    if (!stored) return empty;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return empty;
    const value = parsed as { answers?: unknown; completedAt?: unknown };
    const answers = value.answers && typeof value.answers === "object" && !Array.isArray(value.answers)
      ? Object.entries(value.answers).filter(([index, answer]) =>
          Number.isInteger(Number(index)) && Number(index) >= 0 && Number(index) < questionCount &&
          typeof answer === "string" && answer.length > 0).length : 0;
    const completedAt = typeof value.completedAt === "string" && !Number.isNaN(Date.parse(value.completedAt))
      ? value.completedAt : undefined;
    const status = completedAt ? "completed"
      : answers === 0 ? "not-started"
      : questionCount > 0 && answers >= questionCount ? "all-answered" : "in-progress";
    return { answeredCount: answers, status, completedAt };
  } catch {
    return empty;
  }
}


function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "summary.id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB."));
  });
}

export async function saveImportedExam(record: ImportedExamRecord): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(refreshed(record));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo guardar el ensayo."));
  });
  database.close();
}

export async function listImportedExams(): Promise<ImportedExamSummary[]> {
  const database = await openDatabase();
  const records = await new Promise<ImportedExamRecord[]>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as ImportedExamRecord[]);
    request.onerror = () => reject(request.error ?? new Error("No se pudieron leer los ensayos importados."));
  });
  database.close();
  return records.map((record) => {
    const summary = refreshed(record).summary;
    return { ...summary, fileSizeBytes: summary.fileSizeBytes ?? record.archive?.size };
  }).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function getImportedExam(id: string): Promise<ImportedExamRecord | null> {
  const database = await openDatabase();
  const record = await new Promise<ImportedExamRecord | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as ImportedExamRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error("No se pudo leer el ensayo importado."));
  });
  database.close();
  return record ? refreshed(record) : null;
}

export async function deleteImportedExam(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo eliminar el ensayo."));
      transaction.onabort = () => reject(transaction.error ?? new Error("La eliminación fue cancelada."));
    });
  } finally {
    database.close();
  }
  // Delete the corresponding answers, bookmarks and drawings after the package is gone.
  try { localStorage.removeItem(IMPORTED_EXAM_PROGRESS_PREFIX + id); } catch { /* Storage may be unavailable. */ }
}

export type ImportedExamStorageUsage = {
  id: string;
  title: string;
  fileName: string;
  importedAt: string;
  questionCount: number;
  archiveBytes: number;
  estimatedBytes: number;
};

function utf8Size(value: unknown): number {
  try { return new TextEncoder().encode(JSON.stringify(value) ?? "").byteLength; }
  catch { return 0; }
}

/** Estimate bytes actually represented by each stored record, not just source file size. */
export async function listImportedExamStorageUsage(): Promise<ImportedExamStorageUsage[]> {
  const database = await openDatabase();
  let records: ImportedExamRecord[];
  try {
    records = await new Promise<ImportedExamRecord[]>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readonly");
      const request = transaction.objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result as ImportedExamRecord[]);
      request.onerror = () => reject(request.error ?? new Error("No se pudo medir la biblioteca local."));
    });
  } finally {
    database.close();
  }
  return records.map((record) => {
    const archiveBytes = record.archive?.size ?? 0;
    return {
      id: record.summary.id,
      title: record.summary.title,
      fileName: record.summary.fileName,
      importedAt: record.summary.importedAt,
      questionCount: record.summary.questionCount,
      archiveBytes,
      estimatedBytes: archiveBytes + utf8Size(record.finalJson) + utf8Size(record.summary),
    };
  }).sort((a, b) => b.estimatedBytes - a.estimatedBytes);
}
