"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Eraser, LoaderCircle, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { PaessedBlocks } from "@/components/paessed-blocks";
import { PlaygroundScratchpad, type PlaygroundInkStroke } from "@/components/playground-scratchpad";
import { useDrawingTools } from "@/components/use-drawing-tools";
import type { LearningQuestion } from "@/lib/learning/types";
import { useLearningQuestion } from "./use-learning-question";
import { QUESTION_PAPER_FONT } from "@/lib/question-paper";
import styles from "./learning.module.css";

export const primaryButton = styles.primary;
export const secondaryButton = styles.secondary;

export function LearningError({ message, retry }: { message: string; retry?: () => void }) {
  return <div className={styles.error} role="alert"><span className="flex items-center gap-2"><AlertCircle size={18} className="shrink-0" />{message}</span>{retry && <button className={styles.iconButton} onClick={retry} aria-label="Reintentar carga"><RotateCcw size={18} /></button>}</div>;
}

export function LearningLoading({ label = "Preparando tu ruta…" }: { label?: string }) {
  return <div className={styles.loading} role="status"><LoaderCircle size={26} className={`${styles.spin} mx-auto mb-3`} />{label}</div>;
}

export function LearningQuestionCard({ meta, selected, onSelect, locked, revealSolution = false, onReady, scratchpadKey }: {
  meta: LearningQuestion; selected: string; onSelect: (answer: string) => void; locked: boolean;
  revealSolution?: boolean; onReady?: (ready: boolean) => void; scratchpadKey?: string;
}) {
  const { content, resourceUrls, error, ready, retry } = useLearningQuestion(meta, onReady);
  const drawing = useDrawingTools();
  const [strokes, setStrokes] = useState<PlaygroundInkStroke[]>([]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const inkKey = `paessed-learning-ink:${scratchpadKey ?? meta.id}`;
  useEffect(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(inkKey) ?? "[]"); setStrokes(Array.isArray(saved) ? saved.filter((stroke): stroke is PlaygroundInkStroke => !!stroke && typeof stroke === "object" && typeof stroke.color === "string" && Array.isArray(stroke.points) && stroke.points.every((point: { x?: unknown; y?: unknown }) => typeof point?.x === "number" && typeof point?.y === "number")) : []); } catch { setStrokes([]); }
    drawing.setDrawingEnabled(false);
  }, [inkKey, drawing.setDrawingEnabled]);
  const updateStrokes = (next: PlaygroundInkStroke[]) => { setStrokes(next); try { localStorage.setItem(inkKey, JSON.stringify(next)); } catch { /* The answer is saved independently; drawing still works in memory. */ } };
  if (error) return <LearningError message={error} retry={retry} />;
  if (!content || !ready) return <LearningLoading label="Cargando la pregunta original…" />;
  const { question } = content;
  return <>
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className={styles.badge}>Pregunta original · {question.number}{question.year ? ` · ${question.year}` : ""}</span>
      <button className={styles.iconButton} aria-label={drawing.drawingEnabled ? "Desactivar lápiz" : "Activar lápiz"} aria-pressed={drawing.drawingEnabled} onClick={drawing.toggleDrawing}><Pencil size={18} /></button>
    </div>
    {drawing.drawingMenuOpen && <div className="mb-3 flex flex-wrap gap-2" aria-label="Herramientas de dibujo">
      <button className={styles.iconButton} aria-label="Lápiz" aria-pressed={tool === "pen"} onClick={() => setTool("pen")}><Pencil size={17} /></button>
      <button className={styles.iconButton} aria-label="Borrador" aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}><Eraser size={17} /></button>
      <button className={styles.iconButton} aria-label="Borrar todos los trazos" onClick={() => updateStrokes([])}><Trash2 size={17} /></button>
      <span className="self-center text-xs text-[var(--muted)]">Tus trazos son un espacio de trabajo personal.</span>
    </div>}
    <article className={styles.paper} aria-label={`Pregunta ${question.number}`}>
      <div className={styles.stem} style={QUESTION_PAPER_FONT}>{question.stemBlocks?.length ? <PaessedBlocks blocks={question.stemBlocks} assetUrls={resourceUrls.byId} /> : <p className="whitespace-pre-line">{question.stem}</p>}</div>
      <div className={styles.options} role="radiogroup" aria-label="Alternativas">
        {question.options.map((option, index) => {
          const letter = question.optionLabels?.[index] || String.fromCharCode(65 + index);
          return <button key={letter} type="button" role="radio" aria-checked={selected === letter} disabled={locked} onClick={() => onSelect(letter)} onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? question.options.length - 1 : (index + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : question.options.length - 1)) % question.options.length;
            onSelect(question.optionLabels?.[next] || String.fromCharCode(65 + next));
            (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
          }} className={`${styles.option} ${selected === letter ? styles.optionSelected : ""}`}>
            <span>{letter}</span><div className="min-w-0 text-base leading-7" style={QUESTION_PAPER_FONT}>{question.optionBlocks?.[index]?.length ? <PaessedBlocks blocks={question.optionBlocks[index]!} assetUrls={resourceUrls.byId} /> : option}</div>
          </button>;
        })}
      </div>
      <PlaygroundScratchpad enabled={drawing.drawingEnabled} mode={tool} color="#6366f1" strokes={strokes} onChange={updateStrokes} onInteractionStart={drawing.hideDrawingTools} />
    </article>
    {revealSolution && <section className={`${styles.notice} mt-5`} aria-label="Revisión de la solución">
      <p className="mb-2 font-extrabold">Alternativa correcta: {meta.correct}</p>
      {question.explanationBlocks?.length || question.explanation ? <>
        <p className="mb-3 text-xs font-bold text-[var(--muted)]">{("explanationStatus" in question && question.explanationStatus === "verified") ? "Explicación verificada" : "Explicación provisional · pendiente de revisión docente"}</p>
        <div style={QUESTION_PAPER_FONT}>{question.explanationBlocks?.length ? <PaessedBlocks blocks={question.explanationBlocks} assetUrls={resourceUrls.byId} /> : question.explanation}</div>
      </> : <p className={styles.muted}>El banco contiene la clave verificada, pero todavía no una explicación. Revisa tu procedimiento antes de continuar.</p>}
    </section>}
  </>;
}
