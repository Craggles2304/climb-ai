import type {DnaDomain,IssueCategory,Match} from './types';
import type {CoachingMetricKey} from './subscription';
import {benchmarkPass,missionBenchmark} from './rankMissionBenchmarks';
import {dnaDomainForTask} from './dnaDomain';

export type StrengthSource='RANK_BENCHMARK'|'DECISION_EVIDENCE'|'TIMELINE';

export interface StrengthEvidence{
  id:string;
  dnaDomain:DnaDomain;
  category:IssueCategory;
  title:string;
  detail:string;
  value:string;
  target:string;
  score:number|null;
  source:StrengthSource;
  atSeconds?:number;
  confidence:'HIGH'|'MEDIUM';
}

const BASE:Array<{metric:string;category:IssueCategory;title:string}>=[
  {metric:'csAt10',category:'LANING',title:'Strong first 10 minutes of farm'},
  {metric:'laneCsPerMin',category:'LANING',title:'Lane economy held up'},
  {metric:'deathsPre10',category:'DEATHS',title:'Protected the early game'},
  {metric:'csAt15',category:'FARMING',title:'Kept the lane economy moving'},
  {metric:'post15CsPerMin',category:'RESOURCE_COLLECTION',title:'Kept collecting after lane'},
  {metric:'csPerMin',category:'FARMING',title:'Farm stayed productive'},
  {metric:'secondItemMinute',category:'RECALL_TIMING',title:'Converted gold into items on time'},
  {metric:'visionScore',category:'VISION',title:'Created useful vision'},
  {metric:'killParticipation',category:'MAP_AWARENESS',title:'Was present for important plays'},
  {metric:'objectiveParticipation',category:'OBJECTIVES',title:'Showed up for objective windows'},
  {metric:'damageShare',category:'TEAMFIGHTING',title:'Converted fights into useful damage'},
  {metric:'deathsPost20',category:'DEATHS',title:'Protected the late game'},
  {metric:'deaths',category:'DEATHS',title:'Kept deaths under control'},
];

const PRO_DOMAIN:Partial<Record<CoachingMetricKey,{category:IssueCategory;title:string}>>={
  fight_selection:{category:'TEAMFIGHTING',title:'Selected fights well'},
  death_control:{category:'DEATHS',title:'Controlled avoidable deaths'},
  cs_curve:{category:'RESOURCE_COLLECTION',title:'Maintained a healthy CS curve'},
  underdog_conversion:{category:'TEAMFIGHTING',title:'Converted difficult fights'},
  fight_conversion:{category:'TEAMFIGHTING',title:'Converted favourable fight windows'},
  resource_conversion:{category:'RESOURCE_COLLECTION',title:'Converted resources into power'},
  lead_protection:{category:'TEMPO',title:'Protected an advantage'},
  power_spike_conversion:{category:'TEMPO',title:'Used power spikes well'},
  reset_quality:{category:'RECALL_TIMING',title:'Reset at useful times'},
  objective_readiness:{category:'OBJECTIVES',title:'Prepared well for objectives'},
  farm_fight_tradeoff:{category:'RESOURCE_COLLECTION',title:'Balanced farm and fighting well'},
  opponent_adaptation:{category:'MATCHUPS',title:'Adapted to repeated threats'},
  item_timing_diff:{category:'ITEMISATION',title:'Hit useful item timings'},
  build_response:{category:'ITEMISATION',title:'Built for the actual game'},
  damage_efficiency:{category:'TEAMFIGHTING',title:'Produced efficient fight damage'},
  survival_value:{category:'POSITIONING',title:'Stayed alive when survival mattered'},
  carry_preservation:{category:'POSITIONING',title:'Protected carry uptime'},
  historical_recovery:{category:'CONSISTENCY',title:'Recovered well after mistakes'},
};

