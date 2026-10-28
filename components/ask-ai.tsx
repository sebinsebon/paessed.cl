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
            Se copia el enunciado y sus alternativas con las fórmulas originales, y se abre el proveedor.
            Pega el texto con Ctrl+V (o mantén pulsado en móvil). No se envía automáticamente.
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
  const [editing, setEditing] = useState(false);
  const [copyFailed, setCopyFailed] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const dialogId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setNotice(""); setCopyFailed(null); }, [question.number]);
  useEffect(() => {
    if (!editing && !copyFailed) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setEditing(false); setCopyFailed(null); }
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
  }, [editing, copyFailed]);

  if (!settings.enabled) return null;

  const destination = aiDestination(settings);
  const ask = () => {
    if (disabled) return;
    if (!destination) { setEditing(true); return; }
    const prompt = buildAiQuestionPrompt(question);
    // Start copying during the click; open the tab synchronously to avoid popup blockers.
    const copied = copyToClipboard(prompt);
    window.open(destination, "_blank", "noopener,noreferrer");
    void copied.then((success) => {
      if (success) { setNotice("Prompt copiado. Pégalo en tu IA con Ctrl+V."); setCopyFailed(null); }
      else { setNotice(""); setCopyFailed(prompt); }
    });
  };

  return (
    <>
      <div className="relative inline-flex shrink-0 items-stretch rounded-lg border border-[var(--pg-border,var(--border))] bg-[var(--pg-option,var(--surface))] text-[var(--pg-fg,var(--text))]">
        <button type="button" disabled={disabled} onClick={ask}
          title="Copiar el ejercicio y abrir tu IA" aria-label="Preguntar a la IA"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-l-lg px-2.5 text-[11px] font-bold transition-colors hover:bg-[var(--pg-option-hover,var(--surface-2))] disabled:opacity-40 sm:px-3">
          <Bot size={16} aria-hidden="true" /> <span className="hidden min-[420px]:inline">Preguntar a la IA</span><span className="min-[420px]:hidden">IA</span>
        </button>
        <button ref={settingsTriggerRef} type="button" onClick={() => setEditing(true)} title="Configurar proveedor de IA"
          aria-label="Configurar proveedor de IA" aria-haspopup="dialog" aria-controls={dialogId}
          className="grid min-h-10 w-8 place-items-center rounded-r-lg border-l border-[var(--pg-border,var(--border))] transition-colors hover:bg-[var(--pg-option-hover,var(--surface-2))]">
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      </div>
      {notice && <span role="status" className="sr-only">{notice}</span>}
      {typeof document !== "undefined" && (editing || copyFailed) && createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/65 p-4" role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) { setEditing(false); setCopyFailed(null); } }}>
          <section ref={dialogRef} id={dialogId} role="dialog" aria-modal="true" aria-label={editing ? "Configurar proveedor de IA" : "Copiar ejercicio manualmente"}
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-extrabold">{editing ? "Preguntar a la IA" : "Copiar el ejercicio"}</h2>
              <button type="button" onClick={() => { setEditing(false); setCopyFailed(null); }} aria-label="Cerrar"
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[var(--surface-2)]"><X size={18}/></button>
            </div>
            {editing ? (
              <>
                <AiHelpSettings settings={settings} onChange={onChange}/>
                <button type="button" onClick={() => setEditing(false)} className="tactile-primary mt-5 min-h-10 w-full rounded-xl px-4 text-[12px] font-bold">
                  <Check size={15} className="mr-1 inline"/> Listo
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-[12px] leading-5 text-[var(--muted)]">El navegador no permitió copiar automáticamente. Selecciona este texto y pégalo en tu IA.</p>
                <textarea readOnly value={copyFailed ?? ""} onFocus={(event) => event.currentTarget.select()}
                  aria-label="Prompt completo" className="mt-3 h-48 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[11px]" />
                <button type="button" onClick={() => { if (copyFailed) void copyToClipboard(copyFailed).then((success) => { if (success) { setCopyFailed(null); setNotice("Prompt copiado. Pégalo en tu IA."); } }); }}
                  className="soft-button mt-3 min-h-10 w-full rounded-xl text-[12px] font-bold"><Copy size={15} className="mr-1 inline"/> Reintentar copiar</button>
                {destination && <a href={destination} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--primary)]">Abrir proveedor <ExternalLink size={13}/></a>}
              </>
            )}
          </section>
        </div>, document.body)}
    </>
  );
}
