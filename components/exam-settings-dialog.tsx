"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {buildPaessedPackage} from "@/lib/paessed-export";
import {validatePaessed} from "@/lib/paessed-package";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, ArrowDownToLine, Archive, Check, ChevronDown, FileJson2, RotateCcw, Save, ShieldAlert, Upload, X } from "lucide-react";
import {
  answerCount, applyAdvancedQuestionJson, applyQuestionPatch, getEditableQuestions, inspectQuestion, isJsonObject,
  type QuestionPatch, type QuestionView,
} from "@/lib/exam-editing";
import { getImportedExam, saveImportedExam, IMPORTED_EXAM_PROGRESS_PREFIX, type ImportedExamRecord } from "@/lib/local-imports";
import { createExamBackup, inspectExamBackup, type ExamBackupPreview } from "@/lib/exam-backup";

type EditorTab = "basic" | "advanced" | "backups";

type EditorProps = { examId: string; onClose: () => void; onSaved: () => Promise<void> | void };

function formFromQuestion(view: QuestionView): QuestionPatch {
  return { number: view.number, stem: view.stem, options: view.options.map((option) => option.text), answer: view.answer };
}

function previewFor(document: unknown) {
  return getEditableQuestions(document).slice(0, 6).map((_, index) => {
    try {
      const view = inspectQuestion(document, index);
      return { id: view.number, text: view.stem.slice(0, 240) || "Pregunta con contenido estructurado" };
    } catch {
      return { id: String(index + 1), text: "Pregunta sin vista previa" };
    }
  });
}

