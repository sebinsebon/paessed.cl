import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  description: "Paessed - Dashboard - Ensayos",
};

export default function SectionLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
