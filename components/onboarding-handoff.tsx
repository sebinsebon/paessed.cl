"use client";

import Link from "next/link";
import { takeAuthReturnTo } from "@/lib/auth/return-to";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-provider";
import { initializeSyncIdentity, readCompletedGuestDiagnostic, readOnboardingStatus, submitGuestDiagnostic, synchronize } from "@/lib/sync/client";
import { listPendingOperations } from "@/lib/sync/local";
import type { OnboardingSubmission } from "@/lib/sync/contracts";
import styles from "./learning/diagnostic-flow.module.css";

type Guest = Omit<OnboardingSubmission, "includeEvidence">;
export function OnboardingHandoff({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const [guest, setGuest] = useState<Guest | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  const inFlight = useRef(false);
  const incorporate = useCallback(async (value: Guest, includeEvidence: boolean) => {
    const status = await submitGuestDiagnostic(ownerId, { ...value, includeEvidence });
    if (!status.complete) throw new Error("No pudimos confirmar tu diagnóstico. Vuelve a intentarlo.");
    takeAuthReturnTo();
    router.replace("/app/inicio"); router.refresh();
  }, [ownerId, router]);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const identity = await initializeSyncIdentity();
      if (identity.owner !== ownerId) throw new Error("La sesión cambió. Vuelve a iniciar sesión para continuar.");
      await synchronize(true);
      const [value, status] = await Promise.all([readCompletedGuestDiagnostic(), readOnboardingStatus(ownerId)]);
      if (value && !status.handledDiagnosticIds.includes(value.diagnostic.id)) {
        setGuest(value);
        if (!status.hasEvidence && !status.hasDiagnostic) await incorporate(value, true);
      } else {
        // Do not send a user back to the diagnostic while its completed local
        // answers are still waiting for a successful server acknowledgement.
        if ((await listPendingOperations(ownerId)).some(o => ["learning", "restore-learning", "reset"].includes(o.action.type))) {
          throw new Error("Tu progreso está guardado. Necesitamos sincronizarlo antes de continuar.");
        }
        router.replace(takeAuthReturnTo()); router.refresh();
      }
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo preparar tu cuenta."); }
    finally { inFlight.current = false; setBusy(false); }
  }, [ownerId, incorporate, router]);
  useEffect(() => { void load(); }, [load]);
  const choose = async (includeEvidence: boolean) => {
    if (!guest || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await incorporate(guest, includeEvidence); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar tu elección."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" aria-label="Paessed, inicio" className={styles.logo}>
        <img className={styles.logoLight} src="/paessed-logo.svg" alt="PAESSED" width="154" height="28" />
        <img className={styles.logoDark} src="/paessed-logo-dark.svg" alt="PAESSED" width="154" height="28" />
      </Link>
      <ThemeToggle />
    </header>
    <div className={styles.content}><section className={styles.card} aria-busy={busy}>
      <h1 className={styles.title}>{guest ? "¿Sumar este diagnóstico a tu avance?" : "Preparando tu ruta"}</h1>
      <p className={styles.description}>{guest ? "Te recomendamos incorporarlo para orientar tus próximas prácticas." : "Estamos revisando tu progreso para continuar donde quedaste."}</p>
      {guest && <><p className={styles.footnote}>Tu ruta y tus sesiones se conservan. Las preguntas repetidas no suman dominio ni XP.</p>
        <div className={styles.stackedActions}>
          <button type="button" disabled={busy} className={`${styles.primary} tactile-primary`} onClick={() => void choose(true)}>Sí, incorporar respuestas <ArrowRight size={17} /></button>
          <button type="button" disabled={busy} className={styles.secondary} onClick={() => void choose(false)}>No, mantener mi dominio actual</button>
        </div></>}
      {busy && <p role="status" className={styles.status}>{guest ? "Guardando tu diagnóstico…" : "Revisando tu progreso…"}</p>}
      {error && <div className={styles.error} role="alert"><p>{error}</p><div className={styles.actions}><button type="button" disabled={busy} className={styles.secondary} onClick={() => void load()}>Reintentar</button><Link className={styles.textLink} href="/login">Iniciar sesión</Link></div></div>}
    </section></div>
  </main>;
}
