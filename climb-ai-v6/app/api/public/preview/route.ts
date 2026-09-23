import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {riotService} from '@/lib/services/riotService';
import {riotEnabled,RiotApiError} from '@/lib/riot/client';
import {isSupportedRegion,SUPPORTED_REGIONS} from '@/lib/riot/regions';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {buildPublicPreview} from '@/lib/publicPreview';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  gameName:z.string().trim().min(1).max(32),
  tagline:z.string().trim().min(1).max(8),
  region:z.string().trim().min(2).max(8),
});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'public-riot-preview'),3,60_000);
  if(!limit.ok){
    return NextResponse.json({ok:false,error:'Too many analyses from this connection. Wait a moment and try again.'},{status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}});
  }

  if(!riotEnabled()){
    return NextResponse.json({ok:false,code:'RIOT_DISABLED',error:'Riot match analysis is temporarily unavailable. You can still open the sample report below.'},{status:503});
  }

  let input:z.infer<typeof schema>;
  try{input=schema.parse(await req.json())}
  catch{return NextResponse.json({ok:false,error:'Enter a Riot ID, tagline and region.'},{status:400})}

  const region=input.region.toUpperCase();
  if(!isSupportedRegion(region)){
    return NextResponse.json({ok:false,error:`Region not supported. Choose one of: ${SUPPORTED_REGIONS.join(', ')}.`},{status:400});
  }

  const cleanName=input.gameName.trim();
  const cleanTag=input.tagline.replace(/^#/,'').trim().toUpperCase();

  try{
    const account=await riotService.getAccountByRiotId(cleanName,cleanTag,region);
    const [rank,ids]=await Promise.all([
      riotService.getSummonerRank(account.puuid,region).catch(()=>null),
      riotService.getRecentMatches(account.puuid,region,{count:20,queue:420}),
    ]);

    if(!ids.length){
      return NextResponse.json({ok:false,error:'We found the Riot ID, but there were no recent ranked solo games to analyse.'},{status:404});
    }

    const ctx={riotAccountId:'public-preview',puuid:account.puuid,rank:rank?.label};
    const results:Awaited<ReturnType<typeof riotService.getMatchDetails>>[]=[];
    for(let start=0;start<ids.length;start+=4){
      const batch=ids.slice(start,start+4);
      const settled=await Promise.allSettled(batch.map(id=>riotService.getMatchDetails(id,region,ctx)));
      for(const item of settled)if(item.status==='fulfilled')results.push(item.value);
    }

    if(!results.length){
      return NextResponse.json({ok:false,error:'Riot returned the account, but the recent match timelines could not be read.'},{status:502});
    }

    const report=buildPublicPreview(results.map(item=>item.match),rank?.label||'UNRANKED');
    return NextResponse.json({
      ok:true,
      account:{gameName:account.gameName,tagline:account.tagLine,region},
      report,
      partial:true,
      note:'This public result is intentionally partial. Create a free account to keep the history and build the full climb plan.',
    });
  }catch(err){
    if(err instanceof RiotApiError){
      if(err.status===404)return NextResponse.json({ok:false,error:'That Riot ID was not found for the selected region.'},{status:404});
      if(err.status===429)return NextResponse.json({ok:false,error:'Riot is rate-limiting requests right now. Try again shortly.'},{status:429});
      return NextResponse.json({ok:false,error:'Riot could not return that account right now. Try again shortly.'},{status:502});
    }
    return NextResponse.json({ok:false,error:err instanceof Error?err.message:'We could not analyse that Riot ID right now.'},{status:502});
  }
}

export async function GET(){
  return NextResponse.json({enabled:riotEnabled(),regions:SUPPORTED_REGIONS});
}
