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
