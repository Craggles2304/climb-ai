import {SLOTS,type AssembledKit} from './abilities';
import type {AbilitySlot} from './combos';
import type {ChampionCombatProfile} from './championEffects';

/**
 * Applies the champion profile's ordinary debuffs, event state and stat/cooldown
 * modifiers to an assembled Q/W/E/R kit.
 *
 * Conditional cast variants are applied by conditionalChampionSpells.ts after
 * this pass. Keeping the two stages explicit prevents an empowered/all-hit
 * variant from being multiplied twice by a champion's normal state modifier.
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

const append=(current:string|undefined,next:string)=>
  [current,next].filter(Boolean).join(' ');
const round=(n:number)=>Math.round(n*10)/10;

/** Compile-time guard for registry consumers. */
export type ChampionAbilitySlot=AbilitySlot;