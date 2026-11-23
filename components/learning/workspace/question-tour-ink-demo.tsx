"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useReducedMotion } from "motion/react";
import styles from "./question-tour-ink-demo.module.css";

const stroke = "M 26 117 C 56 53 86 155 113 95 S 178 44 223 104";

/**
 * A self-contained looping illustration. It does not touch real ink.
 * On desktop, drawing and double-click erasing happen in parallel, so users
 * do not have to wait for the entire drawing animation to see the erase gesture.
 */
export function QuestionTourInkDemo({ mobile }: { mobile: boolean }) {
  const [replay, setReplay] = useState(0);
  const reducedMotion = useReducedMotion();
  return (
    <div className={styles.demo} data-testid="question-tour-ink-demo" data-device={mobile ? "touch" : "mouse"}>
      <div className={styles.heading}>
        <span className={styles.eyebrow}>MIRA CÓMO SE BORRA UN TRAZO</span>
        <button type="button" className={styles.replay} onClick={() => setReplay(value => value + 1)}
          aria-label="Repetir demostración">
          <RotateCcw size={15} aria-hidden="true" /> Repetir
        </button>
      </div>
      {mobile ? (
        <div className={styles.stage} key={replay} data-testid="ink-demo-stage" data-replay={replay}
          role="img" aria-label="Se dibuja un trazo, se toca dos veces sobre él y desaparece.">
          <div className={styles.paperGrid} aria-hidden="true" />
          <span className={styles.firstLabel} aria-hidden="true">1. Dibujar</span>
          <span className={styles.secondLabel} aria-hidden="true">2. Doble toque</span>
          <span className={styles.thirdLabel} aria-hidden="true">3. ¡Borrado!</span>
          <svg className={styles.scene} viewBox="0 0 440 205" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <path className={styles.inkShadow} pathLength={1}
              d="M 55 132 C 86 70 112 72 134 121 S 187 178 218 106 S 275 65 302 126 S 353 151 385 85" />
            <path className={styles.ink} pathLength={1} data-testid="ink-demo-stroke"
              d="M 55 132 C 86 70 112 72 134 121 S 187 178 218 106 S 275 65 302 126 S 353 151 385 85" />
            <circle className={styles.clickRingFirst} cx="218" cy="106" r="15" />
            <circle className={styles.clickRingSecond} cx="218" cy="106" r="15" />
            <g className={styles.cursor} data-testid="ink-demo-pointer">
              <path d="M -5 3 C -5 -5 4 -5 4 3 V 27 C 8 23 14 28 14 32 C 19 29 24 34 23 39 C 30 36 34 44 29 50 L 19 63 C 14 71 -5 71 -10 62 L -24 42 C -29 34 -20 27 -15 35 L -5 46 Z"
                fill="var(--pg-bg)" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" />
              <path d="M -5 46 V 3" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
            </g>
            <text x="245" y="70" className={styles.tapOne} aria-hidden="true">1</text>
            <text x="245" y="70" className={styles.tapTwo} aria-hidden="true">2</text>
          </svg>
          {reducedMotion && <span className={styles.motionNote}>Dibuja → doble toque → se borra</span>}
        </div>
      ) : (
        <div key={replay} className={styles.desktopGrid} data-testid="ink-demo-stage" data-replay={replay}>
          <div className={styles.desktopPane} data-testid="ink-demo-draw-pane"
            role="img" aria-label="Ejemplo de dibujo: el cursor traza una línea azul lentamente.">
            <div className={styles.paperGrid} aria-hidden="true" />
            <span className={styles.desktopTag}>1. Dibujar</span>
            <svg className={styles.desktopScene} viewBox="0 0 250 185" aria-hidden="true">
              <path className={styles.desktopDrawShadow} pathLength={1} d={stroke} />
              <path className={styles.desktopDrawInk} pathLength={1} d={stroke} data-testid="ink-demo-stroke" />
              <g className={styles.desktopDrawCursor} data-testid="ink-demo-pointer">
                <path d="M 0 0 L 0 30 L 8 23 L 15 38 L 23 34 L 16 19 L 29 17 Z"
                  fill="var(--pg-bg)" stroke="var(--pg-fg)" strokeWidth="2.7" strokeLinejoin="round" />
              </g>
            </svg>
          </div>
          <div className={styles.desktopPane} data-testid="ink-demo-erase-pane"
            role="img" aria-label="Ejemplo de borrado: dos clics sobre una línea azul y esta desaparece.">
            <div className={styles.paperGrid} aria-hidden="true" />
            <span className={styles.desktopTag}>2. Doble clic para borrar</span>
            <span className={styles.desktopErased}>¡Borrado!</span>
            <svg className={styles.desktopScene} viewBox="0 0 250 185" aria-hidden="true">
              <path className={styles.desktopEraseShadow} pathLength={1} d={stroke} />
              <path className={styles.desktopEraseInk} pathLength={1} d={stroke} />
              <circle className={styles.desktopRingOne} cx="113" cy="95" r="12" />
              <circle className={styles.desktopRingTwo} cx="113" cy="95" r="12" />
              <g className={styles.desktopEraseCursor}>
                <path d="M 0 0 L 0 30 L 8 23 L 15 38 L 23 34 L 16 19 L 29 17 Z"
                  fill="var(--pg-bg)" stroke="var(--pg-fg)" strokeWidth="2.7" strokeLinejoin="round" />
              </g>
              <text x="145" y="70" className={styles.desktopClickOne}>1</text>
              <text x="145" y="70" className={styles.desktopClickTwo}>2</text>
            </svg>
          </div>
          {reducedMotion && <span className={styles.desktopMotionNote}>Dibujar → doble clic → se borra</span>}
        </div>
      )}
      <p className={styles.footnote}>
        {mobile ? "Toca dos veces el mismo trazo, sin seleccionar la alternativa que hay debajo." :
          "Mira los dos ejemplos a la vez: dibuja a la izquierda y haz doble clic sobre la línea de la derecha. No necesitas cambiar a la goma."}
      </p>
    </div>
  );
}
