import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Paessed - Dashboard - Perfil",
};

import { LearningProfilePage } from "@/components/learning-overview";

export default function ProfilePage() {
  return <LearningProfilePage />;
}
