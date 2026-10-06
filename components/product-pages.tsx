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

const technicalExams = [
  {
    title: "Ensayo M1 · Septiembre",
    date: "21 sep 2026",
    score: 742,
    delta: "+14 pts",
    wrong: [4, 8, 12, 18, 27, 33, 42, 51, 57, 63],
    omitted: [7, 22, 46, 60],
  },
  {
    title: "Ensayo M1 · Septiembre",
    date: "12 sep 2026",
    score: 728,
    delta: "+17 pts",
    wrong: [3, 9, 14, 19, 25, 31, 38, 44, 49, 55, 59, 64],
    omitted: [6, 20, 41, 61],
  },
  {
    title: "Ensayo M1 · Septiembre",
    date: "03 sep 2026",
    score: 711,
    delta: "+9 pts",
    wrong: [2, 5, 10, 16, 21, 26, 30, 35, 39, 45, 50, 54, 58, 62],
    omitted: [13, 29, 47, 65],
  },
] as const;

function ExamQuestionMap({ wrong, omitted }: { wrong: readonly number[]; omitted: readonly number[] }) {
  const wrongSet = new Set(wrong);
  const omittedSet = new Set(omitted);
  const correct = 65 - wrong.length - omitted.length;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-bold text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-emerald-500" />{correct} correctas</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-rose-400" />{wrong.length} incorrectas</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-[var(--muted-2)] opacity-70" />{omitted.length} omitidas</span>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }} aria-label="Mapa de las 65 preguntas">
        {Array.from({ length: 65 }).map((_, index) => {
          const question = index + 1;
          const state = omittedSet.has(question) ? "omitted" : wrongSet.has(question) ? "wrong" : "correct";
          const label = state === "correct" ? "Correcta" : state === "wrong" ? "Incorrecta" : "Omitida";
          return (
            <span
              key={question}
              title={`Pregunta ${question}: ${label}`}
              className={
                "aspect-[1.35/1] min-h-[8px] rounded-[4px] " +
                (state === "correct"
                  ? "bg-emerald-500"
                  : state === "wrong"
                    ? "bg-rose-400"
                    : "bg-[var(--muted-2)] opacity-55")
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function TechnicalExamRow({ exam }: { exam: (typeof technicalExams)[number] }) {
  return (
    <article className="surface rounded-[18px] p-4 transition hover:border-[var(--border-strong)] sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(220px,.78fr)_minmax(0,1.55fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-extrabold">{exam.title}</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-2xl font-extrabold tracking-[-.03em]">{exam.score}</span>
            <span className="pb-0.5 text-[10px] font-bold text-[var(--muted)]">pts</span>
          </div>
          <div className="mt-1 text-[10px] font-medium text-[var(--muted)]">{exam.date} · Analizado</div>
          <div className="mt-1 text-[10px] font-extrabold text-emerald-500">{exam.delta}</div>
        </div>

        <ExamQuestionMap wrong={exam.wrong} omitted={exam.omitted} />

        <div className="flex items-center gap-2 lg:flex-col">
          <Link
            href="/app/ensayos/resultado"
            className="tactile-primary grid h-11 w-11 place-items-center rounded-xl"
            title="Abrir ensayo"
            aria-label="Abrir ensayo"
          >
            <Play size={17} fill="currentColor" />
          </Link>
          <button
            type="button"
            className="soft-button grid h-11 w-11 place-items-center rounded-xl"
            title="Opciones del ensayo"
            aria-label="Opciones del ensayo"
          >
            <Settings size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function ExamsExperience() {
  const [importedExams, setImportedExams] = useState<ImportedExamSummary[]>([]);
  const [query, setQuery] = useState("");
  const [sortByScore, setSortByScore] = useState(false);

  useEffect(() => {
    void listImportedExams()
      .then(setImportedExams)
      .catch(() => setImportedExams([]));
  }, []);

  const visibleExams = technicalExams
    .filter((exam) => (exam.title + " " + exam.date).toLowerCase().includes(query.trim().toLowerCase()))
    .slice()
    .sort((a, b) => sortByScore ? b.score - a.score : 0);

  return (
    <AppShell title="Ensayos" showPageContext={false}>
      <section>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-[-.035em] sm:text-[34px]">Tus ensayos</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Revisa resultados, errores y el mapa completo de preguntas de cada ensayo.
        </p>
      </section>

      <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <div className="surface rounded-xl px-4 py-2.5 text-xs font-extrabold">
            Ensayos: {technicalExams.length + importedExams.length}
          </div>
          <Link href="/app/ensayos/importar" className="soft-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold">
            <Upload size={15} />Importar ensayo
          </Link>
          <Link href="/app/ensayos/nuevo" className="tactile-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold">
            <Play size={15} />Nuevo ensayo
          </Link>
        </div>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row xl:justify-end">
          <button
            type="button"
            onClick={() => setSortByScore((value) => !value)}
            className="soft-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold"
          >
            <Settings size={15} />{sortByScore ? "Orden: puntaje" : "Orden: reciente"}
          </button>

          <label className="surface flex min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 sm:w-[260px]">
            <Search size={15} className="shrink-0 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar ensayo"
              className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none placeholder:text-[var(--muted-2)]"
            />
          </label>
        </div>
      </div>

      {importedExams.length > 0 && (
        <section className="mt-4 rounded-[18px] border border-emerald-300/60 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
            <PackageCheck size={16} />Importados en este navegador
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {importedExams.map((exam) => (
              <Link
                key={exam.id}
                href={"/app/ensayos/importado/" + encodeURIComponent(exam.id)}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-emerald-200/70 bg-[var(--surface)] p-3 transition hover:border-emerald-400 dark:border-emerald-900/70"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-extrabold">{exam.title}</div>
                  <div className="mt-1 text-[10px] text-[var(--muted)]">{exam.questionCount} preguntas · {exam.assetCount} assets</div>
                </div>
                <ChevronRight size={16} className="text-[var(--muted)]" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-4 space-y-3">
        {visibleExams.map((exam) => <TechnicalExamRow key={exam.date} exam={exam} />)}
        {visibleExams.length === 0 && (
          <div className="surface rounded-[18px] p-8 text-center text-sm font-bold text-[var(--muted)]">
            No encontré ensayos con esa búsqueda.
          </div>
        )}
      </section>

      <section className="surface mt-4 rounded-[20px] border-dashed p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-extrabold">Agregar ensayo</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Importa un paquete .paessed/.zip. La pantalla de importación permite revisar el contenido antes de guardarlo.
            </p>
          </div>
          <Link href="/app/ensayos/importar" className="soft-button inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold">
            <Upload size={16} />Importar archivo
          </Link>
        </div>
      </section>
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
