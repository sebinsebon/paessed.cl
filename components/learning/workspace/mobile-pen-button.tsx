"use client";

import { Eraser, Pencil, Settings } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./mobile-question.module.css";

/** The pencil toggles drawing; the eraser and settings slide out beside it. */
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
  const actionMotion = {
    initial: reducedMotion ? false : { opacity: 0, width: 0, x: -9, scale: 0.9 },
    animate: { opacity: 1, width: 44, x: 0, scale: 1 },
    exit: { opacity: 0, width: 0, x: -9, scale: 0.9 },
    transition: { duration: reducedMotion ? 0 : 0.2, ease: "easeOut" as const },
  };
  return <div className={styles.penControls} role="group" aria-label="Herramientas del lápiz">
    <button
      type="button"
      className={`${styles.drawingToggle} ${styles.penButton}`}
      aria-label={enabled ? "Desactivar lápiz" : "Activar lápiz"}
      aria-pressed={enabled && mode === "pen"}
      aria-expanded={enabled}
      disabled={disabled}
      onClick={enabled ? onDeactivate : onActivate}
    >
      <Pencil size={20} aria-hidden="true" />
    </button>
    <AnimatePresence initial={false}>
      {enabled && <>
        <motion.div key="eraser" className={styles.penActionSlot} {...actionMotion}>
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
        </motion.div>
        <motion.div key="settings" className={styles.penActionSlot} {...actionMotion} transition={{ ...actionMotion.transition, delay: reducedMotion ? 0 : 0.045 }}>
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
        </motion.div>
      </>}
    </AnimatePresence>
  </div>;
}
