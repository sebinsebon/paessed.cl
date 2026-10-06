"use client";

import Link from "next/link";

import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { sileo, Toaster } from "sileo";
import {
  Bell,
  BookOpen,
  Calculator,
  Check,
  ChevronRight,
  CircleHelp,
  Flame,
  Gamepad2,
  Gauge,
  Home,
  Medal,
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
  Pencil,
  Route,
  Clock3,
  ShieldCheck,
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
} from "react";

/** Sileo’s native header renders the bell and title; the body below holds the subtitle. */
function announce(title: string, subtitle: string, variant: "info" | "success" = "info") {
  sileo.clear();
  const options = {
    title,
    description: subtitle,
    // The top-edge layout places the badge ABOVE the description. CSS anchors
    // its viewport bottom-right without overriding Sileo’s morph geometry.
    position: "top-right" as const,
    icon: variant === "info"
      ? <Bell size={17} strokeWidth={2.3} color="#fb923c" />
      : <Check size={17} strokeWidth={2.6} color="#10b981" />,
    duration: 3000,
    autopilot: { expand: 0, collapse: 2400 },
  };
  if (variant === "success") sileo.success(options);
  else sileo.info(options);
}

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
  id: string;
  name: string;
  shortName: string;
  state: MasteryState;
  percentage: number;
  correct: number;
  total: number;
  weakest: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  evidence: string;
  units: Array<{ name: string; state: MasteryState; pct: number }>;
};

type MasteryCSS = CSSProperties & { "--mastery": string };

const axes: Axis[] = [
  {
    id: "numeros",
    name: "Números",
    shortName: "Números",
    state: "Dominado",
    percentage: 88,
    correct: 15,
    total: 17,
    weakest: "Potencias y raíces",
    icon: Calculator,
    evidence: "Evidencia alta · 47 respuestas recientes",
    units: [
      { name: "Números enteros y racionales", state: "Dominado", pct: 94 },
      { name: "Porcentajes", state: "Fuerte", pct: 84 },
      { name: "Potencias y raíces", state: "Regular", pct: 72 },
    ],
  },
  {
    id: "algebra",
    name: "Álgebra y Funciones",
    shortName: "Álgebra y Funciones",
    state: "Fuerte",
    percentage: 82,
    correct: 21,
    total: 25,
    weakest: "Ecuaciones lineales",
    icon: Sigma,
    evidence: "Evidencia alta · 51 respuestas recientes",
    units: [
      { name: "Expresiones algebraicas", state: "Dominado", pct: 90 },
      { name: "Ecuaciones e inecuaciones", state: "Fuerte", pct: 83 },
      { name: "Funciones", state: "Regular", pct: 69 },
    ],
  },
  {
    id: "geometria",
    name: "Geometría",
    shortName: "Geometría",
    state: "Crítico",
    percentage: 38,
    correct: 6,
    total: 16,
    weakest: "Teorema de Tales",
    icon: Triangle,
    evidence: "Evidencia media · 29 respuestas recientes",
    units: [
      { name: "Figuras geométricas", state: "Regular", pct: 66 },
      { name: "Semejanza y Teorema de Tales", state: "Crítico", pct: 34 },
      { name: "Transformaciones isométricas", state: "Débil", pct: 54 },
    ],
  },
  {
    id: "datos",
    name: "Probabilidad y Estadística",
    shortName: "Probabilidad y Datos",
    state: "Regular",
    percentage: 64,
    correct: 11,
    total: 17,
    weakest: "Regla de Laplace",
    icon: BarChart3,
    evidence: "Evidencia media · 33 respuestas recientes",
    units: [
      { name: "Representación de datos", state: "Fuerte", pct: 80 },
      { name: "Medidas de tendencia", state: "Regular", pct: 68 },
      { name: "Probabilidad", state: "Débil", pct: 56 },
    ],
  },
];

const exams = [
  { id: 8, score: 742, date: "21 sep", answers: "ggrgggrogggrgggrggogrgggrgggrggogrgggrgggrggogrgggrgggrgggrgggrgg" },
  { id: 7, score: 728, date: "12 sep", answers: "ggrggrgogrggrggrggorggrggrggrggorggrggrggrggorggrggrggrggoggggggg" },
  { id: 6, score: 711, date: "03 sep", answers: "ggrggrgogrggrggrggorggrggrggrggorggrggrggrggorggrggrggrggorgggogg" },
];

function masteryStyle(state: MasteryState): MasteryCSS {
  return { "--mastery": MASTERY[state].color };
}

