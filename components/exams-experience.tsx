"use client";

import Link from "next/link";
import { useEffect, useState, type DragEvent } from "react";
import { ChevronRight, Play, Search, Settings, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { type ImportedExamSummary, listImportedExams } from "@/lib/local-imports";

type ExamRow = {
  id: string;
  kind: "example" | "imported";
  title: string;
  dateValue: number;
  takenLabel: string | null;
  importedLabel: string;
  score: number | null;
  correct: number | null;
  incorrect: number | null;
  omitted: number | null;
  questionCount: number;
  href: string;
  imported?: ImportedExamSummary;
};

// These two records reproduce the *visual examples* in the original PAESSED
// prototype. They are not student results. Never assign individual answers to
// imported exams unless those answers are actually stored in the data model.
const exampleExams = [
  {
    id: "example-invierno-2026",
    title: "Ensayo M1 INVIERNO 2026",
    date: "2026-09-29",
    takenLabel: "29 de septiembre de 2026",
    score: 829,
    correct: 46,
    incorrect: 15,
    omitted: 4,
  },
  {
    id: "example-cpech-2026",
    title: "Ensayo Cpech 2026",
    date: "2026-09-28",
    takenLabel: null,
    score: null,
    correct: 46,
    incorrect: 15,
    omitted: 4,
  },
] as const;

const EXAMS_PER_PAGE = 4;
const incorrectPositions = new Set([3, 7, 11, 15, 20, 24, 28, 32, 37, 41, 45, 50, 54, 59, 63]);
const omittedPositions = new Set([5, 21, 35, 60]);

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "fecha desconocida";
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function QuestionMap({ exam }: { exam: ExamRow }) {
  const hasExampleResults = exam.kind === "example";
  const legend = [
    { value: exam.correct, label: "correctas", color: "bg-emerald-500" },
    { value: exam.incorrect, label: "incorrectas", color: "bg-rose-500" },
    { value: exam.omitted, label: "omitidas", color: "bg-[#53627d]" },
  ];

  return (
    <div className="flex min-w-0 items-center gap-3 xl:gap-4">
      <div className="flex w-[91px] shrink-0 flex-col gap-1.5" aria-label="Resumen de respuestas">
        {legend.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 rounded-sm bg-[var(--surface-2)] px-1.5 py-1 text-[9px] font-semibold leading-none text-[var(--muted)]">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-[2px] ${hasExampleResults ? item.color : "bg-[var(--surface-4)]"}`} />
            <span className="whitespace-nowrap">{item.value === null ? "—" : item.value} {item.label}</span>
          </div>
        ))}
      </div>

      {exam.questionCount > 0 ? (
        <div
          role="img"
          aria-label={hasExampleResults
            ? `Mapa ilustrativo de ${exam.questionCount} preguntas: ${exam.correct} correctas, ${exam.incorrect} incorrectas y ${exam.omitted} omitidas`
            : `${exam.questionCount} preguntas; no hay resultados individuales disponibles`}
          className="grid w-full max-w-[470px] min-w-0 grid-cols-[repeat(22,minmax(0,1fr))] gap-[3px] max-[700px]:grid-cols-[repeat(13,minmax(0,1fr))]"
        >
          {Array.from({ length: exam.questionCount }, (_, index) => {
            const state = !hasExampleResults ? "pending" : omittedPositions.has(index) ? "omitted" : incorrectPositions.has(index) ? "incorrect" : "correct";
            const color = state === "correct" ? "bg-emerald-500" : state === "incorrect" ? "bg-rose-500" : state === "omitted" ? "bg-[#53627d]" : "bg-[var(--surface-4)]";
            return (
              <span
                key={index}
                aria-hidden="true"
                title={`Pregunta ${index + 1}: ${state === "pending" ? "sin resultados" : state === "correct" ? "correcta (ejemplo)" : state === "incorrect" ? "incorrecta (ejemplo)" : "omitida (ejemplo)"}`}
                className={`aspect-square min-w-0 rounded-[3px] ${color}`}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-[var(--muted)]">Sin preguntas detectadas</div>
      )}
    </div>
  );
}

export function ExamsExperience() {
  const [importedExams, setImportedExams] = useState<ImportedExamSummary[]>([]);
  const [importError, setImportError] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "oldest" | "score-high" | "score-low" | "name">("recent");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dropFeedback, setDropFeedback] = useState<{ error: boolean; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    void listImportedExams()
      .then((items) => { if (active) setImportedExams(items); })
      .catch(() => { if (active) setImportError(true); });
    return () => { active = false; };
  }, []);

  const rows: ExamRow[] = [
    ...importedExams.map((exam) => ({
      id: "imported-" + exam.id,
      kind: "imported" as const,
      title: exam.title,
      dateValue: new Date(exam.importedAt).getTime() || 0,
      takenLabel: null,
      importedLabel: formatDate(exam.importedAt),
      score: null,
      correct: null,
      incorrect: null,
      omitted: null,
      questionCount: exam.questionCount,
      href: "/app/ensayos/importado/" + encodeURIComponent(exam.id),
      imported: exam,
    })),
    ...exampleExams.map((exam) => ({
      id: exam.id,
      kind: "example" as const,
      title: exam.title,
      dateValue: new Date(exam.date + "T12:00:00Z").getTime(),
      takenLabel: exam.takenLabel,
      importedLabel: "28 de septiembre de 2026",
      score: exam.score,
      correct: exam.correct,
      incorrect: exam.incorrect,
      omitted: exam.omitted,
      questionCount: 65,
      href: "/app/ensayos/nuevo",
    })),
  ];

  const term = search.trim().toLocaleLowerCase("es");
  const matches = rows
    .filter((exam) => !term || `${exam.title} ${exam.importedLabel} ${exam.imported?.fileName ?? ""}`.toLocaleLowerCase("es").includes(term))
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
  const pages = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount]))
    .filter((number) => number >= 1 && number <= pageCount)
    .sort((a, b) => a - b);

  const onDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || importing) return;
    setImporting(true);
    setDropFeedback(null);
    try {
      const { importExamFile } = await import("@/components/import-exam");
      const summary = await importExamFile(file);
      const next = await listImportedExams();
      setImportedExams(next);
      setPage(1);
      setSort("recent");
      setSearch("");
      setDropFeedback({ error: false, message: `Ensayo «${summary.title}» importado a tu biblioteca local.` });
    } catch (error) {
      setDropFeedback({ error: true, message: error instanceof Error ? error.message : "No se pudo importar el archivo." });
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppShell title="Ensayos" eyebrow="Historial y práctica" wide>
      <div className="flex min-h-[calc(100vh-164px)] flex-col">
        <section className="mb-6">
          <h1 className="text-[36px] font-extrabold leading-[1.12] tracking-[-.035em] sm:text-[42px]">Tus ensayos</h1>
          <p className="mt-1.5 max-w-[650px] text-[13px] leading-[1.45] text-[var(--muted)] sm:text-sm">
            Aquí podrás revisar tus ensayos, respuestas correctas e incorrectas, y editar sus preguntas si es necesario.
          </p>
        </section>

        <section aria-label="Herramientas de ensayos" className="mb-3 flex flex-wrap items-center gap-3">
          <div className="surface inline-flex h-10 items-center rounded-[13px] px-3.5 text-sm font-extrabold">
            Ensayos: <span className="ml-1">{rows.length}</span>
          </div>
          <Link href="/app/ensayos/importar" className="soft-button inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-[11px] font-extrabold">
            <Upload size={15} /> Importar ensayo
          </Link>
          <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label htmlFor="exams-sort" className="sr-only">Ordenar ensayos</label>
            <select
              id="exams-sort"
              value={sort}
              onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1); }}
              className="soft-button h-10 w-[145px] cursor-pointer rounded-[12px] px-2.5 text-[11px] font-bold outline-offset-2"
            >
              <option value="recent">Más recientes</option>
              <option value="oldest">Más antiguos</option>
              <option value="score-high">Mayor puntaje</option>
              <option value="score-low">Menor puntaje</option>
              <option value="name">Nombre A–Z</option>
            </select>
            <div className="relative min-w-[175px] flex-1 sm:w-[185px] sm:flex-none">
              <label htmlFor="exams-search" className="sr-only">Buscar ensayos</label>
              <input
                id="exams-search"
                type="search"
                placeholder="Buscar"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                className="surface h-10 w-full rounded-[13px] py-2 pl-3.5 pr-9 text-sm font-semibold text-[var(--text)] outline-offset-2 placeholder:text-[var(--muted)]"
              />
              <Search size={17} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            </div>
          </div>
        </section>

        {importError && (
          <p role="alert" className="mb-3 rounded-xl border border-amber-400 px-3 py-2 text-xs text-amber-600">
            No se pudo leer la biblioteca local. Los ensayos de ejemplo siguen disponibles.
          </p>
        )}

        <section aria-label="Listado de ensayos" className="space-y-3">
          {visible.length === 0 ? (
            <div className="surface rounded-2xl px-6 py-10 text-center">
              <Search size={24} className="mx-auto text-[var(--muted)]" />
              <h2 className="mt-2 text-base font-extrabold">No encontramos ensayos</h2>
              <button type="button" onClick={() => { setSearch(""); setPage(1); }} className="soft-button mt-3 rounded-xl px-4 py-2 text-xs font-bold">Limpiar búsqueda</button>
            </div>
          ) : visible.map((exam) => {
            const expanded = expandedId === exam.id;
            const isImported = exam.kind === "imported";
            return (
              <article key={exam.id} className="surface overflow-hidden rounded-[16px] px-3 py-2.5 transition-colors hover:border-[var(--border-strong)] sm:px-3.5">
                <div className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[minmax(235px,1fr)_minmax(315px,1.13fr)_78px]">
                  <div className="min-w-0">
                    <h2 className="truncate text-[18px] font-extrabold leading-[1.25] tracking-[-.02em] sm:text-[20px]" title={exam.title}>{exam.title}</h2>
                    <div className="mt-0.5 text-[17px] font-extrabold leading-[1.2] tabular-nums">
                      {exam.score === null ? "N/A PTS" : exam.score + " PTS"}
                    </div>
                    <p className={`mt-0.5 text-[10px] font-semibold leading-4 ${exam.takenLabel ? "text-emerald-500" : "text-rose-500"}`}>
                      {exam.takenLabel ? "Rendido el " + exam.takenLabel : "Sin rendir aún"}
                    </p>
                    <p className="text-[9px] leading-4 text-[var(--muted-2)]">Importado el {exam.importedLabel}</p>
                  </div>

                  <div className="col-span-2 min-w-0 lg:col-span-1">
                    <QuestionMap exam={exam} />
                  </div>

                  <div className="col-start-2 row-start-1 flex items-center gap-1.5 self-stretch lg:col-start-3 lg:row-start-1">
                    <Link
                      href={exam.href}
                      aria-label={isImported ? "Ver contenido de " + exam.title : "Practicar " + exam.title}
                      title={isImported ? "Ver contenido importado" : "Practicar"}
                      className="flex h-full min-h-[66px] w-9 items-center justify-center rounded-[12px] bg-[var(--surface-4)] transition-colors hover:bg-[var(--surface-5)] sm:w-10"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--canvas)] text-[var(--primary)]">
                        {isImported ? <ChevronRight size={20} strokeWidth={3} /> : <Play size={17} fill="currentColor" />}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : exam.id)}
                      aria-expanded={expanded}
                      aria-controls={"exam-details-" + exam.id}
                      aria-label={"Detalles de " + exam.title}
                      title="Detalles del ensayo"
                      className="flex h-full min-h-[66px] w-9 items-center justify-center rounded-[12px] bg-[var(--surface-4)] transition-colors hover:bg-[var(--surface-5)] sm:w-10"
                    >
                      <Settings size={23} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div id={"exam-details-" + exam.id} className="mt-2 border-t border-[var(--border)] pt-2 text-[11px] leading-5 text-[var(--muted)]">
                    {isImported ? (
                      <>
                        <p><strong className="text-[var(--text)]">Archivo:</strong> {exam.imported?.fileName}</p>
                        <p><strong className="text-[var(--text)]">Formato:</strong> {exam.imported?.sourceKind.toUpperCase()} · <strong className="text-[var(--text)]">Recursos:</strong> {exam.imported?.assetCount}</p>
                        {Boolean(exam.imported?.issues.length) && <p className="text-amber-500">Advertencias: {exam.imported?.issues.length}</p>}
                        <p>El archivo importado todavía no incluye resultados personales de un estudiante.</p>
                      </>
                    ) : (
                      <p>Ensayo ilustrativo del prototipo. Los colores del mapa son de demostración, no respuestas reales guardadas. Para practicar, utiliza el botón de reproducción.</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section
          aria-label="Agregar ensayo"
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
          onDrop={(event) => void onDrop(event)}
          className={`mt-3 flex min-h-[94px] flex-col gap-3 rounded-[14px] border p-3 transition-colors md:flex-row md:items-center md:gap-5 ${dragging ? "border-[var(--primary)] bg-[var(--surface-5)]" : "border-[var(--border)] bg-[var(--surface-3)] dark:bg-[#313e56]"}`}
        >
          <div className="shrink-0 md:w-[170px]">
            <h2 className="text-[24px] font-extrabold uppercase leading-[.95] tracking-[-.025em] sm:text-[28px]">
              Agregar<br />ensayo
            </h2>
            <p className="mt-1.5 text-[9px] text-[var(--muted)]">Formato .zip / .paessed / .json</p>
          </div>
          <div className="flex min-h-[72px] flex-1 flex-wrap items-center justify-center gap-5 rounded-[4px] bg-[var(--surface-4)] px-3 py-2 dark:bg-[#3b4964]">
            <Link href="/app/ensayos/importar" className="soft-button inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[12px] px-4 text-[11px] font-extrabold">
              <Upload size={16} /> Importar ensayo
            </Link>
            <span className="text-center text-[22px] font-extrabold uppercase leading-none tracking-[-.025em] sm:text-[30px]">
              {importing ? "Importando..." : dragging ? "Suelta el archivo" : "O arrastrar"}
            </span>
          </div>
        </section>

        {dropFeedback && (
          <p role="status" className={`mt-2 rounded-xl border px-3 py-2 text-xs font-semibold ${dropFeedback.error ? "border-rose-400 text-rose-500" : "border-emerald-400 text-emerald-500"}`}>
            {dropFeedback.message}
          </p>
        )}

        <nav aria-label="Paginación de ensayos" className="mt-auto flex items-center justify-center gap-2 py-7">
          {pageCount > 1 && (
            <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="soft-button rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40">Anterior</button>
          )}
          {pages.map((number, index) => (
            <div key={number} className="flex items-center gap-2">
              {index > 0 && number - pages[index - 1] > 1 && <span className="text-[var(--muted)]">…</span>}
              <button
                type="button"
                onClick={() => setPage(number)}
                aria-current={currentPage === number ? "page" : undefined}
                className={`grid h-8 w-8 place-items-center rounded-lg border text-[17px] font-bold ${currentPage === number ? "border-[var(--primary)] bg-[var(--surface-2)] text-[var(--text)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--border-strong)]"}`}
              >{number}</button>
            </div>
          ))}
          {pageCount > 1 && (
            <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="soft-button rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40">Siguiente</button>
          )}
        </nav>
      </div>
    </AppShell>
  );
}
