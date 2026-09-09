/**
 * Structural types for the Data Dragon champion files, plus the stat maths
 * Riot itself uses. Only fields this codebase reads are declared.
 *
 * Data Dragon is a public static CDN: no API key, no rate limit, no Riot
 * approval needed. Everything in lib/champions is derived from it, which is
 * why these features work today while the production key is still pending.
 */

export interface ChampionStatBlock{
  hp:number;hpperlevel:number;
  armor:number;armorperlevel:number;
  spellblock:number;spellblockperlevel:number;
  attackdamage:number;attackdamageperlevel:number;
  attackspeed:number;attackspeedperlevel:number;
  movespeed:number;attackrange:number;
  [k:string]:number;
}

export interface ChampionInfo{attack:number;defense:number;magic:number;difficulty:number}

/** An entry in champion.json — every champion, stats and info but no spells. */
export interface ChampionListEntry{
  id:string;key:string;name:string;title:string;
  tags:string[];partype:string;
  info:ChampionInfo;
  stats:ChampionStatBlock;
}

export interface ChampionSpell{
  id:string;name:string;maxrank:number;
  cooldown?:number[];cost?:number[];range?:number[];
  /** '-1' for a normal ability; a number for charge-based ones. */
  maxammo?:string;
}

/** A single champion's full file — adds spells, passive and Riot's own tips. */
export interface ChampionDetail extends ChampionListEntry{
  spells:ChampionSpell[];
  passive:{name:string;description:string};
  allytips?:string[];
  enemytips?:string[];
}

/**
 * Riot's growth curve for every per-level stat. Deliberately non-linear early
 * and tuned so that level 18 is exactly base + 17 x growth.
 *
 *   value = base + growth x (n-1) x (0.7025 + 0.0175 x (n-1))
 */
export const growthMultiplier=(level:number)=>{
  const n=clampLevel(level)-1;
  return n*(0.7025+0.0175*n);
};

export const clampLevel=(level:number)=>Math.min(18,Math.max(1,Math.round(level)));

const grow=(base:number,per:number,level:number)=>base+per*growthMultiplier(level);

export interface LevelStats{
  level:number;
  hp:number;armor:number;magicResist:number;
  attackDamage:number;attackSpeed:number;
  moveSpeed:number;attackRange:number;
  /** Health scaled by resistances — the number that decides who wins a trade. */
  effectiveHpVsPhysical:number;
  effectiveHpVsMagic:number;
}

/** Every stat this champion has at a given level, straight from Riot's maths. */
export function statsAtLevel(s:ChampionStatBlock,level:number):LevelStats{
  const n=clampLevel(level);
  const hp=grow(s.hp,s.hpperlevel,n);
  const armor=grow(s.armor,s.armorperlevel,n);
  const magicResist=grow(s.spellblock,s.spellblockperlevel,n);
  // Attack speed grows as a percentage of the base value, not a flat add.
  const attackSpeed=s.attackspeed*(1+(s.attackspeedperlevel/100)*growthMultiplier(n));
  return {
    level:n,
    hp:round(hp),armor:round(armor),magicResist:round(magicResist),
    attackDamage:round(grow(s.attackdamage,s.attackdamageperlevel,n)),
    attackSpeed:Number(attackSpeed.toFixed(3)),
    moveSpeed:s.movespeed,attackRange:s.attackrange,
    effectiveHpVsPhysical:round(hp*(1+armor/100)),
    effectiveHpVsMagic:round(hp*(1+magicResist/100)),
  };
}

const round=(n:number)=>Math.round(n*10)/10;

export type RangeClass='MELEE'|'SHORT'|'RANGED'|'LONG';

/** Bands chosen from the actual roster: 125-175 melee, 500-550 typical ADC. */
export function rangeClass(attackRange:number):RangeClass{
  if(attackRange<300)return 'MELEE';
  if(attackRange<500)return 'SHORT';
  if(attackRange<600)return 'RANGED';
  return 'LONG';
}

export type DamageType='PHYSICAL'|'MAGIC'|'MIXED';

/**
 * Riot's own attack/magic ratings, which are the only damage-type signal the
 * static data carries. Close ratings mean mixed, not a coin flip.
 */
export function damageType(info:ChampionInfo):DamageType{
  const gap=info.attack-info.magic;
  if(gap>=3)return 'PHYSICAL';
  if(gap<=-3)return 'MAGIC';
  return 'MIXED';
}

/**
 * An ultimate you can actually plan around. Fifteen champions have an
 * "ultimate" that is a stance, a form or a charge — Elise's Spider Form is 3s,
 * Teemo's traps 0.25s. Treating those as an all-in window would tell a player
 * to wait out a cooldown that is never down, which is worse than saying
 * nothing. So they are excluded and the reason is reported.
 */
export const MIN_ULT_WINDOW_S=30;

export function isTrackableUltimate(spell:ChampionSpell|undefined):boolean{
  if(!spell||!spell.cooldown||!spell.cooldown.length)return false;
  const charges=spell.maxammo!==undefined&&spell.maxammo!=='-1';
  return !charges&&spell.cooldown[0]>=MIN_ULT_WINDOW_S;
}

/** 1st, 2nd, 3rd, 93rd — not '93th'. */
export function ordinal(n:number):string{
  const abs=Math.abs(Math.round(n));
  const tens=abs%100;
  if(tens>=11&&tens<=13)return `${n}th`;
  const suffix=['th','st','nd','rd'][abs%10]??'th';
  return `${n}${abs%10<=3?suffix:'th'}`;
}
