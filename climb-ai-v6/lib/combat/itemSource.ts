import 'server-only';
import type {DataDragonItemFull} from '@/lib/champions/source';
import {dedupeByName} from '@/lib/riot/items';

const CACHE_MS=12*60*60_000;
let cache:{patch:string;expires:number;items:Record<string,DataDragonItemFull>}|null=null;

/** All purchasable Summoner's Rift items used by Matchup Lab, including components and boots. */
export async function matchupItemCatalogue(patch:string):Promise<Record<string,DataDragonItemFull>>{
  if(cache&&cache.patch===patch&&cache.expires>Date.now())return cache.items;
  const url=`https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/item.json`;
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok)throw new Error(`Data Dragon item request failed (${res.status}).`);
  const payload=await res.json() as {data:Record<string,DataDragonItemFull>};
  const filtered:Record<string,DataDragonItemFull>={};
  for(const [id,item] of Object.entries(payload.data)){
    if(item.maps?.['11']===false)continue;
    const tags=item.tags??[];
    if(tags.includes('Consumable')||tags.includes('Trinket'))continue;
    if((item.gold?.total??0)<=0)continue;
    filtered[id]=item;
  }
  const items=dedupeByName(filtered);
  cache={patch,expires:Date.now()+CACHE_MS,items};
  return items;
}
