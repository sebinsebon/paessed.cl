"use client";

import Link from "next/link";
import { useState } from "react";
import { Dashboard } from "./dashboard";
import { useLearning } from "./learning/use-learning";
import { hasCompletedInitialDiagnostic } from "@/lib/learning/engine";
import styles from "./diagnostic-reminder.module.css";
import { Modal } from "./modal";
import { useProgressPromptPending } from "./progress-prompt-context";
import { useAccount } from "./use-account";
import { AuthDialog } from "./auth-dialog";

export function DashboardHome() {
  const learning = useLearning();
  const [dismissed, setDismissed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const progressPending = useProgressPromptPending();
  const { account, loading: accountLoading } = useAccount();
  const incomplete = !!learning.state && !hasCompletedInitialDiagnostic(learning.state);
  const reminder = !learning.loading && !learning.error && !progressPending && !accountLoading && incomplete && !dismissed;
  return <>
    <Dashboard suspendAutoTour={learning.loading || progressPending || incomplete} />
    {reminder && !authOpen && <DiagnosticReminder signedIn={!!account?.user} onAuthenticate={() => setAuthOpen(true)} answered={Object.keys(learning.state?.diagnostic?.answers ?? {}).length} onDismiss={() => setDismissed(true)} />}
    {reminder && authOpen && <AuthDialog mode="register" diagnostic accountsAvailable={account?.configured ?? false} onDismiss={() => { setAuthOpen(false); setDismissed(true); }} />}
  </>;
}

function DiagnosticReminder({ answered, onDismiss, signedIn, onAuthenticate }: { answered: number; onDismiss: () => void; signedIn: boolean; onAuthenticate: () => void }) {
  return <Modal labelledBy="diagnostic-reminder-title" describedBy="diagnostic-reminder-copy" onDismiss={onDismiss} className={styles.dialog}>
    <img src="/emoji-apple/1f4da.png" alt="" width="56" height="56" className={styles.emoji} />
    <h2 id="diagnostic-reminder-title" tabIndex={-1}>Nos falta tu punto de partida</h2>
    <p id="diagnostic-reminder-copy">Haz el diagnóstico para que tu ruta de Aprender se ajuste a lo que necesitas reforzar. Son 16 preguntas y puedes retomarlo cuando quieras.</p>
    {answered > 0 && <p className={styles.saved}>Ya tienes {answered} de 16 respuestas guardadas.</p>}
    <div className={styles.actions}>
      {signedIn ? <Link href="/diagnostico" className={`tactile-primary ${styles.primary}`}>{answered ? "Retomar diagnóstico" : "Hacer diagnóstico"}</Link> : <button type="button" className={`tactile-primary ${styles.primary}`} onClick={onAuthenticate}>Hacer diagnóstico</button>}
      <button type="button" className={`soft-button ${styles.secondary}`} onClick={onDismiss}>Más tarde</button>
    </div>
  </Modal>;
}
