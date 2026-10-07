import {NextRequest,NextResponse} from 'next/server';
import {authenticateTrackerToken,type TrackerDevice} from '@/lib/server/liveTrackerRepository';
import {latestLiveRead} from '@/lib/server/liveReadRepository';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {coachingLevelFor} from '@/lib/coachingLevel';
import {riotService} from '@/lib/services/riotService';
import {riotEnabled} from '@/lib/riot/client';
import {buildPostGameSections,type FightReview,type ReviewMatch} from '@/lib/postGameReview';
import {reviewMarkedMoments} from '@/lib/markedMomentReview';
import {isNewRecentRiotMatch,riotCompanionReview} from '@/lib/riot/companionReviewFallback';
import {companionDnaBaseline} from '@/lib/server/companionDnaBaseline';
import {ensureOneMissionPerDnaStrand} from '@/lib/dnaStrandMissions';
import {canonicalLeagueRole} from '@/lib/roleAwareLearning';
import type {ILPTask} from '@/lib/types';

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

const riotReviewCache=new Map<string,{at:number;review:ReturnType<typeof riotCompanionReview>|null}>();

async function recentRiotReview(device:TrackerDevice,latest:any){
  if(!device.riotAccountId||!riotEnabled())return null;
  if(latest&&!['COMPLETE','ABORTED'].includes(String(latest.status))){
    const lastSeen=Date.parse(String(latest.lastSeenAt||''));
    if(Number.isFinite(lastSeen)&&Date.now()-lastSeen<120_000)return null;
  }
  const cached=riotReviewCache.get(device.id);
  if(cached&&Date.now()-cached.at<30_000){
    if(cached.review&&!isNewRecentRiotMatch(cached.review.endedAt,latest?.endedAt??null))return null;
    return cached.review;
  }
  let review:ReturnType<typeof riotCompanionReview>|null=null;
  try{
    review=await (async()=>{
      const db=getSupabaseAdmin();
      if(!db)return null;
      const {data:account,error}=await db.from('riot_accounts')
        .select('id,region,puuid,rank_tier,rank_division')
        .eq('id',device.riotAccountId).eq('user_id',device.userId).maybeSingle();
      if(error)throw error;
      if(!account?.puuid||!account.region)return null;
      const ids=await riotService.getRecentMatches(account.puuid,account.region,{count:1});
      const id=ids[0];
      if(!id)return null;
      const rank=[account.rank_tier,account.rank_division].filter(Boolean).join(' ')||undefined;
      const details=await riotService.getMatchDetails(id,account.region,{riotAccountId:account.id,puuid:account.puuid,rank});
      if(!isNewRecentRiotMatch(details.match.createdAt,latest?.endedAt??null))return null;
      const activeStarted=latest&&!['COMPLETE','ABORTED'].includes(String(latest.status))?Date.parse(String(latest.startedAt||'')):NaN;
      if(Number.isFinite(activeStarted)&&Date.parse(details.match.createdAt)<activeStarted)return null;
      const playerRank=await resolvePlayerRank(device.userId,device.riotAccountId);
      const coach=coachingLevelFor(playerRank);
      return riotCompanionReview(id,details,{rank:playerRank,tier:coach.tier,depth:coach.depth,summary:coach.summary,reviewPoints:coach.reviewPoints});
    })();
  }catch(error){console.warn('[companion-review] Riot fallback unavailable',error)}
  riotReviewCache.set(device.id,{at:Date.now(),review});
  if(riotReviewCache.size>500)riotReviewCache.clear();
  return review;
}

