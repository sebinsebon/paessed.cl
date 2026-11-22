import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Paessed - Reportar problema",
  description: "Paessed - Reportar problema",
};

export default function SectionLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
