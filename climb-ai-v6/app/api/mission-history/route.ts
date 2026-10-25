import {NextRequest,NextResponse} from 'next/server';
import {getServerClient} from '@/lib/supabase/server';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Read-only, account-scoped, cursor-paginated mission timeline.
 * The archive is persisted by Postgres triggers (not browser localStorage).
 * Authenticated Supabase RLS is the final ownership check for every row.
 */
export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'mission-history'),45,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many history requests.'},{status:429});

  const db=await getServerClient();
  if(!db)return NextResponse.json({ok:false,error:'Player database unavailable.'},{status:503});
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)return NextResponse.json({ok:false,error:'Sign in to view your history.'},{status:401});

  const accountId=String(req.nextUrl.searchParams.get('accountId')||'').trim();
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(accountId))
    return NextResponse.json({ok:false,error:'A linked Riot account is required.'},{status:400});
  const cursor=String(req.nextUrl.searchParams.get('before')||'').trim();
  if(cursor&&!/^[1-9]\d{0,17}$/.test(cursor))
    return NextResponse.json({ok:false,error:'Invalid history cursor.'},{status:400});
  const requested=Number(req.nextUrl.searchParams.get('limit')||30);
  const pageSize=Number.isInteger(requested)?Math.min(50,Math.max(1,requested)):30;

  const {data:account,error:ownerError}=await db.from('riot_accounts')
    .select('id').eq('id',accountId).eq('user_id',user.id).maybeSingle();
  if(ownerError)return NextResponse.json({ok:false,error:'Could not verify Riot account.'},{status:503});
  if(!account)return NextResponse.json({ok:false,error:'Riot account not found.'},{status:404});

  let query=db.from('player_mission_history')
    .select('id,mission_id,product,event_type,payload,occurred_at,recorded_at')
    .eq('user_id',user.id)
    .eq('riot_account_id',accountId)
    .order('id',{ascending:false})
    .limit(pageSize+1);
  if(cursor)query=query.lt('id',cursor);
  const {data,error}=await query;
  if(error){
    console.error('[mission-history] read failed',error);
    return NextResponse.json({ok:false,error:'Mission history is temporarily unavailable.'},{status:503});
  }

  const rows=(data??[]).slice(0,pageSize);
  const nextCursor=(data??[]).length>pageSize?String(rows[rows.length-1]?.id):null;
  return NextResponse.json({ok:true,rows,nextCursor},{headers:{'Cache-Control':'private, no-store'}});
}
