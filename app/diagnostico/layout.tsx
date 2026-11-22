import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Paessed - Diagnóstico",
  description: "Paessed - Diagnóstico",
};

export default function SectionLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
