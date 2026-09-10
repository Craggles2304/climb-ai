import type {AutoAttackModel,AbilityModel} from './combos';
import type {OnHitEffect} from './effects';
import type {BasicAttackReplacement} from './state';

export interface AbilityOnHitAttachResult{
  applied:boolean;
  count:number;
  note:string;
}

/**
 * Attach an explicit "applies on-hit effects" package to an ability.
 *
 * Only effects carrying appliesFromAbility=true are eligible. This is the
 * safety boundary that stops an ability from inheriting basic-attack-only
 * steroids just because they share the same runtime array.
 */
export function attachAbilityOnHitEffects(
  ability:AbilityModel,
  effects:OnHitEffect[],
  opts:{label:string;effectiveness?:number},
):AbilityOnHitAttachResult{
  const effectiveness=finiteMultiplier(opts.effectiveness??1);
  const eligible=effects.filter(effect=>effect.appliesFromAbility===true);
  if(!eligible.length){
    return {
      applied:false,count:0,
      note:`${opts.label}: no supported ability-eligible on-hit effects are active in this setup.`,
    };
  }

  const forwarded=eligible.map(effect=>scaleEffect(effect,effectiveness,opts.label));
  ability.dynamicDamage=[...(ability.dynamicDamage??[]),...forwarded];
  ability.eventState={
    ...(ability.eventState??{}),
    appliesOnHitEffects:{label:opts.label,effectiveness},
  };
  return {
    applied:true,count:forwarded.length,
    note:`${opts.label}: forwarded ${forwarded.length} supported on-hit effect${forwarded.length===1?'':'s'} at ${round(effectiveness*100)}% effectiveness.`,
  };
}

export interface OpeningReplacementResult{
  model:AutoAttackModel;
  applied:boolean;
  note:string;
}

/**
 * Replace the opening N basic attacks without changing the combat engines.
 *
 * The ordinary physical AD component is set to zero, the replacement occupies
 * attacks 1..N, and an explicit ordinary-attack component begins at N+1. All
 * existing on-hit effects continue to apply on both replacement and later autos.
 *
 * A timed state that itself changes basic-attack damage is refused for now: the
 * delayed fallback component cannot yet inherit a time-varying multiplier, and
 * silently ignoring that interaction would create plausible wrong damage.
 */
export function withOpeningBasicAttackReplacement(
  model:AutoAttackModel,
  replacement:BasicAttackReplacement,
):OpeningReplacementResult{
  const count=Math.max(1,Math.round(replacement.firstNAttacks??1));
  if(!replacement.damage.length){
    return {model,applied:false,note:`${replacement.label}: replacement has no damage components.`};
  }
  const incompatible=(model.timedStates??[]).find(state=>
    state.basicAttackDamageMultiplier!==undefined
    &&Math.abs(state.basicAttackDamageMultiplier-1)>1e-9,
  );
  if(incompatible){
    return {
      model,applied:false,
      note:`${replacement.label}: not applied because ${incompatible.label} changes ordinary basic-attack damage over time and replacement fallback timing cannot represent that safely yet.`,
    };
  }

  const replacementEffects=replacement.damage.map(effect=>({
    ...effect,
    label:`${replacement.label} · ${effect.label}`,
    startsAtAttack:1,
    firstNAttacks:count,
    appliesFromAbility:false,
  }));
  const ordinaryFallback:OnHitEffect={
    label:'Ordinary basic attack after replacement',
    type:'PHYSICAL',
    flatDamage:Math.max(0,finite(model.damage)),
    startsAtAttack:count+1,
    appliesFromAbility:false,
  };

  return {
    applied:true,
    model:{
      ...model,
      damage:0,
      onHits:[...replacementEffects,ordinaryFallback,...(model.onHits??[])],
    },
    note:`${replacement.label}: replaces basic attack${count===1?'':`s 1–${count}`}; ordinary physical attacks resume at attack ${count+1}. Existing on-hit effects remain attached.`,
  };
}

function scaleEffect(effect:OnHitEffect,multiplier:number,prefix:string):OnHitEffect{
  const scale=(value:number|undefined)=>value===undefined?undefined:value*multiplier;
  return {
    ...effect,
    label:`${prefix} · ${effect.label}`,
    flatDamage:scale(effect.flatDamage),
    targetMaxHealthRatio:scale(effect.targetMaxHealthRatio),
    targetCurrentHealthRatio:scale(effect.targetCurrentHealthRatio),
    targetMissingHealthRatio:scale(effect.targetMissingHealthRatio),
    minimumDamage:scale(effect.minimumDamage),
    // The ability is applying the effect directly, not becoming another numbered
    // basic attack, so attack-cadence gates are stripped from the forwarded copy.
    startsAtAttack:undefined,
    everyNthAttack:undefined,
    firstNAttacks:undefined,
  };
}

const finiteMultiplier=(value:number)=>Number.isFinite(value)?Math.max(0,value):0;
const finite=(value:number)=>Number.isFinite(value)?value:0;
const round=(value:number)=>Math.round(value*100)/100;