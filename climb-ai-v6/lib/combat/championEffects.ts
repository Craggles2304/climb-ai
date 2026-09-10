import type {OnHitEffect} from './effects';
import type {AbilitySlot} from './combos';

export interface ChampionCombatProfile{
  permanentAttackSpeedRatio:number;
  attackRangeBonus:number;
  onHits:OnHitEffect[];
  modelledEffects:string[];
  unmodelledEffects:string[];
  notes:string[];
}

type Ranks=Partial<Record<AbilitySlot,number>>;

/**
 * Champion mechanics that change the basic combat model but are not represented
 * by the generic spell-damage formula tree. Keep them explicit and testable.
 * This module is intentionally small: unsupported champion states stay visible
 * as unsupported rather than turning into guessed numbers.
 */
export function buildChampionCombatProfile(
  championId:string,
  activeEffects:string[],
  ranks:Ranks,
  opts:{abilityPower:number},
):ChampionCombatProfile{
  const profile:ChampionCombatProfile={
    permanentAttackSpeedRatio:0,
    attackRangeBonus:0,
    onHits:[],
    modelledEffects:[],
    unmodelledEffects:[],
    notes:[],
  };

  if(championId==='KogMaw'){
    const qRank=clampRank(ranks.Q,5);
    const wRank=clampRank(ranks.W,5);

    // Caustic Spittle's attack-speed passive is always on once Q has a rank.
    profile.permanentAttackSpeedRatio=[.10,.15,.20,.25,.30][qRank-1]??.10;
    profile.modelledEffects.push('KOG_Q_PASSIVE_AS');
    profile.notes.push(`Kog'Maw Q rank ${qRank}: ${(profile.permanentAttackSpeedRatio*100).toFixed(0)}% permanent bonus attack speed is included.`);

    if(activeEffects.includes('KOG_W')){
      // Bio-Arcane Barrage: 3 / 3.75 / 4.5 / 5.25 / 6% max HP,
      // plus 1 percentage point per 100 AP.
      const base=[.03,.0375,.045,.0525,.06][wRank-1]??.03;
      const apRatio=Math.max(0,opts.abilityPower)*.0001;
      profile.onHits.push({
        label:`Kog'Maw W rank ${wRank}`,
        type:'MAGIC',
        targetMaxHealthRatio:base+apRatio,
      });
      profile.attackRangeBonus=[130,150,170,190,210][wRank-1]??130;
      profile.modelledEffects.push('KOG_W');
      profile.notes.push(`Bio-Arcane Barrage is active: each basic attack adds ${round((base+apRatio)*100)}% of target max health as magic damage and gains ${profile.attackRangeBonus} attack range.`);
    }
  }

  // Anything explicitly requested but not recognised must remain visible.
  const known=new Set(profile.modelledEffects);
  for(const effect of activeEffects)
    if(!known.has(effect))profile.unmodelledEffects.push(effect);

  return profile;
}

export function championEffectOptions(championName:string):{
  id:string;label:string;detail:string;
}[]{
  const normal=championName.toLowerCase().replace(/[^a-z0-9]/g,'');
  if(normal==='kogmaw')return [{
    id:'KOG_W',
    label:'W ACTIVE',
    detail:'Bio-Arcane Barrage max-health on-hit + bonus range',
  }];
  return [];
}

function clampRank(value:number|undefined,max:number){
  const n=Number.isFinite(value)?Math.round(value as number):1;
  return Math.max(1,Math.min(max,n));
}

const round=(n:number)=>Math.round(n*100)/100;
