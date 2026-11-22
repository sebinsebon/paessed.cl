"use client";

import { useEffect, useState } from "react";
import { getVerifiedAccount, loadAccountPresentation, watchSyncIdentity } from "@/lib/sync/client";
import { useSyncIdentity } from "./use-sync-identity";

export function useAccount(standalone = false) {
  const identity = useSyncIdentity();
  const [entryChecked, setEntryChecked] = useState(false);
  useEffect(() => {
    if (!standalone) return;
    let mounted = true;
    const stop = watchSyncIdentity(false);
    void loadAccountPresentation().then(() => { if (mounted) setEntryChecked(true); });
    return () => { mounted = false; stop(); };
  }, [standalone]);
  const ready = !standalone || entryChecked;
  return {
    account: ready && identity.status === "verified" ? getVerifiedAccount() : null,
    loading: !ready || identity.status === "checking",
  };
}
