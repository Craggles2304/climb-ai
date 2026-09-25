import type {ILPTask} from './types';

export const XP_PER_PROVEN_REP=50;
export const XP_PER_MISSION_MASTERY=500;

export interface AccountProgress{
  xp:number;
  level:number;
  levelStartXp:number;
  nextLevelXp:number;
  levelProgress:number;
  masteredMissions:number;
  provenReps:number;
  title:string;
}

export function provenRepsForTask(task:ILPTask){
  const history=task.missionHistory??[];
  if(history.length)return history.filter(rep=>rep.banksPass).length;
  return Math.max(0,task.successfulGames??0);
}

export function xpForTask(task:ILPTask){
  const reps=provenRepsForTask(task);
  const mastery=task.status==='MASTERED'?XP_PER_MISSION_MASTERY:0;
  return reps*XP_PER_PROVEN_REP+mastery;
}

export function accountProgress(tasks:ILPTask[]):AccountProgress{
  const unique=[...new Map(tasks.map(task=>[task.id,task])).values()];
  const provenReps=unique.reduce((sum,task)=>sum+provenRepsForTask(task),0);
  const masteredMissions=unique.filter(task=>task.status==='MASTERED').length;
  const xp=unique.reduce((sum,task)=>sum+xpForTask(task),0);
  return progressFromXp(xp,{masteredMissions,provenReps});
}

export function progressFromXp(
  xp:number,
  counts:{masteredMissions?:number;provenReps?:number}={},
):AccountProgress{
  const total=Math.max(0,Math.round(Number(xp)||0));
  let level=1;
  while(total>=xpToReachLevel(level+1)&&level<100)level+=1;
  const levelStartXp=xpToReachLevel(level);
  const nextLevelXp=xpToReachLevel(level+1);
  const span=Math.max(1,nextLevelXp-levelStartXp);
  const levelProgress=Math.max(0,Math.min(100,Math.round((total-levelStartXp)/span*100)));

  return{
    xp:total,
    level,
    levelStartXp,
    nextLevelXp,
    levelProgress,
    masteredMissions:Math.max(0,Math.round(counts.masteredMissions??0)),
    provenReps:Math.max(0,Math.round(counts.provenReps??0)),
    title:levelTitle(level),
  };
}

export function xpToReachLevel(level:number){
  const n=Math.max(1,Math.floor(level));
  return 250*(n-1)*n;
}

function levelTitle(level:number){
  if(level>=20)return'ELITE';
  if(level>=15)return'ASCENDANT';
  if(level>=10)return'VETERAN';
  if(level>=7)return'SPECIALIST';
  if(level>=4)return'CLIMBER';
  if(level>=2)return'ROOKIE+';
  return'ROOKIE';
}
