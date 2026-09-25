import type {ILPTask,Match} from './types';
import type {CoachingMetricKey} from './subscription';
import {METRIC_SPECS} from './metrics';
import {benchmarkPass,benchmarkTargetText,missionBenchmark} from './rankMissionBenchmarks';
import {missionTargetNumber} from './proMissionMastery';

export type MissionMeasurementSource='LIVE_MEASURABLE'|'RIOT_POST_GAME'|'DECISION_EVIDENCE';

export interface MissionGameGrade{
  available:boolean;
  passed:boolean;
  source:MissionMeasurementSource;
  value:number|null;
  valueLabel:string;
  targetLabel:string;
  reason:string;
}

const LIVE_METRICS=new Set([
  'laneCsPerMin','post15CsPerMin','csPerMin','deathsPost20','deaths',
  'secondItemMinute','visionScore','deathsPre10','csAt10','csAt15',
]);
const RIOT_METRICS=new Set([
  'objectiveParticipation','damageShare','killParticipation',
]);

export function missionMeasurementSource(metric:string):MissionMeasurementSource{
  if(LIVE_METRICS.has(metric))return'LIVE_MEASURABLE';
  if(RIOT_METRICS.has(metric))return'RIOT_POST_GAME';
  return'DECISION_EVIDENCE';
}

export function missionMeasurementLabel(source:MissionMeasurementSource){
  if(source==='LIVE_MEASURABLE')return'LIVE MEASURABLE';
  if(source==='RIOT_POST_GAME')return'RIOT POST-GAME';
  return'DECISION EVIDENCE';
}

export function gradeMissionGame(task:Pick<ILPTask,'metric'|'target'>,match:Match|undefined,rank?:string|null):MissionGameGrade{
  const source=missionMeasurementSource(task.metric);
  if(!match)return{
    available:false,passed:false,source,value:null,valueLabel:'WAITING FOR A GAME',
    targetLabel:benchmarkTargetText(task.metric,rank,task.target),
    reason:'Complete a tracked game to create the next mission result.',
  };

  const benchmark=missionBenchmark(task.metric,rank||match.rank);
  if(benchmark){
    const raw=task.metric==='deaths'?match.deaths:match.metrics[task.metric as keyof Match['metrics']];
    const spec=METRIC_SPECS[task.metric];
    if(typeof raw!=='number'||!Number.isFinite(raw))return{
      available:false,passed:false,source,value:null,valueLabel:'EVIDENCE UNAVAILABLE',
      targetLabel:benchmark.targetText,
      reason:source==='RIOT_POST_GAME'
        ?'This match has not received the completed Riot metric required for this mission yet.'
        :'This tracked game did not expose the metric required for this mission, so OP CLIMB will not guess.',
    };
    const passed=benchmarkPass(task.metric,raw,rank||match.rank)===true;
    return{
      available:true,passed,source,value:raw,
      valueLabel:formatMetricValue(task.metric,raw,spec?.format),
      targetLabel:benchmark.targetText,
      reason:`${spec?.behaviour||task.metric}: ${formatMetricValue(task.metric,raw,spec?.format)} vs ${benchmark.targetText}.`,
    };
  }

  const pro=match.proAnalysis?.metrics?.[task.metric as CoachingMetricKey];
  if(!pro||pro.status==='UNAVAILABLE'||pro.status==='BUILDING'||typeof pro.score!=='number')return{
    available:false,passed:false,source:'DECISION_EVIDENCE',value:null,
    valueLabel:'DECISION EVIDENCE BUILDING',targetLabel:task.target,
    reason:'This mission needs a completed decision-analysis score. OP CLIMB will not substitute a scoreboard proxy.',
  };
  const threshold=missionTargetNumber(task.target);
  return{
    available:true,
    passed:pro.score>=threshold,
    source:'DECISION_EVIDENCE',
    value:pro.score,
    valueLabel:`${Math.round(pro.score)}/100`,
    targetLabel:`${threshold}+ decision score · 3 proven games`,
    reason:`${pro.label}: ${Math.round(pro.score)}/100 from ${pro.sources.join(' + ')} evidence.`,
  };
}

function formatMetricValue(metric:string,value:number,formatter?:((value:number)=>string)){
  if(formatter)return formatter(value);
  if(metric==='objectiveParticipation'||metric==='damageShare'||metric==='killParticipation')return Math.round(value*100)+'%';
  if(metric==='secondItemMinute'){
    const minutes=Math.floor(value),seconds=Math.round((value-minutes)*60);
    return minutes+':'+String(seconds).padStart(2,'0');
  }
  if(metric.toLowerCase().includes('cspermin'))return value.toFixed(1)+' CS/min';
  return Number.isInteger(value)?String(value):value.toFixed(1);
}
