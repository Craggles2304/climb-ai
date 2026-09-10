import type {AutoAttackModel} from './combos';
import type {ChampionCombatProfile} from './championEffects';
import {withOpeningBasicAttackReplacement} from './attackInteractions';

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
 * Galio is the first real implementation. The selected state means Colossal
 * Smash is ready at t=0, so the opening attack damage is deterministic. Its
 * future 5s recharge / 3s ability-hit refunds and special windup speed are kept
 * explicit until the shared passive-cooldown scheduler models them.
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
        label:`15–115 level scaling + 100% AD + 40% AP + 60% bonus MR`,
        type:'MAGIC',
        flatDamage:round(raw),
      }],
    },
  };

  removePartial(profile,'GALIO_PASSIVE_READY');
  addModelled(profile,'GALIO_COLOSSAL_SMASH_OPENING_REPLACEMENT');
  addNote(
    profile,
    `Colossal Smash ready: opening basic attack is replaced by ${round(raw)} raw magic damage (${round(base)} level base + ${round(totalAd)} total AD + ${round(.40*ap)} AP scaling + ${round(.60*bonusMr)} bonus-MR scaling).`,
  );

  addPartial(
    profile,'GALIO_PASSIVE_RECHARGE_TIMELINE',
    'After the opening Colossal Smash, its 5s static recharge and 3s refund per champion/epic-monster ability hit are not yet rescheduled on the auto timeline, so later passive procs are omitted rather than guessed.',
  );
  addPartial(
    profile,'GALIO_PASSIVE_WINDUP_AS',
    'The empowered Colossal Smash attack gains 40% bonus attack speed during its windup. The current auto scheduler uses attack intervals rather than a separate windup model, so damage is exact but that one attack\'s timing remains partial.',
  );
  if(Math.max(0,finite(ctx.critChance))>0){
    addPartial(
      profile,'GALIO_PASSIVE_CRIT_AD_RATIO',
      'Colossal Smash can critically strike its AD ratio with special crit scaling. CLIMB does not convert crit chance into expected passive damage, so the selected ready attack is shown as the non-critical deterministic result.',
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