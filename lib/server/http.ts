import { HttpError } from "../http-error.ts";
export { HttpError } from "../http-error.ts";
export function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
export function handleError(error: unknown): Response {
  if (error instanceof HttpError) {
    const response = json({ error: error.message }, error.status);
    if (error.retryAfter) response.headers.set("Retry-After", String(Math.max(1, Math.ceil(error.retryAfter))));
    return response;
  }
  // Never log request bodies, credentials, OAuth codes or database error details.
  return json({ error: "No se pudo completar la solicitud. Tu progreso local sigue guardado." }, 503);
}
export function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const local = !process.env.VERCEL_ENV && process.env.APP_ENV !== "production" && ["127.0.0.1", "localhost"].includes(url.hostname);
  const expected = process.env.APP_ORIGIN ?? (local ? url.origin : null);
  if (!origin || origin !== expected || request.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Origen no permitido.");
}
/** An assertion prevents a queued operation from one tab following another tab's new cookies. */
export function expectedAccount(request: Request, ownerId: string): void {
  if (request.headers.get("x-paessed-account") !== ownerId) throw new HttpError(409, "La cuenta cambió en otra pestaña. Tu progreso sigue guardado. Vuelve a abrir esta cuenta.");
}
/** Count actual stream bytes. Content-Length is only an early rejection hint. */
export async function readJson(request: Request, max = 256 * 1024): Promise<unknown> {
  if (request.headers.has("content-encoding")) throw new HttpError(400, "No se admiten cuerpos comprimidos.");
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) throw new HttpError(400, "Se requiere JSON UTF-8.");
  const announced = request.headers.get("content-length");
  if (announced && (!/^\d+$/.test(announced) || Number(announced) > max)) throw new HttpError(413, "La solicitud supera el tamaño permitido.");
  if (!request.body) throw new HttpError(400, "Falta el cuerpo JSON.");
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); throw new HttpError(413, "La solicitud supera el tamaño permitido."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new HttpError(400, "JSON UTF-8 inválido."); }
  // Bound parser nesting before JSON.parse allocates a deep structure.
  let depth = 0, quoted = false, escaped = false;
  for (const char of text) {
    if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quoted = false; }
    else if (char === '"') quoted = true;
    else if (char === "{" || char === "[") { if (++depth > 16) throw new HttpError(400, "JSON demasiado profundo."); }
    else if (char === "}" || char === "]") depth--;
  }
  try { return JSON.parse(text); } catch { throw new HttpError(400, "JSON inválido."); }
}
