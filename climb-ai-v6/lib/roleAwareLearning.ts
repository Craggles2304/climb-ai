import type {ILPTask,Role} from './types';
import type {HistoryAnalysisRow,ProHistoryFix} from './riot/proHistory';

export const LEAGUE_ROLES:Role[]=['TOP','JUNGLE','MID','ADC','SUPPORT'];

const MAP:Record<string,Role>={
  TOP:'TOP',
  JUNGLE:'JUNGLE',
  MIDDLE:'MID',
  MID:'MID',
  BOTTOM:'ADC',
  BOT:'ADC',
  ADC:'ADC',
  UTILITY:'SUPPORT',
  SUPPORT:'SUPPORT',
};

export type RoleScope=Role|'GLOBAL';

export interface RoleEvidenceSummary{
  role:Role;
  games:number;
  latestAt:string|null;
  champions:string[];
}

export interface CrossRolePattern{
  key:string;
  label:string;
  roles:Role[];
  games:number;
  occurrences:number;
  global:boolean;
}

export interface RoleAwareLearningSummary{
  version:1;
  validRoleGames:number;
  unknownRoleGames:number;
  dominantRole:Role|null;
  roles:Partial<Record<Role,RoleEvidenceSummary>>;
  crossRolePatterns:CrossRolePattern[];
  generatedAt:string;
}

const GLOBAL_PATTERN_KEYS=new Set(['BANKING_LEAK','RED_STATE','CHAIN_DEATH','LEAD_THROW']);

export function canonicalLeagueRole(value:unknown):Role|null{
  const key=String(value??'').trim().toUpperCase();
  return MAP[key]??null;
}

export function rowsForRole(rows:HistoryAnalysisRow[],role:Role){
  return rows.filter(row=>canonicalLeagueRole(row.role)===role).map(row=>({...row,role}));
}

export function groupRowsByRole(rows:HistoryAnalysisRow[]){
  const result={} as Partial<Record<Role,HistoryAnalysisRow[]>>;
  for(const role of LEAGUE_ROLES){
    const grouped=rowsForRole(rows,role);
    if(grouped.length)result[role]=grouped;
  }
  return result;
}

export function buildRoleAwareLearningSummary(rows:HistoryAnalysisRow[],generatedAt=new Date().toISOString()):RoleAwareLearningSummary{
  const groups=groupRowsByRole(rows);
  const roles={} as Partial<Record<Role,RoleEvidenceSummary>>;
  let validRoleGames=0;
  for(const role of LEAGUE_ROLES){
    const group=groups[role]??[];
    if(!group.length)continue;
    validRoleGames+=group.length;
    roles[role]={
      role,
      games:group.length,
      latestAt:[...group].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]?.createdAt??null,
      champions:[...new Set(group.map(row=>row.champion).filter(Boolean))],
    };
  }
  const dominantRole=LEAGUE_ROLES
    .map(role=>({role,games:roles[role]?.games??0}))
    .sort((a,b)=>b.games-a.games)[0];
  const patternMap=new Map<string,{label:string;roles:Set<Role>;games:number;occurrences:number}>();
  for(const row of rows){
    const role=canonicalLeagueRole(row.role);
    if(!role)continue;
    for(const leak of row.analysis?.leakSignals??[]){
      const count=Math.max(0,Number(leak.count)||0);
      if(!count)continue;
      const key=String(leak.key||'').trim();
      if(!key)continue;
      const current=patternMap.get(key)??{label:String(leak.label||key),roles:new Set<Role>(),games:0,occurrences:0};
      current.roles.add(role);
      current.games+=1;
      current.occurrences+=count;
      patternMap.set(key,current);
    }
  }
  const crossRolePatterns=[...patternMap.entries()]
    .map(([key,value])=>({
      key,
      label:value.label,
      roles:[...value.roles],
      games:value.games,
      occurrences:value.occurrences,
      global:GLOBAL_PATTERN_KEYS.has(key)&&value.roles.size>=2,
    }))
    .filter(pattern=>pattern.roles.length>=2)
    .sort((a,b)=>Number(b.global)-Number(a.global)||b.roles.length-a.roles.length||b.games-a.games);
  return{
    version:1,
    validRoleGames,
    unknownRoleGames:rows.length-validRoleGames,
    dominantRole:dominantRole?.games?dominantRole.role:null,
    roles,
    crossRolePatterns,
    generatedAt,
  };
}

export function rolesSupportingPattern(rows:HistoryAnalysisRow[],patternKey:string):Role[]{
  const roles=new Set<Role>();
  for(const row of rows){
    const role=canonicalLeagueRole(row.role);
    if(!role)continue;
    if((row.analysis?.leakSignals??[]).some(leak=>String(leak.key)===patternKey&&Number(leak.count)>0))roles.add(role);
  }
  return [...roles];
}

export function scopeForFix(fix:Pick<ProHistoryFix,'key'>,allRows:HistoryAnalysisRow[],fallbackRole:Role):{scope:RoleScope;roleEvidence:Role[]}{
  const roleEvidence=rolesSupportingPattern(allRows,fix.key);
  if(GLOBAL_PATTERN_KEYS.has(fix.key)&&roleEvidence.length>=2)return{scope:'GLOBAL',roleEvidence};
  return{scope:fallbackRole,roleEvidence:roleEvidence.length?roleEvidence:[fallbackRole]};
}

export function taskAppliesToRole(task:Pick<ILPTask,'roleScope'>,role:Role|null|undefined){
  if(!role)return true;
  const scope=task.roleScope;
  return !scope||scope==='GLOBAL'||scope===role;
}

export function stampLegacyTaskScope(task:ILPTask,role:Role):ILPTask{
  if(task.roleScope)return task;
  if(task.source==='COACH'||task.source==='USER')return{...task,roleScope:'GLOBAL',roleEvidence:[]};
  return{
    ...task,
    roleScope:role,
    roleEvidence:[role],
    lastUpdatedReason:task.lastUpdatedReason||`Scoped to ${role} during the role-aware learning upgrade.`,
  };
}

export function isComparableRoleMetric(metric:string){
  const key=String(metric||'').toLowerCase();
  return ![
    'cspermin','lanecspermin','post15cspermin','cs_curve',
    'carry_preservation','survival_value','damage_efficiency',
    'objectiveparticipation','objective_readiness',
    'vision_score','visionscore',
  ].includes(key.replace(/[^a-z0-9_]/g,''));
}
