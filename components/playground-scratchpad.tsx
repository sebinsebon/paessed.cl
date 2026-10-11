"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

type PlaygroundInkPoint = { x: number; y: number };
export type PlaygroundInkStroke = { color: string; points: PlaygroundInkPoint[] };

/** Pointer-based scratchpad: strokes use normalized coordinates so resize keeps annotations aligned. */
export function PlaygroundScratchpad({
  enabled,
  mode,
  color,
  strokes,
  onChange,
}: {
  enabled: boolean;
  mode: "pen" | "eraser";
  color: string;
  strokes: PlaygroundInkStroke[];
  onChange: (next: PlaygroundInkStroke[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveStrokeRef = useRef<PlaygroundInkStroke | null>(null);

  const draw = () => {
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
  };

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [strokes, enabled]);

  const pointOf = (event: ReactPointerEvent<HTMLCanvasElement>): PlaygroundInkPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height))),
    };
  };

  const eraseAt = (point: PlaygroundInkPoint) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = point.x * rect.width;
    const py = point.y * rect.height;
    const segmentDistance = (a: PlaygroundInkPoint, b: PlaygroundInkPoint) => {
      const x1 = a.x * rect.width, y1 = a.y * rect.height;
      const vx = b.x * rect.width - x1, vy = b.y * rect.height - y1;
      const denominator = vx * vx + vy * vy;
      const t = denominator === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / denominator));
      return Math.hypot(px - x1 - t * vx, py - y1 - t * vy);
    };
    const updated = strokes.filter((stroke) => !stroke.points.some((vertex, index) =>
      segmentDistance(vertex, stroke.points[Math.min(index + 1, stroke.points.length - 1)]) < 14
    ));
    if (updated.length !== strokes.length) onChange(updated);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!enabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
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
    if (mode === "eraser") {
      eraseAt(pointOf(event));
    } else if (liveStrokeRef.current) {
      liveStrokeRef.current.points.push(pointOf(event));
      draw();
    }
  };
  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const stroke = liveStrokeRef.current;
    liveStrokeRef.current = null;
    if (stroke) onChange([...strokes, stroke]);
  };

  return (
    <canvas
      ref={canvasRef}
      aria-label={mode === "eraser" ? "Borrar trazos de la hoja" : "Escribir cálculos sobre la hoja"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
      className={"absolute inset-0 z-10 h-full w-full " +
        (enabled ? (mode === "eraser" ? "pointer-events-auto cursor-cell touch-none" : "pointer-events-auto cursor-crosshair touch-none") : "pointer-events-none")}
    />
  );
}
