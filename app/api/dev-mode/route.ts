import { cookies } from "next/headers";
import { DEV_MODE_COOKIE, devModeAvailable } from "@/lib/auth/dev-mode";
import { handleError, HttpError, json, readJson, sameOrigin } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    if (!devModeAvailable()) throw new HttpError(404, "Ruta no encontrada.");
    sameOrigin(request);
    const data = await readJson(request, 128);
    if (!data || typeof data !== "object" || Object.keys(data).length !== 1 || !("enabled" in data) || typeof data.enabled !== "boolean") throw new HttpError(400, "Solicitud inválida.");
    const jar = await cookies();
    if (data.enabled) jar.set(DEV_MODE_COOKIE, "1", { httpOnly: true, sameSite: "strict", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 60 * 60 * 8 });
    else jar.delete(DEV_MODE_COOKIE);
    return json({ enabled: data.enabled });
  } catch (error) { return handleError(error); }
}
