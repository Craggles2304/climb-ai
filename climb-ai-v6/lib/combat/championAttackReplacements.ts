import type {AutoAttackModel} from './combos';
import type {ChampionCombatProfile} from './championEffects';
import {
  withOpeningBasicAttackReplacement,withRechargeableBasicAttackReplacement,
} from './attackInteractions';

export interface ChampionAttackReplacementContext{
  patch:string;
  level:number;
  attackDamage:number;
  abilityPower:number;
  bonusMagicResist:number;
  critChance:number;
}

/**
 * Configure champion-specific modified basic attacks that replace the ordinary
 * attack damage component instead of adding another on-hit component.
 *
 * Galio is the first rechargeable implementation. Selecting COLOSSAL SMASH
 * READY means the passive begins ready at t=0; after each proc it starts a 5s
 * static cooldown and each successful ability cast can refund 3s once per cast.
 */
export function configureChampionAttackReplacement(
  championId:string,
  activeEffects:string[],
  profile:ChampionCombatProfile,
  ctx:ChampionAttackReplacementContext,
):void{
  if(normalise(championId)!=='galio'||!activeEffects.includes('GALIO_PASSIVE_READY'))return;

  if(!validatedGalioPatch(ctx.patch)){
    addPartial(
      profile,'GALIO_PASSIVE_PATCH_UNVALIDATED',
      `Colossal Smash replacement coefficients are validated for Data Dragon 16.18.x only; ${ctx.patch} is not auto-carried forward.`,
    );
    return;
  }

  const level=clampInt(ctx.level,1,18);
  const base=scaleLevel(15,115,level);
  const totalAd=Math.max(0,finite(ctx.attackDamage));
  const ap=Math.max(0,finite(ctx.abilityPower));
  const bonusMr=Math.max(0,finite(ctx.bonusMagicResist));
  const raw=base+totalAd+.40*ap+.60*bonusMr;

  profile.autoEventState={
    ...profile.autoEventState,
    replacement:{
      id:'GALIO_COLOSSAL_SMASH',
      label:'Colossal Smash',
      firstNAttacks:1,
      damage:[{
        label:'15–115 level scaling + 100% AD + 40% AP + 60% bonus MR',
        type:'MAGIC',
        flatDamage:round(raw),
      }],
    },
  };

  removePartial(profile,'GALIO_PASSIVE_READY');
  removePartial(profile,'GALIO_PASSIVE_RECHARGE_TIMELINE');
  addModelled(profile,'GALIO_COLOSSAL_SMASH_REPLACEMENT');
  addModelled(profile,'GALIO_PASSIVE_RECHARGE_TIMELINE');
  addNote(
    profile,
    `Colossal Smash ready: a ready basic attack is replaced by ${round(raw)} raw magic damage (${round(base)} level base + ${round(totalAd)} total AD + ${round(.40*ap)} AP scaling + ${round(.60*bonusMr)} bonus-MR scaling). After it procs, the passive recharges for 5s; each successful ability cast against the simulated target refunds 3s once per cast.`,
  );

  addPartial(
    profile,'GALIO_PASSIVE_WINDUP_AS',
    'The empowered Colossal Smash attack gains 40% bonus attack speed during its windup. The current auto scheduler uses attack intervals rather than a separate windup model, so passive damage/recharge are exact but that one attack\'s windup timing remains partial.',
  );
  if(Math.max(0,finite(ctx.critChance))>0){
    addPartial(
      profile,'GALIO_PASSIVE_CRIT_AD_RATIO',
      'Colossal Smash can critically strike its AD ratio with special crit scaling. CLIMB does not convert crit chance into expected passive damage, so each passive proc is shown as the non-critical deterministic result.',
    );
  }
}

/** Apply the configured replacement to the auto model used by every simulator. */
export function applyConfiguredAttackReplacement(
  model:AutoAttackModel,
  profile:ChampionCombatProfile,
):AutoAttackModel{
  const replacement=profile.autoEventState.replacement;
  if(!replacement)return model;

  if(replacement.id==='GALIO_COLOSSAL_SMASH'){
    addNote(profile,'Colossal Smash runtime: starts ready, then uses a 5s static cooldown with 3s refunded per successful ability cast.');
    return withRechargeableBasicAttackReplacement(model,{
      id:replacement.id,
      label:replacement.label,
      damage:replacement.damage,
      cooldownSeconds:5,
      cooldownReductionOnAbilityHit:3,
      startsReady:true,
    });
  }

  const applied=withOpeningBasicAttackReplacement(model,replacement);
  if(!applied.applied){
    addPartial(profile,'ATTACK_REPLACEMENT_RUNTIME_REFUSED',applied.note);
    return model;
  }
  addNote(profile,applied.note);
  return applied.model;
}

export function validatedGalioPatch(patch:string):boolean{
  const match=/^(\d+)\.(\d+)(?:\.|$)/.exec(String(patch).trim());
  return Boolean(match&&Number(match[1])===16&&Number(match[2])===18);
}

function addModelled(profile:ChampionCombatProfile,id:string){
  if(!profile.modelledEffects.includes(id))profile.modelledEffects.push(id);
}
function addPartial(profile:ChampionCombatProfile,id:string,note:string){
  if(!profile.unmodelledEffects.includes(id))profile.unmodelledEffects.push(id);
  addNote(profile,note);
}
function removePartial(profile:ChampionCombatProfile,id:string){
  profile.unmodelledEffects=profile.unmodelledEffects.filter(x=>x!==id);
}
function addNote(profile:ChampionCombatProfile,note:string){
  if(!profile.notes.includes(note))profile.notes.push(note);
}
function scaleLevel(min:number,max:number,level:number){
  return min+((level-1)/17)*(max-min);
}
function clampInt(value:number,min:number,max:number){
  const n=Number.isFinite(value)?Math.round(value):min;
  return Math.max(min,Math.min(max,n));
}
const finite=(value:number)=>Number.isFinite(value)?value:0;
const normalise=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const round=(value:number)=>Math.round(value*100)/100;