import {ChampionStatBlock,LevelStats,statsAtLevel} from './ddragon';

/**
 * Damage output, computed rather than looked up.
 *
 * WHAT THIS CAN DO
 * Auto-attack DPS is exact arithmetic: attack damage, attack speed and crit
 * are all published per champion and per item, so "this item adds 41 DPS on
 * Caitlyn at level 11" is a calculation, not an estimate.
 *
 * WHAT THIS CANNOT DO
 * Ability damage. Riot removed the coefficients from Data Dragon — across all
 * 173 champions, 0 of 692 spells still carry `datavalues` or `vars`, and the
 * tooltips reference named placeholders (`{{ bladedamage }}`) that resolve to
 * nothing. So no ability damage is shown anywhere, rather than guessed.
 *
 * The consequence matters and is surfaced in the UI: for an ability-based
 * champion these numbers describe a minority of their damage, and an AP item
 * contributing nothing to auto-attack DPS is NOT evidence it is a bad item.
 */

/* --- Game rules, not Data Dragon values. Update these per patch. --------- */

/** A critical strike deals this share of normal damage (175% since 14.x). */
export const CRIT_MULTIPLIER=1.75;
/** Attack speed is hard-capped in game. */
export const ATTACK_SPEED_CAP=2.5;
export const CRIT_CHANCE_CAP=1;

export interface ItemStats{
  attackDamage:number;
  abilityPower:number;
  attackSpeedRatio:number;
  critChance:number;
  health:number;
  armor:number;
  magicResist:number;
  lifestealRatio:number;
  flatMoveSpeed:number;
  percentMoveSpeed:number;
}

const EMPTY:ItemStats={
  attackDamage:0,abilityPower:0,attackSpeedRatio:0,critChance:0,
  health:0,armor:0,magicResist:0,lifestealRatio:0,
  flatMoveSpeed:0,percentMoveSpeed:0,
};

/** The twelve stat keys Data Dragon actually uses on items. */
export function parseItemStats(stats:Record<string,number>|undefined):ItemStats{
  const s=stats??{};
  const n=(k:string)=>Number.isFinite(s[k])?s[k]:0;
  return {
    attackDamage:n('FlatPhysicalDamageMod'),
    abilityPower:n('FlatMagicDamageMod'),
    attackSpeedRatio:n('PercentAttackSpeedMod'),
    critChance:n('FlatCritChanceMod'),
    health:n('FlatHPPoolMod'),
    armor:n('FlatArmorMod'),
    magicResist:n('FlatSpellBlockMod'),
    lifestealRatio:n('PercentLifeStealMod'),
    flatMoveSpeed:n('FlatMovementSpeedMod'),
    percentMoveSpeed:n('PercentMovementSpeedMod'),
  };
}

export const addStats=(a:ItemStats,b:ItemStats):ItemStats=>({
  attackDamage:a.attackDamage+b.attackDamage,
  abilityPower:a.abilityPower+b.abilityPower,
  attackSpeedRatio:a.attackSpeedRatio+b.attackSpeedRatio,
  critChance:a.critChance+b.critChance,
  health:a.health+b.health,
  armor:a.armor+b.armor,
  magicResist:a.magicResist+b.magicResist,
  lifestealRatio:a.lifestealRatio+b.lifestealRatio,
  flatMoveSpeed:a.flatMoveSpeed+b.flatMoveSpeed,
  percentMoveSpeed:a.percentMoveSpeed+b.percentMoveSpeed,
});

export const emptyStats=():ItemStats=>({...EMPTY});

export interface CombatProfile{
  level:number;
  attackDamage:number;
  attackSpeed:number;
  critChance:number;
  /** Average damage per auto once crit is averaged in. */
  effectiveAttackDamage:number;
  dps:number;
  effectiveHpVsPhysical:number;
  effectiveHpVsMagic:number;
  abilityPower:number;
  /** True when attack speed hit the game cap, so more of it is worth nothing. */
  attackSpeedCapped:boolean;
}

/**
 * Auto-attack damage per second at a level, optionally with item stats.
 *
 * Crit is averaged rather than simulated: over any real fight the expected
 * damage is what matters, and averaging is exact for expected value.
 */
