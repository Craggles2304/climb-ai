import {Match,MatchMetrics,Role,MatchResult} from '../types';
import {RiotMatchDto,RiotTimelineDto,RiotParticipant,RiotTimelineFrame,RiotTimelineEvent,RiotParticipantFrame} from './riotTypes';

/**
 * Turns a Riot MATCH-V5 match (+ its timeline) into this app's internal Match model.
 *
 * Design rules, in order of importance:
 *  1. Never invent a number. Anything that cannot be derived from the payloads is
 *     left `undefined` and named in `unavailable`, per the product rule that an
 *     uncomputable metric is marked unavailable rather than guessed.
 *  2. The output shape is identical to manually-uploaded matches, so the UI does
 *     not change when Riot sync is switched on.
 *  3. Pure. No fetching, no clock, no environment access — so it is testable
 *     against fixtures.
 */

export interface MapMatchOptions{
  /**
   * Item IDs that count as a *completed* item for item-timing metrics.
   * Supply from Data Dragon (item.json). Without it, item timings are reported
   * as unavailable rather than guessed from raw purchase order.
   */
  completedItemIds?:ReadonlySet<number>;
  /** Rank label to stamp on the match, e.g. "Gold IV". */
  rank?:string;
  /** Internal riot_accounts id this match belongs to. */
  riotAccountId:string;
}

export interface MapMatchResult{
  /** Turning points from the timeline, when one was available. */
  moments?:import('./keyMoments').KeyMoment[];
  match:Match;
  /** Metric keys that could not be derived from the supplied payloads. */
  unavailable:string[];
}

const POSITION_TO_ROLE:Record<string,Role>={
  TOP:'TOP',JUNGLE:'JUNGLE',MIDDLE:'MID',MID:'MID',BOTTOM:'ADC',BOT:'ADC',UTILITY:'SUPPORT',SUPPORT:'SUPPORT',
};

const round=(n:number,dp=2)=>Number(n.toFixed(dp));

/** gameDuration is seconds when gameEndTimestamp exists, milliseconds on older records. */
export function durationSeconds(info:RiotMatchDto['info']):number{
  if(typeof info.gameEndTimestamp==='number')return Math.round(info.gameDuration);
  return info.gameDuration>10000?Math.round(info.gameDuration/1000):Math.round(info.gameDuration);
}

/** Last frame at or before `minute`. Null if the game ended first. */
export function frameAtMinute(frames:RiotTimelineFrame[],minute:number):RiotTimelineFrame|null{
  const cutoff=minute*60_000;
  let found:RiotTimelineFrame|null=null;
  for(const f of frames){
    if(f.timestamp<=cutoff)found=f;
    else break;
  }
  // Only trust the sample if the game actually reached that minute.
  if(!found)return null;
  const last=frames[frames.length-1];
  if(last.timestamp<cutoff-30_000)return null;
  return found;
}

const csOf=(pf:RiotParticipantFrame|undefined)=>
  pf?((pf.minionsKilled||0)+(pf.jungleMinionsKilled||0)):undefined;

function allEvents(timeline:RiotTimelineDto):RiotTimelineEvent[]{
  const out:RiotTimelineEvent[]=[];
  for(const f of timeline.info.frames)if(f.events)out.push(...f.events);
  return out;
}

