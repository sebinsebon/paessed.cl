"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { ChevronLeft, X } from "lucide-react";
import { QuestionTopicTags } from "@/components/question-topic-tags";
import styles from "./mobile-question.module.css";

export interface QuestionWorkspaceProps {
  number: number;
  total: number;
  axis: string;
  topic?: string;
  subtitle: string;
  progress: number;
  progressMax?: number;
  onClose: () => void;
  closeDisabled?: boolean;
  tools: ReactNode;
  panels?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  paperStyle: CSSProperties;
  contentKey: string;
  mobile?: { steps: { number: number; answered: boolean; current: boolean }[]; menu: ReactNode; footer: ReactNode };
}

/**
 * QuestionWorkspace — Shell de pantalla completa para sesiones de Aprender M1.
 * Replica fielmente el layout de Ensayos y Playground:
 * - Toolbar de 3 columnas (max-w-[1740px])
 * - Hoja full-bleed sin tarjetas, sin bordes redondos, sin hero
 * - Scrollbar nativo reseteable por contentKey
 * - Footer idéntico con variables --pg-footer y --pg-border
 */
export function QuestionWorkspace({
  number,
  total,
  axis,
  topic,
  subtitle,
  progress,
  progressMax = total,
  onClose,
  closeDisabled = false,
  tools,
  panels,
  footer,
  children,
  paperStyle,
  contentKey,
  mobile,
}: QuestionWorkspaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reseteo automático de scroll al cambiar de pregunta
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [contentKey]);

  const progressPercent = progressMax > 0 ? Math.min(100, Math.max(0, (progress / progressMax) * 100)) : 0;

  return (
    <div
      style={paperStyle}
      data-testid="learning-session"
      className={`${mobile ? styles.viewport : ""} fixed inset-0 z-[60] flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--pg-bg)] text-[var(--pg-fg)]`}
      aria-label="Sesión de aprendizaje M1"
    >
      {/* ==========================================================================
          HEADER: TOOLBAR DE 3 COLUMNAS IDÉNTICA A ENSAYOS / PLAYGROUND (MAX-W 1740px)
          ========================================================================== */}
      <header
        style={paperStyle}
        className="relative z-30 w-full shrink-0 border-b border-[var(--pg-border)] bg-[var(--pg-bg)] text-[var(--pg-fg)]"
      >
        {mobile && <div className={styles.mobileHeader}>
          <button type="button" className={styles.iconButton} aria-label="Guardar y cerrar sesión" disabled={closeDisabled} onClick={onClose}><X size={22} /></button>
          <div className={styles.segments} role="group" aria-label={subtitle}>{mobile.steps.map(step => <span key={step.number} className={styles.segment} data-answered={step.answered} aria-current={step.current ? "step" : undefined} aria-label={`Pregunta ${step.number}: ${step.current ? "actual" : step.answered ? "respondida" : "pendiente"}`} />)}</div>
          <span className={styles.position} aria-label={subtitle}>{mobile.steps.find(step => step.current)?.number ?? mobile.steps.length}/{mobile.steps.length}</span>
          {mobile.menu}
        </div>}
        <div className={`${mobile ? styles.desktopHeader : ""} mx-auto flex min-h-[68px] w-full max-w-[1740px] flex-wrap items-center gap-2 px-4 py-2.5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] lg:px-7`}>
          {/* Columna Izquierda: Botón Volver, Número de pregunta y Tags de Eje/Subeje */}
          <div className="flex max-w-full min-w-0 flex-wrap items-center gap-1.5 lg:flex-nowrap">
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              aria-label="Guardar y cerrar sesión"
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12px] font-bold text-[var(--pg-muted)] transition-colors hover:bg-[var(--pg-soft)] hover:text-[var(--pg-fg)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={18} />
              <span className="hidden sm:inline">Volver a mi ruta</span>
              <span className="sm:hidden">Volver</span>
            </button>

            <span className="shrink-0 rounded-md bg-[var(--pg-soft)] px-2 py-1 text-[10px] font-bold leading-4">
              N.º {number}
            </span>

            <QuestionTopicTags axis={axis} topic={topic} />
          </div>

          {/* Columna Centro: Título sobrio de módulo y subtítulo */}
          <div className="order-3 min-w-0 w-full text-center lg:order-none lg:w-auto">
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 text-[12px] font-extrabold tracking-tight sm:text-[13px]">
              <span className="whitespace-nowrap">
                Matemática M1 <span className="text-[var(--primary)]">Aprender</span>
              </span>
            </div>
            <p className="mt-0.5 truncate text-center text-[9px] font-medium leading-tight text-[var(--pg-muted)]">
              {subtitle}
            </p>
          </div>

          {/* Columna Derecha: Slot de Herramientas (Lápiz, IA, etc.) */}
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1 lg:ml-0 lg:justify-self-end">
            {tools}
          </div>
        </div>

        {/* Slot de Paneles Desplegables (Dibujo, Ayuda, Ajustes) */}
        {panels}

        {/* Barra de progreso de 3px con color naranja */}
        <div
          role="progressbar"
          aria-label="Avance de la sesión"
          aria-valuemin={0}
          aria-valuemax={progressMax}
          aria-valuenow={progress}
          className={`${mobile ? styles.desktopProgress : ""} h-[3px] w-full overflow-hidden bg-[var(--pg-soft)]`}
        >
          <div
            className="h-full bg-[var(--primary)] transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* ==========================================================================
          MAIN / ARTÍCULO: PAPEL FULL-BLEED (SIN CARDS, SIN BORDES REDONDOS)
          ========================================================================== */}
      <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden" aria-label="Pregunta de aprendizaje">
        <article
          style={paperStyle}
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--pg-bg)] text-[var(--pg-fg)]"
        >
          {/* Contenedor con scroll vertical, reseteado por contentKey */}
          <div
            ref={scrollRef}
            key={contentKey}
            data-testid="learning-question-scroll"
            className={`${mobile ? styles.scroll : ""} min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-9 sm:py-5 lg:px-12`}
          >
            <div className="relative flex min-h-full flex-col">
              {children}
            </div>
          </div>

          {/* ==========================================================================
              FOOTER: ACCIONES DE SESIÓN (IDÉNTICO A ENSAYOS / PLAYGROUND)
              ========================================================================== */}
          <footer
            data-testid="learning-session-actions"
            className={`${mobile ? styles.footer : ""} shrink-0 border-t border-[var(--pg-border)] bg-[var(--pg-footer)] px-3 py-2.5 sm:px-7 sm:py-3`}
          >
            {mobile ? mobile.footer : footer}
          </footer>
        </article>
      </main>
    </div>
  );
}

export default QuestionWorkspace;
