"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

type PlaygroundInkPoint = { x: number; y: number };
export type PlaygroundInkStroke = { color: string; points: PlaygroundInkPoint[] };

/** Pointer-based scratchpad: strokes use normalized coordinates so resize keeps annotations aligned. */
export function PlaygroundScratchpad({
  enabled,
  mode,
  color,
  strokes,
  onChange,
  onInteractionStart,
  singlePointer = false,
  doubleTapErase = false,
}: {
  enabled: boolean;
  mode: "pen" | "eraser";
  color: string;
  strokes: PlaygroundInkStroke[];
  onChange: (next: PlaygroundInkStroke[]) => void;
  onInteractionStart?: () => void;
  /** Aprender can opt into cancellation-safe, single-pointer drawing. */
  singlePointer?: boolean;
  doubleTapErase?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveStrokeRef = useRef<PlaygroundInkStroke | null>(null);
  const activePointer = useRef<number | null>(null);
  const contacts = useRef(new Set<number>());
  const pointerStarted = useRef(0);
  const lastTap = useRef<{ time: number; x: number; y: number; target: number; before: PlaygroundInkStroke[] } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * pixelRatio);
    const height = Math.round(rect.height * pixelRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of [...strokes, ...(liveStrokeRef.current ? [liveStrokeRef.current] : [])]) {
      if (!stroke.points.length) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = 2.6;
      const first = stroke.points[0];
      ctx.moveTo(first.x * rect.width, first.y * rect.height);
      if (stroke.points.length === 1) {
        ctx.arc(first.x * rect.width, first.y * rect.height, 1.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        stroke.points.slice(1).forEach((point) => ctx.lineTo(point.x * rect.width, point.y * rect.height));
        ctx.stroke();
      }
    }
  }, [strokes]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw, enabled]);

  const pointOf = (event: ReactPointerEvent<HTMLCanvasElement>): PlaygroundInkPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height))),
    };
  };

  const hitsAt = (point: PlaygroundInkPoint, source = strokes): number[] => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return [];
    const px = point.x * rect.width;
    const py = point.y * rect.height;
    const segmentDistance = (a: PlaygroundInkPoint, b: PlaygroundInkPoint) => {
      const x1 = a.x * rect.width, y1 = a.y * rect.height;
      const vx = b.x * rect.width - x1, vy = b.y * rect.height - y1;
      const denominator = vx * vx + vy * vy;
      const t = denominator === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / denominator));
      return Math.hypot(px - x1 - t * vx, py - y1 - t * vy);
    };
    return source.flatMap((stroke, strokeIndex) => stroke.points.some((vertex, index) =>
      segmentDistance(vertex, stroke.points[Math.min(index + 1, stroke.points.length - 1)]) < 14
    ) ? [strokeIndex] : []);
  };
  const eraseAt = (point: PlaygroundInkPoint) => {
    const hits = hitsAt(point);
    const updated = strokes.filter((_, index) => !hits.includes(index));
    if (updated.length !== strokes.length) onChange(updated);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!enabled) return;
    if (singlePointer) {
      contacts.current.add(event.pointerId);
      if (contacts.current.size > 1 || !event.isPrimary || event.button !== 0) {
        liveStrokeRef.current = null;
        lastTap.current = null;
        activePointer.current = null;
        draw();
        return;
      }
      activePointer.current = event.pointerId;
    }
    event.preventDefault();
    pointerStarted.current = performance.now();
    event.currentTarget.setPointerCapture(event.pointerId);
    onInteractionStart?.();
    const point = pointOf(event);
    if (mode === "eraser") {
      eraseAt(point);
      return;
    }
    liveStrokeRef.current = { color, points: [point] };
    draw();
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!enabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    if (singlePointer && activePointer.current !== event.pointerId) return;
    if (mode === "eraser") {
      eraseAt(pointOf(event));
    } else if (liveStrokeRef.current) {
      liveStrokeRef.current.points.push(pointOf(event));
      draw();
    }
  };
  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (singlePointer) {
      contacts.current.delete(event.pointerId);
      if (activePointer.current !== event.pointerId) return;
      activePointer.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const stroke = liveStrokeRef.current;
    liveStrokeRef.current = null;
    if (stroke) {
      if (doubleTapErase) {
        const rect = event.currentTarget.getBoundingClientRect();
        const first = stroke.points[0];
        const tap = performance.now() - pointerStarted.current < 280 && stroke.points.every(point => Math.hypot((point.x - first.x) * rect.width, (point.y - first.y) * rect.height) < 8);
        const previous = lastTap.current;
        const x = first.x * rect.width, y = first.y * rect.height;
        if (tap && previous && performance.now() - previous.time < 340 && Math.hypot(x - previous.x, y - previous.y) < 24 && previous.target >= 0) {
          lastTap.current = null;
          onChange(previous.before.filter((_, index) => index !== previous.target));
          return;
        }
        const hits = hitsAt(first);
        lastTap.current = tap ? { time: performance.now(), x, y, target: hits.at(-1) ?? -1, before: strokes } : null;
      }
      onChange([...strokes, stroke]);
    }
  };
  const cancelStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!singlePointer) { finishStroke(event); return; }
    if (event.type === "lostpointercapture" && activePointer.current !== event.pointerId) return;
    contacts.current.delete(event.pointerId);
    lastTap.current = null;
    activePointer.current = null;
    liveStrokeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    draw();
  };
  useEffect(() => {
    if (!enabled && singlePointer) { activePointer.current = null; contacts.current.clear(); liveStrokeRef.current = null; lastTap.current = null; draw(); }
  }, [enabled, singlePointer, draw]);
  useEffect(() => {
    if (!singlePointer || !enabled) return;
    const owner = canvasRef.current?.ownerDocument;
    if (!owner) return;
    const down = (event: PointerEvent) => {
      contacts.current.add(event.pointerId);
      if (contacts.current.size > 1) {
        liveStrokeRef.current = null;
        lastTap.current = null;
        activePointer.current = null;
        draw();
      }
    };
    const ended = (event: PointerEvent) => {
      contacts.current.delete(event.pointerId);
      if (event.type === "pointercancel" && activePointer.current === event.pointerId) {
        liveStrokeRef.current = null;
        lastTap.current = null;
        activePointer.current = null;
        draw();
      }
    };
    owner.addEventListener("pointerdown", down, true);
    owner.addEventListener("pointerup", ended, true);
    owner.addEventListener("pointercancel", ended, true);
    return () => {
      owner.removeEventListener("pointerdown", down, true);
      owner.removeEventListener("pointerup", ended, true);
      owner.removeEventListener("pointercancel", ended, true);
    };
  }, [singlePointer, enabled, draw]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={mode === "eraser" ? "Borrar trazos de la hoja" : "Escribir cálculos sobre la hoja"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={cancelStroke}
      onLostPointerCapture={singlePointer ? cancelStroke : undefined}
      className={"absolute inset-0 z-10 h-full w-full " +
        (enabled ? (mode === "eraser" ? "pointer-events-auto cursor-cell touch-none" : "pointer-events-auto cursor-crosshair touch-none") : "pointer-events-none")}
    />
  );
}
