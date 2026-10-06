import type {ILPTask} from './types';

export function missionComparisonForMatch(task:ILPTask,matchId:string|undefined){
  const attempt=matchId?(task.missionHistory??[]).find(item=>item.matchId===matchId):undefined;
  if(!attempt)return{result:'NOT OBSERVED' as const,detail:'No reviewed mission evidence for this game yet.'};

  const state=attempt.evidenceV2?.state??(attempt.banksPass?'BANKED':attempt.outcome==='NO_REP'?'NOT_OBSERVED':'MISSED');
  const result=state==='BANKED'?'PROVEN' as const:state==='MISSED'?'NEEDS WORK' as const:'NOT OBSERVED' as const;
  const detail=attempt.evidenceV2?.reason
    ||(attempt.evidenceV2?.observedValueLabel?`${attempt.evidenceV2.observedValueLabel} · target ${attempt.evidenceV2.targetLabel}`:undefined)
    ||(result==='PROVEN'?'This game earned a proven completion.':result==='NEEDS WORK'?'This game did not earn a proven completion.':'The mission could not be judged from this game.');
  return{result,detail};
}
