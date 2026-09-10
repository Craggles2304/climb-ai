import type {AbilitySlot} from './combos';
import {
  simulateBotLane,
  type BotLaneKey,type BotLaneParticipantInput,type BotLaneResult,type BotLaneRole,
} from './botlane';

export interface BotLaneExecutionAssumption{
  /** Opening target access only. Once one enemy dies, normal retargeting resumes. */
  accessTargets:{ADC:boolean;SUPPORT:boolean};
  /** Explicitly forced misses. No probability is inferred. */
  missedAbilities:AbilitySlot[];
}

export type BotLaneExecutionAssumptions=Record<BotLaneKey,BotLaneExecutionAssumption>;

export interface AccessApplication{
  inputs:Record<BotLaneKey,BotLaneParticipantInput>;
  notes:string[];
}

export interface AccessAwareFocusComparison{
  recommendedTarget:BotLaneKey;
  recommendedRole:'ADC'|'SUPPORT';
  reason:string;
  adcFocus:BotLaneResult;
  supportFocus:BotLaneResult;
}

/**
 * Preserve the real cast while removing only target-facing success effects.
 * The spell still spends mana, starts cooldown and takes cast time in botlane.ts.
 */
export function applyForcedMisses(
  input:BotLaneParticipantInput,
  missedAbilities:AbilitySlot[],
):BotLaneParticipantInput{
  if(!missedAbilities.length)return input;
  const missed=new Set(missedAbilities);
  const abilities={...input.abilities};
  const overlays={...(input.abilityOverlays??{})};

  for(const slot of missed){
    const ability=abilities[slot];
    if(ability){
      abilities[slot]={
        ...ability,
        damage:[],
        dynamicDamage:[],
        targetDebuff:undefined,
        eventState:ability.eventState
          ?{...ability.eventState,consumesMarks:[]}
          :ability.eventState,
      };
    }
    const overlay=overlays[slot];
    if(overlay){
      const {targetControl:_targetControl,...selfEffects}=overlay;
      overlays[slot]=selfEffects;
    }
  }

  return {...input,abilities,abilityOverlays:overlays};
}

/**
 * Honour explicit opening access without inventing geometry. If the configured
 * focus target is inaccessible, the actor starts on the other reachable enemy.
 * Access is an opening-state assumption; after a death, the remaining enemy is
 * considered reachable by the existing retarget rule.
 */
export function applyOpeningAccess(
  inputs:Record<BotLaneKey,BotLaneParticipantInput>,
  assumptions:BotLaneExecutionAssumptions,
):AccessApplication{
  const out=cloneInputs(inputs);
  const notes:string[]=[];

  for(const key of Object.keys(out) as BotLaneKey[]){
    const actor=out[key];
    const access=assumptions[key]?.accessTargets??{ADC:true,SUPPORT:true};
    const preferred=out[actor.focusTarget];
    if(!preferred||preferred.team===actor.team)continue;
    if(access[preferred.role])continue;

    const alternate=enemyKey(actor.team,preferred.role==='ADC'?'SUPPORT':'ADC');
    if(access[out[alternate].role]){
      notes.push(`${actor.champion} cannot reach the opening ${preferred.role}; opening focus retargets to ${out[alternate].champion} (${out[alternate].role}).`);
      actor.focusTarget=alternate;
    }
  }

  return {inputs:out,notes};
}