export function mapRiotMatch(
  dto:RiotMatchDto,
  timeline:RiotTimelineDto|null,
  puuid:string,
  opts:MapMatchOptions,
):MapMatchResult{
  const me=dto.info.participants.find(p=>p.puuid===puuid);
  if(!me)throw new Error(`Participant ${puuid} is not in match ${dto.metadata.matchId}.`);

  const unavailable:string[]=[];
  const secs=durationSeconds(dto.info);
  const minutes=secs/60;
  const position=me.teamPosition||me.individualPosition||'';
  const role:Role=POSITION_TO_ROLE[position.toUpperCase()]||'MID';
  if(!POSITION_TO_ROLE[position.toUpperCase()])unavailable.push('role');

  const totalCs=(me.totalMinionsKilled||0)+(me.neutralMinionsKilled||0);
  const opponent=dto.info.participants.find(
    p=>p.teamId!==me.teamId&&(p.teamPosition||p.individualPosition)===position,
  );

  const metrics:MatchMetrics={
    cs:totalCs,
    csPerMin:minutes>0?round(totalCs/minutes):0,
    deaths:me.deaths,
  };

  if(typeof me.goldEarned==='number'&&minutes>0)metrics.goldPerMin=round(me.goldEarned/minutes);
  if(typeof me.totalDamageDealtToChampions==='number'&&minutes>0)metrics.damagePerMin=round(me.totalDamageDealtToChampions/minutes);
  if(typeof me.visionScore==='number')metrics.visionScore=me.visionScore;
  if(typeof me.wardsPlaced==='number')metrics.wardsPlaced=me.wardsPlaced;
  if(typeof me.visionWardsBoughtInGame==='number')metrics.controlWards=me.visionWardsBoughtInGame;

  // Riot supplies these as pre-computed challenges on modern patches only.
  if(typeof me.challenges?.killParticipation==='number')metrics.killParticipation=round(me.challenges.killParticipation,3);
  else unavailable.push('killParticipation');
  if(typeof me.challenges?.teamDamagePercentage==='number')metrics.damageShare=round(me.challenges.teamDamagePercentage,3);
  else unavailable.push('damageShare');

  if(!timeline){
    // Everything below is timeline-derived. The ILP engine scores on several of
    // these, so a missing timeline is a real degradation, not a cosmetic one.
    unavailable.push('csAt10','csAt15','laneCsPerMin','post15CsPerMin','goldDiffAt15','xpDiffAt15',
      'levelAt15','deathsPre10','deaths10to20','deathsPost20','soloDeaths','teamfightDeaths',
      'firstItemMinute','secondItemMinute','thirdItemMinute','objectiveParticipation');
    return {match:buildMatch(dto,me,role,secs,metrics,opts),unavailable};
  }

  const frames=timeline.info.frames;
  const pid=String(me.participantId);
  const oppPid=opponent?String(opponent.participantId):null;

  const f10=frameAtMinute(frames,10);
  const f15=frameAtMinute(frames,15);

  const cs10=csOf(f10?.participantFrames[pid]);
  if(cs10!==undefined)metrics.csAt10=cs10; else unavailable.push('csAt10');

  const cs15=csOf(f15?.participantFrames[pid]);
  if(cs15!==undefined){
    metrics.csAt15=cs15;
    metrics.laneCsPerMin=round(cs15/15);
    if(minutes>15){
      metrics.post15CsPerMin=round(Math.max(0,totalCs-cs15)/(minutes-15));
    }else{
      unavailable.push('post15CsPerMin');
    }
  }else{
    unavailable.push('csAt15','laneCsPerMin','post15CsPerMin');
  }

  const myF15=f15?.participantFrames[pid];
  const oppF15=oppPid?f15?.participantFrames[oppPid]:undefined;
  if(myF15&&oppF15&&typeof myF15.totalGold==='number'&&typeof oppF15.totalGold==='number'){
    metrics.goldDiffAt15=myF15.totalGold-oppF15.totalGold;
  }else unavailable.push('goldDiffAt15');
  if(myF15&&oppF15&&typeof myF15.xp==='number'&&typeof oppF15.xp==='number'){
    metrics.xpDiffAt15=myF15.xp-oppF15.xp;
  }else unavailable.push('xpDiffAt15');
  if(typeof myF15?.level==='number')metrics.levelAt15=myF15.level;
  else unavailable.push('levelAt15');

  // --- deaths, bucketed by game time -----------------------------------------
  const events=allEvents(timeline);
  const myDeaths=events.filter(e=>e.type==='CHAMPION_KILL'&&e.victimId===me.participantId);
  metrics.deathsPre10=myDeaths.filter(e=>e.timestamp<600_000).length;
  metrics.deaths10to20=myDeaths.filter(e=>e.timestamp>=600_000&&e.timestamp<1_200_000).length;
  metrics.deathsPost20=myDeaths.filter(e=>e.timestamp>=1_200_000).length;
  // A death with no assisting killers is a 1v1 loss; three or more attackers
  // reads as a teamfight. This is an inference, not a Riot-provided fact.
  metrics.soloDeaths=myDeaths.filter(e=>(e.assistingParticipantIds?.length||0)===0).length;
  metrics.teamfightDeaths=myDeaths.filter(e=>1+(e.assistingParticipantIds?.length||0)>=3).length;

  // --- item timings ----------------------------------------------------------
  if(opts.completedItemIds&&opts.completedItemIds.size>0){
    const completions=events
      .filter(e=>e.type==='ITEM_PURCHASED'&&e.participantId===me.participantId
        &&typeof e.itemId==='number'&&opts.completedItemIds!.has(e.itemId))
      .map(e=>round(e.timestamp/60_000,1))
      .sort((a,b)=>a-b);
    if(completions[0]!==undefined)metrics.firstItemMinute=completions[0]; else unavailable.push('firstItemMinute');
    if(completions[1]!==undefined)metrics.secondItemMinute=completions[1]; else unavailable.push('secondItemMinute');
    if(completions[2]!==undefined)metrics.thirdItemMinute=completions[2]; else unavailable.push('thirdItemMinute');
  }else{
    unavailable.push('firstItemMinute','secondItemMinute','thirdItemMinute');
  }

  // --- objective involvement -------------------------------------------------
  // Riot does not publish a participation rate. We derive it: of the objectives
  // this player's team took, how many did the player take part in?
  const teamObjectives=events.filter(e=>
    (e.type==='ELITE_MONSTER_KILL'||e.type==='BUILDING_KILL')
    &&isMyTeamObjective(e,me,dto));
  if(teamObjectives.length>0){
    const involved=teamObjectives.filter(e=>
      e.killerId===me.participantId||(e.assistingParticipantIds||[]).includes(me.participantId)).length;
    metrics.objectiveParticipation=round(involved/teamObjectives.length,3);
  }else{
    unavailable.push('objectiveParticipation');
  }

  return {match:buildMatch(dto,me,role,secs,metrics,opts),unavailable};
}

