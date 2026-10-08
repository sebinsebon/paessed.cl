"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock3, Flag, Grid3X3, Target, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type DemoQuestion = {
  domain: string;
  prompt: string;
  options: string[];
  answer: number;
};

const BASE: DemoQuestion[] = [
  { domain: "Números", prompt: "Si un precio de $80.000 aumenta un 15%, ¿cuál es el nuevo precio?", options: ["$88.000", "$90.000", "$92.000", "$95.000"], answer: 2 },
  { domain: "Álgebra y Funciones", prompt: "Si f(x) = 2x + 5, ¿cuánto vale f(6)?", options: ["12", "15", "17", "22"], answer: 2 },
  { domain: "Geometría", prompt: "Un triángulo rectángulo tiene catetos 9 y 12. ¿Cuánto mide la hipotenusa?", options: ["13", "15", "18", "21"], answer: 1 },
  { domain: "Probabilidad y Estadística", prompt: "La mediana de 2, 4, 4, 7, 9 es:", options: ["4", "5", "5,2", "7"], answer: 0 },
  { domain: "Números", prompt: "¿Cuál expresión equivale a 3² · 3³?", options: ["3⁵", "6⁵", "9⁶", "3⁶"], answer: 0 },
  { domain: "Álgebra y Funciones", prompt: "¿Cuál es la solución de 5x - 10 = 20?", options: ["4", "5", "6", "8"], answer: 2 },
  { domain: "Geometría", prompt: "El área de un rectángulo de lados 8 cm y 5 cm es:", options: ["13 cm²", "26 cm²", "40 cm²", "80 cm²"], answer: 2 },
  { domain: "Probabilidad y Estadística", prompt: "En una bolsa hay 3 bolas rojas y 2 azules. La probabilidad de sacar una azul es:", options: ["2/3", "2/5", "3/5", "1/2"], answer: 1 },
];

const QUESTIONS = Array.from({ length: 65 }, (_, i) => {
  const base = BASE[i % BASE.length];
  return { ...base, number: i + 1 };
});

function formatTime(total: number) {
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return minutes + ":" + seconds;
}

