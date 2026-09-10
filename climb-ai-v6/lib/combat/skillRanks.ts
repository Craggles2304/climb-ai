import type {AbilitySlot} from './combos';

export type AbilityRanks=Partial<Record<AbilitySlot,number>>;

/**
 * A conservative standard-champion fallback skill order.
 *
 * The old fallback forced every Q/W/E/R to at least rank 1, which made a level
 * 1 champion appear to own four spells. This order spends exactly one point per
 * champion level and respects the normal R unlocks at 6/11/16.
 *
 * It is intentionally only a fallback. Matchup Lab lets the player set the
 * actual ranks because real champions max different abilities and a handful of
 * champions have non-standard skill systems.
 */
const STANDARD_Q_MAX_ORDER:AbilitySlot[]=[
  'Q','W','E','Q','Q','R','Q','W','Q','W','R','W','W','E','E','R','E','E',
];

export function legalDefaultRanks(level:number):Record<AbilitySlot,number>{
  const ranks:Record<AbilitySlot,number>={Q:0,W:0,E:0,R:0};
  const points=Math.max(1,Math.min(18,Math.round(level)));
  for(const slot of STANDARD_Q_MAX_ORDER.slice(0,points))ranks[slot]++;
  return ranks;
}

/**
 * Clamp a user-entered standard rank page to what is individually possible at
 * the selected champion level. We do not silently redistribute excess points:
 * invalid totals are reduced from the latest-priority slots so the simulation
 * never creates skill points that do not exist.
 */
export function normaliseStandardRanks(
  requested:AbilityRanks|undefined,
  level:number,
):Record<AbilitySlot,number>{
  const fallback=legalDefaultRanks(level);
  if(!requested)return fallback;

  const l=Math.max(1,Math.min(18,Math.round(level)));
  const basicCap=Math.min(5,Math.floor((l+1)/2));
  const ultCap=l>=16?3:l>=11?2:l>=6?1:0;
  const ranks:Record<AbilitySlot,number>={
    Q:clamp(requested.Q??fallback.Q,0,basicCap),
    W:clamp(requested.W??fallback.W,0,basicCap),
    E:clamp(requested.E??fallback.E,0,basicCap),
    R:clamp(requested.R??fallback.R,0,ultCap),
  };

  let total=ranks.Q+ranks.W+ranks.E+ranks.R;
  // Remove impossible excess points without inventing a different skill order.
  for(const slot of ['E','W','Q','R'] as AbilitySlot[]){
    while(total>l&&ranks[slot]>0){ranks[slot]--;total--}
  }
  return ranks;
}

export function maxRankAtLevel(slot:AbilitySlot,level:number,maxRank=slot==='R'?3:5):number{
  const l=Math.max(1,Math.min(18,Math.round(level)));
  const legal=slot==='R'?(l>=16?3:l>=11?2:l>=6?1:0):Math.min(5,Math.floor((l+1)/2));
  return Math.min(maxRank,legal);
}

const clamp=(n:number,lo:number,hi:number)=>
  Math.min(hi,Math.max(lo,Number.isFinite(n)?Math.round(n):lo));
