"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CircleCheck, Flag, RotateCcw, Trophy, X } from "lucide-react";
import type { LearningAction, LearningNode, LearningQuestion, LearningState } from "@/lib/learning/types";
import { LearningError } from "./question-card";
import { LearningQuestionWorkspace } from "./learning-question-workspace";
import styles from "./learning.module.css";
import sessionStyles from "./node-session.module.css";

type Dispatch = (action: LearningAction) => Promise<LearningState | null>;

export function NodeSession({ node, state, catalog, dispatch, error, onClose }: { node: LearningNode; state: LearningState; catalog: LearningQuestion[]; dispatch: Dispatch; error: string; onClose: () => void }) {
  const [phase, setPhase] = useState<"original" | "summary" | "correction" | "done">(node.state === "completed" ? "done" : node.state === "correction" ? "summary" : "original");
  const [displayId, setDisplayId] = useState(node.questionIds.find((id) => !node.answers[id]) ?? node.questionIds[0]);
  const [selected, setSelected] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<null | { correct: boolean; answer: string; questionId: string; round: "original" | "correction" }>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const originalCount = node.originalCorrect ?? node.questionIds.filter((id) => node.answers[id] === catalog.find((question) => question.id === id)?.correct).length;
  const errors = node.questionIds.filter((id) => !!node.answers[id] && node.answers[id] !== catalog.find((question) => question.id === id)?.correct);
  const unresolved = errors.filter((id) => !node.corrections[id]?.resolved);
  const correctionId = unresolved[0];
  const holdingCorrectionFeedback = phase === "correction" && feedback?.round === "correction" && feedback.correct;
  const questionId = phase === "correction" ? holdingCorrectionFeedback ? feedback.questionId : correctionId : displayId;
  const currentFeedback = feedback && feedback.questionId === questionId && feedback.round === phase ? feedback : null;
  const meta = catalog.find((question) => question.id === questionId);
  const repeated = state.exposures.some(e=>e.questionId===questionId&&e.sessionId!==node.id)||state.attempts.some(a=>a.questionId===questionId&&a.sessionId!==node.id);
  const correction = node.corrections[questionId];
  const showSolution = phase === "correction" && (correction?.tries ?? 0) >= 2 && !correction?.resolved;
  const correctionDone = phase === "correction" && !correctionId && !holdingCorrectionFeedback;
  const answered = Object.keys(node.answers).length;
  const complete = async () => { setBusy(true); const result = await dispatch({ type: "complete-node", nodeId: node.id }); if (result) setPhase("done"); setBusy(false); };
  const confirm = async () => {
    if (!meta || !selected || busy) return;
    setBusy(true);
    const result = await dispatch({ type: phase === "correction" ? "retry" : "answer", nodeId: node.id, questionId: meta.id, answer: selected });
    if (result) { setFeedback({ correct: selected === meta.correct, answer: selected, questionId: meta.id, round: phase === "correction" ? "correction" : "original" }); if (phase === "correction") setSelected(""); }
    setBusy(false);
  };
  const nextOriginal = () => { setFeedback(null); setSelected(""); const next = node.questionIds.find((id) => !node.answers[id]); if (next) setDisplayId(next); else setPhase(node.state === "completed" ? "done" : "summary"); };
  const review = async () => { setBusy(true); const result = await dispatch({ type: "review", nodeId: node.id, questionId }); if (result) { setFeedback(null); setSelected(""); } setBusy(false); };
  useEffect(() => { if (phase === "correction") { setSelected(""); setFeedback(null); } }, [questionId, phase]);
  const summary = phase === "summary" || phase === "done" || correctionDone;
  const correctedCount = errors.filter((id) => node.corrections[id]?.resolved && !node.corrections[id]?.viaSolution).length;
  const reviewedCount = errors.filter((id) => node.corrections[id]?.viaSolution).length;
  useEffect(() => {
    const previous = document.body.style.overflow;
    const previousGutter = document.documentElement.style.scrollbarGutter;
    document.body.style.overflow = "hidden";
    document.documentElement.style.scrollbarGutter = "auto";
    return () => {
      document.body.style.overflow = previous;
      document.documentElement.style.scrollbarGutter = previousGutter;
    };
  }, []);
  useEffect(() => {
    scrollArea.current?.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [questionId, summary]);
  if (!summary && meta) return <LearningQuestionWorkspace
    key={meta.id} meta={meta} scratchpadKey={`${node.id}:${meta.id}`}
    selected={currentFeedback ? currentFeedback.answer : selected}
    checkedAnswer={currentFeedback?.answer}
    onSelect={answer => { setSelected(answer); if (phase === "correction") setFeedback(null); }} locked={!!currentFeedback && (phase === "original" || currentFeedback.correct) || showSolution || busy}
    revealSolution={showSolution}
    showAiHelp={!!node.answers[meta.id] && node.answers[meta.id] !== meta.correct || !!currentFeedback && !currentFeedback.correct}
    onAiHelp={() => { void dispatch({ type: "expose", questionId: meta.id, mode: "learn", sessionId: node.id, assisted: true }); }}
    onReady={loaded => { setReady(loaded); if (loaded) void dispatch({ type: "expose", questionId: meta.id, mode: "learn", sessionId: node.id }); }}
    number={meta.number} total={5} progress={phase === "correction" ? errors.length - unresolved.length : answered} progressMax={phase === "correction" ? errors.length : 5}
    subtitle={phase === "correction" ? `Corrección · ${errors.length - unresolved.length}/${errors.length} errores trabajados` : `Pregunta ${node.questionIds.indexOf(meta.id) + 1} de 5 · ${answered}/5 respondidas`}
    onClose={onClose} busy={busy}
    steps={node.questionIds.map((id, index) => ({ number: index + 1, answered: !!node.answers[id], current: id === questionId }))}
    notices={<>
      {error && <LearningError message={error} />}
      {repeated && <p className="mb-3 max-w-[1060px] text-xs text-[var(--pg-muted)]">Repaso · Ya viste esta pregunta. No sumará dominio, calibración ni XP.</p>}
      {node.substitution && <p className="mb-3 max-w-[1060px] text-xs text-[var(--pg-muted)]">Elegimos este subeje porque el previsto no tenía cinco preguntas disponibles.</p>}
    </>}
    footer={(drawing, aiHelp) => <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 flex-1 basis-full text-[11px] leading-5 text-[var(--pg-muted)] sm:basis-0" aria-live="polite">
        {currentFeedback ? currentFeedback.correct ? <strong className="inline-flex items-center gap-1.5 text-emerald-600"><Check size={15} />{phase === "correction" ? "¡Corregida!" : "¡Respuesta correcta!"}</strong> : <><strong className="text-rose-500">Todavía no es correcta. </strong>{phase === "original" ? "La retomarás al terminar las cinco preguntas." : showSolution ? "Revisa la solución y compárala con tu procedimiento." : "Te queda un intento antes de revisar la solución."}</> : showSolution ? "Lee la solución antes de continuar." : "Selecciona una alternativa y confirma."}
      </div>
      <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
        {aiHelp}
        {phase === "original" && currentFeedback ? <button className="tactile-primary inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 text-[11px] font-bold" onClick={nextOriginal}>{answered === 5 ? "Ver mi resultado" : "Siguiente pregunta"}<ArrowRight size={16} /></button> : phase === "correction" && currentFeedback?.correct ? <button className="tactile-primary inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 text-[11px] font-bold" onClick={() => { setSelected(""); setFeedback(null); }}>{correctionId ? "Siguiente pregunta" : "Ver mi resultado"}<ArrowRight size={16} /></button> : showSolution ? <button className="tactile-primary inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 text-[11px] font-bold disabled:opacity-45" disabled={busy || !ready || drawing} onClick={() => void review()}>Revisé la solución <Check size={16} /></button> : <button className="tactile-primary min-h-10 rounded-lg px-4 text-[11px] font-bold disabled:opacity-45" disabled={!selected || busy || !ready || drawing} onClick={() => void confirm()}>{busy ? "Guardando…" : phase === "correction" ? "Confirmar nuevo intento" : "Confirmar respuesta"}</button>}
      </div>
    </div>}
  />;
  return <section className={sessionStyles.viewport} aria-label="Sesión de aprendizaje" data-testid="learning-session">
    <header className={sessionStyles.header}>
      <button type="button" className={sessionStyles.exit} disabled={busy} onClick={onClose} aria-label="Guardar y cerrar sesión"><X size={20} /><span>Guardar y salir</span></button>
      <div className={sessionStyles.progress}>
        <p>{phase === "correction" ? "CORREGIR MIS ERRORES" : phase === "done" ? "SESIÓN COMPLETADA" : "CINCO PREGUNTAS · UN PASO MÁS"}</p>
        <div className={styles.progress} role="progressbar" aria-label="Progreso de la sesión" aria-valuemin={0} aria-valuemax={phase === "correction" ? errors.length : 5} aria-valuenow={phase === "correction" ? errors.length - unresolved.length : summary ? 5 : answered}>
          <span style={{ width: `${summary ? 100 : phase === "correction" ? (errors.length - unresolved.length) / Math.max(1, errors.length) * 100 : answered / 5 * 100}%`, background: phase === "done" ? "var(--success)" : undefined }} />
        </div>
      </div>
      <span className={sessionStyles.count}>{phase === "correction" ? `${errors.length - unresolved.length}/${errors.length}` : `${answered}/5`}</span>
    </header>
    <div className={sessionStyles.body} ref={scrollArea} data-testid="learning-question-scroll">
      <div className={sessionStyles.content}>
        {error && <LearningError message={error} />}
        {summary ? <div className={`${sessionStyles.summary} ${styles.card}`} ref={heading} tabIndex={-1}>
          <div className={styles.summaryMark}>{phase === "done" ? <Trophy size={44} /> : correctionDone ? <CircleCheck size={44} /> : <Flag size={44} />}</div>
          <span className={styles.eyebrow}>{phase === "done" ? "Un paso que ya es tuyo" : correctionDone ? "Errores trabajados" : "Primera vuelta completa"}</span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{phase === "done" ? "¡Nodo completado!" : errors.length && !correctionDone ? "Ahora viene el aprendizaje." : "Buen trabajo. Sigue avanzando."}</h1>
          <p className={styles.score}>{originalCount}<span className="text-3xl text-[var(--muted-2)]">/5</span></p>
          <p className={styles.muted}>correctas en tus respuestas originales</p>
          {phase === "done" || correctionDone ? <div className={styles.summaryGrid}><div><strong>{correctedCount}</strong><span>Corregidas</span></div><div><strong>{reviewedCount}</strong><span>Soluciones revisadas</span></div><div><strong>{phase === "done" ? `+${node.xp ?? 0}` : "—"}</strong><span>XP {phase === "done" ? "de este nodo" : "al completar"}</span></div></div> : <p className={`${styles.muted} my-6`}>{errors.length ? `Volverás a ${errors.length === 1 ? "la pregunta que faltó" : `las ${errors.length} preguntas que faltaron`}. Tienes dos intentos nuevos por pregunta antes de revisar la solución.` : "Respondiste las cinco correctamente. Completa este nodo para guardar el avance y sumar tus XP."}</p>}
          {phase === "done" ? <><p className={`${styles.muted} mb-6`}>La corrección queda registrada por separado: tu resultado original sigue siendo {originalCount}/5.</p><button className={styles.primary} onClick={onClose}>Volver a mi ruta <ArrowRight size={17} /></button></> : errors.length && !correctionDone ? <button className={styles.primary} onClick={() => setPhase("correction")}>Corregir mis errores <RotateCcw size={17} /></button> : <button className={styles.primary} disabled={busy} onClick={() => void complete()}>{busy ? "Guardando…" : "Completar nodo"}<Check size={18} /></button>}
        </div> : <LearningError message="No encontramos esta pregunta en el banco. Tu avance está guardado; cierra y vuelve a cargar la ruta." />}
      </div>
    </div>
  </section>;
}
