/**
 * The spell formula normaliser: Riot's game-file calculation trees evaluated
 * into numbers.
 *
 * WHY THIS EXISTS
 * Data Dragon does not publish ability damage. Its `coefficients` are zeroed and
 * its tooltips reference placeholders (`{{ bladedamage }}`) that resolve to
 * nothing. The real formulas live in the game files mirrored by CommunityDragon,
 * as `GameCalculation` trees on each spell, and this module evaluates them.
 *
 * THE SHAPE, from reading the real files
 * A spell carries `DataValues` — named per-rank arrays — and
 * `mSpellCalculations`, a map of named `GameCalculation` trees. A calculation is
 * a sum of `mFormulaParts`. Darius Q decodes to:
 *
 *   BladeDamage = BaseDamage[rank] + AD x (TotalADRatio[rank] x 0.01)
 *   rank 1      = 50 + AD x 1.00
 *
 * which is the real ability exactly.
 *
 * TWO RULES THAT ARE EASY TO GET WRONG
 *  1. A part with no `mStat` means ability power. AP parts simply omit the
 *     field, which is why a survey of `mStat` values finds no AP mapping and
 *     could mislead you into thinking AP scaling is absent.
 *  2. `values` arrays are indexed by rank with index 0 being rank 0, so rank 1
 *     is `values[1]`. Reading `values[0]` gives an unused placeholder.
 *
 * UNITS ARE NOT NORMALISED HERE, ON PURPOSE
 * Some ratios are percentages needing a x0.01 step and others are already
 * decimals — Darius carries `TotalADRatio: 100` with an explicit 0.01 multiply,
 * Lux carries `APRatio: 0.75` with none. The conversion is part of the tree, so
 * evaluating the tree faithfully handles both. Do not "helpfully" rescale.
 *
 * WHEN IT CANNOT COMPUTE
 * It returns null and says which mechanic stopped it. A stack-counting part
 * needs live game state; an unmapped stat enum is a gap in this file; a hashed
 * type is something Riot did not name. None of those are allowed to become a
 * silent zero — see `Evaluated.unmodelled` and the confidence system built on it.
 */

/** Stats a formula can multiply by. */
export type StatKey=
  |'abilityPower'|'attackDamage'|'armor'|'magicResist'
  |'maxHealth'|'critChance'|'attackSpeed'|'moveSpeed';

/**
 * Numeric stat enum, derived from evidence rather than assumed: each mapping
 * below is one where the paired data-value name identifies the stat beyond
 * doubt (Malphite's armour ratios for 1, every AD ratio for 2, crit modifiers
 * for 8, shield-health ratios for 12).
 *
 * Unmapped numbers are deliberately absent rather than guessed. An unknown
 * enum makes the calculation report itself unmodelled, which is the correct
 * outcome: a wrong stat silently produces a plausible wrong number.
 */
export const STAT_ENUM:Record<number,StatKey>={
  1:'armor',
  2:'attackDamage',
  8:'critChance',
  12:'maxHealth',
};

/** A part with no mStat field scales with ability power. */
export const DEFAULT_STAT:StatKey='abilityPower';

export interface SpellDataValue{name:string;values:number[]}

export interface CombatStats{
  abilityPower:number;
  attackDamage:number;
  armor:number;
  magicResist:number;
  maxHealth:number;
  critChance:number;
  attackSpeed:number;
  moveSpeed:number;
}

export interface EvalContext{
  caster:CombatStats;
  /** 1-18. Needed by the level-interpolation parts. */
  level:number;
  /** Ability rank, 1-5 (or 1-3 for an ultimate). */
  rank:number;
  /** Named data values from the spell being evaluated. */
  dataValues:SpellDataValue[];
  /** Other calculations on the same spell, for GameCalculationModified. */
  calculations?:Record<string,unknown>;
  /** Buff stacks, when the caller actually knows them. */
  stacks?:number;
}

export interface Evaluated{
  /** Null when any required part could not be modelled. */
  value:number|null;
  /** One entry per mechanic that stopped or approximated the result. */
  unmodelled:string[];
}

/** How deep a modified-calculation chain may go before we call it a cycle. */
const MAX_DEPTH=12;