/**
 * Carousel-only mastery color.
 * Keeps perceived lightness/chroma steady while hue travels from red to green.
 */
function carouselMasteryColor(percentage: number) {
  const pct = Math.max(0, Math.min(100, percentage));

  // Bright mastery family from the dashboard reference:
  // critical orange → regular gold → strong lime → mastered green.
  if (pct >= 85) return "#77E637";
  if (pct >= 75) return "#ACE637";
  if (pct >= 60) return "#E6B537";
  if (pct >= 40) return "#E69A37";
  return "#E67D37";
}

function carouselMasteryStyle(percentage: number): MasteryCSS {
  return { "--mastery": carouselMasteryColor(percentage) };
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

function Sidebar({
  tourFocus,
  dark,
  collapsed,
}: {
  tourFocus: boolean;
  dark: boolean;
  collapsed: boolean;
}) {
  const nav = [
    ["Inicio", Home, "/app/inicio", ""],
    ["Aprender", Route, "/app/aprender", "Ruta"],
    ["Ensayos", Trophy, "/app/ensayos", ""],
    ["Playground", Gamepad2, "/app/playground", ""],
    ["Perfil", UserRound, "/app/perfil", ""],
  ] as const;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 0 : 264, borderRightWidth: collapsed ? 0 : 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 34 }}
      className="fixed inset-y-0 left-0 z-50 hidden border-[var(--border)] bg-[var(--surface)] lg:block"
    >
      <div className="h-full w-full overflow-hidden">
        <motion.div
          initial={false}
          animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? -18 : 0 }}
          transition={{ duration: .2 }}
          className="flex h-full w-[264px] flex-col px-5 py-5"
          aria-hidden={collapsed}
        >
          <Link href="/app/inicio" className="mb-7 flex w-full justify-center">
            <div className="w-[178px]">
              <img
                src={dark ? "/paessed-logo-dark.svg" : "/paessed-logo.svg"}
                alt="PAESSED"
                className="block h-auto w-full"
              />
              <div className="mt-1 text-[10px] font-extrabold tracking-[.16em] text-[var(--muted)]">MATEMÁTICA M1</div>
            </div>
          </Link>

          <nav className={tourFocus ? "tour-focus" : ""}>
            <div className="space-y-1.5">
              {nav.map(([label, Icon, href, badge]) => {
                const active = href === "/app/inicio";
                return (
                  <motion.div whileHover={{ x: active ? 0 : 3 }} whileTap={{ scale: 0.985 }} key={label}>
                    <Link
                      href={href}
                      tabIndex={collapsed ? -1 : undefined}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-bold transition-colors ${
                        active
                          ? "bg-[var(--primary)] text-white shadow-[0_3px_0_var(--primary-pressed)]"
                          : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                      }`}
                    >
                      <Icon size={18} />
                      <span className="flex-1">{label}</span>
                      {badge && (
                        <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider ${active ? "bg-white/20" : "bg-[var(--surface-3)] text-[var(--muted)]"}`}>
                          {badge}
                        </span>
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </nav>

          <div className="mt-auto space-y-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--muted)]">
                <ShieldCheck size={16} className="text-[var(--primary)]" />
                Modo Offline Ready
                <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,.45)]" />
              </div>
            </div>
            <p className="px-1 text-[10px] leading-4 text-[var(--muted-2)]">PAESSED adapta tu ruta con evidencia real, no con un puntaje inventado.</p>
          </div>
        </motion.div>
      </div>

    </motion.aside>
  );
}

function SidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Mostrar navegación" : "Ocultar navegación"}
      initial={false}
      animate={{
        left: collapsed ? 0 : 249,
        opacity: collapsed ? 1 : 0,
        x: collapsed ? 0 : -8,
      }}
      whileHover={{
        opacity: 1,
        x: 0,
        scale: 1.03,
      }}
      whileTap={{ scale: .96 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="fixed top-1/2 z-40 hidden h-[68px] w-[30px] -translate-y-1/2 items-center justify-center rounded-r-2xl border border-l-0 border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] shadow-[3px_0_10px_rgba(15,23,42,.08)] backdrop-blur-md hover:bg-[var(--surface-3)] hover:text-[var(--text)] lg:flex"
    >
      <motion.span
        animate={{ rotate: collapsed ? 0 : 180 }}
        transition={{ duration: .22, ease: [.22, 1, .36, 1] }}
      >
        <ChevronRight size={16} strokeWidth={2.4} />
      </motion.span>
    </motion.button>
  );
}

