"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { getInitialSyncIdentity, getSyncIdentity, matchesBrowserSession, recheckBrowserSession, subscribeSyncIdentity } from "@/lib/sync/client";

export function useSyncIdentity() {
  const pathname = usePathname();
  const identity = useSyncExternalStore(subscribeSyncIdentity, getSyncIdentity, getInitialSyncIdentity);
  const matches = identity.status !== "verified" || matchesBrowserSession();
  useLayoutEffect(() => { recheckBrowserSession(); }, [pathname, identity, matches]);
  return matches ? identity : { status: "checking" as const, epoch: identity.epoch };
}
