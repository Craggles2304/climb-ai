import type {ILPTask,Match,MissionEvidenceConfidence,MissionEvidenceReceipt} from './types';
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
  evidenceV2:MissionEvidenceReceipt;
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
  const defaultTarget=benchmarkTargetText(task.metric,rank,task.target);
  if(!match){
    const reason='Complete a tracked game to create the next mission result.';
    return{
      available:false,passed:false,source,value:null,valueLabel:'WAITING FOR A GAME',
      targetLabel:defaultTarget,reason,
      evidenceV2:notObservedReceipt(task.metric,source,defaultTarget,reason),
    };
  }

  const benchmark=missionBenchmark(task.metric,rank||match.rank);
  if(benchmark){
    const raw=task.metric==='deaths'?match.deaths:match.metrics[task.metric as keyof Match['metrics']];
    const spec=METRIC_SPECS[task.metric];
    if(typeof raw!=='number'||!Number.isFinite(raw)){
      const reason=source==='RIOT_POST_GAME'
        ?'This match has not received the completed Riot metric required for this mission yet.'
        :'This tracked game did not expose the metric required for this mission, so OP CLIMB will not guess.';
      return{
        available:false,passed:false,source,value:null,valueLabel:'EVIDENCE UNAVAILABLE',
        targetLabel:benchmark.targetText,reason,
        evidenceV2:notObservedReceipt(task.metric,source,benchmark.targetText,reason),
      };
    }
    const passed=benchmarkPass(task.metric,raw,rank||match.rank)===true;
    const valueLabel=formatMetricValue(task.metric,raw,spec?.format);
    const reason=`${spec?.behaviour||task.metric}: ${valueLabel} vs ${benchmark.targetText}.`;
    return{
      available:true,passed,source,value:raw,valueLabel,targetLabel:benchmark.targetText,reason,
      evidenceV2:matchMetricReceipt({
        metric:task.metric,
        metricLabel:spec?.behaviour||task.metric,
        source,
        value:raw,
        valueLabel,
        targetLabel:benchmark.targetText,
        passed,
        match,
        reason,
      }),
    };
  }

  const pro=match.proAnalysis?.metrics?.[task.metric as CoachingMetricKey];
  if(!pro||pro.status==='UNAVAILABLE'||pro.status==='BUILDING'||typeof pro.score!=='number'){
    const reason='This mission needs a completed decision-analysis score. OP CLIMB will not substitute a scoreboard proxy.';
    return{
      available:false,passed:false,source:'DECISION_EVIDENCE',value:null,
      valueLabel:'DECISION EVIDENCE BUILDING',targetLabel:task.target,reason,
      evidenceV2:notObservedReceipt(task.metric,'DECISION_EVIDENCE',task.target,reason),
    };
  }
  const threshold=missionTargetNumber(task.target);
  const passed=pro.score>=threshold;
  const valueLabel=`${Math.round(pro.score)}/100`;
  const targetLabel=`${threshold}+ decision score · 3 proven games`;
  const reason=`${pro.label}: ${Math.round(pro.score)}/100 from ${pro.sources.join(' + ')} evidence.`;
  return{
    available:true,
    passed,
    source:'DECISION_EVIDENCE',
    value:pro.score,
    valueLabel,
    targetLabel,
    reason,
    evidenceV2:proMetricReceipt({
      metric:task.metric,
      metricLabel:pro.label,
      score:pro.score,
      valueLabel,
      targetLabel,
      passed,
      confidence:pro.confidence,
      sources:pro.sources,
      evidence:pro.evidence,
      reason,
    }),
  };
}

function notObservedReceipt(metric:string,source:MissionMeasurementSource,targetLabel:string,reason:string):MissionEvidenceReceipt{
  return{
    version:2,state:'NOT_OBSERVED',measurementSource:source,metric,metricLabel:metric,
    observedValue:null,observedValueLabel:'NOT OBSERVED',targetLabel,confidence:'LOW',
    opportunities:0,successes:0,misses:0,events:[],
    reconstruction:{kind:source==='DECISION_EVIDENCE'?'PRO_METRIC':'MATCH_METRIC',fields:[],formula:'No valid recorded evidence was available, so no result was banked.'},
    reason,
  };
}

function matchMetricReceipt(input:{
  metric:string;
  metricLabel:string;
  source:MissionMeasurementSource;
  value:number;
  valueLabel:string;
  targetLabel:string;
  passed:boolean;
  match:Match;
  reason:string;
}):MissionEvidenceReceipt{
  const atSeconds=checkpointSeconds(input.metric,input.match.durationSeconds);
  return{
    version:2,
    state:input.passed?'BANKED':'MISSED',
    measurementSource:input.source,
    metric:input.metric,
    metricLabel:input.metricLabel,
    observedValue:input.value,
    observedValueLabel:input.valueLabel,
    targetLabel:input.targetLabel,
    confidence:'HIGH',
    opportunities:1,
    successes:input.passed?1:0,
    misses:input.passed?0:1,
    events:[{
      ...(typeof atSeconds==='number'?{atSeconds}:{}),
      label:input.metricLabel,
      detail:`${input.valueLabel} recorded for this tracked game.`,
    }],
    reconstruction:{
      kind:'MATCH_METRIC',
      fields:[input.metric==='deaths'?'match.deaths':`match.metrics.${input.metric}`,'match.rank'],
      formula:`${input.valueLabel} compared with ${input.targetLabel}`,
    },
    reason:input.reason,
  };
}

export function proMetricReceipt(input:{
  metric:string;
  metricLabel:string;
  score:number;
  valueLabel:string;
  targetLabel:string;
  passed:boolean;
  confidence:MissionEvidenceConfidence;
  sources:string[];
  evidence:Array<{atSeconds?:number;label:string;detail:string}>;
  reason:string;
}):MissionEvidenceReceipt{
  const events=input.evidence.slice(0,8).map(event=>({
    ...(typeof event.atSeconds==='number'&&Number.isFinite(event.atSeconds)?{atSeconds:event.atSeconds}:{}),
    label:event.label,
    detail:event.detail,
  }));
  return{
    version:2,
    state:input.passed?'BANKED':'MISSED',
    measurementSource:'DECISION_EVIDENCE',
    metric:input.metric,
    metricLabel:input.metricLabel,
    observedValue:input.score,
    observedValueLabel:input.valueLabel,
    targetLabel:input.targetLabel,
    confidence:input.confidence,
    opportunities:1,
    successes:input.passed?1:0,
    misses:input.passed?0:1,
    events,
    reconstruction:{
      kind:'PRO_METRIC',
      fields:[...input.sources.map(source=>`proAnalysis:${source}`),`metric:${input.metric}`],
      formula:`${input.score} >= ${input.targetLabel}`,
    },
    reason:input.reason,
  };
}

function checkpointSeconds(metric:string,durationSeconds:number){
  if(metric==='csAt10'||metric==='deathsPre10')return 600;
  if(metric==='csAt15'||metric==='laneCsPerMin')return 900;
  if(Number.isFinite(durationSeconds)&&durationSeconds>0)return Math.round(durationSeconds);
  return undefined;
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
