import type {AutoAttackModel,AbilityModel} from './combos';
import type {OnHitEffect} from './effects';
import type {BasicAttackReplacement,CombatRuntimeState} from './state';

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

/** A replacement that can return during the same combat timeline. */
export interface RechargeableAttackReplacement{
  id:string;
  label:string;
  damage:OnHitEffect[];
  cooldownSeconds:number;
  cooldownReductionOnAbilityHit:number;
  startsReady:boolean;
  /** Multiplies attacks/second only while this replacement is currently ready. */
  attackSpeedMultiplierWhileReady?:number;
}

type RechargeableAutoModel=AutoAttackModel&{
  rechargeableReplacement?:RechargeableAttackReplacement;
};

/** Runtime state is keyed by CombatRuntimeState, so every simulation gets an isolated passive clock. */
const rechargeableState=new WeakMap<CombatRuntimeState,Map<string,number>>();

export function withRechargeableBasicAttackReplacement(
  model:AutoAttackModel,
  replacement:RechargeableAttackReplacement,
):AutoAttackModel{
  return {...model,rechargeableReplacement:{...replacement,damage:replacement.damage.map(x=>({...x}))}} as RechargeableAutoModel;
}

export function rechargeableAttackEffects(
  model:AutoAttackModel,
  runtime:CombatRuntimeState,
  clock:number,
):OnHitEffect[]|null{
  const replacement=getRechargeable(model);
  if(!replacement||replacement.damage.length===0)return null;
  return replacementReadyAt(runtime,replacement)<=clock+1e-9
    ?replacement.damage
    :null;
}

/**
 * Attack-speed modifier supplied by a rechargeable ready-state passive.
 * It is queried before the attack consumes the passive, so the empowered attack
 * itself receives the ready-state speed and later cooldown-state attacks do not.
 */
export function rechargeableAttackSpeedMultiplier(
  model:AutoAttackModel,
  runtime:CombatRuntimeState,
  clock:number,
):number{
  const replacement=getRechargeable(model);
  if(!replacement||replacementReadyAt(runtime,replacement)>clock+1e-9)return 1;
  const multiplier=finiteMultiplier(replacement.attackSpeedMultiplierWhileReady??1);
  return multiplier>0?multiplier:1;
}

/** Consume a ready replacement and start its static cooldown. */
export function consumeRechargeableAttack(
  model:AutoAttackModel,
  runtime:CombatRuntimeState,
  clock:number,
):{label:string;readyAt:number}|null{
  const replacement=getRechargeable(model);
  if(!replacement||replacementReadyAt(runtime,replacement)>clock+1e-9)return null;
  const readyAt=clock+Math.max(0,finite(replacement.cooldownSeconds));
  stateFor(runtime).set(replacement.id,readyAt);
  return {label:replacement.label,readyAt:round(readyAt)};
}

/**
 * Apply one refund for one successful cast that actually hit the target.
 * Multi-hit spells still refund once because this is called once per cast event.
 */
export function reduceRechargeableAttackCooldownOnAbilityHit(
  model:AutoAttackModel,
  runtime:CombatRuntimeState,
  ability:AbilityModel,
  clock:number,
):{label:string;before:number;after:number;reduction:number}|null{
  const replacement=getRechargeable(model);
  if(!replacement||!abilityHitsTarget(ability))return null;
  const before=replacementReadyAt(runtime,replacement);
  if(before<=clock+1e-9)return null;
  const reduction=Math.max(0,finite(replacement.cooldownReductionOnAbilityHit));
  if(reduction<=0)return null;
  const after=Math.max(clock,before-reduction);
  stateFor(runtime).set(replacement.id,after);
  return {
    label:replacement.label,before:round(before),after:round(after),
    reduction:round(before-after),
  };
}

export function rechargeableAttackReadyAt(
  model:AutoAttackModel,
  runtime:CombatRuntimeState,
):number|null{
  const replacement=getRechargeable(model);
  return replacement?round(replacementReadyAt(runtime,replacement)):null;
}

function replacementReadyAt(runtime:CombatRuntimeState,replacement:RechargeableAttackReplacement):number{
  const state=stateFor(runtime);
  if(state.has(replacement.id))return state.get(replacement.id) as number;
  const initial=replacement.startsReady?0:Number.POSITIVE_INFINITY;
  state.set(replacement.id,initial);
  return initial;
}

function stateFor(runtime:CombatRuntimeState):Map<string,number>{
  let state=rechargeableState.get(runtime);
  if(!state){state=new Map();rechargeableState.set(runtime,state)}
  return state;
}

function getRechargeable(model:AutoAttackModel):RechargeableAttackReplacement|undefined{
  return (model as RechargeableAutoModel).rechargeableReplacement;
}

function abilityHitsTarget(ability:AbilityModel):boolean{
  return ability.damage.length>0
    ||Boolean(ability.dynamicDamage?.length)
    ||Boolean(ability.targetDebuff);
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