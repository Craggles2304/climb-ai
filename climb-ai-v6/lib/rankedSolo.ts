import type {ILPTask} from './types';
import {verifiedMissionAttempts} from './verifiedMissionProof';

export const RANKED_SOLO_QUEUE_ID=420;
export const RANKED_SOLO_SCOPE='RANKED_SOLO_V1' as const;
export const RANKED_SOLO_LABEL='Ranked Solo/Duo 5v5';
export function isRankedSolo(queueId:unknown):boolean{return queueId===RANKED_SOLO_QUEUE_ID}

/** CLASSIC and Summoner's Rift alone cannot distinguish normals from ranked. */
export function recordedQueueId(snapshots:ReadonlyArray<{queueId?:number|null}>):number|null{
  const ids=new Set(snapshots.map(s=>s.queueId).filter((id):id is number=>typeof id==='number'&&Number.isInteger(id)&&id>0));
  return ids.size===1?[...ids][0]!:null;
}
export function rankedEligibility(queueId:unknown){
  const eligible=isRankedSolo(queueId);
  return {scope:RANKED_SOLO_SCOPE,queueId:typeof queueId==='number'?queueId:null,eligible,
    reason:eligible?'Ranked Solo/Duo match.':queueId==null?'Queue not verified. Update Companion and record a Ranked Solo/Duo game.':'Only Ranked Solo/Duo games count towards your climb.'};
}

/** Reconcile old mission proofs against owned queue-420 match IDs. Keep an audit
 * copy of the previous state; unknown queues never become ranked by assumption. */
export function scopeMissionsToRanked(tasks:ILPTask[],eligibleIds:ReadonlySet<string>):ILPTask[]{
  return tasks.map(task=>{
    const history=(task.missionHistory??[]).filter(a=>eligibleIds.has(a.matchId));
    const excluded=history.length!==(task.missionHistory??[]).length;
    if(!excluded&&task.queueScope===RANKED_SOLO_SCOPE)return task;
    const verified=verifiedMissionAttempts({...task,missionHistory:history}).length;
    const required=Math.max(1,Number(task.masteryRequired)||3);
    const progress=Math.min(100,Math.round(verified/required*100));
    return {...task,queueScope:RANKED_SOLO_SCOPE,missionHistory:history,
      queueScopeArchive:task.queueScopeArchive??{status:task.status,progress:task.progress,missionHistory:task.missionHistory??[]},
      status:task.status==='PAUSED'?'PAUSED':verified>=required?'MASTERED':task.status==='EVIDENCE_BUILDING'?'EVIDENCE_BUILDING':'ACTIVE',
      progress,missionProgress:progress,metricProgress:history.length?task.metricProgress:0,
      successfulGames:verified,gamesObserved:history.length,
      lastUpdatedReason:excluded?'Previous evidence is preserved in the archive; only verified Solo/Duo matches count.':task.lastUpdatedReason};
  });
}
