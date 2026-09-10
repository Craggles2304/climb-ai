import 'server-only';
import {binUrlFor,normaliseChampionSpells,type NormalisedChampionSpells} from './importSpells';

/**
 * Server-side access to the game files, cached per champion per patch.
 *
 * Isolated here so the engine stays pure and testable: everything in lib/combat
 * other than this file works on data it is handed. This is also the only place
 * that knows the data comes from an unofficial mirror.
 */

const CACHE_MS=12*60*60_000;
const cache=new Map<string,{expires:number;value:NormalisedChampionSpells|null}>();

const RETRIES=3;

export async function championSpells(
  championId:string,patch='latest',
):Promise<NormalisedChampionSpells|null>{
  const key=`${patch}:${championId}`;
  const hit=cache.get(key);
  if(hit&&hit.expires>Date.now())return hit.value;

  const url=binUrlFor(championId,patch);
  let value:NormalisedChampionSpells|null=null;

  for(let attempt=0;attempt<RETRIES;attempt++){
    try{
      const res=await fetch(url,{cache:'no-store'});
      if(res.status===404)break;                 // champion genuinely absent
      if(res.ok){
        value=normaliseChampionSpells(championId,await res.json(),patch);
        break;
      }
    }catch{
      // Network flake. Retry, then cache the miss so one outage does not
      // hammer the mirror on every request.
    }
    await new Promise(r=>setTimeout(r,300*(attempt+1)));
  }

  cache.set(key,{expires:Date.now()+CACHE_MS,value});
  return value;
}
