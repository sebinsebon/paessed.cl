"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { DomainCarousel } from "./landing/domain-carousel";
import { LandingFeatures } from "./landing/features";
import { ThemeToggle } from "./theme-provider";
import styles from "./landing/landing.module.css";
import { useAccount } from "./use-account";
import { AuthDialog } from "./auth-dialog";

export function Landing({ accountsAvailable = true }: { accountsAvailable?: boolean }) {
  const { account, loading } = useAccount(true);
  const [auth, setAuth] = useState<"login" | "register" | null>(null);
  const [diagnostic, setDiagnostic] = useState(false);
  const openLogin = () => { setDiagnostic(false); setAuth("login"); };
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/" aria-label="Paessed, inicio"><img className={styles.logoLight} src="/paessed-logo.svg" alt="PAESSED" width="166" height="31" /><img className={styles.logoDark} src="/paessed-logo-dark.svg" alt="PAESSED" width="166" height="31" /></Link>
      <nav aria-label="Navegación principal"><ThemeToggle />
        {account?.user ? <><Link className={`soft-button ${styles.accountButton}`} href="/app/inicio">Ir al dashboard</Link><Link href="/app/perfil" className={`soft-button ${styles.profile}`} aria-label={`Mi perfil, ${account.profile?.displayName || account.user.email || "sesión iniciada"}`} title={account.profile?.displayName || account.user.email}><img src="/emoji-apple/1f464.png" width="26" height="26" alt="" /></Link></> : <button type="button" disabled={loading} className={`soft-button ${styles.accountButton}`} onClick={openLogin}>Ya tengo cuenta</button>}
      </nav>
    </header>
    <main className={styles.main}>
      <div className={styles.hero}>
        <section className={styles.heroCopy} aria-labelledby="landing-title">
          <h1 id="landing-title">Tu preparación empieza por <span>conocerte.</span></h1>
          <p>Practica Matemática M1 con una ruta que se adapta a tus respuestas.</p>
          {account?.user ? <Link href="/diagnostico" className={`tactile-primary ${styles.primaryButton}`}>Empezar mi diagnóstico <ArrowRight size={18} /></Link> : <button type="button" disabled={loading} onClick={() => { setDiagnostic(true); setAuth("register"); }} className={`tactile-primary ${styles.primaryButton}`}>Empezar mi diagnóstico <ArrowRight size={18} /></button>}
        </section>
        <DomainCarousel />
      </div>
      <LandingFeatures />
    </main>
    <footer className={styles.footer}><span>© {new Date().getFullYear()} Paessed</span><nav aria-label="Enlaces del pie de página"><Link href="/reportar">Reportar un problema</Link>{account?.user ? <Link href="/app/perfil">Mi perfil</Link> : <button type="button" onClick={openLogin}>Iniciar sesión</button>}</nav></footer>
    {auth && <AuthDialog mode={auth} diagnostic={diagnostic} accountsAvailable={accountsAvailable} onDismiss={() => setAuth(null)} />}
  </div>;
}
