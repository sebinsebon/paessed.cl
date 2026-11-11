"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Settings } from "lucide-react";
import styles from "./mobile-question.module.css";

export function MobilePenButton({ enabled, disabled, onActivate, onDeactivate, onSettings }: {
  enabled: boolean; disabled: boolean; onActivate: () => void; onDeactivate: () => void; onSettings: () => void;
}) {
  const [settingsReady, setSettingsReady] = useState(false);
  const openedAt = useRef<number | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!enabled) { openedAt.current = null; setSettingsReady(false); }
  }, [enabled]);
  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  const click = () => {
    if (!enabled) {
      openedAt.current = performance.now(); setSettingsReady(true); onActivate();
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setSettingsReady(false), 500);
    } else if (openedAt.current !== null && performance.now() - openedAt.current < 500) {
      openedAt.current = null; setSettingsReady(false); onSettings();
    } else { openedAt.current = null; setSettingsReady(false); onDeactivate(); }
  };
  return <button type="button" className={`${styles.drawingToggle} ${styles.penButton}`} aria-label={enabled ? settingsReady ? "Opciones del lápiz" : "Desactivar lápiz" : "Activar lápiz"}
    aria-pressed={enabled} aria-haspopup={enabled && settingsReady ? "dialog" : undefined} disabled={disabled}
    data-settings-ready={settingsReady} onClick={click}>
    <Settings size={27} className={styles.penGear} aria-hidden="true" />
    <Pencil size={20} className={styles.penIcon} aria-hidden="true" />
  </button>;
}
