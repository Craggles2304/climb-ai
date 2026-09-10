import type {DamageType} from './damage';

/** Runtime-only combat effects shared by the combo and trade engines. */
export interface OnHitEffect{
  label:string;
  type:DamageType;
  flatDamage?:number;
  targetMaxHealthRatio?:number;
  targetCurrentHealthRatio?:number;
  /** Missing-health scaling for executes/finishers. */
  targetMissingHealthRatio?:number;
  /** Floor after all flat/health terms are added, before mitigation. */
  minimumDamage?:number;
  /** Repeating cadence such as Silver Bolts every third attack. */
  everyNthAttack?:number;
  /** Empower only the opening N attacks, e.g. Shen Q's next three attacks. */
  firstNAttacks?:number;
}

export function onHitTriggers(effect:OnHitEffect,attackNumber:number):boolean{
  const n=Math.max(1,Math.round(attackNumber));
  if(effect.firstNAttacks!==undefined&&n>Math.max(0,Math.round(effect.firstNAttacks)))return false;
  if(effect.everyNthAttack!==undefined){
    const every=Math.max(1,Math.round(effect.everyNthAttack));
    if(n%every!==0)return false;
  }
  return true;
}

/** A debuff applied after an ability lands and consumed by later events. */
export interface TargetDebuffEffect{
  label:string;
  durationSeconds:number;
  percentArmorReduction?:number;
  percentMagicResistReduction?:number;
}

export interface DamageRule{
  label:string;
  multiplier:number;
  targetAboveHealthRatio?:number;
  targetBelowHealthRatio?:number;
  activateAfterAutos?:number;
  excludeTrue?:boolean;
}

export interface AttackStackEffect{
  label:string;
  maxStacks:number;
  /** Absolute attacks-per-second added by each stack. */
  attackSpeedPerStack:number;
  /** Bonus on-hit that starts once max stacks were already reached. */
  onHitAtMax?:OnHitEffect;
}

export interface AutoProcEffect{
  label:string;
  /** Trigger on this numbered basic attack. */
  procAtAuto:number;
  /** Optional repeat interval after the first proc, e.g. every third attack. */
  repeatEvery?:number;
  damage:OnHitEffect;
}

export function autoProcTriggers(proc:AutoProcEffect,attackNumber:number):boolean{
  if(attackNumber<proc.procAtAuto)return false;
  if(attackNumber===proc.procAtAuto)return true;
  const every=Math.max(0,Math.round(proc.repeatEvery??0));
  return every>0&&(attackNumber-proc.procAtAuto)%every===0;
}

export interface RuneCombatProfile{
  damageRules:DamageRule[];
  attackStack?:AttackStackEffect;
  autoProcs:AutoProcEffect[];
  modelledRuneIds:number[];
  unmodelledRuneIds:number[];
  notes:string[];
}

export interface SummonerCombatProfile{
  bonusShield:number;
  heal:number;
  igniteDamage:number;
  exhaustDamageMultiplier:number;
  exhaustDurationSeconds:number;
  modelledIds:string[];
  unmodelledActiveIds:string[];
  notes:string[];
}

/** Stable rune IDs from Riot's rune catalogue. */
export const RUNES={
  PRESS_THE_ATTACK:8005,
  LETHAL_TEMPO:8008,
  COUP_DE_GRACE:8014,
  CUT_DOWN:8017,
  LAST_STAND:8299,
} as const;

