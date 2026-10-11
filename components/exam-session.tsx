"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Clock3,
  Eraser, Flag, Grid3X3, Pencil, RotateCcw, Settings, Trash2, Trophy, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getM1Unit, type M1UnitId } from "@/lib/m1-curriculum";
import { PlaygroundScratchpad, type PlaygroundInkStroke } from "@/components/playground-scratchpad";

type DemoQuestion = {
  domain: string;
  unitId: M1UnitId;
  prompt: string;
  options: string[];
  answer: number;
};

const BASE: DemoQuestion[] = [
  { domain: "Números", unitId: "porcentaje", prompt: "Si un precio de $80.000 aumenta un 15%, ¿cuál es el nuevo precio?", options: ["$88.000", "$90.000", "$92.000", "$95.000"], answer: 2 },
  { domain: "Álgebra y funciones", unitId: "funcion-lineal-afin", prompt: "Si f(x) = 2x + 5, ¿cuánto vale f(6)?", options: ["12", "15", "17", "22"], answer: 2 },
  { domain: "Geometría", unitId: "figuras-geometricas", prompt: "Un triángulo rectángulo tiene catetos 9 y 12. ¿Cuánto mide la hipotenusa?", options: ["13", "15", "18", "21"], answer: 1 },
  { domain: "Probabilidad y estadística", unitId: "representacion-datos-tablas-graficos", prompt: "El promedio de 2, 4, 4, 7 y 8 es:", options: ["4", "5", "5,2", "7"], answer: 1 },
  { domain: "Números", unitId: "potencias-raices-enesimas", prompt: "¿Cuál expresión equivale a 3² · 3³?", options: ["3⁵", "6⁵", "9⁶", "3⁶"], answer: 0 },
  { domain: "Álgebra y funciones", unitId: "ecuaciones-inecuaciones-primer-grado", prompt: "¿Cuál es la solución de 5x - 10 = 20?", options: ["4", "5", "6", "8"], answer: 2 },
  { domain: "Geometría", unitId: "figuras-geometricas", prompt: "El área de un rectángulo de lados 8 cm y 5 cm es:", options: ["13 cm²", "26 cm²", "40 cm²", "80 cm²"], answer: 2 },
  { domain: "Probabilidad y estadística", unitId: "reglas-probabilidades", prompt: "En una bolsa hay 3 bolas rojas y 2 azules. La probabilidad de sacar una azul es:", options: ["2/3", "2/5", "3/5", "1/2"], answer: 1 },
];

const QUESTIONS = Array.from({ length: 65 }, (_, i) => ({ ...BASE[i % BASE.length], number: i + 1 }));
const QUESTION_FONT = { fontFamily: 'Georgia, "Times New Roman", serif' };

function formatTime(total: number) {
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return minutes + ":" + seconds;
}

/**
 * Essay uses Playground's large paper and top toolbar, while its timer,
 * unanswered questions, markings, 65-question navigation and result remain
 * independent from Playground's immediate-answer checking.
 */
