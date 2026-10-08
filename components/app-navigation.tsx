"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { sileo } from "sileo";
import { Bell, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Gamepad2, Home, Moon, Route, Sun, Target, Trophy, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function announce(title: string, subtitle: string, variant: "info" | "success" = "info") {
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


let lastSidebarCollapsed = false;
let sidebarPreferenceRead = false;

/** Persist collapse state across routes and browser reloads. */
export function useSidebarCollapsed(): readonly [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(lastSidebarCollapsed);
  useEffect(() => {
    if (!sidebarPreferenceRead) {
      sidebarPreferenceRead = true;
      lastSidebarCollapsed = localStorage.getItem("paessed-sidebar-collapsed") === "1";
    }
    setCollapsed(lastSidebarCollapsed);
  }, []);
  const toggle = () => {
    setCollapsed((value) => {
      const next = !value;
      lastSidebarCollapsed = next;
      localStorage.setItem("paessed-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  };
  return [collapsed, toggle] as const;
}

export function Sidebar({
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
  const pathname = usePathname();
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
                const active = pathname === href || pathname.startsWith(href + "/");
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

export function SidebarToggle({
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

export function FloatingHomeActions({
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

export function DashboardTopNav({
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


export function MobileNav() {
  const pathname = usePathname();
  const items = [
    ["Inicio", Home, "/app/inicio"],
    ["Aprender", BookOpen, "/app/aprender"],
    ["Ensayos", Trophy, "/app/ensayos"],
    ["Jugar", Gamepad2, "/app/playground"],
    ["Perfil", UserRound, "/app/perfil"],
  ] as const;
  return (
    <nav className="paessed-mobile-nav fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] p-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
      {items.map(([label, Icon, href]) => (
        <Link key={label} href={href} className={`flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[9px] font-extrabold ${pathname === href || pathname.startsWith(href + "/") ? "bg-[var(--primary)] text-white" : "text-[var(--muted)]"}`}>
          <Icon size={17} />{label}
        </Link>
      ))}
    </nav>
  );
}

