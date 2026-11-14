import { LearningDiagnostic } from "@/components/learning/diagnostic";
import { redirect } from "next/navigation";
import { devBypassActive, optionalAccount } from "@/lib/server/entry";
import { getOnboardingComplete } from "@/lib/server/onboarding";

export default async function DiagnosticPage() {
  if (!await devBypassActive()) {
    const account = await optionalAccount();
    if (account && await getOnboardingComplete(account.user.id)) redirect("/bienvenida");
  }
  return <LearningDiagnostic />;
}
