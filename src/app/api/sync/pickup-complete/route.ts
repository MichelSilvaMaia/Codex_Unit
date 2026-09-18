import { ZodError } from "zod";
import { getActiveTenantContext } from "@/server/tenancy/active-tenant";
import { toPublicError } from "@/server/errors/app-error";
import { syncPickupCompletion } from "@/server/offline/sync-pickup-complete";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const context = await getActiveTenantContext();
    const ack = await syncPickupCompletion(context, await request.json());
    return Response.json(ack, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = error instanceof ZodError || error instanceof SyntaxError ? { code: "VALIDATION_ERROR", message: "Intenção de conclusão inválida.", status: 400 } : toPublicError(error);
    return Response.json({ code: result.code, message: result.message }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
}
