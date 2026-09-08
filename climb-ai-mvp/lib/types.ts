export type Role='TOP'|'JUNGLE'|'MID'|'ADC'|'SUPPORT';
export type Rank='Iron'|'Bronze'|'Silver'|'Gold'|'Platinum'|'Emerald'|'Diamond'|'Master+';
export type MatchResult='WIN'|'LOSS';
export interface PlayerProfile{gameName:string;tagline:string;region:string;role:Role;rank:Rank;champions:string[];frustration:string;founder?:boolean}
export interface MatchMetrics{cs:number;csPerMin:number;deaths:number;goldPerMin?:number;damagePerMin?:number;killParticipation?:number;visionScore?:number;farmAfter15?:number;objectiveParticipation?:number}
export interface Match{ id:string; champion:string; role:Role; result:MatchResult; kills:number; deaths:number; assists:number; durationSeconds:number; rank:string; metrics:MatchMetrics; source:'demo'|'manual'|'screenshot'|'riot'; createdAt:string }
export type IssueCategory='FARMING'|'POSITIONING'|'DEATHS'|'LANING'|'TRADING'|'WAVE_MANAGEMENT'|'TEMPO'|'OBJECTIVES'|'VISION'|'TEAMFIGHTING'|'TARGET_SELECTION'|'RECALL_TIMING'|'RESOURCE_COLLECTION'|'MAP_AWARENESS'|'CHAMPION_MASTERY'|'ITEMISATION'|'MATCHUPS'|'CONSISTENCY';
export interface Signal{category:IssueCategory;severity:number;confidence:number;facts:string[];inference:string;suggestion:string}
export interface Mission{ id:string; category:IssueCategory; title:string; metric:string; target:number; unit:string; gamesRequired:number; gamesCompleted:number; successfulGames:number; rules:string[]; status:'DISCOVER'|'PRACTISE'|'REPEAT'|'MASTERED'; createdAt:string }
export interface AnalysisReport{matchId:string;performance:number;good:string[];primary:Signal;mission:Mission;summary:string}
