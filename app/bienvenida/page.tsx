import { redirect } from "next/navigation";
import { OnboardingHandoff } from "@/components/onboarding-handoff";
import { devBypassActive, optionalAccount } from "@/lib/server/entry";
import { DevWelcome } from "@/components/dev-welcome";

export const dynamic = "force-dynamic";
export default async function WelcomePage() {
  if (await devBypassActive()) return <DevWelcome />;
  const account = await optionalAccount();
  if (!account) redirect("/login");
  // Check guest IndexedDB in the handoff before routing an empty account to a
  // new diagnostic. The guest's completed answers survive sign-in unchanged.
  return <OnboardingHandoff ownerId={account.user.id} />;
}
