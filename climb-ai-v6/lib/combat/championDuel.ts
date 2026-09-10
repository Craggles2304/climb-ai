import type {AbilitySlot} from './combos';
import type {
  AdvancedDuelAbilityOverlay,AdvancedDuelOpeningShield,DuelSustainEffect,
} from './duelAdvanced';

export interface ChampionDuelProfile{
  abilityOverlays:Partial<Record<AbilitySlot,AdvancedDuelAbilityOverlay>>;
  openingShields:AdvancedDuelOpeningShield[];
  sustainEffects:DuelSustainEffect[];
  modelled:string[];
  partial:string[];
  notes:string[];
}

interface DuelContext{
  level:number;
  abilityPower:number;
  maxHealth:number;
  bonusHealth:number;
}

type Ranks=Partial<Record<AbilitySlot,number>>;

/**
 * Interaction mechanics whose value depends on both champions sharing a clock.
 * Damage formulas stay in the normal ability importer; this file only supplies
 * CC, healing and shield behaviour that cannot be represented by a one-sided
 * damage total.
 *
 * Numerical constants here were validated against current PC-LoL references
 * through patch 26.18. Anything with ambiguous state/charge/position remains
 * explicitly partial instead of receiving a guessed value.
 */
export function buildChampionDuelProfile(
  championId:string,
  activeEffects:string[],
  ranks:Ranks,
  context:DuelContext,
):ChampionDuelProfile{
  const profile:ChampionDuelProfile={
    abilityOverlays:{},openingShields:[],sustainEffects:[],
    modelled:[],partial:[],notes:[],
  };
  const id=normalise(championId);
  const active=new Set(activeEffects);

  if(id==='shen')applyShen(profile,active,ranks,context);
  if(id==='vex')applyVex(profile,active,ranks,context);
  if(id==='hecarim')applyHecarim(profile,active,ranks,context);
  if(id==='galio')applyGalio(profile,active,ranks,context);

  return profile;
}

function applyShen(
  profile:ChampionDuelProfile,
  active:Set<string>,
  ranks:Ranks,
  _context:DuelContext,
){
  if(rank(ranks.E,5)>0){
    profile.abilityOverlays.E={
      ...profile.abilityOverlays.E,
      targetControl:{
        label:'Shadow Dash taunt',kind:'TAUNT',durationSeconds:1.5,actionLockSeconds:1.5,
      },
    };
    profile.modelled.push('SHEN_E_TAUNT');
    profile.notes.push('Shadow Dash: a successful E delays the target’s next action by 1.5s. The stationary duel does not force their taunted basic attack back into Shen.');
  }

  if(active.has('SHEN_KI_BARRIER_READY')){
    // Ki Barrier is intentionally still not assigned a hard-coded shield here.
    // Its current base shield changed in 2026 and its trigger occurs when an
    // ability completes, not at cast start. The deferred cast-completion event
    // is the remaining requirement before this becomes exact.
    profile.partial.push('SHEN_KI_BARRIER_DEFERRED_TRIGGER');
    profile.notes.push('Ki Barrier ready: tracked, but its cast-completion trigger is still deferred rather than granted early. No fake opening shield is added.');
  }
}

function applyVex(
  profile:ChampionDuelProfile,
  active:Set<string>,
  ranks:Ranks,
  context:DuelContext,
){
  const wRank=rank(ranks.W,5);
  if(wRank>0){
    const shield=[50,75,100,125,150][wRank-1]+.75*Math.max(0,context.abilityPower);
    profile.abilityOverlays.W={
      ...profile.abilityOverlays.W,
      selfShield:{
        label:'Personal Space',amount:round(shield),durationSeconds:2.5,
        scope:'ALL',timing:'CAST_START',
      },
    };
    profile.modelled.push('VEX_W_SHIELD');
    profile.notes.push(`Personal Space rank ${wRank}: ${round(shield)} all-damage shield for 2.5s is granted before same-frame incoming damage.`);
  }

  if(active.has('VEX_DOOM_READY')){
    const duration=vexFearDuration(context.level);
    for(const slot of ['Q','W','E'] as AbilitySlot[]){
      if(rank(ranks[slot],5)<=0)continue;
      profile.abilityOverlays[slot]={
        ...profile.abilityOverlays[slot],
        targetControl:{
          label:'Doom fear',kind:'FEAR',durationSeconds:duration,
          actionLockSeconds:duration,consumeKey:'VEX_DOOM',
        },
      };
    }
    profile.modelled.push('VEX_DOOM_FEAR');
    profile.notes.push(`Doom ready: the first Q/W/E in the script that resolves consumes Doom and applies ${duration}s fear.`);
  }
}

function applyHecarim(
  profile:ChampionDuelProfile,
  active:Set<string>,
  _ranks:Ranks,
  _context:DuelContext,
){
  if(active.has('HEC_W_ACTIVE')){
    profile.sustainEffects.push({
      label:'Spirit of Dread',healFromDamageRatio:.25,durationSeconds:4,
    });
    profile.modelled.push('HEC_W_SELF_DAMAGE_HEAL');
    profile.partial.push('HEC_W_ALLY_DAMAGE_HEAL');
    profile.notes.push('Spirit of Dread active: Hecarim heals for 25% of damage he actually applies during the first 4s. Healing from allied damage is intentionally omitted in a 1v1.');
  }
}

function applyGalio(
  profile:ChampionDuelProfile,
  active:Set<string>,
  ranks:Ranks,
  context:DuelContext,
){
  const eRank=rank(ranks.E,5);
  if(eRank>0){
    profile.abilityOverlays.E={
      ...profile.abilityOverlays.E,
      targetControl:{
        label:'Justice Punch knockup',kind:'KNOCKUP',durationSeconds:.75,actionLockSeconds:.75,
      },
    };
    profile.modelled.push('GALIO_E_KNOCKUP');
    profile.notes.push('Justice Punch: a champion hit is action-locked by the validated 0.75s knockup.');
  }

  const wRank=rank(ranks.W,5);
  if(active.has('GALIO_W_SHIELD')&&wRank>0){
    const ratio=[.075,.09,.105,.12,.135][wRank-1];
    const amount=context.maxHealth*ratio;
    profile.openingShields.push({
      label:'Anti-Magic Bulwark',amount:round(amount),durationSeconds:null,scope:'MAGIC',
    });
    profile.modelled.push('GALIO_W_MAGIC_SHIELD');
    profile.partial.push('GALIO_W_MAGIC_SHIELD_REFRESH');
    profile.notes.push(`Anti-Magic Bulwark active: ${round(amount)} magic-only shield (${round(ratio*100)}% max HP). Physical and true damage bypass it. Its out-of-combat refresh timer is not simulated inside the duel.`);
  }

  if(wRank>0){
    profile.partial.push('GALIO_W_CHARGE_TAUNT');
    profile.notes.push('Shield of Durand taunt is 0.5–1.5s depending on charge time. Matchup Lab does not choose a charge time for you, so W control remains partial until that input exists.');
  }
}

function vexFearDuration(level:number){
  const l=Math.max(1,Math.min(18,Math.round(level)));
  return l>=16?1.5:l>=11?1.25:l>=6?1:.75;
}

function rank(value:number|undefined,max:number){
  const n=Number.isFinite(value)?Math.round(value as number):0;
  return Math.max(0,Math.min(max,n));
}

const normalise=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const round=(n:number)=>Math.round(n*100)/100;