export function ExamSession() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>(() => Array(QUESTIONS.length).fill(null));
  const [flagged, setFlagged] = useState<boolean[]>(() => Array(QUESTIONS.length).fill(false));
  const [seconds, setSeconds] = useState(2 * 60 * 60 + 20 * 60);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [paperTheme, setPaperTheme] = useState<"auto" | "light" | "dark">("light");
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [drawingTool, setDrawingTool] = useState<"pen" | "eraser">("pen");
  const [drawingColor, setDrawingColor] = useState("#2563eb");
  const [strokesByQuestion, setStrokesByQuestion] = useState<Record<number, PlaygroundInkStroke[]>>({});
  const paperScrollRef = useRef<HTMLDivElement>(null);
  const q = QUESTIONS[index];
  const answered = answers.filter((value) => value !== null).length;
  const markedCount = flagged.filter(Boolean).length;
  const pendingCount = QUESTIONS.length - answered;
  const inkStrokes = strokesByQuestion[index] ?? [];

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("paessed-essay-paper-theme");
    if (stored === "auto" || stored === "light" || stored === "dark") setPaperTheme(stored);
  }, []);

  useEffect(() => {
    paperScrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
    setPaletteOpen(false);
    setSettingsOpen(false);
    setDrawingEnabled(false);
  }, [index]);

  useEffect(() => {
    if (!paletteOpen && !settingsOpen && !confirmFinish) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setSettingsOpen(false);
        setConfirmFinish(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [paletteOpen, settingsOpen, confirmFinish]);

  const paperPalette = paperTheme === "dark"
    ? { bg: "#111827", fg: "#f8fafc", muted: "#94a3b8", border: "#334155", soft: "#1e293b", option: "#1a2536", optionHover: "#25344b", selected: "#3b261b", footer: "#151d2c" }
    : paperTheme === "light"
      ? { bg: "#ffffff", fg: "#111827", muted: "#64748b", border: "#e2e8f0", soft: "#f1f5f9", option: "#f8fafc", optionHover: "#fff7ed", selected: "#fff7ed", footer: "#fcfcfd" }
      : { bg: "var(--surface)", fg: "var(--text)", muted: "var(--muted)", border: "var(--border)", soft: "var(--surface-2)", option: "var(--surface-2)", optionHover: "var(--surface-3)", selected: "var(--primary-soft)", footer: "var(--surface)" };
  const paperStyle = {
    "--pg-bg": paperPalette.bg, "--pg-fg": paperPalette.fg,
    "--pg-muted": paperPalette.muted, "--pg-border": paperPalette.border,
    "--pg-soft": paperPalette.soft, "--pg-option": paperPalette.option,
    "--pg-option-hover": paperPalette.optionHover, "--pg-selected": paperPalette.selected,
    "--pg-footer": paperPalette.footer,
  } as CSSProperties;

  const finish = () => {
    const correct = answers.reduce<number>((sum, value, i) => sum + (value === QUESTIONS[i].answer ? 1 : 0), 0);
    const omitted = QUESTIONS.length - answered;
    const wrong = answered - correct;
    const score = Math.round(100 + (correct / QUESTIONS.length) * 900);
    localStorage.setItem("paessed-last-exam", JSON.stringify({
      correct, wrong, omitted, score, secondsLeft: seconds, completedAt: new Date().toISOString(),
    }));
    router.push("/app/ensayos/resultado");
  };

  const goToQuestion = (nextIndex: number) => {
    setIndex(Math.max(0, Math.min(QUESTIONS.length - 1, nextIndex)));
  };
  const toggleFlag = () => {
    setFlagged((previous) => previous.map((marked, i) => i === index ? !marked : marked));
  };
  const updateStrokes = (next: PlaygroundInkStroke[]) => {
    setStrokesByQuestion((previous) => ({ ...previous, [index]: next }));
  };
  const changePaperTheme = (next: "auto" | "light" | "dark") => {
    setPaperTheme(next);
    localStorage.setItem("paessed-essay-paper-theme", next);
    setSettingsOpen(false);
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--canvas)] text-[var(--text)]" aria-label="Ensayo M1 · 65 preguntas">
      <header className="relative z-30 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex min-h-[58px] w-full max-w-[1460px] items-center gap-2 px-3 sm:gap-4 sm:px-6">
          <Link
            href="/app/ensayos"
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12px] font-bold text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            aria-label="Volver a Ensayos"
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Volver a ensayos</span>
            <span className="sm:hidden">Volver</span>
          </Link>

          <div className="min-w-0 flex-1 rounded-lg px-1 py-1.5 text-center sm:px-3">
            <p className="flex items-center justify-center gap-2 text-[12px] font-extrabold">
              <span>Matemática M1</span>
              <span className="text-[var(--secondary)]">Ensayos</span>
            </p>
            <p className="truncate text-[10px] font-medium text-[var(--muted)]">
              Simulación de práctica · {answered}/{QUESTIONS.length} respondidas
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={drawingEnabled ? "Desactivar lápiz" : "Activar lápiz para cálculos"}
              title={drawingEnabled ? "Cerrar lápiz" : "Hacer cálculos sobre la hoja"}
              aria-pressed={drawingEnabled}
              onClick={() => { setDrawingEnabled((previous) => !previous); setPaletteOpen(false); setSettingsOpen(false); }}
              className={"grid h-10 w-10 place-items-center rounded-xl border transition-colors " + (drawingEnabled ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]")}
            >
              <Pencil size={18} />
            </button>
            <button
              type="button"
              onClick={toggleFlag}
              aria-label={flagged[index] ? "Desmarcar pregunta para revisar" : "Marcar pregunta para revisar"}
              title={flagged[index] ? "Quitar marca de revisión" : "Marcar para revisar"}
              aria-pressed={flagged[index]}
              className={"grid h-10 w-10 place-items-center rounded-xl border transition-colors " + (flagged[index] ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]")}
            >
              <Flag size={18} fill={flagged[index] ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              aria-label="Abrir mapa de preguntas"
              title="Mapa de preguntas"
              aria-expanded={paletteOpen}
              onClick={() => { setPaletteOpen((previous) => !previous); setSettingsOpen(false); setDrawingEnabled(false); }}
              className={"grid h-10 w-10 place-items-center rounded-xl border transition-colors " + (paletteOpen ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]")}
            >
              <Grid3X3 size={18} />
            </button>
            <button
              type="button"
              aria-label="Ajustes de apariencia de la hoja"
              title="Ajustes de la hoja"
              aria-expanded={settingsOpen}
              onClick={() => { setSettingsOpen((previous) => !previous); setPaletteOpen(false); setDrawingEnabled(false); }}
              className={"hidden h-10 w-10 place-items-center rounded-xl border transition-colors sm:grid " + (settingsOpen ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]")}
            >
              <Settings size={18} />
            </button>
            <div
              role="timer"
              aria-label="Tiempo restante del ensayo"
              className="ml-1 inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-[11px] font-extrabold tabular-nums sm:px-3"
            >
              <Clock3 size={14} className={seconds < 600 ? "text-rose-500" : "text-[var(--primary)]"} />
              <span className={seconds < 600 ? "text-rose-500" : "text-[var(--text)]"}>{formatTime(seconds)}</span>
            </div>
          </div>
        </div>

        <div role="progressbar" aria-label="Avance por el ensayo" aria-valuemin={0} aria-valuemax={QUESTIONS.length} aria-valuenow={index + 1} className="h-0.5 bg-[var(--surface-3)]">
          <div className="h-full bg-[var(--primary)] transition-[width] duration-200" style={{ width: ((index + 1) / QUESTIONS.length) * 100 + "%" }} />
        </div>

        {drawingEnabled && (
          <div className="absolute right-3 top-[calc(100%+7px)] z-40 flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 shadow-lg sm:right-6">
            <button type="button" onClick={() => setDrawingTool("pen")} aria-label="Dibujar" aria-pressed={drawingTool === "pen"}
              className={"grid h-8 w-8 place-items-center rounded-lg " + (drawingTool === "pen" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "hover:bg-[var(--surface-2)]")}>
              <Pencil size={16} />
            </button>
            <button type="button" onClick={() => setDrawingTool("eraser")} aria-label="Borrar trazo" aria-pressed={drawingTool === "eraser"}
              className={"grid h-8 w-8 place-items-center rounded-lg " + (drawingTool === "eraser" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "hover:bg-[var(--surface-2)]")}>
              <Eraser size={16} />
            </button>
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--border)]" />
            {(["#2563eb", "#e11d48", "#16a34a", "#f97316", "#111827"] as const).map((ink) => (
              <button key={ink} type="button" title={ink} aria-label={"Color de tinta " + ink}
                aria-pressed={drawingColor === ink && drawingTool === "pen"}
                onClick={() => { setDrawingColor(ink); setDrawingTool("pen"); }}
                className={"grid h-8 w-8 place-items-center rounded-lg border " + (drawingColor === ink && drawingTool === "pen" ? "border-[var(--primary)] ring-1 ring-[var(--primary)]" : "border-transparent hover:border-[var(--border)]")}>
                <span className="h-4 w-4 rounded-full border border-slate-400/40" style={{ backgroundColor: ink }} />
              </button>
            ))}
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--border)]" />
            <button type="button" onClick={() => updateStrokes(inkStrokes.slice(0, -1))} disabled={!inkStrokes.length} title="Deshacer trazo" aria-label="Deshacer trazo"
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)] disabled:opacity-30"><RotateCcw size={16} /></button>
            <button type="button" onClick={() => updateStrokes([])} disabled={!inkStrokes.length} title="Borrar trazos" aria-label="Borrar todos los trazos"
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)] disabled:opacity-30"><Trash2 size={16} /></button>
            <span className="hidden text-[10px] text-[var(--muted)] md:inline">Cierra el lápiz para responder</span>
          </div>
        )}

        {(paletteOpen || settingsOpen) && (
          <button type="button" aria-label="Cerrar panel" className="fixed inset-0 z-30 cursor-default" onClick={() => { setPaletteOpen(false); setSettingsOpen(false); }} />
        )}
        {paletteOpen && (
          <section role="dialog" aria-modal="false" aria-label="Mapa del ensayo" className="absolute right-3 top-[calc(100%+9px)] z-40 max-h-[min(76dvh,690px)] w-[min(440px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:right-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-extrabold">Mapa de preguntas</h2>
              <button type="button" onClick={() => setPaletteOpen(false)} aria-label="Cerrar mapa" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)]"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
              <div className="rounded-lg bg-emerald-500/10 px-1 py-2 text-emerald-600 dark:text-emerald-400">{answered} respondidas</div>
              <div className="rounded-lg bg-amber-500/10 px-1 py-2 text-amber-600 dark:text-amber-400">{markedCount} marcadas</div>
              <div className="rounded-lg bg-[var(--surface-2)] px-1 py-2 text-[var(--muted)]">{pendingCount} pendientes</div>
            </div>
            <div className="mt-3 grid grid-cols-10 gap-1.5">
              {QUESTIONS.map((item, i) => {
                const active = i === index;
                const hasAnswer = answers[i] !== null;
                const marked = flagged[i];
                const tone = active ? "border-orange-500 bg-[var(--primary-soft)] text-[var(--primary)] ring-2 ring-orange-500/30"
                  : marked ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                  : hasAnswer ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]";
                return (
                  <button type="button" key={item.number} onClick={() => { goToQuestion(i); setPaletteOpen(false); }}
                    aria-label={"Ir a pregunta " + item.number + (marked ? ", marcada" : hasAnswer ? ", respondida" : ", pendiente")}
                    aria-current={active ? "step" : undefined}
                    className={"aspect-square min-w-0 rounded-md border text-[10px] font-extrabold transition-colors hover:border-[var(--primary)] " + tone}>
                    {item.number}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] leading-4 text-[var(--muted)]">Puedes cambiar de pregunta sin perder tus respuestas. Las marcadas se destacan en amarillo.</p>
            <button type="button" onClick={() => { setPaletteOpen(false); setConfirmFinish(true); }}
              className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-extrabold hover:border-[var(--primary)]">
              <Trophy size={15} /> Finalizar ensayo
            </button>
          </section>
        )}
        {settingsOpen && (
          <section role="group" aria-label="Apariencia de la hoja" className="absolute right-3 top-[calc(100%+9px)] z-40 w-[min(300px,calc(100vw-24px))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:right-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-extrabold">Apariencia de la hoja</h2>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Cerrar ajustes" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)]"><X size={16} /></button>
            </div>
            {([
              { value: "auto", title: "Según PAESSED" },
              { value: "light", title: "Hoja clara" },
              { value: "dark", title: "Hoja oscura" },
            ] as const).map((item) => (
              <button type="button" key={item.value} onClick={() => changePaperTheme(item.value)}
                aria-pressed={paperTheme === item.value}
                className={"mb-1 flex min-h-10 w-full items-center justify-between rounded-xl border px-3 text-left text-[11px] font-bold " + (paperTheme === item.value ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:bg-[var(--surface-2)]")}>
                {item.title}
                {paperTheme === item.value && <Check size={15} className="text-[var(--primary)]" />}
              </button>
            ))}
          </section>
        )}
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1460px] flex-1 flex-col p-2 sm:p-4" aria-label="Pregunta del ensayo">
        <article style={paperStyle} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-[var(--pg-border)] bg-[var(--pg-bg)] text-[var(--pg-fg)]">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--pg-border)] px-4 py-2 sm:px-7 sm:py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[var(--pg-soft)] px-2 py-1 text-[11px] font-bold text-[var(--pg-fg)]">N.º {q.number}</span>
              <span className="hidden rounded-md border border-[var(--pg-border)] px-2 py-1 text-[11px] font-medium text-[var(--pg-muted)] sm:inline">Ensayo de práctica</span>
              {flagged[index] && <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-600"><Flag size={12} fill="currentColor" /> Marcada</span>}
            </div>
            <span className="max-w-full truncate text-right text-[11px] font-medium text-[var(--pg-muted)]">
              {q.domain} · {getM1Unit(q.unitId)?.name}
            </span>
          </div>

          <div ref={paperScrollRef} key={q.number} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-9 sm:py-5 lg:px-12">
            <div className="relative flex min-h-full flex-col">
              <h2 style={QUESTION_FONT} className="max-w-[1060px] whitespace-pre-line text-[18px] font-normal leading-[1.55] text-[var(--pg-fg)] sm:text-[21px]">
                {q.prompt}
              </h2>
              <div role="group" aria-label="Alternativas de respuesta" className="mt-auto flex max-w-[1060px] flex-col items-start gap-1.5 pt-4 sm:pt-6">
                {q.options.map((option, optionIndex) => {
                  const active = answers[index] === optionIndex;
                  const letter = String.fromCharCode(65 + optionIndex);
                  return (
                    <button type="button" key={letter} aria-pressed={active} onClick={() => setAnswers((previous) => previous.map((value, i) => i === index ? optionIndex : value))}
                      className={"inline-flex min-h-[34px] w-fit max-w-full min-w-[72px] items-start gap-2 rounded-md border px-2.5 py-1 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:min-h-[36px] sm:px-3 " + (active ? "border-[var(--primary)] bg-[var(--pg-selected)] ring-1 ring-[var(--primary)]" : "border-[var(--pg-border)] bg-[var(--pg-option)] hover:border-[var(--primary)] hover:bg-[var(--pg-option-hover)]")}>
                      <span style={QUESTION_FONT} className="shrink-0 text-[15px] font-semibold leading-6 text-[var(--pg-fg)] sm:text-[16px]">{letter})</span>
                      <span style={QUESTION_FONT} className="min-w-0 break-words text-[15px] leading-6 text-[var(--pg-fg)] sm:text-[16px]">{option}</span>
                    </button>
                  );
                })}
              </div>
              <PlaygroundScratchpad key={index} enabled={drawingEnabled} mode={drawingTool} color={drawingColor} strokes={inkStrokes} onChange={updateStrokes} />
            </div>
          </div>

          <footer className="shrink-0 border-t border-[var(--pg-border)] bg-[var(--pg-footer)] px-3 py-2.5 sm:px-7 sm:py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => goToQuestion(index - 1)} disabled={index === 0}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--pg-border)] bg-[var(--pg-option)] px-3 text-[11px] font-bold text-[var(--pg-fg)] transition-colors hover:bg-[var(--pg-option-hover)] disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft size={16} /> Anterior
              </button>
              <span className="hidden text-[10px] font-semibold text-[var(--pg-muted)] sm:inline">Pregunta {index + 1} de {QUESTIONS.length}</span>
              <div className="ml-auto flex items-center gap-2">
                {index < QUESTIONS.length - 1 ? (
                  <button type="button" onClick={() => goToQuestion(index + 1)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--pg-border)] bg-[var(--pg-option)] px-4 text-[11px] font-bold text-[var(--pg-fg)] transition-colors hover:bg-[var(--pg-option-hover)]">
                    Siguiente <ChevronRight size={16} />
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirmFinish(true)}
                    className="tactile-primary inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 text-[11px] font-bold">
                    <Trophy size={16} /> Finalizar ensayo
                  </button>
                )}
              </div>
            </div>
          </footer>
        </article>
      </main>

      {confirmFinish && (
        <div role="presentation" className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/65 px-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmFinish(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="exam-finish-title" className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="exam-finish-title" className="text-lg font-extrabold">¿Finalizar el ensayo?</h2>
              <button type="button" onClick={() => setConfirmFinish(false)} aria-label="Volver al ensayo" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)]"><X size={17} /></button>
            </div>
            <p className="mt-3 text-[12px] leading-5 text-[var(--muted)]">
              Llevas {answered} de {QUESTIONS.length} preguntas respondidas. {pendingCount} quedarán omitidas. Puedes seguir revisando tus respuestas antes de entregar.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmFinish(false)} className="soft-button min-h-10 rounded-xl px-4 text-[11px] font-bold">Seguir respondiendo</button>
              <button type="button" onClick={finish} className="tactile-primary min-h-10 rounded-xl px-4 text-[11px] font-extrabold">Entregar ensayo</button>
            </div>
          </section>
        </div>
      )}
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
