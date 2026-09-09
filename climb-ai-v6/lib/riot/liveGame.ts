import {Role} from '../types';

/**
 * Live game — what SPECTATOR-V5 can honestly tell us about a game in progress.
 *
 * The important limitation, stated up front: the spectator payload does NOT
 * include lane assignments. It gives champions, teams and summoner spells and
 * nothing else about role. So this deliberately does not claim to know who your
 * lane opponent is. The one inference it does make is Smite, which is a reliable
 * jungle tell, and it is labelled as an inference.
 *
 * It also does not give live state — your CS, your gold, your deaths right now.
 * That only exists in the local Live Client Data API on the player's own PC.
 * Everything here is "who is in this game and how long has it been running".
 */

/** Riot summoner spell id for Smite. */
export const SMITE_ID=11;

/** Queue ids we can name. Anything else is reported as "Custom or other queue". */
const QUEUES:Record<number,string>={
  400:'Normal Draft',420:'Ranked Solo/Duo',430:'Normal Blind',
  440:'Ranked Flex',450:'ARAM',700:'Clash',
};

export interface SpectatorParticipant{
  puuid:string;
  teamId:number;
  championId:number;
  spell1Id?:number;
  spell2Id?:number;
  riotId?:string;
  bot?:boolean;
}

export interface SpectatorGame{
  gameId:number;
  gameQueueConfigId?:number;
  /** Seconds since the game clock started. 0 while still loading. */
  gameLength:number;
  gameMode?:string;
  participants:SpectatorParticipant[];
}

export type GamePhase='LOADING'|'LANE'|'MID'|'LATE';

export interface LivePlayer{
  championId:number;
  championName:string;
  teamId:number;
  /** Inferred from Smite, not stated by Riot. */
  likelyJungler:boolean;
  riotId?:string;
}

export interface LiveGameRead{
  gameId:number;
  queue:string;
  /** True only for ranked solo/duo, the queue the coaching model is built on. */
  isRankedSolo:boolean;
  gameLengthSeconds:number;
  clock:string;
  phase:GamePhase;
  me:LivePlayer;
  allies:LivePlayer[];
  enemies:LivePlayer[];
  /** What the player should be thinking about right now, given the clock. */
  phaseNote:string;
}

/** Phase boundaries chosen to match the behaviours the plan actually scores. */
export function phaseFor(seconds:number):GamePhase{
  if(seconds<=0)return 'LOADING';
  if(seconds<900)return 'LANE';      // pre-15, lane economy
  if(seconds<1200)return 'MID';      // 15-20, the window the post-15 rule targets
  return 'LATE';                     // post-20, where deaths cost objectives
}

export const clockOf=(seconds:number)=>{
  const s=Math.max(0,Math.floor(seconds));
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
};

const PHASE_NOTES:Record<GamePhase,string>={
  LOADING:'Loading screen. Read your one rule now — you will not have time later.',
  LANE:'Lane phase. Your rule matters most from the first recall after 15:00.',
  MID:'This is the window. Every recall from here is a decision your plan is watching.',
  LATE:'Post-20. Deaths here cost objectives, not just gold.',
};

export interface MapLiveOptions{
  /** championId to name, from Data Dragon. Missing ids fall back to the number. */
  championNames?:ReadonlyMap<number,string>;
}

export function readLiveGame(
  game:SpectatorGame,puuid:string,opts:MapLiveOptions={},
):LiveGameRead{
  const me=game.participants.find(p=>p.puuid===puuid);
  if(!me)throw new Error('You are not a participant in that game.');

  const name=(id:number)=>opts.championNames?.get(id)??`Champion ${id}`;
  const toPlayer=(p:SpectatorParticipant):LivePlayer=>({
    championId:p.championId,
    championName:name(p.championId),
    teamId:p.teamId,
    likelyJungler:p.spell1Id===SMITE_ID||p.spell2Id===SMITE_ID,
    riotId:p.riotId,
  });

  const seconds=Math.max(0,game.gameLength||0);
  const phase=phaseFor(seconds);
  const queueId=game.gameQueueConfigId??0;

  return {
    gameId:game.gameId,
    queue:QUEUES[queueId]??'Custom or other queue',
    isRankedSolo:queueId===420,
    gameLengthSeconds:seconds,
    clock:clockOf(seconds),
    phase,
    me:toPlayer(me),
    allies:game.participants.filter(p=>p.teamId===me.teamId&&p.puuid!==puuid).map(toPlayer),
    enemies:game.participants.filter(p=>p.teamId!==me.teamId).map(toPlayer),
    phaseNote:PHASE_NOTES[phase],
  };
}

/** Builds the championId to name map from a Data Dragon champion.json payload. */
export function championNameMap(ddragon:unknown):Map<number,string>{
  const out=new Map<number,string>();
  const data=(ddragon as {data?:Record<string,{key?:string;name?:string}>})?.data;
  if(!data)return out;
  for(const entry of Object.values(data)){
    const id=Number(entry.key);
    if(Number.isFinite(id)&&entry.name)out.set(id,entry.name);
  }
  return out;
}

/** Roles we can claim from spectator data. Everything else is unknown. */
export const inferredRole=(p:LivePlayer):Role|null=>p.likelyJungler?'JUNGLE':null;
