"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, BarChart3, Database, HardDrive, RefreshCw, Trash2, X } from "lucide-react";
import { LocalBackupPanel } from "@/components/local-backup-panel";
import {
  STORAGE_CATEGORIES, clearLocalStorageCategory, clearSingleImportedExam,
  formatStorageBytes, inspectLocalStorage,
  type LocalStorageReport, type StorageCategoryId,
} from "@/lib/local-storage-audit";

type DeleteTarget =
  | { kind: "category"; id: StorageCategoryId; label: string; bytes: number }
  | { kind: "exam"; id: string; label: string; bytes: number };

function deleteExplanation(target: DeleteTarget): string {
  if (target.kind === "exam") return "Se eliminarán el paquete, sus respuestas, dibujos y marcas en este navegador.";
  if (target.id === "exams") return "Se eliminarán todos los ensayos importados y su avance local. Los Gold de Default no se borrarán.";
  if (target.id === "sessions") return "Se borrarán respuestas, intentos y resultados locales. Se conservarán dibujos y preguntas marcadas.";
  if (target.id === "drawings") return "Se borrarán los trazos guardados en los ensayos, conservando las respuestas y las marcas.";
  if (target.id === "marked") return "Se quitarán las marcas de ensayos y las preguntas guardadas del Playground.";
  if (target.id === "diagnostic") return "Se eliminará el resultado del diagnóstico almacenado en este navegador.";
  if (target.id === "playground") return "Se vaciará el historial de preguntas recientes del Playground.";
  if (target.id === "preferences") return "Se eliminarán los ajustes y datos de perfil locales de PAESSED.";
  return "No se eliminarán claves desconocidas.";
}

