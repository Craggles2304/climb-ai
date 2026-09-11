import type {AutoAttackModel} from './combos';

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
  const windupSeconds=Math.max(0,timing.windupPercent)/speed;
  return {
    attackStartedAt,
    windupSeconds,
    hitsAt:attackStartedAt+windupSeconds,
    modelled:true,
  };
}

const finite=(value:number)=>Number.isFinite(value)?value:0;
