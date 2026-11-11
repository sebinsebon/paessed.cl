"use client";

import { useEffect, useRef, useState } from "react";
import { useImportedResourceUrls } from "@/components/use-imported-resource-urls";
import { loadQuestionContent } from "@/lib/learning/catalog";
import type { LearningQuestion } from "@/lib/learning/types";

/** One loader and resource readiness gate for both learning question layouts. */
export function useLearningQuestion(meta: LearningQuestion, onReady?: (ready: boolean) => void, enabled = true) {
  const [content, setContent] = useState<Awaited<ReturnType<typeof loadQuestionContent>> | null>(null);
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setContent(null);
    setLoadError("");
    if (!enabled) return;
    void loadQuestionContent(meta).then(value => {
      if (active) setContent(value);
    }).catch(reason => {
      if (active) setLoadError(reason instanceof Error ? reason.message : "No se pudo abrir la pregunta.");
    });
    return () => { active = false; };
  }, [meta, revision, enabled]);
  const { resourceUrls, resourceError, resourceIssues, resourcesLoading } = useImportedResourceUrls(content?.record ?? null);
  const error = loadError || resourceError || (resourceIssues.size ? "No se pudieron cargar todos los recursos de esta pregunta. Reintenta para responder con el enunciado completo." : "");
  const ready = !!content && !resourcesLoading && !error;
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  useEffect(() => { readyCallback.current?.(ready); }, [ready, meta.id]);
  return { content, resourceUrls, error, ready, retry: () => setRevision(value => value + 1) };
}
