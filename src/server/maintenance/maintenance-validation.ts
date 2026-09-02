import { z } from "zod";
export const createMaintenanceSchema=z.object({resourceId:z.string().uuid(),sourceType:z.enum(["MANUAL","OPERATIONAL_INSPECTION","OTHER"]).default("MANUAL"),title:z.string().trim().min(3).max(120),description:z.string().trim().min(3).max(2000),priority:z.enum(["LOW","NORMAL","HIGH","CRITICAL"]).default("NORMAL")});
export const transitionMaintenanceSchema=z.object({toStatus:z.enum(["DIAGNOSING","IN_PROGRESS","WAITING","COMPLETED"]),reason:z.string().trim().max(500).optional()});
export const descriptionSchema=z.object({description:z.string().trim().min(3).max(2000)});
export const activitySchema=z.object({type:z.enum(["INSPECTION","REPAIR","CLEANING","TEST","ADJUSTMENT","OTHER"]),description:z.string().trim().min(3).max(2000)});
export const releaseSchema=z.object({releaseNotes:z.string().trim().min(3).max(1000)});
export const cancelSchema=z.object({cancellationReason:z.string().trim().min(3).max(1000),resultingOperationalStatus:z.enum(["AVAILABLE","UNAVAILABLE"])});
export const maintenanceListSchema=z.object({search:z.string().trim().optional(),status:z.enum(["OPEN","DIAGNOSING","IN_PROGRESS","WAITING","COMPLETED","RELEASED","CANCELLED"]).optional(),priority:z.enum(["LOW","NORMAL","HIGH","CRITICAL"]).optional(),page:z.coerce.number().int().min(1).default(1)});
