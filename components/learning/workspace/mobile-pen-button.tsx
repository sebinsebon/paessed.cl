"use client";

import { Eraser, Pencil, Settings } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./mobile-question.module.css";

/** Keep the original pencil position and size; float the extra tools outside layout. */
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

  return <div className={styles.penAnchor} data-testid="pen-toolbox" data-expanded={enabled} data-active-tool={enabled ? mode : "off"} role="group" aria-label="Herramientas del lápiz">
    <AnimatePresence initial={false}>
      {enabled && <motion.div
        key="pen-flyout"
        className={styles.penFlyout}
        initial={reducedMotion ? false : { opacity: 0, x: 12, scaleX: 0.78, scaleY: 0.9 }}
        animate={{ opacity: 1, x: 0, scaleX: 1, scaleY: 1 }}
        exit={reducedMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: 10, scaleX: 0.82, scaleY: 0.9 }}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 850, damping: 37, mass: 0.62 }}
      >
        <button
          type="button"
          className={styles.penFlyoutButton}
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
        <button
          type="button"
          className={styles.penFlyoutButton}
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
      <Pencil size={20} aria-hidden="true" />
    </button>
  </div>;
}
