import { z } from "zod";
const id = z.string().uuid();
const optional = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
export const startPickupSchema = z.object({ recipientName: z.string().trim().min(2).max(160), recipientDocument: optional(40), recipientPhone: optional(40), vehiclePlate: optional(12).transform((v) => v?.replace(/[^A-Za-z0-9]/g, "").toUpperCase()), notes: optional(1000) });
export const inspectionSchema = z.object({ items: z.array(z.object({ pickupItemId: id, condition: z.enum(["OK", "DAMAGED", "DIVERGENT", "OTHER"]), notes: optional(500) }).superRefine((v, ctx) => { if (v.condition !== "OK" && !v.notes) ctx.addIssue({ code: "custom", path: ["notes"], message: "Descreva a divergência." }); })).min(1) });
export const refusalSchema = z.object({ reasonCode: z.enum(["DAMAGE", "RESOURCE_MISMATCH", "DOCUMENT_MISMATCH", "RECIPIENT_MISMATCH", "RESERVATION_INVALID", "OTHER"]), notes: z.string().trim().min(3).max(1000) });
export const pickupListSchema = z.object({ status: z.string().trim().max(30).default(""), urgent: z.enum(["", "true", "false"]).default(""), search: z.string().trim().max(100).default("") });
