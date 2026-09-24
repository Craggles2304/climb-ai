import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {riotService} from '@/lib/services/riotService';
import {riotEnabled,RiotApiError} from '@/lib/riot/client';
import {isSupportedRegion,SUPPORTED_REGIONS} from '@/lib/riot/regions';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {saveMatches,SaveResult,SyncedMatch} from '@/lib/server/matchRepository';
import {getServerClient} from '@/lib/supabase/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  gameName:z.string().min(1).max(32),
  tagline:z.string().min(1).max(8),
  region:z.string().min(2).max(8),
  count:z.number().int().min(1).max(20).optional(),
  rankOnly:z.boolean().optional(),
});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'riot-sync'),5,60_000);
  if(!limit.ok){
    return NextResponse.json(
      {ok:false,error:'Too many sync requests. Wait a moment and try again.'},
      {status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}},
    );
  }

  if(!riotEnabled()){
    return NextResponse.json({
      ok:false,
      code:'RIOT_DISABLED',
      error:'Automatic match sync is coming shortly. Add your last match and OP CLIMB can still build the first grade now.',
    },{status:503});
  }

  let input:z.infer<typeof schema>;
  try{input=schema.parse(await req.json())}
  catch{return NextResponse.json({ok:false,error:'Enter a Riot ID, tagline and region.'},{status:400})}

  if(!isSupportedRegion(input.region)){
    return NextResponse.json({ok:false,error:`Region not supported. Choose one of: ${SUPPORTED_REGIONS.join(', ')}.`},{status:400});
  }

  const region=input.region.toUpperCase();
  const cleanTag=input.tagline.replace(/^#/,'').trim().toUpperCase();
  const cleanName=input.gameName.trim();

  // Persistence is tied to the verified cookie session. The client can no longer
  // supply an arbitrary user UUID and ask the service-role repository to write
  // into somebody else's account.
  const supabase=await getServerClient();
  const {data:userData}=supabase?await supabase.auth.getUser():{data:{user:null}} as any;
  const user=userData.user;
  let linkedAccount:any=null;
  if(supabase&&user){
    const {data:accounts}=await supabase.from('riot_accounts')
      .select('id,game_name,tagline,region,is_primary')
      .eq('user_id',user.id);
    linkedAccount=(accounts||[]).find((row:any)=>
      String(row.game_name||'').toLowerCase()===cleanName.toLowerCase()&&
      String(row.tagline||'').replace(/^#/,'').toUpperCase()===cleanTag&&
      String(row.region||'').toUpperCase()===region
    )||null;
  }

  try{
    const account=await riotService.getAccountByRiotId(cleanName,cleanTag,region);
    const rank=await riotService.getSummonerRank(account.puuid,region).catch(()=>null);
    const ids=input.rankOnly?[]:await riotService.getRecentMatches(account.puuid,region,{count:input.count??10,queue:420});

    const ctx={
      riotAccountId:linkedAccount?.id||account.puuid,
      puuid:account.puuid,
      rank:rank?.label,
    };

    const synced:SyncedMatch[]=[];
    const failures:{matchId:string;reason:string}[]=[];
    for(const id of ids){
      try{synced.push(await riotService.getMatchDetails(id,region,ctx))}
      catch(err){failures.push({matchId:id,reason:err instanceof Error?err.message:'Unknown error'})}
    }

    let saved:SaveResult={persisted:false,inserted:0,skipped:synced.length,reason:'No signed-in linked account; results were not persisted.'};
    if(user&&linkedAccount){
      if(!input.rankOnly){
        saved=await saveMatches(user.id,synced);
        if(!saved.persisted){
          return NextResponse.json({ok:false,error:saved.reason||'Riot returned the match, but OP CLIMB could not save it.'},{status:500});
        }
      }else{
        saved={persisted:true,inserted:0,skipped:0,reason:'Rank-only refresh.'};
      }
      if(supabase){
        await supabase.from('riot_accounts').update({
          puuid:account.puuid,
          sync_status:'ready',
          last_synced_at:new Date().toISOString(),
          rank_tier:rank?.tier??null,
          rank_division:rank?.division??null,
          league_points:rank?.leaguePoints??null,
          updated_at:new Date().toISOString(),
        }).eq('id',linkedAccount.id).eq('user_id',user.id);
      }
    }

    const degraded=new Map<string,number>();
    for(const s of synced)for(const key of s.unavailable)degraded.set(key,(degraded.get(key)||0)+1);

    return NextResponse.json({
      ok:true,
      account:{gameName:account.gameName,tagline:account.tagLine,puuid:account.puuid},
      rank,
      matches:synced.map(s=>({...s.match,moments:s.moments})),
      persisted:saved,
      degradedMetrics:Object.fromEntries(degraded),
      failures,
    });
  }catch(err){
    if(err instanceof RiotApiError){
      const status=err.status===404?404:err.status===429?429:502;
      return NextResponse.json({ok:false,error:err.message},{status});
    }
    return NextResponse.json({ok:false,error:'We could not reach Riot for your matches. Your account is safe — add the last game manually or try again.'},{status:502});
  }
}

export async function GET(){
  return NextResponse.json({
    enabled:riotEnabled(),
    regions:SUPPORTED_REGIONS,
    message:riotEnabled()
      ?'Riot sync is enabled.'
      :'Automatic match sync is coming shortly. Add your last match and OP CLIMB can still build the first grade now.',
  });
}
