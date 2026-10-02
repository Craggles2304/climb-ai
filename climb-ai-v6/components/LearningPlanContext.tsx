'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {ILPTask,ILPMissionAttempt,Role} from '@/lib/types';
import {defaultILP} from '@/data/learning';
import {useAccount,matchesFor} from './AccountContext';
import {firstPlan,PROFILE_ACCOUNT_ID} from '@/lib/profile';
import {ACTIVE_PLAN_SIZE,adaptAndRefill,createCoachTask,isGameMeasurableTask,rankTasks,reviseTaskFromCoach} from '@/lib/ilpEngine';
import {orderTasks,OrderedTask,orderingNote} from '@/lib/planOrder';
import {getBrowserClient} from '@/lib/supabase/client';
import {mergeIlpCloudSnapshot,taskFreshness,type CloudIlpRow} from '@/lib/ilpCloudMerge';
import {stampLegacyTaskScope,taskAppliesToRole} from '@/lib/roleAwareLearning';
import {dnaDomainForTask,ensureDnaDomain} from '@/lib/dnaDomain';
import {ensureOneMissionPerDnaStrand,isDnaStrandMission} from '@/lib/dnaStrandMissions';

type CoachTaskInput={title:string;category:ILPTask['category'];why:string;gameRule:string;metric:string;target:string;source?:'COACH';priority?:number};
type Ctx={tasks:ILPTask[];ordering:OrderedTask[];orderNote:string;allTasks:Record<string,ILPTask[]>;planReady:boolean;planError:string|null;addTask:(task:CoachTaskInput)=>void;replaceTask:(oldId:string,task:CoachTaskInput)=>void;pauseTask:(id:string)=>void;completeTask:(id:string)=>void;recordMissionResult:(taskId:string,attempt:ILPMissionAttempt)=>void;refreshFromMatches:()=>string[]};
const C=createContext<Ctx|null>(null);const KEY='climb_ilp_v6';const isLive=(task:ILPTask)=>task.status!=='MASTERED'&&task.status!=='PAUSED';
function taskKey(task:ILPTask){return`${task.title.trim().toLowerCase()}::${task.metric.trim().toLowerCase()}::${task.dnaDomain}::${task.category}::${task.roleScope??'LEGACY'}`}
function dedupeTasks(tasks:ILPTask[]){const map=new Map<string,ILPTask>();for(const task of tasks){const key=taskKey(task),existing=map.get(key);if(!existing||taskFreshness(task)>=taskFreshness(existing))map.set(key,task)}return[...map.values()]}
function matchesForRole(matches:ReturnType<typeof matchesFor>,role:Role){return matches.filter(match=>match.role===role)}
function stampRole(task:ILPTask,role:Role):ILPTask{return task.roleScope?task:{...task,roleScope:role,roleEvidence:[role]}}
function normalisePlan(tasks:ILPTask[],matches:ReturnType<typeof matchesFor>,accountId:string,role:Role,rank?:string|null){
  const stamped=dedupeTasks(tasks.map(task=>ensureDnaDomain(task as ILPTask&{dnaDomain?:ILPTask['dnaDomain']}))).map(task=>stampLegacyTaskScope(task,role));
  const relevant=stamped.filter(task=>taskAppliesToRole(task,role));
  const foreign=stamped.filter(task=>!taskAppliesToRole(task,role));
  const roleMatches=matchesForRole(matches,role);
  const measurable=[...relevant].map(task=>isLive(task)&&!isDnaStrandMission(task)&&!isGameMeasurableTask(task,roleMatches)
    ?{...task,status:'PAUSED' as const,lastUpdatedReason:'Paused automatically because this legacy mission cannot be proved from tracked match data.',history:[...(task.history??[]),{at:new Date().toISOString(),type:'PAUSED' as const,note:'Archived before the six-strand DNA mission plan was built.'}].slice(-12)}
    :task);
  const strandPlan=ensureOneMissionPerDnaStrand(measurable,accountId,role);
  return[...foreign,...strandPlan.tasks.map(task=>stampRole(task,role))];
}

