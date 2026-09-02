import {z} from "zod";
const optional=(max:number)=>z.string().trim().max(max).optional().transform(value=>value||undefined);
export const startReturnSchema=z.object({returnedByName:optional(160),returnedByDocument:optional(40),returnedByPhone:optional(40),vehiclePlate:optional(12).transform(value=>value?.replace(/[^A-Za-z0-9]/g,"").toUpperCase()),notes:optional(1000)});
export const inspectReturnItemSchema=z.object({returnItemId:z.string().uuid(),presence:z.enum(["PRESENT","NOT_PRESENT"]),condition:z.enum(["GOOD","DAMAGED","MISSING_COMPONENTS","DIRTY","UNUSABLE","OTHER"]).optional(),disposition:z.enum(["AVAILABLE","MAINTENANCE","UNAVAILABLE"]).optional(),notes:optional(2000)});
export const returnListSchema=z.object({status:z.enum(["awaiting","in_progress","completed","late"]).optional(),search:optional(120)});
