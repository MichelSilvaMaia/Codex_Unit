import { ZodError } from "zod";
import { getActiveTenantContext } from "@/server/tenancy/active-tenant";
import { syncMaintenanceMutation } from "@/server/offline/sync-maintenance";
import { toPublicError } from "@/server/errors/app-error";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const context = await getActiveTenantContext();
    const result = await syncMaintenanceMutation(context, await request.json());
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const publicError = error instanceof ZodError ? { code: "VALIDATION_ERROR", message: "Operação offline inválida ou incompatível.", status: 400 } : toPublicError(error);
    return Response.json({ code: publicError.code, message: publicError.message }, { status: publicError.status, headers: { "Cache-Control": "no-store" } });
  }
}
