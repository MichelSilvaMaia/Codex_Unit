import { ZodError } from "zod";
import { getActiveTenantContext } from "@/server/tenancy/active-tenant";
import { AttachmentBusyError, syncMaintenanceAttachment, syncPickupAttachment, syncReturnAttachment } from "@/server/offline/sync-attachment";
import { syncOfflineSignature } from "@/server/offline/sync-signature";
import { toPublicError } from "@/server/errors/app-error";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const context = await getActiveTenantContext();
    const length = Number(request.headers.get("content-length"));
    if (length > 9 * 1024 * 1024) return Response.json({ code: "VALIDATION_ERROR" }, { status: 413, headers: { "Cache-Control": "no-store" } });
    const form = await request.formData();
    const file = form.get("evidence");
    if (!(file instanceof File) || file.size > 8 * 1024 * 1024) return Response.json({ code: "VALIDATION_ERROR" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const metadata = JSON.parse(String(form.get("metadata") ?? "{}")) as { purpose?: string };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = metadata.purpose === "PICKUP_EVIDENCE" ? await syncPickupAttachment(context, metadata, bytes, file.type) : metadata.purpose === "PICKUP_SIGNATURE" ? await syncOfflineSignature(context, metadata, bytes, file.type) : metadata.purpose === "RETURN_EVIDENCE" ? await syncReturnAttachment(context, metadata, bytes, file.type) : await syncMaintenanceAttachment(context, metadata, bytes, file.type);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const publicError = error instanceof AttachmentBusyError ? { code: "BUSY", message: "Upload em andamento.", status: 503 } : error instanceof ZodError || error instanceof SyntaxError ? { code: "VALIDATION_ERROR", message: "Evidência inválida.", status: 400 } : toPublicError(error);
    return Response.json({ code: publicError.code, message: publicError.message }, { status: publicError.status, headers: { "Cache-Control": "no-store" } });
  }
}
