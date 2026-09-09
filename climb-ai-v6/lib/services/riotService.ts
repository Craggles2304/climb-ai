import 'server-only';
import {Match} from '../types';
import {riotFetch,riotEnabled,RiotApiError} from '../riot/client';
import {platformHost,regionalHost} from '../riot/regions';
import {mapRiotMatch,MapMatchResult} from '../riot/mapMatch';
import {RiotAccountDto,RiotMatchDto,RiotTimelineDto,RiotLeagueEntryDto} from '../riot/riotTypes';

export interface RankInfo{tier:string;division:string;leaguePoints:number;label:string}

export interface MatchContext{
  /** Internal riot_accounts row id the resulting Match belongs to. */
  riotAccountId:string;
  puuid:string;
  rank?:string;
}

export interface RecentMatchOptions{
  start?:number;
  count?:number;
  /** 420 = ranked solo/duo. Omit for all queues. */
  queue?:number;
}

export interface RiotService{
  getAccountByRiotId(gameName:string,tagline:string,region:string):Promise<RiotAccountDto>;
  getSummonerRank(puuid:string,region:string):Promise<RankInfo|null>;
  getRecentMatches(puuid:string,region:string,opts?:RecentMatchOptions):Promise<string[]>;
  getMatchDetails(matchId:string,region:string,ctx:MatchContext):Promise<MapMatchResult>;
  /** Item IDs that count as a completed item, for item-timing metrics. */
  getCompletedItemIds():Promise<ReadonlySet<number>>;
  getChampionData():Promise<unknown>;
}

/** Active whenever RIOT_API_ENABLED is not 'true' or no key is present. */
export class DisabledRiotService implements RiotService{
  private fail():never{
    throw new Error('Automatic Riot sync is not enabled yet. Upload a match instead.');
  }
  async getAccountByRiotId(){return this.fail()}
  async getSummonerRank(){return this.fail()}
  async getRecentMatches(){return this.fail()}
  async getMatchDetails(){return this.fail()}
  async getCompletedItemIds(){return this.fail()}
  async getChampionData(){return this.fail()}
}

export class LiveRiotService implements RiotService{
  async getAccountByRiotId(gameName:string,tagline:string,region:string):Promise<RiotAccountDto>{
    const name=encodeURIComponent(gameName.trim());
    const tag=encodeURIComponent(tagline.replace(/^#/,'').trim());
    return riotFetch<RiotAccountDto>(
      `${regionalHost(region)}/riot/account/v1/accounts/by-riot-id/${name}/${tag}`,
      {ttl:'short'},
    );
  }

  async getSummonerRank(puuid:string,region:string):Promise<RankInfo|null>{
    const summoner=await riotFetch<{id:string}>(
      `${platformHost(region)}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`,
      {ttl:'short'},
    );
    const entries=await riotFetch<RiotLeagueEntryDto[]>(
      `${platformHost(region)}/lol/league/v4/entries/by-summoner/${encodeURIComponent(summoner.id)}`,
      {ttl:'short'},
    );
    const solo=entries.find(e=>e.queueType==='RANKED_SOLO_5x5');
    if(!solo?.tier)return null;
    const tier=titleCase(solo.tier);
    const division=solo.rank||'';
    const lp=solo.leaguePoints??0;
    return {tier,division,leaguePoints:lp,label:`${tier} ${division} · ${lp} LP`.replace(/\s+·/,' ·')};
  }

  async getRecentMatches(puuid:string,region:string,opts:RecentMatchOptions={}):Promise<string[]>{
    const params=new URLSearchParams({
      start:String(opts.start??0),
      count:String(Math.min(100,opts.count??20)),
    });
    if(opts.queue)params.set('queue',String(opts.queue));
    return riotFetch<string[]>(
      `${regionalHost(region)}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?${params}`,
      {ttl:'short'},
    );
  }

  async getMatchDetails(matchId:string,region:string,ctx:MatchContext):Promise<MapMatchResult>{
    const host=regionalHost(region);
    const match=await riotFetch<RiotMatchDto>(`${host}/lol/match/v5/matches/${matchId}`,{ttl:'immutable'});

    // A missing timeline degrades several ILP metrics but must not fail the sync,
    // so it is fetched defensively and the mapper reports what it could not derive.
    let timeline:RiotTimelineDto|null=null;
    try{
      timeline=await riotFetch<RiotTimelineDto>(`${host}/lol/match/v5/matches/${matchId}/timeline`,{ttl:'immutable'});
    }catch(err){
      if(!(err instanceof RiotApiError))throw err;
    }

    const completedItemIds=await this.getCompletedItemIds().catch(()=>undefined);
    return mapRiotMatch(match,timeline,ctx.puuid,{
      riotAccountId:ctx.riotAccountId,
      rank:ctx.rank,
      completedItemIds,
    });
  }

  /**
   * Data Dragon is a public static CDN — no API key, no Riot rate limit.
   * "Completed" is a heuristic: an item that builds into nothing further, has
   * real build depth, costs like a legendary and exists on Summoner's Rift.
   * Item timings are only reported when this list is available.
   */
  async getCompletedItemIds():Promise<ReadonlySet<number>>{
    const data=await this.getItemData();
    const ids=new Set<number>();
    for(const [id,item] of Object.entries(data.data)){
      const buildsIntoNothing=!item.into||item.into.length===0;
      const deepEnough=(item.depth??1)>=3;
      const legendaryCost=(item.gold?.total??0)>=2000;
      const onRift=item.maps?.['11']!==false;
      const consumable=(item.tags||[]).some(t=>t==='Consumable'||t==='Trinket');
      if(buildsIntoNothing&&deepEnough&&legendaryCost&&onRift&&!consumable)ids.add(Number(id));
    }
    return ids;
  }

  async getChampionData():Promise<unknown>{
    const version=await latestDataDragonVersion();
    return ddragonFetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
  }

  private async getItemData():Promise<DataDragonItems>{
    const version=await latestDataDragonVersion();
    return ddragonFetch<DataDragonItems>(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`);
  }
}

interface DataDragonItems{
  data:Record<string,{
    into?:string[];
    depth?:number;
    gold?:{total?:number};
    maps?:Record<string,boolean>;
    tags?:string[];
  }>;
}

const ddragonCache=new Map<string,{expires:number;value:unknown}>();

async function ddragonFetch<T=unknown>(url:string):Promise<T>{
  const hit=ddragonCache.get(url);
  if(hit&&hit.expires>Date.now())return hit.value as T;
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok)throw new Error(`Data Dragon request failed (${res.status}).`);
  const value=await res.json() as T;
  ddragonCache.set(url,{expires:Date.now()+12*60*60_000,value});
  return value;
}

async function latestDataDragonVersion():Promise<string>{
  const versions=await ddragonFetch<string[]>('https://ddragon.leagueoflegends.com/api/versions.json');
  if(!versions.length)throw new Error('Data Dragon returned no versions.');
  return versions[0];
}

const titleCase=(s:string)=>s.charAt(0)+s.slice(1).toLowerCase();

/**
 * Swapped by the RIOT_API_ENABLED feature flag. Every consumer codes against the
 * interface, so turning the flag on requires no UI change — which is the whole
 * point of the mock-first architecture.
 */
export const riotService:RiotService=riotEnabled()?new LiveRiotService():new DisabledRiotService();

export type {Match};
