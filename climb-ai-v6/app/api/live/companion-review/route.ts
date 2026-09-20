import {NextRequest,NextResponse} from 'next/server';
import {authenticateTrackerToken,latestLiveReview} from '@/lib/server/liveTrackerRepository';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {coachingLevelFor} from '@/lib/coachingLevel';
import {riotService} from '@/lib/services/riotService';
import {riotEnabled} from '@/lib/riot/client';
import {buildPostGameSections,type FightReview,type ReviewMatch} from '@/lib/postGameReview';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type RankChange={
  previous:string;
  current:string;
  previousTier:string;
  currentTier:string;
  previousDivision:string;
  currentDivision:string;
  movedUp:boolean;
  coachingLayerChanged:boolean;
};

export async function GET(req:NextRequest){
  const auth=req.headers.get('authorization')??'';
  const token=/^Bearer\s+(.+)$/i.exec(auth.trim())?.[1]?.trim();
  if(!token)return NextResponse.json({ok:false,error:'Tracker token required.'},{status:401});
  const device=await authenticateTrackerToken(token);
  if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});

  const latest=await latestLiveReview(device.userId,device.accountKey);
  if(!latest||!['COMPLETE','ABORTED'].includes(String(latest.status)))return NextResponse.json({ok:true,ready:false},{status:202});

  const rankChange=await refreshPlayerRank(device.userId,device.riotAccountId).catch(()=>null);
  const rank=rankChange?.current||await resolvePlayerRank(device.userId,device.riotAccountId);
  const coach=coachingLevelFor(rank);
  const snapshot=latest.latestSnapshot as any;
  const summary=latest.summary as any;
  const fights=(Array.isArray(summary?.fightReviews)?summary.fightReviews:[]) as FightReview[];
  const detailLimit=coach.depth<=2?105:coach.depth<=4?145:coach.depth<=6?185:230;
  const me=snapshot?findMe(snapshot):null;
  const minutes=snapshot?.gameTime?Math.max(Number(snapshot.gameTime)/60,1/60):0;
  const match:ReviewMatch=me?{
    champion:me.championName||snapshot?.active?.championName||'Unknown',
    role:roleLabel(snapshot?.active?.position||me.position),
    durationSeconds:Number(snapshot?.gameTime||0),
    kda:`${Number(me.scores?.kills||0)} / ${Number(me.scores?.deaths||0)} / ${Number(me.scores?.assists||0)}`,
    csPerMin:minutes?Math.round((Number(me.scores?.creepScore||0)/minutes)*10)/10:null,
  }:null;
  const sections=buildPostGameSections({
    fights,
    match,
    partial:latest.status==='ABORTED',
    detailLimit,
  });
  const developmentPlan=developmentPlanFromSync((latest.summary as any)?.learningPlanSync,latest.status);

  return NextResponse.json({
    ok:true,ready:true,
    review:{
      sessionId:latest.sessionId,
      partial:latest.status==='ABORTED',
      coachLevel:{rank,tier:coach.tier,depth:coach.depth,summary:coach.summary,reviewPoints:coach.reviewPoints},
      rankChange,
      match,
      doneWell:sections.doneWell,
      improve:sections.improve,
      neutral:sections.neutral,
      // Keep the original keys during the Companion rollout so older desktop
      // builds still render a useful review until they auto-update.
      good:sections.doneWell,
      critical:sections.improve,
      nextFocus:sections.nextFocus,
      evidenceCount:sections.evidenceCount,
      decisionGraph:summary?.decisionGraph??latest.proAnalysis?.decisionGraph??null,
      developmentPlan,
      reviewFormat:'3-3-2',
    },
  });
}

function developmentPlanFromSync(sync:any,status:unknown){
  const policy='ONE_MATCH_CAN_PROGRESS EVIDENCE, BUT REPEATED EVIDENCE IS REQUIRED TO REPLACE OR REOPEN A DEVELOPMENT MISSION.';
  if(String(status)==='ABORTED')return{synced:false,status:'SKIPPED_PARTIAL',changed:false,changes:[],activeFive:[],primary:null,activeCount:0,gamesAnalyzed:0,policy};
  if(sync?.status==='COMPLETE'){
    const activeFive=Array.isArray(sync.activeFive)?sync.activeFive.slice(0,5):[];
    return{
      synced:true,
      status:'COMPLETE',
      changed:Boolean(sync.changed),
      changes:Array.isArray(sync.changes)?sync.changes.slice(0,8):[],
      activeFive,
      primary:sync.primary??activeFive[0]??null,
      activeCount:Number(sync.activeCount||activeFive.length),
      gamesAnalyzed:Number(sync.gamesAnalyzed||0),
      processedAnalysisAt:sync.processedAnalysisAt??null,
      reused:Boolean(sync.reused),
      policy,
    };
  }
  return{synced:false,status:String(sync?.status||'UNAVAILABLE'),changed:false,changes:[],activeFive:[],primary:null,activeCount:0,gamesAnalyzed:0,policy};
}

