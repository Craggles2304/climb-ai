export type Plan='FREE'|'PLUS'|'PRO'|'FOUNDER';
export interface BillingService{checkout(plan:Plan):Promise<{url:string|null}>;portal():Promise<{url:string|null}>}
export class PlaceholderBillingService implements BillingService{async checkout(){return {url:null}}async portal(){return {url:null}}}
export const billingService:BillingService=new PlaceholderBillingService();