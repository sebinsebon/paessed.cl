import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paessed - Inicio",
  description: "Paessed - Inicio",
};

import { Landing } from "@/components/landing";
import { authConfigured } from "@/lib/server/auth";

export default async function Home() {
  return <Landing accountsAvailable={authConfigured()} />;
}
