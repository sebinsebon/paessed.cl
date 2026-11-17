import { validateLearningState } from "../learning/repository.ts";
import { onboardingStatus } from "../learning/diagnostic-handoff.ts";
import type { OnboardingStatus } from "../sync/contracts.ts";
import { database, type Database } from "./db.ts";

export { onboardingStatus, validateGuestDiagnostic, incorporateGuestDiagnostic } from "../learning/diagnostic-handoff.ts";

/** Read the authoritative JSON projection, including legacy completed diagnostics. */
export async function getOnboardingStatus(userId: string, driver: Database = database()): Promise<OnboardingStatus> {
  const rows = await driver.query("select state from paessed.learning_states where owner_id=$1", [userId]);
  return onboardingStatus(rows.length ? validateLearningState(rows[0].state) : undefined);
}