async function loadCloudRows(accountId:string):Promise<CloudIlpRow[]|null>{
  try{
    const response=await fetch(`/api/ilp/plan?accountId=${encodeURIComponent(accountId)}`,{cache:'no-store'});
    const body=await response.json().catch(()=>null);
    if(!response.ok){
      console.error('[ilp] server plan load failed',body?.error||response.status);
      return null;
    }
    return Array.isArray(body?.rows)?body.rows as CloudIlpRow[]:[];
  }catch(error){
    console.error('[ilp] server plan load failed',error);
    return null;
  }
}
function adaptRolePlan(tasks:ILPTask[],matches:ReturnType<typeof matchesFor>,accountId:string,role:Role,rank?:string|null){
  const stamped=dedupeTasks(tasks).map(task=>stampLegacyTaskScope(task,role));
  const relevant=stamped.filter(task=>taskAppliesToRole(task,role));
  const foreign=stamped.filter(task=>!taskAppliesToRole(task,role));
  const roleMatches=matchesForRole(matches,role);
  const adapted=adaptAndRefill(relevant,roleMatches,accountId,role,rank);
  return{tasks:[...foreign,...adapted.tasks.map(task=>stampRole(task,role))],changes:adapted.changes};
}
async function persistCloud(accountId:string,tasks:ILPTask[]):Promise<ILPTask[]|null>{
  if(accountId===PROFILE_ACCOUNT_ID||accountId.startsWith('acct-'))return tasks;
  const client=await getBrowserClient();if(!client)return null;
  const {data}=await client.auth.getUser();if(!data.user)return null;
  const userId=data.user.id;
  const existing=await client.from('ilp_tasks').select('id,payload,updated_at').eq('user_id',userId).eq('riot_account_id',accountId);
  if(existing.error){console.error('[ilp] cloud reconciliation failed',existing.error);return null}
  const reconciled=mergeIlpCloudSnapshot(tasks,(existing.data??[]) as CloudIlpRow[],accountId);
  if(!reconciled.writes.length)return reconciled.tasks;
  const now=new Date().toISOString();
  const rows=reconciled.writes.map(task=>({user_id:userId,riot_account_id:accountId,id:task.id,payload:{...task,accountId},updated_at:now}));
  const {error}=await client.from('ilp_tasks').upsert(rows,{onConflict:'user_id,riot_account_id,id'});
  if(error){console.error('[ilp] cloud save failed',error);return null}
  return reconciled.tasks;
}
export function LearningPlanProvider({children}:{children:React.ReactNode}){const {active,profile,authenticated,hydrated}=useAccount();const [allTasks,setAllTasks]=useState<Record<string,ILPTask[]>>({});const [planError,setPlanError]=useState<string|null>(null);
const accountMatches=matchesFor(active.id);const roleAccountMatches=accountMatches.filter(match=>match.role===active.role);const matchSignature=roleAccountMatches.slice(0,5).map(m=>m.id).join('|');
const refreshCloudNow=useCallback(async()=>{if(!hydrated||!authenticated||active.id===PROFILE_ACCOUNT_ID||active.id.startsWith('acct-'))return;const rows=await loadCloudRows(active.id);if(rows===null)return;const loaded=rows.map((row:any)=>({...row.payload,id:row.id,accountId:active.id})) as ILPTask[];const cleaned=loaded.length?normalisePlan(loaded,matchesFor(active.id),active.id,active.role,active.rank):[];setPlanError(null);setAllTasks(prev=>({...prev,[active.id]:cleaned}))},[active.id,active.role,active.rank,authenticated,hydrated]);
useEffect(()=>{if(!hydrated||authenticated)return;try{const raw=localStorage.getItem(KEY);setAllTasks(raw?JSON.parse(raw):defaultILP)}catch{setAllTasks(defaultILP)}},[authenticated,hydrated]);
useEffect(()=>{if(!hydrated||!authenticated)return;setAllTasks({})},[authenticated,hydrated]);
useEffect(()=>{if(!hydrated||!authenticated||active.id===PROFILE_ACCOUNT_ID||active.id.startsWith('acct-'))return;let cancelled=false;setPlanError(null);void(async()=>{const rows=await loadCloudRows(active.id);if(cancelled)return;if(rows===null){setPlanError('Your mission plan could not be loaded. Refresh the page to retry.');return}if(rows.length){const loaded=rows.map((row:any)=>({...row.payload,id:row.id,accountId:active.id})) as ILPTask[];const cleaned=normalisePlan(loaded,matchesFor(active.id),active.id,active.role,active.rank);const cloud=await persistCloud(active.id,cleaned);if(cancelled)return;const final=normalisePlan(cloud??cleaned,matchesFor(active.id),active.id,active.role,active.rank);setPlanError(null);setAllTasks(prev=>({...prev,[active.id]:final}));return}const seed=active.isPrimary&&profile?firstPlan({...profile,id:active.id}):[];if(seed.length){const filled=normalisePlan(seed,matchesFor(active.id),active.id,active.role,active.rank);const cloud=await persistCloud(active.id,filled);if(cancelled)return;setPlanError(null);setAllTasks(prev=>({...prev,[active.id]:normalisePlan(cloud??filled,matchesFor(active.id),active.id,active.role,active.rank)}));return}setPlanError(null);setAllTasks(prev=>({...prev,[active.id]:[]}))})();return()=>{cancelled=true}},[active.id,active.isPrimary,active.role,active.rank,authenticated,hydrated,profile]);
useEffect(()=>{if(!hydrated||!authenticated||!matchSignature||active.id===PROFILE_ACCOUNT_ID||active.id.startsWith('acct-'))return;let cancelled=false;const pull=()=>{if(!cancelled)void refreshCloudNow()};pull();const retry1=setTimeout(pull,2500),retry2=setTimeout(pull,7000),retry3=setTimeout(pull,14000);return()=>{cancelled=true;clearTimeout(retry1);clearTimeout(retry2);clearTimeout(retry3)}},[active.id,authenticated,hydrated,matchSignature,refreshCloudNow]);
useEffect(()=>{if(!hydrated||!authenticated||active.id===PROFILE_ACCOUNT_ID||active.id.startsWith('acct-'))return;const pull=()=>{if(document.visibilityState==='visible')void refreshCloudNow()};const onFocus=()=>void refreshCloudNow();window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',pull);return()=>{window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',pull)}},[active.id,authenticated,hydrated,refreshCloudNow]);
const rawTasks=useMemo(()=>{const stored=allTasks[active.id];if(stored&&stored.length)return stored;if(!authenticated&&profile&&active.isPrimary)return firstPlan({...profile,id:active.id});return[]},[allTasks,active.id,active.isPrimary,authenticated,profile]);const planReady=hydrated&&(!authenticated||Object.prototype.hasOwnProperty.call(allTasks,active.id));const visibleTasks=useMemo(()=>rawTasks.filter(task=>taskAppliesToRole(task,active.role)),[rawTasks,active.role]);const ordering=useMemo(()=>orderTasks(visibleTasks,roleAccountMatches,active.rank),[visibleTasks,matchSignature,active.rank]);const tasks=useMemo(()=>ordering.map(o=>o.task),[ordering]);const orderNote=useMemo(()=>orderingNote(ordering),[ordering]);
const persist=(next:Record<string,ILPTask[]>)=>{const cleaned=normalisePlan(next[active.id]||[],accountMatches,active.id,active.role,active.rank);const final={...next,[active.id]:cleaned};setAllTasks(final);if(authenticated){const accountId=active.id,role=active.role;void persistCloud(accountId,cleaned).then(cloud=>{if(!cloud)return;const reconciled=normalisePlan(cloud,matchesFor(accountId),accountId,role,active.rank);setAllTasks(prev=>({...prev,[accountId]:reconciled}))})}else{try{localStorage.setItem(KEY,JSON.stringify(final))}catch{}}};