"use client";

import { PageHeadingTransition } from "@/components/app-page-transition";
import { AppShell } from "@/components/app-shell";
import { AiHelpSettings,AskAiButton,useAiSettings } from "@/components/ask-ai";
import { ExternalQuestionWorkspace } from "@/components/learning/workspace/external-question-workspace";
import { QuestionDialog } from "@/components/learning/workspace/question-dialog";
import { PlaygroundAdvancedPicker } from "@/components/playground-advanced-picker";
import { type PlaygroundInkStroke } from "@/components/playground-scratchpad";
import { ALL_M1_UNIT_IDS,PlaygroundTopicPicker } from "@/components/playground-topic-picker";
import { useImportedResourceUrls } from "@/components/use-imported-resource-urls";
import { DEFAULT_EXAMS } from "@/lib/default-exams";
import { blockAssetIds } from "@/lib/imported-resources";
import { DEFAULT_QUESTION_INDEX,defaultBankPlaceholders,loadQuestionContent } from "@/lib/learning/catalog";
import { recordEvidence } from "@/lib/learning/evidence";
import type { ImportedExamRecord } from "@/lib/local-imports";
import { ImportedExamSummary,listImportedExams } from "@/lib/local-imports";
import { type M1UnitId } from "@/lib/m1-curriculum";
import { loadPlaygroundImports,type BankQuestion,type BankSource } from "@/lib/playground-imports";
import {
ArrowRight,
Bookmark,
ChevronLeft,
ChevronRight,
Play,
Search,
Settings,
SlidersHorizontal,
Upload
} from "lucide-react";
import { AnimatePresence,motion } from "motion/react";
import Link from "next/link";
import { useEffect,useRef,useState } from "react";

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

type PlaygroundQuestion = BankQuestion;

/** Original examples for the UI prototype: not official DEMRE questions. */
const playgroundQuestions: PlaygroundQuestion[] = [
  {
    id: "m1-2026-01", number: 1, year: 2026,
    collection: "Ensayo de práctica", sourceId: "demo", axis: "Números", topic: "Conjunto de los números enteros y racionales", unitId: "numeros-enteros-racionales",
    stem: "¿Cuál es el valor de 2,32 + 17,4?",
    options: ["19,72", "19,44", "19,36", "18,72", "19,06"],
    correct: "A",
    explanation: "Alineamos las comas decimales: 2,32 + 17,40 = 19,72.",
  },
  {
    id: "m1-2026-02", number: 2, year: 2026,
    collection: "Ensayo de práctica", sourceId: "demo", axis: "Álgebra y funciones", topic: "Proporcionalidad", unitId: "proporcionalidad",
    stem: "La distancia de reacción de un vehículo es directamente proporcional a su velocidad. Si a 110 km/h recorre 33 m, ¿cuántos metros recorre a 30 km/h?",
    options: ["3 m", "6 m", "9 m", "10 m", "11 m"],
    correct: "C",
    explanation: "La razón es 33 ÷ 110 = 0,3. A 30 km/h recorre 30 × 0,3 = 9 metros.",
  },
  {
    id: "m1-2025-03", number: 3, year: 2025,
    collection: "Ensayo de práctica", sourceId: "demo", axis: "Geometría", topic: "Semejanza y proporcionalidad de figuras", unitId: "semejanza-proporcionalidad-figuras",
    stem: "Dos triángulos son semejantes. El lado de 4 cm del primero corresponde a uno de 10 cm del segundo. ¿Cuánto mide en el segundo triángulo el lado que corresponde a uno de 6 cm del primero?",
    options: ["10 cm", "12 cm", "14 cm", "15 cm", "18 cm"],
    correct: "D",
    explanation: "La razón de semejanza es 10 ÷ 4 = 2,5. Por lo tanto, 6 × 2,5 = 15 cm.",
  },
  {
    id: "m1-2025-04", number: 4, year: 2025,
    collection: "Ensayo de práctica", sourceId: "demo", axis: "Números", topic: "Porcentaje", unitId: "porcentaje",
    stem: "De un grupo de 50 estudiantes, 18 prefieren estudiar por la mañana. ¿Qué porcentaje del grupo representan esos estudiantes?",
    options: ["18 %", "25 %", "32 %", "36 %", "50 %"],
    correct: "D",
    explanation: "18 de 50 equivale a 18 ÷ 50 = 0,36, es decir, 36 %.",
  },

];

type TopicFilters = { year: string; unitIds: M1UnitId[]; questionIds: string[]; savedOnly: boolean };
type QueuedTopicFilters = TopicFilters & { question: string };

