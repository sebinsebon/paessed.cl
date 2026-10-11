"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { sileo, Toaster } from "sileo";
import { DashboardTopNav, MobileNav, Sidebar, SidebarToggle, useSidebarCollapsed } from "@/components/app-navigation";

type AppNavigationContextValue = {
  dark: boolean;
  setDark: (next: boolean) => void;
  monthlyGoal: number;
  registerTour: (callback: () => void) => () => void;
  setImmersiveView: (immersive: boolean, sidebarOpen: boolean) => void;
  registerImmersiveToggle: (callback: () => void) => () => void;
};

const AppNavigationContext = createContext<AppNavigationContextValue | null>(null);

export function usePersistentAppShell() {
  const context = useContext(AppNavigationContext);
  if (!context) throw new Error("PAESSED navigation must be inside /app layout");
  return context;
}

/**
 * This layout is retained by Next.js during navigation inside /app.
 * Keeping the sidebar and top bar mounted prevents route changes from
 * resetting their geometry, animations, and collapse state.
 */
export function PersistentAppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, toggleSidebar] = useSidebarCollapsed();
  const [dark, setDarkState] = useState(false);
  const [monthlyGoal, setMonthlyGoal] = useState(780);
  const [immersiveView, setImmersiveState] = useState({ immersive: false, sidebarOpen: false });
  const tourCallback = useRef<(() => void) | null>(null);
  const immersiveToggle = useRef<(() => void) | null>(null);

  useEffect(() => {
    const storedTheme = localStorage.getItem("paessed-theme");
    const nextDark = storedTheme
      ? storedTheme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkState(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);

    const storedGoal = Number(localStorage.getItem("paessed-monthly-goal"));
    if (Number.isFinite(storedGoal) && storedGoal > 0) setMonthlyGoal(storedGoal);
  }, []);

  const setDark = useCallback((next: boolean) => {
    sileo.clear();
    setDarkState(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("paessed-theme", next ? "dark" : "light");
  }, []);

  const registerTour = useCallback((callback: () => void) => {
    tourCallback.current = callback;
    return () => {
      if (tourCallback.current === callback) tourCallback.current = null;
    };
  }, []);

  const setImmersiveView = useCallback((immersive: boolean, sidebarOpen: boolean) => {
    setImmersiveState((previous) =>
      previous.immersive === immersive && previous.sidebarOpen === sidebarOpen
        ? previous
        : { immersive, sidebarOpen }
    );
  }, []);

  const registerImmersiveToggle = useCallback((callback: () => void) => {
    immersiveToggle.current = callback;
    return () => {
      if (immersiveToggle.current === callback) immersiveToggle.current = null;
    };
  }, []);

  const openTour = () => {
    localStorage.removeItem("paessed-dashboard-tour-seen");
    if (pathname === "/app/inicio" && tourCallback.current) {
      tourCallback.current();
    } else {
      router.push("/app/inicio");
    }
  };

  // Dedicated exam-taking routes have their own fullscreen header and controls.
  // Keep the persistent shell mounted without adding navigation to those pages.
  const standaloneExam = pathname === "/app/ensayos/nuevo" || pathname === "/app/ensayos/resultado";
  const visuallyCollapsed = standaloneExam || (immersiveView.immersive ? !immersiveView.sidebarOpen : collapsed);
  const context: AppNavigationContextValue = {
    dark, setDark, monthlyGoal, registerTour, setImmersiveView, registerImmersiveToggle,
  };

  return (
    <AppNavigationContext.Provider value={context}>
      <div className="min-h-screen bg-[var(--canvas)]" style={{ "--sidebar-width": visuallyCollapsed ? "0px" : "264px" } as CSSProperties}>
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
              button: dark ? "bg-slate-800! text-slate-100! hover:bg-slate-700!" : "bg-slate-100! text-slate-900! hover:bg-slate-200!",
            },
          }}
        />
        {!standaloneExam && <Sidebar tourFocus={false} dark={dark} collapsed={visuallyCollapsed} goal={monthlyGoal} />}
        {!standaloneExam && (!immersiveView.immersive || immersiveToggle.current) && (
          <SidebarToggle
            collapsed={visuallyCollapsed}
            onToggle={immersiveView.immersive
              ? () => immersiveToggle.current?.()
              : toggleSidebar}
          />
        )}
        {!standaloneExam && !immersiveView.immersive && (
          <DashboardTopNav dark={dark} setDark={setDark} onTour={openTour} sidebarCollapsed={collapsed} />
        )}
        {children}
        {!standaloneExam && !immersiveView.immersive && <MobileNav />}
      </div>
    </AppNavigationContext.Provider>
  );
}
