import { requireAccount } from "@/lib/server/auth";
import { expectedAccount, handleError, HttpError, json, readJson, sameOrigin } from "@/lib/server/http";
import { enforceProgressIpLimit, enforceRequestLimit } from "@/lib/server/limits";
import { getOnboardingStatus } from "@/lib/server/onboarding";
import { createSyncService } from "@/lib/server/sync-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await enforceProgressIpLimit(request);
    const { user } = await requireAccount(request);
    expectedAccount(request, user.id);
    await enforceRequestLimit(request, "read", user.id);
    if (new URL(request.url).search) throw new HttpError(400, "Parámetro no permitido.");
    return json(await getOnboardingStatus(user.id));
  } catch (error) { return handleError(error); }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await enforceProgressIpLimit(request);
    const { user } = await requireAccount(request);
    expectedAccount(request, user.id);
    await enforceRequestLimit(request, "write", user.id);
    if (new URL(request.url).search) throw new HttpError(400, "Parámetro no permitido.");
    return json(await createSyncService().incorporateDiagnostic(user.id, await readJson(request, 24 * 1024)));
  } catch (error) { return handleError(error); }
}
