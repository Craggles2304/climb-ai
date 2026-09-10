import type {AssembledKit} from './abilities';
import type {AbilitySlot} from './combos';
import type {ChampionCombatProfile} from './championEffects';
import type {OnHitEffect} from './effects';
import {attachAbilityOnHitEffects} from './attackInteractions';
import {assessConfidence,combineConfidence} from './confidence';

export interface ExecuteSpellContext{
  patch:string;
  bonusAttackDamage:number;
  ranks:Partial<Record<AbilitySlot,number>>;
  /** Supported item on-hits from the selected loadout. */
  itemOnHits?:OnHitEffect[];
}

/**
 * Dynamic finisher layer.
 *
 * These rules are only activated on an explicitly validated Data Dragon patch.
 * The target-health term itself is NOT precomputed here: it travels as an
 * OnHitEffect and is resolved by combo/duel/bot-lane engines against the target's
 * health at the exact timestamp the spell lands.
 *
 * This keeps two safety guarantees:
 *  - a new Riot patch cannot silently inherit stale execute coefficients;
 *  - earlier damage in the sequence changes missing-health damage correctly.
 */
export function applyExecuteChampionSpells(
  championId:string,
  kit:AssembledKit,
  profile:ChampionCombatProfile,
  ctx:ExecuteSpellContext,
){
  const champion=normalise(championId);

  if(champion==='garen')applyGarenR(kit,profile,ctx);
  if(champion==='viego')applyViegoR(kit,profile,ctx);

  kit.confidence=combineConfidence(
    Object.values(kit.abilities).filter(Boolean).map(ability=>ability!.confidence),
  );
}

function applyGarenR(
  kit:AssembledKit,
  profile:ChampionCombatProfile,
  ctx:ExecuteSpellContext,
){
  const rank=clampRank(ctx.ranks.R,3);
  if(rank<=0)return;
  if(!validatedCurrentPatch(ctx.patch)){
    addPartial(
      profile,'GAREN_R_EXECUTE_PATCH_UNVALIDATED',
      `Demacian Justice execute coefficients are validated for Data Dragon 16.18.x only; ${ctx.patch} is not auto-carried forward.`,
    );
    return;
  }

  const ability=kit.abilities.R;
  const model=kit.models.R;
  if(!ability||!model){
    addPartial(profile,'GAREN_R_EXECUTE_UNAVAILABLE','Demacian Justice is ranked but the imported R model is unavailable.');
    return;
  }

  const base=[125,200,275][rank-1]??0;
  const missing=[.25,.30,.35][rank-1]??0;
  const dynamic:OnHitEffect={
    label:`Demacian Justice rank ${rank}`,
    type:'TRUE',
    flatDamage:base,
    targetMissingHealthRatio:missing,
  };

  // Garen R's entire champion damage package is the true-damage execute. Replace
  // any unresolved/imported placeholder rather than adding on top of it.
  ability.damage=[];
  model.damage=[];
  model.dynamicDamage=[dynamic];
  ability.variantNote=[
    ability.variantNote,
    `Demacian Justice: ${base} + ${round(missing*100)}% of target missing HP as true damage. Missing HP is read at the R event, after earlier actions but before R damage.`,
  ].filter(Boolean).join(' ');
  ability.confidence=assessConfidence({});

  addModelled(profile,'GAREN_R_DYNAMIC_EXECUTE');
  removePartials(profile,['GAREN_R_EXECUTE_PATCH_UNVALIDATED','GAREN_R_EXECUTE_UNAVAILABLE']);
  addNote(profile,`Demacian Justice rank ${rank}: ${base} + ${round(missing*100)}% target missing HP true damage is resolved at cast time.`);
}

