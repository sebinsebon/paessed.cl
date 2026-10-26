import type JSZip from "jszip";
import {
  DEMO_EXAM_DURATION_SECONDS, DEMO_EXAM_EVENT,
  DEMO_EXAM_QUESTION_COUNT, DEMO_EXAM_STORAGE_KEY,
} from "@/lib/demo-exam-progress";
import {
  getImportedExam, listImportedExams, saveImportedExam,
  IMPORTED_EXAM_PROGRESS_PREFIX, type ImportedExamRecord,
} from "@/lib/local-imports";
import { CATEGORY_KEYS, type LocalStorageReport, type StorageCategoryId } from "@/lib/local-storage-audit";

export type BackupCategory = Exclude<StorageCategoryId, "other">;
export const BACKUP_CATEGORIES: BackupCategory[] = [
  "exams", "sessions", "drawings", "marked", "diagnostic", "playground", "preferences",
];

type StoredSlice = { category: BackupCategory; key: string; value: string };
type ExamDescriptor = { id: string; jsonPath: string; archivePath?: string; archiveMime?: string };
type BackupManifest = {
  format: "paessed-browser-backup";
  version: 1;
  createdAt: string;
  categories: BackupCategory[];
  items: StoredSlice[];
  exams: ExamDescriptor[];
};
export type LocalBackupPreview = {
  name: string;
  createdAt: string;
  categories: BackupCategory[];
  itemCounts: Record<BackupCategory, number>;
  examCount: number;
  manifest: BackupManifest;
  zip: JSZip;
};
export type RestoreSummary = {
  examsAdded: number;
  examsSkipped: number;
  entriesApplied: number;
  entriesSkipped: number;
};

const MAX_FILE_BYTES = 250 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 50 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 600 * 1024 * 1024;
const MAX_ITEMS = 5000;
const MAX_EXAMS = 500;
const PROGRESS_CATEGORIES: BackupCategory[] = ["sessions", "drawings", "marked"];

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isCategory(value: unknown): value is BackupCategory {
  return typeof value === "string" && BACKUP_CATEGORIES.includes(value as BackupCategory);
}
function isProgressKey(key: string) {
  return key === DEMO_EXAM_STORAGE_KEY || key.startsWith(IMPORTED_EXAM_PROGRESS_PREFIX);
}
function allowedFields(key: string, category: BackupCategory): string[] {
  const demo = key === DEMO_EXAM_STORAGE_KEY;
  if (category === "sessions") return demo
    ? ["answers", "questionIndex", "secondsLeft", "savedAt"]
    : ["answers", "index", "completedAt"];
  if (category === "drawings") return [demo ? "strokesByQuestion" : "strokes"];
  if (category === "marked") return [demo ? "flagged" : "bookmarks"];
  return [];
}
function categoryMatchesKey(category: BackupCategory, key: string): boolean {
  if (!key.startsWith("paessed-") || key.length > 512) return false;
  if (isProgressKey(key)) return PROGRESS_CATEGORIES.includes(category);
  return CATEGORY_KEYS[key] === category;
}
function parseSlice(key: string, category: BackupCategory, raw: string): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("Los datos de " + key + " no contienen JSON válido."); }
  if (!isObject(parsed)) throw new Error("Formato de progreso inválido: " + key);
  const fields = allowedFields(key, category);
  if (!Object.keys(parsed).every((field) => fields.includes(field))) {
    throw new Error("El respaldo incluye campos no permitidos para " + category + ".");
  }
  for (const [field, value] of Object.entries(parsed)) {
    if (field === "answers" && key === DEMO_EXAM_STORAGE_KEY) {
      if (!Array.isArray(value) || value.length !== DEMO_EXAM_QUESTION_COUNT ||
        !value.every((answer) => answer === null || (Number.isInteger(answer) && answer >= 0 && answer < 4))) {
        throw new Error("Las respuestas del ensayo de ejemplo son inválidas.");
      }
    } else if (field === "answers" || field === "strokes" || field === "strokesByQuestion") {
      if (!isObject(value)) throw new Error("El campo " + field + " no es un objeto válido.");
    } else if (field === "bookmarks" || field === "flagged") {
      if (!Array.isArray(value)) throw new Error("Las marcas del respaldo no son válidas.");
      if (field === "flagged" && (value.length !== DEMO_EXAM_QUESTION_COUNT || !value.every((mark) => typeof mark === "boolean"))) {
        throw new Error("Las marcas del ensayo de ejemplo son inválidas.");
      }
    } else if (field === "index" || field === "questionIndex" || field === "secondsLeft" || field === "savedAt") {
      if (!Number.isFinite(value) || (field !== "savedAt" && (!Number.isInteger(value) || (value as number) < 0))) {
        throw new Error("El progreso contiene valores numéricos inválidos.");
      }
    } else if (field === "completedAt" && typeof value !== "string") {
      throw new Error("La fecha de finalización es inválida.");
    }
  }
  return parsed;
}
function projection(key: string, category: BackupCategory, raw: string): string {
  let stored: unknown;
  try { stored = JSON.parse(raw); }
  catch { throw new Error("No se puede respaldar el progreso dañado de " + key + "."); }
  if (!isObject(stored)) throw new Error("El progreso de " + key + " no es válido.");
  const output: Record<string, unknown> = {};
  for (const field of allowedFields(key, category)) {
    if (Object.prototype.hasOwnProperty.call(stored, field)) output[field] = stored[field];
  }
  const result = JSON.stringify(output);
  parseSlice(key, category, result);
  return result;
}
function emptyProgress(demo: boolean): Record<string, unknown> {
  return demo
    ? {
        version: 1,
        questionIndex: 0,
        answers: Array(DEMO_EXAM_QUESTION_COUNT).fill(null),
        flagged: Array(DEMO_EXAM_QUESTION_COUNT).fill(false),
        secondsLeft: DEMO_EXAM_DURATION_SECONDS,
        strokesByQuestion: {},
        savedAt: Date.now(),
      }
    : { index: 0, answers: {}, bookmarks: [], strokes: {} };
}
function hasExistingContent(current: Record<string, unknown>, category: BackupCategory, demo: boolean): boolean {
  if (category === "sessions") {
    if (demo) return (Array.isArray(current.answers) && current.answers.some((answer) => answer !== null))
      || current.questionIndex !== 0 || current.secondsLeft !== DEMO_EXAM_DURATION_SECONDS;
    return (isObject(current.answers) && Object.keys(current.answers).length > 0)
      || (typeof current.index === "number" && current.index > 0)
      || typeof current.completedAt === "string";
  }
  if (category === "drawings") {
    const drawings = demo ? current.strokesByQuestion : current.strokes;
    return isObject(drawings) && Object.values(drawings).some((value) => Array.isArray(value) && value.length > 0);
  }
  if (category === "marked") {
    const marks = demo ? current.flagged : current.bookmarks;
    return Array.isArray(marks) && (demo ? marks.some(Boolean) : marks.length > 0);
  }
  return false;
}

