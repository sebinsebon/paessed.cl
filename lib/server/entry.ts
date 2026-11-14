import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authConfigured, requireAccount } from "./auth";
import { HttpError } from "./http";
import { DEV_MODE_COOKIE, devModeAvailable } from "../auth/dev-mode";

export async function devBypassActive() {
  return devModeAvailable() && (await cookies()).get(DEV_MODE_COOKIE)?.value === "1";
}

/** Read identity on the server; neither cookie existence nor local flags prove identity. */
export async function optionalAccount() {
  if (!authConfigured()) return null;
  const jar = await cookies();
  if (!jar.getAll().some(cookie => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"))) return null;
  try {
    return await requireAccount(new Request(process.env.APP_ORIGIN ?? "http://localhost"), true);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) return null;
    throw error;
  }
}

export async function redirectSignedIn() {
  if (await devBypassActive()) return;
  if (await optionalAccount()) redirect("/bienvenida");
}

export async function requireAppEntry() {
  if (await devBypassActive()) return;
  const account = await optionalAccount();
  if (!account) redirect("/login");
}
