import {ILPTask,Match,ILPMissionAttempt} from './types';
import {gradeMissionGame} from './missionGrading';

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

export function missionEvidence(task:ILPTask,match:Match|undefined,rank?:string|null):MissionEvidence{
  const grade=gradeMissionGame(task,match,rank);
  return{
    available:grade.available,
    clearedBar:grade.passed,
    value:grade.value??undefined,
    valueLabel:grade.valueLabel,
    targetLabel:grade.targetLabel,
    reason:grade.reason,
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
