"use client";

import { useEffect, useState } from "react";
import { Pencil, Settings } from "lucide-react";
import styles from "./mobile-question.module.css";

export function MobilePenButton({ enabled, disabled, onActivate, onSettings }: {
  enabled: boolean; disabled: boolean; onActivate: () => void; onSettings: () => void;
}) {
  const [settingsReady, setSettingsReady] = useState(false);
  useEffect(() => {
    setSettingsReady(false);
    if (!enabled) return;
    const timer = window.setTimeout(() => setSettingsReady(true), 1000);
    return () => window.clearTimeout(timer);
  }, [enabled]);
  return <button type="button" className={`${styles.drawingToggle} ${styles.penButton}`} aria-label={enabled ? "Opciones del lápiz" : "Activar lápiz"}
    aria-pressed={enabled} aria-haspopup={enabled ? "dialog" : undefined} disabled={disabled || enabled && !settingsReady}
    data-settings-ready={settingsReady} onClick={enabled ? onSettings : onActivate}>
    <Settings size={27} className={styles.penGear} aria-hidden="true" />
    <Pencil size={20} className={styles.penIcon} aria-hidden="true" />
  </button>;
}
