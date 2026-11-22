import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Paessed - Dashboard - Playground",
};

import { PlaygroundExperience } from "@/components/product-pages";

export default function PlaygroundPage() {
  return <PlaygroundExperience />;
}
