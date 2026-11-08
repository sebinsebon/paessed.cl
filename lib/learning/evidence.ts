import { loadLearningCatalog } from "./catalog";
import { dispatchLearning } from "./repository";
import type { LearningAction } from "./types";

/** Await before exposing a key or acknowledging an external submission. */
export async function recordEvidence(action: LearningAction) {
  const catalog = await loadLearningCatalog();
  if ("questionId" in action && !catalog.some(q => q.id === action.questionId)) return;
  return dispatchLearning(action, catalog);
}
