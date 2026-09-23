import {NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/supabase/server';
import {resolveLeagueEntitlement} from '@/lib/server/subscriptionAccess';
import {createBillingPortal} from '@/lib/server/stripeBilling';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(req:Request){
  try{
    const user=await getCurrentUser();
    if(!user)return NextResponse.json({error:'Sign in to manage billing.'},{status:401});
    const entitlement=await resolveLeagueEntitlement(user.id);
    if(!entitlement.stripeCustomerId)return NextResponse.json({error:'No Stripe billing profile exists for this account yet.'},{status:409});
    const portal=await createBillingPortal({customerId:entitlement.stripeCustomerId,origin:new URL(req.url).origin});
    return NextResponse.json({url:portal.url});
  }catch(error){
    console.error('[billing-portal]',error);
    return NextResponse.json({error:error instanceof Error?error.message:'Billing portal could not be opened.'},{status:400});
  }
}