/** Produces a versioned ZIP; it does not send any data to a server. */
export async function createLocalBackup(categories: BackupCategory[], report: LocalStorageReport): Promise<Blob> {
  const selected = [...new Set(categories)].filter(isCategory);
  if (!selected.length) throw new Error("Selecciona al menos una categoría.");
  if (selected.includes("exams") && report.examError) throw new Error(report.examError);
  if (selected.some((category) => category !== "exams") && report.localError) throw new Error(report.localError);

  const { default: JSZipModule } = await import("jszip");
  const zip = new JSZipModule();
  const manifest: BackupManifest = {
    format: "paessed-browser-backup", version: 1,
    createdAt: new Date().toISOString(), categories: selected, items: [], exams: [],
  };
  for (const category of selected) {
    if (category === "exams") continue;
    const savedKeys = report.categories.find((item) => item.id === category)?.keys ?? [];
    for (const key of [...new Set(savedKeys)]) {
      if (!categoryMatchesKey(category, key)) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      manifest.items.push({
        category, key,
        value: isProgressKey(key) ? projection(key, category, raw) : raw,
      });
    }
  }
  if (selected.includes("exams")) {
    for (const item of report.exams) {
      const record = await getImportedExam(item.id);
      if (!record) throw new Error("El ensayo " + item.title + " cambió durante el respaldo. Actualiza y vuelve a intentarlo.");
      const index = manifest.exams.length;
      const jsonPath = "exams/" + index + ".json";
      const descriptor: ExamDescriptor = { id: record.summary.id, jsonPath };
      zip.file(jsonPath, JSON.stringify({ summary: record.summary, finalJson: record.finalJson }));
      if (record.archive) {
        descriptor.archivePath = "exams/" + index + ".bin";
        descriptor.archiveMime = record.archive.type;
        zip.file(descriptor.archivePath, record.archive, { compression: "STORE" });
      }
      manifest.exams.push(descriptor);
    }
  }
  zip.file("manifest.json", JSON.stringify(manifest));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } });
}

