import type { ImportedExamRecord } from "./local-imports";
import { canonicalQuestionId } from "./question-identity.ts";

const hashes = new WeakMap<ImportedExamRecord, Promise<string>>();
const revisions = new WeakMap<ImportedExamRecord, Promise<string>>();
async function digest(bytes: ArrayBuffer): Promise<string> {
  const value = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(value), n => n.toString(16).padStart(2, "0")).join("");
}
export function personalSourceRevision(record: ImportedExamRecord): Promise<string> {
  let pending = revisions.get(record);
  if (!pending) { pending = digest(new TextEncoder().encode(JSON.stringify(record.finalJson)).buffer); revisions.set(record, pending); }
  return pending;
}
/** Hashing stays in the browser. Only this reference may enter a sync operation. */
export function personalSourceHash(record: ImportedExamRecord): Promise<string> {
  const canonical = canonicalQuestionId(record.finalJson, 1);
  if (canonical) return Promise.resolve(canonical.split(":")[1]);
  const known = record.summary.sourceHash;
  if (known && /^[a-f\d]{64}$/.test(known)) return Promise.resolve(known);
  let pending = hashes.get(record);
  if (!pending) {
    pending = (async () => {
      const bytes = record.archive ? await record.archive.arrayBuffer() : new TextEncoder().encode(JSON.stringify(record.finalJson)).buffer;
      return digest(bytes);
    })();
    hashes.set(record, pending);
  }
  return pending;
}
export function personalQuestionReference(record: ImportedExamRecord, hash: string, number: number) {
  return canonicalQuestionId(record.finalJson, number) ?? `personal:${hash}:${number}`;
}
export function originalQuestionNumber(question: unknown, index: number): number {
  const value = question && typeof question === "object" ? (question as { number?: unknown; question_number?: unknown }).number ?? (question as { question_number?: unknown }).question_number : undefined;
  const parsed = typeof value === "number" || typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 9999 ? parsed : index + 1;
}
