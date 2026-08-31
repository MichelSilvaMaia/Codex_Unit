import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const code = z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9._-]+$/).transform((value) => value.toUpperCase());
const id = z.string().uuid();

export const recordStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

export const unitSchema = z.object({
  name: z.string().trim().min(2).max(120), code, status: recordStatusSchema.default("ACTIVE"),
  phone: optionalText(30), email: z.email().optional().or(z.literal("")).transform((value) => value || undefined),
  addressLine1: optionalText(160), addressLine2: optionalText(160), city: optionalText(100),
  state: optionalText(80), postalCode: optionalText(20), country: z.string().trim().length(2).default("BR").transform((value) => value.toUpperCase()),
});

export const customerContactSchema = z.object({
  name: z.string().trim().min(2).max(120), title: optionalText(100),
  email: z.email().optional().or(z.literal("")).transform((value) => value || undefined),
  phone: optionalText(30), whatsapp: optionalText(30), isPrimary: z.boolean().default(false),
  status: recordStatusSchema.default("ACTIVE"),
});

export const customerAddressSchema = z.object({
  type: z.enum(["BILLING", "OPERATIONAL", "DELIVERY", "OTHER"]), label: optionalText(80),
  addressLine1: z.string().trim().min(2).max(160), addressLine2: optionalText(160),
  city: z.string().trim().min(2).max(100), state: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(3).max(20), country: z.string().trim().length(2).default("BR").transform((value) => value.toUpperCase()),
  isPrimary: z.boolean().default(false), status: recordStatusSchema.default("ACTIVE"),
});

export const customerSchema = z.object({
  type: z.enum(["INDIVIDUAL", "COMPANY"]), legalName: z.string().trim().min(2).max(160),
  tradeName: optionalText(160), document: optionalText(30), status: recordStatusSchema.default("ACTIVE"),
  email: z.email().optional().or(z.literal("")).transform((value) => value || undefined),
  phone: optionalText(30), notes: optionalText(2000),
  primaryContact: customerContactSchema.optional(), primaryAddress: customerAddressSchema.optional(),
});

export const contractSchema = z.object({
  customerId: id, code, title: z.string().trim().min(2).max(160), description: optionalText(2000),
  startDate: z.coerce.date(), endDate: z.coerce.date().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "SUSPENDED", "EXPIRED", "TERMINATED"]).default("DRAFT"),
  unitIds: z.array(id).max(100).default([]),
}).superRefine((value, context) => {
  if (value.endDate && value.endDate < value.startDate) context.addIssue({ code: "custom", path: ["endDate"], message: "A data final deve ser igual ou posterior à inicial." });
});

export const resourceCategorySchema = z.object({
  name: z.string().trim().min(2).max(120), code, description: optionalText(1000), status: recordStatusSchema.default("ACTIVE"),
});

export const resourceSchema = z.object({
  unitId: id, categoryId: id, code, name: z.string().trim().min(2).max(160),
  description: optionalText(2000), serialNumber: optionalText(120), status: recordStatusSchema.default("ACTIVE"),
  operationalStatus: z.enum(["AVAILABLE", "MAINTENANCE", "UNAVAILABLE", "RETIRED"]).default("AVAILABLE"),
});

export const listQuerySchema = z.object({
  search: z.string().trim().max(100).default(""), status: z.string().trim().max(30).default(""),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function normalizeDocument(value?: string) {
  const normalized = value?.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return normalized || undefined;
}

export function isResourceOperationallyAvailable(status: string, operationalStatus: string) {
  return status === "ACTIVE" && operationalStatus === "AVAILABLE";
}
