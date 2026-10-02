import type {DnaDomain,ILPTask,Role} from './types';
import {DNA_DOMAINS} from './dnaDomain';
import {taskAppliesToRole} from './roleAwareLearning';

export const DNA_XP_PER_COMPLETED_GAME=25;
export const DNA_XP_PER_MASTERED_MISSION=100;

export type DnaLevelProgress={
  domain:DnaDomain;
  level:number;
  totalXp:number;
  xpIntoLevel:number;
  xpForNextLevel:number;
  levelProgress:number;
  masteredMissions:number;
  currentCompletedGames:number;
};

export function dnaXpRequiredForLevel(level:number){
  const safe=Math.max(1,Math.floor(level));
  return 100+(safe-1)*25;
}

export function dnaLevelFromXp(totalXp:number){
  const xp=Math.max(0,Math.floor(Number(totalXp)||0));
  let level=1;
  let spent=0;
  let next=dnaXpRequiredForLevel(level);
  while(xp>=spent+next){
    spent+=next;
    level+=1;
    next=dnaXpRequiredForLevel(level);
  }
  const xpIntoLevel=xp-spent;
  return{
    level,
    totalXp:xp,
    xpIntoLevel,
    xpForNextLevel:next,
    levelProgress:Math.max(0,Math.min(100,Math.round(xpIntoLevel/Math.max(1,next)*100))),
  };
}

export function dnaStrandLevel(tasks:ILPTask[],domain:DnaDomain,role?:Role|null):DnaLevelProgress{
  const strand=tasks.filter(task=>String(task.id||'').startsWith('dna-strand-')&&task.dnaDomain===domain&&taskAppliesToRole(task,role));
  const mastered=strand.filter(task=>String(task.status).toUpperCase()==='MASTERED');
  const live=strand.filter(task=>!['MASTERED','PAUSED'].includes(String(task.status).toUpperCase()));
  const current=live[0]??null;
  const currentCompletedGames=Math.min(
    Math.max(1,Number(current?.masteryRequired)||3),
    (current?.missionHistory??[]).filter(attempt=>attempt.banksPass).length,
  );
  const totalXp=mastered.length*DNA_XP_PER_MASTERED_MISSION+currentCompletedGames*DNA_XP_PER_COMPLETED_GAME;
  return{
    domain,
    ...dnaLevelFromXp(totalXp),
    masteredMissions:mastered.length,
    currentCompletedGames,
  };
}

export function dnaLevels(tasks:ILPTask[],role?:Role|null){
  return DNA_DOMAINS.map(domain=>dnaStrandLevel(tasks,domain,role));
}