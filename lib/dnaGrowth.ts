import type {ILPTask,Match,Role} from './types';
import {missionSummary} from './missionLoop';

export const DNA_BASELINE_GAMES=3;

export function dnaBaselineGameCount(matches:Match[],role?:Role){
  const ids=new Set<string>();
  for(const match of matches){
    if(match.durationSeconds<300)continue;
    if(role&&match.role!==role)continue;
    ids.add(match.id);
  }
  return ids.size;
}

export function dnaBaselineReady(gameCount:number){
  return gameCount>=DNA_BASELINE_GAMES;
}

export function dnaTaskProgress(task:ILPTask){
  const {confirmed,required}=missionSummary(task);
  return missionProgressPercent(confirmed,required);
}

export function missionProgressPercent(completedReps:number,requiredReps:number){
  const required=Math.max(1,Math.round(Number(requiredReps)||1));
  const completed=Math.max(0,Math.min(required,Math.round(Number(completedReps)||0)));
  return Math.round(completed/required*100);
}

export function uniqueActiveMissions(tasks:ILPTask[]){
  const seen=new Set<string>();
  return tasks.filter(task=>{
    if(['MASTERED','PAUSED'].includes(String(task.status).toUpperCase()))return false;
    const id=String(task.id||'').trim();
    if(!id||seen.has(id))return false;
    seen.add(id);
    return true;
  });
}

export function dnaTaskState(task:ILPTask):0|1|2|3{
  if(task.status==='MASTERED')return 3;
  const progress=dnaTaskProgress(task);
  if(progress>=100)return 2;
  if(task.status==='PAUSED'&&progress<=0)return 0;
  return 1;
}
