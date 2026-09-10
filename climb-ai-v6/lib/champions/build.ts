import {ChampionStatBlock} from './ddragon';
import {
  ItemStats,DataDragonItemLike,addStats,combatProfile,emptyStats,parseItemStats,
} from './dps';

/**
 * Building a champion and finding the highest auto-attack DPS they can reach.
 *
 * WHY THIS IS A SEARCH AND NOT A SORT
 * Items do not contribute independently. Crit chance is worth nothing without
 * attack damage and vice versa, attack speed stops paying at the game cap, and
 * both caps mean the sixth item can be worth less than the first. So "the six
 * best items" is not the best six items, and picking greedily gets the wrong
 * answer on crit champions in particular.
 *
 * A full search is out of reach — 112 completed items choose 6 is about three
 * billion combinations. This uses a beam search instead: keep the best
 * BEAM_WIDTH partial builds at each step, extend each by every item, keep the
 * best again. At the default width that is roughly 130k evaluations, runs in
 * milliseconds, and matched exhaustive search on every case small enough to
 * check it against.
 *
 * It is still a search, so the result says so rather than claiming proof.
 */

export const BEAM_WIDTH=250;
export const MAX_BUILD_SIZE=6;

export interface BuildItem{id:number;name:string;gold:number;stats:ItemStats}

export interface BuildStep{
  name:string;
  dpsAfter:number;
  /** DPS this item added given everything before it. */
  gain:number;
  goldAfter:number;
}

export interface BestBuild{
  items:BuildItem[];
  dps:number;
  gold:number;
  steps:BuildStep[];
  /** Combinations actually evaluated. */
  evaluated:number;
  /** True only when every combination was checked, not just the beam. */
  exhaustive:boolean;
}

/** Sums a set of items into one stat block. */
export function buildStats(items:BuildItem[]):ItemStats{
  return items.reduce((total,i)=>addStats(total,i.stats),emptyStats());
}

export function toBuildItems(items:Record<string,DataDragonItemLike>):BuildItem[]{
  return Object.entries(items).map(([id,item])=>({
    id:Number(id),
    name:item.name,
    gold:item.gold?.total??0,
    stats:parseItemStats(item.stats),
  }));
}

interface BeamState{ids:number[];stats:ItemStats;dps:number;gold:number}

/**
 * The highest-DPS build of exactly `size` items, by beam search.
 *
 * Only items that can affect auto-attack damage are considered — an armour
 * item cannot raise DPS, so including it only widens the search.
 */
export function bestBuild(
  base:ChampionStatBlock,
  level:number,
  catalogue:BuildItem[],
  size=MAX_BUILD_SIZE,
  beamWidth=BEAM_WIDTH,
  /**
   * Gold cap. The unconstrained six-item maximum costs around 18,000g, which
   * no real game reaches, so a budget is what makes the answer usable.
   */
  budgetGold?:number,
):BestBuild{
  const targetSize=Math.max(0,Math.min(size,MAX_BUILD_SIZE));
  const budget=budgetGold!==undefined&&budgetGold>=0?budgetGold:Infinity;
  const relevant=catalogue.filter(i=>affectsDamage(i)&&i.gold<=budget);
  const byId=new Map(catalogue.map(i=>[i.id,i]));

  if(targetSize===0||relevant.length===0)
    return {
      items:[],dps:combatProfile(base,level).dps,gold:0,steps:[],
      evaluated:0,exhaustive:true,
    };

  // Exhaustive when the space is small enough to actually finish, so small
  // builds get a proven answer rather than a searched one.
  const combinations=choose(relevant.length,targetSize);
  const exhaustive=combinations<=200_000;

  let evaluated=0;
  let beam:BeamState[]=[{ids:[],stats:emptyStats(),dps:combatProfile(base,level).dps,gold:0}];

  for(let depth=0;depth<targetSize;depth++){
    const next=new Map<string,BeamState>();
    for(const state of beam){
      const highest=state.ids.length?state.ids[state.ids.length-1]:-1;
      for(const item of relevant){
        // Ids only ever increase, so each combination is reached once.
        if(item.id<=highest)continue;
        const gold=state.gold+item.gold;
        if(gold>budget)continue;
        const stats=addStats(state.stats,item.stats);
        const dps=combatProfile(base,level,stats).dps;
        evaluated++;
        const ids=[...state.ids,item.id];
        next.set(ids.join(','),{ids,stats,dps,gold});
      }
    }
    const ranked=[...next.values()].sort((a,b)=>b.dps-a.dps);
    // A budget can make the next item unaffordable. Stopping with the best
    // build found so far beats returning nothing.
    if(!ranked.length)break;
    beam=exhaustive?ranked:ranked.slice(0,beamWidth);
  }

  const winner=beam[0];
  if(!winner)
    return {items:[],dps:combatProfile(base,level).dps,gold:0,steps:[],evaluated,exhaustive};

  const items=winner.ids.map(id=>byId.get(id)!).filter(Boolean);
  return {
    items,
    dps:winner.dps,
    gold:items.reduce((g,i)=>g+i.gold,0),
    steps:orderForBuying(base,level,items),
    evaluated,
    exhaustive,
  };
}

/**
 * The best DPS reachable at every build size, so the shape of the curve is
 * visible: where the next item stops being worth its gold.
 */
export function maxDpsBySize(
  base:ChampionStatBlock,
  level:number,
  catalogue:BuildItem[],
  maxSize=MAX_BUILD_SIZE,
  beamWidth=BEAM_WIDTH,
  budgetGold?:number,
):BestBuild[]{
  const out:BestBuild[]=[];
  for(let size=1;size<=maxSize;size++)
    out.push(bestBuild(base,level,catalogue,size,beamWidth,budgetGold));
  return out;
}

/**
 * Which order to buy a finished build in.
 *
 * Greedy is correct here in a way it is not for choosing the build: the set is
 * already fixed, so this only asks which item pays off soonest.
 */
export function orderForBuying(
  base:ChampionStatBlock,level:number,items:BuildItem[],
):BuildStep[]{
  const remaining=[...items];
  const steps:BuildStep[]=[];
  let stats=emptyStats();
  let dps=combatProfile(base,level).dps;
  let gold=0;

  while(remaining.length){
    let bestIndex=0;
    let bestDps=-Infinity;
    for(let i=0;i<remaining.length;i++){
      const candidate=combatProfile(base,level,addStats(stats,remaining[i].stats)).dps;
      if(candidate>bestDps){bestDps=candidate;bestIndex=i}
    }
    const [item]=remaining.splice(bestIndex,1);
    stats=addStats(stats,item.stats);
    gold+=item.gold;
    steps.push({
      name:item.name,
      dpsAfter:round(bestDps),
      gain:round(bestDps-dps),
      goldAfter:gold,
    });
    dps=bestDps;
  }
  return steps;
}

/** An item can only change auto-attack DPS through these three stats. */
const affectsDamage=(i:BuildItem)=>
  i.stats.attackDamage>0||i.stats.attackSpeedRatio>0||i.stats.critChance>0;

function choose(n:number,k:number):number{
  if(k>n)return 0;
  let result=1;
  for(let i=0;i<k;i++){
    result=result*(n-i)/(i+1);
    if(result>1e9)return 1e9;
  }
  return result;
}

const round=(n:number)=>Math.round(n*10)/10;
