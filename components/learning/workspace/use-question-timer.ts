"use client";

import { useEffect, useRef, useState } from "react";

const PREFERENCE = "paessed-learning-timer-enabled";
type TimerRecord = { version: 1; elapsedMs: number; frozen: boolean };
const memory = new Map<string, TimerRecord>();

/** Persists elapsed active time only. No timestamp survives a page close. */
export function useQuestionTimer({ timerKey, ready, paused, frozen }: {
  timerKey: string; ready: boolean; paused: boolean; frozen: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const record = useRef<TimerRecord>({ version: 1, elapsedMs: 0, frozen: false });
  const commit = useRef<() => void>(() => {});
  useEffect(() => {
    try { setEnabled(localStorage.getItem(PREFERENCE) === "true"); }
    catch { setError("No se pudo leer la preferencia del cronómetro."); }
  }, []);
  useEffect(() => {
    const key = `paessed-learning-timer:${timerKey}`;
    let value = memory.get(key);
    try {
      if (!value) {
        const stored = JSON.parse(localStorage.getItem(key) ?? "null");
        if (stored?.version === 1 && Number.isFinite(stored.elapsedMs) && stored.elapsedMs >= 0)
          value = { version: 1, elapsedMs: stored.elapsedMs, frozen: stored.frozen === true };
      }
    } catch { setError("No se pudo recuperar el cronómetro guardado."); }
    record.current = value ?? { version: 1, elapsedMs: 0, frozen: false };
    setElapsed(record.current.elapsedMs);
    setLoadedKey(timerKey);
  }, [timerKey]);

  useEffect(() => {
    if (loadedKey !== timerKey) return;
    const key = `paessed-learning-timer:${timerKey}`;
    let start: number | null = null;
    const persist = () => {
      memory.set(key, { ...record.current });
      try { localStorage.setItem(key, JSON.stringify(record.current)); }
      catch { setError("El tiempo sigue en memoria, pero no pudo guardarse en este navegador."); }
    };
    const settle = () => {
      if (start !== null) {
        record.current.elapsedMs += Math.max(0, performance.now() - start);
        start = null;
      }
      setElapsed(record.current.elapsedMs);
      persist();
    };
    const resume = () => {
      if (enabled && ready && !paused && !frozen && !record.current.frozen && document.visibilityState === "visible") start = performance.now();
    };
    if (frozen) record.current.frozen = true;
    const visibility = () => { settle(); resume(); };
    const pageHide = () => settle();
    commit.current = settle;
    resume();
    if (frozen) persist();
    const interval = window.setInterval(() => { settle(); resume(); }, 1000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("pageshow", visibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("pageshow", visibility);
      settle();
      commit.current = () => {};
    };
  }, [timerKey, loadedKey, enabled, ready, paused, frozen]);

  const toggle = () => {
    commit.current();
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(PREFERENCE, String(next)); }
    catch { setError("La preferencia del cronómetro no pudo guardarse."); }
  };
  const seconds = Math.floor(elapsed / 1000);
  return { enabled, toggle, label: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`, error };
}