/** Compare ADC-focus and support-focus while preserving each actor's access. */
export function compareFocusTargetsWithAccess(
  inputs:Record<BotLaneKey,BotLaneParticipantInput>,
  assumptions:BotLaneExecutionAssumptions,
  maxDurationSeconds=10,
):AccessAwareFocusComparison{
  const adc=cloneInputs(inputs);
  adc.YOU_ADC.focusTarget='THEM_ADC';
  adc.YOU_SUPPORT.focusTarget='THEM_ADC';
  const adcApplied=applyOpeningAccess(adc,assumptions);
  const adcFocus=simulateBotLane(adcApplied.inputs,maxDurationSeconds);

  const support=cloneInputs(inputs);
  support.YOU_ADC.focusTarget='THEM_SUPPORT';
  support.YOU_SUPPORT.focusTarget='THEM_SUPPORT';
  const supportApplied=applyOpeningAccess(support,assumptions);
  const supportFocus=simulateBotLane(supportApplied.inputs,maxDurationSeconds);

  const adcScore=focusScore(adcFocus,'YOU');
  const supportScore=focusScore(supportFocus,'YOU');
  const recommendAdc=adcScore>=supportScore;
  const target:BotLaneKey=recommendAdc?'THEM_ADC':'THEM_SUPPORT';
  const chosen=recommendAdc?adcFocus:supportFocus;
  const targetName=chosen.participants[target].champion;
  const delta=Math.abs(adcScore-supportScore);
  const accessNote=[...adcApplied.notes,...supportApplied.notes].length
    ?' Opening access changed at least one actor’s requested focus, so this recommendation includes that constraint.'
    :'';

  return {
    recommendedTarget:target,
    recommendedRole:recommendAdc?'ADC':'SUPPORT',
    reason:delta<5
      ?`Both focus plans are close. ${targetName} is the slight deterministic edge. ${accessNote}`.trim()
      :`Focusing ${targetName} produces the stronger team-health/kill outcome in this setup (${round(Math.max(adcScore,supportScore))} vs ${round(Math.min(adcScore,supportScore))} focus score). ${accessNote}`.trim(),
    adcFocus,supportFocus,
  };
}

/** Add visible timeline notes so a zero-damage cast cannot look like a parser bug. */
export function annotateForcedMisses(
  result:BotLaneResult,
  assumptions:BotLaneExecutionAssumptions,
):BotLaneResult{
  const timeline=result.timeline.map(frame=>({
    ...frame,
    actions:frame.actions.map(action=>{
      if(action.step==='AA')return action;
      if(!assumptions[action.actor]?.missedAbilities.includes(action.step))return action;
      return {
        ...action,
        note:[action.note,`FORCED MISS: ${action.step} was configured not to connect, so target damage/CC/debuff/mark consumption is suppressed.`].filter(Boolean).join(' '),
      };
    }),
  }));
  return {...result,timeline};
}

export function executionAssumptionNotes(assumptions:BotLaneExecutionAssumptions):string[]{
  const notes:string[]=[];
  for(const [key,value] of Object.entries(assumptions) as [BotLaneKey,BotLaneExecutionAssumption][]){
    if(value.missedAbilities.length)
      notes.push(`${key}: forced miss ${value.missedAbilities.join(', ')}.`);
    const inaccessible=(['ADC','SUPPORT'] as BotLaneRole[]).filter(role=>!value.accessTargets[role]);
    if(inaccessible.length)
      notes.push(`${key}: no opening access to enemy ${inaccessible.join(' / ')}.`);
  }
  return notes;
}

function cloneInputs(inputs:Record<BotLaneKey,BotLaneParticipantInput>){
  return Object.fromEntries((Object.keys(inputs) as BotLaneKey[]).map(key=>[
    key,
    {
      ...inputs[key],
      sequence:[...inputs[key].sequence],
      abilities:{...inputs[key].abilities},
      abilityOverlays:{...(inputs[key].abilityOverlays??{})},
      allyUtility:{...(inputs[key].allyUtility??{})},
      openingShields:[...(inputs[key].openingShields??[])],
    },
  ])) as Record<BotLaneKey,BotLaneParticipantInput>;
}

function enemyKey(team:'YOU'|'THEM',role:BotLaneRole):BotLaneKey{
  if(team==='YOU')return role==='ADC'?'THEM_ADC':'THEM_SUPPORT';
  return role==='ADC'?'YOU_ADC':'YOU_SUPPORT';
}

function focusScore(result:BotLaneResult,team:'YOU'|'THEM'){
  const enemy=team==='YOU'?'THEM':'YOU';
  const ownDeaths=result.kills.filter(k=>k.team===team).length;
  const enemyDeaths=result.kills.filter(k=>k.team===enemy).length;
  const ownShare=teamHealthShare(result,team);
  const enemyShare=teamHealthShare(result,enemy);
  return (enemyDeaths-ownDeaths)*100+(ownShare-enemyShare)*50;
}

function teamHealthShare(result:BotLaneResult,team:'YOU'|'THEM'){
  const list=Object.values(result.participants).filter(x=>x.team===team);
  return list.reduce((n,x)=>n+x.health+x.shield,0)/Math.max(1,list.reduce((n,x)=>n+x.maxHealth,0));
}

const round=(n:number)=>Math.round(n*10)/10;