export function evaluateCalculation(
  calculation:unknown,ctx:EvalContext,depth=0,
):Evaluated{
  const unmodelled:string[]=[];
  const value=walk(calculation,ctx,unmodelled,depth);
  // A single unmodelled part poisons the whole number rather than being
  // silently dropped, because a partial sum looks exactly like a real one.
  return {value:unmodelled.length?null:value,unmodelled};
}

function walk(
  node:unknown,ctx:EvalContext,unmodelled:string[],depth:number,
):number|null{
  if(typeof node==='number')return node;
  if(!node||typeof node!=='object')return null;
  if(depth>MAX_DEPTH){unmodelled.push('Calculation nested too deeply to resolve.');return null}

  const part=node as Record<string,unknown>;
  const type=typeof part.__type==='string'?part.__type:'';

  switch(type){
    case 'GameCalculation':{
      const parts=Array.isArray(part.mFormulaParts)?part.mFormulaParts:[];
      if(!parts.length){unmodelled.push('Calculation has no formula parts.');return null}
      let total=0;
      for(const sub of parts){
        const value=walk(sub,ctx,unmodelled,depth+1);
        if(value===null)return null;
        total+=value;
      }
      return total;
    }

    case 'GameCalculationModified':{
      const name=typeof part.mModifiedGameCalculation==='string'
        ?part.mModifiedGameCalculation:null;
      const target=name?ctx.calculations?.[name]:null;
      if(!target){
        unmodelled.push(`Modified calculation "${name??'unnamed'}" was not found on this spell.`);
        return null;
      }
      const base=walk(target,ctx,unmodelled,depth+1);
      if(base===null)return null;
      const multiplier=part.mMultiplier!==undefined
        ?walk(part.mMultiplier,ctx,unmodelled,depth+1)
        :1;
      if(multiplier===null)return null;
      return base*multiplier;
    }

    case 'NumberCalculationPart':
      return typeof part.mNumber==='number'?part.mNumber:0;

    case 'NamedDataValueCalculationPart':{
      const value=dataValue(part.mDataValue,ctx);
      if(value===null)unmodelled.push(`Data value "${String(part.mDataValue)}" is missing from this spell.`);
      return value;
    }

    case 'StatByNamedDataValueCalculationPart':{
      const ratio=dataValue(part.mDataValue,ctx);
      if(ratio===null){
        unmodelled.push(`Data value "${String(part.mDataValue)}" is missing from this spell.`);
        return null;
      }
      const stat=resolveStat(part.mStat,ctx,unmodelled);
      return stat===null?null:stat*ratio;
    }

    case 'StatByCoefficientCalculationPart':{
      const coefficient=typeof part.mCoefficient==='number'?part.mCoefficient:0;
      const stat=resolveStat(part.mStat,ctx,unmodelled);
      return stat===null?null:stat*coefficient;
    }

    case 'StatBySubPartCalculationPart':{
      const sub=walk(part.mSubpart,ctx,unmodelled,depth+1);
      if(sub===null)return null;
      const stat=resolveStat(part.mStat,ctx,unmodelled);
      return stat===null?null:stat*sub;
    }

    case 'SumOfSubPartsCalculationPart':{
      const parts=Array.isArray(part.mSubparts)?part.mSubparts:[];
      let total=0;
      for(const sub of parts){
        const value=walk(sub,ctx,unmodelled,depth+1);
        if(value===null)return null;
        total+=value;
      }
      return total;
    }

    case 'ProductOfSubPartsCalculationPart':{
      const a=walk(part.mPart1,ctx,unmodelled,depth+1);
      const b=walk(part.mPart2,ctx,unmodelled,depth+1);
      return a===null||b===null?null:a*b;
    }

    case 'ByCharLevelInterpolationCalculationPart':{
      // Linear from level 1 to 18, which is how Riot's own tooltips read it.
      const start=numberOf(part.mStartValue);
      const end=numberOf(part.mEndValue);
      if(start===null||end===null){
        unmodelled.push('Level interpolation is missing its start or end value.');
        return null;
      }
      const span=(clampLevel(ctx.level)-1)/17;
      return start+(end-start)*span;
    }

    case 'ByCharLevelBreakpointsCalculationPart':{
      const value=breakpointValue(part,ctx.level);
      if(value===null)unmodelled.push('Level breakpoints could not be read.');
      return value;
    }

    // Stacks, marks and ammo depend on live game state. A caller that knows
    // the stack count can supply it; otherwise this is honestly unmodelled
    // rather than quietly treated as zero stacks.
    case 'BuffCounterByNamedDataValueCalculationPart':{
      if(ctx.stacks===undefined){
        unmodelled.push('Scales with buff stacks, which depend on live game state.');
        return null;
      }
      const perStack=dataValue(part.mDataValue,ctx);
      return perStack===null?null:perStack*ctx.stacks;
    }

    case 'BuffCounterByCoefficientCalculationPart':{
      if(ctx.stacks===undefined){
        unmodelled.push('Scales with buff stacks, which depend on live game state.');
        return null;
      }
      const coefficient=typeof part.mCoefficient==='number'?part.mCoefficient:0;
      return coefficient*ctx.stacks;
    }

    default:
      unmodelled.push(type
        ?`Formula part "${type}" is not modelled yet.`
        :'Formula part has no type Riot published a name for.');
      return null;
  }
}

