"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Minus, X } from "lucide-react";
import { M1_AXES, M1_UNITS, toggleM1AxisSelection, toggleM1UnitSelection, type M1UnitId } from "@/lib/m1-curriculum";

export const ALL_M1_UNIT_IDS: M1UnitId[] = M1_UNITS.map((unit) => unit.id);

type TopicPickerProps = {
  selected: M1UnitId[];
  onChange: (next: M1UnitId[]) => void;
  questionCounts: Partial<Record<M1UnitId, number>>;
  compact?: boolean;
};

const easeOut = [0.22, 1, 0.36, 1] as const;
const countLabel = (count: number) => count === 1 ? "1 pregunta" : `${count} preguntas`;

export function PlaygroundTopicPicker({ selected, onChange, questionCounts, compact = false }: TopicPickerProps) {
  const [expanded, setExpanded] = useState<string[]>(compact ? [] : ["numeros", "algebra"]);
  const reduceMotion = Boolean(useReducedMotion());
  const selectedSet = new Set(selected);
  const allSelected = selected.length === ALL_M1_UNIT_IDS.length;
  const totalAvailable = selected.reduce((sum, id) => sum + (questionCounts[id] ?? 0), 0);
  const fadeTime = reduceMotion ? 0 : 0.18;
  const spring = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 500, damping: 28 };

  const update = (ids: M1UnitId[]) => {
    const nextSet = new Set(ids);
    onChange(ALL_M1_UNIT_IDS.filter((id) => nextSet.has(id)));
  };

  const toggleUnit = (id: M1UnitId) => update(toggleM1UnitSelection(selected, id));
  const toggleAxis = (axisId: (typeof M1_AXES)[number]["id"]) => update(toggleM1AxisSelection(selected, axisId));

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-extrabold text-[var(--text)]">Elige qué quieres practicar</div>
          <div className="mt-0.5 flex min-h-5 flex-wrap items-center gap-x-1 text-[11px] text-[var(--muted)]" aria-hidden="true">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={selected.length}
                initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: fadeTime, ease: easeOut }}
                className="inline-block font-semibold tabular-nums"
              >
                {selected.length}
              </motion.span>
            </AnimatePresence>
            <span>de {ALL_M1_UNIT_IDS.length} subejes ·</span>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={totalAvailable}
                initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: fadeTime, ease: easeOut }}
                className="inline-block font-semibold tabular-nums"
              >
                {countLabel(totalAvailable)}
              </motion.span>
            </AnimatePresence>
            <span>disponibles</span>
          </div>
          <span className="sr-only" role="status" aria-live="polite">
            {selected.length} de {ALL_M1_UNIT_IDS.length} subejes seleccionados; {countLabel(totalAvailable)} disponibles.
          </span>
          {!compact && <p className="mt-1 text-[11px] text-[var(--muted)]">Puedes combinar subejes de distintos ejes o seleccionar un eje completo.</p>}
        </div>
        <div className="flex items-center gap-1.5">
          <motion.button
            type="button"
            onClick={() => update(ALL_M1_UNIT_IDS)}
            disabled={allSelected}
            whileHover={reduceMotion ? undefined : { y: -1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.95 }}
            transition={{ duration: 0.14 }}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[10px] font-extrabold text-[var(--muted)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] disabled:opacity-40"
          >
            Seleccionar todos
          </motion.button>
          <motion.button
            type="button"
            onClick={() => update([])}
            disabled={selected.length === 0}
            whileHover={reduceMotion ? undefined : { y: -1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.95 }}
            transition={{ duration: 0.14 }}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[10px] font-extrabold text-[var(--muted)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] disabled:opacity-40"
          >
            Limpiar
          </motion.button>
        </div>
      </div>
      <div className={compact ? "space-y-2" : "grid items-start gap-3 lg:grid-cols-2"}>
        {M1_AXES.map((axis) => {
          const ids = axis.units.map((unit) => unit.id);
          const nSelected = ids.filter((id) => selectedSet.has(id)).length;
          const checked = nSelected === ids.length;
          const partial = nSelected > 0 && !checked;
          const open = expanded.includes(axis.id);
          const matchingCount = ids.reduce((sum, id) => sum + (questionCounts[id] ?? 0), 0);
          const panelId = `topic-picker-${compact ? "settings" : "setup"}-${axis.id}`;
          return (
            <section
              key={axis.id}
              className={`min-w-0 overflow-hidden rounded-2xl border bg-[var(--surface)] transition-[border-color,box-shadow] duration-200 ${nSelected > 0 ? "border-[var(--border-strong)]" : "border-[var(--border)]"}`}
            >
              <div className="flex items-center gap-2 px-3 py-3">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setExpanded((items) => open ? items.filter((id) => id !== axis.id) : [...items, axis.id])}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                >
                  <motion.span
                    aria-hidden="true"
                    animate={{ scale: nSelected > 0 ? 1 : 0.97 }}
                    transition={spring}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-[11px] font-extrabold tabular-nums transition-colors duration-200 ${nSelected ? "border-orange-500/30 bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"}`}
                  >
                    <AnimatePresence initial={false} mode="wait">
                      <motion.span
                        key={nSelected}
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.65 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.65 }}
                        transition={{ duration: fadeTime }}
                      >
                        {nSelected}/{ids.length}
                      </motion.span>
                    </AnimatePresence>
                  </motion.span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-extrabold leading-5 text-[var(--text)]">{axis.name}</span>
                    <span className="block text-[10px] leading-4 text-[var(--muted)]">{countLabel(matchingCount)} en el banco</span>
                  </span>
                  <motion.span
                    aria-hidden="true"
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.22, ease: easeOut }}
                    className="shrink-0 text-[var(--muted)]"
                  >
                    <ChevronDown size={15} />
                  </motion.span>
                </button>
                {/* Actual, keyboard-accessible, tri-state checkbox. Tapping it never toggles the accordion. */}
                <label
                  title={checked ? `Quitar todos los subejes de ${axis.name}` : `Seleccionar todos los subejes de ${axis.name}`}
                  className="group relative grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl transition-colors duration-150 hover:bg-[var(--surface-2)]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    ref={(node) => { if (node) node.indeterminate = partial; }}
                    onChange={() => toggleAxis(axis.id)}
                    aria-label={`Seleccionar todos los subejes de ${axis.name}`}
                    className="peer sr-only"
                  />
                  <motion.span
                    aria-hidden="true"
                    whileHover={reduceMotion ? undefined : { scale: 1.09 }}
                    animate={{ scale: nSelected ? 1 : 0.96 }}
                    transition={spring}
                    className={`grid h-[22px] w-[22px] place-items-center rounded-[6px] border transition-[background-color,border-color,box-shadow] duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--primary)] peer-focus-visible:ring-offset-2 ${nSelected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-[var(--surface)]"}`}
                  >
                    <AnimatePresence initial={false} mode="wait">
                      {(checked || partial) && (
                        <motion.span
                          key={checked ? "checked" : "partial"}
                          initial={reduceMotion ? false : { opacity: 0, scale: 0.4, rotate: -20 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.4 }}
                          transition={spring}
                        >
                          {checked ? <Check size={15} strokeWidth={3} /> : <Minus size={15} strokeWidth={3} />}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.span>
                </label>
              </div>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={panelId}
                    key="panel"
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ height: { duration: reduceMotion ? 0 : 0.25, ease: easeOut }, opacity: { duration: fadeTime } }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5 border-t border-[var(--border)] bg-[var(--surface-2)] p-2.5">
                      {axis.units.map((unit) => {
                        const chosen = selectedSet.has(unit.id);
                        const n = questionCounts[unit.id] ?? 0;
                        return (
                          <motion.label
                            key={unit.id}
                            whileHover={reduceMotion ? undefined : { y: -1 }}
                            whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                            transition={{ duration: 0.15, ease: easeOut }}
                            className={`relative flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-200 focus-within:ring-2 focus-within:ring-[var(--primary)] ${chosen ? "border-orange-500/35 bg-[var(--primary-soft)]" : "border-transparent bg-[var(--surface)] hover:border-[var(--border-strong)]"}`}
                          >
                            <input
                              type="checkbox"
                              checked={chosen}
                              onChange={() => toggleUnit(unit.id)}
                              aria-label={`${unit.name}, ${countLabel(n)}`}
                              className="peer sr-only"
                            />
                            <motion.span
                              aria-hidden="true"
                              animate={{ scale: chosen ? 1 : 0.96 }}
                              transition={spring}
                              className={`grid h-[19px] w-[19px] shrink-0 place-items-center rounded-[5px] border transition-colors duration-200 ${chosen ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-[var(--surface)]"}`}
                            >
                              <motion.span
                                animate={{ opacity: chosen ? 1 : 0, scale: chosen ? 1 : 0.45, rotate: chosen ? 0 : -20 }}
                                transition={spring}
                              >
                                <Check size={13} strokeWidth={3} />
                              </motion.span>
                            </motion.span>
                            <span className="min-w-0 flex-1 text-[11px] font-bold leading-4 text-[var(--text)]">{unit.name}</span>
                            <span className={`shrink-0 text-[10px] font-semibold tabular-nums ${n ? "text-[var(--muted)]" : "text-[var(--muted-2)]"}`} title={countLabel(n)}>{n} preg.</span>
                          </motion.label>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {!allSelected && selected.length > 0 && (
          <motion.div
            key="selected-tags"
            aria-label="Subejes seleccionados"
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: fadeTime, ease: easeOut }}
            className="flex flex-wrap gap-1.5"
          >
            <AnimatePresence initial={false}>
              {selected.slice(0, compact ? 3 : 8).map((id) => {
                const unit = M1_UNITS.find((item) => item.id === id);
                if (!unit) return null;
                return (
                  <motion.button
                    type="button"
                    key={id}
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.85, y: 3 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    whileHover={reduceMotion ? undefined : { scale: 1.03 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                    transition={{ duration: fadeTime, ease: easeOut }}
                    onClick={() => toggleUnit(id)}
                    aria-label={`Quitar ${unit.name} de la práctica`}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--primary-soft)] px-2.5 py-1.5 text-[10px] font-bold text-[var(--primary)]"
                  >
                    <span className="max-w-[200px] truncate">{unit.name}</span><X size={12} aria-hidden="true" />
                  </motion.button>
                );
              })}
            </AnimatePresence>
            {selected.length > (compact ? 3 : 8) && <span className="px-2 py-1 text-[10px] font-semibold text-[var(--muted)]">+{selected.length - (compact ? 3 : 8)} más</span>}
          </motion.div>
        )}
        {selected.length === 0 && (
          <motion.p
            key="empty-selection"
            role="status"
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: fadeTime, ease: easeOut }}
            className="rounded-xl border border-dashed border-[var(--border)] px-3 py-2 text-[11px] font-semibold text-[var(--muted)]"
          >
            Selecciona al menos un subeje para preparar una práctica.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
