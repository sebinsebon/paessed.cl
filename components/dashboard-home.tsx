"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Dashboard } from "./dashboard";
import { useLearning } from "./learning/use-learning";
import { hasCompletedInitialDiagnostic } from "@/lib/learning/engine";
import styles from "./diagnostic-reminder.module.css";
import { useAccount } from "./use-account";
import { readDiagnosticState, subscribeDiagnostic } from "@/lib/learning/repository";
import { guestDiagnosticHandoff } from "@/lib/sync/client";
import { getSyncOwner, LOCAL_CHANGED } from "@/lib/sync/local";
import type { LearningState } from "@/lib/learning/types";
import { listExamSessions, type SavedDefaultExamSession } from "@/lib/learning/exam-repository";

type Draft = NonNullable<LearningState["diagnostic"]>;

export function DashboardHome() {
  const learning = useLearning();
  const { account } = useAccount();
  const owner = getSyncOwner();
  const [pending, setPending] = useState<{ draft: Draft | null; guest: boolean }>();
  const [exams, setExams] = useState<Record<string, SavedDefaultExamSession>>({});
  useEffect(() => {
    let active = true, version = 0;
    const refresh = async () => {
      const current = ++version;
      try {
        const own = (await readDiagnosticState(owner)).diagnostic;
        const guest = !own && owner ? (await readDiagnosticState()).diagnostic : null;
        const association = guest ? await guestDiagnosticHandoff(guest.id) : undefined;
        const available = !!guest && (!association || association.owner === owner && !association.confirmed);
        if (active && current === version) setPending({ draft: own ?? (available ? guest : null), guest: available });
      } catch {
        if (active && current === version) setPending({ draft: null, guest: false });
      }
    };
    void refresh();
    const stop = subscribeDiagnostic(() => void refresh(), owner);
    const stopGuest = owner ? subscribeDiagnostic(() => void refresh()) : undefined;
    return () => { active = false; stop(); stopGuest?.(); };
  }, [owner]);
  useEffect(() => {
    let active = true, version = 0;
    const refresh = () => {
      const current = ++version;
      void listExamSessions().then(value => {
        if (active && current === version) setExams(value);
      }).catch(() => {});
    };
    refresh();
    window.addEventListener(LOCAL_CHANGED, refresh);
    return () => { active = false; window.removeEventListener(LOCAL_CHANGED, refresh); };
  }, [owner]);
  const complete = !!learning.state && hasCompletedInitialDiagnostic(learning.state);
  const draft = pending?.draft;
  const answered = Object.keys(draft?.answers ?? {}).length;
  const pendingSave = !!draft?.completedAt && !!owner;
  const diagnostic = pending && learning.state && !learning.error && (!complete || pendingSave)
    ? <DiagnosticReminder answered={answered} href={pendingSave ? "/bienvenida" : pending.guest ? "/diagnostico?invitado=1" : "/diagnostico"} pendingSave={pendingSave} />
    : complete && learning.state?.diagnostic?.completedAt
      ? <Link href="/diagnostico/resultado" className={styles.resultLink}>Ver resultado del diagnóstico</Link>
      : null;
  return <Dashboard diagnostic={diagnostic} displayName={account?.profile?.displayName} state={learning.state} profile={learning.profile} examSessions={exams} />;
}

function DiagnosticReminder({ answered, href, pendingSave }: { answered: number; href: string; pendingSave: boolean }) {
  return <section aria-labelledby="diagnostic-reminder-title" className={styles.card}>
    <img src="/emoji-apple/1f3af.png" alt="" width="40" height="40" className={styles.emoji} />
    <div>
      <h2 id="diagnostic-reminder-title">{pendingSave ? "Tu diagnóstico está listo para guardarse" : "Tu diagnóstico M1"}</h2>
      <p>{answered ? `${answered} de 16 respuestas guardadas en este navegador.` : "16 preguntas para conocer tu punto de partida. Puedes hacerlas a tu ritmo."}</p>
    </div>
    <Link href={href} className={`tactile-primary ${styles.primary}`}>{pendingSave ? "Guardar diagnóstico" : answered ? "Retomar diagnóstico" : "Hacer diagnóstico"}</Link>
  </section>;
}
