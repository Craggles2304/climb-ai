import 'server-only';
import {ChampionDetail,ChampionListEntry} from './ddragon';
import {isCompletedItem,dedupeByName} from '../riot/items';

/**
 * Data Dragon access for the champion features.
 *
 * Deliberately separate from riotService: Data Dragon is a public static CDN
 * with no API key and no rate limit, so these features must keep working when
 * RIOT_API_ENABLED is off and while the production key application is pending.
 * Gating them behind the Riot flag would switch off the one part of the app
 * that never needed the key.
 */

/** Static per patch, so it is cached hard and shared across requests. */
const CACHE_MS=12*60*60_000;
const cache=new Map<string,{expires:number;value:unknown}>();

async function ddragon<T>(url:string):Promise<T>{
  const hit=cache.get(url);
  if(hit&&hit.expires>Date.now())return hit.value as T;
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok)throw new Error(`Data Dragon request failed (${res.status}).`);
  const value=await res.json() as T;
  cache.set(url,{expires:Date.now()+CACHE_MS,value});
  return value;
}

export async function latestPatch():Promise<string>{
  const versions=await ddragon<string[]>('https://ddragon.leagueoflegends.com/api/versions.json');
  if(!versions.length)throw new Error('Data Dragon returned no versions.');
  return versions[0];
}

const base=(patch:string)=>`https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US`;

export async function championRoster(patch?:string):Promise<Record<string,ChampionListEntry>>{
  const v=patch??await latestPatch();
  const data=await ddragon<{data:Record<string,ChampionListEntry>}>(`${base(v)}/champion.json`);
  return withAdGrowth(data.data);
}

/**
 * Champion ids in Data Dragon are PascalCase with punctuation stripped, which
 * is not what a player types. "kog'maw", "Kog'Maw" and "KogMaw" all resolve.
 */
export async function resolveChampionId(input:string,patch?:string):Promise<string|null>{
  const roster=await championRoster(patch);
  const wanted=normalise(input);
  if(!wanted)return null;
  for(const entry of Object.values(roster))
    if(normalise(entry.id)===wanted||normalise(entry.name)===wanted)return entry.id;
  return null;
}

const normalise=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');

/**
 * Completed items only. The full catalogue is mostly components, and ranking
 * a B.F. Sword against Infinity Edge would be noise — the completed-item rule
 * already exists for match item timings, so it is reused rather than rewritten.
 */
export async function itemCatalogue(patch?:string):Promise<Record<string,DataDragonItemFull>>{
  const v=patch??await latestPatch();
  const data=await ddragon<{data:Record<string,DataDragonItemFull>}>(`${base(v)}/item.json`);
  const out:Record<string,DataDragonItemFull>={};
  for(const [id,item] of Object.entries(data.data))
    if(isCompletedItem(item))out[id]=item;
  // Mode variants survive the Rift filter and would list the same item twice.
  return dedupeByName(out);
}

export interface DataDragonItemFull{
  name:string;
  gold?:{total?:number};
  stats?:Record<string,number>;
  into?:string[];
  from?:string[];
  maps?:Record<string,boolean>;
  tags?:string[];
}

export async function championDetail(id:string,patch?:string):Promise<ChampionDetail>{
  const v=patch??await latestPatch();
  const data=await ddragon<{data:Record<string,ChampionDetail>}>(
    `${base(v)}/champion/${encodeURIComponent(id)}.json`);
  const champion=data.data[id];
  if(!champion)throw new Error(`Data Dragon has no champion "${id}".`);
  const patched=await withAdGrowth({[id]:champion});
  return patched[id];
}

/* ------------------------------------------------- attack damage growth -- */

/**
 * Data Dragon stopped publishing `attackdamageperlevel`.
 *
 * It was populated for every champion up to patch 16.4.1 and has been 0 for all
 * 173 of them from 16.5.1 onward, while every other per-level stat (health,
 * armour, magic resist, attack speed, mana) is still populated normally. Base
 * attack damage is unchanged across the boundary — Darius is 64 either side.
 *
 * Champions plainly do still gain attack damage per level in game, so taken at
 * face value the current file says a level-18 champion has the same attack
 * damage as a level-1 one. That made every DPS figure in this codebase badly
 * understated at high levels.
 *
 * So the growth figures are read from the last patch that published them and
 * merged onto current stats. That IS a cross-patch inference rather than a
 * reading, so the patch it came from travels with the data and is shown in the
 * UI. If Riot starts publishing the field again this silently stops applying.
 */
const AD_GROWTH_FALLBACK_SEARCH=40;

let adGrowthCache:{map:Record<string,number>;sourcePatch:string}|null|undefined;

async function adGrowthFallback():Promise<{map:Record<string,number>;sourcePatch:string}|null>{
  if(adGrowthCache!==undefined)return adGrowthCache;
  const versions=await ddragon<string[]>('https://ddragon.leagueoflegends.com/api/versions.json');
  for(const version of versions.slice(0,AD_GROWTH_FALLBACK_SEARCH)){
    try{
      const data=await ddragon<{data:Record<string,ChampionListEntry>}>(`${base(version)}/champion.json`);
      const entries=Object.values(data.data);
      const withGrowth=entries.filter(c=>(c.stats?.attackdamageperlevel??0)>0);
      if(withGrowth.length>entries.length*0.8){
        const map:Record<string,number>={};
        for(const c of entries)map[c.id]=c.stats.attackdamageperlevel??0;
        adGrowthCache={map,sourcePatch:version};
        return adGrowthCache;
      }
    }catch{
      // An unavailable historical patch is not fatal; keep walking back.
    }
  }
  adGrowthCache=null;
  return null;
}

/** Whether the current patch publishes AD growth at all. */
const missingAdGrowth=(entries:ChampionListEntry[])=>
  entries.length>0&&entries.every(c=>(c.stats?.attackdamageperlevel??0)===0);

/**
 * Where the attack-damage growth in the returned stats came from. Null when the
 * current patch published it itself and no fallback was needed.
 */
export async function adGrowthSourcePatch():Promise<string|null>{
  // Populated as a side effect of the first merge, so a caller that has already
  // loaded a champion gets the answer without another fetch.
  await championRoster();
  return adGrowthApplied;
}

/**
 * Fills in attack-damage growth when the current patch omits it. A no-op the
 * moment Riot publishes the field again.
 */
async function withAdGrowth<T extends ChampionListEntry>(
  champions:Record<string,T>,
):Promise<Record<string,T>>{
  const entries=Object.values(champions);
  if(!missingAdGrowth(entries))return champions;

  const fallback=await adGrowthFallback();
  if(!fallback)return champions;

  adGrowthApplied=fallback.sourcePatch;
  const out:Record<string,T>={};
  for(const [id,champion] of Object.entries(champions)){
    const growth=fallback.map[champion.id];
    out[id]=growth
      ?{...champion,stats:{...champion.stats,attackdamageperlevel:growth}}
      :champion;
  }
  return out;
}

let adGrowthApplied:string|null=null;