export function combatProfile(
  base:ChampionStatBlock,level:number,bonuses:ItemStats=EMPTY,
):CombatProfile{
  const s=statsAtLevel(base,level);
  const attackDamage=round(s.attackDamage+bonuses.attackDamage);

  // Bonus attack speed is additive against base, never multiplicative.
  const rawAttackSpeed=s.baseAttackSpeed*(1+s.bonusAttackSpeedRatio+bonuses.attackSpeedRatio);
  const attackSpeedCapped=rawAttackSpeed>ATTACK_SPEED_CAP;
  const attackSpeed=round3(Math.min(rawAttackSpeed,ATTACK_SPEED_CAP));

  const critChance=Math.min(CRIT_CHANCE_CAP,Math.max(0,bonuses.critChance));
  const effectiveAttackDamage=attackDamage*(1+critChance*(CRIT_MULTIPLIER-1));

  const hp=s.hp+bonuses.health;
  const armor=s.armor+bonuses.armor;
  const magicResist=s.magicResist+bonuses.magicResist;

  return {
    level:s.level,
    attackDamage,
    attackSpeed,
    critChance:round3(critChance),
    effectiveAttackDamage:round(effectiveAttackDamage),
    dps:round(effectiveAttackDamage*attackSpeed),
    effectiveHpVsPhysical:round(hp*(1+armor/100)),
    effectiveHpVsMagic:round(hp*(1+magicResist/100)),
    abilityPower:bonuses.abilityPower,
    attackSpeedCapped,
  };
}

export interface DpsPoint{level:number;dps:number;attackDamage:number;attackSpeed:number}

/** DPS at every level, for charting. */
export function dpsCurve(base:ChampionStatBlock,bonuses:ItemStats=EMPTY):DpsPoint[]{
  const points:DpsPoint[]=[];
  for(let level=1;level<=18;level++){
    const c=combatProfile(base,level,bonuses);
    points.push({level,dps:c.dps,attackDamage:c.attackDamage,attackSpeed:c.attackSpeed});
  }
  return points;
}

export interface ItemValue{
  id:number;
  name:string;
  gold:number;
  stats:ItemStats;
  /** DPS this item adds on top of what is already built. */
  dpsGain:number;
  /** Effective HP added, averaged across both damage types. */
  ehpGain:number;
  abilityPowerGain:number;
  /** DPS per 1000 gold. Null when the item costs nothing or adds no damage. */
  dpsPerThousandGold:number|null;
  /** Set when the item adds nothing this calculation can see. */
  note?:string;
}

export interface DataDragonItemLike{
  name:string;
  gold?:{total?:number};
  stats?:Record<string,number>;
}

/**
 * What each item is actually worth on this champion, at this level, on top of
 * whatever is already built.
 *
 * Ranking by DPS per gold answers "which item gives the most damage for the
 * money" — the honest version of the win-rate question, and a more directly
 * useful one, because it does not depend on who happened to buy it.
 */
export function rankItems(
  base:ChampionStatBlock,
  level:number,
  items:Record<string,DataDragonItemLike>,
  alreadyBuilt:ItemStats=EMPTY,
):ItemValue[]{
  const before=combatProfile(base,level,alreadyBuilt);
  const values:ItemValue[]=[];

  for(const [id,item] of Object.entries(items)){
    const stats=parseItemStats(item.stats);
    const after=combatProfile(base,level,addStats(alreadyBuilt,stats));
    const gold=item.gold?.total??0;

    const dpsGain=round(after.dps-before.dps);
    const ehpGain=round(
      ((after.effectiveHpVsPhysical-before.effectiveHpVsPhysical)+
       (after.effectiveHpVsMagic-before.effectiveHpVsMagic))/2);

    let note:string|undefined;
    if(stats.abilityPower>0&&dpsGain===0)
      note='Ability power only. Riot does not publish ability damage, so its real value is not visible here.';
    else if(stats.attackSpeedRatio>0&&after.attackSpeedCapped)
      // Already at the cap is the worse case, not the lesser one: the whole
      // attack-speed component is wasted rather than only the part above it.
      note=before.attackSpeedCapped
        ?'You are already at the attack speed cap, so this item\'s attack speed does nothing at all.'
        :'This crosses the attack speed cap, so part of its attack speed is wasted.';

    values.push({
      id:Number(id),name:item.name,gold,stats,
      dpsGain,ehpGain,abilityPowerGain:stats.abilityPower,
      dpsPerThousandGold:gold>0&&dpsGain>0?round(dpsGain/gold*1000):null,
      note,
    });
  }

  return values;
}

/** The items that actually add auto-attack damage, best value first. */
export const byDamagePerGold=(values:ItemValue[]):ItemValue[]=>
  values.filter(v=>v.dpsPerThousandGold!==null)
    .sort((a,b)=>(b.dpsPerThousandGold??0)-(a.dpsPerThousandGold??0));

const round=(n:number)=>Math.round(n*10)/10;
const round3=(n:number)=>Math.round(n*1000)/1000;

export type {LevelStats};