/* -------------------------------------------------------------- helpers -- */

/**
 * Index 0 of a values array is rank 0 and is never the rank-1 figure, so this
 * clamps into the real ranks rather than reading the placeholder.
 */
export function dataValue(name:unknown,ctx:EvalContext):number|null{
  if(typeof name!=='string')return null;
  const entry=ctx.dataValues.find(d=>d.name===name);
  if(!entry||!Array.isArray(entry.values)||!entry.values.length)return null;
  const index=Math.min(entry.values.length-1,Math.max(0,Math.round(ctx.rank)));
  const value=entry.values[index];
  return typeof value==='number'&&Number.isFinite(value)?value:null;
}

function resolveStat(
  raw:unknown,ctx:EvalContext,unmodelled:string[],
):number|null{
  // Absent mStat means ability power — AP parts omit the field entirely.
  if(raw===undefined||raw===null)return ctx.caster[DEFAULT_STAT];
  if(typeof raw!=='number'){
    unmodelled.push('Formula references a stat in a form this does not understand.');
    return null;
  }
  const key=STAT_ENUM[raw];
  if(!key){
    unmodelled.push(`Formula scales with stat #${raw}, which is not mapped yet.`);
    return null;
  }
  return ctx.caster[key];
}

const numberOf=(node:unknown):number|null=>{
  if(typeof node==='number')return node;
  if(node&&typeof node==='object'){
    const part=node as Record<string,unknown>;
    if(typeof part.mNumber==='number')return part.mNumber;
  }
  return null;
};

/**
 * Growth that changes rate at set levels. Garen's is the clearest real example:
 *
 *   mLevel1Value 1.5, mInitialBonusPerLevel 0.2,
 *   breakpoints at level 7 (0.8 per level) and level 14 (0.4 per level)
 *
 * So the value accrues one bonus per level gained, at whatever rate applies to
 * that level — `mBonusPerLevelAtAndAfter` takes effect from its own level up.
 */
function breakpointValue(part:Record<string,unknown>,level:number):number|null{
  const base=numberOf(part.mLevel1Value);
  if(base===null)return null;

  const initialRate=numberOf(part.mInitialBonusPerLevel)??0;
  const breakpoints=(Array.isArray(part.mBreakpoints)?part.mBreakpoints:[])
    .map(point=>{
      const entry=point as Record<string,unknown>;
      return {
        level:typeof entry.mLevel==='number'?entry.mLevel:null,
        rate:numberOf(entry.mBonusPerLevelAtAndAfter),
      };
    })
    .filter((b):b is {level:number;rate:number}=>b.level!==null&&b.rate!==null)
    .sort((a,b)=>a.level-b.level);

  let value=base;
  for(let lv=2;lv<=clampLevel(level);lv++){
    let rate=initialRate;
    for(const point of breakpoints)if(lv>=point.level)rate=point.rate;
    value+=rate;
  }
  return value;
}

const clampLevel=(level:number)=>Math.min(18,Math.max(1,Math.round(level)));
