"use client";

import { useEffect, useState, type CSSProperties } from "react";
import styles from "./mobile-question.module.css";

/** Decorative only: feedback text and the answer icons carry the result. */
export function AnswerEffects({ correct }: { correct: boolean }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setVisible(false), 750); return () => window.clearTimeout(timer); }, []);
  if (!visible) return null;
  return <div aria-hidden="true" data-testid="answer-effects" data-result={correct ? "correct" : "incorrect"} className={styles.answerEffects}>
    <div className={styles.answerWash} />
    {Array.from({ length: correct ? 16 : 9 }, (_, index) => <i key={index} className={styles.answerParticle} style={{
      "--particle-x": `${(index % 2 ? 1 : -1) * (25 + (index * 29) % 150)}px`,
      "--particle-y": `${-35 - (index * 37) % 170}px`,
      "--particle-turn": `${index * 63}deg`,
      left: `${20 + (index * 17) % 60}%`, animationDelay: `${index % 4 * 25}ms`,
    } as CSSProperties} />)}
  </div>;
}
