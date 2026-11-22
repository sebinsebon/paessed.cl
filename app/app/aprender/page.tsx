import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paessed - Dashboard - Aprender",
  description: "Paessed - Dashboard - Aprender",
};

import { LearnExperience } from "@/components/learning/learn-experience";

export default function LearnPage() {
  return <LearnExperience />;
}
