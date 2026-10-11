export type ImportedExamSummary = {
  id: string;
  title: string;
  fileName: string;
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
  return records.map((record) => refreshed(record).summary).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
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
