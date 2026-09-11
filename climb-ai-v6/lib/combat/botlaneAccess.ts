import type {AbilitySlot} from './combos';
import type {BotLaneParticipantInput} from './botlane';
import type {AccessMode} from './botlaneCoach';
import {resolveStaticRangeAccess} from './access';

export interface BotLaneStaticAccessInput{
  participant:BotLaneParticipantInput;
  requestedAccessMode:AccessMode;
  attackRange:number;
  abilityRanges:Partial<Record<AbilitySlot,number|null>>;
  targetDistance?:number;
}

export interface BotLaneStaticAccessResult{
  participant:BotLaneParticipantInput;
  effectiveAccessMode:AccessMode;
  notes:string[];
  partial:string[];
  blockedAutos:boolean;
  blockedAbilities:AbilitySlot[];
}

/**
 * Apply one explicit, static target-distance assumption to a prepared Bot Duo
 * participant. This is intentionally not a movement simulator: it can prove an
 * action is already in/out of a published range, but it will not walk, dash or
 * predict a skillshot connection to manufacture access.
 */
export function applyBotLaneStaticAccess(
  input:BotLaneStaticAccessInput,
):BotLaneStaticAccessResult{
  const {participant,requestedAccessMode,attackRange,abilityRanges,targetDistance}=input;
  const notes:string[]=[];
  const partial:string[]=[];
  const blockedAbilities:AbilitySlot[]=[];
  const abilities={...participant.abilities};
  const abilityOverlays={...(participant.abilityOverlays??{})};
  const allyUtility={...(participant.allyUtility??{})};
  const distanceWasExplicit=targetDistance!==undefined;

  const autoAccess=resolveStaticRangeAccess(
    targetDistance,attackRange,`${participant.champion} basic attack`,
  );
  const blockedAutos=requestedAccessMode==='NO_AUTOS'||autoAccess.status==='OUT_OF_RANGE';
  const effectiveAccessMode:AccessMode=blockedAutos?'NO_AUTOS':'FULL';

  if(requestedAccessMode==='NO_AUTOS')
    notes.push(`${participant.champion}: NO AUTO ACCESS is explicitly selected, so basic attacks are removed.`);
  if(distanceWasExplicit){
    notes.push(autoAccess.reason);
    notes.push(`${participant.champion}: target distance is held static at ${round(targetDistance)}u; movement, dashes, hitbox padding and hit probability are not inferred.`);
    if(requestedAccessMode==='FULL'&&autoAccess.status==='OUT_OF_RANGE')
      notes.push(`${participant.champion}: basic attacks are removed because ${round(targetDistance)}u exceeds the current ${round(attackRange)}u attack range.`);
  }

  if(distanceWasExplicit){
    for(const slot of ['Q','W','E','R'] as AbilitySlot[]){
      const model=abilities[slot];
      if(!model||allyUtility[slot])continue;
      const overlay=abilityOverlays[slot];
      const enemyFacing=Boolean(
        model.damage.length
        ||model.dynamicDamage?.length
        ||model.targetDebuff
        ||overlay?.targetControl
      );
      if(!enemyFacing)continue;

      const access=resolveStaticRangeAccess(
        targetDistance,abilityRanges[slot],`${participant.champion} ${slot}`,
      );
      if(access.status==='OUT_OF_RANGE'){
        blockedAbilities.push(slot);
        abilities[slot]={...model,damage:[],dynamicDamage:[],targetDebuff:undefined};
        if(overlay)abilityOverlays[slot]={...overlay,targetControl:undefined};
        notes.push(`${access.reason} Enemy-facing damage, debuff and control are removed for this static-distance run.`);
      }else if(access.status==='UNKNOWN'){
        partial.push(`${slot} target access is unresolved at ${round(targetDistance)}u because no positive published target range is available.`);
        notes.push(access.reason);
      }else notes.push(access.reason);
    }
  }

  return {
    participant:{
      ...participant,
      sequence:blockedAutos?participant.sequence.filter(step=>step!=='AA'):participant.sequence,
      abilities,
      abilityOverlays,
      allyUtility,
    },
    effectiveAccessMode,notes,partial,blockedAutos,blockedAbilities,
  };
}

const round=(value:number)=>Math.round(value*10)/10;
