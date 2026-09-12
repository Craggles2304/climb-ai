import type {KeyMoment} from './riot/keyMoments';

export type Role='TOP'|'JUNGLE'|'MID'|'ADC'|'SUPPORT';
export type Rank='Iron'|'Bronze'|'Silver'|'Gold'|'Platinum'|'Emerald'|'Diamond'|'Master+';
export type MatchResult='WIN'|'LOSS'|'UNKNOWN';
export interface RiotAccount{id:string;label:string;gameName:string;tagline:string;region:string;role:Role;rank:string;champions:string[];isPrimary?:boolean;puuid?:string;syncStatus:string}
export interface PlayerProfile{role:Role;rank:Rank;champions:string[];frustration:string;founder?:boolean}
export interface MatchMetrics{
  cs:number;csPerMin:number;deaths:number;goldPerMin?:number;damagePerMin?:number;damageShare?:number;killParticipation?:number;visionScore?:number;objectiveParticipation?:number;
  csAt10?:number;csAt15?:number;laneCsPerMin?:number;post15CsPerMin?:number;goldDiffAt15?:number;xpDiffAt15?:number;
  deathsPre10?:number;deaths10to20?:number;deathsPost20?:number;soloDeaths?:number;teamfightDeaths?:number;
  firstItemMinute?:number;secondItemMinute?:number;thirdItemMinute?:number;levelAt15?:number;wardsPlaced?:number;controlWards?:number;
}
export interface Match{ id:string; riotAccountId:string; champion:string; opponent?:string; role:Role; result:MatchResult; kills:number; deaths:number; assists:number; durationSeconds:number; rank:string; metrics:MatchMetrics; items?:string[]; summoners?:string[]; source:'demo'|'manual'|'screenshot'|'riot'|'live_tracker'; createdAt:string;
  moments?:KeyMoment[] }
export type IssueCategory='FARMING'|'POSITIONING'|'DEATHS'|'LANING'|'TRADING'|'WAVE_MANAGEMENT'|'TEMPO'|'OBJECTIVES'|'VISION'|'TEAMFIGHTING'|'TARGET_SELECTION'|'RECALL_TIMING'|'RESOURCE_COLLECTION'|'MAP_AWARENESS'|'CHAMPION_MASTERY'|'ITEMISATION'|'MATCHUPS'|'CONSISTENCY';
export interface Signal{category:IssueCategory;severity:number;confidence:number;facts:string[];inference:string;suggestion:string}
export interface Mission{ id:string; riotAccountId:string; category:IssueCategory; title:string; metric:string; target:number; unit:string; gamesRequired:number; gamesCompleted:number; successfulGames:number; rules:string[]; status:'DISCOVER'|'PRACTISE'|'REPEAT'|'MASTERED'; createdAt:string }
export interface AnalysisReport{matchId:string;performance:number;good:string[];primary:Signal;mission:Mission;summary:string}

export type ILPStatus='ACTIVE'|'EVIDENCE_BUILDING'|'MASTERED'|'PAUSED';
export interface ILPHistoryEntry{at:string;type:'PROGRESS'|'COACH_EDIT'|'PROMOTED'|'MASTERED'|'PAUSED';note:string}
export interface ILPTask{
  id:string;accountId:string;title:string;category:IssueCategory;why:string;gameRule:string;metric:string;target:string;progress:number;status:ILPStatus;source:'SYSTEM'|'COACH'|'USER';evidence:string[];
  priority?:number;successfulGames?:number;gamesObserved?:number;masteryRequired?:number;lastUpdatedReason?:string;history?:ILPHistoryEntry[];
}
export interface ChampionPlan{ champion:string; role:Role; rankBand:string; identity:string; lanePlan:string[]; farmPlan:string[]; teamfightPlan:string[]; sideLanePlan:string[]; powerSpikes:string[]; commonLeaks:string[]; rankFocus:string[]; build:{label:string;items:string[];boots:string;note:string;sourceLabel:string;sourceUrl?:string}; runes:{primary:string;secondary:string;note:string}; }
export interface LiveTelemetrySnapshot{accountId:string;gameTime:number;championName?:string;level?:number;currentGold?:number;cs?:number;kills?:number;deaths?:number;assists?:number;events?:{name:string;time:number}[];receivedAt:string}
