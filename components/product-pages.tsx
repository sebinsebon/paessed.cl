"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Flame,
  Gamepad2,
  Lock,
  Play,
  Route,
  Search,
  Settings,
  Sparkles,
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
          className="grid w-full max-w-[300px] grid-cols-[repeat(10,minmax(0,1fr))] gap-1.5"
        >
          {Array.from({ length: count }, (_, index) => (
            <span
              key={index}
              aria-hidden="true"
              title={"Pregunta " + (index + 1) + ": resultado no disponible"}
              className="aspect-square min-w-0 rounded-[4px] bg-[var(--surface-4)] ring-1 ring-inset ring-[var(--border)]"
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

const questionBank = [
  { id: 32640, year: 2026, domain: "Álgebra y Funciones", topic: "Funciones lineales", difficulty: "Media" },
  { id: 32619, year: 2026, domain: "Números", topic: "Potencias y raíces", difficulty: "Media" },
  { id: 32531, year: 2025, domain: "Geometría", topic: "Semejanza", difficulty: "Alta" },
  { id: 32456, year: 2024, domain: "Probabilidad y Estadística", topic: "Frecuencia relativa", difficulty: "Baja" },
];

export function PlaygroundExperience() {
  const [selected, setSelected] = useState(questionBank[0]);
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  return (
    <AppShell title="Playground" eyebrow="Banco de preguntas">
      <section className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--secondary-soft)] px-3 py-1.5 text-[10px] font-extrabold text-[var(--secondary)]"><Gamepad2 size={14} />EXPLORA SIN PRESIÓN</div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-.03em]">Practica preguntas reales</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Filtra por eje, tema o año y prueba preguntas sin alterar tu ruta principal.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="surface rounded-2xl p-4">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-xs text-[var(--muted)]">
            <Search size={15} />
            Buscar tema o pregunta
          </div>
          <div className="mt-4 space-y-2">
            {questionBank.map((item) => {
              const active = item.id === selected.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setSelected(item); setChoice(null); setChecked(false); }}
                  className={"w-full rounded-xl border p-3 text-left transition " + (active ? "border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20" : "border-[var(--border)] hover:bg-[var(--surface-2)]")}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-extrabold text-[var(--muted)]">#{item.id}</div>
                    <div className="text-[9px] font-extrabold text-[var(--muted-2)]">{item.year}</div>
                  </div>
                  <div className="mt-1 text-xs font-extrabold">{item.topic}</div>
                  <div className="mt-1 text-[10px] text-[var(--muted)]">{item.domain} · {item.difficulty}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="surface-raised rounded-[24px] p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold">
            <span className="rounded-full bg-[var(--secondary-soft)] px-3 py-1.5 text-[var(--secondary)]">{selected.domain}</span>
            <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[var(--muted)]">{selected.topic}</span>
            <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[var(--muted)]">{selected.year}</span>
          </div>

          <div className="mt-6 text-lg font-bold leading-8">
            La distancia de reacción de un vehículo se modela mediante f(x) = ax. Si a 110 km/h la distancia es 33 m, ¿cuál es la distancia de reacción a 30 km/h?
          </div>

          <div className="mt-7 space-y-3">
            {["15 m", "10 m", "9 m", "1 m"].map((option, index) => (
              <button
                key={option}
                onClick={() => { setChoice(option); setChecked(false); }}
                className={"flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition " + (choice === option ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20" : "border-[var(--border)] hover:bg-[var(--surface-2)]")}
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--surface-3)] text-xs font-extrabold">{String.fromCharCode(65 + index)}</span>
                <span className="font-bold">{option}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 border-t border-[var(--border)] pt-5">
            {checked && (
              <div className={"mb-4 rounded-2xl border p-4 " + (choice === "9 m"
                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20"
                : "border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/20")}>
                <div className={"text-xs font-extrabold " + (choice === "9 m" ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
                  {choice === "9 m" ? "Correcto" : "Revisa la proporcionalidad"}
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Si 110 km/h corresponden a 33 m, la constante es 33/110 = 0,3. Entonces f(30) = 0,3 · 30 = 9 m.
                </p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold text-[var(--muted)]">Pregunta #{selected.id} · DEMRE</div>
              <button onClick={() => setChecked(true)} disabled={!choice} className="tactile-primary rounded-xl px-5 py-3 text-xs font-extrabold disabled:opacity-45">Comprobar</button>
            </div>
          </div>
        </section>
      </div>
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