async function missionEvidenceForMatch(userId:string,riotAccountId:string|null,matchId:string|null,roleValue:unknown){
  const db=getSupabaseAdmin();
  const role=canonicalLeagueRole(roleValue);
  if(!db||!riotAccountId||!matchId||!role)return{primary:null,missions:[]};
  const {data,error}=await db.from('ilp_tasks')
    .select('id,payload,updated_at')
    .eq('user_id',userId)
    .eq('riot_account_id',riotAccountId);
  if(error){
    console.warn('[companion-review] mission evidence lookup failed',error.message);
    return{primary:null,missions:[]};
  }

  const stored=((data??[]).map((row:any)=>({
    ...((row?.payload&&typeof row.payload==='object')?row.payload:{}),
    id:String(row?.id??''),
    updatedAt:row?.updated_at??null,
  })).filter((task:any)=>task?.id)) as Array<ILPTask&{updatedAt?:string|null}>;
  const strandTasks=ensureOneMissionPerDnaStrand(stored,riotAccountId,role).tasks;
  const missions=strandTasks.flatMap(task=>{
    const domain=task.dnaDomain;
    const history=Array.isArray(task.missionHistory)?task.missionHistory:[];
    const attempt=history.find(item=>String(item?.matchId||'')===matchId);
    if(!attempt)return[];
    const confirmed=history.filter(item=>Boolean(item?.banksPass)).length;
    const required=Math.max(1,Number(task.masteryRequired||3));
    const mastered=String(task.status||'').toUpperCase()==='MASTERED'&&Boolean(attempt?.banksPass);
    const evidenceState=String(attempt?.evidenceV2?.state||(
      attempt?.banksPass?'BANKED':attempt?'MISSED':'NOT_OBSERVED'
    ));
    const evidenceV2=attempt?.evidenceV2??null;
    return[{
      missionId:String(task.id),
      title:String(task.title||'Current DNA mission'),
      dnaDomain:String(domain),
      gameRule:String(task.gameRule||''),
      target:String(task.target||''),
      evidenceState,
      evidenceV2,
      evidenceReason:String(evidenceV2?.reason||(
        evidenceState==='BANKED'
          ?'This game produced enough verified evidence to bank a rep.'
          :evidenceState==='MISSED'
            ?'This mission was observed, but the target was not cleared.'
            :'This game did not expose enough reliable evidence to grade this mission.'
      )),
      confirmed,
      required,
      progress:Math.round(Math.min(required,confirmed)/required*100),
      mastered,
    }];
  });

  const best=missions.find(item=>item.mastered)||missions.find(item=>item.evidenceState==='BANKED')||missions.find(item=>item.evidenceState==='MISSED')||missions[0]||null;
  return{
    primary:best?{
      status:best.mastered?'MASTERED':best.evidenceState==='BANKED'?'REP_BANKED':best.evidenceState==='MISSED'?'REP_MISSED':'NOT_OBSERVED',
      ...best,
    }:null,
    missions,
  };
}

