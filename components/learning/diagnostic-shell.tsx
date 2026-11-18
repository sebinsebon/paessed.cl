import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-provider";
import styles from "./diagnostic-flow.module.css";

export function DiagnosticShell({ children }: { children: ReactNode }) {
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" aria-label="Paessed, inicio" className={styles.logo}>
        <img className={styles.logoLight} src="/paessed-logo.svg" alt="PAESSED" width="154" height="28" />
        <img className={styles.logoDark} src="/paessed-logo-dark.svg" alt="PAESSED" width="154" height="28" />
      </Link>
      <ThemeToggle />
    </header>
    <div className={styles.content}>{children}</div>
  </main>;
}
