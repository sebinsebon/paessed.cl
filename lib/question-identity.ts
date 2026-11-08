/** Identity follows the original source, not the browser import/package filename. */
export function canonicalQuestionId(data: unknown, number: number): string | null {
  if (!data || typeof data !== "object") return null;
  const sources = (data as { sources?: Array<{ id?: string; sha256?: string }> }).sources;
  if (!Array.isArray(sources)) return null;
  const hash = sources.find(s => s?.id === "exam")?.sha256;
  return typeof hash === "string" && /^[a-f\d]{64}$/i.test(hash) ? `demre:${hash.toLowerCase()}:${number}` : null;
}
