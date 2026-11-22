import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paessed - Dashboard - Inicio",
  description: "Paessed - Dashboard - Inicio",
};

import { DashboardHome } from "@/components/dashboard-home";

export default function AppHomePage() {
  return <DashboardHome />;
}
