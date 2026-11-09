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
  onOpenChange?: (open: boolean) => void;
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
  onOpenChange,
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
          initial={{ opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
        >
          <AskAiButton
            settings={{ ...aiSettings, enabled: true }}
            onChange={handleSettingsChange}
            question={question}
            disabled={disabled}
            onHelp={onHelp}
            onOpenChange={onOpenChange}
            compactMobile
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PostErrorAiHelp;
