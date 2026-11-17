import { LearningDiagnostic } from "@/components/learning/diagnostic";

export default async function DiagnosticPage({ searchParams }: { searchParams: Promise<{ invitado?: string }> }) {
  return <LearningDiagnostic guestDraft={(await searchParams).invitado === "1"} />;
}
