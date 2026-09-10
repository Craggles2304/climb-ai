/**
 * Which Data Dragon items count as a *completed* item.
 *
 * Pure and separate from the service so it can be tested against real item
 * shapes — this rule was wrong once and cost us most of our item timings.
 */

export interface DataDragonItem{
  into?:string[];
  from?:string[];
  depth?:number;
  gold?:{total?:number};
  maps?:Record<string,boolean>;
  tags?:string[];
}

/** Below this, an item is a component rather than a finished purchase. */
export const MIN_COMPLETED_GOLD=1600;

/**
 * An item is complete when it builds into nothing further, is itself built from
 * components, costs like a legendary, is available on Summoner's Rift, and is
 * not a consumable or trinket.
 *
 * Note on `depth`: an earlier version required depth >= 3. That silently
 * excluded Infinity Edge and Rabadon's Deathcap, which are depth 2 and are core
 * purchases for most ADCs and mages. Depth is not a reliable proxy for
 * "finished"; the `into`/`from` relationship is.
 */
export function isCompletedItem(item:DataDragonItem):boolean{
  const buildsIntoNothing=!item.into||item.into.length===0;
  const builtFromComponents=Array.isArray(item.from)&&item.from.length>0;
  const legendaryCost=(item.gold?.total??0)>=MIN_COMPLETED_GOLD;
  const onRift=item.maps?.['11']!==false;
  const consumable=(item.tags||[]).some(t=>t==='Consumable'||t==='Trinket');
  return buildsIntoNothing&&builtFromComponents&&legendaryCost&&onRift&&!consumable;
}

/** Completed item ids from a Data Dragon item.json payload. */
export function completedItemIdsFrom(data:Record<string,DataDragonItem>):Set<number>{
  const ids=new Set<number>();
  for(const [id,item] of Object.entries(data)){
    if(isCompletedItem(item))ids.add(Number(id));
  }
  return ids;
}

/**
 * Data Dragon ships game-mode variants of the same item under different ids —
 * The Collector is both 6676 and 667666, Manamune both 3004 and 323004 — and
 * some of those variants still claim map 11, so the Summoner's Rift filter
 * does not remove them. They also carry different gold costs, so keeping both
 * puts one item twice in a "best value" table with two different answers.
 *
 * The canonical Rift item is always the lowest id: mode variants are built by
 * prefixing it (22…, 32…, 77…) or repeating digits.
 */
export function dedupeByName<T extends {name:string}>(
  items:Record<string,T>,
):Record<string,T>{
  const bestIdForName=new Map<string,number>();
  for(const id of Object.keys(items)){
    const name=items[id].name;
    const numeric=Number(id);
    if(!Number.isFinite(numeric))continue;
    const current=bestIdForName.get(name);
    if(current===undefined||numeric<current)bestIdForName.set(name,numeric);
  }

  const out:Record<string,T>={};
  for(const [id,item] of Object.entries(items)){
    const numeric=Number(id);
    if(!Number.isFinite(numeric)){out[id]=item;continue}
    if(bestIdForName.get(item.name)===numeric)out[id]=item;
  }
  return out;
}
