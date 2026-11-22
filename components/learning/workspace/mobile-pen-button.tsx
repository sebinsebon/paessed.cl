"use client";

import { ChevronLeft, Eraser, Pencil, Settings } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./mobile-question.module.css";

/** A single compact toolbox that unfolds to the left of the main pencil. */
export function MobilePenButton({ enabled, disabled, mode, onActivate, onDeactivate, onErase, onSettings }: {
  enabled: boolean;
  disabled: boolean;
  mode: "pen" | "eraser";
  onActivate: () => void;
  onDeactivate: () => void;
  onErase: () => void;
  onSettings: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const spring = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 850, damping: 37, mass: 0.62 };
  const actionMotion = {
    initial: reducedMotion ? false : { opacity: 0, width: 0, x: 12, scale: 0.75 },
    animate: { opacity: 1, width: 44, x: 0, scale: 1 },
    exit: { opacity: 0, width: 0, x: 12, scale: 0.75 },
  };

  return <div className={styles.penControls} data-testid="pen-toolbox" data-expanded={enabled} role="group" aria-label="Herramientas del lápiz">
    <AnimatePresence initial={false}>
      {enabled && <motion.div key="settings" className={styles.penActionSlot} {...actionMotion} transition={{ ...spring, delay: reducedMotion ? 0 : 0.025 }}>
        <button
          type="button"
          className={styles.drawingToggle}
          aria-label="Ajustes del lápiz"
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={onSettings}
        >
          <span className={styles.penSettingsIcon} aria-hidden="true">
            <Pencil size={18} />
            <Settings size={13} className={styles.penSettingsGear} />
          </span>
        </button>
      </motion.div>}
      {enabled && <motion.div key="eraser" className={styles.penActionSlot} {...actionMotion} transition={spring}>
        <button
          type="button"
          className={styles.drawingToggle}
          aria-label="Goma de borrar"
          aria-pressed={mode === "eraser"}
          disabled={disabled}
          onClick={onErase}
        >
          <Eraser size={20} aria-hidden="true" />
        </button>
      </motion.div>}
    </AnimatePresence>
    <button
      type="button"
      className={`${styles.drawingToggle} ${styles.penButton}`}
      aria-label={enabled ? "Desactivar lápiz" : "Activar lápiz"}
      aria-pressed={enabled && mode === "pen"}
      aria-expanded={enabled}
      disabled={disabled}
      onClick={enabled ? onDeactivate : onActivate}
    >
      <ChevronLeft size={12} className={styles.penExpandIndicator} data-open={enabled} aria-hidden="true" />
      <Pencil size={20} aria-hidden="true" />
    </button>
  </div>;
}
