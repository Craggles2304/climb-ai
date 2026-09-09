import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {riotService} from '@/lib/services/riotService';
import {riotEnabled,RiotApiError} from '@/lib/riot/client';
import {isSupportedRegion,SUPPORTED_REGIONS} from '@/lib/riot/regions';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {saveMatches,SyncedMatch} from '@/lib/server/matchRepository';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  gameName:z.string().min(1).max(32),
  tagline:z.string().min(1).max(8),
  region:z.string().min(2).max(8),
  count:z.number().int().min(1).max(20).optional(),
  /** Supply to persist. Without it the route maps and returns without saving. */
  userId:z.string().uuid().optional(),
  riotAccountId:z.string().optional(),
});

export async function POST(req:NextRequest){
  // Riot's per-key budget is small and shared across all users of this deployment.
  const limit=rateLimit(clientKey(req,'riot-sync'),5,60_000);
  if(!limit.ok){
    return NextResponse.json(
      {ok:false,error:'Too many sync requests. Wait a moment and try again.'},
      {status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}},
    );
  }

  if(!riotEnabled()){
    // Feature-flag behaviour: this is a known, communicated state, not a failure.
    return NextResponse.json({
      ok:false,
      code:'RIOT_DISABLED',
      error:'Automatic match sync is coming shortly. Upload a match in the meantime.',
    },{status:503});
  }

  let input:z.infer<typeof schema>;
  try{
    input=schema.parse(await req.json());
  }catch{
    return NextResponse.json({ok:false,error:'Enter a Riot ID, tagline and region.'},{status:400});
  }

  if(!isSupportedRegion(input.region)){
    return NextResponse.json(
      {ok:false,error:`Region not supported. Choose one of: ${SUPPORTED_REGIONS.join(', ')}.`},
      {status:400},
    );
  }

  try{
    const account=await riotService.getAccountByRiotId(input.gameName,input.tagline,input.region);
    const rank=await riotService.getSummonerRank(account.puuid,input.region).catch(()=>null);
    const ids=await riotService.getRecentMatches(account.puuid,input.region,{
      count:input.count??10,
      queue:420, // ranked solo/duo — the only queue the coaching model is calibrated for
    });

    const ctx={
      riotAccountId:input.riotAccountId||account.puuid,
      puuid:account.puuid,
      rank:rank?.label,
    };

    // Sequential on purpose. Parallel fan-out is the fastest way to burn a Riot
    // rate limit, and the client already caches immutable match payloads.
    const synced:SyncedMatch[]=[];
    const failures:{matchId:string;reason:string}[]=[];
    for(const id of ids){
      try{
        synced.push(await riotService.getMatchDetails(id,input.region,ctx));
      }catch(err){
        failures.push({matchId:id,reason:err instanceof Error?err.message:'Unknown error'});
      }
    }

    const saved=input.userId
      ?await saveMatches(input.userId,synced)
      :{persisted:false,inserted:0,skipped:synced.length,reason:'No user supplied; nothing was saved.'};

    // Surface which metrics were degraded across the batch, so the UI can be honest.
    const degraded=new Map<string,number>();
    for(const s of synced)for(const key of s.unavailable)degraded.set(key,(degraded.get(key)||0)+1);

    return NextResponse.json({
      ok:true,
      account:{gameName:account.gameName,tagline:account.tagLine,puuid:account.puuid},
      rank,
      // Turning points ride along with the match so the review page can show
      // where the game turned without refetching the timeline.
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
    return NextResponse.json(
      {ok:false,error:'We could not reach Riot for your matches. Your account is safe — try again shortly.'},
      {status:502},
    );
  }
}

export async function GET(){
  return NextResponse.json({
    enabled:riotEnabled(),
    regions:SUPPORTED_REGIONS,
    message:riotEnabled()
      ?'Riot sync is enabled.'
      :'Automatic match sync is coming shortly. Upload a match in the meantime.',
  });
}
