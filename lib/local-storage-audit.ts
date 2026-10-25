import { deleteImportedExam, listImportedExamStorageUsage, type ImportedExamStorageUsage, IMPORTED_EXAM_PROGRESS_PREFIX } from "@/lib/local-imports";
import { DEMO_EXAM_DURATION_SECONDS, DEMO_EXAM_QUESTION_COUNT, DEMO_EXAM_STORAGE_KEY, DEMO_EXAM_EVENT } from "@/lib/demo-exam-progress";

export type StorageCategoryId =
  | "exams" | "sessions" | "drawings" | "marked"
  | "diagnostic" | "playground" | "preferences" | "other";

export const STORAGE_CATEGORIES: Array<{ id: StorageCategoryId; label: string; description: string; color: string }> = [
  { id: "exams", label: "Ensayos importados", description: "Paquetes y contenido extraído", color: "bg-orange-500" },
  { id: "sessions", label: "Respuestas y sesiones", description: "Intentos, respuestas, tiempos y último resultado", color: "bg-indigo-500" },
  { id: "drawings", label: "Dibujos", description: "Trazos realizados en los ensayos", color: "bg-pink-500" },
  { id: "marked", label: "Preguntas marcadas", description: "Marcas y preguntas guardadas", color: "bg-amber-500" },
  { id: "diagnostic", label: "Diagnóstico", description: "Resultado almacenado del diagnóstico", color: "bg-emerald-500" },
  { id: "playground", label: "Playground", description: "Historial de preguntas recientes", color: "bg-blue-500" },
  { id: "preferences", label: "Preferencias y perfil", description: "Temas, ajustes y perfil local", color: "bg-violet-500" },
  { id: "other", label: "Otros datos", description: "Claves PAESSED aún sin clasificar", color: "bg-slate-500" },
];

export type StorageCategoryUsage = {
  id: StorageCategoryId;
  bytes: number;
  itemCount: number;
  keys: string[];
};
export type LocalStorageReport = {
  categories: StorageCategoryUsage[];
  exams: ImportedExamStorageUsage[];
  identifiedBytes: number;
  browserReportedBytes: number | null;
  examError: string | null;
  localError: string | null;
};

const CATEGORY_KEYS: Record<string, StorageCategoryId> = {
  "paessed-last-exam": "sessions",
  "paessed-diagnostic": "diagnostic",
  "paessed-playground-recent-questions": "playground",
  "paessed-playground-saved-questions": "marked",
  "paessed-playground-paper-theme": "preferences",
  "paessed-imported-paper-theme": "preferences",
  "paessed-essay-paper-theme": "preferences",
  "paessed-sidebar-collapsed": "preferences",
  "paessed-theme": "preferences",
  "paessed-monthly-goal": "preferences",
  "paessed-dashboard-tour-seen": "preferences",
  "paessed-user": "preferences",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasDrawings(value: unknown): boolean {
  return isRecord(value) && Object.values(value).some((strokes) => Array.isArray(strokes) && strokes.length > 0);
}
function hasMarks(value: unknown, demo: boolean): boolean {
  return Array.isArray(value) && (demo ? value.some(Boolean) : value.length > 0);
}
function hasActiveSession(data: Record<string, unknown>, demo: boolean): boolean {
  if (demo) {
    return (Array.isArray(data.answers) && data.answers.some((answer) => answer !== null))
      || data.questionIndex !== 0 || data.secondsLeft !== DEMO_EXAM_DURATION_SECONDS;
  }
  return (isRecord(data.answers) && Object.keys(data.answers).length > 0)
    || (typeof data.index === "number" && data.index > 0)
    || typeof data.completedAt === "string";
}

function splitProgress(value: string, demo: boolean, keyBytes: number): { sessions: number; drawings: number; marked: number } {
  const whole = value.length * 2;
  try {
    const data: unknown = JSON.parse(value);
    if (!isRecord(data)) return { sessions: whole + keyBytes, drawings: 0, marked: 0 };
    const ink = demo ? data.strokesByQuestion : data.strokes;
    const marks = demo ? data.flagged : data.bookmarks;
    let drawings = hasDrawings(ink) ? Math.min(whole, JSON.stringify(ink).length * 2) : 0;
    let marked = hasMarks(marks, demo) ? Math.min(whole - drawings, JSON.stringify(marks).length * 2) : 0;
    let sessions = whole - drawings - marked + keyBytes;
    // If a record only exists to preserve drawings or marks, the neutral
    // session fields are overhead of that remaining content, not an active attempt.
    if (!hasActiveSession(data, demo)) {
      if (drawings > 0) { drawings += sessions; sessions = 0; }
      else if (marked > 0) { marked += sessions; sessions = 0; }
    }
    return { sessions, drawings, marked };
  } catch {
    return { sessions: whole + keyBytes, drawings: 0, marked: 0 };
  }
}

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  const exponent = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)));
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(bytes / 1024 ** exponent)
    + " " + ["B", "KB", "MB", "GB"][exponent];
}

