import type {DnaDomain,ILPMissionAttempt,ILPTask} from './types';
import {DNA_DOMAINS,DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS} from './dnaDomain';
import {missionSummary} from './missionLoop';
import {dnaTaskProgress,missionProgressPercent,uniqueActiveMissions} from './dnaGrowth';

export type CompanionDnaState='LEARNING'|'LEARNED'|'MEMORY'|'TO_LEARN';

export {missionProgressPercent,uniqueActiveMissions};

function stateFor(tasks:ILPTask[]):CompanionDnaState{
  if(tasks.some(task=>!['MASTERED','PAUSED'].includes(task.status)))return'LEARNING';
  if(tasks.some(task=>task.status==='MASTERED'))return'MEMORY';
  if(tasks.some(task=>missionSummary(task).confirmed>=missionSummary(task).required))return'LEARNED';
  return'TO_LEARN';
}

export function companionMissionView(task:ILPTask,includeRecords=false){
  const summary=missionSummary(task);
  return{
    id:task.id,
    title:task.title||'Current mission',
    domain:task.dnaDomain||'CONSISTENCY',
    progressPercent:dnaTaskProgress(task),
    completedReps:summary.confirmed,
    requiredReps:summary.required,
    gameRule:String(task.gameRule||'').trim(),
    target:String(task.target||'').trim(),
    blocker:String(task.why||task.lastUpdatedReason||task.gameRule||'').trim(),
    status:String(task.status||'ACTIVE').toUpperCase(),
    records:includeRecords?(task.missionHistory??[]).slice(-5).map((record:ILPMissionAttempt)=>({
      matchId:record.matchId,at:record.at,outcome:record.outcome,banksPass:record.banksPass,
    })):[],
  };
}

export function companionDnaStrands(tasks:ILPTask[],baselineReady:boolean){
  return DNA_DOMAINS.map(domain=>{
    const related=tasks.filter(task=>task.dnaDomain===domain).slice(0,4);
    const progressSum=baselineReady?related.reduce((sum,task)=>sum+dnaTaskProgress(task),0):0;
    const progressPercent=Math.round(progressSum/4);
    return{
      domain:domain as DnaDomain,
      label:DNA_DOMAIN_LABELS[domain],
      color:DNA_DOMAIN_COLORS[domain],
      progressPercent,
      progressSum,
      state:baselineReady?stateFor(related):'TO_LEARN' as CompanionDnaState,
      activeCount:related.filter(task=>!['MASTERED','PAUSED'].includes(task.status)).length,
      masteredCount:related.filter(task=>task.status==='MASTERED').length,
    };
  });
}

export function dnaStrength(strands:Array<{progressPercent:number;progressSum?:number}>){
  return strands.length?Math.round(strands.reduce((sum,strand)=>sum+(strand.progressSum??strand.progressPercent*4),0)/(strands.length*4)):0;
}
