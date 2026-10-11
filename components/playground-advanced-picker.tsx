"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Filter, Minus, Search } from "lucide-react";
import type { BankQuestion, BankSource } from "@/lib/playground-imports";

type Props = {
  questions: BankQuestion[];
  sources: BankSource[];
  selected: string[];
  onChange: (ids: string[]) => void;
  compact?: boolean;
};
const motionEase = [0.22, 1, 0.36, 1] as const;

export function PlaygroundAdvancedPicker({ questions, sources, selected, onChange, compact = false }: Props) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const reduced = Boolean(useReducedMotion());
  const selectedSet = new Set(selected);
  const allIds = questions.map((item) => item.id);
  const count = questions.filter((question) => selectedSet.has(question.id)).length;
  const normalized = search.trim().toLocaleLowerCase("es");

  const change = (items: Set<string>) => onChange(allIds.filter((id) => items.has(id)));
  const toggle = (ids: string[]) => {
    const next = new Set(selected);
    const allPresent = ids.length > 0 && ids.every((id) => selectedSet.has(id));
    for (const id of ids) { if (allPresent) next.delete(id); else next.add(id); }
    change(next);
  };

  return (
    <section aria-label="Ajustes avanzados de ensayos y preguntas" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-extrabold text-[var(--text)]"><Filter size={15} className="text-[var(--primary)]"/> Elige tus ensayos y preguntas</div>
          <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">Marca un ensayo completo o ábrelo para seleccionar preguntas una por una.</p>
        </div>
        <span aria-live="polite" className="rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-[var(--primary)]">{count}/{questions.length} elegidas</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <motion.button type="button" whileTap={reduced ? undefined : { scale: .96 }}
          onClick={() => onChange([...allIds])} disabled={count===questions.length}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-bold text-[var(--muted)] hover:bg-[var(--surface-2)] disabled:opacity-40">
          Todas
        </motion.button>
        <motion.button type="button" whileTap={reduced ? undefined : { scale: .96 }}
          onClick={() => onChange([])} disabled={count===0}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-bold text-[var(--muted)] hover:bg-[var(--surface-2)] disabled:opacity-40">
          Ninguna
        </motion.button>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
        <Search size={15} className="shrink-0 text-[var(--muted)]" />
        <input value={search} onChange={(event)=>setSearch(event.target.value)}
          aria-label="Buscar ensayo o pregunta" placeholder="Buscar ensayo o número de pregunta…"
          className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-[var(--text)] outline-none placeholder:text-[var(--muted-2)]" />
      </div>
      <div className="space-y-2">
        {sources.map((source) => {
          const sourceQuestions = questions.filter((q)=>q.sourceId===source.id);
          const chosen = sourceQuestions.filter((q)=>selectedSet.has(q.id)).length;
          const full = chosen === sourceQuestions.length && sourceQuestions.length > 0;
          const partial = chosen > 0 && !full;
          const open = expanded.includes(source.id) || (normalized.length > 0 && sourceQuestions.some((q)=>String(q.number).includes(normalized)||q.stem.toLocaleLowerCase("es").includes(normalized)));
          if (normalized && !source.name.toLocaleLowerCase("es").includes(normalized) &&
              !sourceQuestions.some((q)=>String(q.number).includes(normalized)||q.stem.toLocaleLowerCase("es").includes(normalized))) return null;
          const shown = normalized && !source.name.toLocaleLowerCase("es").includes(normalized)
            ? sourceQuestions.filter((q)=>String(q.number).includes(normalized)||q.stem.toLocaleLowerCase("es").includes(normalized))
            : sourceQuestions;
          const preview = sourceQuestions.find((q)=>q.id===previewId);
          return (
            <div key={source.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-2 p-2.5">
                <label className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-[var(--surface-2)]">
                  <input type="checkbox" checked={full} disabled={sourceQuestions.length===0}
                    ref={(node)=>{if(node) node.indeterminate=partial;}}
                    onChange={()=>toggle(sourceQuestions.map((q)=>q.id))}
                    aria-label={full?"Quitar ensayo "+source.name:"Seleccionar ensayo "+source.name}
                    className="peer sr-only" />
                  <motion.span animate={{ scale: chosen?1:.94 }} transition={reduced?{duration:0}:{type:"spring",stiffness:500,damping:28}}
                    className={`grid h-5 w-5 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--primary)] ${chosen?"border-[var(--primary)] bg-[var(--primary)] text-white":"border-[var(--border-strong)] bg-[var(--surface)]"}`}>
                    <AnimatePresence mode="wait" initial={false}>
                      {(full || partial) && (
                        <motion.span key={full?"full":"partial"} initial={reduced?false:{scale:.35,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:.35,opacity:0}} transition={{duration:reduced?0:.15}}>
                          {full?<Check size={14} strokeWidth={3}/>:<Minus size={14} strokeWidth={3}/>}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.span>
                </label>
                <button type="button" aria-expanded={open} aria-controls={"advanced-questions-"+source.id.replaceAll(":","-")}
                  onClick={()=>setExpanded((items)=>items.includes(source.id)?items.filter((id)=>id!==source.id):[...items,source.id])}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-extrabold text-[var(--text)]">{source.name}</span>
                    <span className="block text-[10px] leading-4 text-[var(--muted)]">{source.imported?"Importado · ":"Demostración · "}{chosen} de {sourceQuestions.length} preguntas</span>
                  </span>
                  <motion.span animate={{rotate:open?180:0}} transition={{duration:reduced?0:.18}} className="text-[var(--muted)]"><ChevronDown size={16}/></motion.span>
                </button>
              </div>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div id={"advanced-questions-"+source.id.replaceAll(":","-")} initial={reduced?false:{height:0,opacity:0}}
                    animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}
                    transition={{height:{duration:reduced?0:.23,ease:motionEase},opacity:{duration:reduced?0:.16}}}
                    className="overflow-hidden">
                    <div className="border-t border-[var(--border)] bg-[var(--surface-2)] p-3">
                      <p className="mb-3 text-[10px] leading-4 text-[var(--muted)]">Marca las preguntas por número. Pasa el cursor o selecciona un número para ver su enunciado.</p>
                      <div className="grid max-h-[210px] grid-cols-7 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-10">
                        {shown.map((q) => {
                          const active=selectedSet.has(q.id);
                          return (
                            <motion.button key={q.id} type="button"
                              onClick={()=>{toggle([q.id]);setPreviewId(q.id);}}
                              onMouseEnter={()=>setPreviewId(q.id)} onFocus={()=>setPreviewId(q.id)}
                              aria-pressed={active} aria-label={`Pregunta ${q.number} de ${source.name}, ${active?"seleccionada":"no seleccionada"}`}
                              title={q.stem.slice(0,190)}
                              whileTap={reduced?undefined:{scale:.9}}
                              transition={{duration:reduced?0:.13}}
                              className={`aspect-square min-w-0 rounded-[7px] border text-[10px] font-extrabold tabular-nums transition-[background-color,border-color,color] focus-visible:outline-2 focus-visible:outline-[var(--primary)] ${active?"border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]":"border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--primary)]"}`}>
                              {q.number}
                            </motion.button>
                          );
                        })}
                      </div>
                      {shown.length===0 && <p className="text-xs text-[var(--muted)]">No se encontraron preguntas.</p>}
                      {preview && <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                        <p className="text-[10px] font-extrabold text-[var(--primary)]">Pregunta {preview.number}</p>
                        <p className="mt-1 line-clamp-3 text-[11px] leading-5 text-[var(--muted)]">{preview.stem}</p>
                      </div>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {sources.length===0 && <p className="text-[11px] text-[var(--muted)]">No hay ensayos en el banco todavía.</p>}
      </div>
      <p className="text-[10px] leading-4 text-[var(--muted)]">
        La selección se combina con año, subejes y guardadas. Si un ensayo importado no tiene subeje asignado, aparecerá al usar todos los subejes.
      </p>
    </section>
  );
}
