export const PRODUCTION_PROJECT = "byihttktkhpiqkhobpsr";
export const PRODUCTION_ORIGIN = "https://paesseduiux-zeta.vercel.app";
const TEST_PROJECT = "rqeuczrmkkehxzipkynq";

export function connectsToSupabaseProject(value: string | undefined, project: string): boolean {
  try {
    const url = new URL(value ?? "");
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return false;
    return url.hostname === `db.${project}.supabase.co` ||
      (url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username).endsWith(`.${project}`));
  } catch { return false; }
}

export function permitsBackend(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL_ENV !== "preview" && env.APP_ENV !== "preview") return true;
  return env.NEXT_PUBLIC_SUPABASE_URL === `https://${TEST_PROJECT}.supabase.co` &&
    !!env.APP_ORIGIN && env.APP_ORIGIN !== PRODUCTION_ORIGIN &&
    connectsToSupabaseProject(env.DATABASE_URL, TEST_PROJECT);
}
