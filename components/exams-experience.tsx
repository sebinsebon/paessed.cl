"use client";

import Link from "next/link";
import { ImportExamPanel } from "@/components/import-exam";
import { useEffect, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileArchive,
  Info,
  RotateCcw,
  Settings2,
  Search,
  Upload,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ExamSettingsDialog } from "@/components/exam-settings-dialog";
import { type ImportedExamSummary, listImportedExams } from "@/lib/local-imports";

type ExamRow = {
  id: string;
  kind: "example" | "imported";
  status: "completed" | "pending" | "library";
  title: string;
  dateValue: number;
  dateLabel: string;
  score: number | null;
  correct: number | null;
  incorrect: number | null;
  omitted: number | null;
  questionCount: number;
  href: string;
  imported?: ImportedExamSummary;
};

type SortOrder = "recent" | "oldest" | "score-high" | "score-low" | "name";
type UploadFeedback = { kind: "success" | "error"; message: string };

const EXAMS_PER_PAGE = 5;

// These are illustrative records from the original prototype, not student data.
const exampleExams: ExamRow[] = [
  {
    id: "example-invierno-2026",
    kind: "example",
    status: "completed",
    title: "Ensayo M1 Invierno 2026",
    dateValue: Date.parse("2026-09-29T12:00:00Z"),
    dateLabel: "Rendido el 29 de septiembre de 2026",
    score: 829,
    correct: 46,
    incorrect: 15,
    omitted: 4,
    questionCount: 65,
    href: "/app/ensayos/nuevo",
  },
  {
    id: "example-cpech-2026",
    kind: "example",
    status: "pending",
    title: "Ensayo Cpech 2026",
    dateValue: Date.parse("2026-09-28T12:00:00Z"),
    dateLabel: "Disponible para practicar",
    score: null,
    correct: null,
    incorrect: null,
    omitted: null,
    questionCount: 65,
    href: "/app/ensayos/nuevo",
  },
];

const exampleIncorrect = new Set([3, 7, 11, 15, 20, 24, 28, 32, 37, 41, 45, 50, 54, 59, 63]);
const exampleOmitted = new Set([5, 21, 35, 60]);

function displayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function buildRows(imported: ImportedExamSummary[]): ExamRow[] {
  return [
    ...imported.map((exam): ExamRow => ({
      id: "imported-" + exam.id,
      kind: "imported",
      status: "library",
      title: exam.title,
      dateValue: new Date(exam.importedAt).getTime() || 0,
      dateLabel: "Importado el " + displayDate(exam.importedAt),
      score: null,
      correct: null,
      incorrect: null,
      omitted: null,
      questionCount: exam.questionCount,
      href: "/app/ensayos/importado/" + encodeURIComponent(exam.id),
      imported: exam,
    })),
    ...exampleExams,
  ];
}

