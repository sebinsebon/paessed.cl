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
        aria-label={`Demostración: se dibuja un trazo, se hace ${gesture.toLowerCase()} sobre él y desaparece.`}>
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
                  <path d="M -5 -25 C -5 -31 4 -31 4 -25 V -3 C 7 -7 13 -5 14 0 C 19 -3 24 2 23 7 C 30 5 33 12 29 19 L 18 37 C 14 45 -5 45 -10 36 L -24 13 C -29 5 -20 -2 -15 5 L -5 15 Z"
                    fill="var(--pg-bg)" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" />
                  <path d="M -5 15 V -21" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
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
