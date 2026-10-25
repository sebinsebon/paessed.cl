"use client";

import JSZip from "jszip";
import {readPaessed, validatePaessed} from "@/lib/paessed-package";
import Link from "next/link";
import { ChangeEvent, DragEvent, ReactNode, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  FileArchive,
  FileJson2,
  Images,
  PackageCheck,
  Search,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ImportedExamRecord, ImportedExamSummary, saveImportedExam } from "@/lib/local-imports";

type RecordLike = Record<string, unknown>;

type ParsedPackage = {
  summary: ImportedExamSummary;
  finalJson: unknown;
  archive?: Blob;
  packageFiles: string[];
  finalJsonPath: string;
  fatalError?: string;
};

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nested(record: RecordLike, ...keys: string[]): unknown {
  let current: unknown = record;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function firstString(values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function getQuestions(document: unknown): unknown[] {
  if (!isRecord(document)) return [];
  const candidates = [
    document.questions,
    document.items,
    nested(document, "exam", "questions"),
    nested(document, "test", "questions"),
    nested(document, "content", "questions"),
    nested(document, "data", "questions"),
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function getQuestionId(question: unknown, index: number): string {
  if (!isRecord(question)) return String(index + 1);
  const value = question.id ?? question.question_id ?? question.questionId ?? question.number ?? question.index;
  return typeof value === "string" || typeof value === "number" ? String(value) : String(index + 1);
}

function hasExplicitId(question: unknown): boolean {
  if (!isRecord(question)) return false;
  return [question.id, question.question_id, question.questionId, question.number].some(
    (value) => typeof value === "string" || typeof value === "number",
  );
}

function getAnswer(question: unknown): unknown {
  if (!isRecord(question)) return undefined;
  if (isRecord(question.answer) && "label" in question.answer) return question.answer.label ?? undefined;
  const direct = [question.answer, question.correct_answer, question.correctAnswer, question.key, question.correct_option, question.correctOption];
  for (const value of direct) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  const solution = question.solution;
  if (isRecord(solution)) {
    for (const key of ["answer", "correct_answer", "correct", "option", "key"]) {
      const value = solution[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }
  return undefined;
}

function flattenContent(value: unknown, depth = 0): string {
  if (depth > 5 || value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => flattenContent(item, depth + 1)).filter(Boolean).join(" ");
  if (!isRecord(value)) return "";

  const type = typeof value.type === "string" ? value.type.toLowerCase() : "";
  if (type === "text") return flattenContent(value.text ?? value.content ?? value.value, depth + 1);
  if (type === "math") {
    const latex = value.latex ?? value.value ?? value.content;
    return typeof latex === "string" ? latex : "";
  }
  if (type === "table" && Array.isArray(value.rows)) return flattenContent(value.rows, depth + 1);

  for (const key of ["text", "prompt", "statement", "stem", "content", "body", "question"]) {
    if (key in value) {
      const text = flattenContent(value[key], depth + 1);
      if (text) return text;
    }
  }
  return "";
}

function questionText(question: unknown): string {
  if (!isRecord(question)) return "Pregunta sin texto reconocible.";
  for (const candidate of [question.stem, question.prompt, question.statement, question.text, question.content, question.body]) {
    const text = flattenContent(candidate).replace(/\s+/g, " ").trim();
    if (text) return text.slice(0, 240);
  }
  return "Pregunta sin texto reconocible.";
}

function collectAssetReferences(value: unknown): string[] {
  const refs = new Set<string>();
  const visit = (current: unknown, depth: number) => {
    if (depth > 10 || current === null || current === undefined) return;
    if (typeof current === "string") {
      const normalized = current.replace(/\\/g, "/");
      const match = normalized.match(/(?:^|\/)(assets\/[^?#\s"'<>]+)/i);
      if (match) refs.add(match[1]);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (isRecord(current)) Object.values(current).forEach((item) => visit(item, depth + 1));
  };
  visit(value, 0);
  return [...refs];
}

function inferTitle(document: unknown, fileName: string): string {
  if (isRecord(document)) {
    const title = firstString([
      document.title,
      document.name,
      nested(document, "exam", "title"),
      nested(document, "metadata", "title"),
      nested(document, "source", "title"),
      nested(document, "document", "title"),
    ]);
    if (title) return title;
  }
  return fileName.replace(/\.(paessed|zip|json)$/i, "").replace(/[-_]+/g, " ").trim() || "Ensayo importado";
}

function sourceKind(file: File): ImportedExamSummary["sourceKind"] {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".paessed")) return "paessed";
  if (lower.endsWith(".json")) return "json";
  return "zip";
}

function buildSummary(finalJson: unknown, file: File, packageFiles: string[], finalJsonPath: string): ImportedExamSummary {
  const questions = getQuestions(finalJson);
  const idCount = questions.filter(hasExplicitId).length;
  const answerCount = questions.filter((question) => getAnswer(question) !== undefined).length;
  const normalizedFiles = packageFiles.map((path) => path.replace(/\\/g, "/").replace(/^\.?\//, ""));
  const assetFiles = normalizedFiles.filter((path) => /(^|\/)assets\//i.test(path) && !path.endsWith("/"));
  const assetRefs = collectAssetReferences(finalJson);
  const fileSet = new Set(normalizedFiles);
  const missingRefs = assetRefs.filter((ref) => {
    const normalized = ref.replace(/^\.?\//, "");
    if (fileSet.has(normalized)) return false;
    return !normalizedFiles.some((path) => path.endsWith("/" + normalized) || path.endsWith(normalized));
  });

  const issues: string[] = [];
  if (!finalJsonPath) issues.push("No se encontró final.json.");
  if (questions.length === 0) issues.push("No se encontró una lista de preguntas reconocible.");
  if (questions.length > 0 && idCount < questions.length) issues.push(String(questions.length - idCount) + " preguntas no tienen un ID explícito.");
  if (questions.length > 0 && answerCount < questions.length) issues.push(String(questions.length - answerCount) + " preguntas no tienen una respuesta detectable por el prototipo.");
  if (missingRefs.length > 0) issues.push(String(missingRefs.length) + " referencias a assets no existen dentro del paquete.");

  return {
    id: crypto.randomUUID(),
    title: inferTitle(finalJson, file.name),
    fileName: file.name,
    fileSizeBytes: file.size,
    questionCount: questions.length,
    idCount,
    answerCount,
    assetCount: assetFiles.length,
    referencedAssetCount: assetRefs.length,
    importedAt: new Date().toISOString(),
    sourceKind: sourceKind(file),
    issues,
    preview: questions.slice(0, 6).map((question, index) => ({ id: getQuestionId(question, index), text: questionText(question) })),
  };
}

async function parseFile(file: File): Promise<ParsedPackage> {
  const lower = file.name.toLowerCase();
  if (!/\.(paessed|zip|json)$/i.test(lower)) throw new Error("Usa un archivo .paessed, .zip o final.json.");

  if (lower.endsWith(".json")) {
    if (file.size > 24 * 1024 * 1024) throw new Error("JSON demasiado grande.");
    const finalJson: unknown = JSON.parse(await file.text());
    if (isRecord(finalJson) && finalJson.format === "paessed-benchmark") validatePaessed(finalJson);
    const packageFiles = [file.name];
    return { summary: buildSummary(finalJson, file, packageFiles, file.name), finalJson, packageFiles, finalJsonPath: file.name };
  }

  if (lower.endsWith(".paessed")) {
    const parsed = await readPaessed(file);
    const finalJson: unknown = parsed.data;
    const packageFiles = ["final.json", "manifest.json", ...Array.from(parsed.validation.resources.values(), (resource) => resource.path)];
    const summary = buildSummary(finalJson, file, packageFiles, "final.json");
    summary.issues.push(...(parsed.validation.warnings ?? []));
    return { summary, finalJson, archive: file, packageFiles, finalJsonPath: "final.json" };
  }

  // Preserve main's permissive legacy ZIP path for older imports with extra files
  // or nested final.json; only the .paessed extension uses the strict package reader.
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  const finalCandidates = entries
    .filter((name) => /(^|\/)final\.json$/i.test(name))
    .sort((a, b) => a.split("/").length - b.split("/").length || a.length - b.length);
  const finalPath = finalCandidates[0];
  if (!finalPath) {
    const empty: unknown = {};
    return { summary: buildSummary(empty, file, entries, ""), finalJson: empty, archive: file,
      packageFiles: entries, finalJsonPath: "", fatalError: "El paquete se pudo abrir, pero no contiene final.json." };
  }
  const raw = await zip.file(finalPath)?.async("string");
  if (!raw) throw new Error("final.json existe, pero no se pudo leer.");
  const finalJson: unknown = JSON.parse(raw);
  return { summary: buildSummary(finalJson, file, entries, finalPath), finalJson, archive: file,
    packageFiles: entries, finalJsonPath: finalPath };
}

/** Drag-and-drop entry point shared by the Ensayos list and the importer. */
export async function importExamFile(file: File): Promise<ImportedExamSummary> {
  const parsed = await parseFile(file);
  if (parsed.fatalError) throw new Error(parsed.fatalError);
  if (parsed.summary.questionCount === 0) {
    throw new Error("El archivo no contiene una lista de preguntas reconocible.");
  }
  await saveImportedExam({
    summary: parsed.summary,
    finalJson: parsed.finalJson,
    archive: parsed.archive,
  });
  return parsed.summary;
}

export function ImportExamPanel({ embedded = false, onBack, onImported }: { embedded?: boolean; onBack?: () => void; onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedPackage | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "ready" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);

  const canImport = useMemo(() => Boolean(parsed && !parsed.fatalError && parsed.summary.questionCount > 0), [parsed]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setParsed(null);
    setMessage("");
    setStatus("reading");
    try {
      const result = await parseFile(file);
      setParsed(result);
      setStatus(result.fatalError ? "error" : "ready");
      if (result.fatalError) setMessage(result.fatalError);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo leer el paquete.");
    }
  };

  const importPackage = async () => {
    if (!parsed || !canImport) return;
    setStatus("saving");
    setMessage("");
    try {
      const record: ImportedExamRecord = { summary: parsed.summary, finalJson: parsed.finalJson, archive: parsed.archive };
      await saveImportedExam(record);
      setStatus("saved");
      setMessage("Ensayo importado localmente. Ya aparece en tu sección Ensayos.");
      onImported?.();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el ensayo.");
    }
  };

  const onInput = (event: ChangeEvent<HTMLInputElement>) => void handleFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files?.[0]);
  };

  return (
    <>
      {embedded ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-[var(--border)] pb-4 sm:mb-6">
          <button type="button" onClick={onBack} className="soft-button grid h-10 w-10 shrink-0 place-items-center rounded-xl" aria-label="Volver a Ensayos">
            <ArrowLeft size={17} />
          </button>
          <motion.div
            layoutId="exams-import-heading"
            transition={{ type: "spring", stiffness: 280, damping: 35 }}
            className="min-w-0 flex-1 rounded-lg"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--primary)]">Importador local</p>
            <h1 className="mt-0.5 text-[21px] font-extrabold tracking-[-.03em] sm:text-[24px]">Importar ensayo</h1>
            <p className="mt-0.5 text-[11px] leading-5 text-[var(--muted)] sm:text-[12px]">
              Selecciona un paquete .paessed, .zip o final.json para revisarlo y guardarlo.
            </p>
          </motion.div>
        </div>
      ) : (
        <div className="mb-6 flex items-start gap-3">
          <Link href="/app/ensayos?source=local" className="soft-button grid h-10 w-10 shrink-0 place-items-center rounded-xl" aria-label="Volver a Ensayos"><ArrowLeft size={17} /></Link>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[var(--primary)]">Importador local</div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-[-.03em]">Añade un ensayo a PAESSED</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Selecciona el archivo .paessed generado por el importador. El navegador abre el paquete, busca final.json, comprueba preguntas y assets y muestra una vista previa antes de guardarlo.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <section className="space-y-4">
          <div
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={"rounded-[24px] border-2 border-dashed p-6 text-center transition sm:p-10 " + (dragging ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20" : "border-[var(--border-strong)] bg-[var(--surface)]")}
          >
            <input ref={inputRef} type="file" accept=".paessed,.zip,.json,application/zip,application/json" className="hidden" onChange={onInput} />
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><Upload size={24} /></div>
            <h2 className="mt-5 text-lg font-extrabold">Arrastra tu paquete aquí</h2>
            <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-[var(--muted)]">
              Acepta .paessed, .zip o un final.json. Nada se sube a un servidor: esta versión lo procesa localmente en tu navegador.
            </p>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={status === "reading" || status === "saving"} className="tactile-primary mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold disabled:opacity-50">
              <FileArchive size={16} />{status === "reading" ? "Leyendo paquete…" : "Elegir archivo"}
            </button>
          </div>

          {parsed && (
            <div className="surface-raised rounded-[24px] p-5 sm:p-6">
              <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--muted)]">
                    <PackageCheck size={15} className={parsed.fatalError ? "text-red-500" : "text-emerald-500"} />Vista previa
                  </div>
                  <h2 className="mt-2 truncate text-xl font-extrabold">{parsed.summary.title}</h2>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">{parsed.summary.fileName}</p>
                </div>
                <span className={"shrink-0 rounded-full px-3 py-1.5 text-[10px] font-extrabold " + (parsed.fatalError || parsed.summary.issues.length > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300")}>
                  {parsed.fatalError ? "NO IMPORTABLE" : parsed.summary.issues.length ? "CON ADVERTENCIAS" : "LISTO"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric icon={<FileJson2 size={17} />} label="Preguntas" value={String(parsed.summary.questionCount)} />
                <Metric icon={<ShieldCheck size={17} />} label="IDs" value={String(parsed.summary.idCount) + "/" + String(parsed.summary.questionCount)} />
                <Metric icon={<CheckCircle2 size={17} />} label="Respuestas" value={String(parsed.summary.answerCount) + "/" + String(parsed.summary.questionCount)} />
                <Metric icon={<Images size={17} />} label="Assets" value={String(parsed.summary.assetCount)} />
              </div>

              <div className="mt-6">
                <div className="flex items-center gap-2 text-xs font-extrabold"><Search size={15} className="text-[var(--secondary)]" />Primeras preguntas detectadas</div>
                <div className="mt-3 space-y-2">
                  {parsed.summary.preview.length ? parsed.summary.preview.map((item) => (
                    <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                      <div className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[var(--muted)]">Pregunta {item.id}</div>
                      <div className="mt-1 line-clamp-2 text-xs font-bold leading-5">{item.text}</div>
                    </div>
                  )) : (
                    <div className="rounded-xl bg-red-50 p-4 text-xs font-bold text-red-600 dark:bg-red-950/20 dark:text-red-300">No se pudieron detectar preguntas.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="surface rounded-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold"><ShieldCheck size={18} className="text-[var(--secondary)]" />Comprobaciones</div>
            {!parsed ? (
              <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Al elegir un archivo aparecerán aquí los resultados de la inspección.</p>
            ) : (
              <div className="mt-4 space-y-3">
                <CheckLine ok={Boolean(parsed.finalJsonPath)} text={parsed.finalJsonPath ? "final.json encontrado: " + parsed.finalJsonPath : "final.json no encontrado"} />
                <CheckLine ok={parsed.summary.questionCount > 0} text={String(parsed.summary.questionCount) + " preguntas detectadas"} />
                <CheckLine ok={parsed.summary.idCount === parsed.summary.questionCount && parsed.summary.questionCount > 0} text={String(parsed.summary.idCount) + "/" + String(parsed.summary.questionCount) + " preguntas con ID"} />
                <CheckLine ok={parsed.summary.answerCount === parsed.summary.questionCount && parsed.summary.questionCount > 0} text={String(parsed.summary.answerCount) + "/" + String(parsed.summary.questionCount) + " respuestas detectadas"} />
                <CheckLine ok={parsed.summary.issues.every((issue) => !issue.includes("assets no existen"))} text={String(parsed.summary.assetCount) + " archivos dentro de assets/"} />
              </div>
            )}
          </div>

          {parsed?.summary.issues.length ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 text-xs font-extrabold text-amber-700 dark:text-amber-300"><AlertTriangle size={16} />Advertencias</div>
              <div className="mt-3 space-y-2">
                {parsed.summary.issues.map((issue) => <p key={issue} className="text-[10px] leading-4 text-[var(--muted)]">{issue}</p>)}
              </div>
            </div>
          ) : null}

          {message && (
            <div className={"rounded-2xl border p-4 text-xs font-bold " + (status === "saved" ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300" : "border-red-300 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300")}>
              {message}
            </div>
          )}

          <button type="button" onClick={() => void importPackage()} disabled={!canImport || status === "saving" || status === "saved"} className="tactile-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-45">
            <PackageCheck size={16} />{status === "saving" ? "Importando…" : status === "saved" ? "Importado" : "Importar ensayo"}
          </button>

          {status === "saved" && (onBack ? (
            <button type="button" onClick={onBack} className="soft-button inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-xs font-extrabold">Ver en Mis ensayos</button>
          ) : (
            <Link href="/app/ensayos?source=local" className="soft-button inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-xs font-extrabold">Ver en Mis ensayos</Link>
          ))}

          <p className="px-1 text-[10px] leading-4 text-[var(--muted-2)]">
            El paquete y final.json se guardan en IndexedDB del navegador. Cuando conectemos backend, este mismo paso podrá enviar el paquete al servicio de ingestión.
          </p>
        </aside>
      </div>
    </>
  );
}

export function ImportExamExperience() {
  return (
    <AppShell title="Importar ensayo" eyebrow="Contenido local">
      <ImportExamPanel />
    </AppShell>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--muted)]">{icon}{label}</div>
      <div className="mt-2 text-xl font-extrabold">{value}</div>
    </div>
  );
}

function CheckLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2 text-[10px] font-bold leading-4 text-[var(--muted)]">
      {ok ? <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" /> : <XCircle size={15} className="mt-0.5 shrink-0 text-red-500" />}
      <span>{text}</span>
    </div>
  );
}
