"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { M1_AXES, M1_UNITS, type M1UnitId } from "@/lib/m1-curriculum";

export const ALL_M1_UNIT_IDS: M1UnitId[] = M1_UNITS.map((unit) => unit.id);

type TopicPickerProps = {
  selected: M1UnitId[];
  onChange: (next: M1UnitId[]) => void;
  questionCounts: Partial<Record<M1UnitId, number>>;
  compact?: boolean;
};

const countLabel = (count: number) => count === 1 ? "1 pregunta" : `${count} preguntas`;

export function PlaygroundTopicPicker({ selected, onChange, questionCounts, compact = false }: TopicPickerProps) {
  const [expanded, setExpanded] = useState<string[]>(compact ? [] : ["numeros", "algebra"]);
  const selectedSet = new Set(selected);
  const allSelected = selected.length === ALL_M1_UNIT_IDS.length;
  const totalAvailable = selected.reduce((sum, id) => sum + (questionCounts[id] ?? 0), 0);

  const update = (ids: M1UnitId[]) => {
    const nextSet = new Set(ids);
    onChange(ALL_M1_UNIT_IDS.filter((id) => nextSet.has(id)));
  };

  const toggleUnit = (id: M1UnitId) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update([...next]);
  };

  const toggleAxis = (ids: readonly M1UnitId[]) => {
    const fullySelected = ids.every((id) => selectedSet.has(id));
    const next = new Set(selected);
    ids.forEach((id) => fullySelected ? next.delete(id) : next.add(id));
    update([...next]);
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-extrabold text-[var(--text)]">Elige qué quieres practicar</div>
          <p aria-live="polite" className="mt-0.5 text-[11px] leading-5 text-[var(--muted)]">
            {selected.length} de {ALL_M1_UNIT_IDS.length} subejes · {countLabel(totalAvailable)} disponibles
          </p>
          {!compact && <p className="mt-1 text-[11px] text-[var(--muted)]">Puedes combinar subejes de distintos ejes o seleccionar un eje completo.</p>}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => update(ALL_M1_UNIT_IDS)} disabled={allSelected}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[10px] font-extrabold text-[var(--muted)] hover:bg-[var(--surface-2)] disabled:opacity-40">
            Seleccionar todos
          </button>
          <button type="button" onClick={() => update([])} disabled={selected.length === 0}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[10px] font-extrabold text-[var(--muted)] hover:bg-[var(--surface-2)] disabled:opacity-40">
            Limpiar
          </button>
        </div>
      </div>
      <div className={compact ? "space-y-2" : "grid gap-3 lg:grid-cols-2"}>
        {M1_AXES.map((axis) => {
          const ids = axis.units.map((unit) => unit.id);
          const nSelected = ids.filter((id) => selectedSet.has(id)).length;
          const checked = nSelected === ids.length;
          const open = expanded.includes(axis.id);
          const matchingCount = ids.reduce((sum, id) => sum + (questionCounts[id] ?? 0), 0);
          const panelId = `topic-picker-${compact ? "settings" : "setup"}-${axis.id}`;
          return (
            <section key={axis.id} className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-2 px-3 py-3">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setExpanded((items) => open ? items.filter((id) => id !== axis.id) : [...items, axis.id])}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                >
                  <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-[11px] font-extrabold ${nSelected ? "border-orange-500/30 bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"}`}>
                    {nSelected}/{ids.length}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-extrabold leading-5 text-[var(--text)]">{axis.name}</span>
                    <span className="block text-[10px] leading-4 text-[var(--muted)]">{countLabel(matchingCount)} en el banco</span>
                  </span>
                  <ChevronDown size={15} aria-hidden="true" className={`shrink-0 text-[var(--muted)] transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
                </button>
                <button
                  type="button"
                  aria-pressed={checked}
                  aria-label={checked ? `Quitar todos los subejes de ${axis.name}` : `Seleccionar todos los subejes de ${axis.name}`}
                  onClick={() => toggleAxis(ids)}
                  className={`shrink-0 rounded-lg border px-2.5 py-2 text-[10px] font-extrabold transition-colors ${checked ? "border-orange-500/30 bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--primary)]"}`}
                >
                  {checked ? "Quitar eje" : "Elegir eje"}
                </button>
              </div>
              {open && (
                <div id={panelId} className="space-y-1.5 border-t border-[var(--border)] bg-[var(--surface-2)] p-2.5">
                  {axis.units.map((unit) => {
                    const chosen = selectedSet.has(unit.id);
                    const n = questionCounts[unit.id] ?? 0;
                    return (
                      <button
                        type="button"
                        key={unit.id}
                        aria-pressed={chosen}
                        aria-label={`${unit.name}, ${countLabel(n)}, ${chosen ? "seleccionado" : "no seleccionado"}`}
                        onClick={() => toggleUnit(unit.id)}
                        className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--primary)] ${chosen ? "border-orange-500/35 bg-[var(--primary-soft)]" : "border-transparent bg-[var(--surface)] hover:border-[var(--border-strong)]"}`}
                      >
                        <span aria-hidden="true" className={`grid h-[19px] w-[19px] shrink-0 place-items-center rounded-[5px] border ${chosen ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-[var(--surface)]"}`}>
                          {chosen && <Check size={13} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1 text-[11px] font-bold leading-4 text-[var(--text)]">{unit.name}</span>
                        <span className={`shrink-0 text-[10px] font-semibold tabular-nums ${n ? "text-[var(--muted)]" : "text-[var(--muted-2)]"}`} title={countLabel(n)}>{n} preg.</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {!allSelected && selected.length > 0 && (
        <div aria-label="Subejes seleccionados" className="flex flex-wrap gap-1.5">
          {selected.slice(0, compact ? 3 : 8).map((id) => {
            const unit = M1_UNITS.find((item) => item.id === id);
            if (!unit) return null;
            return (
              <button type="button" key={id} onClick={() => toggleUnit(id)}
                aria-label={`Quitar ${unit.name} de la práctica`}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--primary-soft)] px-2.5 py-1.5 text-[10px] font-bold text-[var(--primary)] hover:opacity-75">
                <span className="max-w-[200px] truncate">{unit.name}</span><X size={12} aria-hidden="true" />
              </button>
            );
          })}
          {selected.length > (compact ? 3 : 8) && <span className="px-2 py-1 text-[10px] font-semibold text-[var(--muted)]">+{selected.length - (compact ? 3 : 8)} más</span>}
        </div>
      )}
      {selected.length === 0 && (
        <p role="status" className="rounded-xl border border-dashed border-[var(--border)] px-3 py-2 text-[11px] font-semibold text-[var(--muted)]">
          Selecciona al menos un subeje para preparar una práctica.
        </p>
      )}
    </div>
  );
}