function HomeActions({
  dark,
  setDark,
  onTour,
  floating = false,
}: {
  dark: boolean;
  setDark: (v: boolean) => void;
  onTour: () => void;
  floating?: boolean;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const notificationOpen = useRef(false);
  const notificationTimer = useRef<number | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const toggleNotifications = () => {
    if (notificationOpen.current) {
      sileo.clear();
      notificationOpen.current = false;
      if (notificationTimer.current) window.clearTimeout(notificationTimer.current);
      return;
    }

    announce("Notificaciones", "No tienes avisos pendientes todavía.");
    notificationOpen.current = true;
    notificationTimer.current = window.setTimeout(() => {
      notificationOpen.current = false;
    }, 3000);
  };

  useEffect(() => {
    if (!profileOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    window.addEventListener("pointerdown", closeOnOutside);
    return () => window.removeEventListener("pointerdown", closeOnOutside);
  }, [profileOpen]);

  useEffect(() => {
    notificationOpen.current = false;
    if (notificationTimer.current) window.clearTimeout(notificationTimer.current);
  }, [dark]);

  useEffect(() => () => {
    if (notificationTimer.current) window.clearTimeout(notificationTimer.current);
  }, []);

  const openTour = () => {
    setProfileOpen(false);
    onTour();
  };

  return (
    <div className={`flex shrink-0 items-center gap-1.5 ${floating ? "rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] p-1.5 shadow-[var(--shadow-2)] backdrop-blur-xl" : ""}`}>
      <motion.button
        whileTap={{ scale: .92 }}
        aria-label="Notificaciones"
        onClick={toggleNotifications}
        className="soft-button relative flex h-10 w-10 items-center justify-center rounded-xl"
      >
        <Bell size={18} className="text-[var(--text)]" />
        <span className="absolute right-[9px] top-[9px] h-1.5 w-1.5 rounded-full bg-[#fb923c]" />
      </motion.button>

      <div ref={profileRef} className="relative">
        <motion.button
          whileTap={{ scale: .94 }}
          aria-label="Abrir perfil"
          aria-expanded={profileOpen}
          onClick={() => setProfileOpen((value) => !value)}
          className="soft-button grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[11px] font-extrabold text-[var(--text)]"
        >
          SB
        </motion.button>

        <AnimatePresence>
          {profileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: .97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: .98 }}
              transition={{ duration: .16, ease: [.22, 1, .36, 1] }}
              className="surface-raised absolute right-0 top-[calc(100%+10px)] z-[80] w-[300px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-extrabold text-[var(--text)]">Tu perfil</h2>
                <button type="button" aria-label="Cerrar perfil" onClick={() => setProfileOpen(false)} className="soft-button grid h-8 w-8 place-items-center rounded-lg">
                  <X size={16} />
                </button>
              </div>

              <Link href="/app/perfil" onClick={() => setProfileOpen(false)} className="mt-3 flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-[var(--surface-2)]">
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border text-[11px] font-extrabold"
                  style={{ borderColor: "color-mix(in srgb, var(--primary) 28%, var(--border))", background: "var(--surface-2)", color: "var(--text)" }}
                >
                  SB
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-[var(--text)]">Seba</div>
                  <div className="mt-0.5 text-[11px] font-medium text-[var(--muted)]">Estudiante · Matemática M1</div>
                </div>
              </Link>

              <div className="my-2 border-t border-[var(--border)]" />

              <button type="button" onClick={() => setDark(!dark)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-xs font-bold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]">
                {dark ? <Sun size={17} className="text-[#ffb86a]" /> : <Moon size={17} className="text-[var(--secondary)]" />}
                {dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              </button>

              <button type="button" onClick={openTour} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-xs font-bold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]">
                <CircleHelp size={17} className="text-[var(--muted)]" />
                Recorrido de ayuda
              </button>

              <div className="mt-2 px-2.5 pt-2 text-[10px] font-medium text-[var(--muted-2)]">Perfil de demostración</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FloatingHomeActions({
  dark,
  setDark,
  onTour,
}: {
  dark: boolean;
  setDark: (v: boolean) => void;
  onTour: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sync = () => setVisible(window.scrollY > 72);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: .96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: .97 }}
          transition={{ duration: .18, ease: [.22, 1, .36, 1] }}
          className="fixed right-4 top-3 z-[70] sm:right-6"
        >
          <HomeActions dark={dark} setDark={setDark} onTour={onTour} floating />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DashboardTopNav({
  dark,
  setDark,
  onTour,
  sidebarCollapsed,
}: {
  dark: boolean;
  setDark: (v: boolean) => void;
  onTour: () => void;
  sidebarCollapsed: boolean;
}) {
  return (
    <header className="relative z-30 h-[64px] border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] transition-[margin-left] duration-300 ease-out lg:ml-[var(--sidebar-width)]">
      <div className="mx-auto flex h-full w-full max-w-[1280px] items-center gap-2 px-4 sm:px-6">
        <AnimatePresence mode="popLayout" initial={false}>
          {sidebarCollapsed && (
            <motion.div
              key="desktop-nav-logo"
              initial={{ opacity: 0, x: -14, scale: .96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: .97 }}
              transition={{ duration: .22, ease: [.22, 1, .36, 1] }}
              className="hidden lg:block"
            >
              <Link href="/app/inicio">
                <img src={dark ? "/paessed-logo-dark.svg" : "/paessed-logo.svg"} alt="PAESSED" className="block h-auto w-[132px]" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        <Link href="/app/inicio" className="lg:hidden">
          <img src={dark ? "/paessed-logo-dark.svg" : "/paessed-logo.svg"} alt="PAESSED" className="block h-auto w-[118px]" />
        </Link>

        <div className="ml-auto">
          <HomeActions dark={dark} setDark={setDark} onTour={onTour} />
        </div>
      </div>
    </header>
  );
}

function DomainCard({ axis, onOpen, mobile = false, duplicate = false }: { axis: Axis; onOpen: (axis: Axis) => void; mobile?: boolean; duplicate?: boolean }) {
  const Icon = axis.icon;
  const critical = axis.state === "Crítico";
  const carouselColor = carouselMasteryColor(axis.percentage);
  return (
    <motion.button
      onClick={() => onOpen(axis)}
      tabIndex={duplicate ? -1 : undefined}
      whileHover={mobile ? undefined : { scale: 1.012 }}
      whileTap={{ scale: .992 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={`${mobile ? "min-w-[84vw] sm:min-w-[370px]" : "domain-card-width"} mastery-card rounded-2xl p-3.5 text-left`}
      data-critical={critical}
      style={carouselMasteryStyle(axis.percentage)}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border"
          style={{
            color: carouselColor,
            borderColor: `color-mix(in srgb, ${carouselColor} 25%, var(--border))`,
            background: `color-mix(in srgb, ${carouselColor} 10%, var(--surface))`,
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
              style={{ color: carouselColor, background: `color-mix(in srgb, ${carouselColor} 11%, var(--surface))` }}
            >
              {axis.percentage}%
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full progress-track">
        <motion.div
          className="progress-fill h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${axis.percentage}%` }}
          transition={{ duration: .8, delay: .12, ease: [.22, 1, .36, 1] }}
          style={carouselMasteryStyle(axis.percentage)}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px] leading-4">
        <span className="font-semibold" style={{ color: carouselColor }}>Estado: {axis.state}</span>
        <span className="truncate text-right text-[var(--muted)]">{axis.weakest}</span>
      </div>
    </motion.button>
  );
}

function DomainRail({ onOpen, tourFocus }: { onOpen: (a: Axis) => void; tourFocus: boolean }) {
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
  return (
    <AnimatePresence>
      {axis && (
        <>
          <motion.button
            aria-label="Cerrar detalle"
            className="fixed inset-0 z-[90] bg-slate-950/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: .92, y: 22 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: .94, y: 14 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="surface-raised fixed left-1/2 top-1/2 z-[100] w-[calc(100%-28px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-[22px] p-5 sm:p-6"
            style={masteryStyle(axis.state)}
          >
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[var(--muted)]">Detalle de dominio</p>
                  <h2 className="text-2xl font-extrabold">{axis.name}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <MasteryBadge state={axis.state} />
                    <span className="text-xs text-[var(--muted)]">{axis.evidence}</span>
                  </div>
                </div>
                <button onClick={onClose} className="soft-button grid h-9 w-9 place-items-center rounded-xl"><X size={18} /></button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-[160px_1fr]">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <div className="text-4xl font-extrabold" style={{ color: MASTERY[axis.state].color }}>{axis.percentage}%</div>
                  <div className="mt-1 text-xs font-bold text-[var(--muted)]">dominio actual</div>
                  <div className="mt-4 text-xs text-[var(--muted)]">{axis.correct} correctas de {axis.total} recientes</div>
                </div>
                <div className="space-y-2.5">
                  {axis.units.map((unit) => (
                    <div key={unit.name} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-extrabold">{unit.name}</div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full progress-track">
                          <div className="h-full rounded-full" style={{ width: `${unit.pct}%`, background: MASTERY[unit.state].color }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-extrabold" style={{ color: MASTERY[unit.state].color }}>{unit.pct}%</div>
                        <div className="text-[9px] text-[var(--muted)]">{unit.state}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-4">
                <div className="flex items-start gap-3">
                  <Sparkles size={18} className="mt-0.5 text-[var(--primary)]" />
                  <div>
                    <div className="text-xs font-extrabold">Detalle inteligente — preparado para una fase futura</div>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Aquí podrán aparecer preguntas falladas, evolución, habilidades con más errores y recomendaciones basadas en tu historial.</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => announce(`Práctica de ${axis.shortName} preparada`, "En el producto real, esto abrirá una sesión adaptativa.", "success")}
                  className="tactile-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold"
                >
                  <Play size={16} fill="currentColor" /> Practicar este eje
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DailyMission({ tourFocus }: { tourFocus: boolean }) {
  return (
    <section id="tour-mission" className={`surface-raised relative overflow-hidden rounded-[20px] p-5 sm:p-6 ${tourFocus ? "tour-focus" : ""}`}>
      <div className="relative">
        <div className="max-w-2xl">
          <p className="text-xs font-bold text-[var(--danger)]">Refuerza tu punto más débil</p>
          <h2 className="mt-1 text-[22px] font-extrabold tracking-[-.02em] sm:text-[26px]">Triángulos y Teorema de Tales</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">Cinco preguntas enfocadas en una de tus debilidades actuales para que tu progreso de hoy tenga una razón clara.</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[11px] font-bold text-[var(--muted)]"><Clock3 size={14} className="text-[var(--primary)]" /> ~6 min</span>
          <span className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[11px] font-bold text-[var(--muted)]"><Target size={14} className="text-[var(--secondary)]" /> 5 preguntas</span>
          <span className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[11px] font-bold text-[var(--muted)]"><Medal size={14} className="text-[var(--primary)]" /> +30 XP</span>
        </div>

        <motion.div whileHover={{ scale: 1.008 }} className="mt-5 w-full sm:w-fit">
          <Link
            href="/app/playground"
            className="tactile-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-xs font-extrabold sm:w-auto"
          >
            <Play size={17} fill="currentColor" /> EMPEZAR PRÁCTICA DE HOY
            <span className="rounded-md bg-black/15 px-2 py-1 text-[10px]">+30 XP</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function MonthlyGoal({ goal, setGoal }: { goal: number; setGoal: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const last = 742;
  const gap = Math.max(goal - last, 0);
  const pct = Math.min(100, Math.round((last / goal) * 100));
  return (
    <section className="surface relative rounded-[20px] p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]"><Target size={15} className="text-[var(--primary)]" /> Meta del mes</div>
          <h3 className="mt-2 text-2xl font-extrabold">{goal} pts</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">PAESSED te la propuso según tus ensayos.</p>
        </div>
        <button onClick={() => setEditing(!editing)} className="soft-button flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-extrabold"><Pencil size={13} /> Editar</button>
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold text-[var(--muted)]">Último ensayo real</div>
            <div className="mt-1 text-xl font-extrabold">{last} pts</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-[var(--muted)]">Brecha</div>
            <div className="mt-1 text-sm font-extrabold text-[var(--primary)]">+{gap} pts</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full progress-track">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: .9, ease: [.22,1,.36,1] }} className="h-full rounded-full bg-[var(--primary)]" />
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <p className="mb-2 text-[10px] font-bold text-[var(--muted)]">Elige una meta o vuelve a la sugerida.</p>
              <div className="grid grid-cols-4 gap-2">
                {[760, 780, 800, 850].map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setGoal(option);
                      setEditing(false);
                      announce("Meta mensual actualizada", `Tu nuevo objetivo es llegar a ${option} pts este mes.`, "success");
                    }}
                    className={`rounded-lg border px-2 py-2 text-[11px] font-extrabold ${goal === option ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-3)]"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ProgressMonth() {
  const points = [690, 711, 728, 742];
  const labels = ["03", "10", "16", "21 sep"];
  const min = 670;
  const max = 760;
  const coords = points.map((p, i) => ({ x: 28 + i * 98, y: 112 - ((p - min) / (max - min)) * 80 }));
  const path = coords.map((c, i) => `${i ? "L" : "M"}${c.x},${c.y}`).join(" ");
  return (
    <section className="surface rounded-[20px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">Progreso de septiembre</div>
          <h3 className="mt-1 text-lg font-extrabold">Vas +52 puntos este mes</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">Solo resultados reales de ensayos, no estimaciones del diagnóstico.</p>
        </div>
        <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-extrabold text-emerald-500">↗ +7,5%</div>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
        <svg viewBox="0 0 340 135" className="h-[135px] w-full" role="img" aria-label="Evolución de puntajes del mes">
          {[32, 72, 112].map((y) => <line key={y} x1="20" x2="330" y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />)}
          <motion.path d={path} fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: [.22,1,.36,1] }} />
          {coords.map((c, i) => (
            <g key={points[i]}>
              <circle cx={c.x} cy={c.y} r="5" fill="var(--surface)" stroke="var(--primary)" strokeWidth="3" />
              <text x={c.x} y="130" textAnchor="middle" fill="var(--muted)" fontSize="9" fontWeight="700">{labels[i]}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function LearnCard({ tourFocus }: { tourFocus: boolean }) {
  return (
    <section id="tour-learn" className={`surface relative overflow-hidden rounded-[20px] p-5 ${tourFocus ? "tour-focus" : ""}`}>
      <div className="relative">
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]"><BookOpen size={15} className="text-[var(--secondary)]" /> Aprender</div>
        <h3 className="mt-2 text-lg font-extrabold">Continúa tu ruta adaptativa</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">El modo tipo Duolingo completo vive en Aprender. Inicio solo te deja volver rápido donde quedaste.</p>

        <div className="mt-5 flex items-center justify-center gap-2">
          {["done", "done", "current", "next", "next"].map((state, i) => (
            <div key={i} className="flex items-center gap-2">
              <motion.div
                animate={state === "current" ? { scale: [1, 1.08, 1] } : undefined}
                transition={{ repeat: Infinity, duration: 2.8 }}
                className={`grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-extrabold ${state === "done" ? "border-emerald-500 bg-emerald-500 text-white" : state === "current" ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-[0_0_0_5px_color-mix(in_srgb,var(--primary)_14%,transparent)]" : "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--muted)]"}`}
              >
                {state === "done" ? <Check size={15} /> : i + 1}
              </motion.div>
              {i < 4 && <div className="h-px w-5 bg-[var(--border-strong)]" />}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
          <div>
            <div className="text-xs font-extrabold">Semejanza y proporcionalidad</div>
            <div className="mt-1 text-[10px] text-[var(--muted)]">Lección 3 de 5 · ~8 min</div>
          </div>
          <Link href="/app/aprender" className="soft-button flex items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-extrabold">Abrir <ChevronRight size={14} /></Link>
        </div>
      </div>
    </section>
  );
}

function ExamCard({ exam, previous }: { exam: (typeof exams)[number]; previous?: (typeof exams)[number] }) {
  const squares = exam.answers.split("");
  const correct = squares.filter((a) => a === "g").length;
  const wrong = squares.filter((a) => a === "r").length;
  const omitted = squares.filter((a) => a === "o").length;
  const previousCorrect = previous?.answers.split("").filter((a) => a === "g").length;
  const improvement = previousCorrect === undefined ? null : correct - previousCorrect;

  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: .992 }}
      className="group w-full rounded-[18px] border border-[var(--border)] bg-[var(--surface-2)] p-4 text-left shadow-[var(--shadow-1)] transition-[border-color,box-shadow] hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-2)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)]">
              <Trophy size={15} />
            </span>
            <div>
              <div className="text-[13px] font-extrabold">Ensayo PAES M1 #{exam.id}</div>
              <div className="mt-0.5 text-[10px] font-medium text-[var(--muted)]">{exam.date} · 65 preguntas</div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[26px] font-extrabold leading-none tracking-[-.03em]">{exam.score}<span className="ml-1 text-[10px] font-semibold text-[var(--muted)]">pts</span></div>
          <div
            className={`mt-1.5 inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold ${
              improvement === null ? "bg-[var(--surface-3)] text-[var(--muted)]" :
              improvement > 0 ? "bg-emerald-500/10 text-emerald-500" :
              improvement < 0 ? "bg-rose-500/10 text-rose-400" :
              "bg-[var(--surface-3)] text-[var(--muted)]"
            }`}
            title={previous ? `Comparado con el ensayo #${previous.id} (${previousCorrect} correctas)` : "Primer ensayo del historial mostrado"}
          >
            {improvement === null ? "Sin comparación previa" : improvement > 0
              ? `+${improvement} correctas vs. el anterior`
              : improvement < 0 ? `-${Math.abs(improvement)} correctas vs. el anterior` : "Mismas correctas que el anterior"}
          </div>
          {previous && <div className="mt-1 text-[9px] font-medium text-[var(--muted)]">respecto al ensayo #{previous.id}</div>}
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
                title={`Pregunta ${i + 1}: ${label}`}
                aria-label={`Pregunta ${i + 1}: ${label}`}
                className={`aspect-[1.35/1] min-h-[8px] rounded-[4px] ${a === "g" ? "bg-emerald-500" : a === "r" ? "bg-rose-400" : "bg-[var(--muted-2)] opacity-55"}`}
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
    </motion.button>
  );
}

function LastExams({ tourFocus }: { tourFocus: boolean }) {
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
        {exams.map((exam, index) => <ExamCard key={exam.id} exam={exam} previous={exams[index + 1]} />)}
      </div>
    </section>
  );
}

function MobileNav() {
  const items = [
    ["Inicio", Home, "/app/inicio"],
    ["Aprender", BookOpen, "/app/aprender"],
    ["Ensayos", Trophy, "/app/ensayos"],
    ["Jugar", Gamepad2, "/app/playground"],
    ["Perfil", UserRound, "/app/perfil"],
  ] as const;
  return (
    <nav className="paessed-mobile-nav fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] p-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
      {items.map(([label, Icon, href], i) => (
        <Link key={label} href={href} className={`flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[9px] font-extrabold ${i === 0 ? "bg-[var(--primary)] text-white" : "text-[var(--muted)]"}`}>
          <Icon size={17} />{label}
        </Link>
      ))}
    </nav>
  );
}

const tourSteps = [
  { key: "domains", title: "Tu dominio M1", body: "Aquí ves los cuatro ejes. El color depende de tu nivel, no del eje. Haz clic para ver detalle." },
  { key: "mission", title: "Tu misión diaria", body: "PAESSED prioriza una actividad corta usando tus debilidades y tu práctica reciente." },
  { key: "learn", title: "Tu ruta vive en Aprender", body: "Inicio muestra dónde quedaste; Aprender tendrá la experiencia completa estilo Duolingo." },
  { key: "exams", title: "Tus ensayos recalibran el perfil", body: "Los puntajes que ves aquí son resultados reales. Sirven para medir progreso sin falsa precisión." },
];

function Tour({ open, step, setStep, close }: { open: boolean; step: number; setStep: (n: number) => void; close: () => void }) {
  const reducedMotion = useReducedMotion();
  if (!open) return null;
  const item = tourSteps[step];
  return (
    <>
      <div className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-[1px]" />
      <motion.div
        data-tour-panel
        layout="position"
        initial={reducedMotion ? false : { opacity: 0, y: 18, scale: .97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          layout: { duration: reducedMotion ? 0 : .52, ease: [.22, 1, .36, 1] },
          opacity: { duration: reducedMotion ? 0 : .2 },
          y: { duration: reducedMotion ? 0 : .25 },
          scale: { duration: reducedMotion ? 0 : .25 },
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

export function Dashboard() {
  const [dark, setDarkState] = useState(false);
  const [monthlyGoal, setMonthlyGoal] = useState(780);
  const [selectedAxis, setSelectedAxis] = useState<Axis | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Only remember scrollY during the tour; no extra listeners or storage.
  const tourOrigin = useRef<number | null>(null);
  const startTour = () => {
    if (tourOrigin.current === null) tourOrigin.current = window.scrollY;
    setTourStep(0);
    setTourOpen(true);
  };

  useEffect(() => {
    const saved = localStorage.getItem("paessed-theme");
    const shouldDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkState(shouldDark);
    document.documentElement.classList.toggle("dark", shouldDark);

    const goal = Number(localStorage.getItem("paessed-monthly-goal"));
    if (goal) setMonthlyGoal(goal);

    if (!localStorage.getItem("paessed-dashboard-tour-seen")) {
      const timer = window.setTimeout(() => { if (tourOrigin.current === null) startTour(); }, 650);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const setDark = (value: boolean) => {
    sileo.clear();
    setDarkState(value);
    document.documentElement.classList.toggle("dark", value);
    localStorage.setItem("paessed-theme", value ? "dark" : "light");
  };

  const updateGoal = (value: number) => {
    setMonthlyGoal(value);
    localStorage.setItem("paessed-monthly-goal", String(value));
  };

  const closeTour = () => {
    const returnTo = tourOrigin.current;
    tourOrigin.current = null;
    setTourOpen(false);
    setTourStep(0);
    localStorage.setItem("paessed-dashboard-tour-seen", "1");
    // Wait until temporary tour-only padding/overlay are removed.
    if (returnTo !== null) {
      window.requestAnimationFrame(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: returnTo, behavior: reducedMotion ? "auto" : "smooth" });
      });
    }
  };

  const tourKey = tourOpen ? tourSteps[tourStep].key : "";

  // Keep the highlighted section between the fixed header and tour dialog.
  // This also navigates to the first section when the tour is reopened.
  useEffect(() => {
    if (!tourOpen) return;

    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById("tour-" + tourSteps[tourStep].key);
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const headerBottom = 16; // The top nav scrolls with the page; only compact actions stay floating.
      const panel = document.querySelector<HTMLElement>("[data-tour-panel]");
      // Use the final layout, not the panel's in-flight animated position.
      const panelHeight = panel?.offsetHeight ?? 0;
      const settledBottomPanelTop = window.innerHeight - 24 - panelHeight;
      const lastStep = tourStep === tourSteps.length - 1;
      // The last step places the coach panel at the TOP; position the
      // highlighted exam section immediately below the panel's bottom edge.
      const desiredTop = lastStep
        ? Math.max(headerBottom, 84 + panelHeight + 22)
        : (() => {
            const freeBottom = Math.max(headerBottom + 120, Math.min(window.innerHeight - 16, settledBottomPanelTop - 20));
            const freeHeight = Math.max(0, freeBottom - headerBottom);
            // Center small sections; align tall ones to their beginning.
            return headerBottom + Math.max(0, (freeHeight - rect.height) / 2);
          })();
      const top = Math.max(0, window.scrollY + rect.top - desiredTop);
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [tourOpen, tourStep]);

  return (
    <div className="min-h-screen bg-[var(--canvas)]" style={{ "--sidebar-width": sidebarCollapsed ? "0px" : "264px" } as CSSProperties}>
      <Toaster
        position="top-right"
        options={{
          fill: dark ? "#111827" : "#e5eeff",
          roundness: 16,
          autopilot: { expand: 0, collapse: 2400 },
          styles: {
            title: dark ? "text-slate-50! font-bold!" : "text-slate-900! font-bold!",
            description: dark ? "text-slate-300!" : "text-slate-500!",
            badge: "paessed-toast-badge",
            button: dark
              ? "bg-slate-800! text-slate-100! hover:bg-slate-700!"
              : "bg-slate-100! text-slate-900! hover:bg-slate-200!",
          },
        }}
      />
      <Sidebar tourFocus={false} dark={dark} collapsed={sidebarCollapsed} />
      <SidebarToggle collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
      <DashboardTopNav dark={dark} setDark={setDark} onTour={startTour} sidebarCollapsed={sidebarCollapsed} />
      <FloatingHomeActions dark={dark} setDark={setDark} onTour={startTour} />
      <main className="min-h-screen transition-[padding-left] duration-300 ease-out lg:pl-[var(--sidebar-width)]">
        <div
          className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-7"
          style={tourOpen && tourStep === tourSteps.length - 1 ? { paddingBottom: "max(46vh, 220px)" } : undefined}
        >
          <section className="mb-6 px-[30px]">
            <h1 className="text-[38px] font-extrabold leading-[44px] tracking-[-.035em] sm:text-[44px] sm:leading-[50px]">¡Hola, Seba! Listos para romper los {monthlyGoal} pts en M1 <motion.span className="inline-block" animate={{ y: [0, -3, 0], rotate: [0, 3, 0] }} transition={{ duration: 3.2, repeat: Infinity }}>🚀</motion.span></h1>
            <p className="mt-2 text-[14px] font-medium leading-6 text-[var(--muted)]">Mira cómo estás progresando y qué vale más la pena practicar hoy.</p>
          </section>

          <DomainRail onOpen={setSelectedAxis} tourFocus={tourKey === "domains"} />

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(290px,.75fr)]">
            <DailyMission tourFocus={tourKey === "mission"} />
            <MonthlyGoal goal={monthlyGoal} setGoal={updateGoal} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,.85fr)]">
            <ProgressMonth />
            <LearnCard tourFocus={tourKey === "learn"} />
          </div>

          <div className="mt-7">
            <LastExams tourFocus={tourKey === "exams"} />
          </div>
        </div>
      </main>

      <MobileNav />
      <AxisModal axis={selectedAxis} onClose={() => setSelectedAxis(null)} />
      <Tour open={tourOpen} step={tourStep} setStep={setTourStep} close={closeTour} />
    </div>
  );
}
