"use client";
import { useCallback, useEffect, useState } from "react";
import { loadLearningCatalog } from "@/lib/learning/catalog";
import { getProfile, planLearning } from "@/lib/learning/engine";
import { readLearningState, dispatchLearning, subscribeLearning } from "@/lib/learning/repository";
import type { LearningState, LearningQuestion, LearningAction } from "@/lib/learning/types";

export function useLearning() {
  const [state, setState] = useState<LearningState | null>(null);
  const [catalog, setCatalog] = useState<LearningQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [saved, questions] = await Promise.all([readLearningState(), loadLearningCatalog()]);
      setCatalog(questions); setState(previous => previous && previous.revision > saved.revision ? previous : planLearning(saved, questions)); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo leer tu progreso."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); return subscribeLearning(() => { void refresh(); }); }, [refresh]);
  const dispatch = useCallback(async (action: LearningAction) => {
    try {
      const next = await dispatchLearning(action, catalog);
      setState(next); setError(""); return next;
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar. Reintenta antes de continuar."); return null; }
  }, [catalog]);
  return { state, catalog, profile: state ? getProfile(state) : null, loading, error, dispatch, refresh };
}