async function refreshPlayerRank(userId:string,riotAccountId:string|null):Promise<RankChange|null>{
  const db=getSupabaseAdmin();
  if(!db||!riotAccountId||!riotEnabled())return null;
  const {data:account,error}=await db.from('riot_accounts')
    .select('id,game_name,tagline,region,puuid,rank_tier,rank_division,league_points')
    .eq('id',riotAccountId)
    .eq('user_id',userId)
    .maybeSingle();
  if(error||!account)return null;

  let puuid=String(account.puuid||'').trim();
  if(!puuid){
    const resolved=await riotService.getAccountByRiotId(String(account.game_name||''),String(account.tagline||''),String(account.region||''));
    puuid=resolved.puuid;
  }
  if(!puuid)return null;

  const fresh=await riotService.getSummonerRank(puuid,String(account.region||''));
  if(!fresh?.tier)return null;

  const previousTier=cleanTier(account.rank_tier);
  const previousDivision=cleanDivision(account.rank_division);
  const currentTier=cleanTier(fresh.tier);
  const currentDivision=cleanDivision(fresh.division);
  const now=new Date().toISOString();

  await db.from('riot_accounts').update({
    puuid,
    rank_tier:fresh.tier,
    rank_division:fresh.division||null,
    league_points:fresh.leaguePoints,
    last_synced_at:now,
    updated_at:now,
  }).eq('id',riotAccountId).eq('user_id',userId);
  await db.from('profiles').update({rank:fresh.label,updated_at:now}).eq('id',userId);

  if(!previousTier)return null;
  const previous=rankLabel(previousTier,previousDivision,account.league_points);
  const current=rankLabel(currentTier,currentDivision,fresh.leaguePoints);
  const movedUp=rankStrength(currentTier,currentDivision)>rankStrength(previousTier,previousDivision);
  const changed=previousTier!==currentTier||previousDivision!==currentDivision;
  if(!changed)return null;

  return{
    previous,
    current,
    previousTier,
    currentTier,
    previousDivision,
    currentDivision,
    movedUp,
    coachingLayerChanged:previousTier!==currentTier,
  };
}

async function resolvePlayerRank(userId:string,riotAccountId:string|null){
  const db=getSupabaseAdmin();
  if(!db)return'Silver';
  const profilePromise=db.from('profiles').select('rank').eq('id',userId).maybeSingle();
  const riotPromise=riotAccountId?db.from('riot_accounts').select('rank_tier,rank_division').eq('id',riotAccountId).maybeSingle():Promise.resolve({data:null,error:null});
  const [profileResult,riotResult]=await Promise.all([profilePromise,riotPromise]);
  const tier=String(riotResult?.data?.rank_tier??'').trim();
  const division=String(riotResult?.data?.rank_division??'').trim();
  if(tier)return`${tier}${division?` ${division}`:''}`;
  return String(profileResult?.data?.rank||'Silver');
}

const TIER_ORDER=['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'];
const DIVISION_ORDER:Record<string,number>={IV:0,III:1,II:2,I:3};
function cleanTier(value:unknown){return String(value||'').trim().toUpperCase()}
function cleanDivision(value:unknown){return String(value||'').trim().toUpperCase()}
function rankStrength(tier:string,division:string){
  const tierIndex=Math.max(0,TIER_ORDER.indexOf(cleanTier(tier)));
  return tierIndex*10+(DIVISION_ORDER[cleanDivision(division)]??0);
}
function rankLabel(tier:string,division:string,lp:unknown){
  const pretty=tier?`${tier[0]}${tier.slice(1).toLowerCase()}`:'Unranked';
  const points=Number(lp);
  return`${pretty}${division?` ${division}`:''}${Number.isFinite(points)?` · ${points} LP`:''}`;
}

function roleLabel(value:unknown){const v=String(value||'').toUpperCase();if(v==='BOTTOM')return'ADC';if(v==='UTILITY')return'SUPPORT';if(v==='MIDDLE')return'MID';return v||'UNKNOWN'}
function findMe(snapshot:any){const players=Array.isArray(snapshot?.players)?snapshot.players:[];return players.find((p:any)=>snapshot.active?.riotId&&p.riotId===snapshot.active.riotId)||players.find((p:any)=>snapshot.active?.summonerName&&p.summonerName===snapshot.active.summonerName)||players.find((p:any)=>p.championName===snapshot.active?.championName)||null}
