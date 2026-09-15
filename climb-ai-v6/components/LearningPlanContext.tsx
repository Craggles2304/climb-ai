'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {ILPTask,ILPMissionAttempt,Role} from '@/lib/types';
import {defaultILP} from '@/data/learning';
import {useAccount,matchesFor} from './AccountContext';
import {firstPlan,PROFILE_ACCOUNT_ID} from '@/lib/profile';
import {adaptAndRefill,createCoachTask,ensureFiveActive,rankTasks,reviseTaskFromCoach} from '@/lib/ilpEngine';
import {orderTasks,OrderedTask,orderingNote} from '@/lib/planOrder';
import {upsertMissionAttempt} from '@/lib/missionLoop';
import {getBrowserClient} from '@/lib/supabase/client';

type CoachTaskInput={title:string;category:ILPTask['category'];why:string;gameRule:string;metric:string;target:string;source?:'COACH';priority?:number};
type Ctx={tasks:ILPTask[];ordering:OrderedTask[];orderNote:string;allTasks:Record<string,ILPTask[]>;addTask:(task:CoachTaskInput)=>void;replaceTask:(oldId:string,task:CoachTaskInput)=>void;pauseTask:(id:string)=>void;completeTask:(id:string)=>void;recordMissionResult:(taskId:string,attempt:ILPMissionAttempt)=>void;refreshFromMatches:()=>string[]};
const C=createContext<Ctx|null>(null);
const KEY='climb_ilp_v6';
const isLive=(task:ILPTask)=>task.status!=='MASTERED'&&task.status!=='PAUSED';

function taskKey(task:ILPTask){return`${task.title.trim().toLowerCase()}::${task.metric.trim().toLowerCase()}::${task.category}`}
function taskFreshness(task:ILPTask){const history=Math.max(0,...(task.history??[]).map(entry=>Date.parse(entry.at)||0),...(task.missionHistory??[]).map(entry=>Date.parse(entry.at)||0));const stamp=Number(task.id.match(/(\d{12,})$/)?.[1]||0);return Math.max(history,stamp)}
function dedupeTasks(tasks:ILPTask[]){const map=new Map<string,ILPTask>();for(const task of tasks){const key=taskKey(task),existing=map.get(key);if(!existing||taskFreshness(task)>=taskFreshness(existing))map.set(key,task)}return[...map.values()]}
function normalisePlan(tasks:ILPTask[],matches:ReturnType<typeof matchesFor>,accountId:string,role:Role){
  let next=dedupeTasks(tasks);
  const live=next.filter(isLive);
  if(live.length>5){
    const ordered=orderTasks(live,matches).map(item=>item.task);const keep=new Set(ordered.slice(0,5).map(task=>task.id));
    next=next.map(task=>isLive(task)&&!keep.has(task.id)?{...task,status:'PAUSED' as const,lastUpdatedReason:'Paused automatically to keep the development plan capped at five active behaviours.',history:[...(task.history??[]),{at:new Date().toISOString(),type:'PAUSED' as const,note:'Retired from Active Five during plan cleanup.'}].slice(-12)}:task);
  }
  return ensureFiveActive(next,matches,accountId,role).tasks;
}

async function persistCloud(accountId:string,tasks:ILPTask[]){
  if(accountId===PROFILE_ACCOUNT_ID||accountId.startsWith('acct-'))return;
  const client=await getBrowserClient();if(!client)return;
  const {data}=await client.auth.getUser();if(!data.user)return;
  const userId=data.user.id;const rows=tasks.map(task=>({user_id:userId,riot_account_id:accountId,id:task.id,payload:{...task,accountId},updated_at:new Date().toISOString()}));if(!rows.length)return;
  const existing=await client.from('ilp_tasks').select('id').eq('user_id',userId).eq('riot_account_id',accountId);
  const {error}=await client.from('ilp_tasks').upsert(rows,{onConflict:'user_id,riot_account_id,id'});if(error){console.error('[ilp] cloud save failed',error);return}
  if(existing.error){console.error('[ilp] stale-row scan failed',existing.error);return}
  const keep=new Set(rows.map(row=>row.id));const stale=(existing.data??[]).map(row=>String(row.id)).filter(id=>!keep.has(id));
  if(stale.length){const removed=await client.from('ilp_tasks').delete().eq('user_id',userId).eq('riot_account_id',accountId).in('id',stale);if(removed.error)console.error('[ilp] stale-row cleanup failed',removed.error)}
}

