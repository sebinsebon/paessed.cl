"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, Check, Copy, ExternalLink, X } from "lucide-react";
import {
  AI_PROVIDERS, AI_SETTINGS_EVENT, DEFAULT_AI_SETTINGS,
  aiDestination, buildAiQuestionPrompt, readAiSettings, saveAiSettings,
  type AiQuestion, type AiSettings,
} from "@/lib/ai-assistance";

export function useAiSettings() {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);

  useEffect(() => {
    const sync = () => setSettings(readAiSettings());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(AI_SETTINGS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(AI_SETTINGS_EVENT, sync);
    };
  }, []);

  const update = useCallback((next: AiSettings) => {
    setSettings(next);
    saveAiSettings(next);
  }, []);
  return { aiSettings: settings, updateAiSettings: update };
}

type SettingsProps = { settings: AiSettings; onChange: (next: AiSettings) => void };

export function AiHelpSettings({ settings, onChange }: SettingsProps) {
  return (
    <section aria-label="Ayuda con inteligencia artificial" className="mt-4 border-t border-[var(--border)] pt-4">
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 transition-colors hover:border-[var(--primary)]">
        <span className="min-w-0">
          <span className="block text-[12px] font-extrabold text-[var(--text)]">Preguntar a la IA</span>
          <span className="mt-1 block text-[11px] leading-4 text-[var(--muted)]">{settings.enabled ? "Disponible en cada pregunta" : "Activar ayuda opcional para cada pregunta"}</span>
        </span>
        <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
          <input type="checkbox" checked={settings.enabled} onChange={(event) => onChange({ ...settings, enabled: event.target.checked })}
            className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" aria-label="Activar Preguntar a la IA" />
          <span aria-hidden="true" className="absolute inset-0 rounded-full border border-[var(--border)] bg-[var(--surface-3)] transition-colors peer-checked:border-[var(--primary)] peer-checked:bg-[var(--primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--primary)]" />
          <span aria-hidden="true" className="pointer-events-none relative ml-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
      {settings.enabled && <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">Elige tu IA al abrir el ejercicio; se recordará tu última elección. Tendrás que copiar y pegar el prompt.</p>}
    </section>
  );
}

async function copyToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(value); return true; }
    catch { /* Try a browser-compatible fallback. */ }
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try { return document.execCommand("copy"); }
  catch { return false; }
  finally { area.remove(); }
}

type AskProps = SettingsProps & { question: AiQuestion; disabled?: boolean };

