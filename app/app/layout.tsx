import { PersistentAppShell } from "@/components/persistent-app-shell";
import type { ReactNode } from "react";
import { SyncStatus } from "@/components/sync-status";
import { requireAppEntry } from "@/lib/server/entry";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireAppEntry();
  return <SyncStatus><PersistentAppShell>{children}</PersistentAppShell></SyncStatus>;
}
