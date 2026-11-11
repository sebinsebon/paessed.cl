"use client";

import { AppShell } from "@/components/app-shell";
import { AiHelpSettings,AskAiButton,useAiSettings } from "@/components/ask-ai";
import { ExternalQuestionWorkspace } from "@/components/learning/workspace/external-question-workspace";
import { QuestionDialog } from "@/components/learning/workspace/question-dialog";
import { type PlaygroundInkStroke } from "@/components/playground-scratchpad";
import { useImportedResourceUrls } from "@/components/use-imported-resource-urls";
import { getOptions,getQuestionId,getQuestions,isRecord,questionVisibleContent } from "@/lib/imported-question-content";
import { blockAssetIds,imageReferences } from "@/lib/imported-resources";
import { DEFAULT_QUESTION_INDEX } from "@/lib/learning/catalog";
import { recordEvidence } from "@/lib/learning/evidence";
import { IMPORTED_EXAM_PROGRESS_PREFIX,getImportedExam,type ImportedExamRecord } from "@/lib/local-imports";
import { convertImportedExamQuestions } from "@/lib/playground-imports";
import { canonicalQuestionId } from "@/lib/question-identity";
import { readQuestionPaperTheme } from "@/lib/question-paper";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect,useMemo,useRef,useState,type CSSProperties } from "react";

const PROGRESS_PREFIX = IMPORTED_EXAM_PROGRESS_PREFIX;
type SavedImportedProgress = {
  sessionId: string;
  completedAt?: string;
  submittedAnswers?: Record<string, string>;
  evidenceDelivered?: boolean;
  assisted: number[];
  legacyExposed: number[];
  index: number;
  answers: Record<string, string>;
  bookmarks: number[];
  strokes: Record<number, PlaygroundInkStroke[]>;
};

function readSavedProgress(id: string, questionCount: number): SavedImportedProgress {
  const empty: SavedImportedProgress = { sessionId: crypto.randomUUID(), assisted: [], legacyExposed: [], index: 0, answers: {}, bookmarks: [], strokes: {} };
  try {
    const stored = localStorage.getItem(PROGRESS_PREFIX + id);
    if (!stored) return empty;
    const candidate: unknown = JSON.parse(stored);
    if (!isRecord(candidate)) return empty;
    const index = typeof candidate.index === "number" && Number.isInteger(candidate.index) &&
      candidate.index >= 0 && candidate.index < questionCount ? candidate.index : 0;
    const answers: Record<string, string> = {};
    if (isRecord(candidate.answers)) {
      for (const [key, value] of Object.entries(candidate.answers)) {
        const position = Number(key);
        if (Number.isInteger(position) && position >= 0 && position < questionCount && typeof value === "string") {
          answers[key] = value;
        }
      }
    }
    const bookmarks = Array.isArray(candidate.bookmarks)
      ? candidate.bookmarks.filter((position): position is number =>
          typeof position === "number" && Number.isInteger(position) && position >= 0 && position < questionCount)
      : [];
    const strokes = isRecord(candidate.strokes) ? candidate.strokes as Record<number, PlaygroundInkStroke[]> : {};
    const validIndices = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((i): i is number => typeof i === "number" && Number.isInteger(i) && i >= 0 && i < questionCount))] : [];
    const sessionId = typeof candidate.sessionId === "string" && candidate.sessionId ? candidate.sessionId : empty.sessionId;
    const completedAt = typeof candidate.completedAt === "string" && Number.isFinite(Date.parse(candidate.completedAt)) ? candidate.completedAt : undefined;
    const submittedAnswers = completedAt && isRecord(candidate.submittedAnswers)
      ? Object.fromEntries(Object.entries(candidate.submittedAnswers).filter(([key, answer]) => /^\d+$/.test(key) && Number(key) < questionCount && typeof answer === "string")) as Record<string, string> : undefined;
    return { index, answers: submittedAnswers ?? answers, bookmarks, strokes, sessionId, completedAt, submittedAnswers,
      evidenceDelivered: candidate.evidenceDelivered === true,
      assisted: validIndices(candidate.assisted),
      legacyExposed: typeof candidate.sessionId === "string" ? validIndices(candidate.legacyExposed) : Array.from({ length: questionCount }, (_, i) => i) };
  } catch {
    return empty;
  }
}

