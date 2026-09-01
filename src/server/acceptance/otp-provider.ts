import type { OtpChannel } from "@prisma/client";
export type OtpDeliveryResult={accepted:boolean;providerMessageId?:string;retryable?:boolean;errorCode?:string};
export interface OtpDeliveryProvider { readonly name:string; readonly channel:OtpChannel; send(input:{destination:string;code:string;expiresInSeconds:number}):Promise<OtpDeliveryResult>; }
export class DevelopmentOtpProvider implements OtpDeliveryProvider { readonly name="development"; constructor(readonly channel:OtpChannel, private capture?:(code:string)=>void){} async send(input:{code:string}) { if(process.env.NODE_ENV==="production") return {accepted:false,retryable:false,errorCode:"DEV_PROVIDER_DISABLED"}; this.capture?.(input.code); return {accepted:true,providerMessageId:"development-only"}; } }