export function positiveEvidenceForMatch(match:Match,rank=match.rank):StrengthEvidence[]{
  const out:StrengthEvidence[]=[];

  for(const spec of BASE){
    const benchmark=missionBenchmark(spec.metric,rank);
    if(!benchmark)continue;
    const raw=spec.metric==='deaths'?match.deaths:match.metrics[spec.metric as keyof Match['metrics']];
    if(typeof raw!=='number'||!Number.isFinite(raw))continue;
    if(benchmarkPass(spec.metric,raw,rank)!==true)continue;
    const dnaDomain=dnaDomainForTask({category:spec.category,metric:spec.metric,title:spec.title});
    out.push({
      id:'rank:'+spec.metric,
      dnaDomain,
      category:spec.category,
      title:spec.title,
      detail:strengthDetail(spec.metric,raw,benchmark.barText),
      value:formatValue(spec.metric,raw),
      target:benchmark.barText,
      score:100,
      source:'RANK_BENCHMARK',
      confidence:'HIGH',
    });
  }

  for(const [key,metric] of Object.entries(match.proAnalysis?.metrics??{})){
    if(!metric||typeof metric.score!=='number'||metric.score<70)continue;
    if(metric.status==='UNAVAILABLE'||metric.status==='BUILDING')continue;
    const mapped=PRO_DOMAIN[key as CoachingMetricKey];
    if(!mapped)continue;
    const dnaDomain=dnaDomainForTask({category:mapped.category,metric:key,title:mapped.title});
    out.push({
      id:'decision:'+key,
      dnaDomain,
      category:mapped.category,
      title:mapped.title,
      detail:metric.summary,
      value:metric.value,
      target:'70+ decision score',
      score:Math.round(metric.score),
      source:'DECISION_EVIDENCE',
      atSeconds:metric.evidence.find(item=>typeof item.atSeconds==='number')?.atSeconds,
      confidence:metric.confidence==='HIGH'?'HIGH':'MEDIUM',
    });
  }

  for(const moment of match.moments??[]){
    if(moment.type!=='OBJECTIVE_TAKEN'||!moment.text.toLowerCase().includes('you were there'))continue;
    out.push({
      id:'timeline:objective:'+moment.atMs,
      dnaDomain:'OBJECTIVES',
      category:'OBJECTIVES',
      title:'Converted an objective window',
      detail:moment.text,
      value:moment.clock,
      target:'Be present when your team converts the objective',
      score:null,
      source:'TIMELINE',
      atSeconds:Math.round(moment.atMs/1000),
      confidence:'HIGH',
    });
  }

  return dedupe(out).sort((a,b)=>strengthPriority(b)-strengthPriority(a)).slice(0,8);
}

function strengthPriority(item:StrengthEvidence){
  const source=item.source==='DECISION_EVIDENCE'?3:item.source==='TIMELINE'?2:1;
  return source*100+(item.score??80);
}

function dedupe(items:StrengthEvidence[]){
  const seen=new Set<string>();
  return items.filter(item=>{
    const key=item.dnaDomain+'|'+item.title.toLowerCase();
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}

function strengthDetail(metric:string,value:number,target:string){
  return `Measured ${formatValue(metric,value)} against your rank target of ${target}. This is a behaviour worth repeating, not generic praise.`;
}

function formatValue(metric:string,value:number){
  if(metric==='objectiveParticipation'||metric==='damageShare'||metric==='killParticipation')return Math.round(value*100)+'%';
  if(metric==='secondItemMinute'){
    const minutes=Math.floor(value),seconds=Math.round((value-minutes)*60);
    return minutes+':'+String(seconds).padStart(2,'0');
  }
  if(metric.toLowerCase().includes('cspermin'))return value.toFixed(1)+' CS/min';
  if(metric==='csAt10'||metric==='csAt15'||metric==='visionScore'||metric==='deaths'||metric==='deathsPre10'||metric==='deathsPost20')return String(Math.round(value));
  return Number.isInteger(value)?String(value):value.toFixed(1);
}
