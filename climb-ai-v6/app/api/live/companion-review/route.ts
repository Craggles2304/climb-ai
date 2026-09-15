import {NextRequest,NextResponse} from 'next/server';
import {authenticateTrackerToken,latestLiveReview} from '@/lib/server/liveTrackerRepository';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {coachingLevelFor} from '@/lib/coachingLevel';
import {riotService} from '@/lib/services/riotService';
import {riotEnabled} from '@/lib/riot/client';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type ReviewPoint={title:string;detail:string;atSeconds?:number};
type FightReview={
  atSeconds:number;
  category:'STRENGTH'|'WEAKNESS';
  outcome:'KILL'|'DEATH'|'ASSIST';
  opponentChampion?:string|null;
  score:number;
  verdict:'YOU_STRONGER'|'EVEN'|'THEM_STRONGER';
  headline:string;
  summary:string;
  why?:string[];
  betterDecision?:string[];
  evidence?:{currentGold?:number;itemGoldDelta?:number|null;levelDelta?:number|null};
};

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
  const strengths=fights.filter(f=>f.category==='STRENGTH');
  const weaknesses=fights.filter(f=>f.category==='WEAKNESS');
  const detailLimit=coach.depth<=2?105:coach.depth<=4?145:coach.depth<=6?185:230;
  const good=buildGood(strengths,detailLimit).slice(0,coach.reviewPoints);
  const critical=buildCritical(weaknesses,detailLimit).slice(0,coach.reviewPoints);

  if(!good.length)good.push({title:'No fake praise',detail:'There was not a positive decision signal strong enough to verify from this match.'});
  if(!critical.length)critical.push({title:'No critical leak confirmed',detail:'No single critical mistake was clear enough to replace your current focus yet.'});

  const topWeakness=rankWeaknesses(weaknesses)[0];
  const nextFocus=topWeakness
    ?{title:nextTitle(topWeakness),rule:short(topWeakness.betterDecision?.[0]||topWeakness.summary,detailLimit)}
    :{title:'REPEAT THE CLEAN DECISIONS',rule:'Keep the same Active Five cue next game and build more evidence before changing focus.'};

  const me=snapshot?findMe(snapshot):null;
  const minutes=snapshot?.gameTime?Math.max(Number(snapshot.gameTime)/60,1/60):0;
  return NextResponse.json({
    ok:true,ready:true,
    review:{
      sessionId:latest.sessionId,
      partial:latest.status==='ABORTED',
      coachLevel:{rank,tier:coach.tier,depth:coach.depth,summary:coach.summary,reviewPoints:coach.reviewPoints},
      rankChange,
      match:me?{
        champion:me.championName||snapshot?.active?.championName||'Unknown',
        role:roleLabel(snapshot?.active?.position||me.position),
        durationSeconds:Number(snapshot?.gameTime||0),
        kda:`${Number(me.scores?.kills||0)} / ${Number(me.scores?.deaths||0)} / ${Number(me.scores?.assists||0)}`,
        csPerMin:minutes?Math.round((Number(me.scores?.creepScore||0)/minutes)*10)/10:null,
      }:null,
      good,critical,nextFocus,
      evidenceCount:fights.length,
    },
  });
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

function buildGood(fights:FightReview[],detailLimit:number):ReviewPoint[]{
  return dedupe([...fights]
    .sort((a,b)=>strengthScore(b)-strengthScore(a))
    .map(f=>({
      title:f.verdict==='YOU_STRONGER'?`Converted your advantage at ${clock(f.atSeconds)}`:f.verdict==='THEM_STRONGER'?`Won from a harder state at ${clock(f.atSeconds)}`:`Clean conversion at ${clock(f.atSeconds)}`,
      detail:short(f.summary,detailLimit),
      atSeconds:f.atSeconds,
    })));
}

function buildCritical(fights:FightReview[],detailLimit:number):ReviewPoint[]{
  return dedupe(rankWeaknesses(fights).map(f=>({
    title:f.verdict==='YOU_STRONGER'?`Threw a favourable state at ${clock(f.atSeconds)}`:f.verdict==='THEM_STRONGER'?`Took an enemy-favoured fight at ${clock(f.atSeconds)}`:`Death from an even state at ${clock(f.atSeconds)}`,
    detail:short(f.betterDecision?.[0]||f.summary,detailLimit),
    atSeconds:f.atSeconds,
  })));
}

function rankWeaknesses(fights:FightReview[]){return [...fights].sort((a,b)=>weaknessScore(b)-weaknessScore(a))}
function weaknessScore(f:FightReview){
  const state=f.verdict==='YOU_STRONGER'?40:f.verdict==='EVEN'?30:24;
  const pocket=Math.min(15,Math.round(Number(f.evidence?.currentGold||0)/150));
  return state+pocket+Math.min(20,Math.abs(Number(f.score||0)));
}
function strengthScore(f:FightReview){const state=f.verdict==='THEM_STRONGER'?34:f.verdict==='YOU_STRONGER'?30:24;return state+Math.min(20,Math.abs(Number(f.score||0)))}
function nextTitle(f:FightReview){if(f.verdict==='YOU_STRONGER')return'PROTECT THE ADVANTAGE';if(f.verdict==='THEM_STRONGER')return'STOP TAKING THE BAD FIGHT';return'CREATE AN EDGE BEFORE COMMITTING'}
function dedupe(items:ReviewPoint[]){const seen=new Set<string>();return items.filter(item=>{const key=item.title.replace(/\d+:\d+/g,'TIME').toLowerCase();if(seen.has(key))return false;seen.add(key);return true})}
function short(value:string,max=210){const clean=String(value||'').replace(/\s+/g,' ').trim();return clean.length>max?`${clean.slice(0,max-1).replace(/\s+\S*$/,'')}…`:clean}
function clock(seconds:number){const s=Math.max(0,Math.floor(Number(seconds)||0));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function roleLabel(value:unknown){const v=String(value||'').toUpperCase();if(v==='BOTTOM')return'ADC';if(v==='UTILITY')return'SUPPORT';if(v==='MIDDLE')return'MID';return v||'UNKNOWN'}
function findMe(snapshot:any){const players=Array.isArray(snapshot?.players)?snapshot.players:[];return players.find((p:any)=>snapshot.active?.riotId&&p.riotId===snapshot.active.riotId)||players.find((p:any)=>snapshot.active?.summonerName&&p.summonerName===snapshot.active.summonerName)||players.find((p:any)=>p.championName===snapshot.active?.championName)||null}
