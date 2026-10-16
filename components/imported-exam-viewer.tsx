"use client";

import Link from "next/link";
import { isRecord, getQuestions, getQuestionId, getOptions, questionText, questionVisibleContent } from "@/lib/imported-question-content";
import { ArrowLeft, Bookmark, Check, ChevronLeft, ChevronRight, Eraser, Grid3X3, Pencil, RotateCcw, Search, Settings, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppShell } from "@/components/app-shell";
import { PaessedBlocks } from "@/components/paessed-blocks";
import { blockAssetIds, imageReferences } from "@/lib/imported-resources";
import { PlaygroundScratchpad, type PlaygroundInkStroke } from "@/components/playground-scratchpad";
import { useDrawingTools } from "@/components/use-drawing-tools";
import { useImportedResourceUrls } from "@/components/use-imported-resource-urls";
import { QUESTION_PAPER_FONT } from "@/lib/question-paper";
import { getImportedExam, type ImportedExamRecord } from "@/lib/local-imports";

const PROGRESS_PREFIX = "paessed-imported-essay-progress-v1-";
type SavedImportedProgress = {
  index: number;
  answers: Record<string, string>;
  bookmarks: number[];
  strokes: Record<number, PlaygroundInkStroke[]>;
};

function readSavedProgress(id: string, questionCount: number): SavedImportedProgress {
  const empty: SavedImportedProgress = { index: 0, answers: {}, bookmarks: [], strokes: {} };
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
    return { index, answers, bookmarks, strokes };
  } catch {
    return empty;
  }
}

