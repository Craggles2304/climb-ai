import type {AssembledKit} from './abilities';
import type {ChampionCombatProfile} from './championEffects';
import {resolveSpellCastVariant,type SpellCastVariant} from './spellVariants';

/**
 * Champion states whose damage shape depends on how a spell is used rather than
 * on a permanent champion stat. This layer is intentionally source-gated and is
 * shared by every Matchup Lab mode.
 */
export function applyConditionalChampionSpells(
  championId:string,
  activeEffects:string[],
  kit:AssembledKit,
  profile:ChampionCombatProfile,
){
  const champion=normalise(championId);
  const active=new Set(activeEffects);

  if(champion==='taliyah'){
    if(active.has('TALIYAH_Q_FULL')){
      applyVariant(kit,profile,'Q',{
        kind:'REPEAT_PRIMARY',
        effectId:'TALIYAH_Q_FULL',
        label:'Threaded Volley · all 5 rocks',
        totalHits:5,
        firstHitMultiplier:1,
        repeatHitMultiplier:.4,
        // Guard against multiplying a pre-totalled or alternate source formula.
        forbiddenBaseLabelTokens:['total','five','5rock','boulder','worked','maximum','maxdamage'],
      });
    }

    if(active.has('TALIYAH_Q_WORKED')){
      const applied=applyVariant(kit,profile,'Q',{
        kind:'SCALE_PRIMARY',
        effectId:'TALIYAH_Q_WORKED',
        label:'Threaded Volley · Worked Ground boulder',
        multiplier:1.9,
        costOverride:20,
        forbiddenBaseLabelTokens:['total','five','5rock','boulder','worked','maximum','maxdamage'],
      });
      if(applied){
        // Riot defines a special Worked Ground cooldown path. Until the scheduler
        // has a true cooldown floor, do not fake it by multiplying the normal Q CD.
        addPartial(profile,'TALIYAH_Q_WORKED_COOLDOWN','Worked Ground boulder damage and 20 mana cost are applied. Its special minimum cooldown is still held PARTIAL rather than being reduced below the live source cooldown by guesswork.');
      }
    }
  }
}

function applyVariant(
  kit:AssembledKit,
  profile:ChampionCombatProfile,
  slot:'Q'|'W'|'E'|'R',
  spec:SpellCastVariant,
):boolean{
  const ability=kit.abilities[slot];
  const model=kit.models[slot];
  if(!ability||!model){
    downgrade(profile,spec.effectId,`${spec.label}: not applied because ${slot} is unlearned or unavailable in this setup.`);
    return false;
  }

  const result=resolveSpellCastVariant(ability,spec);
  if(!result.applied){
    downgrade(profile,result.effectId,result.note);
    return false;
  }

  ability.damage=result.damage;
  model.damage=result.damage;
  ability.cost=result.cost;
  model.cost=result.cost;
  ability.cooldownSeconds=result.cooldownSeconds;
  model.cooldownSeconds=result.cooldownSeconds;
  const selected=new Set(result.primaryCalculationNames);
  if(selected.size)
    for(const calculation of ability.calculations)
      calculation.primary=selected.has(calculation.name);
  ability.variantNote=[ability.variantNote,result.note].filter(Boolean).join(' ');
  promote(profile,result.effectId,result.note);
  return true;
}

function promote(profile:ChampionCombatProfile,effectId:string,note:string){
  profile.unmodelledEffects=profile.unmodelledEffects.filter(id=>id!==effectId);
  if(!profile.modelledEffects.includes(effectId))profile.modelledEffects.push(effectId);
  if(!profile.notes.includes(note))profile.notes.push(note);
}

function downgrade(profile:ChampionCombatProfile,effectId:string,note:string){
  profile.modelledEffects=profile.modelledEffects.filter(id=>id!==effectId);
  if(!profile.unmodelledEffects.includes(effectId))profile.unmodelledEffects.push(effectId);
  if(!profile.notes.includes(note))profile.notes.push(note);
}

function addPartial(profile:ChampionCombatProfile,id:string,note:string){
  if(!profile.unmodelledEffects.includes(id))profile.unmodelledEffects.push(id);
  if(!profile.notes.includes(note))profile.notes.push(note);
}

const normalise=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');