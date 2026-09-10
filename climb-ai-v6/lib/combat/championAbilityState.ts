import {SLOTS,type AssembledKit} from './abilities';
import type {AbilitySlot} from './combos';
import type {ChampionCombatProfile} from './championEffects';
import {resolveSpellCastVariant} from './spellVariants';

/**
 * Applies champion-specific spell state to an assembled Q/W/E/R kit.
 *
 * This is shared by Solo Matchup, simultaneous duel and Bot Duo so one
 * champion-state rule cannot produce different maths in different product
 * surfaces. Failed source-gated variants are downgraded to an explicit partial
 * instead of silently using a guessed formula.
 */
export function applyChampionAbilityState(
  kit:AssembledKit,
  profile:ChampionCombatProfile,
){
  for(const slot of SLOTS){
    const model=kit.models[slot];
    const ability=kit.abilities[slot];
    if(!model||!ability)continue;

    const debuff=profile.abilityDebuffs[slot];
    if(debuff)model.targetDebuff=debuff;

    const eventState=profile.abilityEventStates[slot];
    if(eventState)model.eventState={...model.eventState,...eventState};

    const modifier=profile.abilityModifiers[slot];
    if(!modifier)continue;

    if(modifier.castVariant){
      const result=resolveSpellCastVariant(ability,modifier.castVariant);
      if(result.applied){
        ability.damage=result.damage;
        model.damage=result.damage;
        ability.cost=result.cost;
        model.cost=result.cost;
        ability.cooldownSeconds=result.cooldownSeconds;
        model.cooldownSeconds=result.cooldownSeconds;
        const selected=new Set(result.primaryCalculationNames);
        for(const calculation of ability.calculations)
          calculation.primary=selected.has(calculation.name);
        ability.variantNote=append(ability.variantNote,result.note);
      }else{
        downgradeEffect(profile,result.effectId,result.note);
      }
    }

    if(Number.isFinite(modifier.damageMultiplier)){
      const multiplier=Math.max(0,modifier.damageMultiplier as number);
      ability.damage=ability.damage.map(component=>component.raw===null
        ?component
        :{...component,raw:round(component.raw*multiplier)});
      model.damage=ability.damage;
      for(const calculation of ability.calculations)
        if(calculation.primary&&calculation.value!==null)
          calculation.value=round(calculation.value*multiplier);
    }

    const flatReduction=Math.max(0,modifier.cooldownFlatReduction??0);
    const cooldownMultiplier=Number.isFinite(modifier.cooldownMultiplier)
      ?Math.max(0,modifier.cooldownMultiplier as number):1;
    if(flatReduction>0||cooldownMultiplier!==1){
      const cooldown=Math.max(0,(ability.cooldownSeconds-flatReduction)*cooldownMultiplier);
      ability.cooldownSeconds=round(cooldown);
      model.cooldownSeconds=ability.cooldownSeconds;
    }

    if(Number.isFinite(modifier.costOverride)){
      ability.cost=Math.max(0,modifier.costOverride as number);
      model.cost=ability.cost;
    }

    if(modifier.dynamicDamage?.length)
      model.dynamicDamage=[...modifier.dynamicDamage];

    if(modifier.note)
      ability.variantNote=append(ability.variantNote,modifier.note);
  }
}

function downgradeEffect(
  profile:ChampionCombatProfile,
  effectId:string,
  reason:string,
){
  profile.modelledEffects=profile.modelledEffects.filter(id=>id!==effectId);
  if(!profile.unmodelledEffects.includes(effectId))profile.unmodelledEffects.push(effectId);
  if(!profile.notes.includes(reason))profile.notes.push(reason);
}

const append=(current:string|undefined,next:string)=>
  [current,next].filter(Boolean).join(' ');
const round=(n:number)=>Math.round(n*10)/10;

/** Compile-time guard: keep imported slot type used by registry consumers. */
export type ChampionAbilitySlot=AbilitySlot;