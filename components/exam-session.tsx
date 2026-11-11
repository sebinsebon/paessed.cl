"use client";

import { AiHelpSettings,AskAiButton,useAiSettings } from "@/components/ask-ai";
import { ExternalQuestionWorkspace } from "@/components/learning/workspace/external-question-workspace";
import { QuestionDialog } from "@/components/learning/workspace/question-dialog";
import { usePersistentAppShell } from "@/components/persistent-app-shell";
import { type PlaygroundInkStroke } from "@/components/playground-scratchpad";
import { clearDemoExamProgress,DEMO_EXAM_DURATION_SECONDS,readDemoExamProgress,writeDemoExamProgress } from "@/lib/demo-exam-progress";
import { getM1Unit,type M1UnitId } from "@/lib/m1-curriculum";
import type { BankQuestion } from "@/lib/playground-imports";
import { readQuestionPaperTheme } from "@/lib/question-paper";
import {
ArrowLeft,ArrowRight,Check,ChevronLeft,
Trophy
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties } from "react";

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
export function ExamSession({ sourceId, sourceTitle = "Ensayo M1 de práctica" }: { sourceId?: string; sourceTitle?: string }) {
  const router = useRouter();
  const { setImmersiveView, registerImmersiveToggle } = usePersistentAppShell();
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // Matches the same persistent sidebar/toggle used by Playground practice.
  useLayoutEffect(() => registerImmersiveToggle(() => setSidebarVisible((open) => !open)), [registerImmersiveToggle]);
  useLayoutEffect(() => {
    setImmersiveView(true, sidebarVisible);
    return () => setImmersiveView(false, false);
  }, [setImmersiveView, sidebarVisible]);
  // Avoid exposing the app's dark scrollbar gutter beside the full-screen paper.
  useEffect(() => {
    const previousGutter = document.documentElement.style.scrollbarGutter;
    document.documentElement.style.scrollbarGutter = "auto";
    return () => { document.documentElement.style.scrollbarGutter = previousGutter; };
  }, []);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>(() => Array(QUESTIONS.length).fill(null));
  const [flagged, setFlagged] = useState<boolean[]>(() => Array(QUESTIONS.length).fill(false));
  const [seconds, setSeconds] = useState(DEMO_EXAM_DURATION_SECONDS);
  const [restored, setRestored] = useState(false);
  const [inkSessionId, setInkSessionId] = useState("");
  const inkSessionKey = `paessed-demo-ink-session:${sourceId ?? "practice"}`;
  const finishedRef = useRef(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [paperTheme, setPaperTheme] = useState<"auto" | "light" | "dark">("light");
  const { aiSettings, updateAiSettings } = useAiSettings();
  const [strokesByQuestion, setStrokesByQuestion] = useState<Record<number, PlaygroundInkStroke[]>>({});
  const q = QUESTIONS[index];
  const answered = answers.filter((value) => value !== null).length;
  const pendingCount = QUESTIONS.length - answered;
  const inkStrokes = strokesByQuestion[index] ?? [];

  // Restore before paint and before autosave. Keep the shared title in the
  // initial route tree so React can pair it with the clicked essay card.
  useLayoutEffect(() => {
    const saved = readDemoExamProgress();
    let nextInkSessionId = crypto.randomUUID();
    try {
      if (saved) nextInkSessionId = localStorage.getItem(inkSessionKey) || nextInkSessionId;
      localStorage.setItem(inkSessionKey, nextInkSessionId);
    } catch { /* The sheet reports persistence failures and keeps its ink in memory. */ }
    setInkSessionId(nextInkSessionId);
    if (saved) {
      setIndex(saved.questionIndex);
      setAnswers(saved.answers);
      setFlagged(saved.flagged);
      setSeconds(saved.secondsLeft);
      setStrokesByQuestion(saved.strokesByQuestion);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [restored]);

  const saveProgress = useCallback(() => {
    if (!restored || finishedRef.current) return;
    writeDemoExamProgress({
      version: 1,
      questionIndex: index,
      answers,
      flagged,
      secondsLeft: seconds,
      strokesByQuestion,
      savedAt: Date.now(),
    });
  }, [restored, index, answers, flagged, seconds, strokesByQuestion]);

  useEffect(() => { saveProgress(); }, [saveProgress]);

  useEffect(() => {
    setPaperTheme(readQuestionPaperTheme());
  }, []);

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
    finishedRef.current = true;
    clearDemoExamProgress();
    try { localStorage.removeItem(inkSessionKey); } catch { /* A new empty exam gets a fresh identity even if removal fails. */ }
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
  const bankQuestion: BankQuestion = {
    id: `demo-exam:${sourceId ?? "practice"}:${index + 1}`, number: index + 1,
    year: null, collection: sourceTitle, sourceId: sourceId ?? "demo", axis: q.domain,
    topic: getM1Unit(q.unitId)?.name ?? q.domain, unitId: q.unitId,
    stem: q.prompt, options: q.options, correct: String.fromCharCode(65 + q.answer), explanation: "",
  };
  return <>
    <ExternalQuestionWorkspace key={bankQuestion.id} question={bankQuestion} assetUrls={new Map()} ready={restored}
      context="exam" sessionKey={`demo-exam:${inkSessionId}`} number={index + 1} total={QUESTIONS.length}
      subtitle={`${sourceTitle} · ${answered}/${QUESTIONS.length} respondidas`}
      selected={answers[index] === null ? "" : String.fromCharCode(65 + answers[index]!)}
      onSelect={answer => setAnswers(previous => previous.map((value, position) => position === index ? answer ? answer.charCodeAt(0) - 65 : null : value))}
      locked={!restored} onClose={() => { saveProgress(); router.push("/app/ensayos"); }}
      initialStrokes={inkStrokes} onStrokesChange={updateStrokes}
      steps={QUESTIONS.map((_, position) => ({ number: position + 1, answered: answers[position] !== null, current: position === index }))}
      renderAiHelp={onOpenChange => <AskAiButton onOpenChange={onOpenChange} settings={aiSettings} onChange={updateAiSettings} question={{ number: index + 1, stem: q.prompt, options: q.options.map((content, position) => ({ label: String.fromCharCode(65 + position), content })) }} />}
      tools={<div className="space-y-3">
        <p className="text-sm font-semibold">Tiempo restante: {formatTime(seconds)}</p>
        <label className="block text-sm font-bold">Ir a pregunta<select aria-label="Ir a pregunta" value={index} onChange={event => goToQuestion(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--pg-border)] bg-[var(--pg-bg)] px-3 text-base">{QUESTIONS.map((_, position) => <option key={position} value={position}>{position + 1}{answers[position] !== null ? " · respondida" : ""}{flagged[position] ? " · marcada" : ""}</option>)}</select></label>
        <button type="button" className="min-h-11 w-full rounded-lg border border-[var(--pg-border)] px-3 text-left text-base" aria-pressed={flagged[index]} onClick={toggleFlag}>{flagged[index] ? "Quitar marca de revisión" : "Marcar para revisar"}</button>
        <AiHelpSettings settings={aiSettings} onChange={updateAiSettings} />
        <button type="button" className="tactile-primary min-h-12 w-full rounded-xl px-4 font-bold" onClick={() => setConfirmFinish(true)}>Finalizar ensayo</button>
      </div>}
      footer={(drawing, aiHelp) => <div className="flex w-full flex-wrap items-center gap-2">
        {aiHelp}
        <button type="button" disabled={index === 0 || drawing} onClick={() => goToQuestion(index - 1)} className="min-h-12 rounded-xl border border-[var(--pg-border)] px-3 font-bold disabled:opacity-40" aria-label="Pregunta anterior"><ChevronLeft size={20} /></button>
        <button type="button" disabled={drawing} className="tactile-primary min-h-12 flex-1 rounded-xl px-4 font-bold disabled:opacity-40" onClick={() => index < QUESTIONS.length - 1 ? goToQuestion(index + 1) : setConfirmFinish(true)}>{index < QUESTIONS.length - 1 ? "Siguiente" : "Finalizar ensayo"}</button>
      </div>}
    />
    {confirmFinish && <QuestionDialog title="¿Finalizar el ensayo?" onClose={() => setConfirmFinish(false)} paperStyle={paperStyle} wide>
      <p className="text-base leading-relaxed">Llevas {answered} de {QUESTIONS.length} preguntas respondidas. {pendingCount} quedarán omitidas. Puedes seguir revisando tus respuestas antes de entregar.</p>
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => setConfirmFinish(false)} className="soft-button min-h-12 rounded-xl px-4 font-bold">Seguir respondiendo</button><button type="button" onClick={finish} className="tactile-primary min-h-12 rounded-xl px-4 font-bold">Entregar ensayo</button></div>
    </QuestionDialog>}
  </>;

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
