"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check, Compass, Flag, Target } from "lucide-react";
import { M1_AXES, M1_UNITS } from "@/lib/m1-curriculum";
import { useLearning } from "./use-learning";
import { LearningSetup } from "./learn-experience";
import { LearningError, LearningLoading } from "./question-card";
import styles from "./learning.module.css";
import { LearningQuestionWorkspace } from "./learning-question-workspace";
import mobileStyles from "./workspace/mobile-question.module.css";

export function LearningDiagnostic({ resultOnly = false }: { resultOnly?: boolean }) {
  const learning = useLearning();
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const state = learning.state;
  const diagnostic = state?.diagnostic;
  const answered = Object.keys(diagnostic?.answers ?? {}).length;
  const questionId = diagnostic?.questionIds.find((id) => !diagnostic.answers[id]);
  const meta = learning.catalog.find((question) => question.id === questionId);
  const missingUnits = M1_UNITS.filter((unit) => !learning.catalog.some((question) => question.unitId === unit.id && question.eligible));
  const start = async () => { setBusy(true); const result = await learning.dispatch({ type: "start-diagnostic" }); if (result) setStarted(true); setBusy(false); };
  const confirm = async () => {
    if (!meta || !selected || busy || !ready) return;
    setBusy(true);
    const result = await learning.dispatch({ type: "answer-diagnostic", questionId: meta.id, answer: selected });
    if (result) { setSelected(""); setReady(false); setStarted(true); }
    setBusy(false);
  };
  const finish = async () => { setBusy(true); const result = await learning.dispatch({ type: "complete-diagnostic" }); if (result) router.replace("/diagnostico/resultado"); setBusy(false); };
  if (!learning.loading && state && diagnostic && !diagnostic.completedAt && !resultOnly && meta && (started || answered === 0)) return <LearningQuestionWorkspace
    key={meta.id} meta={meta} context="diagnostic" scratchpadKey={`${diagnostic.id}:${meta.id}`} selected={selected} onSelect={setSelected}
    locked={busy} revealSolution={false} onReady={value => { setReady(value); if (value) void learning.dispatch({ type: "expose", questionId: meta.id, mode: "diagnostic", sessionId: diagnostic.id }); }}
    number={meta.number} total={diagnostic.questionIds.length} progress={answered} progressMax={diagnostic.questionIds.length}
    subtitle={`Diagnóstico · ${answered + 1} de ${diagnostic.questionIds.length} · Sin tiempo límite`} onClose={() => { if (!busy) router.push("/app/aprender"); }} busy={busy}
    steps={diagnostic.questionIds.map((id, index) => ({ number: index + 1, answered: !!diagnostic.answers[id], current: id === meta.id }))}
    showAiHelp={false} onAiHelp={() => {}} notices={learning.error ? <LearningError message={learning.error} /> : undefined}
    footer={drawing => <div className={mobileStyles.sessionActions}><button type="button" className="tactile-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold disabled:opacity-40" disabled={!selected || busy || !ready || drawing} onClick={() => void confirm()}>{busy ? "Guardando…" : "Confirmar y continuar"}<ArrowRight size={17} /></button></div>} />;
  return <main className={`${styles.root} min-h-dvh bg-[var(--canvas)]`}>
    <div className="mx-auto max-w-[1080px] px-5 pt-5"><Link href="/" className="inline-flex min-h-11 items-center gap-2 text-base font-extrabold tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--primary)] text-white"><Flag size={17} /></span>PAESSED<span className="ml-2 hidden text-xs font-semibold text-[var(--muted)] sm:inline">Tu punto de partida M1</span></Link></div>
    {learning.loading || !state ? <LearningLoading label="Preparando tu diagnóstico…" /> : <div className={styles.session}>
      {learning.error && <LearningError message={learning.error} retry={() => void learning.refresh()} />}
      {(!learning.catalog.length || !diagnostic && missingUnits.length > 0) ? <div className={`${styles.card} mx-auto max-w-xl`}><h1 className="text-xl font-extrabold">Todavía no hay preguntas suficientes</h1><p className={`${styles.muted} mt-3`}>Necesitamos una pregunta verificada por cada subeje para preparar el diagnóstico. Faltan {missingUnits.length} de los 16 subejes.</p><Link href="/app/ensayos" className={`${styles.secondary} mt-5`}>Ver mis ensayos</Link></div> : diagnostic?.completedAt ? <DiagnosticResult learning={learning} /> : !diagnostic ? <LearningSetup state={state} dispatch={learning.dispatch} onContinue={() => void start()} /> : resultOnly ? <section className={`${styles.summary} ${styles.card}`}><Compass size={42} className="mx-auto mb-5 text-[var(--primary)]" /><h1 className="text-2xl font-extrabold">Tu diagnóstico sigue en curso</h1><p className={`${styles.muted} my-5`}>Tienes {answered} de 16 respuestas guardadas. Los resultados estarán disponibles cuando termines.</p><Link className={styles.primary} href="/diagnostico">Retomar diagnóstico <ArrowRight size={17} /></Link></section> : !started && answered > 0 && answered < 16 ? <section className={`${styles.summary} ${styles.card}`}><div className={styles.summaryMark}><Compass size={42} /></div><span className={styles.eyebrow}>El siguiente paso te espera</span><h1 className="mt-3 text-2xl font-extrabold">Retoma donde quedaste.</h1><p className={`${styles.muted} my-5`}>Guardamos {answered} de tus 16 respuestas. Continúa a tu ritmo; verás el resultado al finalizar.</p><div className={`${styles.progress} mb-7`}><span style={{ width: `${answered / 16 * 100}%` }} /></div><button className={styles.primary} onClick={() => setStarted(true)}>Continuar diagnóstico <ArrowRight size={17} /></button></section> : answered === 16 ? <section className={`${styles.summary} ${styles.card}`}><div className={styles.summaryMark}><Check size={44} /></div><span className={styles.eyebrow}>16 de 16 respuestas guardadas</span><h1 className="mt-3 text-2xl font-extrabold">Ya tenemos tu punto de partida.</h1><p className={`${styles.muted} my-5`}>Una primera mirada a los cuatro ejes de M1. Con cada nueva sesión, tu mapa tendrá más evidencia.</p><button className={styles.primary} disabled={busy} onClick={() => void finish()}>{busy ? "Preparando resultados…" : "Ver mi diagnóstico"}<ArrowRight size={17} /></button></section> : <LearningError message="No encontramos la siguiente pregunta. Tus respuestas están guardadas." retry={() => void learning.refresh()} />}
    </div>}
  </main>;
}