function filterPlaygroundQuestions(filters: TopicFilters, savedIds: readonly string[], bank: readonly PlaygroundQuestion[]) {
  const selectedUnits = new Set(filters.unitIds);
  const chosenQuestions = new Set(filters.questionIds);
  return bank.filter((question) =>
    chosenQuestions.has(question.id) &&
    (filters.year === "all" || String(question.year) === filters.year) &&
    (question.unitId ? selectedUnits.has(question.unitId) : selectedUnits.size === ALL_M1_UNIT_IDS.length) &&
    (!filters.savedOnly || savedIds.includes(question.id))
  );
}

function playgroundUnitCounts(year: string, savedOnly: boolean, savedIds: readonly string[], bank: readonly PlaygroundQuestion[], chosenIds: readonly string[]) {
  const counts: Partial<Record<M1UnitId, number>> = {};
  const chosen = new Set(chosenIds);
  for (const question of bank) {
    if (!chosen.has(question.id)) continue;
    if (year !== "all" && String(question.year) !== year) continue;
    if (savedOnly && !savedIds.includes(question.id)) continue;
    if (!question.unitId) continue;
    counts[question.unitId] = (counts[question.unitId] ?? 0) + 1;
  }
  return counts;
}


function shufflePlaygroundQuestions(questions: PlaygroundQuestion[]): string[] {
  const ids = questions.map((question) => question.id);
  for (let index = ids.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[randomIndex]] = [ids[randomIndex], ids[index]];
  }
  return ids;
}


