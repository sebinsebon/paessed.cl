import { requireAccount } from "@/lib/server/auth";
import { handleError, HttpError, json, readJson, sameOrigin, expectedAccount } from "@/lib/server/http";
import { enforceRequestLimit, enforceProgressIpLimit } from "@/lib/server/limits";
import { createSyncService } from "@/lib/server/sync-service";
import { batchSchema } from "@/lib/sync/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await enforceProgressIpLimit(request);
    const { user } = await requireAccount(request);
    expectedAccount(request, user.id);
    await enforceRequestLimit(request,"read",user.id);
    const params=new URL(request.url).searchParams;
    if([...params.keys()].some(k=>k!=="cursor"))throw new HttpError(400,"Parámetro no permitido.");
    const raw=params.get("cursor")??"0";
    if(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw)))throw new HttpError(400,"Cursor inválido.");
    return json(await createSyncService().pull(user.id,Number(raw)));
  } catch(error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await enforceProgressIpLimit(request);
    const { user }=await requireAccount(request);
    expectedAccount(request, user.id);
    await enforceRequestLimit(request,"write",user.id);
    const parsed=batchSchema.safeParse(await readJson(request));
    if(!parsed.success)throw new HttpError(400,"Contrato de sincronización inválido.");
    return json(await createSyncService().push(user.id,parsed.data.operations,parsed.data.cursor??0));
  } catch(error) { return handleError(error); }
}
