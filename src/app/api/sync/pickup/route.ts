import { ZodError } from "zod";
import { getActiveTenantContext } from "@/server/tenancy/active-tenant";
import { toPublicError } from "@/server/errors/app-error";
import { syncPickupIntent } from "@/server/offline/sync-pickup";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const context = await getActiveTenantContext();
    return Response.json(await syncPickupIntent(context, await request.json()), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = error instanceof ZodError || error instanceof SyntaxError ? { code: "VALIDATION_ERROR", message: "Operação de retirada inválida.", status: 400 } : toPublicError(error);
    return Response.json({ code: result.code, message: result.message }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
}
