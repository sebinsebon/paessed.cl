"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authAction, getAccount, type AccountInfo } from "@/lib/auth/client";
import { getSyncOwner } from "@/lib/sync/local";
import { sileo } from "sileo";
import { LoadingRegion, PendingLabel, Skeleton } from "./loading-state";
import { Captcha } from "./auth-form";

export function AccountPanel() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const lock = useRef(false);
  const busy = actionInFlight !== null;
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    getAccount().then(value => { if (live) { setAccount(value); setName(value.profile?.displayName ?? ""); } })
      .catch(failure => { if (live) setError(failure.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [loadAttempt]);
  async function run(action: string, values: Record<string, unknown> = {}) {
    if (lock.current) return;
    lock.current = true;
    setActionInFlight(action); setMessage(""); setError("");
    try {
      const result = await authAction(action, values);
      if (result.url) { window.location.assign(result.url); return; }
      if (action === "logout" || action === "delete") { window.location.assign("/login"); return; }
      if (action === "profile") sileo.success({ title: result.message ?? "Perfil guardado" });
      else setMessage(result.message ?? "Listo.");
      setPassword("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo completar la solicitud."); }
    finally { lock.current = false; setActionInFlight(null); setCaptchaToken(""); setCaptchaReset(value => value + 1); }
  }
  const button = "rounded-xl border border-[var(--border)] px-4 py-2.5 text-xs font-bold disabled:opacity-50";
  const input = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm";
  return <section aria-labelledby="account-title" className="surface-raised rounded-2xl p-5 sm:p-6">
    <h2 id="account-title" className="text-lg font-extrabold">Tu cuenta</h2>
    {account?.user ? <>
      <p className="mt-2 text-sm text-[var(--muted)]">{account.user.email}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">Accesos vinculados: {account.user.providers.map(p => p === "email" ? "correo y contraseña" : p === "google" ? "Google" : p).join(", ")}</p>
      <form className="mt-5 space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); void run("profile", { displayName: name, timezone: "America/Santiago" }); }}>
        <label className="block text-xs font-bold">Nombre<input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} className={`mt-2 ${input}`} autoComplete="name" /></label>
        <p className="text-xs text-[var(--muted)]">Zona horaria de tu progreso: America/Santiago.</p>
        <button disabled={busy} className={button}><PendingLabel pending={actionInFlight === "profile"} label="Guardando…">Guardar perfil</PendingLabel></button>
      </form>
      <div className="mt-6 border-t border-[var(--border)] pt-5">
        <h3 className="text-sm font-bold">Confirma tu identidad</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Para vincular Google o eliminar la cuenta, inicia sesión nuevamente o confirma aquí. La confirmación dura cinco minutos.</p>
        {account.user.providers.includes("email") && <form className="mt-3 flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void run("reauth", { password, captchaToken }); }}>
          <label className="grow text-xs"><span className="sr-only">Contraseña actual</span><input required type="password" minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} placeholder="Contraseña actual" autoComplete="current-password" className={input} /></label>
          <button disabled={busy} className={button}>Confirmar identidad</button>
        </form>}
        <div className="mt-3"><Captcha onToken={setCaptchaToken} reset={captchaReset} /></div>
        <div className="mt-3 flex flex-wrap gap-2">
          {account.user.providers.includes("google") ? <button disabled={busy} className={button} onClick={() => void run("reauth-google", { captchaToken })}>Confirmar con Google</button> : <button disabled={busy} className={button} onClick={() => void run("link-google")}>Vincular Google</button>}
          <button disabled={busy || !account.user.email} className={button} onClick={() => void run("recover", { email: account.user!.email, captchaToken })}>{account.user.providers.includes("email") ? "Cambiar contraseña por correo" : "Añadir contraseña por correo"}</button>
          <button disabled={busy} className={button} onClick={() => void run("logout")}>Cerrar sesión</button>
        </div>
      </div>
      <details className="mt-6 border-t border-[var(--border)] pt-4">
        <summary className="cursor-pointer text-xs font-bold text-red-600">Eliminar mi cuenta</summary>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Se eliminará el progreso remoto y se revocarán las sesiones. Tus archivos personales en este dispositivo se conservarán. Escribe ELIMINAR y confirma tu identidad antes de continuar.</p>
        <input aria-label="Confirmar eliminación de cuenta" value={confirmation} onChange={event => setConfirmation(event.target.value)} className={`mt-3 ${input}`} autoComplete="off" />
        <button disabled={busy || confirmation !== "ELIMINAR"} onClick={() => void run("delete", { confirmation })} className={`mt-3 text-red-600 ${button}`}>Eliminar cuenta definitivamente</button>
      </details>
    </> : account ? <div className="mt-3 text-sm leading-6 text-[var(--muted)]"><p>Estás practicando como invitado. Tu progreso se guarda en este dispositivo.</p><div className="mt-4 flex gap-4 text-xs font-bold text-[var(--primary)]"><Link href="/login">Iniciar sesión</Link><Link href="/registro">Crear cuenta</Link></div></div> : loading ? <LoadingRegion label="Comprobando la cuenta…" className={getSyncOwner() ? "mt-3 min-h-[375px]" : "mt-3 min-h-16"}>
      <Skeleton className="h-4 w-48 max-w-full" />
      <Skeleton className="mt-2 h-3 w-64 max-w-full" />
      {getSyncOwner() && <>
        <Skeleton className="mt-5 h-10 w-full rounded-xl" />
        <Skeleton className="mt-3 h-9 w-32 rounded-xl" />
        <div className="mt-6 grid gap-3 border-t border-[var(--border)] pt-5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </>}
    </LoadingRegion> : <button type="button" className={`mt-3 ${button}`} onClick={() => { setError(""); setLoading(true); setLoadAttempt(value => value + 1); }}>Reintentar</button>}
    {error && <p role="alert" className="mt-4 text-sm text-red-600">{error} <Link href="/login" className="underline">Iniciar sesión</Link></p>}
    {message && <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p>}
  </section>;
}
