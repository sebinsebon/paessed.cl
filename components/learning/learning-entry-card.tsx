"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Check, Play } from "lucide-react";
import { getM1Unit } from "@/lib/m1-curriculum";
import { useLearning } from "./use-learning";
import styles from "./learning-entry-card.module.css";

/** Read the same planned route as Aprender; never invent a next subject or progress. */
export function LearningEntryCard({ tourFocus }: { tourFocus: boolean }) {
  const { state, loading, error } = useLearning();
  const diagnostic = state?.diagnostic;
  const ready = !!diagnostic?.completedAt;
  const current = ready ? state?.nodes.find(node => node.state !== "completed") : undefined;
  const completed = state?.nodes.filter(node => node.state === "completed").length ?? 0;
  const title = loading ? "Tu ruta de Matemática M1" : error ? "Tu ruta de Matemática M1" : !diagnostic ? "Empieza con un diagnóstico" : !ready ? "Tu diagnóstico está pendiente" : current ? getM1Unit(current.unitId)?.name ?? "Continúa tu ruta" : "Tu ruta está al día";
  const description = error ? "Entra a Aprender para revisar tu progreso." : !diagnostic ? "Responde 16 preguntas para saber qué repasar primero." : !ready ? `${Object.keys(diagnostic.answers).length} de 16 preguntas respondidas. Puedes seguir donde quedaste.` : current ? "Sesiones de 5 preguntas, con revisión de tus errores al terminar." : "Revisa tus sesiones completadas y tu progreso en M1.";
  const href = diagnostic && !ready ? "/diagnostico" : "/app/aprender";
  const cta = loading || error ? "Ir a Aprender" : !diagnostic ? "Preparar mi ruta" : !ready ? "Retomar diagnóstico" : "Ver mi ruta";
  return <section id="tour-mission" className={`${styles.card} ${tourFocus ? "tour-focus" : ""}`}>
    <div className={styles.copy}>
      <p className={styles.section}>Aprender</p>
      <h2>{title}</h2>
      <p className={styles.description}>{description}</p>
      <Link href={href} className={`tactile-primary ${styles.cta}`}>{cta}<ArrowRight size={18} /></Link>
    </div>
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.miniRoute}>
        <span className={styles.smallNode}>{completed > 0 ? <Check size={22} /> : <BookOpen size={22} />}</span>
        <span className={styles.line} />
        <span className={styles.currentNode}><Play size={28} fill="currentColor" /></span>
        <span className={styles.line} />
        <span className={styles.smallNode}><BookOpen size={22} /></span>
      </div>
      <strong>{ready ? `${completed} ${completed === 1 ? "sesión completada" : "sesiones completadas"}` : "Diagnóstico → práctica → repaso"}</strong>
      <span>{ready ? "Tu avance se guarda automáticamente" : "Una ruta según tus respuestas"}</span>
    </div>
  </section>;
}
