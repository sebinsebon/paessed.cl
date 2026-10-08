"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Flame,
  Gamepad2,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Route,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  X,
  Target,
  Trophy,
  UserRound,
  Upload,
  PackageCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ImportedExamSummary, listImportedExams } from "@/lib/local-imports";

const learningNodes = [
  { title: "Números racionales", subtitle: "Repaso rápido", state: "done", xp: "+20 XP" },
  { title: "Porcentajes y variación", subtitle: "Dominio alto", state: "done", xp: "+20 XP" },
  { title: "Potencias y raíces", subtitle: "Reforzar", state: "active", xp: "+30 XP" },
  { title: "Expresiones algebraicas", subtitle: "Siguiente unidad", state: "next", xp: "+30 XP" },
  { title: "Ecuaciones lineales", subtitle: "Bloqueado", state: "locked", xp: "+40 XP" },
];

export function LearnExperience() {
  return (
    <AppShell title="Aprender" eyebrow="Ruta adaptativa">
      <section className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-3 py-1.5 text-[10px] font-extrabold text-[var(--primary)]">
          <Sparkles size={14} />RUTA PERSONALIZADA
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-.03em]">Tu camino para subir M1</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Avanza por unidades cortas. PAESSED mueve el orden cuando tus respuestas muestran una nueva debilidad o una mejora real.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_360px]">
        <section className="surface-raised rounded-[24px] p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--muted)]">Ruta actual</div>
              <div className="mt-1 text-lg font-extrabold">Fundamentos prioritarios</div>
            </div>
            <div className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[10px] font-extrabold text-[var(--muted)]">3/12 nodos</div>
          </div>

          <div className="relative mt-8 space-y-7">
            <div className="absolute bottom-8 left-[27px] top-8 w-1 rounded-full bg-[var(--surface-3)]" />
            {learningNodes.map((node, index) => {
              const active = node.state === "active";
              const done = node.state === "done";
              const locked = node.state === "locked";
              const circleClass = done
                ? "bg-emerald-500 text-white shadow-[0_4px_0_#047857]"
                : active
                  ? "bg-[var(--primary)] text-white shadow-[0_4px_0_var(--primary-pressed)] ring-8 ring-orange-100 dark:ring-orange-950/30"
                  : locked
                    ? "bg-[var(--surface-3)] text-[var(--muted-2)]"
                    : "bg-[var(--secondary)] text-white shadow-[0_4px_0_#4338ca]";
              return (
                <div key={node.title} className="relative z-10 flex items-start gap-4">
                  <div className={"grid h-14 w-14 shrink-0 place-items-center rounded-2xl " + circleClass}>
                    {done ? <Check size={22} strokeWidth={3} /> : locked ? <Lock size={20} /> : <BookOpen size={20} />}
                  </div>
                  <div className={"flex-1 rounded-2xl border p-4 " + (active ? "border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20" : "border-[var(--border)] bg-[var(--surface)]")}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-extrabold">{node.title}</div>
                        <div className="mt-1 text-xs font-medium text-[var(--muted)]">{node.subtitle}</div>
                      </div>
                      <div className="text-[10px] font-extrabold text-[var(--muted)]">{node.xp}</div>
                    </div>
                    {active && (
                      <Link href="/app/playground" className="tactile-primary mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-extrabold">
                        Continuar lección <ArrowRight size={15} />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="surface rounded-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold"><Target size={18} className="text-red-500" />Talón de Aquiles</div>
            <div className="mt-4 rounded-2xl bg-red-50 p-4 dark:bg-red-950/20">
              <div className="text-[10px] font-extrabold uppercase tracking-[.1em] text-red-500">Geometría</div>
              <div className="mt-1 text-lg font-extrabold">Teorema de Tales</div>
              <div className="mt-1 text-xs leading-5 text-[var(--muted)]">34% de dominio · evidencia media</div>
            </div>
            <button className="soft-button mt-4 w-full rounded-xl px-4 py-3 text-xs font-extrabold">Hacer flash quiz</button>
          </div>

          <div className="surface rounded-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold"><Flame size={18} className="text-orange-500" />Racha de aprendizaje</div>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-extrabold">12</span>
              <span className="pb-1 text-xs font-bold text-[var(--muted)]">días seguidos</span>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => <div key={i} className={"h-9 rounded-lg " + (i < 6 ? "bg-orange-100 dark:bg-orange-950/30" : "bg-[var(--surface-3)]")} />)}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

type ExamListRow = {
  id: string;
  kind: "demo" | "imported";
  title: string;
  dateValue: number;
  dateLabel: string;
  score: number | null;
  correct: number | null;
  questionCount: number;
  href: string;
  imported?: ImportedExamSummary;
};

const demoExams = [
  { id: "demo-21", title: "Ensayo M1 · Septiembre", date: "2026-09-21", dateLabel: "21 sep 2026", score: 742, correct: 51 },
  { id: "demo-12", title: "Ensayo M1 · Septiembre", date: "2026-09-12", dateLabel: "12 sep 2026", score: 728, correct: 49 },
  { id: "demo-03", title: "Ensayo M1 · Septiembre", date: "2026-09-03", dateLabel: "03 sep 2026", score: 711, correct: 47 },
] as const;

const EXAMS_PER_PAGE = 4;

function formatImportedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function ExamQuestionMap({ count, title }: { count: number; title: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-[10px] font-extrabold text-[var(--muted)]">Mapa de preguntas · {count}</span>
        <span className="text-[9px] font-semibold text-[var(--muted-2)]">Sin detalle de respuestas</span>
      </div>
      {count > 0 ? (
        <div
          role="img"
          aria-label={title + ": " + count + " preguntas sin resultados individuales disponibles"}
          className="grid w-full max-w-[350px] grid-cols-[repeat(13,minmax(0,1fr))] gap-1"
        >
          {Array.from({ length: count }, (_, index) => (
            <span
              key={index}
              aria-hidden="true"
              title={"Pregunta " + (index + 1) + ": resultado no disponible"}
              className="aspect-square min-w-0 rounded-[3px] bg-[var(--surface-4)] ring-1 ring-inset ring-[var(--border)]"
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-[var(--surface-2)] px-3 py-3 text-xs text-[var(--muted)]">No se detectaron preguntas.</p>
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

  useEffect(() => {
    let active = true;
    void listImportedExams()
      .then((items) => { if (active) setImportedExams(items); })
      .catch(() => { if (active) setImportError(true); });
    return () => { active = false; };
  }, []);

  const rows: ExamListRow[] = [
    ...importedExams.map((exam) => ({
      id: "imported-" + exam.id,
      kind: "imported" as const,
      title: exam.title,
      dateValue: new Date(exam.importedAt).getTime() || 0,
      dateLabel: formatImportedDate(exam.importedAt),
      score: null,
      correct: null,
      questionCount: exam.questionCount,
      href: "/app/ensayos/importado/" + encodeURIComponent(exam.id),
      imported: exam,
    })),
    ...demoExams.map((exam) => ({
      id: exam.id,
      kind: "demo" as const,
      title: exam.title,
      dateValue: new Date(exam.date + "T12:00:00Z").getTime(),
      dateLabel: exam.dateLabel,
      score: exam.score,
      correct: exam.correct,
      questionCount: 65,
      href: "/app/ensayos/nuevo",
    })),
  ];
  const term = search.trim().toLocaleLowerCase("es");
  const matches = rows
    .filter((exam) => !term || (exam.title + " " + exam.dateLabel + " " + (exam.kind === "imported" ? exam.imported?.fileName ?? "" : "práctica")).toLocaleLowerCase("es").includes(term))
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
  const pageNumbers = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount]))
    .filter((number) => number >= 1 && number <= pageCount)
    .sort((a, b) => a - b);

  return (
    <AppShell title="Ensayos" eyebrow="Medición real">
      <section className="mb-7">
        <div className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[var(--primary)]">Historial y práctica</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-.03em] sm:text-4xl">Tus ensayos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Revisa tus ensayos, puntajes y preguntas. Encuentra lo que necesitas para seguir practicando.
        </p>
      </section>

      <section aria-label="Herramientas de ensayos" className="mb-4 flex flex-wrap items-center gap-3">
        <div className="surface inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-extrabold">
          Ensayos: <span className="ml-1.5 text-[var(--primary)]">{rows.length}</span>
        </div>
        <Link href="/app/ensayos/importar" className="soft-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold">
          <Upload size={16} /> Importar ensayo
        </Link>
        <div className="w-full sm:ml-auto sm:w-auto">
          <label htmlFor="exams-sort" className="sr-only">Ordenar ensayos</label>
          <select
            id="exams-sort"
            value={sort}
            onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1); }}
            className="soft-button h-11 w-full cursor-pointer rounded-xl px-3 text-xs font-extrabold outline-offset-2 sm:w-auto"
          >
            <option value="recent">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="score-high">Mayor puntaje</option>
            <option value="score-low">Menor puntaje</option>
            <option value="name">Nombre A–Z</option>
          </select>
        </div>
        <div className="relative w-full sm:w-[220px]">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <label htmlFor="exams-search" className="sr-only">Buscar ensayos</label>
          <input
            id="exams-search"
            type="search"
            placeholder="Buscar ensayos"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            className="surface h-11 w-full rounded-xl py-2 pl-10 pr-3 text-xs font-semibold text-[var(--text)] outline-offset-2 placeholder:text-[var(--muted)]"
          />
        </div>
      </section>

      {importError && (
        <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          No se pudo leer la biblioteca local de este navegador. Se siguen mostrando los ensayos de ejemplo.
        </p>
      )}

      <section aria-label="Listado de ensayos" className="space-y-3">
        {visible.length === 0 ? (
          <div className="surface rounded-2xl px-6 py-12 text-center">
            <Search size={24} className="mx-auto text-[var(--muted)]" />
            <h2 className="mt-3 text-base font-extrabold">No encontramos ensayos</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Prueba con otro término de búsqueda.</p>
            <button type="button" onClick={() => { setSearch(""); setPage(1); }} className="soft-button mt-4 rounded-xl px-4 py-2 text-xs font-extrabold">Limpiar búsqueda</button>
          </div>
        ) : visible.map((exam) => {
          const expanded = expandedId === exam.id;
          const isImported = exam.kind === "imported";
          return (
            <article key={exam.id} className="surface rounded-[20px] p-4 transition-colors hover:border-[var(--border-strong)] sm:p-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="mb-2 inline-flex items-center rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.07em] text-[var(--muted)]">
                    {isImported ? "Importado · Biblioteca local" : "Ensayo de ejemplo"}
                  </div>
                  <h2 className="break-words text-base font-extrabold leading-snug sm:text-lg">{exam.title}</h2>
                  <div className="mt-2 text-xl font-extrabold tabular-nums">
                    {exam.score === null ? "Sin rendir" : exam.score + " pts"}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                    {isImported ? exam.questionCount + " preguntas · " + exam.imported?.answerCount + " respuestas en solucionario" : exam.correct + "/65 correctas · resultado general"}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--muted-2)]">
                    {isImported ? "Importado el " : "Rendido el "}{exam.dateLabel}
                  </p>
                </div>

                <ExamQuestionMap count={exam.questionCount} title={exam.title} />

                <div className="flex items-center gap-2 lg:flex-col lg:justify-center">
                  <Link
                    href={exam.href}
                    aria-label={isImported ? "Ver contenido de " + exam.title : "Iniciar ensayo de práctica"}
                    title={isImported ? "Ver contenido importado" : "Iniciar ensayo de práctica"}
                    className="tactile-primary inline-flex h-11 w-11 items-center justify-center rounded-xl"
                  >
                    {isImported ? <ChevronRight size={21} /> : <Play size={19} fill="currentColor" />}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : exam.id)}
                    aria-expanded={expanded}
                    aria-controls={"exam-details-" + exam.id}
                    aria-label={"Detalles de " + exam.title}
                    title="Detalles del ensayo"
                    className="soft-button inline-flex h-11 w-11 items-center justify-center rounded-xl"
                  >
                    <Settings size={19} />
                  </button>
                  <span className="text-[10px] font-bold text-[var(--muted)] lg:text-center">
                    {isImported ? "Ver archivo" : "Practicar"}
                  </span>
                </div>
              </div>

              {expanded && (
                <div id={"exam-details-" + exam.id} className="mt-4 border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--muted)]">
                  {isImported ? (
                    <>
                      <p><strong className="text-[var(--text)]">Archivo:</strong> {exam.imported?.fileName}</p>
                      <p><strong className="text-[var(--text)]">Formato:</strong> {exam.imported?.sourceKind.toUpperCase()} · <strong className="text-[var(--text)]">Recursos:</strong> {exam.imported?.assetCount}</p>
                      {Boolean(exam.imported?.issues.length) && <p className="mt-1 text-amber-600 dark:text-amber-400">Advertencias de importación: {exam.imported?.issues.length}</p>}
                      <p className="mt-1">Todavía no hay resultados de un estudiante para este ensayo importado.</p>
                    </>
                  ) : (
                    <p>Este es un resultado de demostración. El prototipo conserva el puntaje general, pero no las respuestas individuales. El botón de práctica abre un ensayo nuevo.</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="surface mt-4 flex flex-col items-center justify-between gap-5 rounded-[20px] border-dashed p-5 text-center sm:flex-row sm:p-6 sm:text-left">
        <div>
          <h2 className="text-xl font-extrabold tracking-[-.02em]">Agregar ensayo</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Incorpora un ensayo a tu biblioteca local.</p>
          <p className="mt-1 text-[10px] font-semibold text-[var(--muted-2)]">Formatos .paessed, .zip y .json</p>
        </div>
        <Link href="/app/ensayos/importar" className="tactile-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold">
          <Upload size={17} /> Abrir importador
        </Link>
        <p className="max-w-[200px] text-xs font-semibold text-[var(--muted)]">Selecciona o arrastra el archivo en el importador.</p>
      </section>

      <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs font-semibold text-[var(--muted)]">
          {matches.length ? "Mostrando " + ((currentPage - 1) * EXAMS_PER_PAGE + 1) + "–" + Math.min(currentPage * EXAMS_PER_PAGE, matches.length) + " de " + matches.length : "0 ensayos"}
        </p>
        <nav aria-label="Paginación de ensayos" className="flex items-center gap-1.5">
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="soft-button min-h-9 rounded-lg px-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
          {pageNumbers.map((number, index) => (
            <div key={number} className="flex items-center gap-1.5">
              {index > 0 && number - pageNumbers[index - 1] > 1 && <span aria-hidden="true" className="px-1 text-xs text-[var(--muted)]">…</span>}
              <button
                type="button"
                aria-current={currentPage === number ? "page" : undefined}
                onClick={() => setPage(number)}
                className={"grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-xs font-extrabold " + (currentPage === number ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--border-strong)]")}
              >
                {number}
              </button>
            </div>
          ))}
          <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="soft-button min-h-9 rounded-lg px-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
        </nav>
      </div>
    </AppShell>
  );
}

type PlaygroundQuestion = {
  id: string;
  number: number;
  year: number;
  collection: string;
  axis: string;
  topic: string;
  stem: string;
  options: [string, string, string, string, string];
  correct: string;
  explanation: string;
};

/** Original examples for the UI prototype: not official DEMRE questions. */
const playgroundQuestions: PlaygroundQuestion[] = [
  {
    id: "m1-2026-01", number: 1, year: 2026,
    collection: "Ensayo de práctica", axis: "Números", topic: "Decimales",
    stem: "¿Cuál es el valor de 2,32 + 17,4?",
    options: ["19,72", "19,44", "19,36", "18,72", "19,06"],
    correct: "A",
    explanation: "Alineamos las comas decimales: 2,32 + 17,40 = 19,72.",
  },
  {
    id: "m1-2026-02", number: 2, year: 2026,
    collection: "Ensayo de práctica", axis: "Álgebra y funciones", topic: "Proporcionalidad",
    stem: "La distancia de reacción de un vehículo es directamente proporcional a su velocidad. Si a 110 km/h recorre 33 m, ¿cuántos metros recorre a 30 km/h?",
    options: ["3 m", "6 m", "9 m", "10 m", "11 m"],
    correct: "C",
    explanation: "La razón es 33 ÷ 110 = 0,3. A 30 km/h recorre 30 × 0,3 = 9 metros.",
  },
  {
    id: "m1-2025-03", number: 3, year: 2025,
    collection: "Ensayo de práctica", axis: "Geometría", topic: "Semejanza",
    stem: "Dos triángulos son semejantes. El lado de 4 cm del primero corresponde a uno de 10 cm del segundo. ¿Cuánto mide en el segundo triángulo el lado que corresponde a uno de 6 cm del primero?",
    options: ["10 cm", "12 cm", "14 cm", "15 cm", "18 cm"],
    correct: "D",
    explanation: "La razón de semejanza es 10 ÷ 4 = 2,5. Por lo tanto, 6 × 2,5 = 15 cm.",
  },
  {
    id: "m1-2025-04", number: 4, year: 2025,
    collection: "Ensayo de práctica", axis: "Probabilidad y estadística", topic: "Porcentajes",
    stem: "De un grupo de 50 estudiantes, 18 prefieren estudiar por la mañana. ¿Qué porcentaje del grupo representan esos estudiantes?",
    options: ["18 %", "25 %", "32 %", "36 %", "50 %"],
    correct: "D",
    explanation: "18 de 50 equivale a 18 ÷ 50 = 0,36, es decir, 36 %.",
  },

];

const playgroundAnswerLetters = ["A", "B", "C", "D", "E"] as const;
const playgroundQuestionFont = { fontFamily: 'Georgia, "Times New Roman", serif' };

function shufflePlaygroundQuestions(questions: PlaygroundQuestion[]): string[] {
  const ids = questions.map((question) => question.id);
  for (let index = ids.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[randomIndex]] = [ids[randomIndex], ids[index]];
  }
  return ids;
}

export function PlaygroundExperience() {
  const [year, setYear] = useState("all");
  const [axis, setAxis] = useState("all");
  const [selectedStartQuestion, setSelectedStartQuestion] = useState("random");
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedQuestionIds, setSavedQuestionIds] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [isPracticing, setIsPracticing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paperTheme, setPaperTheme] = useState<"auto" | "light" | "dark">("auto");
  const settingsRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [position, setPosition] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [pendingAction, setPendingAction] = useState<"check" | "next" | null>(null);

  const axes = Array.from(new Set(playgroundQuestions.map((question) => question.axis)));
  const questions = playgroundQuestions.filter((question) =>
    (year === "all" || String(question.year) === year) &&
    (axis === "all" || question.axis === axis) &&
    (!savedOnly || savedQuestionIds.includes(question.id))
  );
  // Keep the session's question pool stable even if a bookmark is removed mid-practice.
  const sessionQuestions = isPracticing
    ? playgroundQuestions.filter((question) => order.includes(question.id))
    : questions;
  const visibleOrder = order.filter((id) => sessionQuestions.some((question) => question.id === id));
  const current = sessionQuestions.find((question) => question.id === visibleOrder[position]);
  const selectedAnswer = current ? answers[current.id] : undefined;
  const isRevealed = current ? Boolean(revealed[current.id]) : false;
  const isCorrect = Boolean(current && selectedAnswer === current.correct);
  const currentSaved = Boolean(current && savedQuestionIds.includes(current.id));

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("paessed-playground-saved-questions") ?? "[]");
      if (Array.isArray(stored)) {
        const validIds = new Set(playgroundQuestions.map((question) => question.id));
        setSavedQuestionIds(stored.filter((id): id is string => typeof id === "string" && validIds.has(id)));
      }
    } catch {
      setSaveError("No se pudieron cargar las preguntas guardadas de este navegador.");
    }
  }, []);

  const toggleSavedQuestion = () => {
    if (!current) return;
    const updated = currentSaved
      ? savedQuestionIds.filter((id) => id !== current.id)
      : [...savedQuestionIds, current.id];
    try {
      localStorage.setItem("paessed-playground-saved-questions", JSON.stringify(updated));
      setSavedQuestionIds(updated);
      setSaveError(null);
    } catch {
      setSaveError("No se pudo guardar la pregunta en este navegador.");
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("paessed-playground-paper-theme");
    if (savedTheme === "auto" || savedTheme === "light" || savedTheme === "dark") setPaperTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) setSettingsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setSettingsOpen(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onEscape, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onEscape, true);
    };
  }, [settingsOpen]);

  const choosePaperTheme = (theme: "auto" | "light" | "dark") => {
    setPaperTheme(theme);
    localStorage.setItem("paessed-playground-paper-theme", theme);
    setSettingsOpen(false);
  };

  // Semantic paper colors are independent from the global interface colors.
  // Automatic mode tracks the PAESSED theme through CSS variables.
  const paperPalette = paperTheme === "dark"
    ? { bg: "#111827", fg: "#f8fafc", muted: "#94a3b8", border: "#334155", soft: "#1e293b", option: "#1a2536", optionHover: "#25344b", selected: "#3b261b", good: "#093d30", bad: "#441e2a", footer: "#151d2c" }
    : paperTheme === "light"
      ? { bg: "#ffffff", fg: "#111827", muted: "#64748b", border: "#e2e8f0", soft: "#f1f5f9", option: "#f8fafc", optionHover: "#fff7ed", selected: "#fff7ed", good: "#ecfdf5", bad: "#fff1f2", footer: "#fcfcfd" }
      : { bg: "var(--surface)", fg: "var(--text)", muted: "var(--muted)", border: "var(--border)", soft: "var(--surface-2)", option: "var(--surface-2)", optionHover: "var(--surface-3)", selected: "var(--primary-soft)", good: "color-mix(in srgb, #10b981 14%, var(--surface))", bad: "color-mix(in srgb, #ef4444 14%, var(--surface))", footer: "var(--surface)" };

  const paperStyle = {
    "--pg-bg": paperPalette.bg,
    "--pg-fg": paperPalette.fg,
    "--pg-muted": paperPalette.muted,
    "--pg-border": paperPalette.border,
    "--pg-soft": paperPalette.soft,
    "--pg-option": paperPalette.option,
    "--pg-option-hover": paperPalette.optionHover,
    "--pg-selected": paperPalette.selected,
    "--pg-good": paperPalette.good,
    "--pg-bad": paperPalette.bad,
    "--pg-footer": paperPalette.footer,
  } as CSSProperties;

  // The whole practice session occupies the viewport; only exceptionally long
  // question content scrolls inside the paper, never behind its fixed footer.
  useEffect(() => {
    if (!isPracticing) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !settingsOpen) setIsPracticing(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [isPracticing, settingsOpen]);

  // Both confirmation buttons revert after 5 seconds without the second click.
  useEffect(() => {
    if (!pendingAction) return;
    const timeoutId = window.setTimeout(() => setPendingAction(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [pendingAction, current?.id, selectedAnswer]);

  useEffect(() => {
    setPendingAction(null);
  }, [current?.id, selectedAnswer]);

  const startPractice = () => {
    if (questions.length === 0) return;
    const randomizedIds = shufflePlaygroundQuestions(questions);
    if (selectedStartQuestion !== "random") {
      const chosenIndex = randomizedIds.indexOf(selectedStartQuestion);
      if (chosenIndex >= 0) {
        randomizedIds.splice(chosenIndex, 1);
        randomizedIds.unshift(selectedStartQuestion);
      }
    }
    setOrder(randomizedIds);
    setPosition(0);
    setAnswers({});
    setRevealed({});
    setPendingAction(null);
    setSettingsOpen(false);
    setSidebarVisible(false);
    window.scrollTo({ top: 0, behavior: "instant" });
    setIsPracticing(true);
  };

  const nextQuestion = () => {
    if (position < visibleOrder.length - 1) {
      setPosition((previous) => previous + 1);
      return;
    }
    // Do not repeat within a round; reshuffle when the matching pool is exhausted.
    const newOrder = shufflePlaygroundQuestions(sessionQuestions);
    if (newOrder.length > 1 && newOrder[0] === current?.id) {
      [newOrder[0], newOrder[1]] = [newOrder[1], newOrder[0]];
    }
    setOrder(newOrder);
    setPosition(0);
    setAnswers({});
    setRevealed({});
  };

  const confirmAction = (action: "check" | "next") => {
    if (pendingAction !== action) {
      setPendingAction(action);
      return;
    }
    setPendingAction(null);
    if (action === "check") {
      if (!current || !selectedAnswer || isRevealed) return;
      setRevealed((previous) => ({ ...previous, [current.id]: true }));
    } else {
      nextQuestion();
    }
  };

  return (
    <AppShell title="Playground" eyebrow="Banco de preguntas" wide immersive={isPracticing} immersiveSidebarOpen={isPracticing && sidebarVisible}>
      <AnimatePresence initial={false} mode="popLayout">
      {!isPracticing ? (
      <motion.div
        key="playground-setup"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16, scale: 0.99 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-[1460px] pb-5"
      >
        <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--primary)]">Banco de preguntas</p>
            <h1 className="text-[34px] font-extrabold leading-tight tracking-[-.04em] sm:text-[42px]">Playground</h1>
            <p className="mt-1.5 max-w-[640px] text-[13px] leading-[1.6] text-[var(--muted)] sm:text-sm">
              Prepara tu práctica de Matemática M1. Elige qué quieres reforzar y comienza.
            </p>
          </div>
        </header>

        <section aria-label="Banco de preguntas disponible" className="mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-4">
          <span className="text-[14px] font-bold text-[var(--text)]">
            <strong className="font-extrabold tabular-nums">{questions.length}</strong> {questions.length === 1 ? "pregunta" : "preguntas"} en total
          </span>
          <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-bold text-[var(--muted)]">M1 · Banco de demostración</span>
          <button
            type="button"
            aria-pressed={savedOnly}
            onClick={() => { setSavedOnly((previous) => !previous); setSelectedStartQuestion("random"); }}
            className={"inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-bold transition-colors " +
              (savedOnly ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-2)]")}
          >
            <Bookmark size={14} fill={savedOnly ? "currentColor" : "none"} aria-hidden="true" />
            Solo guardadas ({savedQuestionIds.length})
          </button>
        </section>

        <section className="surface overflow-hidden rounded-[20px]" aria-labelledby="playground-setup-title">
          <div className="border-b border-[var(--border)] px-5 py-5 sm:px-7">
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--primary)]">Configura tu sesión</p>
            <h2 id="playground-setup-title" className="mt-1.5 text-[22px] font-extrabold tracking-[-.035em] sm:text-[25px]">Practica a tu manera</h2>
            <p className="mt-1 text-[13px] leading-6 text-[var(--muted)]">
              Las preguntas se mezclan automáticamente. Puedes limitar los temas, practicar solo las guardadas o elegir por dónde comenzar.
            </p>
          </div>

          <motion.div layoutId="playground-config" transition={{ type: "spring", stiffness: 280, damping: 35 }} className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-3 lg:py-7">
            <div className="min-w-0">
              <label htmlFor="playground-start-year" className="mb-2 block text-[12px] font-bold text-[var(--text)]">Año</label>
              <select
                id="playground-start-year"
                value={year}
                onChange={(event) => { setYear(event.target.value); setSelectedStartQuestion("random"); }}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-semibold text-[var(--text)] outline-offset-2 focus:border-[var(--primary)]"
              >
                <option value="all">Todos los años</option>
                {[...new Set(playgroundQuestions.map((question) => question.year))].sort((a, b) => b - a).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="playground-start-axis" className="mb-2 block text-[12px] font-bold text-[var(--text)]">Eje temático</label>
              <select
                id="playground-start-axis"
                value={axis}
                onChange={(event) => { setAxis(event.target.value); setSelectedStartQuestion("random"); }}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-semibold text-[var(--text)] outline-offset-2 focus:border-[var(--primary)]"
              >
                <option value="all">Todos los ejes</option>
                {axes.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="playground-start-question" className="mb-2 block text-[12px] font-bold text-[var(--text)]">Primera pregunta</label>
              <select
                id="playground-start-question"
                value={selectedStartQuestion}
                onChange={(event) => setSelectedStartQuestion(event.target.value)}
                disabled={!questions.length}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-semibold text-[var(--text)] outline-offset-2 focus:border-[var(--primary)] disabled:opacity-50"
              >
                <option value="random">Aleatoria</option>
                {questions.map((question) => (
                  <option key={question.id} value={question.id}>N.º {question.number} · {question.year} · {question.topic}</option>
                ))}
              </select>
            </div>
          </motion.div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-4 sm:px-7">
            <p className="text-[12px] leading-5 text-[var(--muted)]">
              {questions.length === 0
                ? "No hay preguntas con estos filtros."
                : questions.length + (questions.length === 1 ? " pregunta disponible" : " preguntas disponibles") + " · Una pregunta por pantalla"}
            </p>
            <button
              type="button"
              onClick={startPractice}
              disabled={!questions.length}
              className="tactile-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold disabled:cursor-not-allowed disabled:opacity-45"
            >
              Comenzar práctica <ArrowRight size={17} />
            </button>
          </div>
        </section>
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
          Las preguntas guardadas quedan en este navegador. Prototipo con cuatro preguntas originales de ejemplo, no extraídas de pruebas oficiales del DEMRE. Los años son referenciales.
        </p>
      </motion.div>
      ) : (
        <motion.div
          key="playground-practice"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--canvas)] text-[var(--text)]"
          aria-label="Modo práctica de Playground"
        >
          <motion.header
            layout
            className="relative z-20 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]"
            transition={{ duration: 0.25 }}
          >
            <div className="mx-auto flex min-h-[58px] w-full max-w-[1460px] items-center gap-2 px-3 sm:gap-4 sm:px-6">
              <button
                type="button"
                onClick={() => { setPendingAction(null); setSettingsOpen(false); setIsPracticing(false); }}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12px] font-bold text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                <ChevronLeft size={18} /> <span className="hidden sm:inline">Volver a configuración</span><span className="sm:hidden">Volver</span>
              </button>
              <button
                type="button"
                onClick={() => setSidebarVisible((previous) => !previous)}
                aria-label={sidebarVisible ? "Ocultar barra lateral" : "Mostrar barra lateral"}
                aria-pressed={sidebarVisible}
                title={sidebarVisible ? "Ocultar sidebar" : "Mostrar sidebar"}
                className={"hidden min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[12px] font-bold transition-colors lg:inline-flex " +
                  (sidebarVisible ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]")}
              >
                {sidebarVisible ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
                <span className="hidden xl:inline">Sidebar</span>
              </button>

              <motion.div
                layoutId="playground-config"
                transition={{ type: "spring", stiffness: 280, damping: 35 }}
                className="min-w-0 flex-1 rounded-lg px-2 py-1.5 sm:px-3"
              >
                <p className="truncate text-center text-[12px] font-extrabold">Matemática M1</p>
                <p className="truncate text-center text-[10px] font-medium text-[var(--muted)]">
                  {year === "all" ? "Todos los años" : year} · {axis === "all" ? "Todos los ejes" : axis}
                </p>
              </motion.div>

              <button
                type="button"
                onClick={toggleSavedQuestion}
                disabled={!current}
                aria-label={currentSaved ? "Quitar pregunta de guardadas" : "Guardar esta pregunta"}
                aria-pressed={currentSaved}
                title={currentSaved ? "Pregunta guardada · Quitar" : "Guardar pregunta"}
                className={"grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors disabled:opacity-40 " +
                  (currentSaved ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]")}
              >
                <Bookmark size={19} fill={currentSaved ? "currentColor" : "none"} aria-hidden="true" />
              </button>
                            <div className="relative shrink-0" ref={settingsRef}>
                <button
                  type="button"
                  aria-label="Ajustes de apariencia del ensayo"
                  aria-expanded={settingsOpen}
                  aria-controls="playground-paper-settings"
                  onClick={() => setSettingsOpen((previous) => !previous)}
                  className={"grid h-10 w-10 place-items-center rounded-xl border transition-colors " +
                    (settingsOpen ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]")}
                >
                  <Settings size={19} aria-hidden="true" />
                </button>

                <AnimatePresence>
                  {settingsOpen && (
                    <motion.section
                      id="playground-paper-settings"
                      role="group"
                      aria-label="Tema del ensayo"
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      className="surface-raised absolute right-0 top-[calc(100%+10px)] z-50 w-[min(320px,calc(100vw-24px))] rounded-2xl p-4 shadow-xl"
                    >
                      <h2 className="text-[14px] font-extrabold">Apariencia del ensayo</h2>
                      <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">Cambia solo la hoja de preguntas. La interfaz mantiene su tema.</p>
                      <div className="mt-3 space-y-2">
                        {([
                          { value: "auto", label: "Según PAESSED", description: "Sigue el tema de la interfaz" },
                          { value: "light", label: "Hoja clara", description: "Blanco, incluso con interfaz oscura" },
                          { value: "dark", label: "Hoja oscura", description: "Oscuro, incluso con interfaz clara" },
                        ] as const).map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            aria-pressed={paperTheme === item.value}
                            onClick={() => choosePaperTheme(item.value)}
                            className={"flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors " +
                              (paperTheme === item.value ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:bg-[var(--surface-2)]")}
                          >
                            <span>
                              <span className="block text-[12px] font-bold text-[var(--text)]">{item.label}</span>
                              <span className="block text-[10px] leading-4 text-[var(--muted)]">{item.description}</span>
                            </span>
                            {paperTheme === item.value && <Check size={16} className="shrink-0 text-[var(--primary)]" aria-hidden="true" />}
                          </button>
                        ))}
                      </div>
                    </motion.section>
                  )}
                </AnimatePresence>
              </div>
            </div>
            {saveError && <p role="alert" className="px-4 pb-2 text-right text-[11px] text-rose-500">{saveError}</p>}
          </motion.header>

          <main className="mx-auto flex min-h-0 w-full max-w-[1460px] flex-1 flex-col p-2 sm:p-4" aria-label="Pregunta de práctica">
            {current ? (
              <motion.article layout style={paperStyle} transition={{ duration: 0.25 }} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-[var(--pg-border)] bg-[var(--pg-bg)] text-[var(--pg-fg)]">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--pg-border)] px-4 py-2 sm:px-7 sm:py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[var(--pg-soft)] px-2 py-1 text-[11px] font-bold text-[var(--pg-fg)]">N.º {current.number}</span>
                    <span className="rounded-md bg-[var(--pg-soft)] px-2 py-1 text-[11px] font-bold text-[var(--pg-fg)]">{current.year}</span>
                    <span className="hidden rounded-md border border-[var(--pg-border)] px-2 py-1 text-[11px] font-medium text-[var(--pg-muted)] sm:inline">{current.collection}</span>
                  </div>
                  <span className="truncate text-right text-[11px] font-medium text-[var(--pg-muted)]">{current.axis} · {current.topic}</span>
                </div>

                <div key={current.id} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-9 sm:py-5 lg:px-12">
                  <h2 style={playgroundQuestionFont} className="max-w-[1060px] whitespace-pre-line text-[18px] font-normal leading-[1.55] text-[var(--pg-fg)] sm:text-[21px]">
                    {current.stem}
                  </h2>

                  <div role="group" aria-label="Alternativas de respuesta" className="mt-4 flex max-w-[1060px] flex-col items-start gap-2 sm:mt-5">
                    {current.options.map((option, index) => {
                      const letter = playgroundAnswerLetters[index];
                      const selected = selectedAnswer === letter;
                      const correct = isRevealed && current.correct === letter;
                      const wrong = isRevealed && selected && !correct;
                      const tone = correct
                        ? "border-emerald-500 bg-[var(--pg-good)]"
                        : wrong
                          ? "border-rose-500 bg-[var(--pg-bad)]"
                          : selected
                            ? "border-[var(--primary)] bg-[var(--pg-selected)] ring-1 ring-[var(--primary)]"
                            : "border-[var(--pg-border)] bg-[var(--pg-option)] hover:border-[var(--primary)] hover:bg-[var(--pg-option-hover)] hover:shadow-sm";
                      return (
                        <button
                          key={letter}
                          type="button"
                          aria-pressed={selected}
                          disabled={isRevealed}
                          onClick={() => setAnswers((previous) => ({ ...previous, [current.id]: letter }))}
                          className={"inline-flex min-h-[43px] w-fit max-w-full min-w-[112px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-1.5 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-default sm:min-h-[47px] sm:px-4 sm:py-2 " + tone}
                        >
                          <span style={playgroundQuestionFont} className="shrink-0 text-[16px] font-semibold leading-7 text-[var(--pg-fg)] sm:text-[18px]">{letter})</span>
                          <span style={playgroundQuestionFont} className="min-w-0 break-words pt-px text-[16px] leading-7 text-[var(--pg-fg)] sm:text-[18px]">{option}</span>
                          {correct && <Check size={17} aria-label="Alternativa correcta" className="ml-auto mt-1 shrink-0 text-emerald-600" />}
                        </button>
                      );
                    })}
                  </div>

                  {isRevealed && (
                    <div role="status" className={"mt-4 max-w-[1060px] rounded-lg border px-4 py-3 text-[12px] leading-5 text-[var(--pg-fg)] sm:text-[13px] " + (isCorrect
                      ? "border-emerald-500/50 bg-[var(--pg-good)]"
                      : "border-rose-500/50 bg-[var(--pg-bad)]")}>
                      <p className="font-extrabold">{isCorrect ? "¡Respuesta correcta!" : "La respuesta correcta es " + current.correct + ")"}</p>
                      <p className="mt-1">{current.explanation}</p>
                    </div>
                  )}
                </div>

                <footer className="shrink-0 border-t border-[var(--pg-border)] bg-[var(--pg-footer)] px-3 py-2.5 sm:px-7 sm:py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => { setPendingAction(null); setPosition((previous) => Math.max(0, previous - 1)); }}
                      disabled={position === 0}
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--pg-border)] bg-[var(--pg-option)] px-3 text-[11px] font-bold text-[var(--pg-fg)] transition-colors hover:bg-[var(--pg-option-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft size={16} /> Anterior
                    </button>
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                      {!isRevealed ? (
                        <button
                          type="button"
                          onClick={() => confirmAction("check")}
                          disabled={!selectedAnswer}
                          aria-label={pendingAction === "check" ? "Confirmar respuesta" : "Comprobar respuesta"}
                          className="tactile-primary min-h-10 rounded-lg px-4 text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {pendingAction === "check" ? "Confirmar" : "Comprobar"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setPendingAction(null); setRevealed((previous) => ({ ...previous, [current.id]: false })); }}
                          className="min-h-10 rounded-lg border border-[var(--pg-border)] bg-[var(--pg-option)] px-4 text-[11px] font-bold text-[var(--pg-fg)] hover:bg-[var(--pg-option-hover)]"
                        >
                          Reintentar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => confirmAction("next")}
                        disabled={sessionQuestions.length <= 1}
                        aria-label={pendingAction === "next" ? "Confirmar nueva pregunta" : "Otra pregunta"}
                        className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--pg-border)] bg-[var(--pg-option)] px-3 text-[11px] font-bold text-[var(--pg-fg)] hover:bg-[var(--pg-option-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {pendingAction === "next" ? "Confirmar" : "Otra pregunta"} <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                  {pendingAction && (
                    <p role="status" className="mt-1.5 text-right text-[10px] font-medium text-[var(--pg-muted)]">
                      {pendingAction === "check" ? "Confirma para revisar." : "Confirma para cambiar de pregunta."} Se cancela en 5 segundos.
                    </p>
                  )}
                </footer>
              </motion.article>
            ) : (
              <section className="flex flex-1 items-center justify-center rounded-xl border border-[#d9dde5] bg-white p-5 text-center text-sm text-[#64748b]">
                Preparando tu práctica…
              </section>
            )}
          </main>
        </motion.div>
      )}
      </AnimatePresence>
    </AppShell>
  );
}

export function ProfileExperience() {
  return (
    <AppShell title="Perfil" eyebrow="Tu cuenta">
      <section className="mb-6">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-[22px] bg-[var(--secondary)] text-xl font-extrabold text-white">S</div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-[-.03em]">Seba</h1>
            <div className="mt-1 text-sm text-[var(--muted)]">Preparando PAES M1 · Meta 780 pts</div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div className="surface rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-extrabold"><Target size={18} className="text-[var(--primary)]" />Objetivos</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[var(--surface-2)] p-4">
                <div className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">Meta PAES</div>
                <div className="mt-2 text-3xl font-extrabold">780</div>
              </div>
              <div className="rounded-2xl bg-[var(--surface-2)] p-4">
                <div className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">Objetivo diario</div>
                <div className="mt-2 text-3xl font-extrabold">5</div>
              </div>
            </div>
          </div>

          <div className="surface rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-extrabold"><Settings size={18} className="text-[var(--muted)]" />Preferencias</div>
            <div className="mt-5 divide-y divide-[var(--border)]">
              {[
                ["Recordatorio de práctica", "19:00"],
                ["Semana de estudio", "Lun · Mar · Mié · Jue · Vie"],
                ["Modo de práctica", "Adaptativo"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="text-xs font-bold">{label}</div>
                  <div className="text-xs font-extrabold text-[var(--muted)]">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="surface-raised rounded-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold"><Trophy size={18} className="text-amber-500" />Resumen</div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[var(--surface-2)] p-4"><div className="text-2xl font-extrabold">12</div><div className="mt-1 text-[10px] font-bold text-[var(--muted)]">días de racha</div></div>
              <div className="rounded-2xl bg-[var(--surface-2)] p-4"><div className="text-2xl font-extrabold">1.240</div><div className="mt-1 text-[10px] font-bold text-[var(--muted)]">XP total</div></div>
              <div className="rounded-2xl bg-[var(--surface-2)] p-4"><div className="text-2xl font-extrabold">8</div><div className="mt-1 text-[10px] font-bold text-[var(--muted)]">ensayos</div></div>
              <div className="rounded-2xl bg-[var(--surface-2)] p-4"><div className="text-2xl font-extrabold">742</div><div className="mt-1 text-[10px] font-bold text-[var(--muted)]">mejor puntaje</div></div>
            </div>
          </div>

          <div className="surface rounded-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold"><UserRound size={18} className="text-[var(--secondary)]" />Cuenta</div>
            <div className="mt-4 text-xs leading-5 text-[var(--muted)]">La autenticación real y sincronización con backend se conectarán en la siguiente etapa.</div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
