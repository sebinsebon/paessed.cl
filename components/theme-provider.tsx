"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

const ThemeContext = createContext({ dark: false, setDark: (_value: boolean) => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDarkState] = useState(false);
  const apply = useCallback((value: boolean) => {
    document.documentElement.classList.toggle("dark", value);
    setDarkState(value);
  }, []);
  useEffect(() => {
    const read = () => {
      try { apply(localStorage.getItem("paessed-theme") === "dark"); }
      catch { apply(document.documentElement.classList.contains("dark")); }
    };
    read();
    const storage = (event: StorageEvent) => { if (event.key === "paessed-theme" || event.key === null) read(); };
    window.addEventListener("storage", storage);
    return () => window.removeEventListener("storage", storage);
  }, [apply]);
  const setDark = useCallback((value: boolean) => {
    apply(value);
    try { localStorage.setItem("paessed-theme", value ? "dark" : "light"); } catch { /* Theme still works for the current tab. */ }
  }, [apply]);
  return <ThemeContext.Provider value={{ dark, setDark }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }

export function ThemeToggle() {
  const { dark, setDark } = useTheme();
  return <button type="button" aria-label={dark ? "Usar tema claro" : "Usar tema oscuro"} title={dark ? "Usar tema claro" : "Usar tema oscuro"} onClick={() => setDark(!dark)} className="soft-button inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>;
}
