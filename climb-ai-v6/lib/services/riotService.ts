import 'server-only';
import {Match} from '../types';
import {riotFetch,riotEnabled,RiotApiError} from '../riot/client';
import {platformHost,regionalHost} from '../riot/regions';
import {mapRiotMatch,MapMatchResult} from '../riot/mapMatch';
import {SpectatorGame,LiveGameRead,readLiveGame,championNameMap} from '../riot/liveGame';
import {completedItemIdsFrom,DataDragonItem} from '../riot/items';
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
  /**
   * The game this player is in right now, or null if they are not in one.
   * Not being in a game is the normal case, never an error.
   */
  getActiveGame(puuid:string,region:string):Promise<LiveGameRead|null>;
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
  async getActiveGame(){return this.fail()}
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

  async getActiveGame(puuid:string,region:string):Promise<LiveGameRead|null>{
    try{
      // SPECTATOR-V5 describes a game in progress, so it is only briefly cacheable.
      const game=await riotFetch<SpectatorGame>(
        `${platformHost(region)}/lol/spectator/v5/active-games/by-puuid/${encodeURIComponent(puuid)}`,
        {ttl:'short',maxRetries:1},
      );
      const championNames=await this.getChampionData()
        .then(championNameMap)
        .catch(()=>undefined);
      return readLiveGame(game,puuid,{championNames});
    }catch(err){
      // 404 means "not currently in a game". That is the common case for any
      // player at any moment, and it must never surface as a failure.
      if(err instanceof RiotApiError&&err.status===404)return null;
      throw err;
    }
  }

  /**
   * Data Dragon is a public static CDN — no API key, no Riot rate limit.
   *
   * "Completed" means: builds into nothing further, is itself built from
   * components, costs like a legendary, and exists on Summoner's Rift.
   *
   * This previously required `depth >= 3`, which silently excluded Infinity
   * Edge and Rabadon's Deathcap — both depth 2 and both core items. Against 20
   * real ranked games that lost the second-item timing in 6 of them and the
   * third in 12. Build depth is not a reliable proxy for "finished"; having
   * components and building into nothing is.
   */
  async getCompletedItemIds():Promise<ReadonlySet<number>>{
    const data=await this.getItemData();
    // The rule itself lives in lib/riot/items.ts so it can be tested against
    // real item shapes. It was wrong once and cost most of our item timings.
    return completedItemIdsFrom(data.data);
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

interface DataDragonItems{data:Record<string,DataDragonItem>}

/** Data Dragon is static per patch, so it is cached hard and shared. */
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