export function LocalStorageDashboard() {
  const reduceMotion = useReducedMotion();
  const [report, setReport] = useState<LocalStorageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const refreshRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await inspectLocalStorage());
      setReadError(null);
    } catch (error) {
      setReadError(error instanceof Error ? error.message : "No se pudo medir el almacenamiento local.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onActivity = () => { void refresh(); };
    window.addEventListener("storage", onActivity);
    window.addEventListener("focus", onActivity);
    return () => {
      window.removeEventListener("storage", onActivity);
      window.removeEventListener("focus", onActivity);
    };
  }, [refresh]);

  useEffect(() => {
    if (!deleteTarget) return;
    if (!deleting) cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) {
        event.preventDefault();
        setDeleteTarget(null);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
      if (event.key !== "Tab") return;
      const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault();
        buttons[buttons.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
        event.preventDefault();
        buttons[0].focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [deleteTarget, deleting]);

  const openDelete = (target: DeleteTarget, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setDeleteError(null);
    setNotice(null);
    setDeleteTarget(target);
  };
  const closeDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const confirmDelete = async () => {
    if (!deleteTarget || !report || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (deleteTarget.kind === "exam") await clearSingleImportedExam(deleteTarget.id);
      else await clearLocalStorageCategory(deleteTarget.id, report);
      const label = deleteTarget.label;
      const updated = await inspectLocalStorage();
      setReport(updated);
      setDeleteTarget(null);
      setNotice("Se eliminaron los datos de «" + label + "» de este navegador.");
      window.requestAnimationFrame(() => refreshRef.current?.focus());
    } catch (error) {
      setDeleteError((error instanceof Error ? error.message : "La eliminación no se pudo completar.") + " Comprueba el estado actualizado antes de volver a intentarlo.");
      try { setReport(await inspectLocalStorage()); } catch { /* Keep the last known report. */ }
    } finally {
      setDeleting(false);
    }
  };

  const categories = report?.categories ?? [];
  const largest = Math.max(1, ...categories.map((category) => category.bytes));
  const hasData = categories.some((category) => category.bytes > 0);

  return (
    <section aria-labelledby="profile-storage-title" className="surface mt-5 rounded-[24px] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.13em] text-[var(--primary)]">
            <Database size={14} /> Solo en este navegador
          </div>
          <h2 id="profile-storage-title" className="flex items-center gap-2 text-[20px] font-extrabold tracking-[-.025em]">
            <HardDrive size={21} /> Almacenamiento local
          </h2>
          <p className="mt-1 max-w-[720px] text-[12px] leading-5 text-[var(--muted)]">
            Consulta cuánto ocupan tus datos de PAESSED y libera espacio cuando quieras.
          </p>
        </div>
        <button ref={refreshRef} type="button" onClick={() => { void refresh(); }} disabled={loading}
          className="soft-button inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-[12px] font-bold disabled:opacity-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {readError && <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs"><AlertCircle size={16}/>{readError}</p>}
      {notice && <div role="status" className="mt-4 flex items-start justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-[12px]">
        <span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso"><X size={14}/></button>
      </div>}
      {(report?.examError || report?.localError) && (
        <p role="alert" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12px]">
          {[report.examError, report.localError].filter(Boolean).join(" ")} Los totales pueden estar incompletos.
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">Datos identificados</p>
          <p className="mt-1 text-[25px] font-extrabold tabular-nums">{report ? formatStorageBytes(report.identifiedBytes) : "—"}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">Ensayos locales</p>
          <p className="mt-1 text-[25px] font-extrabold tabular-nums">{report ? report.exams.length : "—"}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">Uso del sitio (navegador)</p>
          <p className="mt-1 text-[25px] font-extrabold tabular-nums">{report?.browserReportedBytes != null ? formatStorageBytes(report.browserReportedBytes) : "No disponible"}</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 size={17} className="text-[var(--primary)]"/>
          <h3 className="text-[15px] font-extrabold">Consumo por categoría</h3>
        </div>
        {loading && !report ? <p role="status" className="py-6 text-center text-xs text-[var(--muted)]">Calculando tamaños del navegador…</p> : (
          <div className="space-y-4">
            {!hasData && <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-[12px] text-[var(--muted)]">Todavía no hay datos locales identificados.</p>}
            {STORAGE_CATEGORIES.map((definition) => {
              const category = categories.find((entry) => entry.id === definition.id);
              const bytes = category?.bytes ?? 0;
              const disabled = loading || deleting || bytes === 0 || definition.id === "other";
              return (
                <div key={definition.id} data-testid={"storage-category-" + definition.id} className="grid gap-2 sm:grid-cols-[minmax(170px,.8fr)_minmax(100px,1.5fr)_94px] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-[var(--text)]">{definition.label}</div>
                    <div className="mt-0.5 text-[10px] text-[var(--muted)]">{category?.itemCount ?? 0} elementos</div>
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <div role="img" aria-label={definition.label + ": " + formatStorageBytes(bytes)}
                      className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                      <motion.div className={"h-full rounded-full " + definition.color}
                        initial={false}
                        animate={{ width: bytes === 0 ? "0%" : Math.max(0.8, (bytes / largest) * 100) + "%" }}
                        transition={{ duration: reduceMotion ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] }} />
                    </div>
                    <span className="w-[76px] shrink-0 text-right text-[11px] font-extrabold tabular-nums">{formatStorageBytes(bytes)}</span>
                  </div>
                  <button type="button" disabled={disabled}
                    onClick={(event) => openDelete({ kind: "category", id: definition.id, label: definition.label, bytes }, event.currentTarget)}
                    className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-rose-500/20 px-2 text-[11px] font-bold text-rose-600 transition-colors hover:bg-rose-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-30 dark:text-rose-400">
                    <Trash2 size={13} /> Borrar
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">
          Tamaños aproximados: archivos y contenido guardado, sin contar toda la sobrecarga interna.
          La cifra del navegador puede incluir caché y otros datos del sitio. Las barras se comparan con la categoría de mayor tamaño.
        </p>
      </div>

      <div className="mt-6 border-t border-[var(--border)] pt-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-extrabold">Ensayos guardados</h3>
          <span className="text-[11px] font-semibold text-[var(--muted)]">{report?.exams.length ?? 0} archivos</span>
        </div>
        {report?.exams.length ? (
          <div className="space-y-2">
            {report.exams.map((exam) => (
              <motion.div layout key={exam.id} data-testid={"storage-exam-" + exam.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-extrabold" title={exam.title}>{exam.title}</p>
                  <p className="mt-1 truncate text-[10px] text-[var(--muted)]" title={exam.fileName}>{exam.fileName} · {exam.questionCount} preguntas</p>
                  <p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">
                    Uso estimado: <span className="font-extrabold text-[var(--text)]">{formatStorageBytes(exam.estimatedBytes)}</span>
                    {exam.archiveBytes > 0 && " · Archivo: " + formatStorageBytes(exam.archiveBytes)}
                  </p>
                </div>
                <button type="button" disabled={loading || deleting}
                  onClick={(event) => openDelete({ kind: "exam", id: exam.id, label: exam.title, bytes: exam.estimatedBytes }, event.currentTarget)}
                  aria-label={"Eliminar ensayo " + exam.title}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-500/25 px-3 text-[11px] font-bold text-rose-600 transition-colors hover:bg-rose-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-50 dark:text-rose-400">
                  <Trash2 size={14}/> Eliminar
                </button>
              </motion.div>
            ))}
          </div>
        ) : <p className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center text-[12px] text-[var(--muted)]">No tienes ensayos importados en este navegador.</p>}
      </div>

      <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">
        Actualmente el diagnóstico conserva su resultado y Playground conserva preguntas recientes y guardadas.
        El guardado de sesiones más completas llegará en una etapa posterior.
      </p>

      <LocalBackupPanel report={report} onRestored={() => { void refresh(); }} />

      <AnimatePresence initial={false}>
        {deleteTarget && (
          <motion.div key="storage-delete" className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}>
            <button type="button" aria-label="Cerrar confirmación" disabled={deleting} onClick={closeDelete}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-[3px]" />
            <motion.div ref={dialogRef} role="alertdialog" aria-modal="true"
              aria-labelledby="storage-delete-title" aria-describedby="storage-delete-description"
              initial={reduceMotion ? false : { y: 15, scale: 0.97 }}
              animate={{ y: 0, scale: 1 }} exit={reduceMotion ? {} : { y: 8, scale: 0.985 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-[445px] rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-2xl sm:p-6">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400"><Trash2 size={21}/></div>
              <h3 id="storage-delete-title" className="text-[20px] font-extrabold tracking-[-.025em]">¿Eliminar estos datos?</h3>
              <p className="mt-1 break-words text-[13px] font-bold">{deleteTarget.label}</p>
              <p id="storage-delete-description" className="mt-3 text-[12px] leading-5 text-[var(--muted)]">
                {formatStorageBytes(deleteTarget.bytes)} estimados. {deleteExplanation(deleteTarget)}
                {" "}Esta acción no se puede deshacer.
              </p>
              {deleteError && <p role="alert" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">{deleteError}</p>}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button ref={cancelRef} type="button" disabled={deleting} onClick={closeDelete}
                  className="soft-button min-h-11 rounded-xl px-4 text-[12px] font-bold disabled:opacity-40">Cancelar</button>
                <button type="button" disabled={deleting} onClick={() => { void confirmDelete(); }}
                  className="min-h-11 rounded-xl bg-rose-600 px-4 text-[12px] font-extrabold text-white transition-colors hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-50">
                  {deleting ? "Eliminando…" : "Eliminar definitivamente"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
