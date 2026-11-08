"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpen, Flag } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { DailyGoal, LearningAction, LearningState } from "@/lib/learning/types";
import { useLearning } from "./use-learning";
import { LearningError, LearningLoading } from "./question-card";
import { NodeSession } from "./node-session";
import { LearningRouteDashboard } from "./route/learning-route";
import styles from "./learning.module.css";

type Dispatch = (action: LearningAction) => Promise<LearningState | null>;

export function LearnExperience() {
  const learning = useLearning();
  const [openNode, setOpenNode] = useState<string | null>(null);
  const [closedNode, setClosedNode] = useState<string | null>(null);
  const active = learning.state?.nodes.find((node) => node.id === openNode);
  if (active) return <AppShell title="Tu sesión de aprendizaje" immersive><div className={`${styles.root} h-full`}><NodeSession key={active.id} node={active} state={learning.state!} catalog={learning.catalog} dispatch={learning.dispatch} error={learning.error} onClose={() => { setOpenNode(null); setClosedNode(active.id); }} /></div></AppShell>;
  return <AppShell title="Aprender" eyebrow="Tu ruta M1"><div className={styles.root}>
    {learning.error && <LearningError message={learning.error} retry={() => void learning.refresh()} />}
    {learning.loading || !learning.state ? <LearningLoading /> : !learning.catalog.length ? <EmptyBank /> : !learning.state.diagnostic ? <LearningSetup state={learning.state} dispatch={learning.dispatch} /> : <LearningRouteDashboard state={learning.state} profile={learning.profile} onOpen={setOpenNode} closedNode={closedNode} dispatch={learning.dispatch} />}
  </div></AppShell>;
}

function EmptyBank() {
  return <section className={`${styles.card} mx-auto mt-10 max-w-xl text-center`}><BookOpen size={36} className="mx-auto mb-5 text-[var(--primary)]" /><h1 className="text-2xl font-extrabold">Tu banco todavía está vacío</h1><p className={`${styles.muted} my-4`}>Aprender necesita preguntas M1 con subeje y clave verificada. Revisa los ensayos disponibles para construir tu ruta.</p><Link className={styles.primary} href="/app/ensayos">Ver mis ensayos <ArrowRight size={17} /></Link></section>;
}

export function LearningSetup({ state, dispatch, onContinue }: { state: LearningState; dispatch: Dispatch; onContinue?: () => void }) {
  const [goal, setGoal] = useState<DailyGoal>(state.goal);
  const [busy, setBusy] = useState(false);
  const choose = async () => {
    setBusy(true);
    const saved = await dispatch({ type: "set-goal", goal });
    if (saved) { if (onContinue) onContinue(); else { const started = await dispatch({ type: "start-diagnostic" }); if (started) window.location.assign("/diagnostico"); } }
    setBusy(false);
  };
  return <section className={styles.setup}>
    <div className={styles.setupArt}><Flag size={36} strokeWidth={2.3} /></div>
    <span className={styles.eyebrow}>Un paso pequeño. Todos los días.</span>
    <h1 className={`${styles.title} mt-3`}>Dale un ritmo a tu meta.</h1>
    <p className={`${styles.muted} mt-4 max-w-xl`}>Tu ruta empieza conociendo cómo resuelves. Después, cada nodo te propone cinco preguntas originales y un espacio para aprender de tus errores.</p>
    <fieldset className="mt-8"><legend className="text-sm font-extrabold">¿Cuántos nodos quieres completar al día?</legend><div className={styles.goalChoices}>
      {([1, 2, 3] as DailyGoal[]).map((value) => <button key={value} type="button" aria-pressed={goal === value} className={`${styles.goalChoice} ${goal === value ? styles.goalSelected : ""}`} onClick={() => setGoal(value)}><span>{value === 1 ? "PASO A PASO" : value === 2 ? "BUEN RITMO" : "CON TODO"}</span><strong>{value} {value === 1 ? "nodo" : "nodos"}</strong><span>{value * 5} preguntas + corrección</span></button>)}
    </div></fieldset>
    <button className={styles.primary} disabled={busy} onClick={() => void choose()}>{busy ? "Guardando…" : "Continuar al diagnóstico"}<ArrowRight size={18} /></button>
    <div className={styles.setupList}><p><strong>16 preguntas iniciales</strong>Una por cada subeje M1 disponible.</p><p><strong>Sin reloj ni pistas</strong>Una primera señal de dónde empezar.</p><p><strong>Tu avance se guarda</strong>En este navegador, sin crear una cuenta.</p></div>
  </section>;
}
