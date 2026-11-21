"use client";

import { useSyncExternalStore } from "react";
import { getInitialSyncIdentity, getSyncIdentity, subscribeSyncIdentity } from "@/lib/sync/client";

export function useSyncIdentity() {
  return useSyncExternalStore(subscribeSyncIdentity, getSyncIdentity, getInitialSyncIdentity);
}
