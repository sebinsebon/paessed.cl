"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Gamepad2, Home, Moon, Route, Sun, Target, Trophy, UserRound, Zap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

const NAV = [
  { href: "/app/inicio", label: "Inicio", icon: Home },
  { href: "/app/aprender", label: "Aprender", icon: Route },
  { href: "/app/ensayos", label: "Ensayos", icon: Trophy },
  { href: "/app/playground", label: "Playground", icon: Gamepad2 },
  { href: "/app/perfil", label: "Perfil", icon: UserRound },
] as const;

function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("paessed-theme");
    const next = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("paessed-theme", next ? "dark" : "light");
  };

  return { dark, toggle };
}

export function AppShell({ children, title, eyebrow, showPageContext = true }: { children: ReactNode; title: string; eyebrow?: string; showPageContext?: boolean }) {
  const pathname = usePathname();
  const { dark, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-[var(--border)] bg-[var(--surface)] px-5 py-5 lg:flex lg:flex-col">
        <Link href="/app/inicio" className="mb-7 flex w-full justify-center">
          <div className="w-[178px]">
            <img src={dark ? "/paessed-logo-dark.svg" : "/paessed-logo.svg"} alt="PAESSED" className="block h-auto w-full" />
            <div className="mt-1 text-[10px] font-extrabold tracking-[.16em] text-[var(--muted)]">MATEMÁTICA M1</div>
          </div>
        </Link>

        <nav className="space-y-1.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            const klass = "group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition-all " +
              (active
                ? "bg-[var(--primary)] text-white shadow-[0_3px_0_var(--primary-pressed)]"
                : "text-[var(--muted)] hover:translate-x-[2px] hover:bg-[var(--surface-2)] hover:text-[var(--text)]");
            return (
              <Link key={href} href={href} className={klass}>
                <Icon size={18} />
                <span className="flex-1">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--muted)]">
              <Zap size={16} className="text-[var(--primary)]" />
              Meta diaria
              <span className="ml-auto font-extrabold text-[var(--text)]">3/5</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-4)]">
              <div className="h-full w-3/5 rounded-full bg-[var(--primary)]" />
            </div>
          </div>
          <p className="px-1 text-[10px] leading-4 text-[var(--muted-2)]">PAESSED prioriza lo que más puede mover tu resultado real.</p>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 flex h-[68px] items-center border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] px-4 backdrop-blur-xl lg:left-[264px] lg:px-6">
        <div className="mr-auto flex items-center gap-3">
          <Link href="/app/inicio" className="lg:hidden">
            <img src={dark ? "/paessed-logo-dark.svg" : "/paessed-logo.svg"} alt="PAESSED" className="h-auto w-[118px]" />
          </Link>
          <div className="hidden sm:block">
            {showPageContext && (
              <>
                {eyebrow && <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--muted)]">{eyebrow}</div>}
                <div className="text-sm font-extrabold text-[var(--text)]">{title}</div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-extrabold text-[var(--muted)] sm:flex">
            <Flame size={15} className="text-orange-500" />
            12 días
          </div>
          <div className="hidden h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-extrabold text-[var(--muted)] md:flex">
            <Target size={15} className="text-indigo-500" />
            780 pts
          </div>
          <button type="button" onClick={toggle} className="soft-button grid h-9 w-9 place-items-center rounded-full" aria-label={dark ? "Usar tema claro" : "Usar tema oscuro"}>
            {dark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
          </button>
          <Link href="/app/perfil" className="grid h-9 w-9 place-items-center rounded-full bg-[var(--secondary)] text-xs font-extrabold text-white">S</Link>
        </div>
      </header>

      <main className="min-h-screen pt-[68px] lg:pl-[264px]">
        <div className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">{children}</div>
      </main>

      <nav className="paessed-mobile-nav fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] p-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const klass = "flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[9px] font-extrabold " +
            (active ? "bg-[var(--primary)] text-white" : "text-[var(--muted)]");
          return (
            <Link key={href} href={href} className={klass}>
              <Icon size={17} />
              {label === "Playground" ? "Jugar" : label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
