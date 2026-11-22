/** An opaque change notice. This cookie never proves identity or grants access. */
export const SESSION_REVISION_COOKIE = "paessed-auth-revision";

export function readSessionRevision(cookies: string): string | null {
  const prefix = SESSION_REVISION_COOKIE + "=";
  return cookies.split(/;\s*/).find(cookie => cookie.startsWith(prefix))?.slice(prefix.length) ?? null;
}
