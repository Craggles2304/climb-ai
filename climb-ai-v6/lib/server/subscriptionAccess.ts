import 'server-only';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {hasTier,normalizeTier,type SubscriptionTier} from '@/lib/subscription';

export type LeagueEntitlement={
  tier:SubscriptionTier;
  status:string;
  source:'founder'|'stripe'|'legacy'|'free';
  stripeCustomerId:string|null;
  stripeSubscriptionId:string|null;
  currentPeriodEnd:string|null;
  active:boolean;
};

export async function resolveLeagueEntitlement(userId:string):Promise<LeagueEntitlement>{
  const db=getSupabaseAdmin();
  if(!db)return empty();

  const [profileResult,entitlementResult,userResult]=await Promise.all([
    db.from('profiles').select('is_founder').eq('id',userId).maybeSingle(),
    db.from('product_entitlements')
      .select('tier,status,source,stripe_customer_id,stripe_subscription_id,current_period_end')
      .eq('user_id',userId)
      .eq('product','LOL')
      .maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);

  if(profileResult.data?.is_founder===true){
    return{tier:'PRO',status:'active',source:'founder',stripeCustomerId:null,stripeSubscriptionId:null,currentPeriodEnd:null,active:true};
  }

  const row=entitlementResult.data as any;
  const status=String(row?.status??'').toLowerCase();
  const periodEnd=row?.current_period_end?String(row.current_period_end):null;
  const periodEndMs=periodEnd?Date.parse(periodEnd):Number.POSITIVE_INFINITY;
  const active=['active','trialing'].includes(status)&&(!Number.isFinite(periodEndMs)||periodEndMs>Date.now());
  if(row){
    return{
      tier:active?normalizeTier(row.tier):'FREE',
      status:status||'inactive',
      source:'stripe',
      stripeCustomerId:row.stripe_customer_id?String(row.stripe_customer_id):null,
      stripeSubscriptionId:row.stripe_subscription_id?String(row.stripe_subscription_id):null,
      currentPeriodEnd:periodEnd,
      active,
    };
  }

  const legacy=normalizeTier(userResult.data?.user?.app_metadata?.subscription_tier);
  if(legacy!=='FREE')return{tier:legacy,status:'active',source:'legacy',stripeCustomerId:null,stripeSubscriptionId:null,currentPeriodEnd:null,active:true};
  return empty();
}

export async function requireLeagueTier(userId:string,required:SubscriptionTier){
  const entitlement=await resolveLeagueEntitlement(userId);
  return{entitlement,allowed:hasTier(entitlement.tier,required)};
}

function empty():LeagueEntitlement{
  return{tier:'FREE',status:'inactive',source:'free',stripeCustomerId:null,stripeSubscriptionId:null,currentPeriodEnd:null,active:false};
}