async function exportPackage(record: ImportedExamRecord): Promise<void> {
  let result: Blob;
  if (isJsonObject(record.finalJson) && record.finalJson.format === "paessed-benchmark") {
    result = await buildPaessedPackage(record);
  } else {
    const zip = record.archive ? await JSZip.loadAsync(record.archive) : new JSZip();
    const existing = Object.keys(zip.files)
      .filter((path) => /(^|\/)final\.json$/i.test(path))
      .sort((a, b) => a.split("/").length - b.split("/").length);
    zip.file(existing[0] ?? "final.json", JSON.stringify(record.finalJson, null, 2));
    result = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  }
  const url = URL.createObjectURL(result);
  const name = record.summary.fileName.replace(/\.(zip|json|paessed)$/i, "") || "ensayo";
  const link = document.createElement("a");
  link.href = url;
  link.download = name + "-editado.paessed";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function ExamSettingsDialog({ examId, onClose, onSaved }: EditorProps) {
  const [record, setRecord] = useState<ImportedExamRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [form, setForm] = useState<QuestionPatch | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState<EditorTab>("basic");
  const [advancedPrompt, setAdvancedPrompt] = useState(false);
  const [advancedUnlocked, setAdvancedUnlocked] = useState(false);
  const [advancedText, setAdvancedText] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupPreview, setBackupPreview] = useState<ExamBackupPreview | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let current = true;
    void getImportedExam(examId).then((result) => {
      if (!current) return;
      setRecord(result);
      if (result && getEditableQuestions(result.finalJson).length > 0) {
        setAdvancedText(JSON.stringify(getEditableQuestions(result.finalJson)[0], null, 2) ?? "");
        try { setForm(formFromQuestion(inspectQuestion(result.finalJson, 0))); }
        catch (err) { setError(err instanceof Error ? err.message : "No se pudo leer la primera pregunta."); }
      }
    }).catch((err: unknown) => {
      if (current) setError(err instanceof Error ? err.message : "No se pudo abrir el archivo.");
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [examId]);

  const questions = useMemo(() => getEditableQuestions(record?.finalJson), [record]);
  const inspected = useMemo(() => {
    if (!record || active < 0 || active >= questions.length) return null;
    try { return inspectQuestion(record.finalJson, active); } catch { return null; }
  }, [record, active, questions.length]);

  const basicDirty = !!form && !!inspected && (
    form.number !== inspected.number ||
    form.stem !== inspected.stem ||
    form.answer !== inspected.answer ||
    form.options.some((value, index) => value !== inspected.options[index]?.text)
  );
  const originalAdvancedText = questions[active] === undefined ? "" : JSON.stringify(questions[active], null, 2);
  const advancedDirty = advancedText !== originalAdvancedText;
  const dirty = basicDirty || advancedDirty;

  const dismiss = useCallback(() => {
    if (saving || exporting || backupBusy) return;
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos y cerrar?")) return;
    onClose();
  }, [dirty, saving, exporting, backupBusy, onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (advancedPrompt) setAdvancedPrompt(false);
        else if (confirmRestore) setConfirmRestore(false);
        else dismiss();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [dismiss, advancedPrompt, confirmRestore]);

  const chooseQuestion = (index: number) => {
    if (!record || saving || backupBusy || active === index) return;
    if (dirty && !window.confirm("Tienes cambios sin guardar. ¿Descartarlos y abrir otra pregunta?")) return;
    try {
      setActive(index);
      setForm(formFromQuestion(inspectQuestion(record.finalJson, index)));
      setAdvancedText(JSON.stringify(getEditableQuestions(record.finalJson)[index], null, 2) ?? "");
      setError("");
      setNotice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Esta pregunta no admite edición visual.");
    }
  };

  const save = async () => {
    if (!record || saving || exporting || backupBusy || tab === "backups") return;
    if (tab === "advanced" ? !advancedDirty : !form || !basicDirty) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updatedJson = tab === "advanced"
        ? applyAdvancedQuestionJson(record.finalJson, active, advancedText)
        : applyQuestionPatch(record.finalJson, active, form!);
      if (isJsonObject(updatedJson) && updatedJson.format === "paessed-benchmark") validatePaessed(updatedJson);
      const updatedQuestions = getEditableQuestions(updatedJson);
      const next: ImportedExamRecord = {
        ...record,
        finalJson: updatedJson,
        summary: {
          ...record.summary,
          questionCount: updatedQuestions.length,
          idCount: updatedQuestions.filter((item) => isJsonObject(item) &&
            ["id", "question_id", "questionId", "number"].some((key) =>
              typeof item[key] === "string" || typeof item[key] === "number")).length,
          answerCount: answerCount(updatedJson),
          preview: previewFor(updatedJson),
        },
      };
      await saveImportedExam(next);
      setRecord(next);
      setAdvancedText(JSON.stringify(getEditableQuestions(next.finalJson)[active], null, 2) ?? "");
      try { setForm(formFromQuestion(inspectQuestion(next.finalJson, active))); }
      catch { setForm(null); }
      setNotice(tab === "advanced"
        ? "Contenido avanzado guardado. La pregunta requiere una nueva verificación."
        : "Cambios guardados en este navegador.");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el ensayo.");
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    if (!record || dirty || saving || exporting || backupBusy) return;
    setExporting(true);
    setError("");
    try {
      await exportPackage(record);
      setNotice("Paquete actualizado generado con sus recursos originales.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar el paquete.");
    } finally {
      setExporting(false);
    }
  };

  const switchTab = (next: EditorTab) => {
    if (saving || exporting || backupBusy || next === tab) return;
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos y cambiar de sección?")) return;
    if (record && questions[active] !== undefined) {
      setAdvancedText(JSON.stringify(questions[active], null, 2) ?? "");
      try { setForm(formFromQuestion(inspectQuestion(record.finalJson, active))); }
      catch { setForm(null); }
    }
    setError("");
    setNotice("");
    setConfirmRestore(false);
    if (next === "advanced" && !advancedUnlocked) {
      setAdvancedPrompt(true);
      return;
    }
    setAdvancedPrompt(false);
    setTab(next);
  };

  const downloadBackup = async (): Promise<boolean> => {
    if (!record || saving || exporting || backupBusy) return false;
    setBackupBusy(true);
    setError("");
    try {
      const blob = await createExamBackup(record);
      const safeName = record.summary.title.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 56) || "ensayo";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeName + "-respaldo-" + new Date().toISOString().slice(0, 10) + ".zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotice("Respaldo descargado. Incluye las preguntas, los recursos y el progreso guardado.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el respaldo.");
      return false;
    } finally {
      setBackupBusy(false);
    }
  };

  const enterAdvanced = async (withBackup: boolean) => {
    if (withBackup && !(await downloadBackup())) return;
    setAdvancedUnlocked(true);
    setAdvancedPrompt(false);
    setTab("advanced");
    setError("");
  };

  const readBackup = async (file?: File) => {
    if (!file || backupBusy || !record) return;
    setBackupBusy(true);
    setError("");
    setNotice("");
    setBackupPreview(null);
    setConfirmRestore(false);
    try {
      const result = await inspectExamBackup(file, examId);
      setBackupPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el respaldo.");
    } finally {
      setBackupBusy(false);
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  };

  const restoreBackup = async () => {
    if (!record || !backupPreview || backupBusy || saving) return;
    setBackupBusy(true);
    setError("");
    try {
      const restored = backupPreview.record;
      await saveImportedExam(restored);
      const key = IMPORTED_EXAM_PROGRESS_PREFIX + examId;
      if (backupPreview.progress === null) localStorage.removeItem(key);
      else localStorage.setItem(key, backupPreview.progress);
      setRecord(restored);
      setActive(0);
      setAdvancedText(JSON.stringify(getEditableQuestions(restored.finalJson)[0], null, 2) ?? "");
      try { setForm(formFromQuestion(inspectQuestion(restored.finalJson, 0))); }
      catch { setForm(null); }
      setBackupPreview(null);
      setConfirmRestore(false);
      setNotice("Respaldo restaurado. Se recuperaron el contenido y el progreso de esta copia.");
      await onSaved();
    } catch (err) {
      setError((err instanceof Error ? err.message : "No se pudo restaurar el respaldo.") +
        " Comprueba el estado actual antes de volver a intentarlo.");
    } finally {
      setBackupBusy(false);
    }
  };

  const fieldClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--text)] outline-offset-2 focus:border-[var(--primary)] focus:outline-[var(--primary)]";
  const labelClass = "mb-2 block text-[12px] font-bold text-[var(--text)]";

  return (
    <AnimatePresence>
      <motion.div
        key="settings-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-[#030711]/75 p-3 backdrop-blur-[3px] sm:p-6"
      >
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-labelledby="exam-editor-title"
          initial={{ opacity: 0, y: 16, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.985 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="flex max-h-[min(90vh,850px)] w-full max-w-[970px] flex-col overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--primary)]">
                <FileJson2 size={14} /> Editor local
              </div>
              <h2 id="exam-editor-title" className="text-xl font-extrabold tracking-[-.025em]">Ajustes del ensayo</h2>
              <p className="mt-1 truncate text-[12px] text-[var(--muted)]">{record?.summary.title ?? "Abriendo el archivo..."}</p>
            </div>
            <button type="button" onClick={dismiss} aria-label="Cerrar ajustes" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]">
              <X size={19} />
            </button>
          </header>

          {record && (
            <nav aria-label="Secciones de ajustes del ensayo" className="flex shrink-0 flex-wrap gap-1 border-b border-[var(--border)] bg-[var(--surface-2)]/30 px-4 py-2 sm:px-6">
              {([
                ["basic", "Edición normal"],
                ["advanced", "Modo avanzado"],
                ["backups", "Respaldos"],
              ] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => switchTab(id)}
                  aria-current={tab === id && !advancedPrompt ? "page" : undefined}
                  className={"rounded-lg px-3 py-2 text-[12px] font-extrabold transition-colors " +
                    (tab === id && !advancedPrompt
                      ? "bg-[var(--surface)] text-[var(--primary)] shadow-[var(--shadow-1)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]")}>
                  {label}
                </button>
              ))}
            </nav>
          )}

          {loading ? (
            <div className="p-8 text-sm text-[var(--muted)]">Cargando preguntas…</div>
          ) : !record ? (
            <div className="p-8 text-sm text-[var(--muted)]">No se encontró el archivo en la biblioteca local.</div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[215px_minmax(0,1fr)] md:overflow-hidden">
              <aside className="border-b border-[var(--border)] bg-[var(--surface-2)]/40 p-4 md:overflow-y-auto md:border-b-0 md:border-r">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-extrabold uppercase tracking-[.09em] text-[var(--muted)]">Preguntas</p>
                  <span className="text-[11px] font-bold text-[var(--muted)]">{questions.length}</span>
                </div>
                <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10 md:grid-cols-4">
                  {questions.map((_, index) => {
                    const number = String(index + 1);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => chooseQuestion(index)}
                        aria-current={active === index ? "true" : undefined}
                        title={"Pregunta " + number}
                        className={"min-h-9 truncate rounded-lg border px-1 text-[11px] font-extrabold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-[var(--primary)] " + (active === index ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]")}
                      >
                        {number}
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="min-h-0 min-w-0 space-y-5 p-5 md:overflow-y-auto sm:p-6">
                {advancedPrompt ? (
                  <section role="group" aria-labelledby="advanced-confirm-title" className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5">
                    <div className="mb-3 flex items-center gap-2 text-amber-600 dark:text-amber-400"><ShieldAlert size={20}/><span className="text-[11px] font-extrabold uppercase tracking-wider">Advertencia</span></div>
                    <h3 id="advanced-confirm-title" className="text-[18px] font-extrabold">¿Activar el modo avanzado?</h3>
                    <p className="mt-2 text-[12px] leading-6 text-[var(--muted)]">
                      Podrás modificar directamente los bloques JSON de las preguntas, incluidas fórmulas, imágenes, alternativas y respuestas estructuradas.
                      Un cambio incorrecto puede inutilizar el ensayo. Las preguntas editadas perderán su verificación Gold hasta revisarlas.
                    </p>
                    <p className="mt-3 text-[12px] font-bold">¿Quieres descargar un respaldo antes de continuar?</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" disabled={backupBusy} onClick={() => { void enterAdvanced(true); }}
                        className="tactile-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[12px] font-extrabold disabled:opacity-50">
                        <Archive size={16}/> {backupBusy ? "Preparando…" : "Respaldar y continuar"}
                      </button>
                      <button type="button" disabled={backupBusy} onClick={() => { void enterAdvanced(false); }}
                        className="soft-button inline-flex min-h-10 items-center rounded-xl px-4 text-[12px] font-bold disabled:opacity-50">
                        Continuar sin respaldo
                      </button>
                      <button type="button" onClick={() => setAdvancedPrompt(false)}
                        className="rounded-xl px-3 text-[12px] font-bold text-[var(--muted)]">Cancelar</button>
                    </div>
                  </section>
                ) : tab === "backups" ? (
                  <section aria-label="Respaldos de este ensayo" className="space-y-4">
                    <div>
                      <h3 className="text-[19px] font-extrabold">Respaldos del ensayo</h3>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
                        Guarda una copia con preguntas, respuestas, recursos originales y progreso local.
                        Puedes restaurarla después en este mismo ensayo.
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4">
                      <div className="flex items-start gap-3">
                        <Archive size={20} className="mt-0.5 shrink-0 text-[var(--primary)]"/>
                        <div>
                          <p className="text-[13px] font-extrabold">Crear respaldo</p>
                          <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                            Descarga un archivo ZIP recuperable sin modificar el ensayo actual.
                          </p>
                        </div>
                      </div>
                      <button type="button" disabled={backupBusy || saving || exporting} onClick={() => { void downloadBackup(); }}
                        className="soft-button mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[12px] font-bold disabled:opacity-50">
                        <ArrowDownToLine size={16}/> {backupBusy ? "Preparando…" : "Descargar respaldo .zip"}
                      </button>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4">
                      <div className="flex items-start gap-3">
                        <RotateCcw size={20} className="mt-0.5 shrink-0 text-[var(--primary)]"/>
                        <div>
                          <p className="text-[13px] font-extrabold">Restaurar respaldo</p>
                          <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                            Elige una copia creada para este ensayo. Revisaremos el archivo antes de sobrescribir cualquier dato.
                          </p>
                        </div>
                      </div>
                      <input ref={backupInputRef} type="file" accept=".zip,application/zip" className="sr-only"
                        aria-label="Seleccionar respaldo de este ensayo"
                        onChange={(event) => { void readBackup(event.target.files?.[0]); }}/>
                      <button type="button" disabled={backupBusy} onClick={() => backupInputRef.current?.click()}
                        className="soft-button mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[12px] font-bold disabled:opacity-50">
                        <Upload size={16}/> {backupBusy ? "Verificando…" : "Seleccionar copia ZIP"}
                      </button>
                      {backupPreview && (
                        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                          <p className="break-words text-[12px] font-extrabold">{backupPreview.name}</p>
                          <p className="mt-1 text-[11px] text-[var(--muted)]">
                            Respaldo del {new Date(backupPreview.createdAt).toLocaleString("es-CL")} ·
                            {" "}{backupPreview.record.summary.questionCount} preguntas
                          </p>
                          {confirmRestore ? (
                            <div role="alertdialog" aria-labelledby="restore-exam-backup-title" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
                              <h4 id="restore-exam-backup-title" className="text-[12px] font-extrabold">¿Sobrescribir este ensayo?</h4>
                              <p className="mt-1 text-[11px] leading-5">
                                Se reemplazarán preguntas, recursos y progreso local con los del respaldo. Esta acción no se puede deshacer sin otra copia.
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button type="button" disabled={backupBusy} onClick={() => { void restoreBackup(); }}
                                  className="min-h-10 rounded-lg bg-rose-600 px-3 text-[11px] font-extrabold text-white disabled:opacity-50">
                                  Confirmar restauración
                                </button>
                                <button type="button" onClick={() => setConfirmRestore(false)}
                                  className="soft-button min-h-10 rounded-lg px-3 text-[11px] font-bold">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setConfirmRestore(true)}
                              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-500/30 px-3 text-[11px] font-extrabold text-rose-600 dark:text-rose-400">
                              <RotateCcw size={14}/> Restaurar esta copia
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] leading-5 text-[var(--muted)]">
                      Esta copia es exclusiva del ensayo. Los respaldos generales de todas las categorías están en Perfil → Almacenamiento local.
                    </p>
                  </section>
                ) : tab === "advanced" ? (
                  <section className="space-y-4">
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-5 text-[var(--text)]">
                      <div className="mb-1 flex items-center gap-2 font-extrabold"><ShieldAlert size={15} className="text-amber-500"/> Edición avanzada bajo tu responsabilidad</div>
                      Edita únicamente una pregunta por vez. El JSON debe seguir siendo válido y respetar el contrato del paquete.
                      La verificación del contenido editado quedará pendiente.
                    </div>
                    <div>
                      <h3 className="text-[18px] font-extrabold">JSON de la pregunta {active + 1}</h3>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
                        Aquí puedes modificar bloques de matemática, imágenes, alternativas y respuestas que el editor normal protege.
                        El ID interno de la pregunta no se puede cambiar.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="exam-advanced-json" className="mb-2 block text-[12px] font-bold">Contenido estructurado (JSON)</label>
                      <textarea id="exam-advanced-json" spellCheck={false} value={advancedText} rows={18}
                        onChange={(event) => { setAdvancedText(event.target.value); setNotice(""); }}
                        className="w-full min-h-[350px] resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 font-mono text-[11px] leading-5 text-[var(--text)] outline-offset-2 focus:border-[var(--primary)] focus:outline-[var(--primary)]"
                      />
                    </div>
                  </section>
                ) : questions.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Este archivo no contiene preguntas reconocibles.</p>
                ) : !inspected || !form ? (
                  <p className="text-sm text-[var(--muted)]">Esta pregunta no tiene una estructura compatible con el editor visual.</p>
                ) : (
                  <>
                    <div>
                      <h3 className="text-lg font-extrabold tracking-tight">Pregunta {active + 1}</h3>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
                        Cambia los campos de esta pregunta y pulsa Guardar. Los demás datos, fórmulas e imágenes se conservan.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-[165px_minmax(0,1fr)]">
                      <div>
                        <label htmlFor="exam-edit-id" className={labelClass}>Número de pregunta</label>
                        <input id="exam-edit-id" className={fieldClass} value={form.number} onChange={(event) => { setForm({ ...form, number: event.target.value }); setNotice(""); }} />
                      </div>
                      <div>
                        <label htmlFor="exam-edit-answer" className={labelClass}>Respuesta correcta</label>
                        {!inspected.answerEditable ? (
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-[12px] text-[var(--muted)]">
                            Respuesta con estructura avanzada. Se conserva sin modificar.
                          </div>
                        ) : inspected.options.length > 0 && (!inspected.answer || inspected.options.some((option) => option.key === inspected.answer)) ? (
                          <div className="relative">
                            <select id="exam-edit-answer" className={fieldClass + " appearance-none pr-9"} value={form.answer} onChange={(event) => { setForm({ ...form, answer: event.target.value }); setNotice(""); }}>
                              <option value="">Seleccionar respuesta</option>
                              {inspected.options.map((option, index) => <option key={index} value={option.key}>Alternativa {option.key}</option>)}
                            </select>
                            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                          </div>
                        ) : (
                          <>
                            <input id="exam-edit-answer" className={fieldClass} value={form.answer} placeholder="Ej. A, B, C o índice numérico" onChange={(event) => { setForm({ ...form, answer: event.target.value }); setNotice(""); }} />
                            <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">El solucionario utiliza un código de respuesta diferente. Conserva su formato.</p>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="exam-edit-stem" className={labelClass}>Enunciado</label>
                      {inspected.stemPath ? (
                        <textarea id="exam-edit-stem" rows={4} className={fieldClass + " min-h-[115px] resize-y leading-6"} value={form.stem} onChange={(event) => { setForm({ ...form, stem: event.target.value }); setNotice(""); }} />
                      ) : (
                        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-[12px] leading-5 text-[var(--muted)]">
                          Este enunciado usa contenido estructurado (por ejemplo, bloques de texto, matemáticas o imágenes). Para evitar romperlo, el editor no lo convierte a texto simple.
                        </p>
                      )}
                    </div>

                    {inspected.options.length > 0 && (
                      <div>
                        <p className={labelClass}>Alternativas</p>
                        <div className="space-y-2.5">
                          {inspected.options.map((option, index) => (
                            <label key={index} className="flex items-start gap-3">
                              <span className={"mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[12px] font-extrabold " + (form.answer === option.key ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-[var(--surface-2)] text-[var(--muted)]")}>{option.key}</span>
                              <span className="min-w-0 flex-1">
                                <span className="sr-only">Texto de la alternativa {option.key}</span>
                                {option.editablePath ? (
                                  <textarea rows={1} className={fieldClass + " min-h-9 resize-y"} value={form.options[index] ?? ""} onChange={(event) => {
                                    const next = [...form.options];
                                    next[index] = event.target.value;
                                    setForm({ ...form, options: next });
                                    setNotice("");
                                  }} />
                                ) : (
                                  <span className="block rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[12px] text-[var(--muted)]">Contenido enriquecido: no editable desde este formulario</span>
                                )}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2.5 text-[11px] leading-5 text-[var(--muted)]">
                      Los cambios se guardan en este navegador. Para usar el archivo fuera de PAESSED, guarda primero y descarga el paquete editado.
                    </p>
                  </>
                )}

                {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[12px] text-[var(--text)]"><AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-500" />{error}</p>}
                {notice && <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-[12px] text-[var(--text)]"><Check size={16} className="shrink-0 text-emerald-500" />{notice}</p>}
              </div>
            </div>
          )}

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:px-6">
            <button type="button" disabled={!record || dirty || saving || exporting || backupBusy} onClick={() => { void download(); }} className="soft-button inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-40">
              <ArrowDownToLine size={15} /> {exporting ? "Exportando..." : "Descargar .paessed"}
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={dismiss} disabled={saving || exporting || backupBusy} className="rounded-xl px-3.5 py-2.5 text-[12px] font-bold text-[var(--muted)] hover:bg-[var(--surface-2)] disabled:opacity-40">
                Cerrar
              </button>
              <button type="button" onClick={() => { void save(); }} disabled={tab === "backups" || advancedPrompt || !(tab === "advanced" ? advancedDirty : basicDirty) || saving || exporting || backupBusy} className="tactile-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[12px] font-extrabold disabled:cursor-not-allowed disabled:opacity-45">
                <Save size={15} />{saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </footer>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
