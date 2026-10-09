"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

export type QuestionMapHoverData = {
  number: number;
  status: string;
  text?: string;
  left: number;
  top?: number;
  bottom?: number;
};

export function positionQuestionMapHover(
  element: HTMLElement,
  number: number,
  status: string,
  text?: string,
): QuestionMapHoverData {
  const rect = element.getBoundingClientRect();
  const width = Math.min(320, window.innerWidth - 24);
  const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12));
  const showBelow = rect.top < 175;

  return {
    number,
    status,
    text,
    left,
    ...(showBelow ? { top: rect.bottom + 10 } : { bottom: window.innerHeight - rect.top + 10 }),
  };
}

export function QuestionMapHoverCard({ data }: { data: QuestionMapHoverData | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {data && (
        <motion.div
          key="question-map-tooltip"
          role="tooltip"
          initial={{ opacity: 0, y: 5, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          style={{ left: data.left, top: data.top, bottom: data.bottom }}
          className="pointer-events-none fixed z-[250] w-[min(320px,calc(100vw-24px))] rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-left text-[var(--text)] shadow-[var(--shadow-2)]"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-extrabold">Pregunta {data.number}</span>
            <span className="shrink-0 text-[10px] font-bold text-[var(--muted)]">{data.status}</span>
          </div>
          <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-[11px] font-medium leading-[1.5] text-[var(--muted)]">
            {data.text || "Este ensayo de demostración no incluye el enunciado de la pregunta."}
          </p>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