function applyViegoR(
  kit:AssembledKit,
  profile:ChampionCombatProfile,
  ctx:ExecuteSpellContext,
){
  // The missing-health bonus and on-hit application are only for the primary
  // champion hit, so the user must explicitly select VIEGO_R_PRIMARY.
  if(!profile.unmodelledEffects.includes('VIEGO_R_PRIMARY')
    &&!profile.modelledEffects.includes('VIEGO_R_PRIMARY'))return;

  const rank=clampRank(ctx.ranks.R,3);
  if(rank<=0){
    addPartial(profile,'VIEGO_R_PRIMARY','Heartbreaker primary-target execute cannot be active because R is unlearned.');
    return;
  }
  if(!validatedCurrentPatch(ctx.patch)){
    addPartial(
      profile,'VIEGO_R_EXECUTE_PATCH_UNVALIDATED',
      `Heartbreaker missing-health/on-hit rules are validated for Data Dragon 16.18.x only; ${ctx.patch} is not auto-carried forward.`,
    );
    return;
  }

  const ability=kit.abilities.R;
  const model=kit.models.R;
  if(!ability||!model){
    addPartial(profile,'VIEGO_R_PRIMARY','Heartbreaker primary-target state is selected but the imported R model is unavailable.');
    return;
  }

  const baseRatio=[.12,.16,.20][rank-1]??0;
  // Patch 13.4 raised the PC ratio to +5 percentage points of missing HP per
  // 100 bonus AD. Current patch 26.18 changes Viego's passive/base AD growth,
  // not this Heartbreaker missing-health term.
  const bonusAdRatio=(Math.max(0,ctx.bonusAttackDamage)/100)*.05;
  const ratio=baseRatio+bonusAdRatio;
  const dynamic:OnHitEffect={
    label:`Heartbreaker primary missing-health bonus rank ${rank}`,
    type:'PHYSICAL',
    targetMissingHealthRatio:ratio,
  };

  model.dynamicDamage=[...(model.dynamicDamage??[]),dynamic];

  // Viego Q passive is an on-hit effect and is eligible for Heartbreaker's
  // explicit on-hit application. Attack-only champion steroids remain untagged.
  const championOnHits=profile.onHits.map(effect=>
    /^Viego Q passive/i.test(effect.label)
      ?{...effect,appliesFromAbility:true}
      :effect,
  );
  const forwarded=attachAbilityOnHitEffects(
    model,
    [...(ctx.itemOnHits??[]),...championOnHits],
    {label:'Heartbreaker primary on-hit',effectiveness:1},
  );

  ability.variantNote=[
    ability.variantNote,
    `Heartbreaker primary target: +${round(ratio*100)}% of target missing HP physical damage at this bonus AD. The term reads target HP at the R event.`,
    forwarded.note,
  ].filter(Boolean).join(' ');

  removePartials(profile,[
    'VIEGO_R_PRIMARY','VIEGO_R_PRIMARY_ON_HIT','VIEGO_R_EXECUTE_PATCH_UNVALIDATED',
  ]);
  addModelled(profile,'VIEGO_R_PRIMARY');
  addModelled(profile,'VIEGO_R_MISSING_HEALTH');
  addModelled(profile,'VIEGO_R_PRIMARY_ON_HIT');
  addNote(profile,`Heartbreaker rank ${rank}: ${round(baseRatio*100)}% + ${round(bonusAdRatio*100)}% from bonus AD = ${round(ratio*100)}% target missing HP physical damage at the exact R timestamp.`);
  addNote(profile,forwarded.note);
}

/** Fail closed on a patch we have not explicitly reviewed. */
export function validatedCurrentPatch(patch:string):boolean{
  const match=/^(\d+)\.(\d+)(?:\.|$)/.exec(String(patch).trim());
  if(!match)return false;
  return Number(match[1])===16&&Number(match[2])===18;
}

function addModelled(profile:ChampionCombatProfile,id:string){
  if(!profile.modelledEffects.includes(id))profile.modelledEffects.push(id);
}
function addPartial(profile:ChampionCombatProfile,id:string,note:string){
  if(!profile.unmodelledEffects.includes(id))profile.unmodelledEffects.push(id);
  addNote(profile,note);
}
function removePartials(profile:ChampionCombatProfile,ids:string[]){
  const remove=new Set(ids);
  profile.unmodelledEffects=profile.unmodelledEffects.filter(id=>!remove.has(id));
}
function addNote(profile:ChampionCombatProfile,note:string){
  if(!profile.notes.includes(note))profile.notes.push(note);
}
function clampRank(value:number|undefined,max:number){
  const n=Number.isFinite(value)?Math.round(value as number):0;
  return Math.max(0,Math.min(max,n));
}
const normalise=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const round=(value:number)=>Math.round(value*100)/100;