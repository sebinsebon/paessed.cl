"use client";

import Link from "next/link";
import { LearningEntryCard } from "@/components/learning/learning-entry-card";
import { PageHeadingTransition } from "@/components/app-page-transition";
import { QuestionMapHoverCard, positionQuestionMapHover, type QuestionMapHoverData } from "@/components/question-map-hover";
import { FloatingHomeActions } from "@/components/app-navigation";
import { usePersistentAppShell } from "@/components/persistent-app-shell";
import { getM1UnitsForAxis, type M1AxisId, type M1UnitId } from "@/lib/m1-curriculum";
import { DEFAULT_EXAMS } from "@/lib/default-exams";
import { DEFAULT_QUESTION_INDEX } from "@/lib/learning/catalog";
import type { SavedDefaultExamSession } from "@/lib/learning/exam-repository";
import type { LearningProfile, LearningState } from "@/lib/learning/types";
import { Modal } from "./modal";

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  Bell,
  BookOpen,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Flame,
  Gamepad2,
  Gauge,
  Home,
  Moon,
  Play,
  ScanLine,
  Sigma,
  Sparkles,
  Sun,
  Target,
  Trophy,
  Upload,
  X,
  Zap,
  BarChart3,
  Triangle,
  TrendingUp,
  Route,
  ArrowUpRight,
  UserRound,
} from "lucide-react";
import {
  CSSProperties,
  ComponentType,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

/** Sileo’s native header renders the bell and title; the body below holds the subtitle. */
const MASTERY = {
  Dominado: { color: "#10b981", soft: "#ecfdf5", darkSoft: "#0b2a24" },
  Fuerte: { color: "#6366f1", soft: "#eef2ff", darkSoft: "#1d2048" },
  Regular: { color: "#eab308", soft: "#fefce8", darkSoft: "#332b0c" },
  "Débil": { color: "#f97316", soft: "#fff7ed", darkSoft: "#3a1d0d" },
  "Crítico": { color: "#ef4444", soft: "#fef2f2", darkSoft: "#35171b" },
  "Sin suficiente evidencia": { color: "#94a3b8", soft: "#f1f5f9", darkSoft: "#1e293b" },
} as const;

type MasteryState = keyof typeof MASTERY;
type Axis = {
  id: M1AxisId;
  name: string;
  shortName: string;
  state: MasteryState;
  percentage: number | null;
  correct: number;
  total: number;
  weakest: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  evidence: string;
  units: Partial<Record<M1UnitId, { count: number }>>;
};

type MasteryCSS = CSSProperties & { "--mastery": string };

const axisDetails = [
  { id: "numeros", name: "Números", shortName: "Números", icon: Calculator },
  { id: "algebra", name: "Álgebra y funciones", shortName: "Álgebra y funciones", icon: Sigma },
  { id: "geometria", name: "Geometría", shortName: "Geometría", icon: Triangle },
  { id: "datos", name: "Probabilidad y estadística", shortName: "Probabilidad y estadística", icon: BarChart3 },
] as const;

function masteryLevel(percent: number | null): MasteryState {
  if (percent === null) return "Sin suficiente evidencia";
  if (percent >= 85) return "Dominado";
  if (percent >= 75) return "Fuerte";
  if (percent >= 60) return "Regular";
  return percent >= 45 ? "Débil" : "Crítico";
}

function axisProgress(state: LearningState | null, profile: LearningProfile | null): Axis[] {
  return axisDetails.map(axis => {
    const evidence = profile?.axes.find(item => item.axisId === axis.id);
    const percentage = evidence?.calibrated ? Math.round(evidence.percent ?? 0) : null;
    const attempts = state?.attempts.filter(a => a.axisId === axis.id && a.eligible && !a.assisted) ?? [];
    const units = profile?.units.filter(unit => unit.axisId === axis.id && unit.percent !== null) ?? [];
    const weakest = [...units].sort((a, b) => a.percent! - b.percent!)[0];
    return { ...axis, percentage, state: masteryLevel(percentage),
      total: attempts.length, correct: attempts.filter(a => a.correct).length,
      evidence: `${evidence?.count ?? 0} respuestas elegibles`,
      weakest: percentage !== null && weakest ? getM1UnitsForAxis(axis.id).find(unit => unit.id === weakest.unitId)?.name ?? "" : "En calibración",
      units: Object.fromEntries(units.map(unit => [unit.unitId, { count: unit.count }])) };
  });
}

type CompletedExam = { id: string; title: string; href: string; date: string; answers: string };
function completedExams(sessions: Record<string, SavedDefaultExamSession>): CompletedExam[] {
  return Object.entries(sessions)
    .filter(([, session]) => session.completedAt)
    .sort(([, a], [, b]) => b.completedAt!.localeCompare(a.completedAt!))
    .flatMap(([id, session]) => {
      const exam = DEFAULT_EXAMS.find(item => item.id === id);
      if (!exam) return [];
      const answers = DEFAULT_QUESTION_INDEX.filter(question => question.examId === id)
        .map(question => !session.answers[question.id] ? "o" : session.answers[question.id] === question.correct ? "g" : "r").join("");
      return [{ id, title: exam.title, href: exam.href, answers,
        date: new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" }).format(new Date(session.completedAt!)) }];
    });
}

function masteryStyle(state: MasteryState): MasteryCSS {
  return { "--mastery": MASTERY[state].color };
}

/**
 * Carousel-only mastery color.
 * Keeps perceived lightness/chroma steady while hue travels from red to green.
 */
function carouselMasteryColor(percentage: number) {
  const pct = Math.max(0, Math.min(100, percentage));
  // One solid color per percentage band: red, orange, yellow, lime, green.
  if (pct >= 85) return "#22c55e";
  if (pct >= 75) return "#a3e635";
  if (pct >= 60) return "#eab308";
  if (pct >= 40) return "#f97316";
  return "#ef4444";
}


/** Restores the original carousel gradient on the progress bar only. */
function carouselProgressGradient(percentage: number) {
  const pct = Math.max(0, Math.min(100, percentage));
  if (pct >= 85) return "linear-gradient(90deg, #b6f35c, #64db35)";
  if (pct >= 75) return "linear-gradient(90deg, #c6ed4b, #83dc39)";
  if (pct >= 60) return "linear-gradient(90deg, #f3c64a, #c4df40)";
  if (pct >= 40) return "linear-gradient(90deg, #f6a34a, #ebca42)";
  return "linear-gradient(90deg, #ed5954, #f3953f)";
}

function MasteryBadge({ state }: { state: MasteryState }) {
  const item = MASTERY[state];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold tracking-[.02em]"
      style={{
        color: item.color,
        borderColor: `color-mix(in srgb, ${item.color} 34%, transparent)`,
        background: `color-mix(in srgb, ${item.color} 11%, var(--surface))`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
      {state}
    </span>
  );
}

function DomainCard({ axis, onOpen, mobile = false, duplicate = false }: { axis: Axis; onOpen: (axis: Axis) => void; mobile?: boolean; duplicate?: boolean }) {
  const Icon = axis.icon;
  const critical = axis.state === "Crítico";
  const axisColor = MASTERY[axis.state].color;
  const progressColor = axis.percentage === null ? axisColor : carouselMasteryColor(axis.percentage);
  return (
    <motion.button
      onClick={() => onOpen(axis)}
      tabIndex={duplicate ? -1 : undefined}
      whileHover={mobile ? undefined : { scale: 1.012 }}
      whileTap={{ scale: .98 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={`${mobile ? "min-w-[84vw] sm:min-w-[370px]" : "domain-card-width"} mastery-card rounded-2xl p-3.5 text-left`}
      data-critical={critical}
      style={masteryStyle(axis.state)}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border"
          style={{
            color: axisColor,
            borderColor: `color-mix(in srgb, ${axisColor} 25%, var(--border))`,
            background: `color-mix(in srgb, ${axisColor} 10%, var(--surface))`,
          }}
        >
          <Icon size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="truncate text-[15px] font-bold leading-[22px]">{axis.shortName}</h3>
              <p className="text-[13px] font-medium leading-5 text-[var(--muted)]">{axis.correct}/{axis.total} correctas</p>
            </div>
            <span
              className="rounded-lg px-2.5 py-1 text-[13px] font-bold"
              style={{ color: axisColor, background: `color-mix(in srgb, ${axisColor} 11%, var(--surface))` }}
            >
              {axis.percentage === null ? "—" : `${axis.percentage}%`}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full progress-track">
        <motion.div
          className="progress-fill h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${axis.percentage ?? 0}%` }}
          transition={{ duration: .8, delay: .12, ease: [.22, 1, .36, 1] }}
          style={{ background: carouselProgressGradient(axis.percentage ?? 0) }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px] leading-4">
        <span className="font-semibold text-[var(--muted)]">
          <span style={{ color: progressColor }}>
            {axis.state}
          </span>
        </span>
        <span className="truncate text-right text-[var(--muted)]">{axis.weakest}</span>
      </div>
    </motion.button>
  );
}

function DomainRail({ axes, onOpen, tourFocus }: { axes: Axis[]; onOpen: (a: Axis) => void; tourFocus: boolean }) {
  const x = useMotionValue(0);
  const reduced = useReducedMotion();
  const unitRef = useRef<HTMLDivElement>(null);
  const loopWidth = useRef(0);
  const autoVelocity = useRef(-22);
  const momentumVelocity = useRef(0);
  const dragVelocity = useRef(0);
  const hovered = useRef(false);
  const dragging = useRef<{ pointerId: number; startX: number; lastX: number; lastTime: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);

  const wrapPosition = (position: number) => {
    const width = loopWidth.current;
    if (width <= 0) return position;
    return ((position % width) - width) % width;
  };

  useEffect(() => {
    const measure = () => {
      if (unitRef.current) {
        loopWidth.current = unitRef.current.getBoundingClientRect().width;
        x.set(wrapPosition(x.get()));
      }
    };
    measure();
    const obs = new ResizeObserver(measure);
    if (unitRef.current) obs.observe(unitRef.current);
    window.addEventListener("resize", measure);
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [x]);

  useAnimationFrame((_, delta) => {
    if (reduced || !loopWidth.current) return;

    const targetAuto = hovered.current || dragging.current?.active ? 0 : -22;
    const autoEasing = 1 - Math.exp(-delta / 190);
    autoVelocity.current += (targetAuto - autoVelocity.current) * autoEasing;

    if (!dragging.current?.active) {
      const decay = Math.exp(-delta / 460);
      momentumVelocity.current *= decay;
      if (Math.abs(momentumVelocity.current) < 4) momentumVelocity.current = 0;
    }

    x.set(wrapPosition(x.get() + ((autoVelocity.current + momentumVelocity.current) * delta) / 1000));
  });

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    dragging.current = { pointerId: event.pointerId, startX: event.clientX, lastX: event.clientX, lastTime: event.timeStamp, active: false };
    dragVelocity.current = 0;
    momentumVelocity.current = 0;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragging.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.lastX;
    const dt = Math.max(1, event.timeStamp - state.lastTime);
    if (!state.active && Math.abs(event.clientX - state.startX) > 4) {
      state.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (state.active) {
      x.set(wrapPosition(x.get() + dx));
      dragVelocity.current = (dx / dt) * 1000;
      event.preventDefault();
    }
    state.lastX = event.clientX;
    state.lastTime = event.timeStamp;
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragging.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (state.active) {
      suppressClick.current = true;
      momentumVelocity.current = dragVelocity.current;
      window.setTimeout(() => { suppressClick.current = false; }, 140);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragging.current = null;
  };

  const onTrackClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick.current = false;
  };

  const desktopSet = (copy: string, measure = false) => (
    <div ref={measure ? unitRef : undefined} className="flex shrink-0 gap-3 pr-3" aria-hidden={measure ? undefined : true}>
      {axes.map((axis) => (
        <DomainCard key={`${copy}-${axis.id}`} axis={axis} onOpen={onOpen} duplicate={!measure} />
      ))}
    </div>
  );

  return (
    <section id="tour-domains" className={`border-b border-[var(--border)] bg-[var(--surface)] py-[10px] ${tourFocus ? "tour-focus" : ""}`}>
      <div
        className="domain-desktop-viewport domain-rail-mask hidden overflow-hidden px-5 py-[10px] lg:block"
        onMouseEnter={() => { hovered.current = true; }}
        onMouseLeave={() => { hovered.current = false; }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onClickCapture={onTrackClickCapture}
        aria-label="Ejes M1: arrastra libremente para explorar o pulsa una tarjeta para ver su detalle"
      >
        <motion.div className="flex w-max" style={{ x }}>
          {desktopSet("a", true)}
          {desktopSet("b")}
          {desktopSet("c")}
        </motion.div>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {axes.map((axis) => (
          <div className="snap-center" key={axis.id}>
            <DomainCard axis={axis} onOpen={onOpen} mobile />
          </div>
        ))}
      </div>
    </section>
  );
}

function AxisModal({ axis, onClose }: { axis: Axis | null; onClose: () => void }) {
  if (!axis) return null;
  return <Modal labelledBy="axis-detail-title" onDismiss={onClose}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 id="axis-detail-title" tabIndex={-1} className="text-2xl font-extrabold">{axis.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MasteryBadge state={axis.state} />
          <span className="text-xs text-[var(--muted)]">{axis.evidence}</span>
        </div>
      </div>
      <button type="button" aria-label="Cerrar detalle" onClick={onClose} className="soft-button grid h-9 w-9 shrink-0 place-items-center rounded-xl"><X size={18} /></button>
    </div>
    <p className="mt-5 text-sm text-[var(--muted)]">{axis.percentage === null
      ? "El dominio se estima cuando registras al menos 15 respuestas elegibles en este eje."
      : `Dominio estimado: ${axis.percentage}% · ${axis.correct} de ${axis.total} respuestas elegibles correctas.`}</p>
    <ul className="mt-4 grid gap-2">
      {getM1UnitsForAxis(axis.id).map(unit => {
        const progress = axis.units[unit.id];
        return <li key={unit.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs">
          <span className="font-bold">{unit.name}</span>
          <span className="shrink-0 text-[var(--muted)]">{progress ? `${progress.count} registradas` : "Sin evidencia"}</span>
        </li>;
      })}
    </ul>
    <Link href="/app/playground" className="tactile-primary mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-extrabold">
      Ir a Playground <ArrowUpRight size={15} />
    </Link>
  </Modal>;
}

function DailyMission({ tourFocus }: { tourFocus: boolean }) {
  return <LearningEntryCard tourFocus={tourFocus} />;
}

function ExamsCard({ embedded = false, latest }: { embedded?: boolean; latest?: CompletedExam }) {
  return (
    <section id="tour-exams-summary" className={embedded ? "relative isolate flex h-full flex-col overflow-hidden bg-transparent p-5" : "surface relative isolate flex flex-col overflow-hidden rounded-[20px] p-5"}>
      <div className="relative z-10">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--muted)]">Ensayos</div>
          <h3 className="mt-1 text-xl font-extrabold tracking-[-.02em]">¿Listo para realizar un ensayo?</h3>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Mide tu progreso real en M1 y actualiza tu perfil de dominio con un resultado completo.</p>
        </div>
      </div>

      <div className="relative z-10 mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[var(--surface-2)] p-3">
          <div className="text-[10px] font-bold text-[var(--muted)]">Último resultado</div>
          <div className="mt-1 text-lg font-extrabold">{latest ? `${latest.answers.split("g").length - 1} de ${latest.answers.length} correctas` : "Sin ensayos rendidos"}</div>
        </div>
        <div className="rounded-xl bg-[var(--surface-2)] p-3">
          <div className="text-[10px] font-bold text-[var(--muted)]">Formato</div>
          <div className="mt-1 text-lg font-extrabold">65 preguntas</div>
        </div>
      </div>

      <motion.div whileHover={{ scale: 1.01 }} className="relative z-10 mt-auto pt-4">
        <Link
          href="/app/ensayos"
          className="tactile-primary inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-xs font-extrabold"
        >
          Hacer un ensayo
          <ArrowUpRight size={16} />
        </Link>
      </motion.div>
    </section>
  );
}


function ProgressOverview({ embedded = false, state }: { embedded?: boolean; state: LearningState | null }) {
  const modes = [
    { id: "diagnostic", label: "Diagnóstico" },
    { id: "learn", label: "Aprender" },
    { id: "exam", label: "Ensayos" },
    { id: "playground", label: "Playground" },
  ] as const;
  return <section id="tour-progress" className={embedded ? "h-full bg-transparent p-5" : "surface rounded-[20px] p-5"}>
    <h3 className="text-lg font-extrabold">Respuestas registradas</h3>
    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {modes.map(mode => <div key={mode.id} className="rounded-xl bg-[var(--surface-2)] p-3">
        <dt className="text-xs font-semibold text-[var(--muted)]">{mode.label}</dt>
        <dd className="mt-1 text-xl font-extrabold">{state?.attempts.filter(attempt => attempt.mode === mode.id).length ?? 0}</dd>
      </div>)}
    </dl>
  </section>;
}

function LearnCard({ tourFocus }: { tourFocus: boolean }) {
  return (
    <section id="tour-learn" className={`surface relative isolate overflow-hidden rounded-[20px] p-5 ${tourFocus ? "tour-focus" : ""}`}>
      <div className="relative z-10">
        <div className="text-sm font-semibold text-[var(--muted)]">Playground</div>
        <h3 className="mt-2 text-lg font-extrabold">Practica a tu manera</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Resuelve todas las preguntas que quieras y ajusta la práctica por año, eje temático y otros filtros.</p>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] p-3.5">
          <div>
            <div className="text-xs font-extrabold">Pregunta aleatoria</div>
            <div className="mt-1 text-[10px] text-[var(--muted)]">Empieza al instante o entra al Playground para personalizar la sesión.</div>
          </div>
          <Link href="/app/playground" className="soft-button flex items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-extrabold">Abrir <ChevronRight size={14} /></Link>
        </div>
      </div>
    </section>
  );
}

function DashboardCards({ missionFocus, learnFocus, completed, state }: { missionFocus: boolean; learnFocus: boolean; completed: CompletedExam[]; state: LearningState | null }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const examsRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [shape, setShape] = useState({ width: 0, height: 0, examsLeft: 0, progressLeft: 0, progressTop: 0 });

  useEffect(() => {
    const shell = shellRef.current;
    const exams = examsRef.current;
    const progress = progressRef.current;
    if (!shell || !exams || !progress) return;

    const update = () => {
      const shellRect = shell.getBoundingClientRect();
      const examsRect = exams.getBoundingClientRect();
      const progressRect = progress.getBoundingClientRect();

      setShape({
        width: shellRect.width,
        height: shellRect.height,
        examsLeft: examsRect.left - shellRect.left,
        progressLeft: progressRect.left - shellRect.left,
        progressTop: progressRect.top - shellRect.top,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(shell);
    observer.observe(exams);
    observer.observe(progress);
    return () => observer.disconnect();
  }, []);

  const inset = 0.5;
  const r = 20;
  const right = Math.max(inset, shape.width - inset);
  const bottom = Math.max(inset, shape.height - inset);
  const path = shape.width > 0 && shape.height > 0
    ? [
        `M ${shape.examsLeft + r} ${inset}`,
        `H ${right - r}`,
        `Q ${right} ${inset} ${right} ${inset + r}`,
        `V ${bottom - r}`,
        `Q ${right} ${bottom} ${right - r} ${bottom}`,
        `H ${shape.progressLeft + r}`,
        `Q ${shape.progressLeft} ${bottom} ${shape.progressLeft} ${bottom - r}`,
        `V ${shape.progressTop + r}`,
        `Q ${shape.progressLeft} ${shape.progressTop} ${shape.progressLeft + r} ${shape.progressTop}`,
        `H ${shape.examsLeft - r}`,
        `Q ${shape.examsLeft} ${shape.progressTop} ${shape.examsLeft} ${shape.progressTop - r}`,
        `V ${inset + r}`,
        `Q ${shape.examsLeft} ${inset} ${shape.examsLeft + r} ${inset}`,
        "Z",
      ].join(" ")
    : "";

  return (
    <>
      <div className="mt-4 grid gap-4 lg:hidden">
        <DailyMission tourFocus={missionFocus} />
        <ExamsCard latest={completed[0]} />
        <LearnCard tourFocus={learnFocus} />
        <ProgressOverview state={state} />
      </div>

      <div ref={shellRef} className="relative mt-4 hidden lg:block">
        {path && (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
            viewBox={`0 0 ${shape.width} ${shape.height}`}
            preserveAspectRatio="none"
          >
            <path
              d={path}
              fill="var(--surface)"
              stroke="var(--border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        <div className="relative z-10 grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(290px,.75fr)]">
          <DailyMission tourFocus={missionFocus} />
          <div ref={examsRef}>
            <ExamsCard embedded latest={completed[0]} />
          </div>
        </div>

        <div className="relative z-10 mt-4 grid gap-4 lg:grid-cols-[minmax(320px,.85fr)_minmax(0,1.4fr)]">
          <LearnCard tourFocus={learnFocus} />
          <div ref={progressRef}>
            <ProgressOverview embedded state={state} />
          </div>
        </div>
      </div>
    </>
  );
}

function ExamCard({ exam }: { exam: CompletedExam }) {
  const squares = exam.answers.split("");
  const [hoveredQuestion, setHoveredQuestion] = useState<QuestionMapHoverData | null>(null);
  const correct = squares.filter((a) => a === "g").length;
  const wrong = squares.filter((a) => a === "r").length;
  const omitted = squares.filter((a) => a === "o").length;

  return (
    <Link
      href={exam.href}
      className="group block w-full rounded-[18px] border border-[var(--border)] bg-[var(--surface-2)] p-4 text-left shadow-[var(--shadow-1)] transition-[border-color,box-shadow] hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-2)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)]">
              <Trophy size={15} />
            </span>
            <div>
              <div className="text-[13px] font-extrabold">{exam.title}</div>
              <div className="mt-0.5 text-[10px] font-medium text-[var(--muted)]">{exam.date} · {squares.length} preguntas</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }} aria-label="Mapa de las 65 preguntas">
          {squares.map((a, i) => {
            const label = a === "g" ? "Correcta" : a === "r" ? "Incorrecta" : "Omitida";
            return (
              <motion.span
                key={i}
                whileHover={{ scale: 1.18, y: -1 }}
                onMouseEnter={(event) => setHoveredQuestion(positionQuestionMapHover(event.currentTarget, i + 1, label))}
                onMouseLeave={() => setHoveredQuestion(null)}
                aria-label={`Pregunta ${i + 1}: ${label}`}
                className={`relative cursor-help aspect-square min-h-[8px] rounded-[3px] hover:z-10 hover:ring-2 hover:ring-[var(--text)] hover:ring-offset-2 hover:ring-offset-[var(--surface)] ${a === "g" ? "bg-emerald-500" : a === "r" ? "bg-rose-400" : "bg-[var(--muted-2)] opacity-55"}`}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-emerald-500" />{correct} correctas</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-rose-400" />{wrong} incorrectas</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-[var(--muted-2)] opacity-60" />{omitted} omitidas</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[var(--primary)] opacity-90 transition-opacity group-hover:opacity-100">Ver análisis <ArrowUpRight size={13} /></span>
      </div>
      <QuestionMapHoverCard data={hoveredQuestion} />
    </Link>
  );
}

function LastExams({ tourFocus, exams }: { tourFocus: boolean; exams: CompletedExam[] }) {
  return (
    <section id="tour-exams" className={`surface rounded-[24px] p-5 sm:p-6 ${tourFocus ? "tour-focus" : ""}`}>
      <div className="mb-5 flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">
            <Trophy size={15} className="text-[var(--primary)]" /> Historial reciente
          </div>
          <h2 className="text-[20px] font-extrabold tracking-[-.02em]">Últimos ensayos</h2>
          <p className="mt-1 text-[12px] text-[var(--muted)]">Cada ensayo real recalibra tu perfil de dominio y deja un mapa completo de las 65 preguntas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden items-center gap-3 text-[10px] font-bold text-[var(--muted)] md:flex">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-emerald-500" />Correcta</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-rose-400" />Incorrecta</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--muted-2)] opacity-60" />Omitida</span>
          </div>
          <Link href="/app/ensayos" className="soft-button rounded-lg px-3 py-2 text-[10px] font-extrabold text-[var(--primary)]">Ver todos</Link>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {exams.slice(0, 3).map(exam => <ExamCard key={exam.id} exam={exam} />)}
        {exams.length === 0 && <p className="text-sm text-[var(--muted)]">Aquí aparecerán tus ensayos del catálogo cuando los termines.</p>}
      </div>
    </section>
  );
}

const tourSteps = [
  { key: "domains", title: "Tu dominio M1", body: "Aquí ves los cuatro ejes. El color depende de tu nivel, no del eje. Haz clic para ver detalle." },
  { key: "mission", title: "Tu misión diaria", body: "PAESSED prioriza una actividad corta usando tus debilidades y tu práctica reciente." },
  { key: "exams-summary", title: "Realiza ensayos completos", body: "Desde aquí puedes hacer un ensayo PAES M1, consultar tu último resultado y medir tu dominio con 65 preguntas." },
  { key: "progress", title: "Revisa tus respuestas", body: "Aquí puedes ver el avance que has registrado en diagnóstico, práctica y ensayos." },
  { key: "learn", title: "Practica libremente en Playground", body: "Resuelve preguntas sin límite y filtra por año, eje temático y más." },
  { key: "exams", title: "Revisa tus últimos ensayos", body: "Abre un ensayo finalizado para ver sus resultados." },
];

/** Mobile and desktop mount separate copies; target the one actually rendered. */
function getVisibleTourTarget(key: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(`[id="tour-${key}"]`))
    .find((element) => element.getClientRects().length > 0) ?? null;
}

type TourSpotlight = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  viewportWidth: number;
  viewportHeight: number;
};

function Tour({ open, step, setStep, close }: { open: boolean; step: number; setStep: (n: number) => void; close: () => void }) {
  const reducedMotion = useReducedMotion();
  const [spotlight, setSpotlight] = useState<TourSpotlight | null>(null);

  // A viewport-level cutout avoids z-index/stacking-context problems inside the
  // dashboard grids, and follows the target during smooth scrolling.
  useEffect(() => {
    if (!open) {
      setSpotlight(null);
      return;
    }

    const target = getVisibleTourTarget(tourSteps[step].key);
    let frame = 0;
    const measure = () => {
      if (!target || !target.getClientRects().length) {
        setSpotlight(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const clampX = (value: number) => Math.max(0, Math.min(viewportWidth, value));
      const clampY = (value: number) => Math.max(0, Math.min(viewportHeight, value));
      const padding = 7;
      setSpotlight({
        top: clampY(rect.top - padding),
        bottom: clampY(rect.bottom + padding),
        left: clampX(rect.left - padding),
        right: clampX(rect.right + padding),
        viewportWidth,
        viewportHeight,
      });
    };
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    window.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure);
    const observer = new ResizeObserver(scheduleMeasure);
    if (target) observer.observe(target);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      observer.disconnect();
    };
  }, [open, step]);

  if (!open) return null;
  const item = tourSteps[step];
  const dimmer = "absolute bg-slate-950/45 backdrop-blur-[1px] pointer-events-auto";

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[70]" aria-hidden="true">
        {spotlight ? (
          <>
            <div className={dimmer} style={{ top: 0, left: 0, width: "100%", height: spotlight.top }} />
            <div className={dimmer} style={{ top: spotlight.bottom, left: 0, width: "100%", bottom: 0 }} />
            <div className={dimmer} style={{ top: spotlight.top, left: 0, width: spotlight.left, height: spotlight.bottom - spotlight.top }} />
            <div className={dimmer} style={{ top: spotlight.top, left: spotlight.right, right: 0, height: spotlight.bottom - spotlight.top }} />
          </>
        ) : (
          <div className={dimmer + " inset-0"} />
        )}
      </div>
      {spotlight && (
        <motion.div
          key={item.key}
          aria-hidden="true"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reducedMotion ? 0 : .16, ease: "easeOut" }}
          className="pointer-events-none fixed z-[85] rounded-[20px]"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: Math.max(0, spotlight.right - spotlight.left),
            height: Math.max(0, spotlight.bottom - spotlight.top),
            outline: "3px solid var(--primary)",
            outlineOffset: 0,
          }}
        />
      )}
      <motion.div
        data-tour-panel
        layout="position"
        initial={reducedMotion ? false : { opacity: 0, y: 10, scale: .99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          layout: { duration: reducedMotion ? 0 : .32, ease: [.22, 1, .36, 1] },
          opacity: { duration: reducedMotion ? 0 : .18, ease: "easeOut" },
          y: { duration: reducedMotion ? 0 : .28, ease: [.22, 1, .36, 1] },
          scale: { duration: reducedMotion ? 0 : .28, ease: [.22, 1, .36, 1] },
        }}
        className={`surface-raised fixed left-1/2 z-[110] w-[calc(100%-28px)] max-w-lg -translate-x-1/2 rounded-2xl p-4 sm:p-5 ${
          step === tourSteps.length - 1
            ? "top-[84px] bottom-auto max-h-[calc(100dvh-104px)] overflow-y-auto"
            : "bottom-6"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><Sparkles size={17} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--muted)]">Primer recorrido · {step + 1}/{tourSteps.length}</div>
            <h3 className="mt-1 text-base font-extrabold">{item.title}</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.body}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={close} className="text-[10px] font-extrabold text-[var(--muted)] hover:text-[var(--text)]">Omitir recorrido</button>
          <div className="flex gap-2">
            {step > 0 && <button onClick={() => setStep(step - 1)} className="soft-button rounded-lg px-3 py-2 text-[10px] font-extrabold">Atrás</button>}
            <button onClick={() => step === tourSteps.length - 1 ? close() : setStep(step + 1)} className="tactile-primary rounded-lg px-4 py-2 text-[10px] font-extrabold">{step === tourSteps.length - 1 ? "Entendido" : "Siguiente"}</button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

export function Dashboard({ diagnostic, displayName, state, profile, examSessions, loading, notice }: {
  loading?: React.ReactNode;
  notice?: React.ReactNode;
  diagnostic?: ReactNode; displayName?: string; state: LearningState | null; profile: LearningProfile | null;
  examSessions: Record<string, SavedDefaultExamSession>;
}) {
  const axes = useMemo(() => axisProgress(state, profile), [state, profile]);
  const completed = useMemo(() => completedExams(examSessions), [examSessions]);
  const { dark, setDark, monthlyGoal, registerTour } = usePersistentAppShell();
  const [selectedAxis, setSelectedAxis] = useState<Axis | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  // Only remember scrollY during the tour; no extra listeners or storage.
  const tourOrigin = useRef<number | null>(null);
  // Preserve the exact scroll destination between the two cards in the desktop row.
  const sharedRowFocusTop = useRef<number | null>(null);
  const startTour = () => {
    if (tourOrigin.current === null) tourOrigin.current = window.scrollY;
    setTourStep(0);
    setTourOpen(true);
  };

  // The persistent top bar calls the currently-mounted dashboard tour.
  useEffect(() => registerTour(startTour), [registerTour, startTour]);

  const closeTour = () => {
    const returnTo = tourOrigin.current;
    tourOrigin.current = null;
    setTourOpen(false);
    setTourStep(0);
    // Wait until temporary tour-only padding/overlay are removed.
    if (returnTo !== null) {
      window.requestAnimationFrame(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: returnTo, behavior: reducedMotion ? "auto" : "smooth" });
      });
    }
  };

  const tourKey = tourOpen ? tourSteps[tourStep].key : "";

  // Keep the focused section clear of the tour panel. A cancellable, consistent
  // eased scroll is smoother than the browser-dependent native smooth scroll.
  useEffect(() => {
    if (!tourOpen) {
      sharedRowFocusTop.current = null;
      return;
    }

    let scrollFrame = 0;
    let setupFrame = window.requestAnimationFrame(() => {
      const key = tourSteps[tourStep].key;
      const focusedTarget = getVisibleTourTarget(key);
      if (!focusedTarget) return;

      // Progress and Playground occupy the same desktop row. Use one shared
      // camera anchor so moving the spotlight between them does not scroll
      // again by a few pixels to re-center the shorter card.
      const shareRow = window.matchMedia("(min-width: 1024px)").matches
        && (key === "progress" || key === "learn");
      const cameraTarget = shareRow
        ? getVisibleTourTarget("progress") ?? focusedTarget
        : focusedTarget;

      const rect = cameraTarget.getBoundingClientRect();
      const headerBottom = 16;
      const panel = document.querySelector<HTMLElement>("[data-tour-panel]");
      const panelHeight = panel?.offsetHeight ?? 0;
      const settledBottomPanelTop = window.innerHeight - 24 - panelHeight;
      const lastStep = tourStep === tourSteps.length - 1;
      const desiredTop = lastStep
        ? Math.max(headerBottom, 84 + panelHeight + 22)
        : (() => {
            const freeBottom = Math.max(headerBottom + 120, Math.min(window.innerHeight - 16, settledBottomPanelTop - 20));
            const freeHeight = Math.max(0, freeBottom - headerBottom);
            return headerBottom + Math.max(0, (freeHeight - rect.height) / 2);
          })();

      const startY = window.scrollY;
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const plannedDestination = Math.min(maxY, Math.max(0, startY + rect.top - desiredTop));
      // A change in coach text height must not trigger a second camera
      // adjustment when focusing Playground immediately after Progress.
      if (!shareRow) sharedRowFocusTop.current = null;
      const destination = shareRow && sharedRowFocusTop.current !== null
        ? Math.min(maxY, sharedRowFocusTop.current)
        : plannedDestination;
      if (shareRow) sharedRowFocusTop.current = destination;
      const distance = destination - startY;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reducedMotion || Math.abs(distance) < 2) {
        window.scrollTo({ top: destination, behavior: "instant" });
        return;
      }

      const duration = 420;
      let startedAt: number | null = null;
      const animateScroll = (time: number) => {
        if (startedAt === null) startedAt = time;
        const progress = Math.min(1, (time - startedAt) / duration);
        const eased = progress < .5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        window.scrollTo({ top: startY + distance * eased, behavior: "instant" });
        if (progress < 1) scrollFrame = window.requestAnimationFrame(animateScroll);
      };
      scrollFrame = window.requestAnimationFrame(animateScroll);
    });

    return () => {
      window.cancelAnimationFrame(setupFrame);
      window.cancelAnimationFrame(scrollFrame);
    };
  }, [tourOpen, tourStep]);

  return (
    <MotionConfig reducedMotion="user"><div className="paessed-home min-h-screen bg-[var(--canvas)]">
      <FloatingHomeActions dark={dark} setDark={setDark} onTour={startTour} />
      <main className="min-h-screen transition-[padding-left] duration-[240ms] ease-[cubic-bezier(.22,1,.36,1)] lg:pl-[var(--sidebar-width)]">
        <div
          className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-7"
          style={tourOpen && tourStep === tourSteps.length - 1 ? { paddingBottom: "max(46vh, 220px)" } : undefined}
        >
          {loading ?? <>
          <section className="mb-6 px-1 sm:px-[30px]">
            <PageHeadingTransition>
              <h1 className="text-[28px] font-extrabold leading-[36px] tracking-[-.035em] sm:text-[36px] sm:leading-[44px]">{displayName ? `¡Hola, ${displayName}!` : "¡Hola!"} Tu meta es de {monthlyGoal} pts en <span className="whitespace-nowrap">M1 🚀</span></h1>
            </PageHeadingTransition>
            <p className="mt-2 text-[14px] font-medium leading-6 text-[var(--muted)]">Mira cómo estás progresando y qué vale más la pena practicar hoy.</p>
          </section>

          {notice}
          {diagnostic}
          <div>
              <DomainRail axes={axes} onOpen={setSelectedAxis} tourFocus={tourKey === "domains"} />
              <DashboardCards missionFocus={tourKey === "mission"} learnFocus={tourKey === "learn"} completed={completed} state={state} />
              <div className="mt-7">
                <LastExams tourFocus={tourKey === "exams"} exams={completed} />
              </div>
          </div>
          </>}
        </div>
      </main>

      <AxisModal axis={selectedAxis} onClose={() => setSelectedAxis(null)} />
      <Tour open={tourOpen} step={tourStep} setStep={setTourStep} close={closeTour} />
    </div></MotionConfig>
  );
}
