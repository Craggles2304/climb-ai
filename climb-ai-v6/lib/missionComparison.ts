import type {ILPTask} from './types';
import {verifiedMissionRep} from './verifiedMissionProof';

function clock(seconds:number){
  const safe=Math.max(0,Math.floor(seconds));
  return Math.floor(safe/60)+':'+String(safe%60).padStart(2,'0');
}

export function missionComparisonForMatch(task:ILPTask,matchId:string|undefined){
  const attempt=matchId?(task.missionHistory??[]).find(item=>item.matchId===matchId):undefined;
  if(!attempt)return{result:'NOT OBSERVED' as const,detail:'This was not one of the two scored missions for that game, or no reviewed evidence exists yet.',events:[] as Array<{clock:string;label:string;detail:string}>};

  const state=verifiedMissionRep(task,attempt)?'BANKED':attempt.evidenceV2?.state==='MISSED'?'MISSED':'NOT_OBSERVED';
  const result=state==='BANKED'?'PROVEN' as const:state==='MISSED'?'NEEDS WORK' as const:'NOT OBSERVED' as const;
  const events=(attempt.evidenceV2?.events??[])
    .filter(event=>typeof event.atSeconds==='number'&&Number.isFinite(event.atSeconds))
    .map(event=>({clock:clock(Number(event.atSeconds)),label:event.label,detail:event.detail}))
    .slice(0,4);
  const first=events[0];
  const detail=first
    ?`${first.clock} · ${first.label}: ${first.detail}`
    :attempt.evidenceV2?.reason
      ||(attempt.evidenceV2?.observedValueLabel?`${attempt.evidenceV2.observedValueLabel} · target ${attempt.evidenceV2.targetLabel}`:undefined)
      ||(result==='PROVEN'?'This game earned a proven completion.':result==='NEEDS WORK'?'This game did not earn a proven completion.':'The mission could not be judged from this game.');
  return{result,detail,events};
}
