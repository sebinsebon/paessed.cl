"use client";

import Link from "next/link";
import { takeAuthReturnTo } from "@/lib/auth/return-to";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-provider";
import { guestDiagnosticHandoff, initializeSyncIdentity, readCompletedDiagnostic, readOnboardingStatus, submitGuestDiagnostic, synchronize } from "@/lib/sync/client";
import { clearAccountDiagnosticDraft, readLearningState } from "@/lib/learning/repository";
import type { OnboardingSubmission } from "@/lib/sync/contracts";
import styles from "./learning/diagnostic-flow.module.css";

export function OnboardingHandoff({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  const inFlight = useRef(false);
  const load = useCallback(async (choice?: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setAsk(false); setError("");
    try {
      const identity = await initializeSyncIdentity();
      if (identity.owner !== ownerId) throw new Error("La sesión cambió. Vuelve a iniciar sesión para continuar.");
      const own = await readCompletedDiagnostic(ownerId);
      const value = own ?? await readCompletedDiagnostic();
      if (!value) { router.replace(takeAuthReturnTo()); return; }
      const id = value.diagnostic.id;
      let handoff = own ? undefined : await guestDiagnosticHandoff(id);
      if (handoff && (handoff.owner !== ownerId || handoff.confirmed)) { router.replace(takeAuthReturnTo()); return; }
      // Save a manual choice before any network request that could fail.
      if (!own && choice !== undefined) handoff = await guestDiagnosticHandoff(id, { owner: ownerId, choice });
      if (handoff && handoff.owner !== ownerId) { router.replace(takeAuthReturnTo()); return; }
      await synchronize(true);
      let status = await readOnboardingStatus(ownerId);
      let includeEvidence: OnboardingSubmission["includeEvidence"] = own ? true : handoff?.choice ?? "if-empty";
      const needsChoice = () => includeEvidence === "if-empty" && (status.hasEvidence || status.hasDiagnostic);
      if (!status.handledDiagnosticIds.includes(id)) {
        if (needsChoice()) { setAsk(true); return; }
        if (!own) {
          handoff = await guestDiagnosticHandoff(id, { owner: ownerId, choice: includeEvidence });
          if (handoff?.owner !== ownerId || handoff.confirmed) { router.replace(takeAuthReturnTo()); return; }
          includeEvidence = handoff.choice;
        }
        status = await submitGuestDiagnostic(ownerId, { ...value, includeEvidence });
        if (!status.handledDiagnosticIds.includes(id)) {
          if (needsChoice()) { setAsk(true); return; }
          throw new Error("El servidor aún no confirmó tu diagnóstico.");
        }
      }
      const saved = await readLearningState(ownerId);
      if (saved.initialDiagnostic?.sourceId !== id && !saved.diagnosticHandoffs?.some(receipt => receipt.sourceId === id) && saved.diagnostic?.id !== id) {
        throw new Error("Tu cuenta recibió el diagnóstico. Falta actualizar el resultado en este dispositivo.");
      }
      if (own) await clearAccountDiagnosticDraft(ownerId);
      else await guestDiagnosticHandoff(id, { owner: ownerId, choice: includeEvidence, confirmed: true });
      takeAuthReturnTo();
      router.replace((own || handoff?.choice === "if-empty") && saved.diagnostic?.completedAt ? "/diagnostico/resultado" : "/app/inicio");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo preparar tu cuenta."); }
    finally { inFlight.current = false; setBusy(false); }
  }, [ownerId, router]);
  useEffect(() => { void load(); }, [load]);
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" aria-label="Paessed, inicio" className={styles.logo}>
        <img className={styles.logoLight} src="/paessed-logo.svg" alt="PAESSED" width="154" height="28" />
        <img className={styles.logoDark} src="/paessed-logo-dark.svg" alt="PAESSED" width="154" height="28" />
      </Link>
      <ThemeToggle />
    </header>
    <div className={styles.content}><section className={styles.card} aria-busy={busy}>
      <h1 className={styles.title}>{ask ? "¿Sumar este diagnóstico a tu avance?" : error ? "Guardado pendiente" : "Preparando tu ruta"}</h1>
      {ask && <><p className={styles.description}>Puedes incorporar estas respuestas para orientar tus próximas prácticas.</p><p className={styles.footnote}>Se conservan tu ruta y tus sesiones. Las preguntas repetidas no suman dominio ni XP.</p>
        <div className={styles.stackedActions}>
          <button type="button" disabled={busy} className={`${styles.primary} tactile-primary`} onClick={() => void load(true)}>Sí, incorporar respuestas <ArrowRight size={17} /></button>
          <button type="button" disabled={busy} className={styles.secondary} onClick={() => void load(false)}>No, mantener mi dominio actual</button>
        </div></>}
      {busy && <p role="status" className={styles.status}>Revisando tu progreso…</p>}
      {error && <div className={styles.error} role="alert"><p>Tus respuestas siguen en este navegador. {error}</p><div className={styles.actions}><button type="button" disabled={busy} className={styles.secondary} onClick={() => void load()}>Reintentar</button><Link className={styles.textLink} href="/app/inicio">Volver a Inicio</Link></div></div>}
    </section></div>
  </main>;
}
