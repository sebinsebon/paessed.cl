export type AccountInfo = {
  configured: boolean;
  user: null | { id: string; email?: string; providers: string[] };
  profile?: { displayName: string; timezone: string };
};

export async function fetchSession(signal: AbortSignal): Promise<AccountInfo> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 10_000);
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(response.status === 401 ? "Tu sesión venció. El trabajo pendiente sigue guardado en esta cuenta." : "No se pudo comprobar tu sesión.");
    const data = await response.json() as Partial<AccountInfo> | null;
    const user = data?.user;
    if (!data || user === undefined || user !== null && typeof user.id !== "string") throw new Error("La respuesta no identifica una sesión.");
    return {
      configured: data.configured === true,
      user: user && {
        id: user.id,
        email: typeof user.email === "string" ? user.email : undefined,
        providers: Array.isArray(user.providers) ? user.providers.filter(provider => typeof provider === "string") : [],
      },
      profile: user && typeof data.profile?.displayName === "string" ? {
        displayName: data.profile.displayName,
        timezone: typeof data.profile.timezone === "string" ? data.profile.timezone : "America/Santiago",
      } : undefined,
    };
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
