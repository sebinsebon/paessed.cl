"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Bookmark, Check, Eraser, Grid3X3, Pencil, RotateCcw, Settings, Trash2, X } from "lucide-react";
import { PaessedBlocks } from "@/components/paessed-blocks";
import { PlaygroundScratchpad, type PlaygroundInkStroke } from "@/components/playground-scratchpad";
import { useDrawingTools } from "@/components/use-drawing-tools";
import { M1_AXES, getM1Unit } from "@/lib/m1-curriculum";
import { QUESTION_PAPER_FONT, readQuestionPaperTheme, saveQuestionPaperTheme, type QuestionPaperTheme } from "@/lib/question-paper";
import type { LearningQuestion } from "@/lib/learning/types";
import { useLearningQuestion } from "./use-learning-question";
import { LearningError, LearningLoading } from "./question-card";
import { QuestionWorkspace } from "./workspace/question-workspace";
import { PostErrorAiHelp } from "./ai/post-error-ai-help";

const SAVED_QUESTIONS = "paessed-playground-saved-questions";
const INKS = ["#2563eb", "#e11d48", "#16a34a", "#f97316", "#111827"] as const;
const THEMES = [{ value: "auto", title: "Según PAESSED" }, { value: "light", title: "Hoja clara" }, { value: "dark", title: "Hoja oscura" }] as const;
type Step = { number: number; answered: boolean; current: boolean };

// Exact sheet palette used by Ensayos and Playground, independent of app theme.
function paperStyle(theme: QuestionPaperTheme): CSSProperties {
  const p = theme === "dark"
    ? { bg: "#111827", fg: "#f8fafc", muted: "#94a3b8", border: "#334155", soft: "#1e293b", option: "#1a2536", optionHover: "#25344b", selected: "#3b261b", good: "#093d30", bad: "#441e2a", footer: "#151d2c" }
    : theme === "light"
      ? { bg: "#ffffff", fg: "#111827", muted: "#64748b", border: "#e2e8f0", soft: "#f1f5f9", option: "#f8fafc", optionHover: "#fff7ed", selected: "#fff7ed", good: "#ecfdf5", bad: "#fff1f2", footer: "#fcfcfd" }
      : { bg: "var(--surface)", fg: "var(--text)", muted: "var(--muted)", border: "var(--border)", soft: "var(--surface-2)", option: "var(--surface-2)", optionHover: "var(--surface-3)", selected: "var(--primary-soft)", good: "color-mix(in srgb, #10b981 14%, var(--surface))", bad: "color-mix(in srgb, #ef4444 14%, var(--surface))", footer: "var(--surface)" };
  return { "--pg-bg": p.bg, "--pg-fg": p.fg, "--pg-muted": p.muted, "--pg-border": p.border, "--pg-soft": p.soft, "--pg-option": p.option, "--pg-option-hover": p.optionHover, "--pg-selected": p.selected, "--pg-good": p.good, "--pg-bad": p.bad, "--pg-footer": p.footer } as CSSProperties;
}

function readSavedIds(): string[] {
  const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_QUESTIONS) ?? "[]");
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
}

