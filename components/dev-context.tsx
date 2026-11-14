"use client";
import { createContext, useContext, type ReactNode } from "react";
const DevContext = createContext({ active: false, available: false });
export function DevModeProvider({ active, available, children }: { active: boolean; available: boolean; children: ReactNode }) {
  return <DevContext.Provider value={{ active, available }}>{children}</DevContext.Provider>;
}
export function useDevMode() { return useContext(DevContext); }