function validateManifest(value: unknown): BackupManifest {
  if (!isObject(value) || value.format !== "paessed-browser-backup" || value.version !== 1) {
    throw new Error("El archivo no es un respaldo PAESSED compatible (versión 1).");
  }
  if (typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt))) {
    throw new Error("El respaldo no indica una fecha válida.");
  }
  if (!Array.isArray(value.categories) || !value.categories.every(isCategory) ||
      new Set(value.categories).size !== value.categories.length || !Array.isArray(value.items) ||
      !Array.isArray(value.exams) || value.items.length > MAX_ITEMS || value.exams.length > MAX_EXAMS) {
    throw new Error("El manifiesto del respaldo contiene listas no válidas.");
  }
  const cats = value.categories as BackupCategory[];
  const seen = new Set<string>();
  const items: StoredSlice[] = [];
  for (const candidate of value.items) {
    if (!isObject(candidate) || !isCategory(candidate.category) ||
        !cats.includes(candidate.category) || candidate.category === "exams" ||
        typeof candidate.key !== "string" || typeof candidate.value !== "string" ||
        !categoryMatchesKey(candidate.category, candidate.key)) {
      throw new Error("El respaldo contiene claves de almacenamiento no reconocidas.");
    }
    const identity = candidate.category + ":" + candidate.key;
    if (seen.has(identity)) throw new Error("El respaldo contiene claves duplicadas.");
    seen.add(identity);
    if (candidate.value.length > 12 * 1024 * 1024) throw new Error("Una entrada del respaldo es demasiado grande.");
    if (isProgressKey(candidate.key)) parseSlice(candidate.key, candidate.category, candidate.value);
    items.push({ category: candidate.category, key: candidate.key, value: candidate.value });
  }
  const exams: ExamDescriptor[] = [];
  const examIds = new Set<string>();
  for (const candidate of value.exams) {
    if (!cats.includes("exams") || !isObject(candidate) ||
        typeof candidate.id !== "string" || !candidate.id.trim() || candidate.id.length > 256 ||
        typeof candidate.jsonPath !== "string" || !/^exams\/[0-9]+\.json$/.test(candidate.jsonPath) ||
        (candidate.archivePath !== undefined && (typeof candidate.archivePath !== "string" ||
          !/^exams\/[0-9]+\.bin$/.test(candidate.archivePath))) ||
        (candidate.archiveMime !== undefined && typeof candidate.archiveMime !== "string") ||
        examIds.has(candidate.id)) {
      throw new Error("Los registros de ensayos del respaldo no son válidos.");
    }
    examIds.add(candidate.id);
    exams.push({ id: candidate.id, jsonPath: candidate.jsonPath,
      archivePath: candidate.archivePath as string | undefined,
      archiveMime: candidate.archiveMime as string | undefined });
  }
  return { format: "paessed-browser-backup", version: 1, createdAt: value.createdAt,
    categories: cats, items, exams };
}

/** Reads and checks the file for preview. No browser data is changed here. */
export async function inspectLocalBackup(file: File): Promise<LocalBackupPreview> {
  if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Selecciona un respaldo .zip de PAESSED.");
  if (file.size > MAX_FILE_BYTES) throw new Error("El respaldo supera el límite de 250 MB.");
  const { default: JSZipModule } = await import("jszip");
  const zip = await JSZipModule.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files);
  if (entries.length > MAX_EXAMS * 2 + 10) throw new Error("El respaldo contiene demasiados archivos.");
  let uncompressed = 0;
  for (const entry of entries) {
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    if (typeof size === "number") uncompressed += size;
  }
  if (uncompressed > MAX_UNCOMPRESSED_BYTES) throw new Error("Los archivos descomprimidos superan el límite de 600 MB.");
  const manifestEntry = zip.file("manifest.json");
  if (!manifestEntry) throw new Error("El respaldo no contiene manifest.json.");
  const manifestText = await manifestEntry.async("string");
  if (manifestText.length > MAX_MANIFEST_BYTES) throw new Error("El manifiesto del respaldo es demasiado grande.");
  let parsed: unknown;
  try { parsed = JSON.parse(manifestText); }
  catch { throw new Error("El manifiesto JSON está dañado."); }
  const manifest = validateManifest(parsed);
  for (const exam of manifest.exams) {
    if (!zip.file(exam.jsonPath) || (exam.archivePath && !zip.file(exam.archivePath))) {
      throw new Error("Falta un archivo del ensayo " + exam.id + " en el respaldo.");
    }
  }
  const itemCounts = Object.fromEntries(BACKUP_CATEGORIES.map((category) => [category, 0])) as Record<BackupCategory, number>;
  itemCounts.exams = manifest.exams.length;
  for (const item of manifest.items) itemCounts[item.category]++;
  return {
    name: file.name, createdAt: manifest.createdAt, categories: manifest.categories,
    itemCounts, examCount: manifest.exams.length, manifest, zip,
  };
}

