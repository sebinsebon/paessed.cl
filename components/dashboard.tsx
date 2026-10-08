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
  // Only the carousel progress fill uses this palette; the card keeps its axis color.
  const pct = Math.max(0, Math.min(100, percentage));
  const gradient =
    pct >= 85 ? "linear-gradient(90deg, #b6f35c, #64db35)" :
    pct >= 75 ? "linear-gradient(90deg, #c6ed4b, #83dc39)" :
    pct >= 60 ? "linear-gradient(90deg, #f3c64a, #c4df40)" :
    pct >= 40 ? "linear-gradient(90deg, #f6a34a, #ebca42)" :
    "linear-gradient(90deg, #ed5954, #f3953f)";

  return { "--mastery": carouselMasteryColor(pct), background: gradient };
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
  goal,
}: {
  tourFocus: boolean;
  dark: boolean;
  collapsed: boolean;
  goal: number;
}) {
  const lastScore = 742;
  const goalProgress = Math.min(100, Math.round((lastScore / goal) * 100));
  const goalGap = Math.max(goal - lastScore, 0);
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
      className="fixed inset-y-0 left-0 z-50 hidden border-r border-[var(--border)] bg-[var(--surface)] lg:block"
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

          <div className="mt-auto">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">
                <Target size={14} className="text-[var(--primary)]" />
                Meta del mes
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <div className="text-xl font-extrabold text-[var(--text)]">{goal} pts</div>
                  <div className="mt-1 text-[10px] font-medium text-[var(--muted)]">{lastScore} pts · último ensayo</div>
                </div>
                <div className="text-[10px] font-extrabold text-[var(--primary)]">+{goalGap} pts</div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-4)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${goalProgress}%` }}
                  transition={{ duration: .8, ease: [.22, 1, .36, 1] }}
                  className="h-full rounded-full bg-[var(--primary)]"
                />
              </div>
            </div>
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
  const [hovered, setHovered] = useState(false);
  const [expandedReady, setExpandedReady] = useState(!collapsed);
  const [collapsedReady, setCollapsedReady] = useState(collapsed);
  const collapseTimer = useRef<number | null>(null);

  useEffect(() => {
    setHovered(false);
    setExpandedReady(false);
    setCollapsedReady(false);

    const timer = window.setTimeout(() => {
      if (collapsed) setCollapsedReady(true);
      else setExpandedReady(true);
    }, 380);

    return () => window.clearTimeout(timer);
  }, [collapsed]);

  useEffect(() => () => {
    if (collapseTimer.current) window.clearTimeout(collapseTimer.current);
  }, []);

  const collapseSidebar = () => {
    if (!expandedReady || collapseTimer.current) return;

    setHovered(false);

    collapseTimer.current = window.setTimeout(() => {
      setExpandedReady(false);
      collapseTimer.current = null;
      onToggle();
    }, 70);
  };

  const expandSidebar = () => {
    if (!collapsedReady) return;
    setCollapsedReady(false);
    onToggle();
  };

  return (
    <>
      {expandedReady && !collapsed && (
        <>
          <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={collapseSidebar}
            className="fixed inset-y-0 left-[218px] z-[65] hidden w-[92px] cursor-pointer select-none outline-none lg:block"
            aria-hidden="true"
          />

          <motion.div
            initial={false}
            animate={{ scaleY: hovered ? 1 : 0 }}
            transition={{ duration: .16, ease: [.22, 1, .36, 1] }}
            className="pointer-events-none fixed left-[263px] top-1/2 z-[55] hidden h-[68px] w-[2px] origin-center -translate-y-1/2 bg-[var(--surface)] lg:block"
            aria-hidden="true"
          />

          <motion.div
            initial={false}
            animate={{
              x: hovered ? 0 : -30,
              boxShadow: hovered ? "3px 0 10px rgba(15,23,42,.07)" : "0 0 0 rgba(15,23,42,0)",
            }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            style={{ left: 263 }}
            className="pointer-events-none fixed top-1/2 z-40 hidden h-[68px] w-[26px] -translate-y-1/2 items-center justify-center rounded-r-[16px] border border-l-0 border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] lg:flex"
            aria-hidden="true"
          >
            <ChevronLeft size={16} strokeWidth={2.4} />
          </motion.div>
        </>
      )}

      <AnimatePresence initial={false}>
        {collapsedReady && collapsed && (
          <>
            <div
              onMouseDown={(event) => event.preventDefault()}
              onClick={expandSidebar}
              className="fixed inset-y-0 left-0 z-[65] hidden w-[56px] cursor-pointer select-none outline-none lg:block"
              aria-hidden="true"
            />

            <motion.div
              key="sidebar-collapsed-handle"
              initial={{ x: -26 }}
              animate={{ x: 0 }}
              exit={{ x: -26 }}
              transition={{ type: "spring", stiffness: 360, damping: 30 }}
              className="pointer-events-none fixed left-[-6px] top-1/2 z-40 hidden h-[68px] w-[26px] -translate-y-1/2 items-center justify-center rounded-r-[16px] border border-l-0 border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] shadow-[3px_0_10px_rgba(15,23,42,.07)] lg:flex"
              aria-hidden="true"
            >
              <ChevronRight size={16} strokeWidth={2.4} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
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
  const axisColor = MASTERY[axis.state].color;
  return (
    <motion.button
      onClick={() => onOpen(axis)}
      tabIndex={duplicate ? -1 : undefined}
      whileHover={mobile ? undefined : { scale: 1.012 }}
      whileTap={{ scale: .992 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
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
        <span className="font-semibold text-[var(--muted)]">
          Estado:{" "}
          <span
            style={{
              ...carouselMasteryStyle(axis.percentage),
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {axis.state}
          </span>
        </span>
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
    <section
      id="tour-mission"
      className={`surface-raised relative overflow-hidden rounded-[20px] p-5 sm:p-6 ${tourFocus ? "tour-focus" : ""}`}
    >
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_250px] xl:grid-cols-[minmax(0,1fr)_285px] 2xl:grid-cols-[minmax(0,1fr)_315px]">
        <div className="relative isolate flex min-w-0 flex-col justify-between lg:min-h-[306px]">
          <BookOpen
            aria-hidden="true"
            size={160}
            strokeWidth={1.6}
            className="pointer-events-none absolute -left-1 -top-3 z-0 h-36 w-36 rotate-[-10deg] text-[var(--primary)] opacity-[.07] sm:h-40 sm:w-40"
          />
          <div className="relative z-10">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">Aprender</p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--muted)]">Tu recorrido por Matemática M1</p>
            </div>
            <h2 className="mt-6 max-w-[470px] text-[24px] font-extrabold leading-[1.24] tracking-[-.025em] text-[var(--text)] sm:text-[25px]">
              Aprende siguiendo una ruta personalizada
            </h2>
            <p className="mt-3 max-w-[480px] text-sm leading-6 text-[var(--muted)]">
              Refuerza lo que necesitas, repasa a tu ritmo y avanza por cada eje de Matemática M1, paso a paso.
            </p>
          </div>

          <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: .985 }} className="relative z-10 mt-8 self-start">
            <Link
              href="/app/aprender"
              className="tactile-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[13px] font-extrabold"
            >
              <Play size={17} fill="currentColor" />
              EMPEZAR
            </Link>
          </motion.div>
        </div>

        <div className="flex h-full w-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5 lg:min-h-[306px]"> 
          <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[.11em] text-[var(--muted)]">Tu ruta de aprendizaje</p>
            <Route size={19} className="shrink-0 text-[var(--primary)]" strokeWidth={2} />
          </div>

          <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[var(--primary)]">Siguiente parada</p>
            <p className="mt-1.5 text-base font-extrabold leading-6 text-[var(--text)]">Álgebra y Funciones</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Aprende y practica a tu ritmo</p>
          </div>

          </div>
          <div className="mt-6">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-[var(--muted)]">
            <span>Explora los ejes de M1</span>
            <span className="tabular-nums">4 ejes</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2" aria-hidden="true">
            <span className="h-2 rounded-full bg-[var(--primary)]" />
            <span className="h-2 rounded-full bg-[var(--border-strong)]" />
            <span className="h-2 rounded-full bg-[var(--border-strong)]" />
            <span className="h-2 rounded-full bg-[var(--border-strong)]" />
          </div>
          <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
            Un paso a la vez, sin perder de vista lo que viene.
          </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ExamsCard({ embedded = false }: { embedded?: boolean }) {
  return (
    <section id="tour-exams-summary" className={embedded ? "relative isolate flex h-full flex-col overflow-hidden bg-transparent p-5" : "surface relative isolate flex flex-col overflow-hidden rounded-[20px] p-5"}>
      <Trophy
        aria-hidden="true"
        size={112}
        strokeWidth={1.6}
        className="pointer-events-none absolute right-[12px] top-[14px] z-0 h-28 w-28 rotate-[10deg] text-[var(--primary)] opacity-[.065]"
      />
      <div className="relative z-10">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">Ensayos</div>
          <h3 className="mt-1 text-xl font-extrabold tracking-[-.02em]">¿Listo para realizar un ensayo?</h3>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Mide tu progreso real en M1 y actualiza tu perfil de dominio con un resultado completo.</p>
        </div>
      </div>

      <div className="relative z-10 mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="text-[10px] font-bold text-[var(--muted)]">Último resultado</div>
          <div className="mt-1 text-lg font-extrabold">742 pts</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="text-[10px] font-bold text-[var(--muted)]">Formato</div>
          <div className="mt-1 text-lg font-extrabold">65 preguntas</div>
        </div>
      </div>

      <motion.div whileHover={{ scale: 1.01 }} className="relative z-10 mt-auto pt-4">
        <Link
          href="/app/ensayos"
          className="tactile-primary inline-flex min-h-[80px] w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-xs font-extrabold"
        >
          REALIZAR UN ENSAYO
          <ArrowUpRight size={16} />
        </Link>
      </motion.div>
    </section>
  );
}


function ProgressMonth({ embedded = false }: { embedded?: boolean }) {
  const points = [690, 711, 728, 742];
  const labels = ["03", "10", "16", "21 sep"];
  const min = 670;
  const max = 760;
  const coords = points.map((p, i) => ({ x: 28 + i * 98, y: 112 - ((p - min) / (max - min)) * 80 }));
  const path = coords.map((c, i) => `${i ? "L" : "M"}${c.x},${c.y}`).join(" ");
  return (
    <section id="tour-progress" className={embedded ? "h-full bg-transparent p-5" : "surface rounded-[20px] p-5"}>
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
    <section id="tour-learn" className={`surface relative isolate overflow-hidden rounded-[20px] p-5 ${tourFocus ? "tour-focus" : ""}`}>
      <Gamepad2
        aria-hidden="true"
        size={116}
        strokeWidth={1.6}
        className="pointer-events-none absolute right-[6px] top-[-2px] z-0 h-[116px] w-[116px] rotate-[8deg] text-[var(--secondary)] opacity-[.065]"
      />
      <div className="relative z-10">
        <div className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[var(--muted)]">Playground</div>
        <h3 className="mt-2 text-lg font-extrabold">Practica a tu manera</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Resuelve todas las preguntas que quieras y ajusta la práctica por año, eje temático y otros filtros.</p>

        <div className="mt-5 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
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

function DashboardCards({ missionFocus, learnFocus }: { missionFocus: boolean; learnFocus: boolean }) {
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
        <ExamsCard />
        <LearnCard tourFocus={learnFocus} />
        <ProgressMonth />
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
            <ExamsCard embedded />
          </div>
        </div>

        <div className="relative z-10 mt-4 grid gap-4 lg:grid-cols-[minmax(320px,.85fr)_minmax(0,1.4fr)]">
          <LearnCard tourFocus={learnFocus} />
          <div ref={progressRef}>
            <ProgressMonth embedded />
          </div>
        </div>
      </div>
    </>
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
  { key: "learn", title: "Practica libremente en Playground", body: "Resuelve preguntas sin límite y filtra por año, eje temático y más." },
  { key: "exams-summary", title: "Realiza ensayos completos", body: "Desde aquí puedes hacer un ensayo PAES M1, consultar tu último resultado y medir tu dominio con 65 preguntas." },
  { key: "progress", title: "Sigue la evolución de tus puntajes", body: "Este gráfico muestra cómo han cambiado tus resultados reales de ensayos durante el mes." },
  { key: "exams", title: "Tus ensayos recalibran el perfil", body: "Los puntajes que ves aquí son resultados reales. Sirven para medir progreso sin falsa precisión." },
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
        <div
          aria-hidden="true"
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

  // Scroll the currently visible (mobile/desktop) section into the safe area
  // between the top of the viewport and the tour panel.
  useEffect(() => {
    if (!tourOpen) return;

    const frame = window.requestAnimationFrame(() => {
      const target = getVisibleTourTarget(tourSteps[tourStep].key);
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
      <Sidebar tourFocus={false} dark={dark} collapsed={sidebarCollapsed} goal={monthlyGoal} />
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

          <DashboardCards missionFocus={tourKey === "mission"} learnFocus={tourKey === "learn"} />

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
