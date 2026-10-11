import { PersistentAppShell } from "@/components/persistent-app-shell";
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <PersistentAppShell>{children}</PersistentAppShell>;
}
