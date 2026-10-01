import type {IssueCategory,Role} from './types';
import {missionRankBand,type MissionRankBand} from './rankMissionBenchmarks';

export type CoachingDevelopmentBand='FUNDAMENTALS'|'CONTROL'|'MACRO'|'DECISION';

export interface CoachingPriority{band:CoachingDevelopmentBand;score:number;reason:string}

const BAND_BY_RANK:Record<MissionRankBand,CoachingDevelopmentBand>={IRON:'FUNDAMENTALS',BRONZE:'FUNDAMENTALS',SILVER:'CONTROL',GOLD:'CONTROL',PLATINUM:'MACRO',EMERALD:'MACRO',DIAMOND:'DECISION',MASTER:'DECISION'};

const BAND_BASE:Record<CoachingDevelopmentBand,Partial<Record<IssueCategory,number>>>={
  FUNDAMENTALS:{FARMING:96,RESOURCE_COLLECTION:92,DEATHS:95,LANING:90,RECALL_TIMING:88,MAP_AWARENESS:78,POSITIONING:76,VISION:68,OBJECTIVES:66,TRADING:72,WAVE_MANAGEMENT:70,TEAMFIGHTING:62,TARGET_SELECTION:56,TEMPO:58,MATCHUPS:55,ITEMISATION:60,CHAMPION_MASTERY:72,CONSISTENCY:68},
  CONTROL:{LANING:92,TRADING:91,WAVE_MANAGEMENT:94,DEATHS:90,RECALL_TIMING:86,FARMING:84,RESOURCE_COLLECTION:82,MAP_AWARENESS:84,CHAMPION_MASTERY:86,POSITIONING:78,VISION:76,OBJECTIVES:75,TEMPO:76,TEAMFIGHTING:72,TARGET_SELECTION:66,MATCHUPS:78,ITEMISATION:68,CONSISTENCY:84},
  MACRO:{OBJECTIVES:96,TEMPO:94,MAP_AWARENESS:92,VISION:90,RESOURCE_COLLECTION:88,WAVE_MANAGEMENT:88,POSITIONING:84,DEATHS:82,TEAMFIGHTING:82,TARGET_SELECTION:76,RECALL_TIMING:86,MATCHUPS:78,LANING:74,TRADING:72,FARMING:76,ITEMISATION:80,CHAMPION_MASTERY:76,CONSISTENCY:84},
  DECISION:{TEMPO:96,POSITIONING:96,TEAMFIGHTING:95,TARGET_SELECTION:94,MATCHUPS:93,CONSISTENCY:94,OBJECTIVES:91,MAP_AWARENESS:90,RECALL_TIMING:90,ITEMISATION:88,VISION:84,RESOURCE_COLLECTION:80,WAVE_MANAGEMENT:82,DEATHS:84,TRADING:86,LANING:78,FARMING:72,CHAMPION_MASTERY:88},
};

const ROLE_ADJUST:Record<Role,Partial<Record<IssueCategory,number>>>={
  ADC:{FARMING:8,RESOURCE_COLLECTION:8,POSITIONING:10,TEAMFIGHTING:10,TARGET_SELECTION:9,DEATHS:6,RECALL_TIMING:5,OBJECTIVES:2,VISION:-8},
  MID:{LANING:5,TRADING:5,WAVE_MANAGEMENT:7,TEMPO:8,MAP_AWARENESS:7,TEAMFIGHTING:5,POSITIONING:4,RESOURCE_COLLECTION:4},
  TOP:{LANING:7,TRADING:6,WAVE_MANAGEMENT:9,RESOURCE_COLLECTION:7,TEMPO:7,DEATHS:5,MATCHUPS:7,OBJECTIVES:2,MAP_AWARENESS:3},
  JUNGLE:{OBJECTIVES:12,TEMPO:11,MAP_AWARENESS:10,FARMING:5,DEATHS:6,VISION:5,TEAMFIGHTING:4,LANING:-15,TRADING:-10,WAVE_MANAGEMENT:-8},
  SUPPORT:{VISION:14,MAP_AWARENESS:12,POSITIONING:10,OBJECTIVES:9,TEMPO:8,TEAMFIGHTING:7,DEATHS:5,FARMING:-18,RESOURCE_COLLECTION:-12,WAVE_MANAGEMENT:-4},
};

