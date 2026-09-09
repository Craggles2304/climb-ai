/**
 * Minimal structural types for the Riot API responses we actually read.
 * Deliberately not exhaustive — every field here is one this codebase consumes,
 * and everything optional is treated as "may be absent" rather than assumed.
 */

export interface RiotAccountDto{puuid:string;gameName:string;tagLine:string}

export interface RiotLeagueEntryDto{
  queueType:string;
  tier?:string;
  rank?:string;
  leaguePoints?:number;
}

/** Subset of MATCH-V5 participant. */
export interface RiotParticipant{
  puuid:string;
  participantId:number;
  championName:string;
  teamId:number;
  teamPosition?:string;
  individualPosition?:string;
  win:boolean;
  kills:number;
  deaths:number;
  assists:number;
  totalMinionsKilled?:number;
  neutralMinionsKilled?:number;
  goldEarned?:number;
  totalDamageDealtToChampions?:number;
  visionScore?:number;
  wardsPlaced?:number;
  visionWardsBoughtInGame?:number;
  champLevel?:number;
  item0?:number;item1?:number;item2?:number;item3?:number;item4?:number;item5?:number;item6?:number;
  summoner1Id?:number;summoner2Id?:number;
  challenges?:{
    killParticipation?:number;
    teamDamagePercentage?:number;
    [k:string]:unknown;
  };
}

export interface RiotMatchDto{
  metadata:{matchId:string;participants:string[]};
  info:{
    gameCreation?:number;
    gameStartTimestamp?:number;
    gameEndTimestamp?:number;
    /** Seconds when gameEndTimestamp is present, milliseconds on older records. */
    gameDuration:number;
    gameMode?:string;
    queueId?:number;
    participants:RiotParticipant[];
    teams?:{teamId:number;win:boolean;objectives?:Record<string,{first:boolean;kills:number}>}[];
  };
}

export interface RiotParticipantFrame{
  minionsKilled?:number;
  jungleMinionsKilled?:number;
  totalGold?:number;
  currentGold?:number;
  xp?:number;
  level?:number;
}

export interface RiotTimelineEvent{
  type:string;
  timestamp:number;
  participantId?:number;
  victimId?:number;
  killerId?:number;
  itemId?:number;
  assistingParticipantIds?:number[];
  monsterType?:string;
  monsterSubType?:string;
  killerTeamId?:number;
  laneType?:string;
  towerType?:string;
  buildingType?:string;
  teamId?:number;
}

export interface RiotTimelineFrame{
  timestamp:number;
  participantFrames:Record<string,RiotParticipantFrame>;
  events?:RiotTimelineEvent[];
}

export interface RiotTimelineDto{
  metadata:{matchId:string;participants:string[]};
  info:{
    frameInterval?:number;
    frames:RiotTimelineFrame[];
    participants?:{participantId:number;puuid:string}[];
  };
}