export function LearningQuestionWorkspace({ meta, scratchpadKey, selected, checkedAnswer, onSelect, locked, revealSolution, onReady, number, total, progress, progressMax, subtitle, onClose, busy, footer, notices, steps, showAiHelp, onAiHelp }: {
  meta: LearningQuestion; scratchpadKey: string; selected: string; checkedAnswer?: string; onSelect: (answer: string) => void; locked: boolean; revealSolution: boolean; onReady: (ready: boolean) => void;
  number: number; total: number; progress: number; progressMax: number; subtitle: string; onClose: () => void; busy: boolean;
  footer: (drawing: boolean, aiHelp: ReactNode) => ReactNode; notices?: ReactNode; steps: Step[];
  showAiHelp: boolean; onAiHelp: () => void;
}) {
  const { content, resourceUrls, error, ready, retry } = useLearningQuestion(meta, onReady);
  const drawing = useDrawingTools();
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState<string>(INKS[0]);
  const [strokes, setStrokes] = useState<PlaygroundInkStroke[]>([]);
  const [theme, setTheme] = useState<QuestionPaperTheme>("light");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [storageError, setStorageError] = useState("");
  const stemRef = useRef<HTMLDivElement>(null);
  const inkKey = `paessed-learning-ink:${scratchpadKey}`;
  useEffect(() => {
    if (ready) stemRef.current?.focus({ preventScroll: true });
  }, [ready]);

  useEffect(() => {
    setTheme(readQuestionPaperTheme());
    try {
      const value: unknown = JSON.parse(localStorage.getItem(inkKey) ?? "[]");
      setStrokes(Array.isArray(value) ? value.filter((stroke): stroke is PlaygroundInkStroke => !!stroke && typeof stroke === "object" && typeof stroke.color === "string" && Array.isArray(stroke.points) && stroke.points.every((point: { x?: unknown; y?: unknown }) => typeof point?.x === "number" && typeof point?.y === "number")) : []);
    } catch { setStrokes([]); }
    const syncSaved = () => {
      try { setSaved(readSavedIds().includes(meta.id)); }
      catch { setStorageError("No se pudieron leer tus preguntas guardadas."); }
    };
    syncSaved();
    const onStorage = (event: StorageEvent) => { if (event.key === SAVED_QUESTIONS) syncSaved(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [inkKey, meta.id]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMapOpen(false);
      setSettingsOpen(false);
      drawing.setDrawingEnabled(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [drawing.setDrawingEnabled]);

  const updateStrokes = (next: PlaygroundInkStroke[]) => {
    setStrokes(next);
    try { localStorage.setItem(inkKey, JSON.stringify(next)); setStorageError(""); }
    catch { setStorageError("No se pudieron guardar tus trazos. Las respuestas se guardan por separado."); }
  };
  const toggleSaved = () => {
    try {
      const ids = readSavedIds();
      const next = ids.includes(meta.id) ? ids.filter(id => id !== meta.id) : [...ids, meta.id];
      localStorage.setItem(SAVED_QUESTIONS, JSON.stringify(next));
      setSaved(next.includes(meta.id));
      setStorageError("");
    } catch { setStorageError("No se pudo guardar la pregunta en este navegador."); }
  };
  const buttonTone = (active: boolean) => "grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors " + (active ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--pg-border)] bg-[var(--pg-bg)] text-[var(--pg-fg)] hover:bg-[var(--pg-soft)]");
  const question = content?.question;
  const aiHelp = question ? <PostErrorAiHelp visible={showAiHelp} disabled={!ready || busy || drawing.drawingEnabled} onHelp={onAiHelp} question={{
    number: question.number,
    stem: question.stemBlocks ?? question.stem,
    options: question.options.map((option, index) => ({ label: question.optionLabels?.[index] ?? String.fromCharCode(65 + index), content: question.optionBlocks?.[index] ?? option })),
  }} /> : null;

  const tools = <>
    <button type="button" aria-label={drawing.drawingButtonLabel} title={drawing.drawingButtonLabel} aria-pressed={drawing.drawingEnabled} aria-expanded={drawing.drawingMenuOpen} onClick={() => { setMapOpen(false); setSettingsOpen(false); drawing.toggleDrawing(); }} className={buttonTone(drawing.drawingEnabled)}><Pencil size={18} /></button>
    <button type="button" aria-label={saved ? "Quitar pregunta de guardadas" : "Guardar esta pregunta"} title={saved ? "Quitar pregunta de guardadas" : "Guardar pregunta"} aria-pressed={saved} onClick={toggleSaved} className={buttonTone(saved)}><Bookmark size={18} fill={saved ? "currentColor" : "none"} /></button>
    <button type="button" aria-label="Abrir mapa de preguntas" title="Mapa de preguntas" aria-expanded={mapOpen} onClick={() => { setMapOpen(value => !value); setSettingsOpen(false); drawing.setDrawingEnabled(false); }} className={buttonTone(mapOpen)}><Grid3X3 size={18} /></button>
    <button type="button" aria-label="Ajustes de apariencia de la hoja" title="Ajustes de la hoja" aria-expanded={settingsOpen} onClick={() => { setSettingsOpen(value => !value); setMapOpen(false); drawing.setDrawingEnabled(false); }} className={buttonTone(settingsOpen)}><Settings size={18} /></button>
  </>;
  const panels = <>
    {drawing.drawingMenuOpen && <div role="group" aria-label="Herramientas de dibujo" className="absolute right-3 top-[calc(100%+7px)] z-40 flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[var(--text)] shadow-lg sm:right-6">
      <button type="button" aria-label="Dibujar" aria-pressed={tool === "pen"} onClick={() => setTool("pen")} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)]"><Pencil size={16} /></button>
      <button type="button" aria-label="Borrar trazo" aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)]"><Eraser size={16} /></button>
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--border)]" />
      {INKS.map(ink => <button type="button" key={ink} aria-label={`Color de tinta ${ink}`} aria-pressed={color === ink && tool === "pen"} title={ink} onClick={() => { setColor(ink); setTool("pen"); }} className={`grid h-8 w-8 place-items-center rounded-lg border ${color === ink && tool === "pen" ? "border-[var(--primary)] ring-1 ring-[var(--primary)]" : "border-transparent hover:border-[var(--border)]"}`}><span className="h-4 w-4 rounded-full border border-slate-400/40" style={{ backgroundColor: ink }} /></button>)}
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--border)]" />
      <button type="button" aria-label="Deshacer último trazo" title="Deshacer trazo" disabled={!strokes.length} onClick={() => updateStrokes(strokes.slice(0, -1))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)] disabled:opacity-30"><RotateCcw size={16} /></button>
      <button type="button" aria-label="Borrar todos los trazos" title="Borrar trazos" disabled={!strokes.length} onClick={() => updateStrokes([])} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)] disabled:opacity-30"><Trash2 size={16} /></button>
      <span className="hidden text-[10px] text-[var(--muted)] sm:inline">Cierra el lápiz para responder</span>
    </div>}
    {(settingsOpen || mapOpen) && <button type="button" aria-label="Cerrar panel" className="fixed inset-0 z-30 cursor-default" onClick={() => { setSettingsOpen(false); setMapOpen(false); }} />}
    {settingsOpen && <section role="group" aria-label="Apariencia de la hoja" className="absolute right-3 top-[calc(100%+9px)] z-40 w-[min(340px,calc(100vw-24px))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-xl sm:right-6">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-[13px] font-extrabold">Apariencia de la hoja</h2><button type="button" aria-label="Cerrar ajustes" onClick={() => setSettingsOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)]"><X size={16} /></button></div>
      {THEMES.map(item => <button type="button" key={item.value} aria-pressed={theme === item.value} onClick={() => { setTheme(item.value); saveQuestionPaperTheme(item.value); setSettingsOpen(false); }} className={`mb-1 flex min-h-10 w-full items-center justify-between rounded-xl border px-3 text-left text-[11px] font-bold ${theme === item.value ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:bg-[var(--surface-2)]"}`}>{item.title}{theme === item.value && <Check size={15} className="text-[var(--primary)]" />}</button>)}
    </section>}
    {mapOpen && <section role="dialog" aria-modal="false" aria-label="Mapa de preguntas del nodo" className="absolute right-3 top-[calc(100%+9px)] z-40 w-[min(340px,calc(100vw-24px))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-xl sm:right-6">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-[13px] font-extrabold">Mapa de preguntas</h2><button type="button" aria-label="Cerrar mapa" onClick={() => setMapOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)]"><X size={16} /></button></div>
      <div className="grid grid-cols-5 gap-2">{steps.map(step => <span key={step.number} aria-current={step.current ? "step" : undefined} aria-label={`Pregunta ${step.number}, ${step.current ? "actual" : step.answered ? "respondida" : "pendiente"}`} className={`grid h-10 place-items-center rounded-md border text-xs font-extrabold ${step.current ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : step.answered ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"}`}>{step.number}</span>)}</div>
      <p className="mt-3 text-[10px] leading-4 text-[var(--muted)]">{steps.filter(step => step.answered).length}/{total} respondidas. Completa la pregunta actual para continuar.</p>
    </section>}
  </>;
  return <QuestionWorkspace number={number} total={total} axis={M1_AXES.find(axis => axis.id === meta.axisId)?.name ?? meta.axisId} topic={getM1Unit(meta.unitId)?.name} subtitle={subtitle} progress={progress} progressMax={progressMax} onClose={onClose} closeDisabled={busy} tools={tools} panels={panels} footer={footer(drawing.drawingEnabled, aiHelp)} paperStyle={paperStyle(theme)} contentKey={meta.id}>
    {notices}
    {storageError && <p role="alert" className="mb-3 max-w-[1060px] text-xs text-rose-500">{storageError}</p>}
    {error ? <LearningError message={error} retry={retry} /> : !question || !ready ? <LearningLoading label="Cargando la pregunta original…" /> : <>
      <div ref={stemRef} tabIndex={-1} data-testid="learning-paper-stem" style={QUESTION_PAPER_FONT} className="max-w-[1060px] text-[18px] leading-[1.55] text-[var(--pg-fg)] focus:outline-none sm:text-[21px]">{question.stemBlocks?.length ? <PaessedBlocks blocks={question.stemBlocks} assetUrls={resourceUrls.byId} /> : <p className="whitespace-pre-line">{question.stem}</p>}</div>
      <div role="radiogroup" aria-label="Alternativas" className="flex max-w-[1060px] flex-col items-start gap-1.5 pt-5 sm:pt-7">
        {question.options.map((option, index) => {
          const letter = question.optionLabels?.[index] || String.fromCharCode(65 + index);
          const correct = !!checkedAnswer && letter === meta.correct;
          const incorrect = !!checkedAnswer && letter === checkedAnswer && !correct;
          const tone = correct ? "border-emerald-500 bg-[var(--pg-good)] ring-1 ring-emerald-500" : incorrect ? "border-rose-500 bg-[var(--pg-bad)] ring-1 ring-rose-500" : selected === letter ? "border-[var(--primary)] bg-[var(--pg-selected)] ring-1 ring-[var(--primary)]" : "border-[var(--pg-border)] bg-[var(--pg-option)] hover:border-[var(--primary)] hover:bg-[var(--pg-option-hover)]";
          return <button key={letter} type="button" role="radio" aria-checked={selected === letter} data-answer-status={correct ? "correct" : incorrect ? "incorrect" : "neutral"} disabled={locked || drawing.drawingEnabled} onClick={() => onSelect(letter)} onKeyDown={event => {
            if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? question.options.length - 1 : (index + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : question.options.length - 1)) % question.options.length;
            onSelect(question.optionLabels?.[next] || String.fromCharCode(65 + next));
            (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
          }} className={`inline-flex min-h-[34px] w-fit max-w-full min-w-[72px] cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-default sm:min-h-[36px] sm:px-3 ${tone}`}>
            <span style={QUESTION_PAPER_FONT} className="shrink-0 text-[15px] font-semibold leading-6 text-[var(--pg-fg)] sm:text-[16px]">{letter})</span>
            <div style={QUESTION_PAPER_FONT} className="min-w-0 break-words text-[15px] leading-6 text-[var(--pg-fg)] sm:text-[16px]">{question.optionBlocks?.[index]?.length ? <PaessedBlocks blocks={question.optionBlocks[index]!} assetUrls={resourceUrls.byId} /> : option}</div>
            {correct && <Check size={17} aria-label="Alternativa correcta" className="ml-auto mt-1 shrink-0 text-emerald-600" />}
            {incorrect && <X size={17} aria-label="Respuesta incorrecta" className="ml-auto mt-1 shrink-0 text-rose-500" />}
          </button>;
        })}
      </div>
      {revealSolution && <section aria-label="Revisión de la solución" className="mt-4 max-w-[1060px] rounded-lg border border-emerald-500/50 bg-[var(--pg-good)] px-4 py-3 text-[12px] leading-5 text-[var(--pg-fg)] sm:text-[13px]">
        <p className="font-extrabold">Alternativa correcta: {meta.correct}</p>
        {question.explanationBlocks?.length || question.explanation ? <><p className="mt-2 text-xs font-bold text-[var(--pg-muted)]">{question.explanationStatus === "verified" ? "Explicación verificada" : "Explicación provisional · pendiente de revisión docente"}</p><div className="mt-1" style={QUESTION_PAPER_FONT}>{question.explanationBlocks?.length ? <PaessedBlocks blocks={question.explanationBlocks} assetUrls={resourceUrls.byId} /> : question.explanation}</div></> : <p className="mt-2">El banco contiene la clave verificada, pero todavía no una explicación. Revisa tu procedimiento antes de continuar.</p>}
      </section>}
      <PlaygroundScratchpad enabled={drawing.drawingEnabled} mode={tool} color={color} strokes={strokes} onChange={updateStrokes} onInteractionStart={drawing.hideDrawingTools} />
    </>}
  </QuestionWorkspace>;
}