export function ExamSession() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>(() => Array(65).fill(null));
  const [flagged, setFlagged] = useState<boolean[]>(() => Array(65).fill(false));
  const [seconds, setSeconds] = useState(2 * 60 * 60 + 20 * 60);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const answered = answers.filter((value) => value !== null).length;
  const q = QUESTIONS[index];

  const finish = () => {
    const correct = answers.reduce<number>((sum, value, i) => sum + (value === QUESTIONS[i].answer ? 1 : 0), 0);
    const omitted = 65 - answered;
    const wrong = answered - correct;
    const score = Math.round(100 + (correct / 65) * 900);
    localStorage.setItem("paessed-last-exam", JSON.stringify({
      correct, wrong, omitted, score, secondsLeft: seconds, completedAt: new Date().toISOString(),
    }));
    router.push("/app/ensayos/resultado");
  };

  const choose = (option: number) => {
    const copy = [...answers];
    copy[index] = option;
    setAnswers(copy);
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1380px] items-center gap-3 px-4 sm:px-6">
          <Link href="/app/ensayos" className="soft-button grid h-9 w-9 place-items-center rounded-xl" aria-label="Salir del ensayo"><ArrowLeft size={16} /></Link>
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--muted)]">Ensayo M1 · modo prototipo</div>
            <div className="truncate text-sm font-extrabold">Simulación completa · 65 preguntas</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setPalette(!palette)} className="soft-button hidden items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold sm:flex">
              <Grid3X3 size={15} />{answered}/65
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-extrabold">
              <Clock3 size={15} className={seconds < 600 ? "text-red-500" : "text-[var(--primary)]"} />
              {formatTime(seconds)}
            </div>
          </div>
        </div>
        <div className="h-1.5 bg-[var(--surface-3)]">
          <div className="h-full bg-[var(--primary)] transition-all" style={{ width: ((index + 1) / 65) * 100 + "%" }} />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1380px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="surface-raised rounded-[24px] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--secondary-soft)] px-3 py-1.5 text-[10px] font-extrabold text-[var(--secondary)]">{q.domain}</span>
              <span className="text-[10px] font-bold text-[var(--muted)]">Pregunta {q.number} de 65</span>
            </div>
            <button
              onClick={() => {
                const copy = [...flagged];
                copy[index] = !copy[index];
                setFlagged(copy);
              }}
              className={"inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-extrabold " + (flagged[index] ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" : "bg-[var(--surface-2)] text-[var(--muted)]")}
            >
              <Flag size={14} fill={flagged[index] ? "currentColor" : "none"} />Marcar
            </button>
          </div>

          <div className="mt-7 max-w-3xl text-lg font-bold leading-8 sm:text-xl">{q.prompt}</div>

          <div className="mt-8 space-y-3">
            {q.options.map((option, optionIndex) => {
              const active = answers[index] === optionIndex;
              return (
                <button
                  key={option}
                  onClick={() => choose(optionIndex)}
                  className={"flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all " + (active
                    ? "border-orange-400 bg-orange-50 shadow-[0_3px_0_#fb923c] dark:bg-orange-950/20"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]")}
                >
                  <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-extrabold " + (active ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-3)] text-[var(--muted)]")}>{String.fromCharCode(65 + optionIndex)}</span>
                  <span className="font-bold">{option}</span>
                  {active && <Check size={18} className="ml-auto text-[var(--primary)]" />}
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
            <button onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} className="soft-button rounded-xl px-4 py-3 text-xs font-extrabold disabled:opacity-40">Anterior</button>
            <div className="flex gap-2">
              {index < 64 ? (
                <button onClick={() => setIndex(index + 1)} className="tactile-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold">Siguiente <ArrowRight size={15} /></button>
              ) : (
                <button onClick={finish} className="tactile-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold"><Trophy size={15} />Finalizar ensayo</button>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="surface rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span>Mapa del ensayo</span>
              <button onClick={() => setPalette(!palette)} className="text-[var(--primary)] sm:hidden">Ver</button>
            </div>
            <div className="mt-4 grid grid-cols-10 gap-1.5 lg:grid-cols-5">
              {QUESTIONS.map((item, i) => {
                const active = i === index;
                const hasAnswer = answers[i] !== null;
                const marked = flagged[i];
                let klass = "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]";
                if (hasAnswer) klass = "border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
                if (marked) klass = "border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
                if (active) klass = "border-orange-400 bg-orange-50 text-orange-700 ring-2 ring-orange-200 dark:bg-orange-950/30 dark:text-orange-300";
                return (
                  <button key={item.number} onClick={() => setIndex(i)} className={"aspect-square rounded-lg border text-[9px] font-extrabold " + klass}>{item.number}</button>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[9px] font-bold text-[var(--muted)]">
              <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/20">{answered}<br />respondidas</div>
              <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950/20">{flagged.filter(Boolean).length}<br />marcadas</div>
              <div className="rounded-lg bg-[var(--surface-2)] p-2">{65 - answered}<br />pendientes</div>
            </div>
          </div>

          <div className="surface rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs font-extrabold"><Target size={15} className="text-[var(--secondary)]" />Antes de terminar</div>
            <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">Puedes dejar preguntas omitidas. PAESSED las considera evidencia distinta a una respuesta incorrecta.</p>
            <button onClick={finish} className="soft-button mt-4 w-full rounded-xl px-4 py-3 text-[10px] font-extrabold">Finalizar ahora</button>
          </div>
        </aside>
      </main>
    </div>
  );
}

type ResultData = { correct: number; wrong: number; omitted: number; score: number; secondsLeft: number };

export function ExamResult() {
  const [data, setData] = useState<ResultData | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("paessed-last-exam");
    if (raw) setData(JSON.parse(raw));
    else setData({ correct: 47, wrong: 14, omitted: 4, score: 711, secondsLeft: 1800 });
  }, []);

  const accuracy = useMemo(() => data ? Math.round((data.correct / Math.max(1, data.correct + data.wrong)) * 100) : 0, [data]);
  if (!data) return null;

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex h-20 max-w-[1180px] items-center px-5 sm:px-7">
          <Link href="/app/ensayos" className="flex items-center gap-2 text-xs font-extrabold text-[var(--muted)]"><ArrowLeft size={15} />Volver a ensayos</Link>
          <img src="/paessed-logo.svg" alt="PAESSED" className="ml-auto h-auto w-[132px] dark:hidden" />
          <img src="/paessed-logo-dark.svg" alt="PAESSED" className="ml-auto hidden h-auto w-[132px] dark:block" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1050px] px-5 py-10 sm:px-7 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-950/30"><Trophy size={25} /></div>
          <div className="mt-5 text-[11px] font-extrabold uppercase tracking-[.14em] text-[var(--primary)]">Ensayo completado</div>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-.04em]">{data.score} pts</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">Resultado estimado del prototipo. En producción se usará la conversión y evidencia oficial configurada por PAESSED.</p>
        </div>

        <div className="mt-9 grid gap-4 sm:grid-cols-4">
          {[
            ["Correctas", data.correct, "text-emerald-500"],
            ["Incorrectas", data.wrong, "text-rose-500"],
            ["Omitidas", data.omitted, "text-[var(--muted)]"],
            ["Precisión", accuracy + "%", "text-[var(--secondary)]"],
          ].map(([label, value, klass]) => (
            <div key={String(label)} className="surface rounded-2xl p-5 text-center">
              <div className={"text-3xl font-extrabold " + klass}>{value}</div>
              <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[.08em] text-[var(--muted)]">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <div className="surface-raised rounded-2xl p-5 sm:p-6">
            <div className="text-sm font-extrabold">Qué haría PAESSED ahora</div>
            <div className="mt-5 space-y-3">
              {[
                "Recalibrar dominio por eje y unidad.",
                "Separar errores conceptuales de omisiones.",
                "Subir prioridad de tus temas débiles.",
                "Crear una misión corta para mañana.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-xl bg-[var(--surface-2)] p-3 text-xs font-bold">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><Check size={12} /></span>{item}
                </div>
              ))}
            </div>
          </div>

          <div className="surface rounded-2xl p-5 sm:p-6">
            <div className="text-sm font-extrabold">Siguiente paso recomendado</div>
            <div className="mt-4 rounded-2xl bg-red-50 p-4 dark:bg-red-950/20">
              <div className="text-[10px] font-extrabold uppercase tracking-[.1em] text-red-500">Prioridad</div>
              <div className="mt-1 text-lg font-extrabold">Geometría</div>
              <div className="mt-1 text-xs leading-5 text-[var(--muted)]">Revisa semejanza y Teorema de Tales antes del siguiente ensayo completo.</div>
            </div>
            <Link href="/app/aprender" className="tactile-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold">Ir a mi ruta <ArrowRight size={15} /></Link>
          </div>
        </div>
      </main>
    </div>
  );
}
