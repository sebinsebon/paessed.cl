import type { CSSProperties } from "react";

/**
 * Visual accents shared with the current axis carousel preview.
 * These colors identify the axis here; they do not imply a student's mastery.
 */
const AXIS_ACCENTS = {
  numeros: "#22c55e",
  algebra: "#6366f1",
  geometria: "#ef4444",
  datos: "#eab308",
} as const;

function axisAccent(axis: string) {
  const normalized = axis.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("numero")) return AXIS_ACCENTS.numeros;
  if (normalized.includes("algebra")) return AXIS_ACCENTS.algebra;
  if (normalized.includes("geometria")) return AXIS_ACCENTS.geometria;
  if (normalized.includes("probabilidad") || normalized.includes("estadistica")) return AXIS_ACCENTS.datos;
  return "#64748b";
}

export function QuestionTopicTags({ axis, topic }: { axis?: string | null; topic?: string | null }) {
  const axisLabel = axis?.trim();
  const topicLabel = topic?.trim();
  if (!axisLabel && !topicLabel) return null;

  const accent = axisAccent(axisLabel ?? "");
  const style: CSSProperties = {
    color: accent,
    backgroundColor: `color-mix(in srgb, ${accent} 12%, var(--pg-bg))`,
    borderColor: `color-mix(in srgb, ${accent} 38%, var(--pg-border))`,
  };

  return (
    <span
      className="inline-flex min-w-0 max-w-[230px] items-center rounded-md border px-2 py-1 text-[10px] font-bold leading-4 sm:max-w-[330px]"
      style={style}
      title={[axisLabel, topicLabel].filter(Boolean).join(" · ")}
    >
      <span className="truncate">{axisLabel}{axisLabel && topicLabel ? " · " : ""}{topicLabel}</span>
    </span>
  );
}
