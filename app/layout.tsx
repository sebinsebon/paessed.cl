import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "sileo/styles.css";

const plusJakarta = localFont({
  src: "../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "PAESSED — Prepárate para la PAES M1",
  description: "Diagnóstico, práctica adaptativa, ensayos y progreso para Matemática M1.",
};

const themeBootstrap = `(() => {
  try {
    const saved = localStorage.getItem("paessed-theme");
    const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch {}
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className={plusJakarta.variable}>{children}</body>
    </html>
  );
}
