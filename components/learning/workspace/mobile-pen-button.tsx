"use client";

import { Eraser, Pencil, Settings } from "lucide-react";
import styles from "./mobile-question.module.css";

/** The main pencil toggles drawing; the eraser and settings remain available beside it. */
export function MobilePenButton({ enabled, disabled, mode, onActivate, onDeactivate, onErase, onSettings }: {
  enabled: boolean;
  disabled: boolean;
  mode: "pen" | "eraser";
  onActivate: () => void;
  onDeactivate: () => void;
  onErase: () => void;
  onSettings: () => void;
}) {
  return <div className={styles.penControls} role="group" aria-label="Herramientas del lápiz">
    <button
      type="button"
      className={`${styles.drawingToggle} ${styles.penButton}`}
      aria-label={enabled ? "Desactivar lápiz" : "Activar lápiz"}
      aria-pressed={enabled}
      aria-expanded={enabled}
      disabled={disabled}
      onClick={enabled ? onDeactivate : onActivate}
    >
      <Pencil size={20} aria-hidden="true" />
    </button>
    {enabled && <>
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
    </>}
  </div>;
}