function DiagnosticResult({ learning }: { learning: ReturnType<typeof useLearning> }) {
  const diagnostic = learning.state!.diagnostic!;
  const attempts = learning.state!.attempts.filter((attempt) => attempt.sessionId === diagnostic.id && attempt.mode === "diagnostic");
  const totalCorrect = attempts.filter((attempt) => attempt.correct).length;
  return <section className="mx-auto max-w-[760px] pb-12">
    <div className="mb-8 text-center"><div className={styles.summaryMark}><Compass size={43} /></div><span className={styles.eyebrow}>Diagnóstico completado</span><h1 className={`${styles.title} mt-3`}>Este es tu punto de partida.</h1><p className={`${styles.muted} mx-auto mt-4 max-w-lg`}>No es una nota ni una predicción de puntaje. Es la primera señal para elegir qué practicar.</p></div>
    <div className={styles.card}><div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-6"><div><span className={styles.eyebrow}>Respuestas originales</span><p className="mt-2 text-4xl font-extrabold tracking-tight">{totalCorrect}<span className="text-xl text-[var(--muted)]">/16</span></p></div><span className={`${styles.badge} !bg-[var(--secondary-soft)] !text-[var(--secondary)]`}>Lectura provisional</span></div>
      {M1_AXES.map((axis) => {
        const axisAttempts = attempts.filter((attempt) => attempt.axisId === axis.id);
        const count = axisAttempts.filter((attempt) => attempt.correct).length;
        return <div className={styles.resultRow} key={axis.id}><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--secondary)]"><Target size={20} /></span><div><strong>{axis.name}</strong><p>{axisAttempts.length}/{axis.units.length} subejes observados · señal provisional</p></div><span className="text-sm font-extrabold">{count}/{axisAttempts.length}</span></div>;
      })}
      <p className="mt-5 text-xs leading-6 text-[var(--muted)]">Una pregunta no representa todo un subeje. La estimación por eje aparecerá después de 15 respuestas elegibles, con más oportunidades de practicar y cubrir contenidos.</p>
    </div>
    <div className={`${styles.notice} my-6`}><strong className="flex items-center gap-2"><Flag size={18} className="text-[var(--primary)]" />Tu ruta ya puede empezar</strong><p className="mt-2 text-[var(--muted)]">Alternaremos práctica y repaso. Cada nodo reúne cinco preguntas y después vuelves a trabajar tus errores.</p></div>
    <div className="flex justify-center"><Link href="/app/aprender" className={styles.primary}>Comenzar mi ruta <ArrowRight size={18} /></Link></div><p className="mt-5 text-center text-xs text-[var(--muted)]">Tu diagnóstico y tu avance se guardan en este navegador.</p>
  </section>;
}
