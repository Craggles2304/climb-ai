import type {OnHitEffect,TargetDebuffEffect} from './effects';
import type {AbilitySlot} from './combos';

export interface ChampionCombatProfile{
  permanentAttackSpeedRatio:number;
  attackRangeBonus:number;
  onHits:OnHitEffect[];
  abilityDebuffs:Partial<Record<AbilitySlot,TargetDebuffEffect>>;
  modelledEffects:string[];
  unmodelledEffects:string[];
  notes:string[];
}

type Ranks=Partial<Record<AbilitySlot,number>>;

/**
 * Champion mechanics that change the basic combat model but are not represented
 * by the generic spell-damage formula tree. Unsupported states stay visible as
 * unsupported rather than becoming guessed numbers.
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
    abilityDebuffs:{},
    modelledEffects:[],
    unmodelledEffects:[],
    notes:[],
  };

  if(championId==='KogMaw'){
    const qRank=clampRank(ranks.Q,5);
    const wRank=clampRank(ranks.W,5);

    if(qRank>0){
      // Caustic Spittle's attack-speed passive is permanent once Q is learned.
      profile.permanentAttackSpeedRatio=[.10,.15,.20,.25,.30][qRank-1]??0;
      profile.modelledEffects.push('KOG_Q_PASSIVE_AS','KOG_Q_SHRED');
      const shred=[.16,.20,.24,.28,.32][qRank-1]??0;
      profile.abilityDebuffs.Q={
        label:`Kog'Maw Q rank ${qRank} resistance shred`,
        durationSeconds:4,
        percentArmorReduction:shred,
        percentMagicResistReduction:shred,
      };
      profile.notes.push(`Kog'Maw Q rank ${qRank}: ${(profile.permanentAttackSpeedRatio*100).toFixed(0)}% permanent bonus attack speed is included.`);
      profile.notes.push(`Caustic Spittle hit: ${(shred*100).toFixed(0)}% armour and magic-resist reduction is applied to subsequent damage for 4 seconds.`);
    }

    if(activeEffects.includes('KOG_W')){
      if(wRank<=0){
        profile.unmodelledEffects.push('KOG_W');
        profile.notes.push("Bio-Arcane Barrage cannot be active because W is unlearned at this level/rank setup.");
      }else{
        // Bio-Arcane Barrage: 3 / 3.75 / 4.5 / 5.25 / 6% max HP,
        // plus 1 percentage point per 100 AP.
        const base=[.03,.0375,.045,.0525,.06][wRank-1]??0;
        const apRatio=Math.max(0,opts.abilityPower)*.0001;
        profile.onHits.push({
          label:`Kog'Maw W rank ${wRank}`,
          type:'MAGIC',
          targetMaxHealthRatio:base+apRatio,
        });
        profile.attackRangeBonus=[130,150,170,190,210][wRank-1]??0;
        profile.modelledEffects.push('KOG_W');
        profile.notes.push(`Bio-Arcane Barrage is active: each basic attack adds ${round((base+apRatio)*100)}% of target max health as magic damage and gains ${profile.attackRangeBonus} attack range.`);
      }
    }
  }

  // Anything explicitly requested but not recognised must remain visible.
  const known=new Set([...profile.modelledEffects,...profile.unmodelledEffects]);
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
  const n=Number.isFinite(value)?Math.round(value as number):0;
  return Math.max(0,Math.min(max,n));
}

const round=(n:number)=>Math.round(n*100)/100;
