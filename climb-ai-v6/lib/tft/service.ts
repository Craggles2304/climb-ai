import 'server-only';
import {riotFetch} from '@/lib/riot/client';
import {platformHost,regionalHost} from '@/lib/riot/regions';
import type {TftMatch,TftTrait,TftUnit} from './types';

interface RawTftParticipant{
  puuid:string;
  placement:number;
  level?:number;
  last_round?:number;
  players_eliminated?:number;
  total_damage_to_players?:number;
  gold_left?:number;
  augments?:string[];
  traits?:Array<Record<string,unknown>>;
  units?:Array<Record<string,unknown>>;
  companion?:Record<string,unknown>;
}

interface RawTftMatch{
  metadata:{match_id:string;participants:string[]};
  info:{
    game_datetime:number;
    game_length:number;
    game_version:string;
    queue_id?:number;
    tft_set_number?:number;
    tft_set_core_name?:string;
    participants:RawTftParticipant[];
  };
}

export interface TftRankInfo{tier:string;division:string;leaguePoints:number;label:string}

const cleanTrait=(raw:Record<string,unknown>):TftTrait=>({
  name:String(raw.name||''),
  num_units:Number(raw.num_units||0),
  style:raw.style==null?undefined:Number(raw.style),
  tier_current:raw.tier_current==null?undefined:Number(raw.tier_current),
  tier_total:raw.tier_total==null?undefined:Number(raw.tier_total),
});

const cleanUnit=(raw:Record<string,unknown>):TftUnit=>({
  character_id:String(raw.character_id||''),
  name:raw.name?String(raw.name):undefined,
  rarity:raw.rarity==null?undefined:Number(raw.rarity),
  tier:raw.tier==null?undefined:Number(raw.tier),
  itemNames:Array.isArray(raw.itemNames)?raw.itemNames.map(String):Array.isArray(raw.items)?raw.items.map(String):[],
});

function signature(units:TftUnit[]){
  return units
    .filter(u=>u.character_id)
    .sort((a,b)=>(b.tier||0)-(a.tier||0))
    .slice(0,4)
    .map(u=>u.character_id.replace(/^TFT\d+_/,'').replace(/^TFT_/,''))
    .join(' · ')||'UNRESOLVED COMP';
}

export async function getRecentTftMatchIds(puuid:string,region:string,count=10):Promise<string[]>{
  const params=new URLSearchParams({start:'0',count:String(Math.min(20,Math.max(1,count)))});
  return riotFetch<string[]>(`${regionalHost(region)}/tft/match/v1/matches/by-puuid/${encodeURIComponent(puuid)}/ids?${params}`,{ttl:'short'});
}

export async function getTftMatch(matchId:string,region:string,puuid:string,riotAccountId:string):Promise<TftMatch>{
  const raw=await riotFetch<RawTftMatch>(`${regionalHost(region)}/tft/match/v1/matches/${encodeURIComponent(matchId)}`,{ttl:'immutable'});
  const participant=raw.info.participants.find(p=>p.puuid===puuid);
  if(!participant)throw new Error('Riot returned a TFT match without the linked player.');
  const units=(participant.units||[]).map(cleanUnit);
  return{
    id:raw.metadata.match_id,
    riotAccountId,
    queueId:raw.info.queue_id,
    playedAt:new Date(raw.info.game_datetime).toISOString(),
    gameLengthSeconds:Math.max(1,Math.round(raw.info.game_length||0)),
    gameVersion:raw.info.game_version||'',
    setNumber:raw.info.tft_set_number,
    setCoreName:raw.info.tft_set_core_name,
    placement:Number(participant.placement),
    level:participant.level,
    lastRound:participant.last_round,
    playersEliminated:participant.players_eliminated,
    totalDamageToPlayers:participant.total_damage_to_players,
    goldLeft:participant.gold_left,
    augments:participant.augments||[],
    traits:(participant.traits||[]).map(cleanTrait),
    units,
    companion:participant.companion,
    compSignature:signature(units),
  };
}

export async function getTftRank(puuid:string,region:string):Promise<TftRankInfo|null>{
  // Riot's TFT league API now exposes a PUUID lookup. Keep this non-fatal so a
  // rank endpoint change can never block match-history coaching.
  try{
    const entries=await riotFetch<Array<{queueType?:string;tier?:string;rank?:string;leaguePoints?:number}>>(
      `${platformHost(region)}/tft/league/v1/by-puuid/${encodeURIComponent(puuid)}`,
      {ttl:'short',maxRetries:1},
    );
    const ranked=entries.find(x=>String(x.queueType||'').includes('RANKED_TFT'))||entries[0];
    if(!ranked?.tier)return null;
    const tier=ranked.tier.charAt(0)+ranked.tier.slice(1).toLowerCase();
    const division=ranked.rank||'';
    const leaguePoints=Number(ranked.leaguePoints||0);
    return{tier,division,leaguePoints,label:`${tier} ${division} · ${leaguePoints} LP`.replace(/\s+·/,' ·')};
  }catch{return null}
}
