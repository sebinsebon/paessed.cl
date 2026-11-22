import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paessed - Dashboard - Perfil",
  description: "Paessed - Dashboard - Perfil",
};

import { LearningProfilePage } from "@/components/learning-overview";

export default function ProfilePage() {
  return <LearningProfilePage />;
}
