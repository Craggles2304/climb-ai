import type {DnaDomain,ILPTask,Role} from './types';
import {DNA_DOMAINS,DNA_DOMAIN_COLORS,DNA_DOMAIN_GENE,DNA_DOMAIN_LABELS,ensureDnaDomain} from './dnaDomain';
import {missionSummary} from './missionLoop';
import {verifiedMissionRep} from './verifiedMissionProof';
import {taskFreshness} from './ilpCloudMerge';
import {stampLegacyTaskScope,taskAppliesToRole} from './roleAwareLearning';
import {dnaStrandLevel} from './dnaLevel';

type DnaTask=ILPTask&{updatedAt?:string|null};

export type GameDnaClientMission={
  c:'lane'|'wave'|'vision'|'obj'|'fight'|'mind';
  n:string;
  s:0|1|2|3;
  p:number;
  level:number;
  levelProgress:number;
  xpIntoLevel:number;
  xpForNextLevel:number;
};

export type GameDnaStrand={
  domain:DnaDomain;
  label:string;
  color:string;
  progress:number;
  activeCount:number;
  mastered:number;
  level:number;
  levelProgress:number;
  totalXp:number;
  xpIntoLevel:number;
  xpForNextLevel:number;
};

function live(task:ILPTask){
  const status=String(task.status||'ACTIVE').toUpperCase();
  return status!=='MASTERED'&&status!=='PAUSED';
}

function semanticKey(task:ILPTask){
  return [
    task.title.trim().toLowerCase(),
    task.metric.trim().toLowerCase(),
    task.dnaDomain,
    task.category,
    task.roleScope??'LEGACY',
  ].join('::');
}

function updatedStamp(task:DnaTask){
  const parsed=Date.parse(String(task.updatedAt??''));
  return Number.isFinite(parsed)?parsed:0;
}

function freshness(task:DnaTask){
  return Math.max(taskFreshness(task),updatedStamp(task));
}

function statusWeight(task:ILPTask){
  const status=String(task.status||'ACTIVE').toUpperCase();
  if(status==='MASTERED')return 3;
  if(status==='PAUSED')return 1;
  return 2;
}

export function canonicalGameDnaTasks(input:DnaTask[],role:Role|null|undefined){
  const byKey=new Map<string,DnaTask>();
  for(const raw of input){
    if(!raw?.id)continue;
    const withDomain=ensureDnaDomain(raw as ILPTask&{dnaDomain?:DnaDomain}) as DnaTask;
    const scoped=(role?stampLegacyTaskScope(withDomain,role):withDomain) as DnaTask;
    if(!taskAppliesToRole(scoped,role))continue;
    const key=semanticKey(scoped);
    const existing=byKey.get(key);
    if(!existing||freshness(scoped)>=freshness(existing))byKey.set(key,scoped);
  }
  return [...byKey.values()].sort((a,b)=>
    statusWeight(b)-statusWeight(a)||
    freshness(b)-freshness(a)||
    (Number(b.priority)||50)-(Number(a.priority)||50)||
    a.title.localeCompare(b.title)
  );
}

function currentForDomain(tasks:DnaTask[],domain:DnaDomain){
  return tasks
    .filter(task=>task.dnaDomain===domain&&live(task))
    .sort((a,b)=>(Number(b.priority)||50)-(Number(a.priority)||50)||freshness(b)-freshness(a))[0]??null;
}

export function currentGameDnaMissions(input:DnaTask[],role:Role|null|undefined){
  const tasks=canonicalGameDnaTasks(input,role);
  return DNA_DOMAINS.map(domain=>({domain,task:currentForDomain(tasks,domain)}));
}


function focusScore(task:ILPTask){
  const attempts=[...(task.missionHistory??[])].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  const latest=attempts[0];
  const state=latest?(verifiedMissionRep(task,latest)?'BANKED':latest.evidenceV2?.state==='MISSED'?'MISSED':'NOT_OBSERVED'):null;
  const observed=Number(latest?.evidenceV2?.observedValue);
  const summary=missionSummary(task);
  let score=state==='MISSED'?500:!latest?320:state==='NOT_OBSERVED'?180:120;
  if(Number.isFinite(observed))score+=Math.max(0,100-observed)*2;
  if(summary.confirmed>0&&summary.confirmed<summary.required)score+=summary.confirmed*28;
  score+=(Number(task.priority)||50)/100;
  return score;
}

