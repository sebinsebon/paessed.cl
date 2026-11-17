"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { sileo, Toaster } from "sileo";
import { DashboardTopNav, MobileNav, Sidebar, SidebarToggle, useSidebarCollapsed } from "@/components/app-navigation";
import { useTheme } from "@/components/theme-provider";

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
  const { dark, setDark: setThemeDark } = useTheme();
  const [monthlyGoal, setMonthlyGoal] = useState(780);
  const [immersiveView, setImmersiveState] = useState({ immersive: false, sidebarOpen: false });
  const tourCallback = useRef<(() => void) | null>(null);
  const immersiveToggle = useRef<(() => void) | null>(null);

  useEffect(() => {
    const storedGoal = Number(localStorage.getItem("paessed-monthly-goal"));
    if (Number.isFinite(storedGoal) && storedGoal > 0) setMonthlyGoal(storedGoal);
  }, []);

  const setDark = useCallback((next: boolean) => {
    sileo.clear();
    setThemeDark(next);
  }, [setThemeDark]);

  const tourRequested = useRef(false);
  const registerTour = useCallback((callback: () => void) => {
    tourCallback.current = callback;
    if (tourRequested.current) {
      tourRequested.current = false;
      callback();
    }
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
    if (pathname === "/app/inicio" && tourCallback.current) {
      tourCallback.current();
    } else {
      tourRequested.current = true;
      router.push("/app/inicio");
    }
  };

  // Taking an essay uses the same collapsible immersive navigation as Playground.
  // The result page is fully standalone; no sidebar or mobile bar there.
  const examSession = pathname === "/app/ensayos/nuevo";
  const importedExamSession = pathname.startsWith("/app/ensayos/importado/");
  const standaloneResult = pathname === "/app/ensayos/resultado";
  const immersiveNav = examSession || importedExamSession || immersiveView.immersive;
  const visuallyCollapsed = standaloneResult || (immersiveNav ? !immersiveView.sidebarOpen : collapsed);
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
        {!standaloneResult && <Sidebar tourFocus={false} dark={dark} collapsed={visuallyCollapsed} goal={monthlyGoal} />}
        {!standaloneResult && !immersiveNav && (
          <SidebarToggle collapsed={collapsed} onToggle={toggleSidebar} />
        )}
        {!standaloneResult && !immersiveNav && (
          <DashboardTopNav dark={dark} setDark={setDark} onTour={openTour} sidebarCollapsed={collapsed} />
        )}
        {children}
        {!standaloneResult && !immersiveNav && <MobileNav />}
      </div>
    </AppNavigationContext.Provider>
  );
}
