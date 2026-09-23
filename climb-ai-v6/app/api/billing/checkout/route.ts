import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {resolveLeagueEntitlement} from '@/lib/server/subscriptionAccess';
import {createBillingPortal,createLeagueCheckout,stripeBillingReady} from '@/lib/server/stripeBilling';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({tier:z.enum(['PLUS','PRO'])});

export async function POST(req:Request){
  try{
    const user=await getCurrentUser();
    if(!user)return NextResponse.json({error:'Sign in before upgrading.'},{status:401});
    if(!stripeBillingReady())return NextResponse.json({error:'Paid checkout is not configured yet.'},{status:503});
    const {tier}=schema.parse(await req.json());
    const entitlement=await resolveLeagueEntitlement(user.id);
    const origin=new URL(req.url).origin;

    if(entitlement.source==='founder'){
      return NextResponse.json({error:'Founder access already includes PRO.'},{status:409});
    }
    if(entitlement.active&&entitlement.stripeCustomerId){
      const portal=await createBillingPortal({customerId:entitlement.stripeCustomerId,origin});
      return NextResponse.json({url:portal.url,mode:'portal'});
    }

    const session=await createLeagueCheckout({
      userId:user.id,
      email:user.email??null,
      tier,
      customerId:entitlement.stripeCustomerId,
      origin,
    });
    return NextResponse.json({url:session.url,mode:'checkout'});
  }catch(error){
    console.error('[billing-checkout]',error);
    return NextResponse.json({error:error instanceof Error?error.message:'Checkout could not be started.'},{status:400});
  }
}
