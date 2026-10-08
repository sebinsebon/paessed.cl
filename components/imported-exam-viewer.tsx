"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, FileJson2, Images, PackageCheck, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { getImportedExam, ImportedExamRecord } from "@/lib/local-imports";

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nested(record: RecordLike, ...keys: string[]): unknown {
  let current: unknown = record;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function getQuestions(document: unknown): unknown[] {
  if (!isRecord(document)) return [];
  const candidates = [
    document.questions,
    document.items,
    nested(document, "exam", "questions"),
    nested(document, "test", "questions"),
    nested(document, "content", "questions"),
    nested(document, "data", "questions"),
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function getQuestionId(question: unknown, index: number): string {
  if (!isRecord(question)) return String(index + 1);
  const value = question.id ?? question.question_id ?? question.questionId ?? question.number ?? question.index;
  return typeof value === "string" || typeof value === "number" ? String(value) : String(index + 1);
}

function flatten(value: unknown, depth = 0): string {
  if (depth > 7 || value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => flatten(item, depth + 1)).filter(Boolean).join(" ");
  if (!isRecord(value)) return "";

  const type = typeof value.type === "string" ? value.type.toLowerCase() : "";
  if (type === "text") return flatten(value.text ?? value.content ?? value.value, depth + 1);
  if (type === "math") {
    const latex = value.latex ?? value.value ?? value.content;
    return typeof latex === "string" ? latex : "";
  }
  if (type === "table" && Array.isArray(value.rows)) return flatten(value.rows, depth + 1);

  for (const key of ["text", "prompt", "statement", "stem", "content", "body", "question", "label"]) {
    if (key in value) {
      const text = flatten(value[key], depth + 1);
      if (text) return text;
    }
  }
  return "";
}

function questionText(question: unknown): string {
  if (!isRecord(question)) return "Pregunta sin texto reconocible.";
  for (const candidate of [question.stem, question.prompt, question.statement, question.text, question.content, question.body]) {
    const text = flatten(candidate).replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return "Pregunta sin texto reconocible.";
}

function getOptions(question: unknown): Array<{ key: string; text: string }> {
  if (!isRecord(question)) return [];
  const candidate = question.options ?? question.alternatives ?? question.choices ?? question.answers;
  if (!Array.isArray(candidate)) return [];

  return candidate.map((option, index) => {
    if (typeof option === "string" || typeof option === "number") {
      return { key: String.fromCharCode(65 + index), text: String(option) };
    }
    if (isRecord(option)) {
      const key = option.key ?? option.id ?? option.label ?? String.fromCharCode(65 + index);
      const text = flatten(option.content ?? option.text ?? option.value ?? option.label).replace(/\s+/g, " ").trim();
      return { key: String(key), text: text || "Alternativa sin texto reconocible." };
    }
    return { key: String.fromCharCode(65 + index), text: "Alternativa sin texto reconocible." };
  });
}

export function ImportedExamViewer({ id }: { id: string }) {
  const [record, setRecord] = useState<ImportedExamRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setLoading(false);
      return;
    }

    void getImportedExam(id)
      .then((value) => {
        if (!cancelled) setRecord(value);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  const questions = useMemo(() => getQuestions(record?.finalJson), [record]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return questions.map((question, index) => ({ question, index }));
    return questions
      .map((question, index) => ({ question, index }))
      .filter(({ question, index }) => {
        const idText = getQuestionId(question, index).toLowerCase();
        return idText.includes(term) || questionText(question).toLowerCase().includes(term);
      });
  }, [questions, query]);

  const current = questions[active];
  const currentOptions = getOptions(current);

  if (loading) {
    return (
      <AppShell title="Ensayo importado" eyebrow="Biblioteca local">
        <div className="surface rounded-2xl p-6 text-sm font-bold text-[var(--muted)]">Abriendo ensayo…</div>
      </AppShell>
    );
  }

  if (!record) {
    return (
      <AppShell title="Ensayo importado" eyebrow="Biblioteca local">
        <div className="surface rounded-2xl p-6">
          <div className="text-lg font-extrabold">No se encontró este ensayo</div>
          <p className="mt-2 text-sm text-[var(--muted)]">Puede haber sido eliminado del almacenamiento local de este navegador.</p>
          <Link href="/app/ensayos" className="soft-button mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold">
            <ArrowLeft size={15} />Volver a Ensayos
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Ensayo importado" eyebrow="Biblioteca local">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/app/ensayos" className="mb-4 inline-flex items-center gap-2 text-xs font-extrabold text-[var(--muted)] hover:text-[var(--text)]">
            <ArrowLeft size={15} />Volver a Ensayos
          </Link>
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-emerald-500">
            <PackageCheck size={15} />Guardado solo en este navegador
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.03em]">{record.summary.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{record.summary.fileName}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex">
          <div className="surface rounded-xl px-4 py-3 text-center">
            <div className="text-lg font-extrabold">{record.summary.questionCount}</div>
            <div className="text-[9px] font-bold text-[var(--muted)]">preguntas</div>
          </div>
          <div className="surface rounded-xl px-4 py-3 text-center">
            <div className="text-lg font-extrabold">{record.summary.answerCount}</div>
            <div className="text-[9px] font-bold text-[var(--muted)]">respuestas</div>
          </div>
          <div className="surface rounded-xl px-4 py-3 text-center">
            <div className="text-lg font-extrabold">{record.summary.assetCount}</div>
            <div className="text-[9px] font-bold text-[var(--muted)]">assets</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="surface rounded-2xl p-4">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
            <Search size={15} className="text-[var(--muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar pregunta"
              className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none placeholder:text-[var(--muted-2)]"
            />
          </div>

          <div className="mt-3 max-h-[650px] space-y-2 overflow-y-auto pr-1">
            {visible.map(({ question, index }) => {
              const selected = index === active;
              return (
                <button
                  key={getQuestionId(question, index)}
                  onClick={() => setActive(index)}
                  className={"w-full rounded-xl border p-3 text-left transition " +
                    (selected
                      ? "border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20"
                      : "border-[var(--border)] hover:bg-[var(--surface-2)]")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-extrabold text-[var(--muted)]">Pregunta {getQuestionId(question, index)}</span>
                    <ChevronRight size={14} className="text-[var(--muted-2)]" />
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-4">{questionText(question)}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="surface-raised rounded-[24px] p-5 sm:p-7">
          {current ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1.5 text-[10px] font-extrabold text-[var(--primary)]">
                  Pregunta {getQuestionId(current, active)}
                </span>
                <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[10px] font-extrabold text-[var(--muted)]">
                  {active + 1}/{questions.length}
                </span>
              </div>

              <div className="mt-6 whitespace-pre-wrap text-lg font-bold leading-8">{questionText(current)}</div>

              {currentOptions.length > 0 ? (
                <div className="mt-7 space-y-3">
                  {currentOptions.map((option) => (
                    <div key={option.key} className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--surface-3)] text-xs font-extrabold">{option.key}</span>
                      <div className="pt-1 text-sm font-bold leading-6">{option.text}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                  El ensayo está guardado, pero este visor todavía no reconoce automáticamente la estructura de alternativas de esta pregunta.
                </div>
              )}

              <div className="mt-7 flex items-center justify-between border-t border-[var(--border)] pt-5">
                <button
                  onClick={() => setActive(Math.max(0, active - 1))}
                  disabled={active === 0}
                  className="soft-button rounded-xl px-4 py-3 text-xs font-extrabold disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setActive(Math.min(questions.length - 1, active + 1))}
                  disabled={active >= questions.length - 1}
                  className="tactile-primary rounded-xl px-5 py-3 text-xs font-extrabold disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </>
          ) : (
            <div className="text-sm font-bold text-[var(--muted)]">No hay preguntas reconocibles en este paquete.</div>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="surface rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-extrabold"><ShieldCheck size={16} className="text-emerald-500" />Local y privado</div>
          <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">Este ensayo se leyó desde IndexedDB de este navegador; no necesita estar publicado en PAESSED.</p>
        </div>
        <div className="surface rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-extrabold"><FileJson2 size={16} className="text-[var(--secondary)]" />Contenido</div>
          <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">El visor usa el final.json guardado dentro del paquete importado.</p>
        </div>
        <div className="surface rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-extrabold"><Images size={16} className="text-[var(--primary)]" />Assets</div>
          <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">{record.summary.assetCount} archivos de assets están guardados dentro del .paessed original.</p>
        </div>
      </div>
    </AppShell>
  );
}