export function PlaygroundExperience() {
  const [defaultQuestions, setDefaultQuestions] = useState<BankQuestion[]>(defaultBankPlaceholders);
  const [defaultRecords, setDefaultRecords] = useState<Record<string, ImportedExamRecord>>({});
  const evidenceSession = useRef("");
  const [year, setYear] = useState("all");
  const [selectedUnitIds, setSelectedUnitIds] = useState<M1UnitId[]>(() => [...ALL_M1_UNIT_IDS]);
  const [importedQuestions, setImportedQuestions] = useState<PlaygroundQuestion[]>([]);
  const [importedSources, setImportedSources] = useState<BankSource[]>([]);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [importedRecords, setImportedRecords] = useState<Record<string, ImportedExamRecord>>({});
  const [chosenQuestionIds, setChosenQuestionIds] = useState<string[]>(() => [...defaultBankPlaceholders(), ...playgroundQuestions].map((question) => question.id));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [draftAdvancedOpen, setDraftAdvancedOpen] = useState(false);
  const [selectedStartQuestion, setSelectedStartQuestion] = useState("random");
  const [savedOnly, setSavedOnly] = useState(false);
  const [sessionFilters, setSessionFilters] = useState<TopicFilters>({ year: "all", unitIds: [...ALL_M1_UNIT_IDS], questionIds: playgroundQuestions.map((question)=>question.id), savedOnly: false });
  const [queuedFilters, setQueuedFilters] = useState<QueuedTopicFilters | null>(null);
  const [filterDecisionOpen, setFilterDecisionOpen] = useState(false);
  const [filterNotice, setFilterNotice] = useState<string | null>(null);
  const [savedQuestionIds, setSavedQuestionIds] = useState<string[]>([]);
  const [recentQuestionIds, setRecentQuestionIds] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [isPracticing, setIsPracticing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [strokesByQuestion, setStrokesByQuestion] = useState<Record<string, PlaygroundInkStroke[]>>({});
  const [draftYear, setDraftYear] = useState("all");
  const [draftUnitIds, setDraftUnitIds] = useState<M1UnitId[]>(() => [...ALL_M1_UNIT_IDS]);
  const [draftQuestionIds, setDraftQuestionIds] = useState<string[]>(() => playgroundQuestions.map((question)=>question.id));
  const [draftSavedOnly, setDraftSavedOnly] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState("random");
  const { aiSettings, updateAiSettings } = useAiSettings();
  const settingsRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [position, setPosition] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [pendingAction, setPendingAction] = useState<"check" | null>(null);
  const [sheetReady, setSheetReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);

  const questionBank = [...defaultQuestions, ...playgroundQuestions, ...importedQuestions].filter((q,i,all)=>all.findIndex(other=>other.id===q.id)===i);
  const sources: BankSource[] = [
    ...DEFAULT_EXAMS.map(e => ({id:"default:"+e.id,name:e.title,count:e.questionCount,imported:false})),
    { id: "demo", name: "Preguntas de demostración", count: playgroundQuestions.length, imported: false },
    ...importedSources,
  ];
  const questions = filterPlaygroundQuestions({ year, unitIds: selectedUnitIds, questionIds: chosenQuestionIds, savedOnly }, savedQuestionIds, questionBank);
  const topicCounts = playgroundUnitCounts(year, savedOnly, savedQuestionIds, questionBank, chosenQuestionIds);
  // Keep active practice questions stable if a filter or bookmark changes.
  const sessionQuestions = isPracticing
    ? questionBank.filter((question) => order.includes(question.id))
    : questions;
  const visibleOrder = order.filter((id) => sessionQuestions.some((question) => question.id === id));
  const current = sessionQuestions.find((question) => question.id === visibleOrder[position]);
  const selectedAnswer = current ? answers[current.id] : undefined;
  const isRevealed = current ? Boolean(revealed[current.id]) : false;
  const isCorrect = Boolean(current && selectedAnswer === current.correct);
  const currentStrokes = current ? strokesByQuestion[current.id] ?? [] : [];
  const draftQuestions = filterPlaygroundQuestions({ year: draftYear, unitIds: draftUnitIds, questionIds: draftQuestionIds, savedOnly: draftSavedOnly }, savedQuestionIds, questionBank);
  const draftTopicCounts = playgroundUnitCounts(draftYear, draftSavedOnly, savedQuestionIds, questionBank, draftQuestionIds);
  // Imported packages are only read locally, without fabricating topic labels.
  useEffect(() => {
    let mounted = true;
    void loadPlaygroundImports().then((result) => {
      if (!mounted) return;
      setImportedRecords(result.records);
      setImportedSources(result.sources);
      setImportedQuestions(result.questions);
      setChosenQuestionIds((old) => [...new Set([...old, ...result.questions.map((q) => q.id)])]);
      setSourceError(null);
    }).catch(() => {
      if (mounted) setSourceError("No fue posible cargar la biblioteca de ensayos de este navegador.");
    }).finally(() => { if (mounted) setSourceLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!isPracticing || !current) return;
    const meta = DEFAULT_QUESTION_INDEX.find(q=>q.id===current.id);
    if (!meta) return;
    let active = true;
    if (!evidenceSession.current) evidenceSession.current = crypto.randomUUID();
    void recordEvidence({type:"expose",questionId:meta.id,mode:"playground",sessionId:evidenceSession.current}).catch(e=>setSaveError(e.message));
    void loadQuestionContent(meta).then(({question,record})=>{
      if (!active) return;
      setDefaultQuestions(old=>old.map(q=>q.id===question.id?question:q));
      setDefaultRecords(old=>({...old,[question.sourceId]:record}));
    }).catch(e=>{if(active)setSaveError(e.message);});
    return ()=>{active=false;};
  }, [isPracticing,current?.id]);
  const sourceRecord = isPracticing && current ? defaultRecords[current.sourceId] ?? importedRecords[current.sourceId] ?? null : null;
  const { resourceUrls, resourceIssues, resourceError, resourcesLoading } = useImportedResourceUrls(sourceRecord);
  const questionAssets = (current?.assetPaths ?? []).flatMap(path => {
    const url = resourceUrls.byPath.get(path); return url ? [{ path, url }] : [];
  });
  const resourceIds = [...blockAssetIds(current?.stemBlocks), ...(current?.optionBlocks ?? []).flatMap(blocks => blockAssetIds(blocks)),
    ...blockAssetIds(current?.explanationBlocks), ...(current?.assetPaths ?? [])];
  const currentResourceErrors = [...new Set(resourceIds.flatMap(id => {
    const error = resourceIssues.get(id); return error ? [error] : [];
  }))];
  const displayedResourceError = resourceError || currentResourceErrors[0];


  const updateCurrentStrokes = (next: PlaygroundInkStroke[]) => {
    if (!current) return;
    setStrokesByQuestion((previous) => ({ ...previous, [current.id]: next }));
  };
  const openPracticeSettings = () => {
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    setDraftYear(queuedFilters?.year ?? sessionFilters.year);
    setDraftUnitIds([...(queuedFilters?.unitIds ?? sessionFilters.unitIds)]);
    setDraftQuestionIds([...(queuedFilters?.questionIds ?? sessionFilters.questionIds)]);
    setDraftAdvancedOpen(false);
    setDraftSavedOnly(queuedFilters?.savedOnly ?? sessionFilters.savedOnly);
    setDraftQuestion(queuedFilters?.question ?? "random");
    setFilterDecisionOpen(false);
    setSettingsOpen(true);
  };
  const commitPracticeFilters = (
    filters: QueuedTopicFilters,
    matching: PlaygroundQuestion[],
    avoidId?: string
  ) => {
    if (!matching.length) return;
    const shuffled = shufflePlaygroundQuestions(matching);
    const chosenIndex = filters.question === "random" ? -1 : shuffled.indexOf(filters.question);
    if (chosenIndex > 0) {
      shuffled.splice(chosenIndex, 1);
      shuffled.unshift(filters.question);
    } else if (chosenIndex < 0 && shuffled.length > 1 && shuffled[0] === avoidId) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
    setYear(filters.year);
    setSelectedUnitIds([...filters.unitIds]);
    setChosenQuestionIds([...filters.questionIds]);
    setSavedOnly(filters.savedOnly);
    setSessionFilters({ year: filters.year, unitIds: [...filters.unitIds], questionIds: [...filters.questionIds], savedOnly: filters.savedOnly });
    setSelectedStartQuestion(filters.question);
    setOrder(shuffled);
    setPosition(0);
    setAnswers({});
    setRevealed({});
    setPendingAction(null);
    setQueuedFilters(null);
    setFilterDecisionOpen(false);
    setFilterNotice(null);
    setSettingsOpen(false);
  };

  const applyPracticeFilters = (timing: "now" | "next") => {
    if (!draftQuestions.length) return;
    const filters: QueuedTopicFilters = { year: draftYear, unitIds: [...draftUnitIds], questionIds: [...draftQuestionIds], savedOnly: draftSavedOnly, question: draftQuestion };
    if (timing === "now") {
      commitPracticeFilters(filters, draftQuestions, current?.id);
    } else {
      setQueuedFilters(filters);
      setFilterDecisionOpen(false);
      setFilterNotice(null);
      setSettingsOpen(false);
    }
  };

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("paessed-playground-recent-questions") ?? "[]");
      if (!Array.isArray(stored)) return;
      const validIds = new Set([...playgroundQuestions, ...importedQuestions].map((question) => question.id));
      const unique = Array.from(new Set(stored.filter((id): id is string => typeof id === "string" && validIds.has(id))));
      setRecentQuestionIds(unique.slice(0, 5));
    } catch {
      // Browser storage can be disabled; the practice itself still works.
    }
  }, [importedQuestions]);

  // Record actual opened questions, not just the first question of each session.
  useEffect(() => {
    if (!isPracticing || !current?.id) return;
    setRecentQuestionIds((previous) => {
      const updated = [current.id, ...previous.filter((id) => id !== current.id)].slice(0, 5);
      if (previous.length === updated.length && previous.every((id, index) => id === updated[index])) {
        return previous;
      }
      try {
        localStorage.setItem("paessed-playground-recent-questions", JSON.stringify(updated));
      } catch {
        // History remains available in memory if browser storage is unavailable.
      }
      return updated;
    });
  }, [isPracticing, current?.id]);

  useEffect(() => {
    const syncSaved = () => {
      try {
        const stored: unknown = JSON.parse(localStorage.getItem("paessed-playground-saved-questions") ?? "[]");
        const validIds = new Set([...defaultBankPlaceholders(), ...playgroundQuestions, ...importedQuestions].map(question => question.id));
        setSavedQuestionIds(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string" && validIds.has(id)) : []);
      } catch { setSaveError("No se pudieron cargar las preguntas guardadas de este navegador."); }
    };
    const onStorage = (event: StorageEvent) => { if (event.key === "paessed-playground-saved-questions" || event.key === null) syncSaved(); };
    syncSaved();
    window.addEventListener("paessed-saved-questions-change", syncSaved);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("paessed-saved-questions-change", syncSaved); window.removeEventListener("storage", onStorage); };
  }, [importedQuestions]);

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

  // The whole practice session occupies the viewport; only exceptionally long
  // question content scrolls inside the paper, never behind its fixed footer.
  useEffect(() => {
    if (!isPracticing) return;
    const priorOverflow = document.body.style.overflow;
    const priorScrollbarGutter = document.documentElement.style.scrollbarGutter;
    document.body.style.overflow = "hidden";
    // Full-screen practice should not retain the dark scrollbar gutter from the app shell.
    document.documentElement.style.scrollbarGutter = "auto";
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !settingsOpen && !document.querySelector("dialog[open]")) setIsPracticing(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.documentElement.style.scrollbarGutter = priorScrollbarGutter;
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

  const beginSession = (pool: PlaygroundQuestion[], firstId: string, filters: TopicFilters = { year, unitIds: selectedUnitIds, questionIds: chosenQuestionIds, savedOnly }) => {
    evidenceSession.current = crypto.randomUUID();
    setSessionFilters({ year: filters.year, unitIds: [...filters.unitIds], questionIds: [...filters.questionIds], savedOnly: filters.savedOnly });
    if (!pool.length) return;
    const randomizedIds = shufflePlaygroundQuestions(pool);
    const chosenIndex = randomizedIds.indexOf(firstId);
    if (chosenIndex > 0) {
      randomizedIds.splice(chosenIndex, 1);
      randomizedIds.unshift(firstId);
    }
    setOrder(randomizedIds);
    setPosition(0);
    setAnswers({});
    setRevealed({});
    setPendingAction(null);
    setQueuedFilters(null);
    setFilterDecisionOpen(false);
    setFilterNotice(null);
    setSettingsOpen(false);
    setSidebarVisible(false);
    window.scrollTo({ top: 0, behavior: "instant" });
    setIsPracticing(true);
  };

  const startPractice = () => beginSession(questions, selectedStartQuestion);

  const revisitQuestion = (questionId: string) => {
    // A history entry must always be reachable, even if the current filters exclude it.
    setYear("all");
    setSelectedUnitIds([...ALL_M1_UNIT_IDS]);
    setChosenQuestionIds(questionBank.map((question)=>question.id));
    setSavedOnly(false);
    setSelectedStartQuestion(questionId);
    beginSession(questionBank, questionId, { year: "all", unitIds: [...ALL_M1_UNIT_IDS], questionIds: questionBank.map((question)=>question.id), savedOnly: false });
  };

  // Advance deliberately only after checking an answer. Deferred filters take
  // effect here, never while the student is working on the current question.
  const advanceQuestion = () => {
    if (!isRevealed) return;
    if (queuedFilters) {
      const matching = filterPlaygroundQuestions(queuedFilters, savedQuestionIds, questionBank);
      if (matching.length > 0) {
        commitPracticeFilters(queuedFilters, matching, current?.id);
        return;
      }
      setQueuedFilters(null);
      setFilterNotice("Los filtros pendientes ya no tienen preguntas disponibles. Continuarás con la selección anterior.");
    }
    setPendingAction(null);
    if (position < visibleOrder.length - 1) {
      setPosition((previous) => previous + 1);
      return;
    }
    const nextOrder = shufflePlaygroundQuestions(sessionQuestions);
    if (nextOrder.length > 1 && nextOrder[0] === current?.id) {
      [nextOrder[0], nextOrder[1]] = [nextOrder[1], nextOrder[0]];
    }
    setOrder(nextOrder);
    setPosition(0);
    setAnswers({});
    setRevealed({});
  };

  const confirmAnswer = async () => {
    if (!current || !selectedAnswer || isRevealed || !sheetReady || checkingRef.current) return;
    if (pendingAction !== "check") {
      setPendingAction("check");
      return;
    }
    setPendingAction(null);
    checkingRef.current = true; setChecking(true);
    try {
      await recordEvidence({type:"external-attempt",questionId:current.id,answer:selectedAnswer,mode:"playground",sessionId:evidenceSession.current});
      setSaveError(null);
    } catch (e) { setSaveError(e instanceof Error?e.message:"No se pudo guardar la respuesta.");return; }
    finally { checkingRef.current = false; setChecking(false); }
    setRevealed((previous) => ({ ...previous, [current.id]: true }));
  };

  return (
    <AppShell title="Playground" eyebrow="Banco de preguntas" wide immersive={isPracticing} immersiveSidebarOpen={isPracticing && sidebarVisible} onImmersiveSidebarToggle={() => setSidebarVisible((previous) => !previous)}>
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
            <PageHeadingTransition>
              <h1 className="text-[34px] font-extrabold leading-tight tracking-[-.04em] sm:text-[42px]">Playground</h1>
            </PageHeadingTransition>
            <p className="mt-1.5 max-w-[640px] text-[13px] leading-[1.6] text-[var(--muted)] sm:text-sm">
              Prepara tu práctica de Matemática M1. Elige qué quieres reforzar y comienza.
            </p>
          </div>
        </header>

        
        <div>
        <section aria-label="Banco de preguntas disponible" className="mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-4">
          <span className="text-[14px] font-bold text-[var(--text)]">
            <strong className="font-extrabold tabular-nums">{questions.length}</strong> {questions.length === 1 ? "pregunta" : "preguntas"} en total
          </span>
          <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-bold text-[var(--muted)]">M1 · Demostración y ensayos importados</span>
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

          <motion.div layoutId="playground-config" transition={{ type: "spring", stiffness: 280, damping: 35 }} className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-7 lg:py-7">
            <div className="min-w-0">
              <label htmlFor="playground-start-year" className="mb-2 block text-[12px] font-bold text-[var(--text)]">Año</label>
              <select
                id="playground-start-year"
                value={year}
                onChange={(event) => { setYear(event.target.value); setSelectedStartQuestion("random"); }}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-semibold text-[var(--text)] outline-offset-2 focus:border-[var(--primary)]"
              >
                <option value="all">Todos los años</option>
                {[...new Set(questionBank.map((question) => question.year).filter((value): value is number => value !== null))].sort((a, b) => b - a).map((value) => <option key={value} value={value}>{value}</option>)}
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
                  <option key={question.id} value={question.id}>N.º {question.number} · {question.year ?? "Sin año"} · {question.collection}</option>
                ))}
              </select>
            </div>
          </motion.div>

          <div className="border-t border-[var(--border)] px-5 py-5 sm:px-7">
            <PlaygroundTopicPicker
              selected={selectedUnitIds}
              onChange={(next) => { setSelectedUnitIds(next); setSelectedStartQuestion("random"); }}
              questionCounts={topicCounts}
            />
          </div>
          <div className="border-t border-[var(--border)] px-5 py-4 sm:px-7">
            <button type="button" aria-expanded={advancedOpen} aria-controls="playground-advanced-setup"
              onClick={() => setAdvancedOpen((value)=>!value)}
              className="flex w-full items-center justify-between gap-2 rounded-xl py-2 text-left text-[12px] font-extrabold text-[var(--text)]">
              <span className="inline-flex items-center gap-2"><SlidersHorizontal size={17} className="text-[var(--primary)]"/> Ajustes avanzados <span className="text-[10px] font-semibold text-[var(--muted)]">· Ensayos y preguntas exactas</span></span>
              <motion.span animate={{rotate:advancedOpen?180:0}} transition={{duration:.18}}><ChevronRight size={16}/></motion.span>
            </button>
            <AnimatePresence initial={false}>
              {advancedOpen && (
                <motion.div id="playground-advanced-setup" initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}}
                  exit={{opacity:0,height:0}} transition={{duration:.22}} className="overflow-hidden">
                  <div className="mt-3 border-t border-[var(--border)] pt-4">
                    {sourceLoading && <p role="status" className="text-xs text-[var(--muted)]">Cargando ensayos locales…</p>}
                    {sourceError && <p role="alert" className="text-xs text-amber-600">{sourceError}</p>}
                    <PlaygroundAdvancedPicker questions={questionBank} sources={sources}
                      selected={chosenQuestionIds} onChange={(next)=>{setChosenQuestionIds(next);setSelectedStartQuestion("random");}} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-4 sm:px-7">
            <p className="text-[12px] leading-5 text-[var(--muted)]">
              {questions.length === 0
                ? "No hay preguntas disponibles con esta combinación de ensayos, preguntas, año y subejes."
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
        <section className="mt-7" aria-labelledby="playground-recent-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="playground-recent-title" className="text-[18px] font-extrabold tracking-[-.025em] sm:text-[20px]">Últimas 5 preguntas</h2>
              <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">Retoma las preguntas que abriste recientemente.</p>
            </div>
            {recentQuestionIds.length > 0 && (
              <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-bold text-[var(--muted)]">
                {recentQuestionIds.length} {recentQuestionIds.length === 1 ? "reciente" : "recientes"}
              </span>
            )}
          </div>
          <div className="surface overflow-hidden rounded-2xl">
            {recentQuestionIds.length === 0 ? (
              <div className="px-5 py-7 text-center sm:py-9">
                <p className="text-[13px] font-bold text-[var(--text)]">Aún no hay preguntas en tu historial</p>
                <p className="mt-1 text-[12px] text-[var(--muted)]">Cuando empieces a practicar, las últimas preguntas aparecerán aquí.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {recentQuestionIds.map((id) => {
                  const question = questionBank.find((item) => item.id === id);
                  if (!question) return null;
                  return (
                    <div key={id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                          <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[var(--text)]">N.º {question.number} · {question.year ?? "Sin año"}</span>
                          <span className="text-[var(--muted)]">{question.axis} · {question.topic}</span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-5 text-[var(--text)]">{question.stem}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => revisitQuestion(question.id)}
                        className="soft-button inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-lg px-3 text-[11px] font-extrabold sm:self-center"
                        aria-label={"Volver a practicar pregunta número " + question.number}
                      >
                        Practicar de nuevo <ChevronRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
          El banco combina cuatro preguntas de ejemplo con tus ensayos importados de este navegador. Los ejemplos no son pruebas oficiales DEMRE; los años de demostración son referenciales. Los ensayos importados sin clasificación solo coinciden con «Todos los subejes».
        </p>
        </div>
        
      </motion.div>
      ) : (
        <div key="playground-practice" aria-label="Modo práctica de Playground">
          {current ? <ExternalQuestionWorkspace key={current.id}
            question={!current.stemBlocks && questionAssets.length ? { ...current, stemBlocks: [{ type: "text", text: current.stem }, ...questionAssets.map(asset => ({ type: "image", asset_id: asset.path, alt: `Ilustración de la pregunta ${current.number}` }))] } : current}
            assetUrls={new Map([...resourceUrls.byPath, ...resourceUrls.byId])}
            ready={!resourcesLoading && !displayedResourceError && (!DEFAULT_QUESTION_INDEX.some(question => question.id === current.id) || !!defaultRecords[current.sourceId])}
            error={displayedResourceError} retry={() => { if (sourceRecord) { if (current.sourceId.startsWith("default:")) setDefaultRecords(previous => ({ ...previous, [current.sourceId]: { ...sourceRecord } })); else setImportedRecords(previous => ({ ...previous, [current.sourceId]: { ...sourceRecord } })); } }}
            context="playground" sessionKey={`playground:${evidenceSession.current}`} number={position + 1} total={visibleOrder.length}
            subtitle={`${current.collection} · ${position + 1} de ${visibleOrder.length}`}
            selected={selectedAnswer ?? ""} onSelect={answer => setAnswers(previous => ({ ...previous, [current.id]: answer }))}
            locked={isRevealed || checking} checkedAnswer={isRevealed && current.correct !== null ? selectedAnswer : undefined} revealSolution={isRevealed && current.correct !== null}
            onReady={setSheetReady} busy={checking} onClose={() => { if (checkingRef.current) return; setPendingAction(null); setSettingsOpen(false); setIsPracticing(false); }}
            initialStrokes={currentStrokes} onStrokesChange={updateCurrentStrokes}
            steps={visibleOrder.map((id, index) => ({ number: index + 1, answered: !!revealed[id], current: id === current.id }))}
            notices={<>
              {saveError && <p role="alert" className="mb-3 text-sm text-rose-500">{saveError}</p>}
              {filterNotice && <p role="status" className="mb-3 text-sm text-amber-700">{filterNotice}</p>}
              {queuedFilters && <p className="mb-3 text-sm font-bold text-[var(--primary)]">Filtros nuevos en la próxima pregunta</p>}
              {isRevealed && <p role="status" className="mb-3 text-sm font-bold">{current.correct === null ? "Respuesta registrada; esta pregunta no tiene clave verificada." : isCorrect ? "¡Respuesta correcta!" : "Todavía no es correcta. Revisa la solución."}</p>}
              {pendingAction && <p role="status" className="mb-3 text-sm">Confirma para revisar. Se cancela en 5 segundos.</p>}
            </>}
            renderAiHelp={onOpenChange => <AskAiButton onOpenChange={onOpenChange} settings={aiSettings} onChange={updateAiSettings} disabled={!sheetReady || checking} onHelp={() => { void recordEvidence({type:"expose",questionId:current.id,mode:"playground",sessionId:evidenceSession.current,assisted:true}).catch(error => setSaveError(error.message)); }} question={{ number: current.number, stem: current.stemBlocks ?? current.stem, options: current.options.map((option, index) => ({ label: current.optionLabels?.[index] ?? String.fromCharCode(65 + index), content: current.optionBlocks?.[index] ?? option })) }} />}
            tools={<div className="space-y-3">
              <button type="button" aria-label="Ajustes de apariencia y filtros de preguntas" className="min-h-11 w-full rounded-lg border border-[var(--pg-border)] px-3 text-left text-base" onClick={openPracticeSettings}>Filtros de preguntas y ayuda</button>
              {isRevealed && <button type="button" onClick={() => { setPendingAction(null); setRevealed(previous => ({ ...previous, [current.id]: false })); }} className="min-h-11 w-full rounded-lg border border-[var(--pg-border)] px-3 text-left text-base">Reintentar</button>}
            </div>}
            footer={(drawing, aiHelp) => <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <button type="button" aria-label="Pregunta anterior" disabled={position === 0 || drawing || checking} onClick={() => { setPendingAction(null); setPosition(previous => Math.max(0, previous - 1)); }} className="min-h-12 rounded-xl border border-[var(--pg-border)] px-3 disabled:opacity-40"><ChevronLeft size={20} /></button>
              {isRevealed && aiHelp}
              {current.options.length === 0 && !isRevealed ? <button type="button" className="tactile-primary min-h-12 flex-1 rounded-xl px-4 font-bold" onClick={() => setRevealed(previous => ({ ...previous, [current.id]: true }))}>Saltar pregunta</button> : !isRevealed ? <button type="button" aria-label={pendingAction === "check" ? "Confirmar respuesta" : "Comprobar respuesta"} disabled={!selectedAnswer || !sheetReady || checking || drawing} onClick={() => void confirmAnswer()} className="tactile-primary min-h-12 flex-1 rounded-xl px-4 font-bold disabled:opacity-40">{checking ? "Guardando…" : pendingAction === "check" ? "Confirmar" : current.correct === null ? "Registrar respuesta" : "Comprobar"}</button> : <button type="button" disabled={drawing} className="tactile-primary min-h-12 flex-1 rounded-xl px-4 font-bold disabled:opacity-40" onClick={advanceQuestion}>Siguiente</button>}
            </div>}
          /> : <section role="status" className="grid min-h-[60vh] place-items-center">Preparando tu práctica…</section>}
          {settingsOpen && <QuestionDialog title="Ajustes de la práctica" wide onClose={() => setSettingsOpen(false)}><div ref={settingsRef}>
                      <AiHelpSettings settings={aiSettings} onChange={updateAiSettings} />
                      <div className="mt-4 border-t border-[var(--border)] pt-4">
                        <h3 className="text-[12px] font-extrabold">Filtros de preguntas</h3>
                        <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                          Puedes aplicarlos ahora o al avanzar a la siguiente pregunta.
                        </p>
                        <div className="mt-3 grid gap-3">
                          <div>
                            <label htmlFor="playground-practice-year" className="mb-1 block text-[11px] font-bold">Año</label>
                            <select
                              id="playground-practice-year"
                              value={draftYear}
                              onChange={(event) => { setDraftYear(event.target.value); setDraftQuestion("random"); }}
                              className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]"
                            >
                              <option value="all">Todos los años</option>
                              {[...new Set(questionBank.map((question) => question.year).filter((value): value is number => value !== null))].sort((a, b) => b - a).map((value) => <option key={value} value={value}>{value}</option>)}
                            </select>
                          </div>
                          <PlaygroundTopicPicker
                            selected={draftUnitIds}
                            onChange={(next) => { setDraftUnitIds(next); setDraftQuestion("random"); setFilterDecisionOpen(false); }}
                            questionCounts={draftTopicCounts}
                            compact
                          />
                          <div className="border-t border-[var(--border)] pt-3">
                            <button type="button" aria-expanded={draftAdvancedOpen} aria-controls="playground-advanced-practice"
                              onClick={()=>setDraftAdvancedOpen((value)=>!value)}
                              className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-extrabold text-[var(--text)]">
                              <span className="inline-flex items-center gap-2"><SlidersHorizontal size={15} className="text-[var(--primary)]"/> Ensayos y preguntas exactas</span>
                              <motion.span animate={{rotate:draftAdvancedOpen?180:0}} transition={{duration:.18}}><ChevronRight size={15}/></motion.span>
                            </button>
                            <AnimatePresence initial={false}>
                              {draftAdvancedOpen && (
                                <motion.div id="playground-advanced-practice" initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}}
                                  exit={{opacity:0,height:0}} transition={{duration:.2}} className="overflow-hidden">
                                  <div className="mt-3 border-t border-[var(--border)] pt-3">
                                    <PlaygroundAdvancedPicker questions={questionBank} sources={sources} compact
                                      selected={draftQuestionIds} onChange={(next)=>{setDraftQuestionIds(next);setDraftQuestion("random");setFilterDecisionOpen(false);}}/>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold">
                            <input type="checkbox" checked={draftSavedOnly} onChange={(event) => { setDraftSavedOnly(event.target.checked); setDraftQuestion("random"); }} />
                            Solo preguntas guardadas
                          </label>
                          <div>
                            <label htmlFor="playground-practice-question" className="mb-1 block text-[11px] font-bold">Primera pregunta</label>
                            <select
                              id="playground-practice-question"
                              value={draftQuestion}
                              onChange={(event) => setDraftQuestion(event.target.value)}
                              className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]"
                            >
                              <option value="random">Aleatoria</option>
                              {draftQuestions.map((question) => (
                                <option key={question.id} value={question.id}>N.º {question.number} · {question.year ?? "Sin año"} · {question.collection}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-[var(--muted)]">{draftQuestions.length} disponibles</span>
                          <button
                            type="button"
                            disabled={draftQuestions.length === 0}
                            onClick={() => setFilterDecisionOpen(true)}
                            className="tactile-primary min-h-9 rounded-lg px-3 text-[11px] font-extrabold disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Aplicar filtros
                          </button>
                        </div>
                        {filterDecisionOpen && (
                          <div role="group" aria-label="Cuándo aplicar los filtros" className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                            <p className="text-[12px] font-extrabold text-[var(--text)]">¿Cuándo quieres aplicar los cambios?</p>
                            <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                              Puedes terminar la pregunta actual sin perder tu respuesta ni tus cálculos.
                            </p>
                            <div className="mt-3 grid gap-2">
                              <button
                                type="button"
                                onClick={() => applyPracticeFilters("next")}
                                className="min-h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[11px] font-bold text-[var(--text)] hover:bg-[var(--surface-3)]"
                              >
                                En la próxima pregunta
                              </button>
                              <button
                                type="button"
                                onClick={() => applyPracticeFilters("now")}
                                className="tactile-primary min-h-9 rounded-lg px-3 text-[11px] font-extrabold"
                              >
                                Aplicar ahora
                              </button>
                              <button
                                type="button"
                                onClick={() => setFilterDecisionOpen(false)}
                                className="min-h-8 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--text)]"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

          </div></QuestionDialog>}
        </div>
      )}
      </AnimatePresence>
    </AppShell>
  );
}
