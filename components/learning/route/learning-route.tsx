"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleCheck,
  Compass,
  Flame,
  Flag,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { M1_AXES, getM1Unit } from "@/lib/m1-curriculum";
import { getLearningStats } from "@/lib/learning/engine";
import { masteryPresentation } from "@/lib/learning/presentation";
import type {
  DailyGoal,
  LearningAction,
  LearningNode,
  LearningProfile,
  LearningState,
} from "@/lib/learning/types";
import styles from "./route.module.css";

export interface LearningRouteDashboardProps {
  state: LearningState;
  profile: LearningProfile | null;
  onOpen: (id: string) => void;
  closedNode: string | null;
  dispatch: (action: LearningAction) => Promise<LearningState | null>;
}

const axisName = (id: string) => M1_AXES.find((axis) => axis.id === id)?.name ?? id;

type Point = { x: number; y: number };
const curveBetween = (from: Point, to: Point) => {
  const middle = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${middle}, ${to.x} ${middle}, ${to.x} ${to.y}`;
};

const ROW_POS_CLASSES = [
  styles.pos0,
  styles.pos1,
  styles.pos2,
  styles.pos3,
  styles.pos4,
  styles.pos5,
  styles.pos6,
];

/** Hook accesible de atrapado de foco y cierre con tecla Escape */
function useAccessibleDialog(isOpen: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        if (!dialogRef.current) return;
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          dialogRef.current.focus();
        }
      }, 40);
      return () => clearTimeout(timer);
    } else {
      if (triggerRef.current && typeof triggerRef.current.focus === "function") {
        triggerRef.current.focus();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  return dialogRef;
}

export function LearningRouteDashboard({
  state,
  profile,
  onOpen,
  closedNode,
  dispatch,
}: LearningRouteDashboardProps) {
  const stats = getLearningStats(state);

  // Estados de modales y diálogos
  const [activeDialogNode, setActiveDialogNode] = useState<LearningNode | null>(null);
  const [completedDialogNode, setCompletedDialogNode] = useState<LearningNode | null>(null);
  const [futureDialogNode, setFutureDialogNode] = useState<LearningNode | null>(null);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [mapaM1Open, setMapaM1Open] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<DailyGoal>(state.pendingGoal?.goal ?? state.goal);
  const [busy, setBusy] = useState(false);

  // Nodos y estado
  const current = state.nodes.find((node) => node.state !== "completed");
  const completed = state.nodes.filter((node) => node.state === "completed");
  const diagnosticDone = !!state.diagnostic?.completedAt;

  // Cálculo del bloque de 7 nodos
  const currentPosition = current ? current.position : Math.max(0, state.nodes.length - 1);
  const currentBlockIndex = Math.floor(currentPosition / 7);
  const viewBlockIndex = currentBlockIndex;

  const blockStart = viewBlockIndex * 7;
  const blockEnd = blockStart + 7;
  const blockNodes = state.nodes.slice(blockStart, blockEnd);

  // Progreso dentro del bloque actual
  const completedInBlock = blockNodes.filter((n) => n.state === "completed").length;
  const totalInBlock = blockNodes.length;
  const stepInBlock = current
    ? Math.min(totalInBlock, (current.position % 7) + 1)
    : totalInBlock;
  const progressPercent = totalInBlock > 0 ? (completedInBlock / totalInBlock) * 100 : 0;
  const pathRef = useRef<HTMLElement>(null);
  const [geometry, setGeometry] = useState<{ width: number; height: number; points: Point[]; milestone: Point | null }>({ width: 1, height: 1, points: [], milestone: null });
  useLayoutEffect(() => {
    const container = pathRef.current;
    if (!container) return;
    const measure = () => {
      const bounds = container.getBoundingClientRect();
      const center = (element: Element): Point => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2 - bounds.left, y: rect.top + rect.height / 2 - bounds.top };
      };
      const marker = container.querySelector('[data-learning-milestone]');
      setGeometry({ width: bounds.width, height: bounds.height, points: Array.from(container.querySelectorAll('[data-testid="learning-route-node"]'), center), milestone: marker ? center(marker) : null });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [blockStart, totalInBlock]);

  // Control de inicio del nodo
  const handleStartNode = async (node: LearningNode) => {
    setBusy(true);
    try {
      const next = await dispatch({ type: "start-node", nodeId: node.id });
      if (next) {
        setActiveDialogNode(null);
        onOpen(node.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveGoal = async () => {
    setBusy(true);
    try {
      const saved = await dispatch({ type: "set-goal", goal: selectedGoal });
      if (saved) {
        setEditingGoal(false);
      }
    } finally {
      setBusy(false);
    }
  };

  // Refs de accesibilidad
  const activeDialogRef = useAccessibleDialog(!!activeDialogNode, () => setActiveDialogNode(null));
  const completedDialogRef = useAccessibleDialog(!!completedDialogNode, () => setCompletedDialogNode(null));
  const futureDialogRef = useAccessibleDialog(!!futureDialogNode, () => setFutureDialogNode(null));
  const milestoneDialogRef = useAccessibleDialog(milestoneDialogOpen, () => setMilestoneDialogOpen(false));
  const goalDialogRef = useAccessibleDialog(editingGoal, () => setEditingGoal(false));
  const drawerRef = useAccessibleDialog(mapaM1Open, () => setMapaM1Open(false));

  return (
    <div className={styles.root} data-testid="learning-route">
      {/* ==========================================================================
          CABECERA LIMPIA Y SOBRIA (PAESSED REAL)
          ========================================================================== */}
      <header className={styles.headerClean}>
        {/* Fila de chips de estado compactos */}
        <div className={styles.statsRow}>
          <div className={styles.statChip} title="Racha de días activos">
            <Flame size={15} className="text-[var(--primary)]" />
            <span>{stats.streak} {stats.streak === 1 ? "día" : "días"}</span>
          </div>

          <button
            type="button"
            className={`${styles.statChip} ${styles.statChipBtn}`}
            onClick={() => setEditingGoal(true)}
            aria-label={`Meta diaria: ${stats.today} de ${stats.goal} nodos completados. Cambiar meta.`}
          >
            <Target size={15} className="text-[var(--primary)]" />
            <span>{stats.today} / {stats.goal}</span>
          </button>

          <div className={styles.statChip} title="Puntos de experiencia acumulados">
            <Zap size={15} className="text-[var(--secondary)]" />
            <span>{stats.xp} XP</span>
          </div>

          <button
            type="button"
            className={`${styles.statChip} ${styles.statChipBtn} ml-auto`}
            onClick={() => setMapaM1Open(true)}
            aria-label="Mapa M1"
          >
            <Compass size={15} className="text-[var(--secondary)]" />
            <span>Mapa M1</span>
          </button>
        </div>

        {/* Título de la sección y subtítulo formativo */}
        <div className={styles.headerMeta}>
          <span className={styles.eyebrow}>
            <Sparkles size={13} />
            TU RUTA M1
          </span>
          <h1 className={styles.title}>Un paso más cerca.</h1>
          <p className={styles.muted}>
            {stats.today >= stats.goal
              ? "Meta de hoy cumplida. Puedes seguir a tu ritmo."
              : "Cinco preguntas. Un aprendizaje que se queda."}
          </p>
        </div>

        {/* Barra de progreso del bloque */}
        <div className={styles.progressSection}>
          <div className={styles.progressTrack} role="progressbar" aria-valuenow={completedInBlock} aria-valuemin={0} aria-valuemax={totalInBlock}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className={styles.progressText}>
            Paso {stepInBlock} de {totalInBlock} · {completedInBlock} completados
          </span>
        </div>
      </header>

      {/* Aviso de meta diferida si existe */}
      {state.pendingGoal && (
        <div className={styles.notice} role="status">
          Tu nueva meta de {state.pendingGoal.goal} {state.pendingGoal.goal === 1 ? "nodo empieza" : "nodos empieza"} el {state.pendingGoal.effectiveDate}.
        </div>
      )}

      {/* Aviso de diagnóstico pendiente si no se ha completado */}
      {!diagnosticDone && (
        <div className={styles.notice} role="status">
          <strong>Tu punto de partida te espera:</strong> Completa el diagnóstico para orientar mejor tus primeros pasos.{" "}
          <Link href="/diagnostico" className="font-extrabold text-[var(--primary)] underline ml-1">
            Retomar diagnóstico →
          </Link>
        </div>
      )}

      {/* Aviso de sesión guardada previamente */}
      {closedNode && state.nodes.find((n) => n.id === closedNode)?.state !== "completed" && (
        <div className={styles.notice} role="status">
          Sesión guardada. Retoma desde el nodo naranja cuando quieras.
        </div>
      )}

      {/* Historial anterior accesible de pasos completados */}
      {completed.length > 0 && (
        <details className={styles.historyCollapsible}>
          <summary className={styles.historySummary}>
            <CircleCheck size={16} className="text-[var(--success)]" />
            <span>Ver {completed.length} {completed.length === 1 ? "paso completado" : "pasos completados"}</span>
            <ChevronDown size={15} className="ml-auto" />
          </summary>
          <ul className={styles.historyList}>
            {completed.map((node) => (
              <li key={node.id} className={styles.historyItem}>
                <div className="flex items-center gap-2">
                  <CircleCheck size={15} className="text-[var(--success)] shrink-0" />
                  <span className="font-semibold">
                    Paso {node.position + 1}: {getM1Unit(node.unitId)?.name ?? node.unitId}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <span className="text-[var(--muted)]">{node.originalCorrect ?? "—"}/5 originales</span>
                  <span className="font-bold text-[var(--text)]">+{node.xp ?? 0} XP</span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* ==========================================================================
          RUTA SERPENTEANTE PROTAGONISTA (7 POSICIONES REALES + HITO)
          ========================================================================== */}
      <section ref={pathRef} className={styles.pathContainer} aria-label="Ruta de aprendizaje M1">
        {/* Curvas SVG dinámicas entre nodos consecutivos */}
        <svg
          className={styles.pathSvgConnections}
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {blockNodes.slice(0, -1).map((node, i) => {
            const nextNode = blockNodes[i + 1];
            const p1 = geometry.points[i];
            const p2 = geometry.points[i + 1];
            if (!p1 || !p2) return null;
            const isCompleted = nextNode.state === "completed";
            const isActive = nextNode.id === current?.id;

            return (
              <path
                key={`conn-${node.id}-${nextNode.id}`}
                d={curveBetween(p1, p2)}
                fill="none"
                stroke={isCompleted ? "var(--success)" : isActive ? "var(--primary)" : "var(--border-strong)"}
                strokeWidth={isCompleted || isActive ? 7 : 6}
                strokeLinecap="round"
                strokeDasharray={isCompleted || isActive ? undefined : "6 6"}
              />
            );
          })}

          {/* Segmento hacia el hito decorativo */}
          {geometry.points.length > 0 && geometry.milestone && (
            <path
              d={curveBetween(geometry.points[geometry.points.length - 1], geometry.milestone)}
              fill="none"
              stroke={completedInBlock === 7 ? "var(--success)" : "var(--border-strong)"}
              strokeWidth={completedInBlock === 7 ? 7 : 5}
              strokeLinecap="round"
              strokeDasharray={completedInBlock === 7 ? undefined : "5 5"}
            />
          )}
        </svg>

        {/* Nodos táctiles del bloque */}
        {blockNodes.map((node, index) => {
          const isCurrent = node.id === current?.id;
          const isCompleted = node.state === "completed";
          const isFuture = !isCurrent && !isCompleted;
          const unit = getM1Unit(node.unitId);
          const posClass = ROW_POS_CLASSES[index % 7] ?? styles.pos3;

          return (
            <div key={node.id} className={`${styles.pathStepRow} ${posClass}`}>
              <div className={styles.tactileNodeWrapper}>
                {/* Bocadillo flotante sobre el nodo activo */}
                {isCurrent && (
                  <div className={styles.activeBubble}>
                    {node.startedAt ? "CONTINÚA AQUÍ" : "EMPIEZA AQUÍ"}
                  </div>
                )}

                {/* Botón táctil con extrusión de 6-8px */}
                <button
                  type="button"
                  data-testid="learning-route-node"
                  data-state={isCurrent ? "current" : isCompleted ? "completed" : "future"}
                  className={`
                    ${styles.tactileNode}
                    ${isCurrent ? styles.activeNode : ""}
                    ${isCompleted ? styles.completedNode : ""}
                    ${isFuture ? styles.upcomingNode : ""}
                  `}
                  onClick={() => {
                    if (isCurrent) {
                      setActiveDialogNode(node);
                    } else if (isCompleted) {
                      setCompletedDialogNode(node);
                    } else {
                      setFutureDialogNode(node);
                    }
                  }}
                  aria-label={`
                    ${isCurrent ? (node.startedAt ? "Retomar sesión" : "Comenzar nodo") : isCompleted ? "Sesión completada" : "Previsión adaptativa"}:
                    ${unit?.name ?? node.unitId}.
                    ${node.type === "M" ? "Mantenimiento" : "Refuerzo"}.
                  `}
                >
                  {isCompleted ? (
                    <Check size={36} strokeWidth={3.2} />
                  ) : isCurrent ? (
                    node.startedAt ? (
                      <Play size={34} fill="currentColor" />
                    ) : (
                      <Flag size={32} strokeWidth={2.4} />
                    )
                  ) : (
                    <BookOpen size={26} strokeWidth={2.2} />
                  )}

                  {/* Medallón de tipo M / R */}
                  <div
                    className={`${styles.typeBadge} ${node.type === "M" ? styles.typeBadgeM : styles.typeBadgeR}`}
                    title={node.type === "M" ? "Mantenimiento" : "Refuerzo"}
                  >
                    {node.type}
                  </div>
                </button>
              </div>
            </div>
          );
        })}

        {/* Hito decorativo de fin de bloque (separado de las 7 sesiones) */}
        <div className={`${styles.pathStepRow} ${styles.posMilestone}`}>
          <div
            className={styles.milestoneMarker}
            data-learning-milestone
            role="button"
            tabIndex={0}
            onClick={() => setMilestoneDialogOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setMilestoneDialogOpen(true);
              }
            }}
            aria-label={`Información del hito: Cierre de Bloque ${viewBlockIndex + 1}`}
          >
            <Trophy size={15} className="text-[var(--primary)]" />
            <span>Cierre de Bloque {viewBlockIndex + 1} (4M + 3R)</span>
          </div>
        </div>

        {/* Si no hay nodos disponibles */}
        {blockNodes.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="mx-auto mb-4 text-[var(--primary)]" size={40} />
            <h3 className="font-extrabold text-lg">Completaste los pasos disponibles</h3>
            <p className={`${styles.muted} mt-2`}>
              Tu avance está guardado. Incorpora más preguntas verificadas para seguir explorando M1.
            </p>
          </div>
        )}
      </section>

      {/* ==========================================================================
          MODAL: NODO ACTIVO (PREVIEW + CTA)
          ========================================================================== */}
      {activeDialogNode && (
        <div
          className={styles.dialogOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveDialogNode(null);
          }}
        >
          <div
            ref={activeDialogRef}
            className={styles.dialogCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-node-title"
            tabIndex={-1}
          >
            <button
              type="button"
              className={styles.dialogCloseBtn}
              onClick={() => setActiveDialogNode(null)}
              aria-label="Cerrar vista previa"
            >
              ✕
            </button>

            <div className={styles.dialogBadgeGroup}>
              <span className={`${styles.dialogTag} ${activeDialogNode.type === "M" ? styles.tagM : styles.tagR}`}>
                {activeDialogNode.type === "M" ? "M · MANTENIMIENTO" : "R · REFUERZO ADAPTATIVO"}
              </span>
              <span className="text-xs font-bold text-[var(--muted)]">
                PASO {activeDialogNode.position + 1}
              </span>
            </div>

            <div>
              <h2 id="active-node-title" className={styles.dialogTitle}>
                {getM1Unit(activeDialogNode.unitId)?.name ?? activeDialogNode.unitId}
              </h2>
              <p className={styles.dialogSub}>
                {axisName(activeDialogNode.axisId)} · Matemática M1
              </p>
            </div>

            <div className={styles.featuresList}>
              <div className={styles.featureRow}>
                <Target size={16} />
                <span><strong>5 preguntas:</strong> Feedback inmediato; tus primeras respuestas cuentan.</span>
              </div>
              <div className={styles.featureRow}>
                <RotateCcw size={16} />
                <span><strong>Corrección formativa:</strong> 2 reintentos en errores; el puntaje original se conserva.</span>
              </div>
              <div className={styles.featureRow}>
                <Check size={16} />
                <span><strong>Clave verificada DEMRE:</strong> Explicación provisional o no disponible según el banco.</span>
              </div>
              <div className={styles.featureRow}>
                <Zap size={16} />
                <span><strong>Hasta +25 XP:</strong> +5 XP por respuesta nueva al completar el nodo.</span>
              </div>
            </div>

            <button
              type="button"
              className={styles.btnPrimary}
              disabled={busy}
              onClick={() => void handleStartNode(activeDialogNode)}
            >
              {busy
                ? "Iniciando…"
                : activeDialogNode.startedAt
                ? "Retomar sesión"
                : "Comenzar nodo"}
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL: NODO COMPLETADO (INFO)
          ========================================================================== */}
      {completedDialogNode && (
        <div
          className={styles.dialogOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCompletedDialogNode(null);
          }}
        >
          <div
            ref={completedDialogRef}
            className={styles.dialogCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="completed-node-title"
            tabIndex={-1}
          >
            <button
              type="button"
              className={styles.dialogCloseBtn}
              onClick={() => setCompletedDialogNode(null)}
              aria-label="Cerrar información de nodo completado"
            >
              ✕
            </button>

            <div className={styles.dialogBadgeGroup}>
              <span className={`${styles.dialogTag} !bg-[var(--success-soft)] !text-[var(--success)]`}>
                SESIÓN COMPLETADA
              </span>
              <span className="text-xs font-bold text-[var(--muted)]">
                PASO {completedDialogNode.position + 1}
              </span>
            </div>

            <div>
              <h2 id="completed-node-title" className={styles.dialogTitle}>
                {getM1Unit(completedDialogNode.unitId)?.name ?? completedDialogNode.unitId}
              </h2>
              <p className={styles.dialogSub}>
                {axisName(completedDialogNode.axisId)} · Matemática M1
              </p>
            </div>

            <div className={styles.featuresList}>
              <div className={styles.featureRow}>
                <CircleCheck size={16} className="text-[var(--success)]" />
                <span>
                  <strong>Resultado original:</strong> {completedDialogNode.originalCorrect ?? "—"}/5 preguntas correctas en primera vuelta.
                </span>
              </div>
              <div className={styles.featureRow}>
                <Zap size={16} />
                <span>
                  <strong>XP sumados:</strong> +{completedDialogNode.xp ?? 0} XP añadidos a tu perfil.
                </span>
              </div>
            </div>

            <p className="text-xs text-[var(--muted)] leading-5">
              Tus primeras respuestas cuentan. La corrección formativa se registra por separado para mantener la fidelidad de tu diagnóstico.
            </p>

            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setCompletedDialogNode(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL: NODO FUTURO (PREVISIÓN ADAPTATIVA)
          ========================================================================== */}
      {futureDialogNode && (
        <div
          className={styles.dialogOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setFutureDialogNode(null);
          }}
        >
          <div
            ref={futureDialogRef}
            className={styles.dialogCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="future-node-title"
            tabIndex={-1}
          >
            <button
              type="button"
              className={styles.dialogCloseBtn}
              onClick={() => setFutureDialogNode(null)}
              aria-label="Cerrar información de previsión adaptativa"
            >
              ✕
            </button>

            <div className={styles.dialogBadgeGroup}>
              <span className={`${styles.dialogTag} ${futureDialogNode.type === "M" ? styles.tagM : styles.tagR}`}>
                {futureDialogNode.type === "M" ? "M · PREVISIÓN" : "R · PREVISIÓN"}
              </span>
              <span className="text-xs font-bold text-[var(--muted)]">
                PASO {futureDialogNode.position + 1}
              </span>
            </div>

            <div>
              <h2 id="future-node-title" className={styles.dialogTitle}>
                {getM1Unit(futureDialogNode.unitId)?.name ?? futureDialogNode.unitId}
              </h2>
              <p className={styles.dialogSub}>
                {axisName(futureDialogNode.axisId)} · 5 preguntas
              </p>
            </div>

            <div className={styles.featuresList}>
              <div className={styles.featureRow}>
                <Sparkles size={16} />
                <span>
                  <strong>Previsión adaptativa:</strong> Esta sesión se habilitará automáticamente al completar el paso previo de tu ruta.
                </span>
              </div>
              <div className={styles.featureRow}>
                <BookOpen size={16} />
                <span>
                  <strong>Sin candados:</strong> La cola se reorganiza según tu rendimiento real en cada sesión completada.
                </span>
              </div>
            </div>

            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setFutureDialogNode(null)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL: HITO DECORATIVO DE FIN DE BLOQUE
          ========================================================================== */}
      {milestoneDialogOpen && (
        <div
          className={styles.dialogOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMilestoneDialogOpen(false);
          }}
        >
          <div
            ref={milestoneDialogRef}
            className={styles.dialogCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="milestone-title"
            tabIndex={-1}
          >
            <button
              type="button"
              className={styles.dialogCloseBtn}
              onClick={() => setMilestoneDialogOpen(false)}
              aria-label="Cerrar información de hito"
            >
              ✕
            </button>

            <div className="flex items-center gap-3">
              <Trophy size={28} className="text-[var(--primary)]" />
              <div>
                <h2 id="milestone-title" className={styles.dialogTitle}>
                  Cierre de Bloque {viewBlockIndex + 1}
                </h2>
                <p className={styles.dialogSub}>Ciclo formativo 4:3 (4 Mantenimiento + 3 Refuerzo)</p>
              </div>
            </div>

            <p className="text-sm text-[var(--muted)] leading-relaxed">
              Cada bloque de tu ruta se estructura en <strong>7 sesiones completas</strong> (35 preguntas en total). Al completar las siete sesiones, consolidas el mantenimiento transversal y el refuerzo de tus áreas prioritarias.
            </p>

            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setMilestoneDialogOpen(false)}
            >
              Continuar practicando
            </button>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL: CAMBIAR META DIARIA
          ========================================================================== */}
      {editingGoal && (
        <div
          className={styles.dialogOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingGoal(false);
          }}
        >
          <div
            ref={goalDialogRef}
            className={styles.dialogCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="goal-title"
            tabIndex={-1}
          >
            <button
              type="button"
              className={styles.dialogCloseBtn}
              onClick={() => setEditingGoal(false)}
              aria-label="Cerrar selector de meta diaria"
            >
              ✕
            </button>

            <div>
              <h2 id="goal-title" className={styles.dialogTitle}>
                Un ritmo que puedas sostener
              </h2>
              <p className={styles.dialogSub}>¿Cuántos nodos quieres completar al día?</p>
            </div>

            <div className="flex flex-col gap-2 my-2">
              {([1, 2, 3] as DailyGoal[]).map((val) => (
                <button
                  key={val}
                  type="button"
                  aria-pressed={selectedGoal === val}
                  className={`
                    p-3 rounded-xl border text-left flex items-center justify-between transition-all
                    ${selectedGoal === val
                      ? "border-[var(--primary)] bg-[var(--surface-2)] shadow-sm"
                      : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                    }
                  `}
                  onClick={() => setSelectedGoal(val)}
                >
                  <div>
                    <strong className="block text-sm text-[var(--text)]">
                      {val} {val === 1 ? "nodo al día" : "nodos al día"}
                    </strong>
                    <span className="text-xs text-[var(--muted)]">
                      {val === 1 ? "Paso a paso (5 preguntas)" : val === 2 ? "Buen ritmo (10 preguntas)" : "Con todo (15 preguntas)"}
                    </span>
                  </div>
                  {selectedGoal === val && <Check size={18} className="text-[var(--primary)]" />}
                </button>
              ))}
            </div>

            <p className="text-xs text-[var(--muted)] leading-5">
              Los cambios se aplican mañana. La meta de hoy sigue siendo {state.goal} {state.goal === 1 ? "nodo" : "nodos"}.
            </p>

            <button
              type="button"
              className={styles.btnPrimary}
              disabled={busy}
              onClick={() => void handleSaveGoal()}
            >
              {busy ? "Guardando…" : "Guardar cambio"}
            </button>
          </div>
        </div>
      )}

      {/* ==========================================================================
          DRAWER DESLIZABLE: "TU MAPA M1" (TAXONOMÍA REAL + REGLA DE 15 RESPUESTAS)
          ========================================================================== */}
      {mapaM1Open && (
        <div
          className={styles.dialogOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMapaM1Open(false);
          }}
        >
          <div
            ref={drawerRef}
            className={styles.drawerPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            tabIndex={-1}
          >
            <div className={styles.drawerHeader}>
              <div>
                <h2 id="drawer-title" className="text-lg font-extrabold text-[var(--text)]">
                  Tu Mapa M1
                </h2>
                <span className="text-xs text-[var(--muted)]">Estimación de dominio por ejes</span>
              </div>
              <button
                type="button"
                className={styles.dialogCloseBtn}
                onClick={() => setMapaM1Open(false)}
                aria-label="Cerrar mapa M1"
              >
                ✕
              </button>
            </div>

            <div className="bg-[var(--surface-2)] rounded-xl p-3 text-xs leading-relaxed text-[var(--muted)] border border-[var(--border)]">
              Cada eje se calibra al reunir <strong>15 respuestas originales</strong>. Mientras tanto, verás una estimación provisional que se afina con tu práctica. Tus primeras respuestas cuentan.
            </div>

            {/* Ejes oficiales M1 */}
            <div className="flex flex-col gap-3">
              {M1_AXES.map((axis) => {
                const item = profile?.axes.find((a) => a.axisId === axis.id);
                const isCalibrated = item?.calibrated ?? false;
                const count = item?.count ?? 0;
                const percent = item?.percent != null ? Math.round(item.percent) : null;
                const band = masteryPresentation(item?.percent ?? null, isCalibrated);
                const covered = item?.coveredUnits ?? 0;
                const totalUnits = item?.totalUnits ?? axis.units.length;

                return (
                  <div key={axis.id} className={styles.drawerAxisCard}>
                    <div className={styles.drawerAxisRow}>
                      <span className="text-[var(--text)]">{axis.name}</span>
                      <span style={{ color: isCalibrated ? band.color : "var(--muted)" }}>
                        {percent == null ? "—" : `${percent}% · `}
                        {isCalibrated ? band.label : "En calibración"}
                      </span>
                    </div>

                    <div className={styles.drawerAxisSub}>
                      {count} / 15 respuestas{count < 15 ? ` (faltan ${15 - count})` : ""} · {covered} de {totalUnits} subejes observados
                    </div>

                    <div className={styles.drawerAxisTrack}>
                      <div
                        className={styles.drawerAxisFill}
                        style={{
                          width: `${percent ?? 0}%`,
                          background: isCalibrated ? band.color : "var(--muted)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] leading-5 text-[var(--muted)] mt-auto pt-4 border-t border-[var(--border)]">
              Los porcentajes grises son provisionales hasta reunir 15 respuestas originales por eje. Esto no predice tu puntaje PAES.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default LearningRouteDashboard;