export function ImportedExamViewer({ id }: { id: string }) {
  const [record, setRecord] = useState<ImportedExamRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [strokes, setStrokes] = useState<Record<number, PlaygroundInkStroke[]>>({});
  const [restored, setRestored] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { drawingEnabled, drawingMenuOpen, drawingButtonLabel, toggleDrawing, setDrawingEnabled, hideDrawingTools } = useDrawingTools();
  const [drawingTool, setDrawingTool] = useState<"pen" | "eraser">("pen");
  const [drawingColor, setDrawingColor] = useState("#2563eb");
  const [paperTheme, setPaperTheme] = useState<"auto" | "light" | "dark">("light");
  const { resourceUrls, resourceIssues, resourceError, resourcesLoading } = useImportedResourceUrls(record);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const next: SavedImportedProgress = { index: active, answers, bookmarks, strokes };
      localStorage.setItem(PROGRESS_PREFIX + id, JSON.stringify(next));
    } catch {
      // Large drawings may exceed localStorage quota. Preserve answers when possible.
      try {
        localStorage.setItem(PROGRESS_PREFIX + id,
          JSON.stringify({ index: active, answers, bookmarks, strokes: {} }));
      } catch {
        // Browsers may disable local storage.
      }
    }
  }, [id, restored, record, active, answers, bookmarks, strokes]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("paessed-imported-paper-theme");
      if (saved === "auto" || saved === "light" || saved === "dark") setPaperTheme(saved);
    } catch {}
  }, []);

  const questions = useMemo(() => getQuestions(record?.finalJson), [record]);
  const current = questions[active];
  const currentOptions = useMemo(() => getOptions(current), [current]);
  const referencedImages = useMemo(() => imageReferences(questionVisibleContent(current)), [current]);
  const currentResourceErrors=useMemo(()=>{
    const ids=[...blockAssetIds(isRecord(current)?current.stem:[]),...currentOptions.flatMap(option=>blockAssetIds(option.blocks)),...referencedImages];
    return [...new Set(ids.flatMap(id=>{const error=resourceIssues.get(id);return error?[error]:[];}))];
  },[current,currentOptions,referencedImages,resourceIssues]);
  const displayedResourceError=resourceError||(currentResourceErrors.length?`${currentResourceErrors.length} recursos no disponibles. ${currentResourceErrors[0]}`:'');
  const assetUrls=useMemo(()=>referencedImages.flatMap(path=>{
    const url=resourceUrls.byPath.get(path);return url?[{path,url}]:[];
  }),[referencedImages,resourceUrls]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
    setMapOpen(false);
    setSettingsOpen(false);
    setDrawingEnabled(false);
  }, [active, setDrawingEnabled]);

  useEffect(() => {
    if (!mapOpen && !settingsOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMapOpen(false); setSettingsOpen(false); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mapOpen, settingsOpen]);

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

  const displayedQuestions = useMemo(() => {
    const term = query.toLowerCase().trim();
    return questions.map((question, index) => ({ question, index }))
      .filter(({ question, index }) => !term ||
        getQuestionId(question, index).toLowerCase().includes(term) ||
        questionText(question).toLowerCase().includes(term));
  }, [questions, query]);
  const answered = Object.values(answers).filter(Boolean).length;
  const selectedAnswer = answers[String(active)] ?? "";
  const marked = bookmarks.includes(active);
  const currentStrokes = strokes[active] ?? [];

  const setQuestion = (position: number) => {
    setActive(Math.max(0, Math.min(questions.length - 1, position)));
  };
  const changeTheme = (theme: "auto" | "light" | "dark") => {
    setPaperTheme(theme);
    try { localStorage.setItem("paessed-imported-paper-theme", theme); } catch {}
    setSettingsOpen(false);
  };
  const toggleBookmark = () => {
    setBookmarks((prev) => prev.includes(active) ? prev.filter((item) => item !== active) : [...prev, active]);
  };

  const body = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--canvas)] text-[var(--text)]">
      <header className="relative z-30 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex min-h-[58px] w-full max-w-[1460px] items-center gap-2 px-3 sm:gap-4 sm:px-6">
          <Link href="/app/ensayos" aria-label="Volver a Ensayos"
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12px] font-bold text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]">
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Volver a ensayos</span>
            <span className="hidden min-[440px]:inline sm:hidden">Volver</span>
          </Link>
          <div className="min-w-0 flex-1 rounded-lg px-1 py-1.5 text-center sm:px-3">
            <p className="flex items-center justify-center gap-2 text-[12px] font-extrabold">
              <span><span className="hidden sm:inline">Matemática </span>M1</span>
              <span className="text-amber-700 dark:text-amber-400">Ensayos</span>
            </p>
            <p className="truncate text-[10px] font-medium text-[var(--muted)]">
              {record?.summary.title ?? "Ensayo importado"}{record ? " · " + answered + "/" + questions.length + " respondidas" : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" title="Herramienta de lápiz"
              aria-label={drawingButtonLabel}
              aria-pressed={drawingEnabled}
              aria-expanded={drawingMenuOpen}
              onClick={() => { toggleDrawing(); setMapOpen(false); setSettingsOpen(false); }}
              className={"grid h-10 w-10 place-items-center rounded-xl border transition-colors " +
                (drawingEnabled ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]")}>
              <Pencil size={18}/>
            </button>
            <button type="button" onClick={toggleBookmark} disabled={!current}
              aria-label={marked ? "Quitar marca de pregunta" : "Marcar pregunta"}
              aria-pressed={marked} title={marked ? "Quitar marca" : "Marcar para revisar"}
              className={"grid h-10 w-10 place-items-center rounded-xl border transition-colors disabled:opacity-40 " +
                (marked ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]")}>
              <Bookmark size={18} fill={marked ? "currentColor" : "none"} />
            </button>
            <button type="button" title="Mapa de preguntas" aria-label="Abrir mapa de preguntas"
              aria-expanded={mapOpen} onClick={() => { setMapOpen((open) => !open); setSettingsOpen(false); setDrawingEnabled(false); }}
              className={"grid h-10 w-10 place-items-center rounded-xl border transition-colors " +
                (mapOpen ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]")}>
              <Grid3X3 size={18}/>
            </button>
            <button type="button" title="Apariencia de la hoja" aria-label="Ajustes de apariencia de la hoja"
              aria-expanded={settingsOpen} onClick={() => { setSettingsOpen((open) => !open); setMapOpen(false); setDrawingEnabled(false); }}
              className={"hidden h-10 w-10 place-items-center rounded-xl border transition-colors sm:grid " +
                (settingsOpen ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]")}>
              <Settings size={18}/>
            </button>
          </div>
        </div>
        <div className="h-0.5 bg-[var(--surface-3)]">
          <div className="h-full bg-[var(--primary)] transition-[width] duration-200"
            style={{ width: questions.length ? ((active + 1) / questions.length) * 100 + "%" : "0%" }} />
        </div>

        {drawingMenuOpen && (
          <div className="absolute right-3 top-[calc(100%+7px)] z-40 flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 shadow-lg sm:right-6">
            <button type="button" onClick={() => setDrawingTool("pen")} aria-label="Dibujar"
              aria-pressed={drawingTool === "pen"} className={"grid h-8 w-8 place-items-center rounded-lg " +
                (drawingTool === "pen" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "hover:bg-[var(--surface-2)]")}>
              <Pencil size={16}/>
            </button>
            <button type="button" onClick={() => setDrawingTool("eraser")} aria-label="Borrar trazo"
              aria-pressed={drawingTool === "eraser"} className={"grid h-8 w-8 place-items-center rounded-lg " +
                (drawingTool === "eraser" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "hover:bg-[var(--surface-2)]")}>
              <Eraser size={16}/>
            </button>
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--border)]" />
            {(["#2563eb", "#e11d48", "#16a34a", "#f97316", "#111827"] as const).map((ink) => (
              <button type="button" key={ink} aria-label={"Color de tinta " + ink} title={ink}
                aria-pressed={drawingColor === ink && drawingTool === "pen"}
                onClick={() => { setDrawingColor(ink); setDrawingTool("pen"); }}
                className={"grid h-8 w-8 place-items-center rounded-lg border " +
                  (drawingColor === ink && drawingTool === "pen" ? "border-[var(--primary)] ring-1 ring-[var(--primary)]" : "border-transparent hover:border-[var(--border)]")}>
                <span style={{ backgroundColor: ink }} className="h-4 w-4 rounded-full border border-slate-400/40"/>
              </button>
            ))}
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--border)]" />
            <button type="button" onClick={() => setStrokes((previous) => ({ ...previous, [active]: currentStrokes.slice(0, -1) }))}
              disabled={currentStrokes.length === 0} title="Deshacer trazo" aria-label="Deshacer trazo"
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)] disabled:opacity-30">
              <RotateCcw size={16}/>
            </button>
            <button type="button" onClick={() => setStrokes((previous) => ({ ...previous, [active]: [] }))}
              disabled={currentStrokes.length === 0} title="Borrar trazos" aria-label="Borrar todos los trazos"
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)] disabled:opacity-30">
              <Trash2 size={16}/>
            </button>
          </div>
        )}

        {(mapOpen || settingsOpen) && (
          <button type="button" aria-label="Cerrar panel" className="fixed inset-0 z-30 cursor-default"
            onClick={() => { setMapOpen(false); setSettingsOpen(false); }} />
        )}
        <AnimatePresence>
          {mapOpen && (
            <motion.section key="question-map" role="dialog" aria-label="Mapa del ensayo importado"
              initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.99 }} transition={{ duration: 0.18 }}
              className="absolute right-3 top-[calc(100%+9px)] z-40 max-h-[min(76dvh,690px)] w-[min(440px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:right-6">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[13px] font-extrabold">Mapa de preguntas</h2>
                <button type="button" onClick={() => setMapOpen(false)} aria-label="Cerrar mapa" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)]"><X size={16}/></button>
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-[var(--muted)]">
                <span>{answered} respondidas</span>
                <span>{bookmarks.length} marcadas</span>
                <span>{questions.length} en total</span>
              </div>
              <label className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                <Search size={15} className="text-[var(--muted)]"/>
                <input value={query} onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar pregunta" aria-label="Buscar pregunta"
                  className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none placeholder:text-[var(--muted-2)]"/>
              </label>
              <div className="mt-3 grid grid-cols-10 gap-1.5">
                {displayedQuestions.map(({ question, index }) => {
                  const selected = index === active;
                  const answeredQuestion = Boolean(answers[String(index)]);
                  const bookmarked = bookmarks.includes(index);
                  const tone = selected
                    ? "border-orange-500 bg-[var(--primary-soft)] text-[var(--primary)] ring-2 ring-orange-500/30"
                    : bookmarked ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                    : answeredQuestion ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                    : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]";
                  return (
                    <button type="button" key={index} onClick={() => { setQuestion(index); setMapOpen(false); }}
                      aria-label={"Pregunta " + getQuestionId(question, index) +
                        (bookmarked ? ", marcada" : answeredQuestion ? ", respondida" : ", pendiente")}
                      aria-current={selected ? "step" : undefined}
                      className={"aspect-square min-w-0 rounded-md border text-[10px] font-extrabold transition-colors hover:border-[var(--primary)] " + tone}>
                      {index + 1}
                    </button>
                  );
                })}
              </div>
              {displayedQuestions.length === 0 && <p className="mt-3 text-xs text-[var(--muted)]">No hay preguntas que coincidan con la búsqueda.</p>}
            </motion.section>
          )}
          {settingsOpen && (
            <motion.section key="paper-settings" role="group" aria-label="Apariencia de la hoja"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}
              className="absolute right-3 top-[calc(100%+9px)] z-40 w-[min(300px,calc(100vw-24px))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:right-6">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[13px] font-extrabold">Apariencia de la hoja</h2>
                <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Cerrar ajustes" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--surface-2)]"><X size={16}/></button>
              </div>
              {([
                { key: "auto", name: "Según PAESSED" },
                { key: "light", name: "Hoja clara" },
                { key: "dark", name: "Hoja oscura" },
              ] as const).map((option) => (
                <button type="button" key={option.key} onClick={() => changeTheme(option.key)}
                  aria-pressed={paperTheme === option.key}
                  className={"mb-1 flex min-h-10 w-full items-center justify-between rounded-xl border px-3 text-left text-[11px] font-bold " +
                    (paperTheme === option.key ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:bg-[var(--surface-2)]")}>
                  {option.name}{paperTheme === option.key && <Check size={15} className="text-[var(--primary)]"/>}
                </button>
              ))}
              <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">Las respuestas se guardan en este navegador. El solucionario del archivo no se utiliza para corregir durante la sesión.</p>
            </motion.section>
          )}
        </AnimatePresence>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1460px] flex-1 flex-col p-2 sm:p-4" aria-label="Pregunta del ensayo importado">
        {loading ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--muted)]" role="status">
            Abriendo ensayo importado…
          </div>
        ) : !record ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <h2 className="text-lg font-extrabold">{loadError ? "No se pudo abrir este ensayo" : "No se encontró este ensayo"}</h2>
            <p className="mt-2 max-w-md text-sm text-[var(--muted)]">Comprueba que siga guardado en la biblioteca local de este navegador.</p>
            <Link href="/app/ensayos" className="soft-button mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold">
              <ArrowLeft size={15}/> Volver a Ensayos
            </Link>
          </div>
        ) : (
          <article style={paperStyle} className="paessed-essay-paper-entry flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-[var(--pg-border)] bg-[var(--pg-bg)] text-[var(--pg-fg)]">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--pg-border)] px-4 py-2 sm:px-7 sm:py-2.5">
              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                <span className="rounded-md bg-[var(--pg-soft)] px-2 py-1 text-[11px] font-bold text-[var(--pg-fg)]">
                  N.º {current ? getQuestionId(current, active) : "—"}
                </span>
                <span className="hidden rounded-md border border-[var(--pg-border)] px-2 py-1 text-[11px] font-medium text-[var(--pg-muted)] sm:inline">
                  {record.summary.sourceKind === "paessed" ? "Paquete .paessed" : "Ensayo importado"}
                </span>
                {isRecord(current) && isRecord(current.curriculum) && (
                  <span className="min-w-0 max-w-full text-[11px] font-medium text-[var(--pg-muted)]">
                    {String(current.curriculum.eje ?? "Clasificación pendiente")} · {String(current.curriculum.subeje ?? "")} · Temario: {String(current.curriculum.en_temario ?? "dudoso")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="truncate text-right text-[11px] font-medium text-[var(--pg-muted)]">{active + 1} de {questions.length} preguntas</span>
              </div>
            </div>

            <div ref={scrollRef} key={active} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-9 sm:py-5 lg:px-12">
              {current ? (
                <div className="relative flex min-h-full flex-col">
                  {displayedResourceError && <p role="alert" className="mb-3 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">{displayedResourceError}</p>}
                  {isRecord(current) && Array.isArray(current.stem) ? (
                    <>
                      <div style={QUESTION_PAPER_FONT} className="max-w-[1060px] text-[18px] leading-[1.55] sm:text-[21px]">
                        <PaessedBlocks blocks={current.stem} assetUrls={resourceUrls.byId} loadingAssets={resourcesLoading} />
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 style={QUESTION_PAPER_FONT} className="max-w-[1060px] whitespace-pre-line text-[18px] font-normal leading-[1.55] text-[var(--pg-fg)] sm:text-[21px]">
                        {questionText(current)}
                      </h2>
                  {assetUrls.length > 0 && (
                    <div className="mt-5 flex max-w-[1060px] flex-wrap items-start gap-4">
                      {assetUrls.map((asset) => (
                        // Content comes from the student's local package, not a remote server.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={asset.path} src={asset.url} alt={"Ilustración para la pregunta " + (active + 1)}
                          className="max-h-[360px] max-w-full rounded-lg object-contain" />
                      ))}
                    </div>
                  )}
                      </>
                  )}
                  {currentOptions.length ? (
                    <div role="group" aria-label="Alternativas de respuesta" className="mt-auto flex max-w-[1060px] flex-col items-start gap-1.5 pt-4 sm:pt-6">
                      {currentOptions.map((option, index) => {
                        const letter = String.fromCharCode(65 + index);
                        const picked = selectedAnswer === letter;
                        return (
                          <button type="button" key={letter} disabled={drawingEnabled} aria-pressed={picked}
                            onClick={() => setAnswers((prev) => ({ ...prev, [String(active)]: letter }))}
                            className={"inline-flex min-h-[34px] w-fit max-w-full min-w-[72px] items-start gap-2 rounded-md border px-2.5 py-1 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-default sm:min-h-[36px] sm:px-3 " +
                              (picked ? "border-[var(--primary)] bg-[var(--pg-selected)] ring-1 ring-[var(--primary)]" : "border-[var(--pg-border)] bg-[var(--pg-option)] hover:border-[var(--primary)] hover:bg-[var(--pg-option-hover)]")}>
                            <span style={QUESTION_PAPER_FONT} className="shrink-0 text-[15px] font-semibold leading-6 text-[var(--pg-fg)] sm:text-[16px]">{letter})</span>
                            {option.blocks ? <div style={QUESTION_PAPER_FONT} className="min-w-0"><PaessedBlocks blocks={option.blocks} assetUrls={resourceUrls.byId} loadingAssets={resourcesLoading} /></div> : <span style={QUESTION_PAPER_FONT} className="min-w-0 break-words text-[15px] leading-6 text-[var(--pg-fg)] sm:text-[16px]">{option.text}</span>}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-auto max-w-[1060px] rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-[12px] text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                      El archivo no tiene alternativas reconocibles para esta pregunta.
                    </p>
                  )}
                  <PlaygroundScratchpad key={active} enabled={drawingEnabled}
                    onInteractionStart={hideDrawingTools} mode={drawingTool} color={drawingColor} strokes={currentStrokes}
                    onChange={(next) => setStrokes((previous) => ({ ...previous, [active]: next }))}/>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-bold text-[var(--pg-muted)]">
                  No hay preguntas reconocibles en este paquete.
                </div>
              )}
            </div>
            <footer className="shrink-0 border-t border-[var(--pg-border)] bg-[var(--pg-footer)] px-3 py-2.5 sm:px-7 sm:py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" disabled={active <= 0 || questions.length === 0} onClick={() => setQuestion(active - 1)}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--pg-border)] bg-[var(--pg-option)] px-3 text-[11px] font-bold text-[var(--pg-fg)] transition-colors hover:bg-[var(--pg-option-hover)] disabled:cursor-not-allowed disabled:opacity-40">
                  <ChevronLeft size={16}/> Anterior
                </button>
                <span className="hidden text-[10px] font-semibold text-[var(--pg-muted)] sm:inline">
                  {questions.length ? "Pregunta " + (active + 1) + " de " + questions.length : "Sin preguntas"}
                </span>
                <button type="button" disabled={active >= questions.length - 1 || questions.length === 0} onClick={() => setQuestion(active + 1)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--pg-border)] bg-[var(--pg-option)] px-4 text-[11px] font-bold text-[var(--pg-fg)] transition-colors hover:bg-[var(--pg-option-hover)] disabled:cursor-not-allowed disabled:opacity-40">
                  Siguiente <ChevronRight size={16}/>
                </button>
              </div>
            </footer>
          </article>
        )}
      </main>
    </div>
  );

  return (
    <AppShell title="Ensayo importado" eyebrow="Biblioteca local" wide immersive
      immersiveSidebarOpen={sidebarVisible}
      onImmersiveSidebarToggle={() => setSidebarVisible((previous) => !previous)}>
      {body}
    </AppShell>
  );
}
