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

export interface TftGamePlan{
  economyRule:string;
  stabilizeRule:string;
  flexRule:string;
  positioningCue:string;
  lockedAt:string;
}

export interface TftReviewAssessment{
  round:string;
  verdict:'HELPED'|'HURT'|'UNCERTAIN';
  reason:string;
}
export interface TftDecisionReview{
  assessments?:Partial<Record<'ECONOMY'|'TEMPO'|'BOARD_BUILDING'|'FLEXIBILITY'|'ITEMS_AUGMENTS'|'CONVERSION',TftReviewAssessment>>;
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
  planSnapshot?:TftGamePlan;
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
  return{title:'REVIEW A DECISION, NOT JUST THE RESULT',detail:'Your match results provide context. Add a round and an explanation of a spending, board, item or pivot decision before OP CLIMB grades that skill.',target:'Record a game, open its timeline and review one concrete decision. Missing evidence stays ungraded.'};
}
