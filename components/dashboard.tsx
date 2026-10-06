"use client";

import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Calculator,
  ChevronRight,
  Clock3,
  Play,
  Sigma,
  Target,
  Triangle,
} from "lucide-react";
import type { ComponentType, CSSProperties } from "react";
import { AppShell } from "@/components/app-shell";

type Axis = {
  name: string;
  percentage: number;
  icon: ComponentType<{ size?: number; className?: string; style?: CSSProperties }>;
};

type MasteryStyle = CSSProperties & { "--mastery": string };

const axes: Axis[] = [
  { name: "Números", percentage: 88, icon: Calculator },
  { name: "Álgebra y funciones", percentage: 82, icon: Sigma },
  { name: "Geometría", percentage: 38, icon: Triangle },
  { name: "Probabilidad y estadística", percentage: 64, icon: BarChart3 },
];

function masteryState(percentage: number) {
  if (percentage >= 85) return "Dominado";
  if (percentage >= 75) return "Fuerte";
  if (percentage >= 55) return "Regular";
  if (percentage >= 40) return "Débil";
  return "Crítico";
}

/**
 * A continuous mastery scale instead of unrelated category colors.
 * Critical starts warm/red-orange, then moves through amber/lime into fresh green.
 * The lightness stays intentionally high so the UI keeps PAESSED's brighter feel.
 */
function masteryColor(percentage: number) {
  const p = Math.max(0, Math.min(100, percentage));
  let hue = 5;

  if (p <= 45) hue = 5 + (p / 45) * 23;
  else if (p <= 70) hue = 28 + ((p - 45) / 25) * 20;
  else if (p <= 85) hue = 48 + ((p - 70) / 15) * 40;
  else hue = 88 + ((p - 85) / 15) * 52;

  return `hsl(${Math.round(hue)} 78% 56%)`;
}

function DomainStrip() {
  return (
    <section className="surface overflow-hidden rounded-[20px]">
      <div className="flex overflow-x-auto lg:grid lg:grid-cols-4 lg:overflow-visible">
        {axes.map((axis, index) => {
          const Icon = axis.icon;
          const color = masteryColor(axis.percentage);
          const style: MasteryStyle = { "--mastery": color };

          return (
            <button
              key={axis.name}
              type="button"
              className={
                "min-w-[245px] flex-1 p-4 text-left transition hover:bg-[var(--surface-2)] sm:p-5 " +
                (index > 0 ? "border-l border-[var(--border)]" : "")
              }
              style={style}
              title={`${axis.name}: ${axis.percentage}% de dominio`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Icon size={17} className="shrink-0" style={{ color }} />
                  <span className="truncate text-[12px] font-extrabold sm:text-[13px]">{axis.name}</span>
                </div>
                <span className="text-sm font-extrabold tabular-nums">{axis.percentage}%</span>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-[var(--muted)]">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                <span style={{ color }}>{masteryState(axis.percentage)}</span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: axis.percentage + "%",
                    background: `linear-gradient(90deg, color-mix(in srgb, ${color} 72%, white 28%), ${color})`,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ScoreChart() {
  const points = [690, 711, 728, 742];
  const labels = ["3 sep", "10 sep", "12 sep", "21 sep"];
  const min = 670;
  const max = 770;
  const coords = points.map((score, index) => ({
    x: 26 + index * 104,
    y: 108 - ((score - min) / (max - min)) * 74,
  }));
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

  return (
    <svg viewBox="0 0 360 132" className="mt-4 h-[132px] w-full" role="img" aria-label="Evolución de puntajes">
      {[28, 68, 108].map((y) => (
        <line key={y} x1="20" x2="348" y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 5" />
      ))}
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((point, index) => (
        <g key={labels[index]}>
          <circle cx={point.x} cy={point.y} r="4.5" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.5" />
          <text x={point.x} y="127" textAnchor="middle" fill="var(--muted)" fontSize="8.5" fontWeight="700">
            {labels[index]}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function Dashboard() {
  const latestScore = 742;
  const monthlyGoal = 780;
  const goalProgress = Math.min(100, Math.round((latestScore / monthlyGoal) * 100));

  return (
    <AppShell title="Inicio" showPageContext={false}>
      <section className="mb-6">
        <h1 className="text-[30px] font-extrabold leading-tight tracking-[-.035em] sm:text-[34px]">Hola, Seba</h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">Revisa tu progreso y continúa practicando.</p>
      </section>

      <DomainStrip />

      <section className="surface-raised mt-5 overflow-hidden rounded-[20px] border-l-4 border-l-[var(--primary)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-[var(--muted)]">Práctica de hoy</div>
            <h2 className="mt-1.5 text-xl font-extrabold tracking-[-.02em] sm:text-2xl">Teorema de Tales</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Refuerza semejanza, el tema con más espacio para avanzar dentro de Geometría.
            </p>
            <div className="mt-3 flex items-center gap-4 text-[11px] font-bold text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5"><Target size={14} />5 preguntas</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 size={14} />~6 min</span>
            </div>
          </div>
          <Link
            href="/app/playground"
            className="tactile-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-xs font-extrabold"
          >
            <Play size={16} fill="currentColor" />Comenzar práctica
          </Link>
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-lg font-extrabold tracking-[-.02em]">Tu progreso</h2>

        <div className="surface mt-3 overflow-hidden rounded-[20px]">
          <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(310px,.8fr)]">
            <div className="p-5 sm:p-6 lg:border-r lg:border-[var(--border)]">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[28px] font-extrabold leading-none tracking-[-.03em]">{latestScore}<span className="ml-1 text-xs font-bold text-[var(--muted)]">pts</span></div>
                  <div className="mt-2 text-[11px] font-medium text-[var(--muted)]">Último ensayo · 21 sep 2026</div>
                </div>
                <div className="text-right text-[11px] font-extrabold text-emerald-500">+14 pts</div>
              </div>
              <ScoreChart />
            </div>

            <div className="border-t border-[var(--border)] p-5 sm:p-6 lg:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold">Meta mensual</div>
                <Target size={17} className="text-[var(--primary)]" />
              </div>
              <div className="mt-6 text-[28px] font-extrabold leading-none tracking-[-.03em]">{monthlyGoal}<span className="ml-1 text-xs font-bold text-[var(--muted)]">pts</span></div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: goalProgress + "%" }} />
              </div>
              <p className="mt-3 text-[11px] leading-5 text-[var(--muted)]">
                Te faltan {monthlyGoal - latestScore} puntos para llegar a tu meta.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Link
        href="/app/aprender"
        className="mt-4 flex items-center gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] sm:p-5"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--secondary-soft)] text-[var(--secondary)]">
          <BookOpen size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold">Continuar aprendiendo</div>
          <div className="mt-0.5 truncate text-[11px] text-[var(--muted)]">Semejanza de triángulos · 8 min</div>
        </div>
        <ChevronRight size={18} className="text-[var(--muted)]" />
      </Link>
    </AppShell>
  );
}
