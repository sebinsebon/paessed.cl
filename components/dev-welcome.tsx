"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initializeSyncIdentity, readCompletedGuestDiagnostic } from "@/lib/sync/client";
import { OnboardingHandoff } from "./onboarding-handoff";
import { takeAuthReturnTo } from "@/lib/auth/return-to";

export function DevWelcome() {
  const router = useRouter();
  const [owner, setOwner] = useState<string | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void (async () => {
      const identity = await initializeSyncIdentity();
      if (!live) return;
      if (!identity.owner || !await readCompletedGuestDiagnostic()) { router.replace(takeAuthReturnTo()); return; }
      if (live) setOwner(identity.owner);
    })().catch(failure => { if (live) setError(failure instanceof Error ? failure.message : "No se pudo preparar la cuenta de prueba."); });
    return () => { live = false; };
  }, [router]);
  if (error) return <main className="mx-auto max-w-lg px-6 py-20" role="alert"><p>{error}</p><a className="mt-4 inline-block text-[var(--primary)]" href="/login">Volver al acceso</a></main>;
  return owner ? <OnboardingHandoff ownerId={owner} /> : <p role="status" className="p-8 text-center text-[var(--muted)]">Preparando tu cuenta de prueba…</p>;
}
