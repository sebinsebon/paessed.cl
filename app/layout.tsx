import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "sileo/styles.css";
import { DevPanel } from "@/components/dev-panel";
import { devModeAvailable } from "@/lib/auth/dev-mode";
import { devBypassActive } from "@/lib/server/entry";
import { ThemeProvider } from "@/components/theme-provider";
import { DevModeProvider } from "@/components/dev-context";

// Session and dev-cookie decisions must be evaluated on every request, including
// deployments built before authentication credentials were provisioned.
export const dynamic = "force-dynamic";

const plusJakarta = localFont({
  src: "../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "Paessed",
  description: "Paessed - Inicio",
};

const themeBootstrap = `(() => {
  try {
    const saved = localStorage.getItem("paessed-theme");
    const dark = saved === "dark";
    document.documentElement.classList.toggle("dark", dark);
  } catch {}
})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const devAvailable = devModeAvailable();
  const devActive = devAvailable && await devBypassActive();
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        {devActive && <script dangerouslySetInnerHTML={{ __html: "window.__PAESSED_DEV_SANDBOX__ = true;" }} />}
      </head>
      <body className={plusJakarta.variable}><ThemeProvider><DevModeProvider active={devActive} available={devAvailable}>{children}{devAvailable && <DevPanel active={devActive} />}</DevModeProvider></ThemeProvider></body>
    </html>
  );
}
