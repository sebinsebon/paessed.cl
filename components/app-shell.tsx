"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePersistentAppShell } from "@/components/persistent-app-shell";

/** Page content only: navigation stays mounted in /app/layout.tsx. */
export function AppShell({
  children, title, eyebrow, wide = false,
  immersive = false, immersiveSidebarOpen = false, onImmersiveSidebarToggle,
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  wide?: boolean;
  immersive?: boolean;
  immersiveSidebarOpen?: boolean;
  onImmersiveSidebarToggle?: () => void;
}) {
  const { setImmersiveView, registerImmersiveToggle } = usePersistentAppShell();
  const toggleRef = useRef(onImmersiveSidebarToggle);
  toggleRef.current = onImmersiveSidebarToggle;

  useLayoutEffect(() => {
    return registerImmersiveToggle(() => toggleRef.current?.());
  }, [registerImmersiveToggle]);

  useLayoutEffect(() => {
    setImmersiveView(immersive, immersiveSidebarOpen);
    return () => setImmersiveView(false, false);
  }, [immersive, immersiveSidebarOpen, setImmersiveView]);

  return (
    <main
      aria-label={eyebrow ? eyebrow + " · " + title : title}
      className={(immersive ? "h-dvh overflow-hidden" : "min-h-screen") + " transition-[padding-left] duration-[240ms] ease-[cubic-bezier(.22,1,.36,1)] lg:pl-[var(--sidebar-width)]"}
    >
      <div className={immersive ? "h-full w-full min-h-0 overflow-hidden" : `mx-auto w-full px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-7 ${wide ? "max-w-none" : "max-w-[1280px]"}`}>
        {children}
      </div>
    </main>
  );
}
