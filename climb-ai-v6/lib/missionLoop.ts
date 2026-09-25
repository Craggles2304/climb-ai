import {ILPTask,Match,ILPMissionAttempt} from './types';
import {METRIC_SPECS,clears,thresholdLabel} from './metrics';

export type MissionStage='DISCOVER'|'PRACTISE'|'REPEAT'|'MASTERED';
export interface MissionEvidence{
  available:boolean;
  clearedBar:boolean;
  value?:number;
  valueLabel:string;
  targetLabel:string;
  reason:string;
}

export function missionStage(task:ILPTask):MissionStage{
  if(task.status==='MASTERED')return'MASTERED';
  const history=task.missionHistory??[];
  const reviewed=history.length;
  const confirmed=reviewed
    ?history.filter(a=>a.banksPass).length
    :Math.max(0,task.successfulGames??0);
  const observed=reviewed||Math.max(0,task.gamesObserved??0);
  if(!observed)return'DISCOVER';
  if(!confirmed)return'PRACTISE';
  return'REPEAT';
}

export function missionEvidence(task:ILPTask,match:Match|undefined):MissionEvidence{
  const spec=METRIC_SPECS[task.metric];
  if(!match)return{available:false,clearedBar:false,valueLabel:'WAITING FOR A GAME',targetLabel:task.target,reason:'Complete a meaningful tracked game to create the next mission rep.'};
  if(!spec)return{available:false,clearedBar:false,valueLabel:'REVIEW EVIDENCE',targetLabel:task.target,reason:manualEvidenceReason(task.metric)};
  const raw=match.metrics[spec.key];
  if(typeof raw!=='number'||!Number.isFinite(raw))return{available:false,clearedBar:false,valueLabel:'EVIDENCE UNAVAILABLE',targetLabel:thresholdLabel(spec),reason:`This match did not expose reliable ${spec.label} evidence, so OP CLIMB will not invent a result.`};
  return{
    available:true,
    clearedBar:clears(spec,raw),
    value:raw,
    valueLabel:spec.format(raw),
    targetLabel:thresholdLabel(spec),
    reason:`${spec.behaviour}: ${spec.format(raw)} vs mission bar ${thresholdLabel(spec)}.`,
  };
}

export function missionSummary(task:ILPTask){
  const history=task.missionHistory??[];
  const required=task.masteryRequired||3;
  const hasReviewedBehaviour=history.length>0;
  const confirmed=hasReviewedBehaviour
    ?history.filter(a=>a.banksPass).length
    :Math.min(required,Math.max(0,task.successfulGames??0));
  const attempted=hasReviewedBehaviour
    ?history.filter(a=>a.adherence==='YES'||a.adherence==='PARTLY'||a.adherence==='TRACKED').length
    :Math.max(0,task.gamesObserved??0);
  const reviewed=hasReviewedBehaviour?history.length:Math.max(0,task.gamesObserved??0);
  return{
    stage:missionStage(task),
    confirmed,
    attempted,
    reviewed,
    required,
    remaining:Math.max(0,required-confirmed),
    latest:history[history.length-1],
    proofMode:hasReviewedBehaviour?'REVIEWED' as const:'TRACKED' as const,
  };
}

export function upsertMissionAttempt(task:ILPTask,attempt:ILPMissionAttempt):ILPTask{
  const current=task.missionHistory??[];
  const previous=current.find(a=>a.matchId===attempt.matchId);
  const history=[...current.filter(a=>a.matchId!==attempt.matchId),attempt]
    .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))
    .slice(-12);
  const confirmed=history.filter(a=>a.banksPass).length;
  const required=task.masteryRequired||3;
  const missionProgress=Math.min(100,Math.round(confirmed/required*100));
  const changed=!previous||previous.outcome!==attempt.outcome||previous.adherence!==attempt.adherence||previous.clearedBar!==attempt.clearedBar;
  const note=`Mission rep: ${attempt.outcome.replaceAll('_',' ')}${attempt.banksPass?' — pass banked':''}.`;
  return{
    ...task,
    missionHistory:history,
    missionProgress,
    lastUpdatedReason:changed?note:task.lastUpdatedReason,
    evidence:[...task.evidence.filter(x=>!x.startsWith('MISSION:')),`MISSION: ${confirmed}/${required} confirmed behaviour reps banked.`],
    history:changed?[...(task.history??[]),{at:attempt.at,type:'MISSION' as const,note}].slice(-12):task.history,
  };
}

function manualEvidenceReason(metric:string){
  if(metric==='objectivePreparation')return'Objective setup needs a reviewed setup decision or richer Companion evidence. Mission Lab will not mark a pass from a scoreboard proxy.';
  if(metric==='mapCheck')return'Map-check behaviour requires reviewed decision evidence. A final scoreboard cannot prove whether the check happened.';
  if(metric==='clipReview')return'This mission requires a reviewed clip or coaching review before a pass can be banked.';
  if(metric.toLowerCase().includes('op pro'))return'OP CLIMB updates this priority from the post-game PRO decision analysis. No manual pass is invented when the underlying decision evidence is unavailable.';
  return'This behaviour needs reviewed evidence rather than a guessed scoreboard proxy.';
}
