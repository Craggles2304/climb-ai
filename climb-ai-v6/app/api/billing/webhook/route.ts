import {NextResponse} from 'next/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {getStripeSubscription,tierForStripePrice,verifyStripeWebhook} from '@/lib/server/stripeBilling';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(req:Request){
  const raw=await req.text();
  if(!verifyStripeWebhook(raw,req.headers.get('stripe-signature'))){
    return NextResponse.json({error:'Invalid Stripe signature.'},{status:400});
  }

  try{
    const event=JSON.parse(raw);
    const object=event?.data?.object??{};

    if(event.type==='checkout.session.completed'&&object?.subscription){
      const subscription=await getStripeSubscription(String(object.subscription));
      await syncSubscription(subscription,{
        fallbackUserId:String(object.client_reference_id||object.metadata?.user_id||''),
        fallbackCustomerId:idOf(object.customer),
      });
    }

    if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(String(event.type))){
      await syncSubscription(object);
    }

    return NextResponse.json({received:true});
  }catch(error){
    console.error('[stripe-webhook]',error);
    return NextResponse.json({error:'Webhook processing failed.'},{status:500});
  }
}

async function syncSubscription(subscription:any,fallback:{fallbackUserId?:string;fallbackCustomerId?:string|null}={}){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase admin is unavailable.');

  const subscriptionId=idOf(subscription?.id);
  const customerId=idOf(subscription?.customer)||fallback.fallbackCustomerId||null;
  let userId=String(subscription?.metadata?.user_id||fallback.fallbackUserId||'').trim();

  if(!userId&&subscriptionId){
    const {data}=await db.from('product_entitlements').select('user_id').eq('stripe_subscription_id',subscriptionId).maybeSingle();
    userId=String(data?.user_id||'');
  }
  if(!userId&&customerId){
    const {data}=await db.from('product_entitlements').select('user_id').eq('stripe_customer_id',customerId).eq('product','LOL').maybeSingle();
    userId=String(data?.user_id||'');
  }
  if(!userId)throw new Error('Stripe subscription has no OP CLIMB user mapping.');

  const priceId=subscription?.items?.data?.[0]?.price?.id;
  const tier=tierForStripePrice(priceId)||normalizeMetadataTier(subscription?.metadata?.tier);
  if(!tier)throw new Error('Stripe subscription price does not map to an OP CLIMB League tier.');

  const stripeStatus=String(subscription?.status||'inactive').toLowerCase();
  const status=mapStatus(stripeStatus);
  const endUnix=Number(subscription?.current_period_end??subscription?.items?.data?.[0]?.current_period_end??0);
  const currentPeriodEnd=Number.isFinite(endUnix)&&endUnix>0?new Date(endUnix*1000).toISOString():null;

  const {error}=await db.from('product_entitlements').upsert({
    user_id:userId,
    product:'LOL',
    tier,
    status,
    source:'stripe',
    stripe_customer_id:customerId,
    stripe_subscription_id:subscriptionId,
    current_period_end:currentPeriodEnd,
    updated_at:new Date().toISOString(),
  },{onConflict:'user_id,product'});
  if(error)throw new Error(error.message);
}

function idOf(value:any){return typeof value==='string'?value:(value?.id?String(value.id):null)}
function normalizeMetadataTier(value:any){const tier=String(value||'').toUpperCase();return tier==='PLUS'||tier==='PRO'?tier:null}
function mapStatus(status:string){
  if(status==='active')return'active';
  if(status==='trialing')return'trialing';
  if(status==='past_due')return'past_due';
  if(status==='canceled')return'canceled';
  return'inactive';
}