export function LearningPlanProvider({children}:{children:React.ReactNode}){
  const {active,profile,authenticated,hydrated}=useAccount();const [allTasks,setAllTasks]=useState<Record<string,ILPTask[]>>(defaultILP);
  useEffect(()=>{const raw=localStorage.getItem(KEY);if(raw){try{setAllTasks(prev=>({...prev,...JSON.parse(raw)}))}catch{}}},[]);

  useEffect(()=>{
    if(!hydrated||!authenticated||active.id===PROFILE_ACCOUNT_ID||active.id.startsWith('acct-'))return;let cancelled=false;
    void (async()=>{
      const client=await getBrowserClient();if(!client)return;const {data:userData}=await client.auth.getUser();if(!userData.user)return;
      const result=await client.from('ilp_tasks').select('id,payload,updated_at').eq('user_id',userData.user.id).eq('riot_account_id',active.id).order('updated_at',{ascending:false});if(cancelled)return;
      if(result.error){console.error('[ilp] cloud load failed',result.error);return}
      if(result.data?.length){const loaded=result.data.map((row:any)=>({...row.payload,id:row.id,accountId:active.id})) as ILPTask[];const cleaned=normalisePlan(loaded,matchesFor(active.id),active.id,active.role);setAllTasks(prev=>{const next={...prev,[active.id]:cleaned};try{localStorage.setItem(KEY,JSON.stringify(next))}catch{};return next});await persistCloud(active.id,cleaned);return}
      let seed:ILPTask[]=[];try{const legacy=JSON.parse(localStorage.getItem(KEY)||'{}') as Record<string,ILPTask[]>;const old=legacy[PROFILE_ACCOUNT_ID];if(active.isPrimary&&old?.length)seed=old.map(t=>({...t,accountId:active.id}))}catch{}
      if(!seed.length&&active.isPrimary&&profile)seed=firstPlan({...profile,id:active.id});if(seed.length){const filled=normalisePlan(seed,matchesFor(active.id),active.id,active.role);setAllTasks(prev=>({...prev,[active.id]:filled}));await persistCloud(active.id,filled)}
    })();return()=>{cancelled=true};
  },[active.id,active.isPrimary,active.role,authenticated,hydrated,profile]);

  const rawTasks=useMemo(()=>{const stored=allTasks[active.id];if(stored&&stored.length)return stored;if(profile&&active.isPrimary)return firstPlan({...profile,id:active.id});return[]},[allTasks,active.id,active.isPrimary,profile]);
  const accountMatches=matchesFor(active.id);const matchSignature=accountMatches.slice(0,5).map(m=>m.id).join('|');
  const ordering=useMemo(()=>orderTasks(rawTasks,accountMatches),[rawTasks,matchSignature]);const tasks=useMemo(()=>ordering.map(o=>o.task),[ordering]);const orderNote=useMemo(()=>orderingNote(ordering),[ordering]);

  const persist=(next:Record<string,ILPTask[]>)=>{const cleaned=normalisePlan(next[active.id]||[],accountMatches,active.id,active.role);const final={...next,[active.id]:cleaned};setAllTasks(final);try{localStorage.setItem(KEY,JSON.stringify(final))}catch{};if(authenticated)void persistCloud(active.id,cleaned)};

  const addTask=(input:CoachTaskInput)=>{const current=[...(allTasks[active.id]||rawTasks)];const existing=current.find(t=>isLive(t)&&(t.title.toLowerCase()===input.title.toLowerCase()||(t.metric===input.metric&&t.category===input.category)));if(existing){persist({...allTasks,[active.id]:current.map(t=>t.id===existing.id?reviseTaskFromCoach(t,input):t)});return}const task=createCoachTask(active.id,input);const activeTasks=current.filter(isLive);let next=current;if(activeTasks.length>=5){const replaceable=rankTasks(activeTasks).reverse()[0];next=current.map(t=>t.id===replaceable.id?{...t,status:'PAUSED' as const,lastUpdatedReason:`Paused automatically because Coach promoted a higher-priority behaviour: ${task.title}`,history:[...(t.history||[]),{at:new Date().toISOString(),type:'PAUSED' as const,note:`Replaced by Coach mission: ${task.title}`}].slice(-12)}:t)}persist({...allTasks,[active.id]:[...next,task]})};
  const replaceTask=(oldId:string,input:CoachTaskInput)=>{const task=createCoachTask(active.id,input);const current=allTasks[active.id]||rawTasks;persist({...allTasks,[active.id]:[...current.map(t=>t.id===oldId?{...t,status:'PAUSED' as const,lastUpdatedReason:`Paused and replaced by Coach task: ${task.title}`,history:[...(t.history||[]),{at:new Date().toISOString(),type:'PAUSED' as const,note:`Replaced by Coach mission: ${task.title}`}].slice(-12)}:t),task]})};
  const pauseTask=(id:string)=>{const current=allTasks[active.id]||rawTasks;persist({...allTasks,[active.id]:current.map(t=>t.id===id?{...t,status:'PAUSED' as const,lastUpdatedReason:'Paused by player.',history:[...(t.history||[]),{at:new Date().toISOString(),type:'PAUSED' as const,note:'Paused by player.'}].slice(-12)}:t)})};
  const completeTask=(id:string)=>{const current=allTasks[active.id]||rawTasks;persist({...allTasks,[active.id]:current.map(t=>t.id===id?{...t,progress:100,metricProgress:100,missionProgress:100,status:'MASTERED' as const,successfulGames:t.masteryRequired||3,lastUpdatedReason:'Marked mastered after reviewed evidence.',history:[...(t.history||[]),{at:new Date().toISOString(),type:'MASTERED' as const,note:'Marked mastered after reviewed evidence.'}].slice(-12)}:t)})};
  const recordMissionResult=(taskId:string,attempt:ILPMissionAttempt)=>{const current=allTasks[active.id]||rawTasks;const withRep=current.map(task=>task.id===taskId?upsertMissionAttempt(task,attempt):task);const {tasks:adapted}=adaptAndRefill(withRep,accountMatches,active.id,active.role);persist({...allTasks,[active.id]:adapted})};
  const refreshFromMatches=()=>{const current=allTasks[active.id]||rawTasks;const {tasks:adapted,changes}=adaptAndRefill(current,accountMatches,active.id,active.role);persist({...allTasks,[active.id]:adapted});return changes};

  useEffect(()=>{if(!rawTasks.length)return;const {tasks:adapted}=adaptAndRefill(rawTasks,accountMatches,active.id,active.role);const cleaned=normalisePlan(adapted,accountMatches,active.id,active.role);const shape=(list:ILPTask[])=>JSON.stringify(list.map(t=>[t.id,t.progress,t.metricProgress,t.missionProgress,t.status,t.successfulGames,t.gamesObserved,t.title,t.gameRule,(t.missionHistory??[]).map(a=>[a.matchId,a.outcome,a.adherence,a.clearedBar])]));if(shape(rawTasks)!==shape(cleaned)){const next={...allTasks,[active.id]:cleaned};setAllTasks(next);try{localStorage.setItem(KEY,JSON.stringify(next))}catch{};if(authenticated)void persistCloud(active.id,cleaned)}},[active.id,active.role,matchSignature,rawTasks.length]);

  return <C.Provider value={{tasks,ordering,orderNote,allTasks,addTask,replaceTask,pauseTask,completeTask,recordMissionResult,refreshFromMatches}}>{children}</C.Provider>;
}
export function useLearningPlan(){const c=useContext(C);if(!c)throw new Error('useLearningPlan outside provider');return c}
