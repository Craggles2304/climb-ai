import type {ILPTask,ILPMissionAttempt} from './types';
import {missionTargetNumber} from './proMissionMastery';
/** A server-produced V2 evidence receipt, with a timestamped fact, is required to bank a rep.
 * Legacy banksPass flags do not on their own qualify for mastery or XP.
 */
export function verifiedMissionRep(task:Pick<ILPTask,'metric'|'target'>,attempt:ILPMissionAttempt|undefined|null):boolean{
  if(!attempt||!attempt.matchId||!attempt.banksPass||!attempt.clearedBar||attempt.outcome!=='CONFIRMED')return false;
  if(attempt.source!=='TRACKED'&&attempt.adherence!=='TRACKED')return false;
  const receipt=attempt.evidenceV2;
  if(!receipt||receipt.version!==2||receipt.state!=='BANKED'||receipt.metric!==task.metric)return false;
  if(receipt.confidence==='LOW')return false;
  if(typeof receipt.observedValue!=='number'||!Number.isFinite(receipt.observedValue))return false;
  if(receipt.measurementSource==='DECISION_EVIDENCE'&&receipt.observedValue<missionTargetNumber(task.target))return false;
  if(!(receipt.opportunities>0&&receipt.successes>0))return false;
  if(!receipt.reconstruction?.fields?.length||!receipt.reconstruction.formula?.trim())return false;
  if(receipt.measurementSource==='DECISION_EVIDENCE'&&receipt.reconstruction.kind!=='PRO_METRIC')return false;
  if(receipt.measurementSource!=='DECISION_EVIDENCE'&&receipt.reconstruction.kind!=='MATCH_METRIC')return false;
  return Boolean(receipt.events?.some(event=>
    typeof event.atSeconds==='number'&&Number.isFinite(event.atSeconds)&&event.atSeconds>=0&&
    Boolean(event.label?.trim()&&event.detail?.trim())));
}
export function verifiedMissionAttempts(task:Pick<ILPTask,'metric'|'target'|'missionHistory'>):ILPMissionAttempt[]{
  const seen=new Set<string>();
  return (task.missionHistory??[]).filter(attempt=>{
    if(!verifiedMissionRep(task,attempt)||seen.has(attempt.matchId))return false;
    seen.add(attempt.matchId);return true;
  });
}
export function verifiedMissionMastery(task:ILPTask):boolean{
  const required=Math.max(1,Number(task.masteryRequired)||3);
  return task.status==='MASTERED'&&verifiedMissionAttempts(task).length>=required;
}