function isMyTeamObjective(e:RiotTimelineEvent,me:RiotParticipant,dto:RiotMatchDto):boolean{
  if(e.type==='BUILDING_KILL'){
    // BUILDING_KILL.teamId is the team that *owned* the building, so ours is the other one.
    return typeof e.teamId==='number'?e.teamId!==me.teamId:false;
  }
  const killer=dto.info.participants.find(p=>p.participantId===e.killerId);
  return !!killer&&killer.teamId===me.teamId;
}

function buildMatch(
  dto:RiotMatchDto,
  me:RiotParticipant,
  role:Role,
  secs:number,
  metrics:MatchMetrics,
  opts:MapMatchOptions,
):Match{
  const opponent=dto.info.participants.find(
    p=>p.teamId!==me.teamId
      &&(p.teamPosition||p.individualPosition)===(me.teamPosition||me.individualPosition),
  );
  const items=[me.item0,me.item1,me.item2,me.item3,me.item4,me.item5]
    .filter((id):id is number=>typeof id==='number'&&id>0)
    .map(String);
  const occurredAt=dto.info.gameEndTimestamp??dto.info.gameStartTimestamp??dto.info.gameCreation;

  return {
    id:dto.metadata.matchId,
    riotAccountId:opts.riotAccountId,
    champion:me.championName,
    opponent:opponent?.championName,
    role,
    result:(me.win?'WIN':'LOSS') as MatchResult,
    kills:me.kills,
    deaths:me.deaths,
    assists:me.assists,
    durationSeconds:secs,
    rank:opts.rank||'UNRANKED',
    metrics,
    items,
    source:'riot',
    createdAt:occurredAt?new Date(occurredAt).toISOString():new Date(0).toISOString(),
  };
}
