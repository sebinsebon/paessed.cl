"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { AiQuestion, AiSettings } from "@/lib/ai-assistance";
import { AskAiButton, useAiSettings } from "@/components/ask-ai";
import styles from "./post-error-ai-help.module.css";

export interface PostErrorAiHelpProps {
  visible: boolean;
  question: AiQuestion;
  onHelp?: () => void;
  disabled?: boolean;
}

/**
 * PostErrorAiHelp — Botón de ayuda con IA animado post-error en Aprender M1.
 *
 * Características:
 * - Aparece automáticamente tras un fallo incluso con aiSettings.enabled global en false.
 * - Inyecta `{ ...aiSettings, enabled: true }` exclusivamente a esta instancia de AskAiButton.
 * - Al cambiar configuración dentro del modal, conserva el `enabled` global anterior.
 * - Animación de entrada fluida con AnimatePresence (fade + y:8 + scale:0.94 spring rápido).
 * - Respeta useReducedMotion / prefers-reduced-motion eliminando traslaciones y resplandores.
 * - Envoltorio con data-testid="post-error-ai-help" y resplandor sutil en naranja PAESSED.
 */
export function PostErrorAiHelp({
  visible,
  question,
  onHelp,
  disabled = false,
}: PostErrorAiHelpProps) {
  const reduced = useReducedMotion();
  const { aiSettings, updateAiSettings } = useAiSettings();

  const handleSettingsChange = (nextSettings: AiSettings) => {
    updateAiSettings({
      ...nextSettings,
      enabled: aiSettings.enabled,
    });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-testid="post-error-ai-help"
          className={styles.wrapper}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.94 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.95 }}
          transition={
            reduced
              ? { duration: 0.15 }
              : { type: "spring", stiffness: 440, damping: 26 }
          }
        >
          <AskAiButton
            settings={{ ...aiSettings, enabled: true }}
            onChange={handleSettingsChange}
            question={question}
            disabled={disabled}
            onHelp={onHelp}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PostErrorAiHelp;