const METRIC_ADJUST:Record<string,Partial<Record<CoachingDevelopmentBand,number>>>={
  csAt10:{FUNDAMENTALS:12,CONTROL:4,MACRO:-4,DECISION:-10},
  csAt15:{FUNDAMENTALS:10,CONTROL:5,MACRO:-3,DECISION:-8},
  laneCsPerMin:{FUNDAMENTALS:12,CONTROL:5,MACRO:-3,DECISION:-8},
  csPerMin:{FUNDAMENTALS:10,CONTROL:4,MACRO:0,DECISION:-6},
  deathsPre10:{FUNDAMENTALS:12,CONTROL:10,MACRO:1,DECISION:-3},
  deaths:{FUNDAMENTALS:10,CONTROL:8,MACRO:1,DECISION:-3},
  visionScore:{FUNDAMENTALS:0,CONTROL:4,MACRO:8,DECISION:4},
  objectiveParticipation:{FUNDAMENTALS:-4,CONTROL:3,MACRO:12,DECISION:7},
  killParticipation:{FUNDAMENTALS:-2,CONTROL:3,MACRO:8,DECISION:5},
  secondItemMinute:{FUNDAMENTALS:5,CONTROL:7,MACRO:7,DECISION:7},
  post15CsPerMin:{FUNDAMENTALS:2,CONTROL:5,MACRO:9,DECISION:4},
  damageShare:{FUNDAMENTALS:-8,CONTROL:-2,MACRO:3,DECISION:7},
  fight_selection:{FUNDAMENTALS:-10,CONTROL:-2,MACRO:6,DECISION:13},
  carry_preservation:{FUNDAMENTALS:-8,CONTROL:0,MACRO:6,DECISION:13},
  survival_value:{FUNDAMENTALS:-5,CONTROL:1,MACRO:6,DECISION:12},
  objective_readiness:{FUNDAMENTALS:-6,CONTROL:2,MACRO:14,DECISION:10},
  reset_quality:{FUNDAMENTALS:3,CONTROL:7,MACRO:10,DECISION:11},
  farm_fight_tradeoff:{FUNDAMENTALS:-5,CONTROL:1,MACRO:10,DECISION:10},
  opponent_adaptation:{FUNDAMENTALS:-8,CONTROL:2,MACRO:6,DECISION:14},
  historical_recovery:{FUNDAMENTALS:2,CONTROL:7,MACRO:8,DECISION:11},
  lead_protection:{FUNDAMENTALS:-4,CONTROL:3,MACRO:8,DECISION:12},
  power_spike_conversion:{FUNDAMENTALS:-6,CONTROL:0,MACRO:7,DECISION:12},
  fight_conversion:{FUNDAMENTALS:-8,CONTROL:-2,MACRO:5,DECISION:12},
  underdog_conversion:{FUNDAMENTALS:-10,CONTROL:-4,MACRO:2,DECISION:8},
  build_response:{FUNDAMENTALS:-6,CONTROL:0,MACRO:5,DECISION:10},
  damage_efficiency:{FUNDAMENTALS:-8,CONTROL:-2,MACRO:4,DECISION:9},
};

export function coachingDevelopmentBand(rank?:string|null):CoachingDevelopmentBand{return BAND_BY_RANK[missionRankBand(rank)]}

export function coachingPriority(role:Role,rank:string|null|undefined,category:IssueCategory,metric?:string|null):CoachingPriority{
  const band=coachingDevelopmentBand(rank);
  const base=BAND_BASE[band][category]??70;
  const roleAdjust=ROLE_ADJUST[role][category]??0;
  const metricAdjust=METRIC_ADJUST[String(metric||'')]?.[band]??0;
  const score=clamp(base+roleAdjust+metricAdjust);
  return{band,score,reason:priorityReason(band,role,category,metric)};
}

export function coachingNeedScore(input:{role:Role;rank?:string|null;category:IssueCategory;metric?:string|null;evidenceProgress:number;legacyPriority?:number}){
  const priority=coachingPriority(input.role,input.rank,input.category,input.metric);
  const need=clamp(100-input.evidenceProgress);
  const legacy=clamp(input.legacyPriority??50);
  return{...priority,need,score:round(priority.score*.56+need*.39+legacy*.05)};
}

export function coachingEvidenceScore(input:{role:Role;rank?:string|null;category:IssueCategory;metric?:string|null;evidenceScore:number;weakGames:number;games:number}){
  const priority=coachingPriority(input.role,input.rank,input.category,input.metric);
  const weakness=clamp(100-input.evidenceScore);
  const repeat=input.games?clamp(input.weakGames/input.games*100):0;
  return{...priority,weakness,repeat,score:round(priority.score*.52+weakness*.33+repeat*.15)};
}

function priorityReason(band:CoachingDevelopmentBand,role:Role,category:IssueCategory,metric?:string|null){
  const focus=band==='FUNDAMENTALS'?'fundamentals and avoidable self-created losses':band==='CONTROL'?'consistent lane control and repeatable execution':band==='MACRO'?'map conversion, objective setup and useful movement':'decision quality, efficiency and adaptation';
  const categoryText=category.replaceAll('_',' ').toLowerCase();
  const metricText=metric?' using '+String(metric).replaceAll('_',' ').toLowerCase()+' evidence':'';
  return role+' '+band.toLowerCase()+' coaching prioritises '+focus+'; '+categoryText+metricText+' is weighted against that stage.';
}

function clamp(value:number){return Math.max(0,Math.min(100,Math.round(value)))}
function round(value:number){return Math.round(value*10)/10}
