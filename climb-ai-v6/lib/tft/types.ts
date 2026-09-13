export interface TftTrait{
  name:string;
  num_units:number;
  style?:number;
  tier_current?:number;
  tier_total?:number;
}

export interface TftUnit{
  character_id:string;
  name?:string;
  rarity?:number;
  tier?:number;
  itemNames?:string[];
}

export type TftWeakStage='NEVER'|'STAGE_2'|'STAGE_3'|'STAGE_4'|'STAGE_5_PLUS';
export type TftRollTiming='EARLY'|'ON_TIME'|'LATE'|'DID_NOT_ROLL'|'UNKNOWN';
export type TftEconomyChoice='SPENT_TO_STABILISE'|'HELD_FOR_ECON'|'FAST_LEVEL'|'PANIC_ROLL'|'UNKNOWN';
export type TftPivotQuality='FLEXED_EARLY'|'FLEXED_LATE'|'FORCED_CONTESTED'|'STAYED_UNCONTESTED'|'UNKNOWN';
export type TftItemChoice='SLAMMED_TEMPO'|'GREEDY_COMPONENTS'|'BALANCED'|'UNKNOWN';
export type TftPositioningResult='WON_FIGHTS'|'NEUTRAL'|'LOST_FIGHTS'|'UNKNOWN';
export type TftPlanFollowed='YES'|'PARTIAL'|'NO'|'UNKNOWN';
export type TftContested='NONE'|'LIGHT'|'HEAVY'|'UNKNOWN';

export interface TftDecisionReview{
  weakStage?:TftWeakStage;
  rollTiming?:TftRollTiming;
  economyChoice?:TftEconomyChoice;
  pivotQuality?:TftPivotQuality;
  itemChoice?:TftItemChoice;
  positioningResult?:TftPositioningResult;
  planFollowed?:TftPlanFollowed;
  contested?:TftContested;
}

export interface TftMatch{
  id:string;
  riotAccountId:string;
  queueId?:number;
  playedAt:string;
  gameLengthSeconds:number;
  gameVersion:string;
  setNumber?:number;
  setCoreName?:string;
  placement:number;
  level?:number;
  lastRound?:number;
  playersEliminated?:number;
  totalDamageToPlayers?:number;
  goldLeft?:number;
  augments:string[];
  traits:TftTrait[];
  units:TftUnit[];
  companion?:Record<string,unknown>;
  compSignature:string;
  note?:string;
  decisionReview?:TftDecisionReview;
}

export interface TftSummary{
  games:number;
  averagePlacement:number;
  top4Rate:number;
  winRate:number;
  averageLevel:number;
  averageDamage:number;
  recentForm:number;
  previousForm:number|null;
}

export function summarizeTft(matches:TftMatch[]):TftSummary{
  const games=matches.length;
  if(!games)return{games:0,averagePlacement:0,top4Rate:0,winRate:0,averageLevel:0,averageDamage:0,recentForm:0,previousForm:null};
  const avg=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
  const recent=matches.slice(0,5);
  const previous=matches.slice(5,10);
  return{
    games,
    averagePlacement:avg(matches.map(m=>m.placement)),
    top4Rate:matches.filter(m=>m.placement<=4).length/games,
    winRate:matches.filter(m=>m.placement===1).length/games,
    averageLevel:avg(matches.map(m=>m.level||0).filter(Boolean)),
    averageDamage:avg(matches.map(m=>m.totalDamageToPlayers||0).filter(Boolean)),
    recentForm:avg(recent.map(m=>m.placement)),
    previousForm:previous.length?avg(previous.map(m=>m.placement)):null,
  };
}

export function tftCoachingRead(matches:TftMatch[]):{title:string;detail:string;target:string}{
  if(!matches.length)return{title:'BUILD YOUR TFT BASELINE',detail:'Log finished TFT games or sync them later. OP CLIMB can build your placement, comp and consistency model without Riot API access.',target:'Track at least 5 finished games — manual and Riot-imported games count together.'};
  const s=summarizeTft(matches);
  const bottom4=matches.filter(m=>m.placement>=5).length;
  const highGold=matches.filter(m=>(m.goldLeft||0)>=10&&m.placement>=5).length;
  const lateRolls=matches.filter(m=>m.decisionReview?.rollTiming==='LATE'&&m.placement>=5).length;
  const forcedContested=matches.filter(m=>m.decisionReview?.pivotQuality==='FORCED_CONTESTED').length;
  if(highGold>=2||lateRolls>=2)return{title:'SPEND BEFORE YOU BLEED OUT',detail:`${highGold+lateRolls} recent danger-state signals show resources or your roll-down arriving after the board had already lost control.`,target:'For the next 3 danger-state games, define the stabilisation trigger before stage 4 and review whether you acted on time.'};
  if(forcedContested>=2)return{title:'STOP PAYING THE CONTEST TAX',detail:`You recorded ${forcedContested} recent games where you stayed on a heavily contested line. That is now a repeatable flexibility leak, not one unlucky shop.`,target:'Use a two-player contest rule: if two opponents clearly occupy your line before the midgame, record the best viable pivot instead of forcing the same cap.'};
  const lowLevel=matches.filter(m=>(m.level||0)<=7&&m.placement>=5).length;
  if(lowLevel>=2)return{title:'TEMPO IS FALLING BEHIND',detail:`${lowLevel} bottom-four games ended at level 7 or below. The result pattern points to lobby tempo or economy conversion arriving too late.`,target:'Review the stage where your HP first becomes unstable and define the level/roll trigger before the next queue.'};
  if(bottom4>matches.length/2)return{title:'STABILISE THE FLOOR',detail:`Your recent sample is ${Math.round(bottom4/matches.length*100)}% bottom-four. The first job is reducing 7th/8th outcomes before chasing more firsts.`,target:'Aim for 3 top-four finishes in the next 5 ranked games with no 8th.'};
  if(s.top4Rate>=.6)return{title:'TURN TOP FOURS INTO WINS',detail:`You are top-four in ${Math.round(s.top4Rate*100)}% of this sample. The next leak is conversion: preserving enough HP/economy to upgrade the final board.`,target:'After every top-four, record the final missing upgrade, item mismatch or positioning loss that stopped the win.'};
  return{title:'MAKE THE MIDGAME REPEATABLE',detail:`Average placement is ${s.averagePlacement.toFixed(2)}. Your next gain is consistency rather than forcing one comp or one high-roll line.`,target:'Use one clear stage-3 stabilisation rule for the next 5 games and compare placement spread.'};
}
