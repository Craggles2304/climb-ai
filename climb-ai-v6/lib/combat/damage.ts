/**
 * Mitigation: turning a raw damage number into what the target actually loses.
 *
 * The formula evaluator produces raw damage. This applies the target's
 * resistances, the attacker's reduction and penetration, and reports both
 * figures — because "my Q does 450" and "my Q does 260 to this target" are
 * different claims and a player needs to see both.
 *
 * EVERYTHING HERE IS A GAME RULE, NOT DATA
 * None of these formulas appear in Riot's files; they are how the game behaves.
 * So they live in one place, named and commented, and they are the first thing
 * to check when a patch changes mitigation. Nothing else in the engine should
 * contain a mitigation constant.
 *
 * ORDER MATTERS AND IS NOT OPTIONAL
 * Reduction, then percent penetration, then flat penetration. Applying flat
 * penetration before percent would overstate damage against every armour stack
 * in the game, and the two operations differ in one further way that is easy to
 * miss: reduction can drive a resistance below zero, penetration cannot. An
 * enemy at 20 armour facing 25 lethality sits at 0, not -5.
 */

export type DamageType='PHYSICAL'|'MAGIC'|'TRUE';

/**
 * Lethality converts to flat armour penetration one-for-one.
 *
 * This was historically scaled by the attacker's level and no longer is, which
 * is exactly the sort of rule that changes between seasons — hence the named
 * constant rather than a bare 1 somewhere in the maths.
 */
export const LETHALITY_TO_FLAT_PEN=1;

export interface Penetration{
  /** Flat armour penetration, lethality already converted. */
  flatArmorPen:number;
  /** 0-1. Lord Dominik's and friends. */
  percentArmorPen:number;
  /** Armour reduction, which unlike penetration can go below zero. */
  flatArmorReduction:number;
  percentArmorReduction:number;
  flatMagicPen:number;
  percentMagicPen:number;
}

export const noPenetration=():Penetration=>({
  flatArmorPen:0,percentArmorPen:0,
  flatArmorReduction:0,percentArmorReduction:0,
  flatMagicPen:0,percentMagicPen:0,
});

/** Lethality is an input players actually see, so it is accepted directly. */
export const penetrationFromLethality=(lethality:number):Penetration=>({
  ...noPenetration(),
  flatArmorPen:Math.max(0,lethality)*LETHALITY_TO_FLAT_PEN,
});

export interface TargetResistances{armor:number;magicResist:number}

export interface DamageResult{
  type:DamageType;
  /** Before the target's resistances. */
  raw:number;
  /** After them. */
  mitigated:number;
  /** Damage the resistances absorbed. */
  absorbed:number;
  /** The resistance actually faced, after reduction and penetration. */
  effectiveResistance:number;
  /** Share of raw damage that got through, 0-1 (above 1 at negative resistance). */
  multiplier:number;
}

/**
 * Damage taken as a share of raw, for a given resistance.
 *
 * Positive resistance reduces damage on a diminishing curve; negative
 * resistance amplifies it, and does so more gently than the positive case
 * reduces it — 100 armour halves damage, but -100 armour multiplies it by 1.5
 * rather than doubling it.
 */
export function damageMultiplier(resistance:number):number{
  if(resistance>=0)return 100/(100+resistance);
  return 2-100/(100-resistance);
}

/**
 * The resistance an attack actually meets.
 *
 * Reduction first and it may go negative. Penetration second and it floors at
 * zero, so penetration can never turn a low-resistance target into one taking
 * amplified damage.
 */
export function effectiveResistance(
  base:number,
  opts:{flatReduction?:number;percentReduction?:number;percentPen?:number;flatPen?:number}={},
):number{
  let resistance=base-(opts.flatReduction??0);
  resistance*=1-clamp01(opts.percentReduction??0);

  // Penetration applies to what reduction left, and cannot push below zero.
  if(resistance>0){
    resistance*=1-clamp01(opts.percentPen??0);
    resistance=Math.max(0,resistance-Math.max(0,opts.flatPen??0));
  }
  return round(resistance);
}

export function mitigate(
  raw:number,
  type:DamageType,
  target:TargetResistances,
  pen:Penetration=noPenetration(),
):DamageResult{
  const safeRaw=Number.isFinite(raw)?Math.max(0,raw):0;

  if(type==='TRUE'){
    // True damage ignores resistances entirely — no multiplier, no penetration.
    return {
      type,raw:round(safeRaw),mitigated:round(safeRaw),absorbed:0,
      effectiveResistance:0,multiplier:1,
    };
  }

  const resistance=type==='PHYSICAL'
    ?effectiveResistance(target.armor,{
      flatReduction:pen.flatArmorReduction,
      percentReduction:pen.percentArmorReduction,
      percentPen:pen.percentArmorPen,
      flatPen:pen.flatArmorPen,
    })
    :effectiveResistance(target.magicResist,{
      percentPen:pen.percentMagicPen,
      flatPen:pen.flatMagicPen,
    });

  const multiplier=damageMultiplier(resistance);
  const mitigated=safeRaw*multiplier;

  return {
    type,
    raw:round(safeRaw),
    mitigated:round(mitigated),
    absorbed:round(safeRaw-mitigated),
    effectiveResistance:resistance,
    multiplier:Number(multiplier.toFixed(4)),
  };
}

