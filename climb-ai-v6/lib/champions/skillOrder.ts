import {ChampionDetail,ChampionSpell} from './ddragon';

/**
 * Ability levelling order.
 *
 * READ THIS BEFORE USING IT.
 *
 * The order that maximises DAMAGE cannot be computed. Ranking abilities by
 * damage per rank needs the damage per rank, and Riot removed it — across all
 * 173 champions, 0 of 692 spells still carry `datavalues` or `vars`, and the
 * tooltips reference placeholders that resolve to nothing. Anyone claiming a
 * damage-optimal skill order from Data Dragon is guessing.
 *
 * What IS in the data is cooldowns, at every rank. So this computes the order
 * that maximises ABILITY UPTIME: how much more often each ability is available
 * once maxed. That is a real and useful ordering — for a champion whose damage
 * comes from casting the same ability repeatedly it is often the same answer —
 * but it is a different question from damage, and the type says so.
 *
 * The level pattern itself is mostly structural: ultimates rank at 6/11/16 and
 * basics have five ranks each. Every spare level goes to the ability being
 * maxed, so the first finishes at 8, the second at 13 and the third at 18. See
 * CONVENTIONAL_FIRST_MAX for why guides usually say 9 instead.
 */

export const ULT_LEVELS=[6,11,16];
export const SLOT_KEYS=['Q','W','E'] as const;
export type SlotKey=typeof SLOT_KEYS[number]|'R';

/**
 * The level most guides finish the first basic on. Kept only to explain the
 * difference: this module maxes it at 8 instead, because it spends every spare
 * level on the ability it is trying to get the most uptime from, and a guide
 * usually puts level 8 into the second ability for damage reasons that are not
 * visible in this data. Both reach rank 5 on the second ability at 13 and the
 * third at 18.
 */
export const CONVENTIONAL_FIRST_MAX=9;

export interface AbilityUptime{
  slot:SlotKey;
  name:string;
  firstRankCooldown:number|null;
  maxRankCooldown:number|null;
  /** Percentage more often available at max rank than at rank 1. */
  uptimeGainPercent:number|null;
  /** Level this ability reaches its final rank. Read off the sequence. */
  maxedAtLevel:number|null;
  fact:string;
}

export interface LevelUp{level:number;slot:SlotKey;name:string;rankAfter:number}

export interface SkillOrder{
  /** Basics in the order they should be maxed, by uptime. */
  maxOrder:AbilityUptime[];
  ultimate:AbilityUptime|null;
  /** All 18 level-ups. */
  sequence:LevelUp[];
  /** Compact form, e.g. "Q > E > W". */
  shorthand:string;
  basis:string;
  unavailable:string[];
}

const BASIS=
  'Ordered by ability uptime — how much more often each ability is available '+
  'once maxed. This is not a damage ordering: Riot no longer publishes ability '+
  'damage per rank, so no damage-optimal order can be calculated from this data.';

export function skillOrder(champion:ChampionDetail):SkillOrder{
  const spells=champion.spells??[];
  const basics=SLOT_KEYS.map((slot,i)=>uptimeFor(slot,spells[i]));
  const ultimate=spells[3]?uptimeFor('R',spells[3]):null;

  // Highest uptime gain first. Ties keep Data Dragon's own Q/W/E order rather
  // than picking arbitrarily, so the result is stable between runs.
  const maxOrder=[...basics].sort((a,b)=>
    (b.uptimeGainPercent??-1)-(a.uptimeGainPercent??-1)
    ||SLOT_KEYS.indexOf(a.slot as 'Q')-SLOT_KEYS.indexOf(b.slot as 'Q'));

  const unavailable=[
    'The damage-optimal order — Riot does not publish ability damage per rank.',
  ];
  if(basics.every(b=>b.uptimeGainPercent===null))
    unavailable.push('Uptime ordering — none of these abilities list a cooldown that changes by rank.');

  const sequence=sequenceFor(maxOrder,ultimate);

  // Completion levels are read off the sequence rather than asserted. An
  // earlier version hardcoded 9/13/18 from the usual guide ordering, which did
  // not match what this actually generates — it maxes the first ability at 8.
  const maxedAt=(slot:SlotKey)=>{
    const last=[...sequence].reverse().find(s=>s.slot===slot);
    return last?last.level:null;
  };
  const withLevels=(a:AbilityUptime):AbilityUptime=>({...a,maxedAtLevel:maxedAt(a.slot)});

  return {
    maxOrder:maxOrder.map(withLevels),
    ultimate:ultimate?withLevels(ultimate):null,
    sequence,
    shorthand:maxOrder.map(a=>a.slot).join(' > '),
    basis:BASIS,
    unavailable,
  };
}

function uptimeFor(slot:SlotKey,spell:ChampionSpell|undefined):AbilityUptime{
  if(!spell)
    return {slot,name:`${slot} (unavailable)`,firstRankCooldown:null,maxRankCooldown:null,
      uptimeGainPercent:null,maxedAtLevel:null,fact:'Riot lists no ability in this slot.'};

  const cds=spell.cooldown;
  if(!cds||!cds.length)
    return {slot,name:spell.name,firstRankCooldown:null,maxRankCooldown:null,
      uptimeGainPercent:null,maxedAtLevel:null,fact:`${spell.name} has no cooldown listed, so its uptime cannot be compared.`};

  const first=cds[0];
  const last=cds[cds.length-1];

  // A cooldown that reaches zero has no ratio. Urgot's Purge really does.
  if(last<=0)
    return {slot,name:spell.name,firstRankCooldown:first,maxRankCooldown:last,
      uptimeGainPercent:null,maxedAtLevel:null,
      fact:`${spell.name} drops from ${first}s to no cooldown at all by max rank.`};

  const gain=Math.round((first/last-1)*100);
  return {
    slot,name:spell.name,firstRankCooldown:first,maxRankCooldown:last,
    uptimeGainPercent:gain,maxedAtLevel:null,
    fact:gain>0
      ?`${spell.name} drops from ${first}s to ${last}s — available about ${gain}% more often at max rank.`
      :`${spell.name} stays at ${first}s at every rank, so ranking it buys power rather than uptime.`,
  };
}

/**
 * The 18-level sequence. Ultimates take 6/11/16; the three basics take one
 * point each in the first three levels and then max in order, each taking
 * every spare level until it is finished.
 */
function sequenceFor(maxOrder:AbilityUptime[],ultimate:AbilityUptime|null):LevelUp[]{
  const ranks=new Map<SlotKey,number>();
  const sequence:LevelUp[]=[];
  const add=(level:number,ability:AbilityUptime)=>{
    const rankAfter=(ranks.get(ability.slot)??0)+1;
    ranks.set(ability.slot,rankAfter);
    sequence.push({level,slot:ability.slot,name:ability.name,rankAfter});
  };

  for(let level=1;level<=18;level++){
    if(ULT_LEVELS.includes(level)){
      if(ultimate&&(ranks.get('R')??0)<3){add(level,ultimate);continue}
      // A champion with no fourth spell still spends the level on a basic.
    }
    if(level<=3&&maxOrder[level-1]){add(level,maxOrder[level-1]);continue}
    const next=maxOrder.find(a=>(ranks.get(a.slot)??0)<5);
    if(next)add(level,next);
  }
  return sequence;
}
