"use client";

import { AuthCard } from "./auth-form";
import { Modal } from "./modal";
import styles from "./auth-dialog.module.css";

export function AuthDialog({ mode = "login", diagnostic = false, accountsAvailable = true, onDismiss }: { mode?: "login" | "register"; diagnostic?: boolean; accountsAvailable?: boolean; onDismiss: () => void }) {
  const dismiss = () => { if (diagnostic) { try { sessionStorage.removeItem("paessed-auth-return-to"); } catch { /* Browser storage may be unavailable. */ } } onDismiss(); };
  return <Modal labelledBy="auth-title" onDismiss={dismiss} className={styles.dialog}>
    <button type="button" onClick={dismiss} className={styles.back}>← Volver</button>
    <AuthCard mode={mode} accountsAvailable={accountsAvailable} returnTo={diagnostic ? "/diagnostico" : undefined} introduction={diagnostic ? <p className={styles.explanation}>El diagnóstico usa 16 preguntas para conocer tus fortalezas y orientar tu ruta de M1. Crea tu cuenta o inicia sesión para guardar tu punto de partida.</p> : undefined} />
    <button type="button" className={styles.later} onClick={dismiss}>Más tarde</button>
  </Modal>;
}