/* ------------------------------------------------------------ components -- */

/**
 * An ability can deal several kinds of damage at once, and forcing them into one
 * number loses the part that matters: a mixed-damage ability is not countered by
 * one resistance. Each component is mitigated on its own and then summed.
 */
export interface DamageComponent{
  label:string;
  type:DamageType;
  raw:number|null;
  /** Why this component has no number, when it has none. */
  unmodelled?:string[];
}

export interface DamageBreakdown{
  components:(DamageResult&{label:string})[];
  rawTotal:number;
  mitigatedTotal:number;
  /** Components that could not be calculated, with the reason. */
  skipped:{label:string;reasons:string[]}[];
  /** False when anything was skipped — the total is then a floor, not a total. */
  complete:boolean;
}

export function mitigateAll(
  components:DamageComponent[],
  target:TargetResistances,
  pen:Penetration=noPenetration(),
):DamageBreakdown{
  const resolved:(DamageResult&{label:string})[]=[];
  const skipped:{label:string;reasons:string[]}[]=[];

  for(const component of components){
    if(component.raw===null||!Number.isFinite(component.raw)){
      skipped.push({
        label:component.label,
        reasons:component.unmodelled?.length
          ?component.unmodelled
          :['No damage figure was available for this component.'],
      });
      continue;
    }
    resolved.push({label:component.label,...mitigate(component.raw,component.type,target,pen)});
  }

  return {
    components:resolved,
    rawTotal:round(resolved.reduce((sum,c)=>sum+c.raw,0)),
    mitigatedTotal:round(resolved.reduce((sum,c)=>sum+c.mitigated,0)),
    skipped,
    // A total with a component missing is a lower bound, and the caller must be
    // able to tell the difference rather than presenting it as the real figure.
    complete:skipped.length===0,
  };
}

/* ------------------------------------------------------------------ kill -- */

export interface KillCheck{
  /** Post-mitigation damage available. */
  damage:number;
  targetHealth:number;
  /** Health the target may have that this does not account for. */
  shield:number;
  kills:boolean;
  /** Target health percentage at which this becomes lethal, 0-100. */
  thresholdPercent:number|null;
  /** The same with a margin, for advice a player can act on. */
  practicalThresholdPercent:number|null;
  note:string;
}

/**
 * A theoretical threshold assumes every hit lands. A practical one leaves room
 * for the one that does not, and the two are reported separately because
 * telling a player "this kills below 79%" and having it not is worse than
 * telling them 65% and having it spare.
 */
export const PRACTICAL_KILL_MARGIN=0.85;

export function killThreshold(
  damage:number,maxHealth:number,shield=0,
):KillCheck{
  // Math.max(1, NaN) is NaN, not 1 — so every input is checked for finiteness
  // before it is clamped. A non-finite health slipped straight through a
  // Math.max guard and produced a NaN threshold.
  const effectiveDamage=Math.max(0,positive(damage)-positive(shield));
  const health=Math.max(1,positive(maxHealth));
  const ratio=effectiveDamage/health;

  const theoretical=ratio>0?Math.min(100,round(ratio*100)):null;
  const practical=ratio>0?Math.min(100,round(ratio*PRACTICAL_KILL_MARGIN*100)):null;

  return {
    damage:round(effectiveDamage),
    targetHealth:round(health),
    shield:round(positive(shield)),
    kills:effectiveDamage>=health,
    thresholdPercent:theoretical,
    practicalThresholdPercent:practical,
    note:ratio<=0
      ?'This deals no damage the target cannot absorb.'
      :ratio>=1
        ?`Lethal from full health: ${round(effectiveDamage)} against ${round(health)}.`
        :`Lethal below roughly ${theoretical}% of ${round(health)} health. Allow for a missed hit and treat ${practical}% as the number to act on.`,
  };
}

const clamp01=(n:number)=>Math.min(1,Math.max(0,Number.isFinite(n)?n:0));

/** Zero for anything that is not a finite, positive number. */
const positive=(n:number)=>Number.isFinite(n)&&n>0?n:0;
const round=(n:number)=>Math.round(n*10)/10;
