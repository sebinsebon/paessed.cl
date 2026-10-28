
import { validatePaessed } from "@/lib/paessed-package";
import { isJsonObject } from "@/lib/exam-editing";
import { IMPORTED_EXAM_PROGRESS_PREFIX, type ImportedExamRecord } from "@/lib/local-imports";

export type ExamBackupPreview = {
  name: string;
  createdAt: string;
  record: ImportedExamRecord;
  progress: string | null;
};

type ExamBackupManifest = {
  format: "paessed-exam-backup";
  version: 1;
  createdAt: string;
  examId: string;
  summary: ImportedExamRecord["summary"];
  progress: string | null;
  archiveMime: string | null;
};

const MAX_BACKUP_BYTES = 500 * 1024 * 1024;

/** Preserves the exact source archive, current editable JSON and saved progress. */
export async function createExamBackup(record: ImportedExamRecord): Promise<Blob> {
  const progress = localStorage.getItem(IMPORTED_EXAM_PROGRESS_PREFIX + record.summary.id);
  const manifest: ExamBackupManifest = {
    format: "paessed-exam-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    examId: record.summary.id,
    summary: record.summary,
    progress,
    archiveMime: record.archive?.type ?? null,
  };
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest));
  zip.file("final.json", JSON.stringify(record.finalJson));
  if (record.archive) zip.file("original.bin", record.archive, { compression: "STORE" });
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } });
}

/** Parses a backup without writing anything to IndexedDB or localStorage. */
export async function inspectExamBackup(file: File, expectedExamId: string): Promise<ExamBackupPreview> {
  if (!file.name.toLowerCase().endsWith(".zip") || file.size > MAX_BACKUP_BYTES) {
    throw new Error("Selecciona un respaldo .zip de hasta 500 MB.");
  }
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const uncompressed = Object.values(zip.files).reduce((sum, entry) =>
    sum + ((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0), 0);
  if (Object.keys(zip.files).length > 4 || uncompressed > 700 * 1024 * 1024) {
    throw new Error("El respaldo contiene archivos inesperados o demasiado grandes.");
  }
  const rawManifest = await zip.file("manifest.json")?.async("string");
  const rawFinal = await zip.file("final.json")?.async("string");
  if (!rawManifest || !rawFinal) throw new Error("El respaldo no contiene manifest.json y final.json.");
  let manifest: unknown;
  let finalJson: unknown;
  try { manifest = JSON.parse(rawManifest); finalJson = JSON.parse(rawFinal); }
  catch { throw new Error("Los archivos JSON del respaldo están dañados."); }
  if (!isJsonObject(manifest) || manifest.format !== "paessed-exam-backup" ||
      manifest.version !== 1 || manifest.examId !== expectedExamId ||
      typeof manifest.createdAt !== "string" || Number.isNaN(Date.parse(manifest.createdAt)) ||
      !isJsonObject(manifest.summary) || manifest.summary.id !== expectedExamId ||
      typeof manifest.summary.title !== "string" ||
      typeof manifest.summary.fileName !== "string" ||
      typeof manifest.summary.importedAt !== "string" ||
      !["paessed", "zip", "json"].includes(String(manifest.summary.sourceKind)) ||
      !Number.isInteger(manifest.summary.questionCount) || (manifest.summary.questionCount as number) < 1 ||
      !Array.isArray(manifest.summary.preview) ||
      !Array.isArray(manifest.summary.issues) ||
      (manifest.progress !== null && typeof manifest.progress !== "string") ||
      (manifest.archiveMime !== null && typeof manifest.archiveMime !== "string") ||
      !isJsonObject(finalJson)) {
    throw new Error("El respaldo no es compatible con este ensayo.");
  }
  if (manifest.progress !== null) {
    try {
      const progressData: unknown = JSON.parse(manifest.progress);
      if (!isJsonObject(progressData)) throw new Error();
    } catch { throw new Error("El respaldo contiene progreso inválido."); }
  }
  if (finalJson.format === "paessed-benchmark") validatePaessed(finalJson);
  const archiveEntry = zip.file("original.bin");
  const archive = archiveEntry
    ? new Blob([await archiveEntry.async("blob")], { type: manifest.archiveMime || "application/zip" })
    : undefined;
  return {
    name: file.name,
    createdAt: manifest.createdAt,
    record: {
      summary: manifest.summary as unknown as ImportedExamRecord["summary"],
      finalJson,
      archive,
    },
    progress: manifest.progress,
  };
}
