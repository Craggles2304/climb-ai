import type {ILPTask,Match,Role} from './types';

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
  if(task.status==='MASTERED')return 100;
  return Math.max(0,Math.min(100,Math.round(Number(task.progress)||0)));
}

export function dnaTaskState(task:ILPTask):0|1|2|3{
  if(task.status==='MASTERED')return 3;
  const progress=dnaTaskProgress(task);
  if(progress>=100)return 2;
  if(task.status==='PAUSED'&&progress<=0)return 0;
  return 1;
}