function QuestionMap({ exam }: { exam: ExamRow }) {
  const hasResult = exam.status === "completed" && exam.kind === "example";
  const count = Math.min(Math.max(exam.questionCount, 0), 500);
  const legend = [
    { label: "Correctas", number: exam.correct, className: "bg-emerald-500" },
    { label: "Incorrectas", number: exam.incorrect, className: "bg-rose-400" },
    { label: "Omitidas", number: exam.omitted, className: "bg-[var(--muted-2)] opacity-60" },
  ];

  return (
    <div className="min-w-0">
      <div className="mb-2.5 text-[11px] font-bold tabular-nums text-[var(--muted)]">{exam.questionCount} preguntas</div>
      {count > 0 ? (
        <div
          role="img"
          aria-label={
            hasResult
              ? "Mapa ilustrativo: " + exam.correct + " correctas, " + exam.incorrect + " incorrectas y " + exam.omitted + " omitidas"
              : exam.questionCount + " preguntas sin resultados individuales disponibles"
          }
          className="grid w-full max-w-[470px] grid-cols-[repeat(22,minmax(0,1fr))] gap-[3px] sm:gap-1"
        >
          {Array.from({ length: count }, (_, index) => {
            const state = !hasResult ? "Sin resultado" : exampleOmitted.has(index) ? "Omitida" : exampleIncorrect.has(index) ? "Incorrecta" : "Correcta";
            const color = !hasResult
              ? "bg-[var(--muted-2)] opacity-55"
              : state === "Correcta"
                ? "bg-emerald-500"
                : state === "Incorrecta"
                  ? "bg-rose-400"
                  : "bg-[var(--muted-2)] opacity-55";
            return (
              <span
                key={index}
                aria-hidden="true"
                title={"Pregunta " + (index + 1) + " · " + state + (hasResult ? " (ejemplo)" : "")}
                className={"aspect-square min-w-0 rounded-[3px] " + color}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-3 text-xs text-[var(--muted)]">
          No se detectaron preguntas
        </div>
      )}
      {hasResult ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-label="Distribución de respuestas de ejemplo">
          {legend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--muted)]">
              <span className={"h-2 w-2 shrink-0 rounded-[2px] " + item.className} />
              <span className="tabular-nums">{item.number} {item.label.toLocaleLowerCase("es")}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2.5 text-[11px] font-medium text-[var(--muted)]">
          Aún no hay resultados por pregunta.
        </p>
      )}
    </div>
  );
}

function ExamCard({ exam, expanded, onToggle, onSettings }: { exam: ExamRow; expanded: boolean; onToggle: () => void; onSettings: () => void }) {
  const isImported = exam.kind === "imported";
  const isCompleted = exam.status === "completed";
  const actionLabel = isImported ? "Ver preguntas" : "Practicar";
  return (
    <article className="group overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-1)]">
      <div className="grid items-center gap-5 p-4 sm:p-5 md:grid-cols-[minmax(235px,.9fr)_minmax(280px,1fr)] xl:grid-cols-[minmax(250px,.82fr)_minmax(320px,1fr)_148px] xl:gap-7">
        <div className="min-w-0">
          <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
            <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[.07em] text-[var(--muted)]">
              {isImported ? "Biblioteca local" : "Demostración"}
            </span>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                <CheckCircle2 size={12} /> Rendido
              </span>
            )}
          </div>
          <h2 className="text-[18px] font-extrabold leading-snug tracking-[-.025em] text-[var(--text)] sm:text-[20px]" title={exam.title}>
            {exam.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {exam.score === null ? (
              <span className="text-[14px] font-bold text-[var(--muted)]">
                {isImported ? "Sin puntaje registrado" : "Pendiente"}
              </span>
            ) : (
              <div className="flex items-baseline gap-1">
                <strong className="text-[27px] font-extrabold leading-none tracking-[-.045em] tabular-nums text-[var(--text)]">{exam.score}</strong>
                <span className="text-[13px] font-bold text-[var(--muted)]">pts</span>
              </div>
            )}
            {isCompleted && (
              <span className="text-[11px] font-semibold text-[var(--muted)]">{exam.correct}/{exam.questionCount} correctas</span>
            )}
          </div>
          <p className="mt-2 text-[11px] font-medium text-[var(--muted)]">{exam.dateLabel}</p>
        </div>

        <QuestionMap exam={exam} />

        <div className="flex items-center gap-2 md:col-span-2 xl:col-span-1 xl:flex-col xl:items-stretch">
          <Link
            href={exam.href}
            aria-label={actionLabel + ": " + exam.title}
            className="inline-flex min-h-10 items-center justify-center gap-2.5 rounded-xl bg-[var(--primary)] px-4 text-[12px] font-extrabold text-white shadow-[0_3px_0_var(--primary-pressed)] transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--primary)] active:translate-y-0.5 active:shadow-[0_1px_0_var(--primary-pressed)]"
          >
            {actionLabel}<ArrowRight size={15} strokeWidth={2.5} />
          </Link>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={"exam-details-" + exam.id}
            onClick={onToggle}
            className="soft-button inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-[12px] font-bold focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--primary)]"
          >
            Detalles <ChevronDown size={15} className={"transition-transform duration-150 " + (expanded ? "rotate-180" : "")} />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            id={"exam-details-" + exam.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.29, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.22 } }}
            className="overflow-hidden border-t border-[var(--border)] bg-[var(--surface-2)]"
          >
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 flex-1">
                {isImported ? (
                  <div className="flex flex-col gap-1.5 text-[12px] leading-5 text-[var(--muted)]">
                    <p><span className="font-bold text-[var(--text)]">Archivo:</span> {exam.imported?.fileName}</p>
                    <p><span className="font-bold text-[var(--text)]">Contenido:</span> {exam.questionCount} preguntas · {exam.imported?.answerCount ?? 0} respuestas en solucionario · {exam.imported?.assetCount ?? 0} recursos</p>
                    {Boolean(exam.imported?.issues.length) && (
                      <p className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><AlertCircle size={14} /> {exam.imported?.issues.length} advertencias detectadas durante la importación</p>
                    )}
                    <p>El solucionario importado no representa respuestas rendidas por el estudiante.</p>
                  </div>
                ) : (
                  <p className="flex items-start gap-2 text-[12px] leading-5 text-[var(--muted)]">
                    <Info size={15} className="mt-0.5 shrink-0" />
                    Este ensayo es una demostración visual. {isCompleted ? "El puntaje y los colores son ilustrativos; no son resultados guardados." : "Todavía no tiene respuestas rendidas."} El botón Practicar abre una sesión de práctica del prototipo.
                  </p>
                )}
              </div>
              {isImported && (
                <button
                  type="button"
                  onClick={onSettings}
                  className="soft-button inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl px-4 text-[12px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] md:ml-auto md:self-center"
                  aria-label={"Abrir ajustes del ensayo " + exam.title}
                >
                  <Settings2 size={16} /> Ajustes
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

export function ExamsExperience() {
  const [importedExams, setImportedExams] = useState<ImportedExamSummary[]>([]);
  const [importError, setImportError] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOrder>("recent");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [settingsExamId, setSettingsExamId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [feedback, setFeedback] = useState<UploadFeedback | null>(null);

  useEffect(() => {
    let active = true;
    void listImportedExams()
      .then((items) => { if (active) setImportedExams(items); })
      .catch(() => { if (active) setImportError(true); });
    return () => { active = false; };
  }, []);

  const rows = buildRows(importedExams);
  const term = normalizeSearch(search.trim());
  const matches = rows
    .filter((exam) => !term || normalizeSearch(exam.title + " " + exam.dateLabel + " " + (exam.imported?.fileName ?? "")).includes(term))
    .sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title, "es") || b.dateValue - a.dateValue;
      if (sort === "score-high" || sort === "score-low") {
        if (a.score === null) return b.score === null ? b.dateValue - a.dateValue : 1;
        if (b.score === null) return -1;
        return (sort === "score-high" ? b.score - a.score : a.score - b.score) || b.dateValue - a.dateValue;
      }
      return sort === "oldest" ? a.dateValue - b.dateValue : b.dateValue - a.dateValue;
    });
  const pageCount = Math.max(1, Math.ceil(matches.length / EXAMS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const visible = matches.slice((currentPage - 1) * EXAMS_PER_PAGE, currentPage * EXAMS_PER_PAGE);

  const onDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || importing) return;
    setImporting(true);
    setFeedback(null);
    try {
      const { importExamFile } = await import("@/components/import-exam");
      const summary = await importExamFile(file);
      setImportedExams(await listImportedExams());
      setSearch("");
      setSort("recent");
      setPage(1);
      setFeedback({ kind: "success", message: "«" + summary.title + "» se agregó a tu biblioteca local." });
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "No se pudo leer el archivo." });
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppShell title="Ensayos" eyebrow="Historial y práctica" wide>
      <AnimatePresence initial={false} mode="popLayout">
        {!showImportPanel ? (
          <motion.div
            key="exams-home"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18, scale: 0.99 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-[1460px] pb-5"
          >
        <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <motion.div
            layoutId="exams-import-heading"
            transition={{ type: "spring", stiffness: 280, damping: 35 }}
            className="min-w-0">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--primary)]">
              Historial y práctica
            </p>
            <h1 className="text-[34px] font-extrabold leading-tight tracking-[-.04em] sm:text-[42px]">Tus ensayos</h1>
            <p className="mt-1.5 max-w-[640px] text-[13px] leading-[1.6] text-[var(--muted)] sm:text-sm">
              Revisa tus resultados, explora las preguntas y continúa practicando.
            </p>
          </motion.div>
          <button
            type="button"
            onClick={() => { window.scrollTo({ top: 0, behavior: "instant" }); setShowImportPanel(true); }}
            className="tactile-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-[12px] font-extrabold focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--primary)]"
          >
            <Upload size={17} strokeWidth={2.4} />
            Importar ensayo
          </button>
        </header>

        <section aria-label="Buscar y ordenar ensayos" className="mb-4 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-bold text-[var(--text)]">
              <strong className="font-extrabold tabular-nums">{rows.length}</strong> {rows.length === 1 ? "ensayo" : "ensayos"}
            </span>
            <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-bold text-[var(--muted)]">
              {importedExams.length > 0 ? importedExams.length + (importedExams.length === 1 ? " importado" : " importados") + " · " : ""}2 de ejemplo
            </span>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[245px]">
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <label htmlFor="exam-search" className="sr-only">Buscar ensayos</label>
              <input
                id="exam-search"
                type="search"
                value={search}
                placeholder="Buscar ensayo..."
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 pl-10 pr-9 text-[12px] font-semibold text-[var(--text)] outline-offset-2 placeholder:text-[var(--muted)] focus:border-[var(--primary)]"
              />
              {search && (
                <button type="button" aria-label="Borrar búsqueda" onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)]">
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="relative w-full sm:w-[158px]">
              <label htmlFor="exam-sort" className="sr-only">Ordenar ensayos</label>
              <select
                id="exam-sort"
                value={sort}
                onChange={(event) => { setSort(event.target.value as SortOrder); setPage(1); }}
                className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 pl-3 pr-8 text-[12px] font-bold text-[var(--text)] outline-offset-2 focus:border-[var(--primary)]"
              >
                <option value="recent">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="score-high">Mayor puntaje</option>
                <option value="score-low">Menor puntaje</option>
                <option value="name">Nombre A–Z</option>
              </select>
              <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            </div>
          </div>
        </section>

        {importError && (
          <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-[12px] text-[var(--text)]">
            <AlertCircle size={16} className="shrink-0 text-amber-500" />
            No fue posible leer la biblioteca de este navegador. Los ensayos de demostración siguen visibles.
          </div>
        )}

        {feedback && (
          <div role={feedback.kind === "error" ? "alert" : "status"} className={"mb-4 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[12px] " + (feedback.kind === "error" ? "border-rose-500/40 bg-rose-500/10" : "border-emerald-500/40 bg-emerald-500/10")}>
            {feedback.kind === "error" ? <AlertCircle size={17} className="shrink-0 text-rose-500" /> : <CheckCircle2 size={17} className="shrink-0 text-emerald-500" />}
            <span className="flex-1 text-[var(--text)]">{feedback.message}</span>
            <button type="button" aria-label="Cerrar mensaje" onClick={() => setFeedback(null)} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)]"><X size={15} /></button>
          </div>
        )}

        <section aria-label="Listado de ensayos" className="space-y-3.5">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-12 text-center">
              <Search size={23} className="text-[var(--muted)]" />
              <h2 className="mt-3 text-[16px] font-extrabold">No encontramos ensayos</h2>
              <p className="mt-1 text-[12px] text-[var(--muted)]">Prueba con otra palabra o vuelve a mostrar todos.</p>
              <button type="button" onClick={() => { setSearch(""); setPage(1); }} className="soft-button mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[12px] font-bold">
                <RotateCcw size={15} /> Limpiar búsqueda
              </button>
            </div>
          ) : visible.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              expanded={expandedId === exam.id}
              onToggle={() => setExpandedId((previous) => previous === exam.id ? null : exam.id)}
              onSettings={() => { if (exam.imported) setSettingsExamId(exam.imported.id); }}
            />
          ))}
        </section>

        {pageCount > 1 && (
          <nav aria-label="Paginación de ensayos" className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-[var(--muted)]">
              Mostrando {(currentPage - 1) * EXAMS_PER_PAGE + 1}–{Math.min(currentPage * EXAMS_PER_PAGE, matches.length)} de {matches.length}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="soft-button grid h-9 w-9 place-items-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={17} /></button>
              <span className="min-w-14 text-center text-[12px] font-bold tabular-nums text-[var(--text)]">{currentPage} de {pageCount}</span>
              <button type="button" aria-label="Página siguiente" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="soft-button grid h-9 w-9 place-items-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={17} /></button>
            </div>
          </nav>
        )}

        <section
          aria-label="Arrastrar un ensayo para importar"
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
          onDrop={(event) => { void onDrop(event); }}
          className={"mt-5 flex min-h-[75px] items-center gap-3 rounded-[16px] border border-dashed p-4 transition-colors duration-150 " + (dragging ? "border-[var(--primary)] bg-[var(--primary-soft)] dark:bg-[var(--surface-3)]" : "border-[var(--border-strong)] bg-[var(--surface-2)]/40")}
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
            <FileArchive size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-[var(--text)]">
              {importing ? "Importando el ensayo..." : dragging ? "Suelta el archivo aquí" : "¿Ya tienes un ensayo? Arrástralo aquí"}
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
              Formatos .paessed, .zip o .json · Se guarda en este navegador
            </p>
          </div>
        </section>
          </motion.div>
        ) : (
          <motion.div
            key="exams-import"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-[1460px] pb-5"
          >
            <ImportExamPanel
              embedded
              onBack={() => {
                setShowImportPanel(false);
                void listImportedExams().then(setImportedExams).catch(() => setImportError(true));
              }}
              onImported={() => {
                void listImportedExams().then((items) => {
                  setImportedExams(items);
                  setSearch("");
                  setSort("recent");
                  setPage(1);
                }).catch(() => setImportError(true));
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {settingsExamId && (
        <ExamSettingsDialog
          examId={settingsExamId}
          onClose={() => setSettingsExamId(null)}
          onSaved={async () => { setImportedExams(await listImportedExams()); }}
        />
      )}
    </AppShell>
  );
}
