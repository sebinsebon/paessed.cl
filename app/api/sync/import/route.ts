import { requireAccount } from "@/lib/server/auth";
import { handleError, HttpError, json, readJson, sameOrigin, expectedAccount } from "@/lib/server/http";
import { enforceRequestLimit, enforceProgressIpLimit } from "@/lib/server/limits";
import { createSyncService } from "@/lib/server/sync-service";
import { importSchema } from "@/lib/sync/contracts";
export const runtime="nodejs";
export async function POST(request:Request){
  try{
    sameOrigin(request);await enforceProgressIpLimit(request);const {user}=await requireAccount(request);
    expectedAccount(request,user.id);
    await enforceRequestLimit(request,"write",user.id);
    const parsed=importSchema.safeParse(await readJson(request));
    if(!parsed.success)throw new HttpError(400,"La incorporación requiere un lote válido y confirmación.");
    return json(await createSyncService().push(user.id,parsed.data.operations,parsed.data.cursor??0,true));
  }catch(error){return handleError(error);}
}
