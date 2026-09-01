import { z } from "zod";

const id = z.string().uuid();
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);

const reservationFields = z.object({
  customerId: id, contractId: id.optional(), unitId: id,
  title: z.string().trim().min(2).max(160), description: optionalText(2000),
  startAtLocal: z.string(), endAtLocal: z.string(), resourceIds: z.array(id).min(1).max(100),
  status: z.literal("DRAFT").default("DRAFT"),
  isUrgent: z.boolean().default(false), urgentReason: optionalText(500),
});
export const reservationInputSchema = reservationFields.superRefine((value, ctx) => {
  if (value.isUrgent && !value.urgentReason) ctx.addIssue({ code: "custom", path: ["urgentReason"], message: "Informe a justificativa da urgência." });
});
export const reservationUpdateInputSchema = reservationFields.omit({ status: true, isUrgent: true, urgentReason: true });

export const availabilityInputSchema = z.object({
  unitId: id, startAtLocal: z.string(), endAtLocal: z.string(), resourceIds: z.array(id).min(1).max(100), reservationId: id.optional(),
});

export const cancellationSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const rejectionSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const urgencySchema = z.discriminatedUnion("isUrgent", [
  z.object({ isUrgent: z.literal(true), reason: z.string().trim().min(3).max(500) }),
  z.object({ isUrgent: z.literal(false), reason: z.string().trim().max(500).optional() }),
]);

export const reservationListSchema = z.object({
  search: z.string().trim().max(100).default(""), status: z.string().trim().max(30).default(""),
  from: z.string().trim().default(""), to: z.string().trim().default(""), urgent: z.enum(["", "true", "false"]).default(""),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
