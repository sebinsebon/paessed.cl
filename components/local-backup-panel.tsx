"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Archive, Check, Download, FileUp, RotateCcw, ShieldCheck, X } from "lucide-react";
import {
  BACKUP_CATEGORIES, createLocalBackup, inspectLocalBackup, restoreLocalBackup,
  type BackupCategory, type LocalBackupPreview,
} from "@/lib/local-backup";
import {
  STORAGE_CATEGORIES, formatStorageBytes, type LocalStorageReport,
} from "@/lib/local-storage-audit";

type Props = { report: LocalStorageReport | null; onRestored: () => void };
type Busy = "export" | "inspect" | "restore" | null;

function categoryName(category: BackupCategory): string {
  return STORAGE_CATEGORIES.find((entry) => entry.id === category)?.label ?? category;
}

export function LocalBackupPanel({ report, onRestored }: Props) {
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const [exportSelected, setExportSelected] = useState<BackupCategory[]>([]);
  const [importSelected, setImportSelected] = useState<BackupCategory[]>([]);
  const [preview, setPreview] = useState<LocalBackupPreview | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!report) return;
    setExportSelected(BACKUP_CATEGORIES.filter((id) => (report.categories.find((item) => item.id === id)?.bytes ?? 0) > 0));
  }, [report]);

  useEffect(() => {
    if (!confirm) return;
    cancelRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) { setConfirm(false); restoreRef.current?.focus(); }
      if (event.key !== "Tab") return;
      const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault(); buttons[buttons.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
        event.preventDefault(); buttons[0].focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [confirm, busy]);

  function toggle(group: BackupCategory, selected: BackupCategory[], setSelected: (value: BackupCategory[]) => void) {
    setSelected(selected.includes(group) ? selected.filter((item) => item !== group) : [...selected, group]);
    setError(null);
  }

  async function download() {
    if (!report || !exportSelected.length || busy) return;
    setBusy("export");
    setMessage(null);
    setError(null);
    try {
      const blob = await createLocalBackup(exportSelected, report);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "PAESSED_respaldo_" + new Date().toISOString().slice(0, 10) + ".zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage("Respaldo creado (" + formatStorageBytes(blob.size) + "). Guárdalo en un lugar seguro.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo exportar la copia.");
    } finally {
      setBusy(null);
    }
  }

  async function readFile(file?: File) {
    if (!file || busy) return;
    setBusy("inspect");
    setPreview(null);
    setMessage(null);
    setError(null);
    setConfirm(false);
    try {
      const next = await inspectLocalBackup(file);
      setPreview(next);
      setImportSelected(next.categories.filter((id) => next.itemCounts[id] > 0));
      setOverwrite(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer el respaldo.");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function restore() {
    if (!preview || !importSelected.length || busy) return;
    setBusy("restore");
    setError(null);
    setMessage(null);
    try {
      const result = await restoreLocalBackup(preview, importSelected, overwrite);
      setConfirm(false);
      setMessage("Restauración terminada: " + result.examsAdded + " ensayos y " +
        result.entriesApplied + " registros recuperados. " +
        (result.examsSkipped + result.entriesSkipped) + " existentes conservados. " +
        "Recarga la página si importaste ajustes visuales.");
      onRestored();
    } catch (cause) {
      setConfirm(false);
      setError((cause instanceof Error ? cause.message : "No se pudo restaurar la copia.") +
        " Si se agotó el espacio del navegador, parte de la restauración podría haberse guardado. Actualiza para comprobarlo.");
      onRestored();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="profile-backup-title" className="mt-6 border-t border-[var(--border)] pt-6">
      <div className="flex items-center gap-2">
        <Archive size={18} className="text-[var(--primary)]" />
        <h3 id="profile-backup-title" className="text-[16px] font-extrabold">Copias de seguridad</h3>
      </div>
      <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
        Exporta solo las categorías que necesites y restáuralas en otro navegador. Los archivos permanecen en tu dispositivo.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold"><Download size={17} /> Exportar</div>
          <p className="mb-3 text-[11px] leading-5 text-[var(--muted)]">Selecciona qué incluir en un único archivo .zip.</p>
          <div className="space-y-1.5">
            {BACKUP_CATEGORIES.map((category) => {
              const bytes = report?.categories.find((item) => item.id === category)?.bytes ?? 0;
              return (
                <label key={category} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--surface)]">
                  <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold">
                    <input type="checkbox" aria-label={"Exportar " + categoryName(category)}
                      checked={exportSelected.includes(category)} disabled={busy !== null || !report || bytes === 0}
                      onChange={() => toggle(category, exportSelected, setExportSelected)}
                      className="h-4 w-4 shrink-0 accent-[var(--primary)]" />
                    <span>{categoryName(category)}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-[var(--muted)]">{formatStorageBytes(bytes)}</span>
                </label>
              );
            })}
          </div>
          <button type="button" onClick={() => { void download(); }}
            disabled={!report || !exportSelected.length || busy !== null}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-[12px] font-extrabold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            {busy === "export" ? "Preparando ZIP…" : <><Download size={16}/> Descargar respaldo</>}
          </button>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold"><FileUp size={17} /> Importar</div>
          <p className="mb-3 text-[11px] leading-5 text-[var(--muted)]">
            Primero se revisa el archivo; no se modificará nada hasta que confirmes.
          </p>
          <input ref={inputRef} type="file" accept=".zip,application/zip" className="sr-only"
            aria-label="Seleccionar respaldo PAESSED" onChange={(event) => { void readFile(event.target.files?.[0]); }} />
          <button type="button" disabled={busy !== null} onClick={() => inputRef.current?.click()}
            className="soft-button inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[12px] font-extrabold disabled:opacity-50">
            {busy === "inspect" ? "Verificando copia…" : <><FileUp size={16}/> Seleccionar ZIP</>}
          </button>

          {preview && (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" data-testid="backup-import-preview">
              <div className="flex items-start gap-2">
                <ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-500" />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-extrabold" title={preview.name}>{preview.name}</p>
                  <p className="mt-1 text-[10px] text-[var(--muted)]">
                    Copia del {new Date(preview.createdAt).toLocaleString("es-CL")} · {preview.examCount} ensayos
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Restaurar categorías</p>
              <div className="mt-1 space-y-1">
                {preview.categories.map((category) => (
                  <label key={category} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-1.5 py-2 hover:bg-[var(--surface-2)]">
                    <span className="flex items-center gap-2 text-[11px] font-semibold">
                      <input type="checkbox" checked={importSelected.includes(category)}
                        aria-label={"Importar " + categoryName(category)} disabled={busy !== null || preview.itemCounts[category] === 0}
                        onChange={() => toggle(category, importSelected, setImportSelected)}
                        className="h-4 w-4 accent-[var(--primary)]" />
                      {categoryName(category)}
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">{preview.itemCounts[category]} registros</span>
                  </label>
                ))}
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5">
                <input type="checkbox" checked={overwrite} disabled={busy !== null}
                  onChange={(event) => setOverwrite(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600" />
                <span className="text-[11px] leading-4">
                  <span className="font-extrabold">Reemplazar datos existentes</span>
                  <span className="mt-0.5 block text-[var(--muted)]">Solo en las categorías seleccionadas. Desactivado: conserva el avance actual.</span>
                </span>
              </label>
              <button ref={restoreRef} type="button" disabled={busy !== null || !importSelected.length}
                onClick={() => setConfirm(true)}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-[12px] font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-40">
                <RotateCcw size={16}/> Restaurar datos
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-[12px] text-rose-600 dark:text-rose-400">{error}</p>}
      {message && <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[12px]"><Check size={16} className="shrink-0 text-emerald-500"/>{message}</p>}
      <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">
        La copia puede contener tus respuestas, dibujos y datos de perfil: guárdala de forma privada.
        Los ensayos Gold de Default no se incluyen. Esta función no sincroniza tu cuenta en la nube.
      </p>

      <AnimatePresence initial={false}>
        {confirm && preview && (
          <motion.div key="restore-confirmation" className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}>
            <button type="button" aria-label="Cerrar confirmación" disabled={busy === "restore"}
              onClick={() => setConfirm(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-[3px]"/>
            <motion.div ref={dialogRef} role="alertdialog" aria-modal="true"
              aria-labelledby="backup-confirm-title" aria-describedby="backup-confirm-description"
              initial={reduceMotion ? false : { y: 14, scale: 0.97 }}
              animate={{ y: 0, scale: 1 }} exit={reduceMotion ? {} : { y: 8, scale: 0.99 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-[450px] rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-2xl sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Archive size={22} className="text-[var(--primary)]"/>
                <button type="button" aria-label="Cerrar" disabled={busy === "restore"} onClick={() => setConfirm(false)}><X size={18}/></button>
              </div>
              <h4 id="backup-confirm-title" className="text-[19px] font-extrabold">¿Restaurar esta copia?</h4>
              <p id="backup-confirm-description" className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
                Se importarán {importSelected.map(categoryName).join(", ")} desde «{preview.name}».
                {overwrite
                  ? " Los datos existentes de estas categorías podrán ser reemplazados."
                  : " Los datos que ya tengas se conservarán."}
                {" "}Los cambios se guardarán solo en este navegador.
              </p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button ref={cancelRef} type="button" disabled={busy === "restore"} onClick={() => { setConfirm(false); restoreRef.current?.focus(); }}
                  className="soft-button min-h-11 rounded-xl px-4 text-[12px] font-bold disabled:opacity-50">Cancelar</button>
                <button type="button" disabled={busy === "restore"} onClick={() => { void restore(); }}
                  className="min-h-11 rounded-xl bg-[var(--primary)] px-4 text-[12px] font-extrabold text-white disabled:opacity-50">
                  {busy === "restore" ? "Restaurando…" : "Confirmar restauración"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
