/** Server-side availability only. A production deployment can never opt in. */
export function devModeAvailable(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL_ENV === "production" || env.APP_ENV === "production") return false;
  if (env.VERCEL_ENV === "preview") return env.VERCEL_GIT_COMMIT_REF === "feat/estados-carga";
  return env.PAESSED_DEV_MODE === "true" && (env.NODE_ENV === "development" || env.APP_ENV === "local");
}
export const DEV_MODE_COOKIE = "paessed-dev-mode";