export async function GET(req:NextRequest){
  const auth=req.headers.get('authorization')??'';
  const token=/^Bearer\s+(.+)$/i.exec(auth.trim())?.[1]?.trim();
  if(!token)return NextResponse.json({ok:false,error:'Tracker token required.'},{status:401});
  const device=await authenticateTrackerToken(token);
  if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});

  const latest:any=await latestLiveRead(device.userId,device.accountKey,{lean:true});
  const riotReview=await recentRiotReview(device,latest);
  if(riotReview){
    const baseline=await companionDnaBaseline({
      userId:device.userId,
      riotAccountId:device.riotAccountId,
      role:(riotReview as any)?.match?.role??null,
    });
    const matchId=String((riotReview as any)?.matchId||'').trim()||null;
    const missionEvidence=await missionEvidenceForMatch(device.userId,device.riotAccountId,matchId,(riotReview as any)?.match?.role??null);
    const learningSignal=missionEvidence.primary;
    return NextResponse.json({
      ok:true,
      ready:true,
      review:{
        ...riotReview,
        matchId,
        dnaBaseline:baseline,
        learningSignal,
        missionEvidence:missionEvidence.missions,
        progressPath:matchId?('/ilp?game='+encodeURIComponent(matchId)):'/ilp',
      },
    });
  }
  if(!latest||!['COMPLETE','ABORTED'].includes(String(latest.status)))return NextResponse.json({ok:true,ready:false},{status:202});

  const rankChange:RankChange|null=null;
  const rank=await resolvePlayerRank(device.userId,device.riotAccountId);
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
  const markedMoments=reviewMarkedMoments(summary?.capture?.markedMoments,summary?.fightReviews,summary?.points,Number(snapshot?.gameTime||0));
  const db=getSupabaseAdmin();
  const {data:storedMatch}=db
    ?await db.from('matches').select('id').eq('user_id',device.userId).eq('live_session_id',latest.sessionId).maybeSingle()
    :{data:null};
  const matchId=storedMatch?.id?String(storedMatch.id):null;
  const dnaBaseline=await companionDnaBaseline({
    userId:device.userId,
    riotAccountId:device.riotAccountId,
    role:match?.role??null,
  });
  const missionEvidence=await missionEvidenceForMatch(device.userId,device.riotAccountId,matchId,match?.role??null);
  const learningSignal=missionEvidence.primary;

  return NextResponse.json({
    ok:true,ready:true,
    review:{
      sessionId:latest.sessionId,
      matchId,
      progressPath:matchId?('/ilp?game='+encodeURIComponent(matchId)):'/ilp',
      dnaBaseline,
      learningSignal,
      missionEvidence:missionEvidence.missions,
      endedAt:latest.endedAt??latest.lastSeenAt??null,
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
      markedMoments,
      decisionGraph:summary?.decisionGraph??latest.proAnalysis?.decisionGraph??null,
      causalProfile:latest.causalProfile??null,
      playerCoachingIdentity:latest.playerCoachingIdentity??null,
      skillTransferGraph:latest.skillTransferGraph??null,
      decisionPrincipleEngine:latest.decisionPrincipleEngine??null,
      learningVelocity:latest.learningVelocity??null,
      adaptiveCoachingSession:latest.adaptiveCoachingSession??null,
      recognitionEvidence:{
        strengthPoints:(Array.isArray(summary?.points)?summary.points:[]).slice(0,80).map((point:any)=>({
          atSeconds:Number(point?.atSeconds||0),
          verdict:String(point?.verdict||'EVEN'),
          score:Number(point?.score||0),
          opponent:point?.opponent??null,
          comparisonReason:String(point?.comparisonReason||''),
          reasons:Array.isArray(point?.reasons)?point.reasons.slice(0,4):[],
        })),
        fightReviews:(Array.isArray(summary?.fightReviews)?summary.fightReviews:[]).slice(0,40).map((fight:any)=>({
          atSeconds:Number(fight?.atSeconds||0),
          outcome:String(fight?.outcome||''),
          verdict:String(fight?.verdict||''),
          headline:String(fight?.headline||''),
          opponentChampion:fight?.opponentChampion??null,
        })),
        boundary:'POST-GAME EVIDENCE ONLY · NEVER USED TO AUTO-SELECT A LIVE PLAN.',
      },
      developmentPlan,
      reviewFormat:'3-3-2',
    },
  });
}

function developmentPlanFromSync(sync:any,status:unknown){
  const policy='THE PLAYER KEEPS EXACTLY TWO DNA TREES UNLOCKED FOR PROGRESSION. ONLY MISSIONS FROM THOSE TWO TREES CAN BANK A REP, AND EACH RESULT NEEDS TIMESTAMPED EVIDENCE. THREE PROVEN GAMES MASTER A STRAND MISSION.';
  if(String(status)==='ABORTED')return{synced:false,status:'SKIPPED_PARTIAL',changed:false,changes:[],activeFive:[],primary:null,activeCount:0,gamesAnalyzed:0,policy};
  if(sync?.status==='COMPLETE'){
    const activeFive=Array.isArray(sync.activeFive)?sync.activeFive.slice(0,6):[];
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