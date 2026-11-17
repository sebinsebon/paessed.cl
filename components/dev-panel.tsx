"use client";

import { useEffect, useState } from "react";
import { Code2, X } from "lucide-react";
import { usePathname } from "next/navigation";

export function DevPanel({ active }: { active: boolean }) {
  const appPage = usePathname().startsWith("/app/");
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [accounts, setAccounts] = useState<Array<{ id: string; email: string; name: string }>>([]), [selected, setSelected] = useState("");
  useEffect(() => {
    if (!active) return;
    const read = async () => {
      try {
        const api = await import("@/lib/auth/dev-accounts");
        setAccounts(api.listDevAccounts());
        setSelected(api.selectedDevAccount()?.id ?? "");
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "No se pudieron leer las cuentas de prueba.");
      }
    };
    void read(); window.addEventListener("paessed-account-change", read);
    return () => window.removeEventListener("paessed-account-change", read);
  }, [active]);
  async function run(work: () => Promise<void>) {
    setBusy(true); setError("");
    try { await work(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Intenta nuevamente."); setBusy(false); }
  }
  async function navigate(href: string, enabled = true) {
    await run(async () => {
      const response = await fetch("/api/dev-mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
      if (!response.ok) throw new Error("No se pudo cambiar el modo dev.");
      window.location.assign(href);
    });
  }
  const button = "soft-button min-h-10 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-40";
  return <aside className={`fixed ${appPage ? "bottom-28 lg:bottom-5" : "bottom-4"} right-4 z-[59] text-sm text-[var(--text)]`} aria-label="Herramientas de desarrollo">
    {open && <div id="paessed-dev-panel" className="mb-3 w-[min(330px,calc(100vw-32px))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg">
      <div className="flex items-center justify-between"><strong>Modo dev</strong><button aria-label="Cerrar herramientas" onClick={() => setOpen(false)} className="p-2"><X size={18} /></button></div>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{active ? "Datos y cuentas de prueba. Sin conexión a servicios reales." : "Los atajos activan un entorno de prueba separado."}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">{[["Portada", "/"], ["Diagnóstico", "/diagnostico"], ["Dashboard", "/app/inicio"], ["Aprender", "/app/aprender"], ["Acceso", "/login"], ["Registro", "/registro"]].map(([label, href]) => <button key={href} disabled={busy} onClick={() => void navigate(href)} className={button}>{label}</button>)}</div>
      {active && <>
        <label className="mt-5 block text-xs font-bold">Cuenta de prueba<select aria-label="Cuenta de prueba" disabled={busy} value={selected} onChange={event => { const value = event.target.value; void run(async () => { (await import("@/lib/auth/dev-accounts")).switchDevAccount(value || null); window.location.assign("/app/inicio"); }); }} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs"><option value="">Sin cuenta</option>{accounts.map(account => <option value={account.id} key={account.id}>{account.name} · {account.email}</option>)}</select></label>
        <button disabled={busy} className={`${button} mt-3 w-full`} onClick={() => void run(async () => { await (await import("@/lib/auth/dev-accounts")).loadDevProgressFixture(); window.location.assign("/app/inicio"); })}>Usar cuenta con progreso</button>
        <button disabled={busy} className="tactile-primary mt-4 min-h-10 w-full rounded-xl px-3 py-2 text-xs font-bold" onClick={() => void navigate("/", false)}>Salir del modo dev</button>
      </>}
      {error && <p role="alert" className="mt-3 text-xs text-[var(--danger)]">{error}</p>}
    </div>}
    <button aria-expanded={open} aria-controls="paessed-dev-panel" onClick={() => setOpen(value => !value)} className="soft-button flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold"><Code2 size={17} />{active ? "DEV · activo" : "DEV"}</button>
  </aside>;
}
