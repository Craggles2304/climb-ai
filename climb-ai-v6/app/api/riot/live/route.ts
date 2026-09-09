import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {riotService} from '@/lib/services/riotService';
import {riotEnabled,RiotApiError} from '@/lib/riot/client';
import {isSupportedRegion,SUPPORTED_REGIONS} from '@/lib/riot/regions';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Is this player in a game right now?
 *
 * The client polls this, so two things matter more than anything else:
 *
 *  1. "Not in a game" is the overwhelmingly common answer and is a success,
 *     not an error. It returns 200 with inGame:false.
 *  2. Polling must not burn the Riot rate budget. The limit here is deliberately
 *     tighter than the sync route, and the client is told how long to wait.
 */

const schema=z.object({
  gameName:z.string().min(1).max(32),
  tagline:z.string().min(1).max(8),
  region:z.string().min(2).max(8),
});

/** Seconds the client should wait before asking again. */
const POLL_SECONDS=60;

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'riot-live'),12,60_000);
  if(!limit.ok){
    return NextResponse.json(
      {ok:false,error:'Checking too often. Wait a moment.'},
      {status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}},
    );
  }

  if(!riotEnabled()){
    return NextResponse.json({
      ok:false,code:'RIOT_DISABLED',
      error:'Live game detection needs Riot access, which is not switched on yet.',
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
    const game=await riotService.getActiveGame(account.puuid,input.region);

    return NextResponse.json({
      ok:true,
      inGame:Boolean(game),
      game,
      pollAfterSeconds:POLL_SECONDS,
    });
  }catch(err){
    if(err instanceof RiotApiError){
      // A missing account is the player's typo, not our outage.
      const status=err.status===404?404:err.status===429?429:502;
      return NextResponse.json({ok:false,error:err.message},{status});
    }
    return NextResponse.json(
      {ok:false,error:'We could not reach Riot. Your account is safe — try again shortly.'},
      {status:502},
    );
  }
}

export async function GET(){
  return NextResponse.json({
    enabled:riotEnabled(),
    pollAfterSeconds:POLL_SECONDS,
    message:riotEnabled()
      ?'Live game detection is enabled.'
      :'Live game detection needs Riot access, which is not switched on yet.',
  });
}
