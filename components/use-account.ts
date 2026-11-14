"use client";

import { useEffect, useState } from "react";
import { getAccount, type AccountInfo } from "@/lib/auth/client";

export function useAccount() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true, revision = 0;
    const refresh = async () => {
      const current = ++revision;
      try { const value = await getAccount(); if (live && current === revision) setAccount(value); }
      catch { if (live && current === revision) setAccount(null); }
      finally { if (live && current === revision) setLoading(false); }
    };
    void refresh();
    window.addEventListener("paessed-account-change", refresh);
    window.addEventListener("paessed-auth-signed-out", refresh);
    return () => { live = false; window.removeEventListener("paessed-account-change", refresh); window.removeEventListener("paessed-auth-signed-out", refresh); };
  }, []);
  return { account, loading };
}
