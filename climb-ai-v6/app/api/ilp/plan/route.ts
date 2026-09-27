import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {materializeDeferredLocalMatch} from '@/lib/server/liveTrackerRepository';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'ilp-plan'),60,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many plan requests.'},{status:429});

  const user=await getCurrentUser();
  const db=getSupabaseAdmin();
  if(!user||!db)return NextResponse.json({ok:false,error:'Authentication required.'},{status:401});

  const accountId=String(req.nextUrl.searchParams.get('accountId')||'').trim();
  if(!accountId)return NextResponse.json({ok:false,error:'Riot account required.'},{status:400});

  const {data:account,error:accountError}=await db.from('riot_accounts')
    .select('id')
    .eq('id',accountId)
    .eq('user_id',user.id)
    .maybeSingle();
  if(accountError)return NextResponse.json({ok:false,error:'Could not verify Riot account.'},{status:503});
  if(!account)return NextResponse.json({ok:false,error:'Riot account not found.'},{status:404});

  await materializeDeferredLocalMatch(user.id,accountId)
    .catch(error=>console.warn('[ilp-plan] deferred match materialisation failed',error));

  const {data,error}=await db.from('ilp_tasks')
    .select('id,payload,updated_at')
    .eq('user_id',user.id)
    .eq('riot_account_id',accountId)
    .order('updated_at',{ascending:false});
  if(error){
    console.error('[ilp-plan] load failed',error);
    return NextResponse.json({ok:false,error:'Mission plan is temporarily unavailable.'},{status:503});
  }

  return NextResponse.json({ok:true,rows:data??[]});
}
