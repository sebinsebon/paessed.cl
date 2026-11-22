import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Paessed - Dashboard - Auditoría",
  description: "Paessed - Dashboard - Auditoría",
};

export default function SectionLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
