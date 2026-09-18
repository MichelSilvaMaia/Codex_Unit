import { createHash } from "node:crypto";
import { PICKUP_TERMS_VERSION, pickupTermsSnapshot } from "@/lib/pickup-terms-content";
export { PICKUP_TERMS_VERSION };
export function buildPickupTerms(input:{reservationCode:string;recipientName:string;resources:string[];conditions:string[]}) { const snapshot=pickupTermsSnapshot(input); return {version:PICKUP_TERMS_VERSION,snapshot,hash:createHash("sha256").update(snapshot).digest("hex")}; }
