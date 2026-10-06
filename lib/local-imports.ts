export type ImportedExamSummary = {
  id: string;
  title: string;
  fileName: string;
  questionCount: number;
  idCount: number;
  answerCount: number;
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
    transaction.objectStore(STORE).put(record);
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
  return records.map((record) => record.summary).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}
