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
  optionTapToSelect = false,
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
  /** Mobile: a stroke beginning inside an alternative selects it; strokes begun outside can cross it. */
  optionTapToSelect?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveStrokeRef = useRef<PlaygroundInkStroke | null>(null);
  const activePointer = useRef<number | null>(null);
  const contacts = useRef(new Set<number>());
  const pointerStarted = useRef(0);
  const lastTap = useRef<{ time: number; x: number; y: number; target: number; before: PlaygroundInkStroke[] } | null>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const touchPositions = useRef(new Map<number, number>());
  const touchPanY = useRef<number | null>(null);
  const touchGesture = useRef(false);
  const paintFrame = useRef(0);
  const optionTap = useRef<{ id: number; x: number; y: number; moved: boolean; button: HTMLButtonElement } | null>(null);

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
    for (const stroke of [...strokesRef.current, ...(liveStrokeRef.current ? [liveStrokeRef.current] : [])]) {
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
  }, []);

  // Paint once per frame, even when a finger/stylus delivers many pointer events.
  const schedulePaint = () => {
    if (paintFrame.current) return;
    paintFrame.current = requestAnimationFrame(() => { paintFrame.current = 0; draw(); });
  };
  useEffect(() => () => cancelAnimationFrame(paintFrame.current), []);
  useEffect(() => { schedulePaint(); }, [strokes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw, enabled]);

  const pointOfCoords = (x: number, y: number, canvas: HTMLCanvasElement): PlaygroundInkPoint => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (x - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, (y - rect.top) / Math.max(1, rect.height))),
    };
  };
  const pointOf = (event: ReactPointerEvent<HTMLCanvasElement>) =>
    pointOfCoords(event.clientX, event.clientY, event.currentTarget);
  const pointerPoints = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const points = coalesced.map(pointer => pointOfCoords(pointer.clientX, pointer.clientY, event.currentTarget));
    points.push(pointOf(event)); // Safari may not include the final event in the coalesced batch.
    return points;
  };

  const hitsAt = (point: PlaygroundInkPoint, source = strokesRef.current): number[] => {
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
  const eraseAt = (points: PlaygroundInkPoint[]) => {
    const current = strokesRef.current;
    const hits = new Set(points.flatMap(point => hitsAt(point, current)));
    if (!hits.size) return;
    const updated = current.filter((_, index) => !hits.has(index));
    // Update synchronously: rapid eraser moves must not resurrect a previous stroke.
    strokesRef.current = updated;
    onChange(updated);
    schedulePaint();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!enabled) return;
    if (singlePointer) {
      contacts.current.add(event.pointerId);
      if (event.pointerType === "touch") {
        touchPositions.current.set(event.pointerId, event.clientY);
        if (touchPositions.current.size > 1) {
          // A second finger cancels the in-progress mark and starts a pan.
          touchGesture.current = true;
          liveStrokeRef.current = null;
          activePointer.current = null;
          lastTap.current = null;
          optionTap.current = null;
          touchPanY.current = [...touchPositions.current.values()].reduce((a, b) => a + b, 0) / touchPositions.current.size;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          schedulePaint();
          return;
        }
      }
      if (contacts.current.size > 1 || touchGesture.current || !event.isPrimary || event.button !== 0) {
        liveStrokeRef.current = null;
        lastTap.current = null;
        activePointer.current = null;
        optionTap.current = null;
        schedulePaint();
        return;
      }
      activePointer.current = event.pointerId;
    }
    if (optionTapToSelect && mode === "pen") {
      const options = event.currentTarget.closest('[data-testid="learning-ink-sheet"]')?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      const button = [...(options ?? [])].find(candidate => {
        if (candidate.disabled) return false;
        const rect = candidate.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right &&
          event.clientY >= rect.top && event.clientY <= rect.bottom;
      });
      if (button) {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        optionTap.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, button };
        liveStrokeRef.current = null;
        return;
      }
    }
    event.preventDefault();
    pointerStarted.current = performance.now();
    event.currentTarget.setPointerCapture(event.pointerId);
    onInteractionStart?.();
    const point = pointOf(event);
    if (mode === "eraser") {
      eraseAt([point]);
      return;
    }
    liveStrokeRef.current = { color, points: [point] };
    schedulePaint();
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!enabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    if (singlePointer && event.pointerType === "touch" && touchPositions.current.has(event.pointerId)) {
      touchPositions.current.set(event.pointerId, event.clientY);
      if (touchGesture.current) {
        if (touchPositions.current.size > 1) {
          const averageY = [...touchPositions.current.values()].reduce((a, b) => a + b, 0) / touchPositions.current.size;
          const scroll = event.currentTarget.closest<HTMLElement>('[data-testid="learning-question-scroll"]');
          if (scroll && touchPanY.current !== null) scroll.scrollTop -= averageY - touchPanY.current;
          touchPanY.current = averageY;
        }
        event.preventDefault();
        return;
      }
    }
    if (singlePointer && (touchGesture.current || activePointer.current !== event.pointerId)) return;
    const option = optionTap.current;
    if (option && option.id === event.pointerId) {
      if (Math.hypot(event.clientX - option.x, event.clientY - option.y) > 10) option.moved = true;
      return;
    }
    const points = pointerPoints(event);
    if (mode === "eraser") {
      eraseAt(points);
    } else if (liveStrokeRef.current) {
      for (const point of points) {
        const previous = liveStrokeRef.current.points.at(-1);
        if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.0001) liveStrokeRef.current.points.push(point);
      }
      schedulePaint();
    }
  };
  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (singlePointer) {
      if (event.pointerType === "touch") {
        touchPositions.current.delete(event.pointerId);
        if (touchGesture.current) {
          contacts.current.delete(event.pointerId);
          if (!touchPositions.current.size) { touchGesture.current = false; touchPanY.current = null; }
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          return;
        }
      }
      contacts.current.delete(event.pointerId);
      if (activePointer.current !== event.pointerId) return;
      activePointer.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const option = optionTap.current;
    if (option && option.id === event.pointerId) {
      optionTap.current = null;
      if (!option.moved && Math.hypot(event.clientX - option.x, event.clientY - option.y) <= 10 && !option.button.disabled && option.button.isConnected) {
        option.button.click();
      }
      return;
    }
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
          const updated = previous.before.filter((_, index) => index !== previous.target);
          strokesRef.current = updated;
          onChange(updated);
          schedulePaint();
          return;
        }
        const current = strokesRef.current;
        const hits = hitsAt(first, current);
        lastTap.current = tap ? { time: performance.now(), x, y, target: hits.at(-1) ?? -1, before: current } : null;
      }
      const updated = [...strokesRef.current, stroke];
      strokesRef.current = updated;
      onChange(updated);
      schedulePaint();
    }
  };
  const cancelStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!singlePointer) { finishStroke(event); return; }
    if (event.type === "lostpointercapture" && activePointer.current !== event.pointerId) return;
    contacts.current.delete(event.pointerId);
    if (event.pointerType === "touch") touchPositions.current.delete(event.pointerId);
    if (!touchPositions.current.size) { touchGesture.current = false; touchPanY.current = null; }
    lastTap.current = null;
    optionTap.current = null;
    activePointer.current = null;
    liveStrokeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    schedulePaint();
  };
  useEffect(() => {
    if (!enabled && singlePointer) {
      activePointer.current = null; contacts.current.clear(); touchPositions.current.clear(); touchGesture.current = false;
      touchPanY.current = null; liveStrokeRef.current = null; lastTap.current = null; optionTap.current = null; schedulePaint();
    }
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
        optionTap.current = null;
        touchGesture.current = true;
        schedulePaint();
      }
    };
    const ended = (event: PointerEvent) => {
      contacts.current.delete(event.pointerId);
      if (event.pointerType === "touch") touchPositions.current.delete(event.pointerId);
      if (!contacts.current.size) { touchGesture.current = false; touchPanY.current = null; }
      if (event.type === "pointercancel" && activePointer.current === event.pointerId) {
        liveStrokeRef.current = null;
        lastTap.current = null;
        activePointer.current = null;
        optionTap.current = null;
        schedulePaint();
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
      aria-label={mode === "eraser" ? "Borrar trazos de la hoja; desliza con dos dedos para desplazarte" : "Escribir cálculos sobre la hoja; desliza con dos dedos para desplazarte"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={cancelStroke}
      onLostPointerCapture={singlePointer ? cancelStroke : undefined}
      style={enabled && mode === "eraser" ? { cursor: 'url("/cursors/eraser.svg") 7 26, crosshair' } : undefined}
      className={"absolute inset-0 z-10 h-full w-full " +
        (enabled ? (mode === "eraser" ? "pointer-events-auto touch-none" : "pointer-events-auto cursor-crosshair touch-none") : "pointer-events-none")}
    />
  );
}
