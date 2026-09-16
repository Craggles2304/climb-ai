import type {AutoAttackModel} from './combos';
import {roundCombat} from './decimal';

export interface BasicAttackHitTiming {
  attackStartedAt:number;
  windupSeconds:number;
  hitsAt:number;
  modelled:boolean;
}

export function basicAttackHitTiming(
  model:AutoAttackModel,
  attackStartedAt:number,
  attackSpeed:number,
  windupBonusAttackSpeedFlat=0,
):BasicAttackHitTiming{
  const timing=model.eventState?.attackTiming;
  const speed=Math.max(0,finite(attackSpeed)+Math.max(0,finite(windupBonusAttackSpeedFlat)));
  if(!timing||speed<=0){
    return {attackStartedAt,windupSeconds:0,hitsAt:attackStartedAt,modelled:false};
  }
  // Normalise the computed fraction at high precision before it enters the
  // shared combat timeline. This preserves meaningful timing precision while
  // preventing values such as Galio's exact 0.165s empowered windup from
  // becoming 0.164999999... and displaying as 0.16s downstream.
  const windupSeconds=roundCombat(Math.max(0,timing.windupPercent)/speed,12);
  return {
    attackStartedAt,
    windupSeconds,
    hitsAt:roundCombat(attackStartedAt+windupSeconds,12),
    modelled:true,
  };
}

const finite=(value:number)=>Number.isFinite(value)?value:0;
