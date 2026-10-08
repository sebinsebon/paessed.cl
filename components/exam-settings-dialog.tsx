"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, ArrowDownToLine, Check, ChevronDown, FileJson2, Save, X } from "lucide-react";
import {
  answerCount, applyQuestionPatch, getEditableQuestions, inspectQuestion, isJsonObject,
  type QuestionPatch, type QuestionView,
} from "@/lib/exam-editing";
import { getImportedExam, saveImportedExam, type ImportedExamRecord } from "@/lib/local-imports";

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
  const zip = record.archive ? await JSZip.loadAsync(record.archive) : new JSZip();
  const existing = Object.keys(zip.files)
    .filter((path) => /(^|\/)final\.json$/i.test(path))
    .sort((a, b) => a.split("/").length - b.split("/").length);
  zip.file(existing[0] ?? "final.json", JSON.stringify(record.finalJson, null, 2));
  const result = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
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

  useEffect(() => {
    let current = true;
    void getImportedExam(examId).then((result) => {
      if (!current) return;
      setRecord(result);
      if (result && getEditableQuestions(result.finalJson).length > 0) {
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

  const dirty = !!form && !!inspected && (
    form.number !== inspected.number ||
    form.stem !== inspected.stem ||
    form.answer !== inspected.answer ||
    form.options.some((value, index) => value !== inspected.options[index]?.text)
  );

  const dismiss = useCallback(() => {
    if (saving || exporting) return;
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos y cerrar?")) return;
    onClose();
  }, [dirty, saving, exporting, onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [dismiss]);

  const chooseQuestion = (index: number) => {
    if (!record || saving || active === index) return;
    if (dirty && !window.confirm("Tienes cambios sin guardar. ¿Descartarlos y abrir otra pregunta?")) return;
    try {
      setActive(index);
      setForm(formFromQuestion(inspectQuestion(record.finalJson, index)));
      setError("");
      setNotice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Esta pregunta no admite edición visual.");
    }
  };

  const save = async () => {
    if (!record || !form || !dirty || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updatedJson = applyQuestionPatch(record.finalJson, active, form);
      const updatedQuestions = getEditableQuestions(updatedJson);
      const next: ImportedExamRecord = {
        ...record,
        finalJson: updatedJson,
        summary: {
          ...record.summary,
          questionCount: updatedQuestions.length,
          idCount: updatedQuestions.filter((item) => isJsonObject(item) && ["id", "question_id", "questionId", "number"].some((key) => typeof item[key] === "string" || typeof item[key] === "number")).length,
          answerCount: answerCount(updatedJson),
          preview: previewFor(updatedJson),
        },
      };
      await saveImportedExam(next);
      setRecord(next);
      setForm(formFromQuestion(inspectQuestion(next.finalJson, active)));
      setNotice("Cambios guardados en este navegador.");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el ensayo.");
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    if (!record || dirty || saving || exporting) return;
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
                {questions.length === 0 ? (
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
                        <label htmlFor="exam-edit-id" className={labelClass}>Número / identificador</label>
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
            <button type="button" disabled={!record || dirty || saving || exporting} onClick={() => { void download(); }} className="soft-button inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-40">
              <ArrowDownToLine size={15} /> {exporting ? "Exportando..." : "Descargar .paessed"}
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={dismiss} className="rounded-xl px-3.5 py-2.5 text-[12px] font-bold text-[var(--muted)] hover:bg-[var(--surface-2)]">
                Cerrar
              </button>
              <button type="button" onClick={() => { void save(); }} disabled={!dirty || saving} className="tactile-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[12px] font-extrabold disabled:cursor-not-allowed disabled:opacity-45">
                <Save size={15} />{saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </footer>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
