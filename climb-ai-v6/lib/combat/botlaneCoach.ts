import type {AbilitySlot} from './combos';
import type {BotLaneFocusComparison,BotLaneResult} from './botlane';
import type {LaneContextReport} from './laneContext';

export type LaneCall='SAFE'|'FARM'|'POKE'|'SHORT_TRADE'|'EXTENDED_TRADE'|'ALL_IN';
export type AccessMode='FULL'|'NO_AUTOS';

export interface LaneCoachParticipant{
  champion:string;
  attackRange:number;
  accessMode:AccessMode;
  missedAbilities:AbilitySlot[];
}

export interface BotLaneCoachInput{
  result:BotLaneResult;
  focus:BotLaneFocusComparison;
  yourAdc:LaneCoachParticipant;
  yourSupport:LaneCoachParticipant;
  enemyAdc:LaneCoachParticipant;
  enemySupport:LaneCoachParticipant;
  laneContext?:LaneContextReport|null;
}

export interface BotLaneCoachPlan{
  call:LaneCall;
  headline:string;
  reason:string;
  target:'ADC'|'SUPPORT';
  targetChampion:string;
  rangeDelta:number;
  rangeLabel:'YOU'|'THEM'|'EVEN';
  rules:string[];
  rerunTriggers:string[];
  laneContext?:LaneContextReport|null;
}

/**
 * Deterministic coaching layer for the exact configured 2v2.
 * It never invents a probability. The plan is derived from the shared-clock
 * result plus explicit range/access/hit/lane assumptions supplied by the player.
 * Lane context constrains advice but never rewrites champion damage behind the scenes.
 */
export function buildBotLaneCoachPlan(input:BotLaneCoachInput):BotLaneCoachPlan{
  const {result,focus,laneContext}=input;
  const rangeDelta=round(input.yourAdc.attackRange-input.enemyAdc.attackRange);
  const rangeLabel=Math.abs(rangeDelta)<25?'EVEN':rangeDelta>0?'YOU':'THEM';
  const target=focus.recommendedRole;
  const targetKey=focus.recommendedTarget;
  const targetChampion=result.participants[targetKey].champion;

  const noAutoAccess=input.yourAdc.accessMode==='NO_AUTOS';
  let call:LaneCall;
  if(result.winner==='YOU')call='ALL_IN';
  else if(result.winner==='THEM')call='SAFE';
  else if(noAutoAccess)call='FARM';
  else if(result.verdict==='YOU_AHEAD')call=rangeDelta>=25?'POKE':'EXTENDED_TRADE';
  else if(result.verdict==='THEM_AHEAD')call=rangeDelta<=-25?'FARM':'SHORT_TRADE';
  else call=rangeDelta>=50?'POKE':rangeDelta<=-50?'FARM':'SHORT_TRADE';

  const first=result.firstKill;
  const firstText=first
    ?`${first.champion} is the first death at ${first.atSeconds}s in this exact script.`
    :'Nobody dies inside the selected fight window.';
  const damageText=`Your duo deals ${result.teamDamage.YOU} damage; their duo deals ${result.teamDamage.THEM}.`;
  const laneFact=laneContext
    ?`Wave context: ${laneLabel(laneContext.facts.wavePosition)}, ${laneContext.facts.yourMinions} your minions vs ${laneContext.facts.enemyMinions} enemy minions.`
    :'';
  const reason=[damageText,firstText,focus.reason,laneFact].filter(Boolean).join(' ');

  const rules:string[]=[];
  if(rangeLabel==='THEM')
    rules.push(`Respect the ${Math.abs(rangeDelta)}-unit ADC range deficit. Do not start with a raw auto exchange unless your support has already created access.`);
  else if(rangeLabel==='YOU')
    rules.push(`You hold a ${Math.abs(rangeDelta)}-unit ADC range edge. Take the first clean hit and leave before their support converts it into an extended fight.`);
  else
    rules.push('ADC attack ranges are effectively even in this setup, so support CC/shield timing decides who gets the cleaner first action.');

  if(call==='ALL_IN'||call==='EXTENDED_TRADE')
    rules.push(`When the fight begins on these assumptions, keep damage on ${targetChampion}. The focus comparison prefers the enemy ${target.toLowerCase()}.`);
  else
    rules.push(`Your default target is still ${targetChampion}, but do not force access just to reach them; the recommendation assumes your configured actions can connect.`);

  if(input.yourSupport.accessMode==='NO_AUTOS')
    rules.push(`${input.yourSupport.champion} is configured with no auto access, so the result only values their spell/utility contribution.`);

  if(laneContext)rules.push(...laneContext.constraints);

  const rerunTriggers:string[]=[];
  for(const participant of [input.yourAdc,input.yourSupport,input.enemyAdc,input.enemySupport]){
    if(participant.missedAbilities.length)
      rerunTriggers.push(`${participant.champion}: ${participant.missedAbilities.join('/')} is currently set to MISS. Toggle it to HIT to see the lane flip if it connects.`);
  }
  if(noAutoAccess)
    rerunTriggers.push(`${input.yourAdc.champion}: autos are currently excluded by the access assumption. Switch to FULL ACCESS when support CC/spacing gives you an auto window.`);
  if(laneContext)rerunTriggers.push(...laneContext.rerunTriggers);
  if(!rerunTriggers.length)
    rerunTriggers.push('Change a key skillshot from HIT to MISS, swap the focus target, remove auto access, or change the explicit lane state to test how fragile this result is.');

  return {
    call,
    headline:headline(call,targetChampion,laneContext),
    reason,
    target,
    targetChampion,
    rangeDelta,
    rangeLabel,
    rules:[...new Set(rules)],
    rerunTriggers:[...new Set(rerunTriggers)],
    laneContext:laneContext??null,
  };
}

function headline(call:LaneCall,target:string,laneContext?:LaneContextReport|null){
  const towerWarning=laneContext?.facts.wavePosition==='THEIR_TOWER'&&call==='ALL_IN';
  if(towerWarning)return `ALL-IN ADVANTAGE · NOT A DIVE CALL ON ${target.toUpperCase()}`;
  if(call==='ALL_IN')return `ALL-IN WINDOW · COMMIT ON ${target.toUpperCase()}`;
  if(call==='EXTENDED_TRADE')return `EXTEND THE FIGHT · KEEP HITTING ${target.toUpperCase()}`;
  if(call==='POKE')return 'POKE FIRST · DO NOT GIVE THE RETURN TRADE FOR FREE';
  if(call==='FARM')return 'FARM FIRST · WAIT FOR ACCESS';
  if(call==='SAFE')return 'SAFE · THIS SCRIPT LOSES THE 2V2';
  return 'SHORT TRADE · HIT, TAKE THE EDGE, LEAVE';
}

const laneLabel=(position:LaneContextReport['facts']['wavePosition'])=>position.replaceAll('_',' ').toLowerCase();
const round=(n:number)=>Math.round(n*10)/10;