/**
 * Uses UTF-16 length for localStorage and archive + serialized JSON for IndexedDB.
 * These are attributable payload estimates, not a claim about physical disk allocation.
 */
export async function inspectLocalStorage(): Promise<LocalStorageReport> {
  const categories = STORAGE_CATEGORIES.map(({ id }) => ({
    id, bytes: 0, itemCount: 0, keys: [] as string[],
  }));
  const byId = new Map(categories.map((category) => [category.id, category]));
  let localError: string | null = null;

  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key): key is string => typeof key === "string" && key.startsWith("paessed-"));
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value === null) continue;
      const isProgress = key.startsWith(IMPORTED_EXAM_PROGRESS_PREFIX) || key === DEMO_EXAM_STORAGE_KEY;
      if (isProgress) {
        const portions = splitProgress(value, key === DEMO_EXAM_STORAGE_KEY, key.length * 2);
        for (const [id, bytes] of [
          ["sessions", portions.sessions], ["drawings", portions.drawings], ["marked", portions.marked],
        ] as const) {
          if (bytes <= 0) continue;
          const category = byId.get(id)!;
          category.bytes += bytes;
          category.itemCount += 1;
          category.keys.push(key);
        }
        continue;
      }
      const id = CATEGORY_KEYS[key] ?? "other";
      const category = byId.get(id)!;
      category.bytes += (key.length + value.length) * 2;
      category.itemCount += 1;
      category.keys.push(key);
    }
  } catch {
    localError = "El navegador no permitió leer todos los datos locales.";
  }

  let exams: ImportedExamStorageUsage[] = [];
  let examError: string | null = null;
  try {
    exams = await listImportedExamStorageUsage();
    const category = byId.get("exams")!;
    category.bytes = exams.reduce((sum, exam) => sum + exam.estimatedBytes, 0);
    category.itemCount = exams.length;
  } catch {
    examError = "No se pudo acceder a la biblioteca IndexedDB.";
  }

  let browserReportedBytes: number | null = null;
  try {
    if (typeof navigator.storage?.estimate === "function") {
      browserReportedBytes = (await navigator.storage.estimate()).usage ?? null;
    }
  } catch { /* Not supported in every browser or privacy mode. */ }

  return {
    categories,
    exams,
    identifiedBytes: categories.reduce((sum, category) => sum + category.bytes, 0),
    browserReportedBytes,
    examError,
    localError,
  };
}

function editStoredProgress(key: string, category: "sessions" | "drawings" | "marked"): void {
  const raw = localStorage.getItem(key);
  if (!raw) return;
  let data: unknown;
  try { data = JSON.parse(raw); }
  catch { throw new Error("No se puede modificar un progreso dañado sin borrar otros datos."); }
  if (!isRecord(data)) throw new Error("El progreso guardado no tiene un formato válido.");
  const demo = key === DEMO_EXAM_STORAGE_KEY;
  if (category === "drawings") {
    if (demo) data.strokesByQuestion = {};
    else data.strokes = {};
  } else if (category === "marked") {
    if (demo) data.flagged = Array(DEMO_EXAM_QUESTION_COUNT).fill(false);
    else data.bookmarks = [];
  } else if (demo) {
    data.answers = Array(DEMO_EXAM_QUESTION_COUNT).fill(null);
    data.questionIndex = 0;
    data.secondsLeft = DEMO_EXAM_DURATION_SECONDS;
    data.savedAt = Date.now();
  } else {
    data.answers = {};
    data.index = 0;
    delete data.completedAt;
  }
  const stillHasInk = hasDrawings(demo ? data.strokesByQuestion : data.strokes);
  const stillHasMarks = hasMarks(demo ? data.flagged : data.bookmarks, demo);
  if (!hasActiveSession(data, demo) && !stillHasInk && !stillHasMarks) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(data));
  if (demo) window.dispatchEvent(new Event(DEMO_EXAM_EVENT));
}

/** Only acts on the keys/IDs that were visible in the confirmed snapshot. */
export async function clearLocalStorageCategory(category: StorageCategoryId, report: LocalStorageReport): Promise<void> {
  if (category === "other") throw new Error("Las claves desconocidas se dejan intactas por seguridad.");
  if (category === "exams") {
    for (const exam of report.exams) await deleteImportedExam(exam.id);
    return;
  }
  const entries = report.categories.find((item) => item.id === category)?.keys ?? [];
  for (const key of [...new Set(entries)]) {
    if (key === DEMO_EXAM_STORAGE_KEY || key.startsWith(IMPORTED_EXAM_PROGRESS_PREFIX)) {
      if (category === "sessions" || category === "drawings" || category === "marked") {
        editStoredProgress(key, category);
      }
    } else if (CATEGORY_KEYS[key] === category) {
      localStorage.removeItem(key);
    }
  }
}

export async function clearSingleImportedExam(id: string): Promise<void> {
  await deleteImportedExam(id);
}
