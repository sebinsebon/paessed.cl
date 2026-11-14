import { z } from "zod";
import { requireAccount } from "@/lib/server/auth";
import { expectedAccount, handleError, HttpError, json, readJson, sameOrigin } from "@/lib/server/http";
import { enforceRequestLimit, enforceProgressIpLimit } from "@/lib/server/limits";
import { createSyncService } from "@/lib/server/sync-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const resolution = z.strictObject({ choice: z.enum(["incoming", "current"]) });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    await enforceProgressIpLimit(request);
    const { user } = await requireAccount(request);
    expectedAccount(request, user.id);
    await enforceRequestLimit(request, "write", user.id);
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new HttpError(400, "Identificador de conflicto inválido.");
    const parsed = resolution.safeParse(await readJson(request, 1024));
    if (!parsed.success) throw new HttpError(400, "Elección de conflicto inválida.");
    return json(await createSyncService().resolve(user.id, id, parsed.data.choice));
  } catch (error) { return handleError(error); }
}
