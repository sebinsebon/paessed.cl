/** Server-side availability only. A production deployment can never opt in. */
export function devModeAvailable(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL_ENV === "production" || env.APP_ENV === "production") return false;
  return env.PAESSED_DEV_MODE === "true" && (env.NODE_ENV === "development" || env.VERCEL_ENV === "preview" || env.APP_ENV === "local");
}
export const DEV_MODE_COOKIE = "paessed-dev-mode";
