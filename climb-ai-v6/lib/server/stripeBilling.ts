import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
import type {SubscriptionTier} from '@/lib/subscription';

const API='https://api.stripe.com/v1';

export function stripeBillingReady(){
  return Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_LOL_PLUS_PRICE_ID&&process.env.STRIPE_LOL_PRO_PRICE_ID);
}

export function stripePriceForTier(tier:'PLUS'|'PRO'){
  return tier==='PRO'?process.env.STRIPE_LOL_PRO_PRICE_ID:process.env.STRIPE_LOL_PLUS_PRICE_ID;
}

export function tierForStripePrice(priceId:unknown):SubscriptionTier|null{
  const value=String(priceId??'');
  if(value&&value===process.env.STRIPE_LOL_PRO_PRICE_ID)return'PRO';
  if(value&&value===process.env.STRIPE_LOL_PLUS_PRICE_ID)return'PLUS';
  return null;
}

export async function createLeagueCheckout(input:{
  userId:string;
  email:string|null;
  tier:'PLUS'|'PRO';
  customerId:string|null;
  origin:string;
}){
  const price=stripePriceForTier(input.tier);
  if(!price)throw new Error('Stripe pricing is not configured.');
  const body=new URLSearchParams();
  body.set('mode','subscription');
  body.set('line_items[0][price]',price);
  body.set('line_items[0][quantity]','1');
  body.set('success_url',input.origin+'/billing?checkout=success');
  body.set('cancel_url',input.origin+'/pricing?checkout=cancelled');
  body.set('client_reference_id',input.userId);
  body.set('allow_promotion_codes','true');
  body.set('metadata[user_id]',input.userId);
  body.set('metadata[product]','LOL');
  body.set('metadata[target_tier]',input.tier);
  body.set('subscription_data[metadata][user_id]',input.userId);
  body.set('subscription_data[metadata][product]','LOL');
  body.set('subscription_data[metadata][tier]',input.tier);
  if(input.customerId)body.set('customer',input.customerId);
  else if(input.email)body.set('customer_email',input.email);
  return stripePost('/checkout/sessions',body);
}

export async function createBillingPortal(input:{customerId:string;origin:string}){
  const body=new URLSearchParams();
  body.set('customer',input.customerId);
  body.set('return_url',input.origin+'/billing');
  return stripePost('/billing_portal/sessions',body);
}

export async function getStripeSubscription(id:string){
  return stripeGet('/subscriptions/'+encodeURIComponent(id));
}

async function stripePost(path:string,body:URLSearchParams){
  const secret=process.env.STRIPE_SECRET_KEY;
  if(!secret)throw new Error('Stripe is not configured.');
  const response=await fetch(API+path,{
    method:'POST',
    headers:{Authorization:'Bearer '+secret,'Content-Type':'application/x-www-form-urlencoded'},
    body,
    cache:'no-store',
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(String(json?.error?.message||'Stripe request failed.'));
  return json;
}

async function stripeGet(path:string){
  const secret=process.env.STRIPE_SECRET_KEY;
  if(!secret)throw new Error('Stripe is not configured.');
  const response=await fetch(API+path,{headers:{Authorization:'Bearer '+secret},cache:'no-store'});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(String(json?.error?.message||'Stripe request failed.'));
  return json;
}

export function verifyStripeWebhook(rawBody:string,header:string|null,secret=process.env.STRIPE_WEBHOOK_SECRET){
  if(!secret||!header)return false;
  const parts=header.split(',').map(part=>part.trim());
  const timestamp=parts.find(part=>part.startsWith('t='))?.slice(2);
  const signatures=parts.filter(part=>part.startsWith('v1=')).map(part=>part.slice(3));
  if(!timestamp||!signatures.length)return false;
  const unix=Number(timestamp);
  if(!Number.isFinite(unix)||Math.abs(Date.now()/1000-unix)>300)return false;
  const expected=createHmac('sha256',secret).update(timestamp+'.'+rawBody,'utf8').digest('hex');
  const expectedBuffer=Buffer.from(expected,'hex');
  return signatures.some(signature=>{
    try{
      const candidate=Buffer.from(signature,'hex');
      return candidate.length===expectedBuffer.length&&timingSafeEqual(candidate,expectedBuffer);
    }catch{return false}
  });
}
