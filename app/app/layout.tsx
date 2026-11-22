import type { Metadata } from "next";
import { PersistentAppShell } from "@/components/persistent-app-shell";
import type { ReactNode } from "react";
import { SyncStatus } from "@/components/sync-status";
import { requireAppEntry } from "@/lib/server/entry";

export const metadata: Metadata = {
  title: "Paessed - Dashboard",
  description: "Paessed - Dashboard",
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireAppEntry();
  return <PersistentAppShell><SyncStatus>{children}</SyncStatus></PersistentAppShell>;
}
