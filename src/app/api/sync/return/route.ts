import { ZodError } from "zod";
import { syncReturnIntent } from "@/server/offline/sync-return";
import { getActiveTenantContext } from "@/server/tenancy/active-tenant";
import { toPublicError } from "@/server/errors/app-error";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { try { return Response.json(await syncReturnIntent(await getActiveTenantContext(), await request.json()), { headers: { "Cache-Control": "no-store" } }); } catch (error) { const e = error instanceof ZodError || error instanceof SyntaxError ? { code: "VALIDATION_ERROR", message: "Operação inválida.", status: 400 } : toPublicError(error); return Response.json({ code: e.code, message: e.message }, { status: e.status, headers: { "Cache-Control": "no-store" } }); } }
