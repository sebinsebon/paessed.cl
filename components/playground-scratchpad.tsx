"use client";

import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";

type PlaygroundInkPoint = { x: number; y: number };
export type PlaygroundInkStroke = { color: string; points: PlaygroundInkPoint[] };
/** Pointer events can be handled by the sheet itself so native answer buttons remain clickable. */
export type InkPointerHandlers = {
  down: (event: ReactPointerEvent<HTMLElement>) => void;
  move: (event: ReactPointerEvent<HTMLElement>) => void;
  up: (event: ReactPointerEvent<HTMLElement>) => void;
  cancel: (event: ReactPointerEvent<HTMLElement>) => void;
  click: (event: ReactMouseEvent<HTMLElement>) => void;
};

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
  inputHandlersRef,
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
  inputHandlersRef?: MutableRefObject<InkPointerHandlers | null>;
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
  const optionTap = useRef<{ id: number; x: number; y: number; moved: boolean; button: HTMLButtonElement; inkStroke: number | null; doubleInkTap: boolean } | null>(null);
  const blockedInkClick = useRef<HTMLButtonElement | null>(null);
  const pendingInkSelection = useRef<{ button: HTMLButtonElement; target: number; x: number; y: number; time: number; timeout: ReturnType<typeof setTimeout> } | null>(null);
  useEffect(() => () => {
    if (pendingInkSelection.current) clearTimeout(pendingInkSelection.current.timeout);
  }, []);
  const clearOptionTap = () => {
    optionTap.current?.button.removeAttribute("data-press-preview");
    optionTap.current = null;
  };

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
  const pointOf = (event: ReactPointerEvent<HTMLElement>): PlaygroundInkPoint => {
    const canvas = canvasRef.current!;
    return pointOfCoords(event.clientX, event.clientY, canvas);
  };
  const pointerPoints = (event: ReactPointerEvent<HTMLElement>): PlaygroundInkPoint[] => {
    const canvas = canvasRef.current!;
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const points = coalesced.map(pointer => pointOfCoords(pointer.clientX, pointer.clientY, canvas));
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

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!enabled) return;
    blockedInkClick.current = null;
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
          clearOptionTap();
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
        clearOptionTap();
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
        // Keep the normal native click for clean alternatives. Only taps ON ink
        // wait briefly: a second tap should erase the mark, not toggle the answer.
        const inkStroke = doubleTapErase ? (hitsAt(pointOf(event)).at(-1) ?? null) : null;
        const previous = pendingInkSelection.current;
        const doubleInkTap = inkStroke !== null && !!previous &&
          previous.button === button && previous.target === inkStroke &&
          performance.now() - previous.time < 340 &&
          Math.hypot(previous.x - event.clientX, previous.y - event.clientY) < 24;
        if (doubleInkTap && previous) {
          clearTimeout(previous.timeout);
          pendingInkSelection.current = null;
        }
        blockedInkClick.current = inkStroke !== null ? button : null;
        button.setAttribute("data-press-preview", "true");
        optionTap.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, button, inkStroke, doubleInkTap };
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
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!enabled) return;
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
      if (Math.hypot(event.clientX - option.x, event.clientY - option.y) > 10) {
        option.moved = true;
        option.button.removeAttribute("data-press-preview");
      }
      return;
    }
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
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
  const finishStroke = (event: ReactPointerEvent<HTMLElement>) => {
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
      const tapped = !option.moved &&
        Math.hypot(event.clientX - option.x, event.clientY - option.y) <= 10;
      clearOptionTap();
      if (tapped && option.inkStroke !== null) {
        if (option.doubleInkTap) {
          // Erase just the touched stroke; do not change the selected answer.
          const current = strokesRef.current;
          if (option.inkStroke < current.length) {
            const updated = current.filter((_, index) => index !== option.inkStroke);
            strokesRef.current = updated;
            onChange(updated);
            schedulePaint();
          }
        } else {
          // A single tap still selects the option, with a short delay only when
          // it lands directly on a drawn mark. Clean options stay instantaneous.
          const pending = {
            button: option.button, target: option.inkStroke,
            x: option.x, y: option.y, time: performance.now(),
            timeout: undefined as unknown as ReturnType<typeof setTimeout>,
          };
          pending.timeout = setTimeout(() => {
            if (pendingInkSelection.current !== pending) return;
            pendingInkSelection.current = null;
            if (pending.button.isConnected && !pending.button.disabled) pending.button.click();
          }, 340);
          pendingInkSelection.current = pending;
        }
      }
      return;
    }
    const stroke = liveStrokeRef.current;
    liveStrokeRef.current = null;
    if (stroke) {
      if (doubleTapErase) {
        const rect = canvasRef.current!.getBoundingClientRect();
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
  const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    // A native option click is intercepted only when it happened ON a stroke.
    // It must not select a choice before we know whether this is a double tap.
    const button = (event.target as Element).closest<HTMLButtonElement>('[role="radio"]');
    if (event.detail !== 0 && button && button === blockedInkClick.current) {
      blockedInkClick.current = null;
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const cancelStroke = (event: ReactPointerEvent<HTMLElement>) => {
    if (!singlePointer) { finishStroke(event); return; }
    if (event.type === "lostpointercapture" && activePointer.current !== event.pointerId) return;
    contacts.current.delete(event.pointerId);
    if (event.pointerType === "touch") touchPositions.current.delete(event.pointerId);
    if (!touchPositions.current.size) { touchGesture.current = false; touchPanY.current = null; }
    lastTap.current = null;
    clearOptionTap();
    blockedInkClick.current = null;
    activePointer.current = null;
    liveStrokeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    schedulePaint();
  };
  useEffect(() => {
    if (!enabled && singlePointer) {
      activePointer.current = null; contacts.current.clear(); touchPositions.current.clear(); touchGesture.current = false;
      touchPanY.current = null; liveStrokeRef.current = null; lastTap.current = null; clearOptionTap(); schedulePaint();
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
        clearOptionTap();
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
        clearOptionTap();
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

  // The drawing layer is visually on top, but on phones the sheet receives
  // pointers so answer buttons remain native, tactile and keyboard accessible.
  if (inputHandlersRef) inputHandlersRef.current = {
    down: onPointerDown, move: onPointerMove, up: finishStroke, cancel: cancelStroke, click: onClickCapture,
  };

  return (
    <canvas
      ref={canvasRef}
      aria-label={mode === "eraser" ? "Borrar trazos de la hoja; desliza con dos dedos para desplazarte" : "Escribir cálculos sobre la hoja; desliza con dos dedos para desplazarte"}
      onPointerDown={optionTapToSelect ? undefined : onPointerDown}
      onPointerMove={optionTapToSelect ? undefined : onPointerMove}
      onPointerUp={optionTapToSelect ? undefined : finishStroke}
      onPointerCancel={optionTapToSelect ? undefined : cancelStroke}
      onLostPointerCapture={optionTapToSelect ? undefined : singlePointer ? cancelStroke : undefined}
      style={enabled && mode === "eraser" ? { cursor: 'url("/cursors/eraser.svg") 7 26, crosshair' } : undefined}
      className={"absolute inset-0 z-10 h-full w-full " +
        (enabled && !optionTapToSelect ? (mode === "eraser" ? "pointer-events-auto touch-none" : "pointer-events-auto cursor-crosshair touch-none") : "pointer-events-none")}
    />
  );
}
