import type {ILPTask} from './types';

export type IlpExplainAction='PROMOTED'|'STRENGTHENED'|'REVISED'|'MASTERED'|'REOPENED'|'REFILLED'|'WATCH'|'BASELINE';

type AdaptiveMetaLike={
  managedBy?:string;
  confidence?:number;
  recentSupportGames?:number;
  recentWindow?:number;
  recentOccurrences?:number;
  totalSupportGames?:number;
  cleanStreak?:number;
  lastAction?:string;
};

type AdaptiveTask=ILPTask&{adaptive?:AdaptiveMetaLike};

export interface IlpExplanation{
  evidenceManaged:boolean;
  action:IlpExplainAction;
  label:string;
  headline:string;
  reason:string;
  confidence:number|null;
  confidenceLabel:string;
  recentSupportGames:number|null;
  recentWindow:number|null;
  recentOccurrences:number|null;
  totalSupportGames:number|null;
  cleanStreak:number;
  masteryRequired:number;
  oneOffGuard:boolean;
}

const asNumber=(value:unknown,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value:number)=>Math.max(0,Math.min(100,Math.round(value)));

function actionOf(task:AdaptiveTask):IlpExplainAction{
  const raw=String(task.adaptive?.lastAction||'').toUpperCase();
  if(['PROMOTED','STRENGTHENED','REVISED','MASTERED','REOPENED','REFILLED','WATCH'].includes(raw))return raw as IlpExplainAction;
  return'BASELINE';
}

function confidenceLabel(confidence:number|null){
  if(confidence===null)return'BUILDING';
  if(confidence>=85)return'VERY HIGH';
  if(confidence>=70)return'HIGH';
  if(confidence>=50)return'MEDIUM';
  return'EARLY';
}

function copyFor(action:IlpExplainAction,task:ILPTask,evidenceManaged:boolean){
  if(!evidenceManaged)return{
    label:'BUILDING EVIDENCE',
    headline:'This mission is being tested against your games.',
    reason:task.lastUpdatedReason||'OP CLIMB needs repeated match evidence before it changes this mission automatically.',
  };
  switch(action){
    case'PROMOTED':return{label:'MISSION ADDED',headline:'Repeated evidence earned this one of your two active mission slots.',reason:task.lastUpdatedReason||'The same behaviour appeared often enough across multiple games to become an active development priority.'};
    case'STRENGTHENED':return{label:'MISSION STRENGTHENED',headline:'More games are confirming this is a real pattern.',reason:task.lastUpdatedReason||'The same behaviour has repeated again, so confidence in this mission has increased.'};
    case'REVISED':return{label:'MISSION REVISED',headline:'The mission changed because the evidence became more specific.',reason:task.lastUpdatedReason||'Repeated match evidence refined the behaviour OP CLIMB wants you to fix.'};
    case'MASTERED':return{label:'MISSION MASTERED',headline:'You proved the behaviour changed across consecutive clean games.',reason:task.lastUpdatedReason||'The pattern stayed absent for the required run of clean games.'};
    case'REOPENED':return{label:'MISSION REOPENED',headline:'The old pattern returned often enough to matter again.',reason:task.lastUpdatedReason||'A repeated recurrence—not one relapse—brought this mission back into the plan.'};
    case'REFILLED':return{label:'PLAN SLOT FILLED',headline:'A new mission filled an open development-plan slot.',reason:task.lastUpdatedReason||'A mastered or paused mission created space and OP CLIMB filled it with the next role-safe priority.'};
    case'WATCH':return task.status==='MASTERED'
      ?{label:'STAYING MASTERED',headline:'There is not enough repeated evidence to reopen this mission.',reason:task.lastUpdatedReason||'A one-off relapse is recorded, but it is not enough to undo mastery.'}
      :{label:'MISSION HELD',headline:'The latest game informed the plan but did not justify a rewrite.',reason:task.lastUpdatedReason||'OP CLIMB is waiting for repeated evidence before changing your three active missions.'};
    default:return{label:'EVIDENCE UPDATED',headline:'Your latest games updated the evidence behind this mission.',reason:task.lastUpdatedReason||'OP CLIMB is tracking whether this behaviour repeats or clears.'};
  }
}

export function explainIlpTask(task:ILPTask):IlpExplanation{
  const adaptive=(task as AdaptiveTask).adaptive;
  const evidenceManaged=adaptive?.managedBy==='POST_GAME_EVIDENCE';
  const action=actionOf(task as AdaptiveTask);
  const confidence=evidenceManaged?clamp(asNumber(adaptive?.confidence)):null;
  const masteryRequired=Math.max(1,asNumber(task.masteryRequired,3));
  const cleanStreak=Math.max(0,Math.min(masteryRequired,asNumber(adaptive?.cleanStreak,task.successfulGames||0)));
  const copy=copyFor(action,task,evidenceManaged);
  return{
    evidenceManaged,
    action,
    ...copy,
    confidence,
    confidenceLabel:confidenceLabel(confidence),
    recentSupportGames:evidenceManaged?Math.max(0,asNumber(adaptive?.recentSupportGames)):null,
    recentWindow:evidenceManaged?Math.max(0,asNumber(adaptive?.recentWindow)):null,
    recentOccurrences:evidenceManaged?Math.max(0,asNumber(adaptive?.recentOccurrences)):null,
    totalSupportGames:evidenceManaged?Math.max(0,asNumber(adaptive?.totalSupportGames)):null,
    cleanStreak,
    masteryRequired,
    oneOffGuard:evidenceManaged,
  };
}
