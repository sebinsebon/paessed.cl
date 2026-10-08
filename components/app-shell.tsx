"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { sileo, Toaster } from "sileo";
import { DashboardTopNav, MobileNav, Sidebar, SidebarToggle, useSidebarCollapsed } from "@/components/app-navigation";

function useAppTheme() {
  const [dark, setDarkState] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("paessed-theme");
    const next = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkState(next);
    document.documentElement.classList.toggle("dark", next);
  }, []);
  const setDark = (next: boolean) => {
    sileo.clear();
    setDarkState(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("paessed-theme", next ? "dark" : "light");
  };
  return { dark, setDark };
}

export function AppShell({ children, title, eyebrow, wide = false }: { children: ReactNode; title: string; eyebrow?: string; wide?: boolean }) {
  const router = useRouter();
  const { dark, setDark } = useAppTheme();
  const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed();
  const [monthlyGoal, setMonthlyGoal] = useState(780);

  useEffect(() => {
    const stored = Number(localStorage.getItem("paessed-monthly-goal"));
    if (Number.isFinite(stored) && stored > 0) setMonthlyGoal(stored);
  }, []);

  const openTour = () => {
    localStorage.removeItem("paessed-dashboard-tour-seen");
    router.push("/app/inicio");
  };

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
            button: dark ? "bg-slate-800! text-slate-100! hover:bg-slate-700!" : "bg-slate-100! text-slate-900! hover:bg-slate-200!",
          },
        }}
      />
      <Sidebar tourFocus={false} dark={dark} collapsed={sidebarCollapsed} goal={monthlyGoal} />
      <SidebarToggle collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <DashboardTopNav dark={dark} setDark={setDark} onTour={openTour} sidebarCollapsed={sidebarCollapsed} />
      <main
        aria-label={eyebrow ? eyebrow + " · " + title : title}
        className="min-h-screen transition-[padding-left] duration-300 ease-out lg:pl-[var(--sidebar-width)]"
      >
        <div className={`mx-auto w-full px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-7 ${wide ? "max-w-none" : "max-w-[1280px]"}`}>{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
