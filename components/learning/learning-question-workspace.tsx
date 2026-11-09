"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Bookmark, Check, Clock, Eraser, Grid3X3, Info, Menu, Move, Pencil, RotateCcw, Settings, Trash2, X, ZoomIn } from "lucide-react";
import { PaessedBlocks } from "@/components/paessed-blocks";
import { useDrawingTools } from "@/components/use-drawing-tools";
import { M1_AXES, getM1Unit } from "@/lib/m1-curriculum";
import { QUESTION_PAPER_FONT, readQuestionPaperTheme, saveQuestionPaperTheme, type QuestionPaperTheme } from "@/lib/question-paper";
import type { LearningQuestion } from "@/lib/learning/types";
import { useLearningQuestion } from "./use-learning-question";
import { LearningError, LearningLoading } from "./question-card";
import { QuestionWorkspace } from "./workspace/question-workspace";
import { PostErrorAiHelp } from "./ai/post-error-ai-help";
import { AdaptiveAlternatives } from "./workspace/adaptive-alternatives";
import { QuestionDialog } from "./workspace/question-dialog";
import { LearningInkSheet, type LearningInkControls } from "./workspace/learning-ink-sheet";
import { useQuestionTimer } from "./workspace/use-question-timer";
import styles from "./workspace/mobile-question.module.css";

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