async function decodeExam(preview: LocalBackupPreview, descriptor: ExamDescriptor): Promise<ImportedExamRecord> {
  const examText = await preview.zip.file(descriptor.jsonPath)!.async("string");
  let decoded: unknown;
  try { decoded = JSON.parse(examText); }
  catch { throw new Error("Uno de los ensayos contiene JSON dañado."); }
  if (!isObject(decoded) || !isObject(decoded.summary) ||
      decoded.summary.id !== descriptor.id ||
      typeof decoded.summary.title !== "string" || !decoded.summary.title ||
      typeof decoded.summary.fileName !== "string" ||
      typeof decoded.summary.importedAt !== "string" ||
      !Number.isInteger(decoded.summary.questionCount) || (decoded.summary.questionCount as number) <= 0 ||
      !Array.isArray(decoded.summary.issues) || !Array.isArray(decoded.summary.preview) ||
      !isObject(decoded.finalJson)) {
    throw new Error("El ensayo " + descriptor.id + " tiene una estructura incompatible.");
  }
  const archive = descriptor.archivePath
    ? new Blob([await preview.zip.file(descriptor.archivePath)!.async("blob")],
      { type: descriptor.archiveMime || "application/zip" })
    : undefined;
  return { summary: decoded.summary as unknown as ImportedExamRecord["summary"],
    finalJson: decoded.finalJson, archive };
}

/** Merges only selected fields; existing data wins unless overwrite is confirmed. */
export async function restoreLocalBackup(
  preview: LocalBackupPreview, categories: BackupCategory[], overwrite: boolean,
): Promise<RestoreSummary> {
  const selected = [...new Set(categories)].filter((category) => preview.categories.includes(category));
  if (!selected.length) throw new Error("Selecciona qué datos quieres restaurar.");
  const prepared: ImportedExamRecord[] = [];
  if (selected.includes("exams")) {
    for (const descriptor of preview.manifest.exams) prepared.push(await decodeExam(preview, descriptor));
  }
  // Validate selected slices before the first write.
  for (const item of preview.manifest.items) {
    if (selected.includes(item.category) && isProgressKey(item.key)) parseSlice(item.key, item.category, item.value);
  }

  const result: RestoreSummary = { examsAdded: 0, examsSkipped: 0, entriesApplied: 0, entriesSkipped: 0 };
  if (selected.includes("exams")) {
    const existing = new Set((await listImportedExams()).map((exam) => exam.id));
    for (const record of prepared) {
      if (existing.has(record.summary.id) && !overwrite) { result.examsSkipped++; continue; }
      await saveImportedExam(record);
      result.examsAdded++;
    }
  }
  for (const item of preview.manifest.items) {
    if (!selected.includes(item.category)) continue;
    const original = localStorage.getItem(item.key);
    if (!isProgressKey(item.key)) {
      if (original !== null && !overwrite) { result.entriesSkipped++; continue; }
      localStorage.setItem(item.key, item.value);
      result.entriesApplied++;
      continue;
    }
    const demo = item.key === DEMO_EXAM_STORAGE_KEY;
    let current: Record<string, unknown>;
    if (original === null) current = emptyProgress(demo);
    else {
      let parsed: unknown;
      try { parsed = JSON.parse(original); }
      catch { result.entriesSkipped++; continue; }
      if (!isObject(parsed)) { result.entriesSkipped++; continue; }
      current = parsed;
    }
    if (!overwrite && original !== null && hasExistingContent(current, item.category, demo)) {
      result.entriesSkipped++;
      continue;
    }
    const incoming = parseSlice(item.key, item.category, item.value);
    for (const field of allowedFields(item.key, item.category)) {
      if (Object.prototype.hasOwnProperty.call(incoming, field)) current[field] = incoming[field];
    }
    localStorage.setItem(item.key, JSON.stringify(current));
    if (demo) window.dispatchEvent(new Event(DEMO_EXAM_EVENT));
    result.entriesApplied++;
  }
  return result;
}
