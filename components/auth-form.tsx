"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-provider";
import { useDevMode } from "@/components/dev-context";
import { authAction } from "@/lib/auth/client";
import styles from "./auth-form.module.css";

type TurnstileApi = { render(element: HTMLElement, options: Record<string, unknown>): string; remove(id: string): void };
export function Captcha({ onToken, reset = 0 }: { onToken: (token: string) => void; reset?: number }) {
  const { active } = useDevMode();
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const siteKey = active ? undefined : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!siteKey || !loaded || !container.current) return;
    const api = (window as Window & { turnstile?: TurnstileApi }).turnstile;
    if (!api) return;
    const id = api.render(container.current, { sitekey: siteKey, callback: onToken, "expired-callback": () => onToken(""), "error-callback": () => onToken("") });
    return () => api.remove(id);
  }, [loaded, siteKey, reset, onToken]);
  if (!siteKey) return null;
  return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setLoaded(true)} /><div ref={container} /></>;
}

export type AuthMode = "login" | "register" | "recover" | "password";
type AuthCardProps = {
  mode: AuthMode;
  accountsAvailable?: boolean;
  introduction?: ReactNode;
  returnTo?: string;
};
const titles = { login: "Inicia sesión", register: "Crea tu cuenta", recover: "Recupera tu acceso", password: "Nueva contraseña" };

function GoogleIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.4 13.91a6 6 0 0 1 0-3.82V7.5H3.06a10 10 0 0 0 0 9l3.34-2.59Z" />
    <path fill="#EA4335" d="M12 5.97c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.5l3.34 2.59C7.19 7.73 9.4 5.97 12 5.97Z" />
  </svg>;
}

export function AuthCard({ mode, accountsAvailable = true, introduction, returnTo }: AuthCardProps) {
  const { active, available } = useDevMode();
  const enabled = accountsAvailable || active;
  const [view, setView] = useState<AuthMode>(mode);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const providers = view === "login" || view === "register";
  const showFields = emailOpen || !providers;

  useEffect(() => { if (new URLSearchParams(window.location.search).has("authError")) setError("El acceso fue cancelado o el enlace ya no es válido. Vuelve a intentarlo."); }, []);

  function changeView(next: AuthMode) {
    setView(next); setPassword(""); setError(""); setMessage("");
    setCaptchaToken(""); setReset(value => value + 1);
  }

  async function run(action: string, values: Record<string, unknown>) {
    if (inFlight.current || !enabled) return;
    inFlight.current = true; setBusy(true); setError(""); setMessage("");
    try {
      if (action === "login" || action === "register" || action === "google") {
        try {
          if (returnTo === "/diagnostico") window.sessionStorage.setItem("paessed-auth-return-to", returnTo);
          else window.sessionStorage.removeItem("paessed-auth-return-to");
        }
        catch { /* Authentication can continue when browser storage is unavailable. */ }
      }
      const result = await authAction(action, values);
      if (result.url) { window.location.assign(result.url); return; }
      if (result.redirect) { window.location.assign(result.redirect); return; }
      setMessage(result.message ?? "Listo."); setPassword("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo completar la solicitud."); }
    finally { inFlight.current = false; setBusy(false); setCaptchaToken(""); setReset(value => value + 1); }
  }

  async function enableTestMode() {
    if (inFlight.current || !available) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/dev-mode", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: true }) });
      if (!response.ok) throw new Error("No se pudo activar el modo de prueba. Vuelve a intentarlo.");
      window.location.reload();
    } catch (failure) {
      inFlight.current = false;
      setError(failure instanceof Error ? failure.message : "No se pudo activar el modo de prueba.");
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const values = view === "password" ? { password } : view === "recover" ? { email, captchaToken } : view === "register" ? { email, password, name, captchaToken } : { email, password, captchaToken };
    void run(view, values);
  }

  return <section className={styles.formCard} aria-labelledby="auth-title" aria-busy={busy}>
    <h1 id="auth-title" tabIndex={-1}>{titles[view]}</h1>
    {introduction != null && <div className={styles.introduction}>{introduction}</div>}
    {!enabled && <div className={styles.notice}>
      <p role="status">Las cuentas no están disponibles en este entorno.{available ? " Puedes usar el modo de prueba." : " Inténtalo más tarde."}</p>
      {available && <button type="button" className={`soft-button ${styles.button}`} disabled={busy} onClick={() => void enableTestMode()}>{busy ? "Activando…" : "Activar modo de prueba"}</button>}
    </div>}
    {providers && <div className={styles.providers}>
      <button type="button" disabled={busy || !enabled} onClick={() => void run("google", { captchaToken })} className={`soft-button ${styles.button}`}><GoogleIcon />Continuar con Google</button>
      <div className={styles.divider}><span>o</span></div>
      {!emailOpen && <button type="button" disabled={busy || !enabled} aria-expanded={false} aria-controls="auth-email" onClick={() => setEmailOpen(true)} className={`tactile-primary ${styles.button}`}>Continuar con correo</button>}
    </div>}
    <form id="auth-email" onSubmit={submit} className={styles.form}>
      {showFields && <fieldset disabled={busy || !enabled} className={styles.fields}>
        {view === "register" && <label>Nombre<input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={event => setName(event.target.value)} className={styles.input} /></label>}
        {view !== "password" && <label>Correo<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className={styles.input} /></label>}
        {view !== "recover" && <label>Contraseña<input required type="password" minLength={8} maxLength={128} placeholder={view === "login" ? undefined : "Al menos 8 caracteres"} autoComplete={view === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} className={styles.input} /></label>}
      </fieldset>}
      {view !== "password" && <Captcha onToken={setCaptchaToken} reset={reset} />}
      {showFields && <button disabled={busy || !enabled} className={`tactile-primary ${styles.button}`}>{busy ? "Procesando…" : view === "recover" ? "Enviar enlace" : view === "password" ? "Guardar contraseña" : view === "register" ? "Crear cuenta" : "Entrar"}</button>}
    </form>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status" className={styles.message}>{message}</p>}
    <nav className={styles.links} aria-label="Opciones de cuenta">
      {providers ? <>
        <button type="button" disabled={busy} onClick={() => changeView(view === "login" ? "register" : "login")}>{view === "login" ? "Crear cuenta" : "Iniciar sesión"}</button>
        {view === "login" && showFields && <button type="button" disabled={busy} onClick={() => changeView("recover")}>Olvidé mi contraseña</button>}
      </> : <button type="button" disabled={busy} onClick={() => changeView("login")}>Volver al inicio de sesión</button>}
    </nav>
  </section>;
}

export function AuthForm({ mode, accountsAvailable = true }: { mode: AuthMode; accountsAvailable?: boolean }) {
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.backLink}><ArrowLeft size={18} aria-hidden="true" /><span>Volver</span></Link>
      <Link href="/" className={styles.brand} aria-label="Paessed, inicio"><img className={styles.logoLight} src="/paessed-logo.svg" alt="PAESSED" width="154" height="28" /><img className={styles.logoDark} src="/paessed-logo-dark.svg" alt="PAESSED" width="154" height="28" /></Link>
      <ThemeToggle />
    </header>
    <main className={styles.layout}>
      <AuthCard mode={mode} accountsAvailable={accountsAvailable} />
    </main>
    <footer className={styles.copyright}>© {new Date().getFullYear()} Paessed</footer>
  </div>;
}