export function AskAiButton({ settings, onChange, question, disabled = false }: AskProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const dialogId = useId();
  const promptId = useId();
  const providerId = useId();
  const customId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setDialogOpen(false); setCopied(false); setCopyError(false); }, [question.number]);
  useEffect(() => {
    if (!dialogOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialogOpen(false);
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'
      ) ?? []);
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault(); controls[controls.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
        event.preventDefault(); controls[0].focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      (previouslyFocused?.isConnected ? previouslyFocused : triggerRef.current)?.focus();
    };
  }, [dialogOpen]);

  if (!settings.enabled) return null;

  const destination = aiDestination(settings);
  const providerName = AI_PROVIDERS.find((provider) => provider.id === settings.provider)?.label ?? "IA";
  const prompt = dialogOpen ? buildAiQuestionPrompt(question) : "";
  const previewPrompt = () => {
    if (disabled) return;
    setCopied(false);
    setCopyError(false);
    setDialogOpen(true);
  };
  const copyPrompt = () => {
    void copyToClipboard(prompt).then((success) => {
      setCopied(success);
      setCopyError(!success);
    });
  };
  const openProvider = () => {
    if (!destination) return;
    window.open(destination, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="inline-flex shrink-0">
        <button ref={triggerRef} type="button" disabled={disabled} onClick={previewPrompt}
          title="Ver el ejercicio y el prompt para copiar" aria-label="Preguntar a la IA"
          aria-haspopup="dialog" aria-controls={dialogId} aria-expanded={dialogOpen}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--pg-border,var(--border))] bg-[var(--pg-option,var(--surface))] px-2.5 text-[11px] font-bold text-[var(--pg-fg,var(--text))] transition-colors hover:border-[var(--primary)] hover:bg-[var(--pg-option-hover,var(--surface-2))] disabled:opacity-40 sm:px-3">
          <Bot size={15} aria-hidden="true" /> Preguntar a la IA
        </button>
      </div>
      {typeof document !== "undefined" && dialogOpen && createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/65 p-4" role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
          <section ref={dialogRef} id={dialogId} role="dialog" aria-modal="true" aria-label="Prompt para preguntar a la IA"
            className="max-h-[min(90dvh,850px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-2xl sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-extrabold">Preguntar a la IA</h2>
              <button type="button" onClick={() => setDialogOpen(false)} aria-label="Cerrar"
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[var(--surface-2)]"><X size={18}/></button>
            </div>
            <>
                <p className="mt-3 text-[12px] leading-5 text-[var(--muted)]">
                  <strong className="text-[var(--text)]">1.</strong> Copia el mensaje completo de abajo. <strong className="text-[var(--text)]">2.</strong> Abre {providerName} y pégalo en su chat.
                  La IA no recibe el ejercicio hasta que tú lo pegues y lo envíes.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <label htmlFor={providerId} className="mb-1.5 block text-[11px] font-extrabold">¿Qué IA quieres usar?</label>
                    <select id={providerId} value={settings.provider}
                      onChange={(event) => onChange({ ...settings, provider: event.target.value as AiSettings["provider"] })}
                      className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[12px] font-semibold text-[var(--text)]">
                      {AI_PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                    </select>
                  </div>
                  <p className="pb-1 text-[10px] text-[var(--muted)]">Se guarda tu última elección.</p>
                </div>
                {settings.provider === "custom" && (
                  <div className="mt-3">
                    <label htmlFor={customId} className="mb-1.5 block text-[11px] font-bold">Enlace personalizado</label>
                    <input id={customId} type="url" inputMode="url" placeholder="https://mi-ia.example/"
                      value={settings.customUrl} onChange={(event) => onChange({ ...settings, customUrl: event.target.value })}
                      className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]" />
                    {!destination && <p role="status" className="mt-1 text-[11px] text-amber-600">Escribe un enlace http:// o https:// válido.</p>}
                  </div>
                )}
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor={promptId} className="text-[12px] font-extrabold">Prompt completo + ejercicio</label>
                    <span className="text-[10px] font-semibold text-[var(--muted)]">Puedes seleccionarlo</span>
                  </div>
                  <textarea id={promptId} readOnly value={prompt} onFocus={(event) => event.currentTarget.select()}
                    className="h-[min(43dvh,340px)] min-h-40 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-[12px] leading-5 text-[var(--text)] outline-offset-2" />
                </div>
                <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">Incluye enunciado, alternativas, fórmulas y tablas. Si la pregunta tiene una imagen, adjúntala manualmente en la IA.</p>
                {copied && <p role="status" className="mt-3 text-[12px] font-bold text-emerald-600">¡Copiado! Ahora abre {providerName} y pega con Ctrl+V.</p>}
                {copyError && <p role="alert" className="mt-3 text-[12px] font-bold text-amber-600">No se pudo copiar automáticamente. Selecciona el texto y usa Ctrl+C.</p>}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={copyPrompt}
                    className="soft-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[12px] font-bold">
                    {copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copiado" : "Copiar prompt"}
                  </button>
                  <button type="button" onClick={openProvider} disabled={!destination}
                    className="tactile-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-45">
                    Abrir {providerName} <ExternalLink size={16}/>
                  </button>
                </div>
              </>
          </section>
        </div>, document.body)}
    </>
  );
}
