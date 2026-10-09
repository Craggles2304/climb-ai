import type {DnaDomain,ILPTask,Role} from './types';
import {taskAppliesToRole} from './roleAwareLearning';
import {isDnaStrandMission} from './dnaStrandMissions';

/**
 * A manual DNA tree selection must be a new, timestamped player action.
 * Without history, cloud reconciliation treats the user's changed
 * dnaFocusUnlocked boolean as stale and silently restores the old trees.
 *
 * Unlike mission attempts, this never awards progression or mastery.
 */
export function applyDnaFocusSelection(
  input:ILPTask[],
  domains:DnaDomain[],
  role:Role,
  at=new Date().toISOString(),
):ILPTask[]|null{
  const unique=[...new Set(domains)];
  if(unique.length!==2||unique.length!==domains.length)return null;
  const scoped=input.filter(task=>taskAppliesToRole(task,role)
    &&isDnaStrandMission(task)&&task.status!=='MASTERED'&&task.status!=='PAUSED');
  if(unique.some(domain=>!scoped.some(task=>task.dnaDomain===domain)))return null;
  const chosen=new Set(unique);
  return input.map(task=>{
    if(!taskAppliesToRole(task,role)||!isDnaStrandMission(task)||task.status==='MASTERED'||task.status==='PAUSED')return task;
    const unlocked=chosen.has(task.dnaDomain);
    if(task.dnaFocusUnlocked===unlocked)return task;
    const note=unlocked
      ?'DNA tree unlocked by player for scored progression.'
      :'DNA tree locked by player; remains visible and measured but does not bank mission progress.';
    return {...task,dnaFocusUnlocked:unlocked,lastUpdatedReason:note,
      history:[...(task.history??[]),{at,type:'COACH_EDIT' as const,note}].slice(-12)};
  });
}
