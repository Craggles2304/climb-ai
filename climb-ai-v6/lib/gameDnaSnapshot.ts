import type {DnaDomain,ILPTask,Role} from './types';
import {DNA_DOMAINS,DNA_DOMAIN_COLORS,DNA_DOMAIN_GENE,DNA_DOMAIN_LABELS,ensureDnaDomain} from './dnaDomain';
import {missionSummary} from './missionLoop';
import {taskFreshness} from './ilpCloudMerge';
import {stampLegacyTaskScope,taskAppliesToRole} from './roleAwareLearning';

type DnaTask=ILPTask&{updatedAt?:string|null};

export type GameDnaClientMission={
  c:'lane'|'wave'|'vision'|'obj'|'fight'|'mind';
  n:string;
  s:0|1|2|3;
  p:number;
};

export type GameDnaStrand={
  domain:DnaDomain;
  label:string;
  color:string;
  progress:number;
  activeCount:number;
  mastered:number;
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

export function gameDnaClientMissions(input:DnaTask[],role:Role|null|undefined):GameDnaClientMission[]{
  const rows=currentGameDnaMissions(input,role);
  return rows.map(({domain,task})=>{
    const reps=task?missionRepView(task):{confirmed:0,required:3,progress:0};
    return{
      c:DNA_DOMAIN_GENE[domain],
      n:task?.title??`Awaiting next ${DNA_DOMAIN_LABELS[domain]} mission`,
      s:task?(task.status==='MASTERED'?3:reps.confirmed>=reps.required?2:1):0,
      p:reps.progress,
    };
  });
}

export function gameDnaStrands(input:DnaTask[],role:Role|null|undefined,baselineReady:boolean):GameDnaStrand[]{
  const tasks=canonicalGameDnaTasks(input,role);
  return DNA_DOMAINS.map(domain=>{
    const task=currentForDomain(tasks,domain);
    const reps=task?missionRepView(task):{confirmed:0,required:3,progress:0};
    const domainTasks=tasks.filter(row=>row.dnaDomain===domain);
    return{
      domain,
      label:DNA_DOMAIN_LABELS[domain],
      color:DNA_DOMAIN_COLORS[domain],
      progress:baselineReady?reps.progress:0,
      activeCount:task?1:0,
      mastered:domainTasks.filter(row=>String(row.status).toUpperCase()==='MASTERED').length,
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