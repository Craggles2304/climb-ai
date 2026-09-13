import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {riotEnabled,RiotApiError} from '@/lib/riot/client';
import {riotService} from '@/lib/services/riotService';
import {getRecentTftMatchIds,getTftMatch,getTftRank} from '@/lib/tft/service';
import {saveTftMatches} from '@/lib/server/tftRepository';
import {getServerClient} from '@/lib/supabase/server';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  riotAccountId:z.string().uuid().optional(),
  count:z.number().int().min(1).max(20).optional(),
});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'tft-sync'),4,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many TFT sync requests. Try again shortly.'},{status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}});
  if(!riotEnabled())return NextResponse.json({ok:false,code:'RIOT_DISABLED',error:'Riot match import is not enabled yet. TFT remains available as a separate product preview.'},{status:503});

  let input:z.infer<typeof schema>;
  try{input=schema.parse(await req.json())}catch{return NextResponse.json({ok:false,error:'Invalid TFT sync request.'},{status:400})}

  const supabase=await getServerClient();
  if(!supabase)return NextResponse.json({ok:false,error:'Account storage is not configured.'},{status:503});
  const {data:userData}=await supabase.auth.getUser();
  const user=userData.user;
  if(!user)return NextResponse.json({ok:false,error:'Sign in before syncing TFT.'},{status:401});

  let query=supabase.from('riot_accounts').select('id,puuid,game_name,tagline,region,is_primary').eq('user_id',user.id);
  if(input.riotAccountId)query=query.eq('id',input.riotAccountId);
  const {data:accounts,error:accountError}=await query.order('is_primary',{ascending:false}).limit(1);
  if(accountError)return NextResponse.json({ok:false,error:'Could not load your linked Riot account.'},{status:500});
  const linked=accounts?.[0];
  if(!linked)return NextResponse.json({ok:false,error:'Link a Riot account before syncing TFT.'},{status:404});

  try{
    let puuid=linked.puuid as string|null;
    if(!puuid){
      const account=await riotService.getAccountByRiotId(linked.game_name,linked.tagline,linked.region);
      puuid=account.puuid;
      await supabase.from('riot_accounts').update({puuid,updated_at:new Date().toISOString()}).eq('id',linked.id).eq('user_id',user.id);
    }

    const [ids,rank]=await Promise.all([
      getRecentTftMatchIds(puuid,linked.region,input.count??10),
      getTftRank(puuid,linked.region),
    ]);
    const settled=await Promise.allSettled(ids.map(id=>getTftMatch(id,linked.region,puuid!,linked.id)));
    const matches=settled.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
    const failures=settled.filter(r=>r.status==='rejected').length;
    const saved=await saveTftMatches(user.id,linked.id,matches,{puuid,rank});
    if(!saved.persisted)return NextResponse.json({ok:false,error:saved.reason||'TFT matches were returned but could not be saved.'},{status:500});

    return NextResponse.json({ok:true,rank,matchesImported:saved.inserted,matchesSeen:matches.length,skipped:saved.skipped,failures});
  }catch(err){
    if(err instanceof RiotApiError){
      const status=err.status===404?404:err.status===429?429:502;
      return NextResponse.json({ok:false,error:err.message},{status});
    }
    return NextResponse.json({ok:false,error:err instanceof Error?err.message:'TFT sync failed.'},{status:502});
  }
}

export async function GET(){
  return NextResponse.json({enabled:riotEnabled(),mode:'post-game',message:riotEnabled()?'TFT ranked match import is available.':'TFT section is ready; Riot import is waiting for the server API key.'});
}
