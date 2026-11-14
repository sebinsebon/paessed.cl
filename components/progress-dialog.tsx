"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "./modal";
import styles from "./progress-dialog.module.css";

export type ProgressChoice = "save" | "discard" | "later";
export function ProgressDialog({ title, children, busy, error, onChoose, saveExplanation, discardExplanation, onDismiss }: { title: string; children: ReactNode; busy: boolean; error: string; onChoose: (choice: ProgressChoice) => Promise<void>; saveExplanation: string; discardExplanation: string; onDismiss: () => void }) {
  const [selection, setSelection] = useState<{ choice: ProgressChoice; at: number } | null>(null);
  const [now, setNow] = useState(0);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!selection || busy) return;
    const tick = () => {
      const time = Date.now(); setNow(time);
      if (time >= selection.at + 10_000) { setSelection(null); setExpired(true); }
    };
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [selection, busy]);
  const reading = selection && now < selection.at + 5000;
  const seconds = selection ? Math.max(0, Math.ceil(((reading ? selection.at + 5000 : selection.at + 10_000) - now) / 1000)) : 0;
  const choose = (choice: ProgressChoice) => { const at = Date.now(); setExpired(false); setNow(at); setSelection({ choice, at }); };
  async function confirm() {
    if (!selection || busy) return;
    const elapsed = Date.now() - selection.at;
    if (elapsed < 5000 || elapsed >= 10_000) { if (elapsed >= 10_000) { setSelection(null); setExpired(true); } return; }
    try { await onChoose(selection.choice); } finally { setSelection(null); }
  }
  return <Modal labelledBy="progress-title" onDismiss={() => { if (!busy) onDismiss(); }}>
    <img src="/emoji-apple/1f4da.png" width="52" height="52" alt="" className={styles.emoji} />
    <h2 id="progress-title" tabIndex={-1} className={styles.title}>{title}</h2>
    <div className={styles.copy}>{children}</div>
    {selection ? <div className={styles.review}>
      <h3>{selection.choice === "save" ? "Vas a guardar este progreso" : selection.choice === "discard" ? "Vas a continuar sin incorporarlo" : "Vas a decidir más tarde"}</h3>
      <p>{selection.choice === "save" ? saveExplanation : selection.choice === "discard" ? discardExplanation : "No cambiaremos tu progreso. Podrás volver a decidir al entrar de nuevo."}</p>
      <p role="status" className={styles.timer}>{busy ? "Guardando tu elección…" : reading ? `Lee tu elección. Podrás confirmar en ${seconds} s.` : `Tienes ${seconds} s para confirmar. Si no lo haces, volverás a las opciones.`}</p>
      <button type="button" className={styles.confirm} disabled={busy || !!reading} onClick={() => void confirm()}>{reading ? `CONFIRMAR EN ${seconds} S` : "CONFIRMAR"}</button>
      <button type="button" className={styles.back} disabled={busy} onClick={() => setSelection(null)}>Volver a las opciones</button>
    </div> : <div className={styles.actions}>
      {expired && <p role="status" className={styles.expired}>Se acabó el tiempo. No se hizo ningún cambio.</p>}
      <button type="button" disabled={busy} className={`tactile-primary ${styles.button}`} onClick={() => choose("save")}>Guardar (recomendado)</button>
      <button type="button" disabled={busy} className={`soft-button ${styles.button}`} onClick={() => choose("discard")}>No guardar</button>
      <button type="button" disabled={busy} className={styles.back} onClick={() => choose("later")}>Más tarde</button>
    </div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </Modal>;
}
