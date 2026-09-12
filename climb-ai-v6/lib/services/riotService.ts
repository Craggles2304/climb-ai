import 'server-only';
import {Match} from '../types';
import {riotFetch,riotEnabled,RiotApiError} from '../riot/client';
import {platformHost,regionalHost} from '../riot/regions';
import {mapRiotMatch,MapMatchResult} from '../riot/mapMatch';
import {SpectatorGame,LiveGameRead,readLiveGame,championNameMap} from '../riot/liveGame';
import {completedItemIdsFrom,DataDragonItem} from '../riot/items';
import {keyMoments} from '../riot/keyMoments';
import {buildRiotProAnalysis,type ProMatchAnalysis} from '../riot/proAnalysis';
import {RiotAccountDto,RiotMatchDto,RiotTimelineDto,RiotLeagueEntryDto} from '../riot/riotTypes';

export interface RankInfo{tier:string;division:string;leaguePoints:number;label:string}
export interface MatchContext{riotAccountId:string;puuid:string;rank?:string}
export interface RecentMatchOptions{start?:number;count?:number;queue?:number}
export interface RiotMatchDetails extends MapMatchResult{proAnalysis?:ProMatchAnalysis}

export interface RiotService{
  getAccountByRiotId(gameName:string,tagline:string,region:string):Promise<RiotAccountDto>;
  getSummonerRank(puuid:string,region:string):Promise<RankInfo|null>;
  getRecentMatches(puuid:string,region:string,opts?:RecentMatchOptions):Promise<string[]>;
  getMatchDetails(matchId:string,region:string,ctx:MatchContext):Promise<RiotMatchDetails>;
  getActiveGame(puuid:string,region:string):Promise<LiveGameRead|null>;
  getCompletedItemIds():Promise<ReadonlySet<number>>;
  getChampionData():Promise<unknown>;
}

export class DisabledRiotService implements RiotService{
  private fail():never{throw new Error('Automatic Riot sync is not enabled yet. Upload a match instead.')}
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
    return riotFetch<RiotAccountDto>(`${regionalHost(region)}/riot/account/v1/accounts/by-riot-id/${name}/${tag}`,{ttl:'short'});
  }

  async getSummonerRank(puuid:string,region:string):Promise<RankInfo|null>{
    const summoner=await riotFetch<{id:string}>(`${platformHost(region)}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`,{ttl:'short'});
    const entries=await riotFetch<RiotLeagueEntryDto[]>(`${platformHost(region)}/lol/league/v4/entries/by-summoner/${encodeURIComponent(summoner.id)}`,{ttl:'short'});
    const solo=entries.find(e=>e.queueType==='RANKED_SOLO_5x5');
    if(!solo?.tier)return null;
    const tier=titleCase(solo.tier),division=solo.rank||'',lp=solo.leaguePoints??0;
    return{tier,division,leaguePoints:lp,label:`${tier} ${division} · ${lp} LP`.replace(/\s+·/,' ·')};
  }

  async getRecentMatches(puuid:string,region:string,opts:RecentMatchOptions={}):Promise<string[]>{
    const params=new URLSearchParams({start:String(opts.start??0),count:String(Math.min(100,opts.count??20))});
    if(opts.queue)params.set('queue',String(opts.queue));
    return riotFetch<string[]>(`${regionalHost(region)}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?${params}`,{ttl:'short'});
  }

  async getMatchDetails(matchId:string,region:string,ctx:MatchContext):Promise<RiotMatchDetails>{
    const host=regionalHost(region);
    const match=await riotFetch<RiotMatchDto>(`${host}/lol/match/v5/matches/${matchId}`,{ttl:'immutable'});
    let timeline:RiotTimelineDto|null=null;
    try{timeline=await riotFetch<RiotTimelineDto>(`${host}/lol/match/v5/matches/${matchId}/timeline`,{ttl:'immutable'})}
    catch(err){if(!(err instanceof RiotApiError))throw err}
    const completedItemIds=await this.getCompletedItemIds().catch(()=>undefined);
    const mapped:RiotMatchDetails=mapRiotMatch(match,timeline,ctx.puuid,{riotAccountId:ctx.riotAccountId,rank:ctx.rank,completedItemIds});
    if(timeline)mapped.moments=keyMoments(match,timeline,ctx.puuid);
    mapped.proAnalysis=buildRiotProAnalysis(match,timeline,ctx.puuid,{completedItemIds})??undefined;
    return mapped;
  }

  async getActiveGame(puuid:string,region:string):Promise<LiveGameRead|null>{
    try{
      const game=await riotFetch<SpectatorGame>(`${platformHost(region)}/lol/spectator/v5/active-games/by-puuid/${encodeURIComponent(puuid)}`,{ttl:'short',maxRetries:1});
      const championNames=await this.getChampionData().then(championNameMap).catch(()=>undefined);
      return readLiveGame(game,puuid,{championNames});
    }catch(err){if(err instanceof RiotApiError&&err.status===404)return null;throw err}
  }

  async getCompletedItemIds():Promise<ReadonlySet<number>>{
    const data=await this.getItemData();
    return completedItemIdsFrom(data.data);
  }
  async getChampionData():Promise<unknown>{const version=await latestDataDragonVersion();return ddragonFetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)}
  private async getItemData():Promise<DataDragonItems>{const version=await latestDataDragonVersion();return ddragonFetch<DataDragonItems>(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`)}
}

interface DataDragonItems{data:Record<string,DataDragonItem>}
const ddragonCache=new Map<string,{expires:number;value:unknown}>();
async function ddragonFetch<T=unknown>(url:string):Promise<T>{const hit=ddragonCache.get(url);if(hit&&hit.expires>Date.now())return hit.value as T;const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error(`Data Dragon request failed (${res.status}).`);const value=await res.json() as T;ddragonCache.set(url,{expires:Date.now()+12*60*60_000,value});return value}
async function latestDataDragonVersion():Promise<string>{const versions=await ddragonFetch<string[]>('https://ddragon.leagueoflegends.com/api/versions.json');if(!versions.length)throw new Error('Data Dragon returned no versions.');return versions[0]}
const titleCase=(s:string)=>s.charAt(0)+s.slice(1).toLowerCase();
export const riotService:RiotService=riotEnabled()?new LiveRiotService():new DisabledRiotService();
export type {Match};
