"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, Check, Copy, ExternalLink, MoreHorizontal, X } from "lucide-react";
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
  const providerId = useId();
  const customId = useId();
  return (
    <section aria-label="Ayuda con inteligencia artificial" className="mt-4 border-t border-[var(--border)] pt-4">
      <label className="flex cursor-pointer items-start justify-between gap-3">
        <span>
          <span className="block text-[12px] font-extrabold text-[var(--text)]">Preguntar a la IA</span>
          <span className="mt-1 block text-[11px] leading-4 text-[var(--muted)]">Desactivado por defecto. Muestra un botón en cada pregunta.</span>
        </span>
        <input type="checkbox" checked={settings.enabled} onChange={(event) => onChange({ ...settings, enabled: event.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]" aria-label="Activar Preguntar a la IA" />
      </label>
      {settings.enabled && (
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor={providerId} className="mb-1.5 block text-[11px] font-bold text-[var(--text)]">Proveedor de IA</label>
            <select id={providerId} value={settings.provider}
              onChange={(event) => onChange({ ...settings, provider: event.target.value as AiSettings["provider"] })}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] font-semibold text-[var(--text)]">
              {AI_PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
            </select>
          </div>
          {settings.provider === "custom" && (
            <div>
              <label htmlFor={customId} className="mb-1.5 block text-[11px] font-bold text-[var(--text)]">Enlace personalizado</label>
              <input id={customId} type="url" inputMode="url" placeholder="https://mi-ia.example/"
                value={settings.customUrl} onChange={(event) => onChange({ ...settings, customUrl: event.target.value })}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]" />
              {!aiDestination(settings) && <p role="status" className="mt-1 text-[10px] text-amber-600">Introduce un enlace http:// o https:// válido.</p>}
            </div>
          )}
          <p className="text-[10px] leading-4 text-[var(--muted)]">
            Al pulsar el botón verás el prompt completo, con el enunciado, alternativas y fórmulas originales.
            Podrás copiarlo y abrir tu IA para pegarlo allí. No se envía automáticamente.
            Si hay imágenes, tendrás que adjuntarlas manualmente.
          </p>
        </div>
      )}
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
  const [dialog, setDialog] = useState<"settings" | "prompt" | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const dialogId = useId();
  const promptId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setDialog(null); setCopied(false); setCopyError(false); }, [question.number]);
  useEffect(() => {
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
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
      (previouslyFocused?.isConnected ? previouslyFocused : settingsTriggerRef.current)?.focus();
    };
  }, [dialog]);

  if (!settings.enabled) return null;

  const destination = aiDestination(settings);
  const providerName = AI_PROVIDERS.find((provider) => provider.id === settings.provider)?.label ?? "IA";
  const prompt = dialog === "prompt" ? buildAiQuestionPrompt(question) : "";
  const previewPrompt = () => {
    if (disabled) return;
    setCopied(false);
    setCopyError(false);
    setDialog("prompt");
  };
  const copyPrompt = () => {
    void copyToClipboard(prompt).then((success) => {
      setCopied(success);
      setCopyError(!success);
    });
  };
  const openProvider = () => {
    if (!destination) { setDialog("settings"); return; }
    window.open(destination, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="relative inline-flex shrink-0 items-stretch rounded-lg border border-[var(--pg-border,var(--border))] bg-[var(--pg-option,var(--surface))] text-[var(--pg-fg,var(--text))]">
        <button type="button" disabled={disabled} onClick={previewPrompt}
          title="Ver el ejercicio y el prompt para copiar" aria-label="Preguntar a la IA"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-l-lg px-2.5 text-[11px] font-bold transition-colors hover:bg-[var(--pg-option-hover,var(--surface-2))] disabled:opacity-40 sm:px-3">
          <Bot size={16} aria-hidden="true" /> <span className="hidden min-[420px]:inline">Preguntar a la IA</span><span className="min-[420px]:hidden">IA</span>
        </button>
        <button ref={settingsTriggerRef} type="button" onClick={() => setDialog("settings")} title="Configurar proveedor de IA"
          aria-label="Configurar proveedor de IA" aria-haspopup="dialog" aria-controls={dialogId}
          className="grid min-h-10 w-8 place-items-center rounded-r-lg border-l border-[var(--pg-border,var(--border))] transition-colors hover:bg-[var(--pg-option-hover,var(--surface-2))]">
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      </div>
      {typeof document !== "undefined" && dialog && createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/65 p-4" role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}>
          <section ref={dialogRef} id={dialogId} role="dialog" aria-modal="true" aria-label={dialog === "settings" ? "Configurar proveedor de IA" : "Prompt para preguntar a la IA"}
            className={"max-h-[min(90dvh,850px)] w-full overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-2xl sm:p-6 " + (dialog === "prompt" ? "max-w-2xl" : "max-w-md")}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-extrabold">{dialog === "settings" ? "Configurar IA" : "Preguntar a la IA"}</h2>
              <button type="button" onClick={() => setDialog(null)} aria-label="Cerrar"
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[var(--surface-2)]"><X size={18}/></button>
            </div>
            {dialog === "settings" ? (
              <>
                <AiHelpSettings settings={settings} onChange={onChange}/>
                <button type="button" onClick={() => setDialog(null)} className="tactile-primary mt-5 min-h-10 w-full rounded-xl px-4 text-[12px] font-bold">
                  <Check size={15} className="mr-1 inline"/> Listo
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-[12px] leading-5 text-[var(--muted)]">
                  <strong className="text-[var(--text)]">1.</strong> Copia el mensaje completo de abajo. <strong className="text-[var(--text)]">2.</strong> Abre {providerName} y pégalo en su chat.
                  La IA no recibe el ejercicio hasta que tú lo pegues y lo envíes.
                </p>
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
                  <button type="button" onClick={openProvider}
                    className="tactile-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[12px] font-bold">
                    {destination ? `Abrir ${providerName}` : "Configurar enlace"} <ExternalLink size={16}/>
                  </button>
                </div>
              </>
            )}
          </section>
        </div>, document.body)}
    </>
  );
}
