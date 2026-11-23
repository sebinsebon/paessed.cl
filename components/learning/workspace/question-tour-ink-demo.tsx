"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useReducedMotion } from "motion/react";
import styles from "./question-tour-ink-demo.module.css";

/**
 * A self-contained teaching animation, never connected to the real ink store.
 * One repeating timeline: draw a stroke, double-click/tap it, erase it.
 */
export function QuestionTourInkDemo({ mobile }: { mobile: boolean }) {
  const [replay, setReplay] = useState(0);
  const reducedMotion = useReducedMotion();
  const gesture = mobile ? "Doble toque" : "Doble clic";
  return (
    <div className={styles.demo} data-testid="question-tour-ink-demo" data-device={mobile ? "touch" : "mouse"}>
      <div className={styles.heading}>
        <span className={styles.eyebrow}>MIRA CÓMO SE BORRA UN TRAZO</span>
        <button type="button" className={styles.replay} onClick={() => setReplay(value => value + 1)}
          aria-label="Repetir demostración">
          <RotateCcw size={15} aria-hidden="true" /> Repetir
        </button>
      </div>
      <div className={styles.stage} key={replay} data-testid="ink-demo-stage" data-replay={replay}
        role="img" aria-label={`Demostración: se dibuja un trazo, se hace ${gesture.toLowerCase()} sobre él y desaparece.`}>
        <div className={styles.paperGrid} aria-hidden="true" />
        <span className={styles.firstLabel} aria-hidden="true">1. Dibujar</span>
        <span className={styles.secondLabel} aria-hidden="true">2. {gesture}</span>
        <span className={styles.thirdLabel} aria-hidden="true">3. ¡Borrado!</span>
        <svg className={styles.scene} viewBox="0 0 440 205" role="img"
          aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
          <path className={styles.inkShadow} pathLength={1}
            d="M 55 132 C 86 70 112 72 134 121 S 187 178 218 106 S 275 65 302 126 S 353 151 385 85" />
          <path className={styles.ink} pathLength={1} data-testid="ink-demo-stroke"
            d="M 55 132 C 86 70 112 72 134 121 S 187 178 218 106 S 275 65 302 126 S 353 151 385 85" />
          <circle className={styles.clickRingFirst} cx="218" cy="106" r="15" />
          <circle className={styles.clickRingSecond} cx="218" cy="106" r="15" />
          <g className={styles.cursor} data-testid="ink-demo-pointer">
            {mobile
              ? <>
                  <path d="M -5 3 C -5 -5 4 -5 4 3 V 27 C 8 23 14 28 14 32 C 19 29 24 34 23 39 C 30 36 34 44 29 50 L 19 63 C 14 71 -5 71 -10 62 L -24 42 C -29 34 -20 27 -15 35 L -5 46 Z"
                    fill="var(--pg-bg)" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" />
                  <path d="M -5 46 V 3" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
                </>
              : <path d="M 0 0 L 0 34 L 9 26 L 16 43 L 25 39 L 17 22 L 32 20 Z"
                  fill="var(--pg-bg)" stroke="var(--pg-fg)" strokeWidth="3" strokeLinejoin="round" />}
          </g>
          <text x="245" y="70" className={styles.tapOne} aria-hidden="true">1</text>
          <text x="245" y="70" className={styles.tapTwo} aria-hidden="true">2</text>
        </svg>
        {reducedMotion && <span className={styles.motionNote}>Dibuja → {gesture.toLowerCase()} → se borra</span>}
      </div>
      <p className={styles.footnote}>
        {mobile ? "Toca dos veces el mismo trazo, sin seleccionar la alternativa que hay debajo." :
          "Haz doble clic directamente sobre el trazo, sin cambiar a la goma."}
      </p>
    </div>
  );
}
