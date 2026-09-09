import 'server-only';
import {ChampionDetail,ChampionListEntry} from './ddragon';

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
  return data.data;
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

export async function championDetail(id:string,patch?:string):Promise<ChampionDetail>{
  const v=patch??await latestPatch();
  const data=await ddragon<{data:Record<string,ChampionDetail>}>(
    `${base(v)}/champion/${encodeURIComponent(id)}.json`);
  const champion=data.data[id];
  if(!champion)throw new Error(`Data Dragon has no champion "${id}".`);
  return champion;
}