export function ImportedExamViewer({ id }: { id: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<ImportedExamRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [strokes, setStrokes] = useState<Record<number, PlaygroundInkStroke[]>>({});
  const [restored, setRestored] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [completedAt, setCompletedAt] = useState<string>();
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, string>>();
  const [evidenceDelivered, setEvidenceDelivered] = useState(false);
  const [assisted, setAssisted] = useState<number[]>([]);
  const assistedRef = useRef<number[]>([]);
  const [legacyExposed, setLegacyExposed] = useState<number[]>([]);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [progressError, setProgressError] = useState("");
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const [paperTheme, setPaperTheme] = useState<"auto" | "light" | "dark">("light");
  const { aiSettings, updateAiSettings } = useAiSettings();
  const { resourceUrls, resourceIssues, resourceError, resourcesLoading } = useImportedResourceUrls(record);

  // Avoid exposing the app's dark scrollbar gutter beside the full-screen paper.
  useEffect(() => {
    const previousGutter = document.documentElement.style.scrollbarGutter;
    document.documentElement.style.scrollbarGutter = "auto";
    return () => { document.documentElement.style.scrollbarGutter = previousGutter; };
  }, []);


  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRestored(false);
    setRecord(null);
    setLoadError(false);
    if (!id) {
      setLoading(false);
      return;
    }
    void getImportedExam(id)
      .then((value) => {
        if (cancelled) return;
        setRecord(value);
        if (value) {
          const count = getQuestions(value.finalJson).length;
          const previous = readSavedProgress(id, count);
          setActive(previous.index);
          setAnswers(previous.answers);
          setBookmarks(previous.bookmarks);
          setStrokes(previous.strokes);
          setSessionId(previous.sessionId);
          setCompletedAt(previous.completedAt);
          setSubmittedAnswers(previous.submittedAnswers);
          setEvidenceDelivered(!!previous.evidenceDelivered);
          setAssisted(previous.assisted); assistedRef.current = previous.assisted;
          setLegacyExposed(previous.legacyExposed);
        }
        setRestored(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setRestored(true);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!restored || !record) return;
    try {
      const saved = JSON.parse(localStorage.getItem(PROGRESS_PREFIX + id) ?? "null") as SavedImportedProgress | null;
      if (saved?.completedAt && !completedAt) {
        setCompletedAt(saved.completedAt); setSubmittedAnswers(saved.submittedAnswers ?? saved.answers); setAnswers(saved.submittedAnswers ?? saved.answers); setEvidenceDelivered(!!saved.evidenceDelivered); return;
      }
      const next: SavedImportedProgress = { index: active, answers, bookmarks, strokes, sessionId, completedAt, submittedAnswers, evidenceDelivered, assisted, legacyExposed };
      localStorage.setItem(PROGRESS_PREFIX + id, JSON.stringify(next));
      setProgressError("");
    } catch {
      // Large drawings may exceed localStorage quota. Preserve answers when possible.
      try {
        localStorage.setItem(PROGRESS_PREFIX + id,
          JSON.stringify({ index: active, answers, bookmarks, strokes: {}, sessionId, completedAt, submittedAnswers, evidenceDelivered, assisted, legacyExposed }));
      } catch {
        setProgressError("No se pudo guardar tu progreso. Libera espacio o habilita el almacenamiento antes de entregar.");
      }
    }
  }, [id, restored, record, active, answers, bookmarks, strokes, sessionId, completedAt, submittedAnswers, evidenceDelivered, assisted, legacyExposed]);

  useEffect(() => {
    setPaperTheme(readQuestionPaperTheme());
  }, []);

  const questions = useMemo(() => getQuestions(record?.finalJson), [record]);
  const current = questions[active];
  const currentOptions = useMemo(() => getOptions(current), [current]);
  const aiQuestion = {
    number: getQuestionId(current, active),
    stem: isRecord(current) ? (current.stem ?? current.prompt ?? current.statement ?? current.text ?? current.content ?? current.body) : "",
    options: currentOptions.map((option, index) => ({
      label: String.fromCharCode(65 + index),
      content: option.blocks ?? option.text,
    })),
  };
  const referencedImages = useMemo(() => imageReferences(questionVisibleContent(current)), [current]);
  const currentResourceErrors=useMemo(()=>{
    const ids=[...blockAssetIds(isRecord(current)?current.stem:[]),...currentOptions.flatMap(option=>blockAssetIds(option.blocks)),...referencedImages];
    return [...new Set(ids.flatMap(id=>{const error=resourceIssues.get(id);return error?[error]:[];}))];
  },[current,currentOptions,referencedImages,resourceIssues]);
  const displayedResourceError=resourceError||(currentResourceErrors.length?`${currentResourceErrors.length} recursos no disponibles. ${currentResourceErrors[0]}`:'');
  const canonicalQuestions = useMemo(() => questions.map((question, index) => {
    const raw = isRecord(question) ? question.number ?? question.question_number : undefined;
    const number = (typeof raw === "number" || typeof raw === "string") && /^\d+$/.test(String(raw)) ? Number(raw) : index + 1;
    const canonical = canonicalQuestionId(record?.finalJson, number);
    return DEFAULT_QUESTION_INDEX.find(q => q.id === canonical && q.eligible);
  }), [questions, record]);
  const verifiedQuestions = useMemo(() => canonicalQuestions.map((meta, index) => {
    const q = questions[index];
    return meta && isRecord(q) && isRecord(q.answer) && q.answer.status === "verified" && q.answer.label === meta.correct ? meta : null;
  }), [canonicalQuestions, questions]);
  const exposeLegacy = async () => {
    for (const index of legacyExposed) {
      const meta = canonicalQuestions[index];
      if (meta) await recordEvidence({ type: "expose", questionId: meta.id, sessionId: `legacy-import:${id}`, mode: "exam" });
    }
  };
  useEffect(() => {
    if (!restored || !record || !sessionId || !legacyExposed.length) return;
    void exposeLegacy().catch(error => setProgressError(error instanceof Error ? error.message : "No se pudo recuperar la procedencia de tus respuestas."));
  }, [restored, record, sessionId, legacyExposed, id]);
  useEffect(() => {
    const meta = canonicalQuestions[active];
    if (!restored || loading || resourcesLoading || displayedResourceError || !meta || !sessionId || completedAt) return;
    void recordEvidence({ type: "expose", questionId: meta.id, sessionId, mode: "exam" }).catch(error => setProgressError(error instanceof Error ? error.message : "No se pudo registrar la pregunta mostrada."));
  }, [active, canonicalQuestions, restored, loading, resourcesLoading, displayedResourceError, sessionId, completedAt]);
  const assetUrls=useMemo(()=>referencedImages.flatMap(path=>{
    const url=resourceUrls.byPath.get(path);return url?[{path,url}]:[];
  }),[referencedImages,resourceUrls]);

  const paperPalette = paperTheme === "dark"
    ? { bg: "#111827", fg: "#f8fafc", muted: "#94a3b8", border: "#334155", soft: "#1e293b", option: "#1a2536", optionHover: "#25344b", selected: "#3b261b", footer: "#151d2c" }
    : paperTheme === "light"
      ? { bg: "#ffffff", fg: "#111827", muted: "#64748b", border: "#e2e8f0", soft: "#f1f5f9", option: "#f8fafc", optionHover: "#fff7ed", selected: "#fff7ed", footer: "#fcfcfd" }
      : { bg: "var(--surface)", fg: "var(--text)", muted: "var(--muted)", border: "var(--border)", soft: "var(--surface-2)", option: "var(--surface-2)", optionHover: "var(--surface-3)", selected: "var(--primary-soft)", footer: "var(--surface)" };
  const paperStyle = {
    "--pg-bg": paperPalette.bg, "--pg-fg": paperPalette.fg, "--pg-muted": paperPalette.muted,
    "--pg-border": paperPalette.border, "--pg-soft": paperPalette.soft,
    "--pg-option": paperPalette.option, "--pg-option-hover": paperPalette.optionHover,
    "--pg-selected": paperPalette.selected, "--pg-footer": paperPalette.footer,
  } as CSSProperties;

  const answered = Object.values(answers).filter(Boolean).length;
  const selectedAnswer = answers[String(active)] ?? "";
  const marked = bookmarks.includes(active);
  const currentStrokes = strokes[active] ?? [];
  const finalAnswers = submittedAnswers ?? answers;
  const evaluated = completedAt ? verifiedQuestions.flatMap((meta, i) => meta && finalAnswers[String(i)] ? [{ correct: finalAnswers[String(i)] === meta.correct }] : []) : [];
  const requestHelp = () => {
    if (!sessionId) return;
    const meta = canonicalQuestions[active];
    if (completedAt) {
      if (meta && evidenceDelivered) void recordEvidence({ type: "expose", questionId: meta.id, sessionId, mode: "exam", assisted: true }).catch(error => setProgressError(error instanceof Error ? error.message : "No se pudo guardar el uso de ayuda."));
      return;
    }
    const next = [...new Set([...assistedRef.current, active])];
    assistedRef.current = next; setAssisted(next);
    try {
      const saved = readSavedProgress(id, questions.length);
      localStorage.setItem(PROGRESS_PREFIX + id, JSON.stringify({ ...saved, assisted: next }));
    } catch { setProgressError("No se pudo guardar el uso de ayuda. No cierres esta pestaña antes de entregar."); }
    if (meta) void recordEvidence({ type: "expose", questionId: meta.id, sessionId, mode: "exam", assisted: true }).catch(error => setProgressError(error instanceof Error ? error.message : "No se pudo guardar el uso de ayuda."));
  };
  const deliver = async () => {
    if (!record || !restored || !sessionId || delivering) return;
    setDelivering(true);
    try {
      // Persist and lock the delivered snapshot before recording any evidence.
      // A close or a failed write can then resume the same immutable submission.
      const saved = readSavedProgress(id, questions.length);
      const snapshot = saved.completedAt ? saved.submittedAnswers ?? saved.answers : { ...answers };
      const completion = saved.completedAt ?? new Date().toISOString();
      const helped = [...new Set([...assistedRef.current, ...saved.assisted])];
      const locked: SavedImportedProgress = { index: active, answers: snapshot, bookmarks, strokes, sessionId: saved.sessionId, completedAt: completion, submittedAnswers: snapshot, evidenceDelivered: !!saved.evidenceDelivered, assisted: helped, legacyExposed };
      localStorage.setItem(PROGRESS_PREFIX + id, JSON.stringify(locked));
      setAnswers(snapshot); setSubmittedAnswers(snapshot); setCompletedAt(completion); setDeliveryOpen(false);
      await exposeLegacy();
      if (!locked.evidenceDelivered) {
        for (const [i, meta] of verifiedQuestions.entries()) {
          const answer = snapshot[String(i)];
          if (!meta || !answer) continue;
          await recordEvidence({ type: "external-attempt", questionId: meta.id, sessionId: locked.sessionId, mode: "exam", answer, assisted: helped.includes(i) });
        }
        localStorage.setItem(PROGRESS_PREFIX + id, JSON.stringify({ ...locked, evidenceDelivered: true }));
      }
      setEvidenceDelivered(true); setProgressError("");
    } catch (error) { setProgressError(error instanceof Error ? error.message : "No se pudo registrar la entrega. Reintenta para conservar tu evidencia."); }
    finally { setDelivering(false); }
  };
  const chooseAnswer = (answer: string) => {
    if (completedAt || delivering) return;
    const saved = readSavedProgress(id, questions.length);
    if (saved.completedAt) {
      setCompletedAt(saved.completedAt); setSubmittedAnswers(saved.submittedAnswers ?? saved.answers); setAnswers(saved.submittedAnswers ?? saved.answers); setEvidenceDelivered(!!saved.evidenceDelivered);
      return;
    }
    setAnswers(previous => { const next = { ...previous }; if (answer) next[String(active)] = answer; else delete next[String(active)]; return next; });
  };

  const setQuestion = (position: number) => {
    setActive(Math.max(0, Math.min(questions.length - 1, position)));
  };
  const toggleBookmark = () => {
    setBookmarks((prev) => prev.includes(active) ? prev.filter((item) => item !== active) : [...prev, active]);
  };

  const bankQuestions = convertImportedExamQuestions(id, record?.summary.title ?? "Ensayo importado", record?.finalJson);
  const bankQuestion = bankQuestions[active];
  const mergedAssetUrls = new Map([...resourceUrls.byPath, ...resourceUrls.byId]);
  const externalQuestion = bankQuestion && !bankQuestion.stemBlocks && assetUrls.length ? {
    ...bankQuestion,
    stemBlocks: [{ type: "text", text: bankQuestion.stem }, ...assetUrls.map(asset => ({ type: "image", asset_id: asset.path, alt: `Ilustración de la pregunta ${bankQuestion.number}` }))],
  } : bankQuestion;
  const body = externalQuestion ? <>
    <ExternalQuestionWorkspace key={externalQuestion.id} question={externalQuestion} assetUrls={mergedAssetUrls}
      ready={restored && !loading && !resourcesLoading && !displayedResourceError} error={displayedResourceError} retry={() => { setRecord(record ? { ...record } : null); }}
      context="exam" sessionKey={`imported-exam:${sessionId}`} number={active + 1} total={questions.length}
      subtitle={`${record?.summary.title ?? "Ensayo importado"} · ${answered}/${questions.length} respondidas`}
      selected={selectedAnswer} onSelect={chooseAnswer} locked={!!completedAt || delivering} busy={delivering}
      onClose={() => { if (!delivering) router.push("/app/ensayos"); }}
      initialStrokes={currentStrokes} onStrokesChange={next => setStrokes(previous => ({ ...previous, [active]: next }))}
      steps={questions.map((_, index) => ({ number: index + 1, answered: !!answers[String(index)], current: index === active }))}
      notices={<>
        {progressError && <p role="alert" className="mb-3 text-sm text-rose-500">{progressError}</p>}
        {completedAt && <section aria-label="Resultado del ensayo entregado" className="mb-5 rounded-xl border border-[var(--pg-border)] bg-[var(--pg-soft)] p-4">
          <h2 className="text-lg font-extrabold">Ensayo entregado</h2><p className="mt-2 text-sm">{Object.keys(finalAnswers).length} respondidas · {questions.length - Object.keys(finalAnswers).length} omitidas. Tus respuestas entregadas están guardadas.</p>
          {evaluated.length > 0 ? <p className="mt-2 text-sm">{evaluated.filter(q => q.correct).length} correctas y {evaluated.filter(q => !q.correct).length} incorrectas entre {evaluated.length} preguntas con clave verificada del banco Default.</p> : <p className="mt-2 text-sm">Este archivo no tiene respuestas evaluables con clave verificada del banco Default.</p>}
          <p className="mt-2 text-xs">Las primeras respuestas nuevas sin ayuda aportan evidencia al perfil. Este resultado no se convierte en puntaje PAES.</p>
          {!evidenceDelivered && <button type="button" disabled={delivering} onClick={() => void deliver()} className="mt-3 min-h-11 rounded-lg border px-3 font-bold">{delivering ? "Guardando evidencia…" : "Reintentar registro de evidencia"}</button>}
        </section>}
      </>}
      renderAiHelp={onOpenChange => <AskAiButton onOpenChange={onOpenChange} question={aiQuestion} settings={aiSettings} onChange={updateAiSettings} disabled={delivering || (!!completedAt && !evidenceDelivered)} onHelp={requestHelp} />}
      tools={<div className="space-y-3">
        <label className="block text-sm font-bold">Ir a pregunta<select aria-label="Ir a pregunta" value={active} onChange={event => setQuestion(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--pg-border)] bg-[var(--pg-bg)] px-3 text-base">{questions.map((question, index) => <option key={index} value={index}>{getQuestionId(question, index)}{answers[String(index)] ? " · respondida" : ""}{bookmarks.includes(index) ? " · marcada" : ""}</option>)}</select></label>
        <button type="button" onClick={toggleBookmark} aria-pressed={marked} className="min-h-11 w-full rounded-lg border border-[var(--pg-border)] px-3 text-left text-base">{marked ? "Quitar marca de revisión" : "Marcar para revisar"}</button>
        <AiHelpSettings settings={aiSettings} onChange={updateAiSettings} />
        {!completedAt && <button type="button" disabled={!restored || delivering} onClick={() => setDeliveryOpen(true)} className="tactile-primary min-h-12 w-full rounded-xl px-4 font-bold disabled:opacity-40">Entregar ensayo</button>}
      </div>}
      footer={(drawing, aiHelp) => <div className="flex w-full flex-wrap items-center gap-2">
        {aiHelp}
        <button type="button" disabled={active <= 0 || drawing || delivering} onClick={() => setQuestion(active - 1)} className="min-h-12 rounded-xl border border-[var(--pg-border)] px-3 font-bold disabled:opacity-40" aria-label="Pregunta anterior"><ChevronLeft size={20} /></button>
        <button type="button" disabled={drawing || delivering || (!!completedAt && active >= questions.length - 1)} onClick={() => active < questions.length - 1 ? setQuestion(active + 1) : setDeliveryOpen(true)} className="tactile-primary min-h-12 flex-1 rounded-xl px-4 font-bold disabled:opacity-40">{active < questions.length - 1 ? "Siguiente" : "Entregar ensayo"}</button>
      </div>}
    />
    {deliveryOpen && <QuestionDialog title="¿Entregar este ensayo?" onClose={() => { if (!delivering) setDeliveryOpen(false); }} paperStyle={paperStyle} wide>
      <p className="text-base leading-relaxed">{questions.length - answered} preguntas quedarán omitidas. Se guardarán tus respuestas actuales y la entrega no se podrá modificar.</p>
      <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={delivering} onClick={() => setDeliveryOpen(false)} className="min-h-12 rounded-xl border border-[var(--pg-border)] px-4 font-bold">Seguir revisando</button><button type="button" disabled={delivering} onClick={() => void deliver()} className="tactile-primary min-h-12 rounded-xl px-4 font-bold">{delivering ? "Guardando…" : "Confirmar entrega"}</button></div>
    </QuestionDialog>}
  </> : <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
    <h2 className="text-lg font-bold">{loading ? "Abriendo ensayo importado…" : !record ? loadError ? "No se pudo abrir este ensayo" : "No se encontró este ensayo" : "No hay preguntas reconocibles en este paquete."}</h2>
    {!loading && <Link href="/app/ensayos" className="soft-button rounded-xl px-4 py-3">Volver a Ensayos</Link>}
  </section>;
  return <AppShell title="Ensayo importado" eyebrow="Biblioteca local" wide immersive immersiveSidebarOpen={sidebarVisible} onImmersiveSidebarToggle={() => setSidebarVisible(previous => !previous)}>{body}</AppShell>;
}
