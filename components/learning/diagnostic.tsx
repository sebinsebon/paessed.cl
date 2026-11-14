"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-provider";
import { initializeSyncIdentity } from "@/lib/sync/client";
import { getSyncOwner } from "@/lib/sync/local";
import { loadLearningCatalog } from "@/lib/learning/catalog";
import { getProfile, planLearning } from "@/lib/learning/engine";
import { dispatchDiagnostic, readDiagnosticState, subscribeDiagnostic } from "@/lib/learning/repository";
import type { LearningAction, LearningAttempt, LearningQuestion, LearningState } from "@/lib/learning/types";
import { ArrowRight, Check, ChevronDown, X } from "lucide-react";
import { M1_AXES, M1_UNITS, type M1AxisId } from "@/lib/m1-curriculum";
import { LearningError, LearningLoading } from "./question-card";
import styles from "./diagnostic-flow.module.css";
import { LearningQuestionWorkspace } from "./learning-question-workspace";
import mobileStyles from "./workspace/mobile-question.module.css";
import { AuthDialog } from "@/components/auth-dialog";
import { useAccount } from "@/components/use-account";

const AXIS_PRESENTATION: Record<M1AxisId, { emoji: string; shortName: string; description: string }> = {
  numeros: { emoji: "1f522", shortName: "Números", description: "Cálculos, porcentajes, potencias y raíces." },
  algebra: { emoji: "1f9ee", shortName: "Álgebra", description: "Relaciones, ecuaciones y funciones." },
  geometria: { emoji: "1f4cf", shortName: "Geometría", description: "Figuras, medidas y transformaciones." },
  datos: { emoji: "1f4ca", shortName: "Datos", description: "Gráficos, medidas de posición y probabilidades." },
};

export function LearningDiagnostic({ resultOnly = false }: { resultOnly?: boolean }) {
  const [identity, setIdentity] = useState<{ owner: string | null } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void initializeSyncIdentity().then(value => { if (active) setIdentity(value); }).catch(err => { if (active) setError(err instanceof Error ? err.message : "No se pudo leer tu cuenta."); });
    const changed = () => { if (active) setIdentity({ owner: getSyncOwner() }); };
    window.addEventListener("paessed-sync-owner-change", changed);
    return () => { active = false; window.removeEventListener("paessed-sync-owner-change", changed); };
  }, []);
  if (error) return <DiagnosticShell><LearningError message={error} /></DiagnosticShell>;
  if (!identity) return <DiagnosticShell><LearningLoading label="Preparando tu diagnóstico…" /></DiagnosticShell>;
  return <DiagnosticSession key={identity.owner ?? "guest"} resultOnly={resultOnly} authenticatedOwner={identity.owner} />;
}

function DiagnosticShell({ children }: { children: ReactNode }) {
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" aria-label="Paessed, inicio" className={styles.logo}>
        <img className={styles.logoLight} src="/paessed-logo.svg" alt="PAESSED" width="154" height="28" />
        <img className={styles.logoDark} src="/paessed-logo-dark.svg" alt="PAESSED" width="154" height="28" />
      </Link>
      <ThemeToggle />
    </header>
    <div className={styles.content}>{children}</div>
  </main>;
}

/** A diagnostic is a draft until /bienvenida confirms inclusion. In particular,
 * authenticated practice evidence cannot change while answering these 16 Qs. */