export function LearningQuestionWorkspace({ meta, scratchpadKey, timerKey, selected, checkedAnswer, onSelect, locked, revealSolution, onReady, number, total, progress, progressMax, subtitle, onClose, busy, footer, feedback, notices, steps, showAiHelp, onAiHelp }: {
  meta: LearningQuestion; scratchpadKey: string; timerKey?: string; selected: string; checkedAnswer?: string; onSelect: (answer: string) => void; locked: boolean; revealSolution: boolean; onReady: (ready: boolean) => void;
  number: number; total: number; progress: number; progressMax: number; subtitle: string; onClose: () => void; busy: boolean;
  footer: (drawing: boolean, aiHelp: ReactNode) => ReactNode; feedback?: ReactNode; notices?: ReactNode; steps: Step[];
  showAiHelp: boolean; onAiHelp: () => void;
}) {
  const { content, resourceUrls, error, ready, retry } = useLearningQuestion(meta);
  const drawing = useDrawingTools();
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState<string>(INKS[0]);
  const [theme, setTheme] = useState<QuestionPaperTheme>("light");
  const [panel, setPanel] = useState<"menu" | "appearance" | "map" | "info" | "drawing" | null>(null);
  const [saved, setSaved] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [sheetReady, setSheetReady] = useState(false);
  const [inkLocked, setInkLocked] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [figures, setFigures] = useState<{ src: string; alt: string; width: number }[]>([]);
  const [figure, setFigure] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const stemRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const bodyAiRef = useRef<HTMLDivElement>(null);
  const inkControls = useRef<LearningInkControls>(null);
  const panelTrigger = useRef<HTMLElement | null>(null);
  const pointer = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const timer = useQuestionTimer({ timerKey: timerKey ?? scratchpadKey, ready: ready && sheetReady, paused: busy || aiOpen || panel !== null || figure !== null, frozen: !!checkedAnswer || revealSolution });
  const axis = M1_AXES.find(item => item.id === meta.axisId)?.name ?? meta.axisId;
  const topic = getM1Unit(meta.unitId)?.name;
  useEffect(() => { onReadyRef.current(ready && sheetReady); }, [ready, sheetReady]);
  useEffect(() => {
    if (ready && sheetReady) stemRef.current?.focus({ preventScroll: true });
  }, [ready, sheetReady]);
  useEffect(() => {
    const footerElement = footerRef.current;
    if (!footerElement) return;
    const sync = () => {
      if (!matchMedia("(max-width: 767px)").matches || !showAiHelp) { setNarrow(false); return; }
      const primary = footerElement.querySelector<HTMLButtonElement>("[class*=sessionActions] > button");
      const ai = footerElement.querySelector<HTMLButtonElement>("[data-testid=post-error-ai-help] button") ?? bodyAiRef.current?.querySelector<HTMLButtonElement>("button");
      if (!primary || !ai) return;
      const context = document.createElement("canvas").getContext("2d");
      const requiredWidth = (button: HTMLButtonElement) => {
        const style = getComputedStyle(button);
        if (context) context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const text = button.innerText.trim();
        return (context?.measureText(text).width ?? text.length * 9) + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + (button.querySelector("svg") ? 24 : 0) + 4;
      };
      setNarrow(requiredWidth(primary) + requiredWidth(ai) + 8 > footerElement.clientWidth);
    };
    const observer = new ResizeObserver(sync);
    observer.observe(footerElement);
    const frame = requestAnimationFrame(sync);
    void document.fonts.ready.then(sync);
    window.addEventListener("resize", sync);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", sync); };
  }, [showAiHelp, checkedAnswer, drawing.drawingEnabled]);
  useEffect(() => {
    setTheme(readQuestionPaperTheme());
    const syncSaved = () => {
      try { setSaved(readSavedIds().includes(meta.id)); }
      catch { setStorageError("No se pudieron leer tus preguntas guardadas."); }
    };
    syncSaved();
    const onStorage = (event: StorageEvent) => { if (event.key === SAVED_QUESTIONS) syncSaved(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [meta.id]);
  useEffect(() => {
    if (!sheetReady) return;
    setFigures(Array.from(sheetRef.current?.querySelectorAll<HTMLImageElement>("img") ?? []).map(img => ({ src: img.currentSrc || img.src, alt: img.alt || "Figura del ejercicio", width: img.naturalWidth })));
  }, [sheetReady, content]);
  const toggleSaved = () => {
    try {
      const ids = readSavedIds();
      const next = ids.includes(meta.id) ? ids.filter(id => id !== meta.id) : [...ids, meta.id];
      localStorage.setItem(SAVED_QUESTIONS, JSON.stringify(next));
      setSaved(next.includes(meta.id)); setStorageError("");
    } catch { setStorageError("No se pudo guardar la pregunta en este navegador."); }
  };
  const openDrawing = () => {
    if (drawing.drawingEnabled) drawing.setDrawingEnabled(false);
    else { drawing.setDrawingEnabled(true); setPanel("drawing"); }
  };
  const question = content?.question;
  const aiHelp = question ? <PostErrorAiHelp visible={showAiHelp} disabled={!ready || !sheetReady || busy || drawing.drawingEnabled} onHelp={onAiHelp} onOpenChange={setAiOpen} question={{
    number: question.number, stem: question.stemBlocks ?? question.stem,
    options: question.options.map((option, index) => ({ label: question.optionLabels?.[index] ?? String.fromCharCode(65 + index), content: question.optionBlocks?.[index] ?? option })),
  }} /> : null;
  const buttonTone = (active: boolean) => "grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors " + (active ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--pg-border)] bg-[var(--pg-bg)] text-[var(--pg-fg)] hover:bg-[var(--pg-soft)]");
  const tools = <>
    <button type="button" aria-label={!drawing.drawingEnabled ? "Activar lápiz" : panel === "drawing" ? "Desactivar lápiz" : "Abrir herramientas del lápiz"} aria-pressed={drawing.drawingEnabled} disabled={!sheetReady} onClick={() => { if (drawing.drawingEnabled && panel === "drawing") { drawing.setDrawingEnabled(false); setPanel(null); } else { drawing.setDrawingEnabled(true); setPanel("drawing"); } }} className={buttonTone(drawing.drawingEnabled)}><Pencil size={18} /></button>
    <button type="button" aria-label={saved ? "Quitar pregunta de guardadas" : "Guardar esta pregunta"} aria-pressed={saved} onClick={toggleSaved} className={buttonTone(saved)}><Bookmark size={18} fill={saved ? "currentColor" : "none"} /></button>
    <button type="button" aria-label="Abrir mapa de preguntas" onClick={() => setPanel("map")} className={buttonTone(panel === "map")}><Grid3X3 size={18} /></button>
    <button type="button" aria-label="Ajustes de apariencia de la hoja" onClick={() => setPanel("appearance")} className={buttonTone(panel === "appearance")}><Settings size={18} /></button>
  </>;
  const panels = <>
    {panel && <QuestionDialog returnFocusRef={panelTrigger} title={{ menu: "Herramientas de la pregunta", appearance: "Apariencia de la hoja", map: "Mapa de preguntas del nodo", info: "Información de la pregunta", drawing: "Herramientas de dibujo" }[panel]} onClose={() => setPanel(null)} paperStyle={paperStyle(theme)}>
      {panel === "menu" && <>
        <button type="button" className={styles.menuButton} aria-pressed={saved} onClick={toggleSaved}><Bookmark size={20} />{saved ? "Quitar de guardadas" : "Guardar pregunta"}</button>
        <button type="button" className={styles.menuButton} disabled={!sheetReady} onClick={() => { drawing.setDrawingEnabled(true); setPanel("drawing"); }}><Pencil size={20} />Lápiz sobre la pregunta</button>
        <button type="button" className={styles.menuButton} onClick={() => setPanel("appearance")}><Settings size={20} />Apariencia</button>
        <button type="button" className={styles.menuButton} onClick={() => setPanel("info")}><Info size={20} />Información</button>
        <button type="button" className={styles.menuButton} onClick={() => setPanel("map")}><Grid3X3 size={20} />Mapa de preguntas</button>
        <button type="button" className={styles.menuButton} aria-pressed={timer.enabled} onClick={timer.toggle}><Clock size={20} />{timer.enabled ? "Ocultar cronómetro" : "Mostrar cronómetro"}</button>
      </>}
      {panel === "appearance" && THEMES.map(item => <button type="button" key={item.value} className={styles.menuButton} aria-pressed={theme === item.value} onClick={() => { setTheme(item.value); try { saveQuestionPaperTheme(item.value); } catch { setStorageError("No se pudo guardar la apariencia."); } setPanel(null); }}>{item.title}{theme === item.value && <Check size={18} />}</button>)}
      {panel === "info" && <div className="space-y-3 text-base leading-relaxed"><p>Pregunta N.º {number}</p><p>{axis}</p><p>{topic}</p><p>{subtitle}</p><p>La primera respuesta queda guardada. La ayuda y la corrección posterior no cambian ese resultado.</p></div>}
      {panel === "map" && <><div className="grid grid-cols-5 gap-2">{steps.map(step => <span key={step.number} aria-current={step.current ? "step" : undefined} aria-label={`Pregunta ${step.number}, ${step.current ? "actual" : step.answered ? "respondida" : "pendiente"}`} className={`grid min-h-11 place-items-center rounded-lg border text-sm font-bold ${step.current ? "border-[var(--primary)] bg-[var(--pg-selected)]" : step.answered ? "border-emerald-500 bg-[var(--pg-good)]" : "border-[var(--pg-border)]"}`}>{step.number}</span>)}</div><p className="mt-3 text-sm">{subtitle}</p></>}
      {panel === "drawing" && <>
        <p className={styles.drawingHint}>Dibuja sobre la hoja. Toca «Desplazar» al pie para volver a recorrer la pregunta.</p>
        <div className={styles.drawingTools}>
          <button type="button" aria-label="Dibujar" aria-pressed={tool === "pen"} onClick={() => { setTool("pen"); drawing.setDrawingEnabled(true); }}><Pencil size={19} /></button>
          <button type="button" aria-label="Borrar trazo" aria-pressed={tool === "eraser"} onClick={() => { setTool("eraser"); drawing.setDrawingEnabled(true); }}><Eraser size={19} /></button>
          {INKS.map(ink => <button type="button" key={ink} aria-label={`Color de tinta ${ink}`} aria-pressed={color === ink && tool === "pen"} onClick={() => { setColor(ink); setTool("pen"); }}><span className="h-5 w-5 rounded-full border border-slate-400/40" style={{ backgroundColor: ink }} /></button>)}
          <button type="button" aria-label="Deshacer último trazo" onClick={() => inkControls.current?.undo()}><RotateCcw size={19} /></button>
          <button type="button" aria-label="Borrar todos los trazos" onClick={() => inkControls.current?.clear()}><Trash2 size={19} /></button>
        </div>
        <button type="button" className={styles.menuButton} onClick={() => { drawing.setDrawingEnabled(false); setPanel(null); }}><Move size={19} />Desplazar</button>
        <button type="button" className={`${styles.menuButton} font-bold`} onClick={() => setPanel(null)}>Listo, dibujar</button>
      </>}
    </QuestionDialog>}
    {figure !== null && figures[figure] && <QuestionDialog returnFocusRef={panelTrigger} title="Ampliar figura" wide onClose={() => setFigure(null)} paperStyle={paperStyle(theme)}>
      <div className={styles.figureActions}><button type="button" onClick={() => setZoom(value => Math.max(.5, value - .25))} aria-label="Reducir figura">−</button><span>{Math.round(zoom * 100)} %</span><button type="button" onClick={() => setZoom(value => Math.min(4, value + .25))} aria-label="Ampliar figura más">+</button><button type="button" onClick={() => setZoom(1)}>Tamaño original</button></div>
      <div className={styles.figureViewport} tabIndex={0} aria-label="Figura ampliada, desplazable"><img src={figures[figure].src} alt={figures[figure].alt} style={{ width: Math.max(280, figures[figure].width) * zoom }} /></div>
    </QuestionDialog>}
  </>;
  return <div onClickCapture={event => { const target = event.target as HTMLElement; const button = target.closest<HTMLElement>("button"); if (button && !button.closest("dialog")) panelTrigger.current = button; }}><QuestionWorkspace number={number} total={total} axis={axis} topic={topic} subtitle={subtitle} progress={progress} progressMax={progressMax} onClose={onClose} closeDisabled={busy} tools={tools} panels={panels} footer={null} paperStyle={paperStyle(theme)} contentKey={meta.id} mobile={{
    steps,
    menu: <button type="button" className={styles.iconButton} aria-label="Abrir menú de la pregunta" aria-expanded={panel !== null} onClick={() => setPanel("menu")}><Menu size={22} /></button>,
    footer: <div className={styles.footerRow}><div className={styles.mobileOnly}><button type="button" className={styles.drawingToggle} aria-label={drawing.drawingEnabled ? "Desplazar" : "Activar lápiz"} aria-pressed={drawing.drawingEnabled} disabled={!sheetReady} onClick={openDrawing}>{drawing.drawingEnabled ? <><Move size={19} /><span>Desplazar</span></> : <Pencil size={20} />}</button></div><div ref={footerRef} className={styles.footerMain}>{footer(drawing.drawingEnabled, narrow ? null : aiHelp)}</div></div>,
  }}>
    {notices}
    {(storageError || timer.error) && <p role="alert" className="mb-3 max-w-[1060px] text-sm text-rose-500">{storageError || timer.error}</p>}
    {timer.enabled && <span className={`${styles.timer} ${styles.bodyTimer}`} data-testid="learning-question-timer" aria-label={`Tiempo activo: ${timer.label}`}>{timer.label}</span>}
    {error ? <LearningError message={error} retry={retry} /> : !question || !ready ? <LearningLoading label="Cargando la pregunta original…" /> : <>
      <div className="min-w-0" onPointerDownCapture={() => { if (panel === "drawing") setPanel(null); }}>
      <LearningInkSheet storageKey={`paessed-learning-ink:${scratchpadKey}`} enabled={drawing.drawingEnabled && (!panel || panel === "drawing") && figure === null} mode={tool} color={color} onReady={setSheetReady} onError={setStorageError} onLockChange={setInkLocked} controlsRef={inkControls}>
        <div ref={sheetRef} className={styles.sheet}>
          <div ref={stemRef} tabIndex={-1} data-testid="learning-paper-stem" data-question-id={meta.id} style={QUESTION_PAPER_FONT} className={`${styles.stem} max-w-[1060px] text-[18px] leading-[1.55] text-[var(--pg-fg)] focus:outline-none sm:text-[21px]`}>{question.stemBlocks?.length ? <PaessedBlocks blocks={question.stemBlocks} assetUrls={resourceUrls.byId} /> : <p className="whitespace-pre-line">{question.stem}</p>}</div>
          <AdaptiveAlternatives frozen={!!checkedAnswer || inkLocked} contentKey={meta.id}>
            {question.options.map((option, index) => {
              const letter = question.optionLabels?.[index] || String.fromCharCode(65 + index);
              const correct = !!checkedAnswer && letter === meta.correct;
              const incorrect = !!checkedAnswer && letter === checkedAnswer && !correct;
              const tone = correct ? "border-emerald-500 bg-[var(--pg-good)] ring-1 ring-emerald-500" : incorrect ? "border-rose-500 bg-[var(--pg-bad)] ring-1 ring-rose-500" : selected === letter ? "border-[var(--primary)] bg-[var(--pg-selected)] ring-1 ring-[var(--primary)]" : "border-[var(--pg-border)] bg-[var(--pg-option)] hover:border-[var(--primary)] hover:bg-[var(--pg-option-hover)]";
              return <button key={letter} type="button" role="radio" aria-checked={selected === letter} data-answer-status={correct ? "correct" : incorrect ? "incorrect" : "neutral"} disabled={locked || drawing.drawingEnabled}
                onPointerDown={event => { pointer.current = { x: event.clientX, y: event.clientY, moved: false }; }}
                onPointerMove={event => { if (pointer.current && Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) > 7) pointer.current.moved = true; }}
                onPointerCancel={() => { if (pointer.current) pointer.current.moved = true; }}
                onClick={event => { if (event.detail !== 0 && pointer.current?.moved) { event.preventDefault(); return; } onSelect(letter); }}
                onKeyDown={event => {
                  if (event.target !== event.currentTarget || !["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === "Home" ? 0 : event.key === "End" ? question.options.length - 1 : (index + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : question.options.length - 1)) % question.options.length;
                  onSelect(question.optionLabels?.[next] || String.fromCharCode(65 + next));
                  event.currentTarget.parentElement?.querySelectorAll<HTMLElement>("[role=radio]")[next]?.focus();
                }} className={`${styles.option} inline-flex min-h-[34px] w-fit max-w-full min-w-[72px] cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-default sm:min-h-[36px] sm:px-3 ${tone}`}>
                <span style={QUESTION_PAPER_FONT} className={`${styles.optionLabel} shrink-0 text-[15px] font-semibold leading-6 text-[var(--pg-fg)] sm:text-[16px]`}>{letter})</span>
                <div data-option-content style={QUESTION_PAPER_FONT} className={`${styles.optionContent} min-w-0 break-words text-[15px] leading-6 text-[var(--pg-fg)] sm:text-[16px]`}>{question.optionBlocks?.[index]?.length ? <PaessedBlocks blocks={question.optionBlocks[index]!} assetUrls={resourceUrls.byId} /> : option}</div>
                <span className={styles.optionStatus}>{correct ? <Check size={17} aria-label="Alternativa correcta" className="text-emerald-600" /> : incorrect ? <X size={17} aria-label="Respuesta incorrecta" className="text-rose-500" /> : null}</span>
              </button>;
            })}
          </AdaptiveAlternatives>
        </div>
      </LearningInkSheet>
      </div>
      {figures.length > 0 && <div className={`${styles.figureLinks} ${styles.mobileOnly}`}>{figures.map((item, index) => <button type="button" key={`${item.src}-${index}`} onClick={() => { setFigure(index); setZoom(1); }}><ZoomIn size={16} className="mr-1 inline" />Ampliar figura{figures.length > 1 ? ` ${index + 1}` : ""}</button>)}</div>}
      {feedback && <div className={styles.bodyFeedback} aria-live="polite">{feedback}</div>}
      {revealSolution && <section aria-label="Revisión de la solución" className="mt-4 max-w-[1060px] rounded-lg border border-emerald-500/50 bg-[var(--pg-good)] px-4 py-3 text-[12px] leading-5 text-[var(--pg-fg)] sm:text-[13px]">
        <p className="font-extrabold">Alternativa correcta: {meta.correct}</p>
        {question.explanationBlocks?.length || question.explanation ? <><p className="mt-2 text-xs font-bold text-[var(--pg-muted)]">{question.explanationStatus === "verified" ? "Explicación verificada" : "Explicación provisional · pendiente de revisión docente"}</p><div className="mt-1" style={QUESTION_PAPER_FONT}>{question.explanationBlocks?.length ? <PaessedBlocks blocks={question.explanationBlocks} assetUrls={resourceUrls.byId} /> : question.explanation}</div></> : <p className="mt-2">El banco contiene la clave verificada, pero todavía no una explicación. Revisa tu procedimiento antes de continuar.</p>}
      </section>}
      {narrow && showAiHelp && <div ref={bodyAiRef} className={styles.aiInBody}>{aiHelp}</div>}
    </>}
  </QuestionWorkspace></div>;
}