export function buildRuneCombatProfile(
  runeIds:number[],
  opts:{
    level:number;
    isRanged:boolean;
    healthPercent:number;
    baseAttackSpeed:number;
    bonusAttackSpeedRatio:number;
    adaptiveDamageType:Exclude<DamageType,'TRUE'>;
  },
):RuneCombatProfile{
  const selected=new Set(runeIds);
  const damageRules:DamageRule[]=[];
  const autoProcs:AutoProcEffect[]=[];
  const modelledRuneIds:number[]=[];
  const notes:string[]=[];
  let attackStack:AttackStackEffect|undefined;

  // Since patch 2025.S1.3, general damage amplification also amplifies true
  // damage (Smite and jungle-pet damage are the exceptions, neither is part of
  // this champion-vs-champion model). Therefore these rules are intentionally
  // NOT filtered by damage type.
  if(selected.has(RUNES.CUT_DOWN)){
    damageRules.push({
      label:'Cut Down',multiplier:1.08,targetAboveHealthRatio:.60,excludeTrue:false,
    });
    modelledRuneIds.push(RUNES.CUT_DOWN);
  }

  if(selected.has(RUNES.COUP_DE_GRACE)){
    damageRules.push({
      label:'Coup de Grace',multiplier:1.08,targetBelowHealthRatio:.40,excludeTrue:false,
    });
    modelledRuneIds.push(RUNES.COUP_DE_GRACE);
  }

  if(selected.has(RUNES.LAST_STAND)){
    const bonus=lastStandBonus(opts.healthPercent);
    if(bonus>0)
      damageRules.push({label:'Last Stand',multiplier:1+bonus,excludeTrue:false});
    modelledRuneIds.push(RUNES.LAST_STAND);
  }

  if(selected.has(RUNES.PRESS_THE_ATTACK)){
    const proc=scaleLevel(40,180,opts.level);
    autoProcs.push({
      label:'Press the Attack',procAtAuto:3,
      damage:{label:'Press the Attack',type:opts.adaptiveDamageType,flatDamage:proc},
    });
    damageRules.push({
      label:'Press the Attack — Exposed',multiplier:1.08,activateAfterAutos:3,
      excludeTrue:false,
    });
    modelledRuneIds.push(RUNES.PRESS_THE_ATTACK);
    notes.push('Press the Attack procs on the third consecutive basic attack for 40–180 adaptive damage by level; its 8% self damage amplification begins after that attack.');
  }

  if(selected.has(RUNES.LETHAL_TEMPO)){
    const stackRatio=opts.isRanged?.04:.05;
    const maxStacks=6;
    const baseOnHit=scaleLevel(opts.isRanged?6:9,opts.isRanged?24:30,opts.level);
    const bonusAsAtMax=Math.max(0,opts.bonusAttackSpeedRatio)+stackRatio*maxStacks;
    const onHitAtMax=baseOnHit*(1+bonusAsAtMax);
    attackStack={
      label:'Lethal Tempo',
      maxStacks,
      attackSpeedPerStack:opts.baseAttackSpeed*stackRatio,
      onHitAtMax:{
        label:'Lethal Tempo',type:opts.adaptiveDamageType,flatDamage:round(onHitAtMax),
      },
    };
    modelledRuneIds.push(RUNES.LETHAL_TEMPO);
    notes.push('Lethal Tempo gains one stack per champion basic attack, to six: 4% ranged / 5% melee attack speed per stack. At six stacks, attacks add 6–24 ranged / 9–30 melee adaptive damage by level, scaling with bonus attack speed.');
  }

  const modelled=new Set(modelledRuneIds);
  return {
    damageRules,attackStack,autoProcs,modelledRuneIds,
    unmodelledRuneIds:runeIds.filter(id=>!modelled.has(id)),
    notes,
  };
}

/**
 * Current Summoner's Rift spell rules. Damage/heal/shield endpoint scaling is
 * interpolated by champion level so the engine remains deterministic. We keep
 * the interpolation note visible because Riot's public Data Dragon tooltips do
 * not expose the hidden per-level calculation arrays for these spells.
 */
export function buildSummonerCombatProfile(
  selectedIds:string[],
  activeIds:string[],
  opts:{level:number;maxHealth:number;currentHealth:number},
):SummonerCombatProfile{
  const selected=new Set(selectedIds);
  const active=[...new Set(activeIds)].filter(id=>selected.has(id));
  let bonusShield=0,heal=0,igniteDamage=0;
  let exhaustDamageMultiplier=1,exhaustDurationSeconds=0;
  const modelledIds:string[]=[];
  const notes:string[]=[];

  for(const id of active){
    if(id==='SummonerBarrier'){
      bonusShield+=scaleLevel(100,460,opts.level);
      modelledIds.push(id);
      notes.push('Barrier: 100–460 shield by level for 2.5s.');
      continue;
    }
    if(id==='SummonerHeal'){
      const amount=scaleLevel(80,318,opts.level);
      heal+=Math.min(amount,Math.max(0,opts.maxHealth-opts.currentHealth-heal));
      modelledIds.push(id);
      notes.push('Heal: 80–318 health by level. Assumes no recent Summoner Heal penalty and no Grievous Wounds.');
      continue;
    }
    if(id==='SummonerDot'){
      igniteDamage+=igniteAtLevel(opts.level);
      modelledIds.push(id);
      notes.push('Ignite: 70–475 true damage over 5s; the eventual total is used only when Ignite is explicitly marked active. Grievous Wounds is not yet applied to other healing in the same simulation.');
      continue;
    }
    if(id==='SummonerExhaust'){
      exhaustDamageMultiplier=.65;
      exhaustDurationSeconds=3;
      modelledIds.push(id);
      notes.push('Exhaust: 35% damage reduction for 3s is applied to the exhausted champion; its 40% slow is not part of the stationary damage model.');
      continue;
    }
  }

  const modelled=new Set(modelledIds);
  return {
    bonusShield:round(bonusShield),heal:round(heal),igniteDamage:round(igniteDamage),
    exhaustDamageMultiplier,exhaustDurationSeconds,modelledIds,
    unmodelledActiveIds:active.filter(id=>!modelled.has(id)),notes,
  };
}

/** 5% below 60% HP, linearly rising to 11% at 30% HP and below. */
export function lastStandBonus(healthPercent:number):number{
  const hp=Math.max(0,Math.min(100,healthPercent));
  if(hp>=60)return 0;
  if(hp<=30)return .11;
  return .05+((60-hp)/30)*.06;
}

/** Ignite is 70–475 and diverges from the old curve after level 6. */
export function igniteAtLevel(level:number):number{
  const l=clampLevel(level);
  if(l<=6)return 70+(l-1)*20;
  return round(170+((l-6)/12)*(475-170));
}

export const scaleLevel=(min:number,max:number,level:number)=>{
  const l=clampLevel(level);
  return round(min+((l-1)/17)*(max-min));
};

const clampLevel=(level:number)=>Math.max(1,Math.min(18,Math.round(level)));
const round=(n:number)=>Math.round(n*10)/10;