export function recommendedGameMissionFocusPair(input:DnaTask[],role:Role|null|undefined){
  return currentGameDnaMissions(input,role)
    .filter((row):row is {domain:DnaDomain;task:DnaTask}=>Boolean(row.task))
    .sort((a,b)=>focusScore(b.task)-focusScore(a.task)||DNA_DOMAINS.indexOf(a.domain)-DNA_DOMAINS.indexOf(b.domain))
    .slice(0,2);
}

export function unlockedDnaDomains(input:DnaTask[],role:Role|null|undefined){
  return currentGameDnaMissions(input,role)
    .filter((row):row is {domain:DnaDomain;task:DnaTask}=>Boolean(row.task?.dnaFocusUnlocked))
    .map(row=>row.domain);
}

export function gameMissionFocusPair(input:DnaTask[],role:Role|null|undefined){
  const rows=currentGameDnaMissions(input,role)
    .filter((row):row is {domain:DnaDomain;task:DnaTask}=>Boolean(row.task));
  const unlocked=rows.filter(row=>row.task.dnaFocusUnlocked===true);
  if(unlocked.length===2){
    return unlocked.sort((a,b)=>focusScore(b.task)-focusScore(a.task)||DNA_DOMAINS.indexOf(a.domain)-DNA_DOMAINS.indexOf(b.domain));
  }
  return recommendedGameMissionFocusPair(input,role);
}

export function gameDnaClientMissions(input:DnaTask[],role:Role|null|undefined):GameDnaClientMission[]{
  const tasks=canonicalGameDnaTasks(input,role);
  const rows=DNA_DOMAINS.map(domain=>({domain,task:currentForDomain(tasks,domain)}));
  return rows.map(({domain,task})=>{
    const reps=task?missionRepView(task):{confirmed:0,required:3,progress:0};
    const level=dnaStrandLevel(tasks,domain,role);
    return{
      c:DNA_DOMAIN_GENE[domain],
      n:task?.title??`Awaiting next ${DNA_DOMAIN_LABELS[domain]} mission`,
      s:task?(task.status==='MASTERED'?3:reps.confirmed>=reps.required?2:1):0,
      p:reps.progress,
      level:level.level,
      levelProgress:level.levelProgress,
      xpIntoLevel:level.xpIntoLevel,
      xpForNextLevel:level.xpForNextLevel,
    };
  });
}

export function gameDnaStrands(input:DnaTask[],role:Role|null|undefined,baselineReady:boolean):GameDnaStrand[]{
  const tasks=canonicalGameDnaTasks(input,role);
  return DNA_DOMAINS.map(domain=>{
    const task=currentForDomain(tasks,domain);
    const reps=task?missionRepView(task):{confirmed:0,required:3,progress:0};
    const domainTasks=tasks.filter(row=>row.dnaDomain===domain);
    const level=dnaStrandLevel(tasks,domain,role);
    return{
      domain,
      label:DNA_DOMAIN_LABELS[domain],
      color:DNA_DOMAIN_COLORS[domain],
      progress:baselineReady?reps.progress:0,
      activeCount:task?1:0,
      mastered:domainTasks.filter(row=>String(row.status).toUpperCase()==='MASTERED').length,
      level:baselineReady?level.level:1,
      levelProgress:baselineReady?level.levelProgress:0,
      totalXp:baselineReady?level.totalXp:0,
      xpIntoLevel:baselineReady?level.xpIntoLevel:0,
      xpForNextLevel:level.xpForNextLevel,
    };
  });
}

export function activeGameDnaMissions(input:DnaTask[],role:Role|null|undefined){
  return currentGameDnaMissions(input,role)
    .flatMap(({task})=>task?[task]:[]);
}

export function missionRepView(task:ILPTask){
  const summary=missionSummary(task);
  const confirmed=Math.max(0,Number(summary.confirmed)||0);
  const required=Math.max(1,Number(summary.required)||3);
  return{
    confirmed,
    required,
    progress:Math.round(Math.min(required,confirmed)/required*100),
  };
}