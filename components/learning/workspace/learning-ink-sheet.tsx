"use client";

import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { PlaygroundScratchpad, type PlaygroundInkStroke } from "@/components/playground-scratchpad";

export type LearningInkControls = { undo: () => void; clear: () => void };
type Sheet = { version: 2; width: number; height: number; layout: "mobile" | "desktop"; optionLayout?: string; strokes: PlaygroundInkStroke[] };
const memory = new Map<string, Sheet | PlaygroundInkStroke[]>();
const validStrokes = (value: unknown): value is PlaygroundInkStroke[] => Array.isArray(value) && value.every(stroke =>
  stroke && typeof stroke.color === "string" && Array.isArray(stroke.points) && stroke.points.every((point: { x: number; y: number }) =>
    Number.isFinite(point?.x) && Number.isFinite(point?.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1));

/** Only the exercise belongs in this sheet; feedback and toolbars stay outside its coordinates. */
export function LearningInkSheet({ storageKey, enabled, mode, color, children, onReady, onError, onLockChange, controlsRef }: {
  storageKey: string; enabled: boolean; mode: "pen" | "eraser"; color: string; children: ReactNode;
  onReady?: (ready: boolean) => void; onError?: (message: string) => void;
  onLockChange?: (locked: boolean) => void; controlsRef?: Ref<LearningInkControls>;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [strokes, setStrokes] = useState<PlaygroundInkStroke[]>([]);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [revision, setRevision] = useState(0);
  const callbacks = useRef({ onReady, onError, onLockChange });
  callbacks.current = { onReady, onError, onLockChange };
  useEffect(() => {
    let value: unknown = memory.get(storageKey);
    try { value ??= JSON.parse(localStorage.getItem(storageKey) ?? "[]"); }
    catch { callbacks.current.onError?.("No se pudieron leer los trazos guardados. No se han borrado."); }
    if (validStrokes(value)) { setStrokes(value); setSheet(null); }
    else if (value && typeof value === "object" && "version" in value && value.version === 2) {
      const saved = value as Sheet;
      if (validStrokes(saved.strokes) && Number.isFinite(saved.width) && saved.width > 0 && Number.isFinite(saved.height) && saved.height > 0) {
        setSheet(saved); setStrokes(saved.strokes); callbacks.current.onLockChange?.(true);
      }
    }
  }, [storageKey]);

  useEffect(() => {
    const root = sheetRef.current;
    if (!root) return;
    let active = true;
    let fontsReady = false;
    let frame = 0;
    const update = () => {
      if (!active) return;
      const images = Array.from(root.querySelectorAll("img"));
      const failed = images.some(image => image.complete && image.naturalWidth === 0);
      const next = fontsReady && !failed && images.every(image => image.complete && image.naturalWidth > 0);
      setReady(next); callbacks.current.onReady?.(next);
      if (failed) callbacks.current.onError?.("No se pudo cargar una figura. Reintenta antes de responder o dibujar.");
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    root.addEventListener("load", schedule, true);
    root.addEventListener("error", schedule, true);
    void document.fonts.ready.then(() => { fontsReady = true; schedule(); });
    schedule();
    return () => { active = false; cancelAnimationFrame(frame); observer.disconnect(); root.removeEventListener("load", schedule, true); root.removeEventListener("error", schedule, true); };
  }, [storageKey, revision]);

  const dimensions = (): Sheet | null => {
    const root = sheetRef.current;
    if (!root) return null;
    return { version: 2, width: root.offsetWidth, height: root.offsetHeight,
      layout: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
      optionLayout: root.querySelector<HTMLElement>('[role="radiogroup"]')?.dataset.layout, strokes };
  };
  const save = (next: PlaygroundInkStroke[]) => {
    const base = sheet ?? dimensions();
    setStrokes(next);
    if (!base) return;
    const value = { ...base, strokes: next };
    setSheet(value);
    callbacks.current.onLockChange?.(true);
    memory.set(storageKey, value);
    try { localStorage.setItem(storageKey, JSON.stringify(value)); callbacks.current.onError?.(""); }
    catch { callbacks.current.onError?.("Los trazos siguen en memoria, pero no pudieron guardarse. No cierres esta pestaña si quieres conservarlos."); }
  };
  useImperativeHandle(controlsRef, () => ({ undo: () => save(strokes.slice(0, -1)), clear: () => save([]) }));
  // Old normalized strokes remain readable; bind their dimensions once resources have settled.
  useEffect(() => { if (ready && strokes.length && !sheet) save(strokes); }, [ready, strokes.length, sheet]); // eslint-disable-line react-hooks/exhaustive-deps
  const retryImages = () => {
    sheetRef.current?.querySelectorAll("img").forEach(image => { if (!image.naturalWidth) { const source = image.src; image.removeAttribute("src"); image.src = source; } });
    callbacks.current.onError?.(""); setRevision(value => value + 1);
  };
  return <>
    {!ready && <div role="status" className="mb-2 text-sm">Preparando fuentes y figuras… <button type="button" className="min-h-11 underline" onClick={retryImages}>Reintentar figuras</button></div>}
    {sheet && !enabled && <div role="group" aria-label="Zoom de la hoja anotada" className="mb-2 flex flex-wrap items-center gap-2 text-sm">
      <button type="button" aria-label="Alejar hoja" className="min-h-11 min-w-11 rounded border" onClick={() => setZoom(value => Math.max(0.5, value - 0.25))}>−</button>
      <button type="button" className="min-h-11 rounded border px-2" onClick={() => setZoom(1)}>{Math.round(zoom * 100)} %</button>
      <button type="button" aria-label="Ampliar hoja" className="min-h-11 min-w-11 rounded border" onClick={() => setZoom(value => Math.min(3, value + 0.25))}>+</button>
      <span>Desplaza la hoja para ver tus trazos.</span>
    </div>}
    <div data-testid="learning-ink-scroll" style={{ maxWidth: "100%", overflowX: "auto", overscrollBehaviorX: "contain", touchAction: enabled ? "none" : "pan-x pan-y pinch-zoom" }}>
      <div style={sheet ? { width: sheet.width * zoom, minHeight: sheet.height * zoom } : undefined}>
        <div ref={sheetRef} data-testid="learning-ink-sheet" data-ink-ready={ready} data-ink-locked={!!sheet} data-ink-layout={sheet?.layout} data-ink-option-layout={sheet?.optionLayout}
          style={{ position: "relative", display: "flow-root", ...(sheet ? { width: sheet.width, minHeight: sheet.height, transform: `scale(${zoom})`, transformOrigin: "top left" } : {}) }}>
          {children}
          <PlaygroundScratchpad enabled={enabled && ready} mode={mode} color={color} strokes={strokes} onChange={save} singlePointer doubleTapErase onInteractionStart={() => {
            if (!sheet) { const value = dimensions(); if (value) { setSheet(value); callbacks.current.onLockChange?.(true); } }
          }} />
        </div>
      </div>
    </div>
  </>;
}