function useDiagnosticLearning() {
  const [state, setState] = useState<LearningState | null>(null);
  const [catalog, setCatalog] = useState<LearningQuestion[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [saved, questions] = await Promise.all([readDiagnosticState(), loadLearningCatalog()]);
      setCatalog(questions);
      setState(previous => previous && previous.learnerId === saved.learnerId && previous.revision > saved.revision ? previous : planLearning(saved, questions));
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo leer tu diagnóstico."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); return subscribeDiagnostic(() => { void refresh(); }); }, [refresh]);
  const dispatch = useCallback(async (action: LearningAction) => {
    try { const next = await dispatchDiagnostic(action, catalog); setState(next); setError(""); return next; }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar tu respuesta."); return null; }
  }, [catalog]);
  return { state, catalog, profile: state ? getProfile(state) : null, loading, error, dispatch, refresh };
}

function DiagnosticSession({ resultOnly = false, authenticatedOwner }: { resultOnly?: boolean; authenticatedOwner: string | null }) {
  const learning = useDiagnosticLearning();
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
  if (state?.initialDiagnostic && !diagnostic?.completedAt) return <DiagnosticShell><section className={styles.card}><h1 className={styles.title}>Tu punto de partida está listo</h1><p className={styles.description}>Puedes continuar con tu ruta y tu dominio actual.</p><Link href="/app/inicio" className={`${styles.primary} tactile-primary`}>Continuar <ArrowRight size={17} /></Link></section></DiagnosticShell>;
  if (!learning.loading && state && diagnostic && !diagnostic.completedAt && !resultOnly && meta && (started || answered === 0)) return <LearningQuestionWorkspace
    key={meta.id} meta={meta} context="diagnostic" scratchpadKey={`${diagnostic.id}:${meta.id}`} selected={selected} onSelect={setSelected}
    locked={busy} revealSolution={false} onReady={value => { setReady(value); if (value) void learning.dispatch({ type: "expose", questionId: meta.id, mode: "diagnostic", sessionId: diagnostic.id }); }}
    number={meta.number} total={diagnostic.questionIds.length} progress={answered} progressMax={diagnostic.questionIds.length}
    subtitle={`Diagnóstico · ${answered + 1} de ${diagnostic.questionIds.length} · Sin tiempo límite`} onClose={() => { if (!busy) router.push(authenticatedOwner ? "/app/aprender" : "/"); }} busy={busy}
    steps={diagnostic.questionIds.map((id, index) => ({ number: index + 1, answered: !!diagnostic.answers[id], current: id === meta.id }))}
    showAiHelp={false} onAiHelp={() => {}} notices={learning.error ? <LearningError message={learning.error} /> : undefined}
    footer={drawing => <div className={mobileStyles.sessionActions}><button type="button" className="tactile-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold disabled:opacity-40" disabled={!selected || busy || !ready || drawing} onClick={() => void confirm()}>{busy ? "Guardando…" : "Confirmar y continuar"}<ArrowRight size={17} /></button></div>} />;
  return <DiagnosticShell>
    {learning.loading || !state ? <LearningLoading label="Preparando tu diagnóstico…" /> : <>
      {learning.error && <LearningError message={learning.error} retry={() => void learning.refresh()} />}
      {(!learning.catalog.length || !diagnostic && missingUnits.length > 0) ? <section className={styles.card}><h1 className={styles.title}>Todavía no hay preguntas suficientes</h1><p className={styles.description}>Faltan preguntas verificadas para {missingUnits.length} de los 16 subejes.</p><Link href="/app/ensayos" className={styles.secondary}>Ver mis ensayos</Link></section> : diagnostic?.completedAt ? <DiagnosticResult learning={learning} authenticatedOwner={authenticatedOwner} /> : !diagnostic ? <section className={`${styles.card} ${styles.setup}`} aria-busy={busy}>
        <div className={styles.setupIllustration} aria-hidden="true"><img src="/emoji-apple/1f3af.png" alt="" width="80" height="80" className={styles.setupEmoji} /></div>
        <h1 className={styles.title}>Diagnóstico M1</h1>
        <p className={styles.description}><strong>16 preguntas</strong> para conocer<br /> tu punto de partida.</p>
        <ul className={styles.setupAxes} aria-label="Los cuatro ejes del diagnóstico">{M1_AXES.map(axis => <li key={axis.id}>
          <img src={`/emoji-apple/${AXIS_PRESENTATION[axis.id].emoji}.png`} alt="" width="36" height="36" />
          <span>{AXIS_PRESENTATION[axis.id].shortName}</span>
        </li>)}</ul>
        <button type="button" className={`${styles.primary} tactile-primary`} disabled={busy} onClick={() => void start()}>{busy ? "Preparando…" : "Empezar diagnóstico"}<ArrowRight size={17} /></button>
        <p className={styles.setupNote}>Una pregunta por subeje · Sin límite de tiempo</p>
        <p className={styles.footnote}>Tus respuestas se guardan en este navegador.</p>
      </section> : resultOnly ? <section className={styles.card}><h1 className={styles.title}>Tu diagnóstico sigue en curso</h1><p className={styles.description}>{answered} de 16 respuestas guardadas. Termina para ver tus resultados.</p><Link className={`${styles.primary} tactile-primary`} href="/diagnostico">Retomar diagnóstico <ArrowRight size={17} /></Link></section> : !started && answered > 0 && answered < 16 ? <section className={styles.card}><h1 className={styles.title}>Retoma tu diagnóstico</h1><p className={styles.description}>{answered} de 16 respuestas guardadas.</p><progress className={styles.progress} value={answered} max={16} aria-label="Preguntas respondidas" /><button type="button" className={`${styles.primary} tactile-primary`} onClick={() => setStarted(true)}>Continuar diagnóstico <ArrowRight size={17} /></button></section> : answered === 16 ? <section className={styles.card}><h1 className={styles.title}>Diagnóstico completado</h1><p className={styles.description}>Tus 16 respuestas están guardadas.</p><button type="button" className={`${styles.primary} tactile-primary`} disabled={busy} onClick={() => void finish()}>{busy ? "Preparando resultados…" : "Ver resultados"}<ArrowRight size={17} /></button></section> : <LearningError message="No encontramos la siguiente pregunta. Tus respuestas están guardadas." retry={() => void learning.refresh()} />}
    </>}
  </DiagnosticShell>;
}

function DiagnosticResult({ learning, authenticatedOwner }: { learning: ReturnType<typeof useDiagnosticLearning>; authenticatedOwner: string | null }) {
  const [auth, setAuth] = useState<"login" | "register" | null>(null);
  const { account } = useAccount();
  const diagnostic = learning.state!.diagnostic!;
  const attempts = learning.state!.attempts.filter((attempt) => attempt.sessionId === diagnostic.id && attempt.mode === "diagnostic" && diagnostic.questionIds.includes(attempt.questionId));
  const totalCorrect = attempts.filter((attempt) => attempt.correct).length;
  return <section className={styles.result}>
    <div className={styles.completed}><Check size={15} aria-hidden="true" /> Diagnóstico completado</div>
    <h1 className={styles.title}>Tu punto de partida</h1>
    <p className={styles.description}>Ya tienes una primera mirada a los cuatro ejes de M1.</p>
    <div className={styles.resultSummary}>
      <div><p className={styles.summaryLabel}>Tus respuestas originales</p><p className={styles.correctTotal}><strong>{totalCorrect} <span>de {diagnostic.questionIds.length}</span></strong> correctas</p></div>
      <div className={styles.summaryContext}><span className={styles.badge}>Resultado provisional</span><p>Orienta tu práctica.<br />No predice tu puntaje PAES.</p></div>
    </div>
    <section className={styles.learningMap} aria-labelledby="diagnostic-map-title">
      <div className={styles.mapHeading}><h2 id="diagnostic-map-title">Tu mapa de M1</h2><p>Cada punto es una pregunta de este diagnóstico.</p></div>
      <div className={styles.mapLegend}><span><Check size={13} aria-hidden="true" />Correcta</span><span><X size={13} aria-hidden="true" />Incorrecta</span></div>
      <div className={styles.axes}>{M1_AXES.map(axis => <DiagnosticAxisCard key={axis.id} axis={axis} attempts={attempts.filter(attempt => attempt.axisId === axis.id)} questionIds={diagnostic.questionIds} />)}</div>
    </section>
    <aside className={styles.calibrationNote} aria-labelledby="diagnostic-calibration-title">
      <h2 id="diagnostic-calibration-title">Una señal para empezar</h2>
      <p>Una pregunta por subeje no basta para estimar tu dominio. Cada eje sigue en calibración: necesita al menos <strong>15 respuestas elegibles</strong>, sin ayuda, para estimarlo.</p>
    </aside>
    <div className={styles.nextStep}>
      <h2>Sigamos desde aquí</h2>
      <p className={styles.description}>{authenticatedOwner ? "Continúa para guardar este diagnóstico en tu cuenta." : "Crea una cuenta para guardar tu diagnóstico y empezar tu ruta."}</p>
      <div className={styles.actions}>{authenticatedOwner ? <Link href="/bienvenida" className={`${styles.primary} tactile-primary`}>Continuar <ArrowRight size={17} /></Link> : <><button type="button" onClick={() => setAuth("register")} className={`${styles.primary} tactile-primary`}>Crear cuenta <ArrowRight size={17} /></button><button type="button" onClick={() => setAuth("login")} className={styles.secondary}>Ya tengo cuenta</button></>}</div>
      <p className={styles.footnote}>Tus respuestas están guardadas en este navegador.</p>
    </div>
    {auth && <AuthDialog mode={auth} accountsAvailable={account?.configured ?? false} onDismiss={() => setAuth(null)} />}
  </section>;
}

function DiagnosticAxisCard({ axis, attempts, questionIds }: { axis: (typeof M1_AXES)[number]; attempts: LearningAttempt[]; questionIds: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const presentation = AXIS_PRESENTATION[axis.id];
  const correct = attempts.filter(attempt => attempt.correct).length;
  const eligible = attempts.filter(attempt => attempt.eligible && !attempt.assisted).length;
  const ordered = [...attempts].sort((a, b) => questionIds.indexOf(a.questionId) - questionIds.indexOf(b.questionId));
  const detailsId = `diagnostic-details-${axis.id}`;
  return <article className={styles.axisCard} data-axis={axis.id}>
    <div className={styles.axisHeading}>
      <div className={styles.axisEmoji}><img src={`/emoji-apple/${presentation.emoji}.png`} alt="" width="36" height="36" /></div>
      <div><h3>{axis.name}</h3><p>{presentation.description}</p></div>
    </div>
    <p className={styles.axisCount}><strong>{correct} de {attempts.length}</strong> correctas</p>
    <ol className={styles.questionDots} aria-label={`Respuestas en ${axis.name}`}>{ordered.map(attempt => {
      const unit = axis.units.find(unit => unit.id === attempt.unitId);
      const label = `Pregunta ${questionIds.indexOf(attempt.questionId) + 1}: ${attempt.correct ? "correcta" : "incorrecta"}. ${unit?.name ?? ""}`;
      return <li key={attempt.id} className={attempt.correct ? styles.correctDot : styles.incorrectDot} title={label}>
        {attempt.correct ? <Check size={15} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}<span className={styles.srOnly}>{label}</span>
      </li>;
    })}</ol>
    <button type="button" className={styles.expandButton} aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(value => !value)}>
      <span>{expanded ? "Ocultar subejes" : "Ver subejes"}<span className={styles.srOnly}> de {axis.name}</span></span><ChevronDown size={16} aria-hidden="true" />
    </button>
    <div id={detailsId} hidden={!expanded} className={styles.axisDetails}>
      <div className={styles.unitHeading} aria-hidden="true"><span>Subeje</span><span>Aciertos</span></div>
      <ul className={styles.unitResults}>{axis.units.map(unit => {
        const unitAttempts = attempts.filter(attempt => attempt.unitId === unit.id);
        const count = unitAttempts.filter(attempt => attempt.correct).length;
        return <li key={unit.id}><span>{unit.name}</span><span className={styles.unitCount}>{unitAttempts.length ? <><span aria-hidden="true">{count}/{unitAttempts.length}</span><span className={styles.srOnly}>{count} de {unitAttempts.length} correctas</span></> : "Sin registro"}</span></li>;
      })}</ul>
      <div className={styles.meaning}><h4>Qué significa</h4><p>{attempts.length === 0 ? "No hay respuestas registradas en este eje para interpretar. Necesitamos más evidencia para orientar la práctica." : correct === attempts.length ? "Acertaste todas las preguntas observadas en este eje. Es un buen comienzo; falta más práctica para estimar tu dominio." : correct === 0 ? "Estas respuestas dan un lugar desde donde empezar a practicar. No determinan todo lo que sabes de este eje." : "Los aciertos son una primera señal; los errores te muestran qué puedes practicar. Una pregunta no define lo que sabes de un subeje."}</p></div>
      <p className={styles.axisCalibration}>En calibración · {eligible} de 15 respuestas elegibles en este diagnóstico.</p>
    </div>
  </article>;
}
