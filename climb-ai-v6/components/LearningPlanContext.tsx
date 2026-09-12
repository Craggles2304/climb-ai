'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {ILPTask} from '@/lib/types';
import {defaultILP} from '@/data/learning';
import {useAccount,matchesFor} from './AccountContext';
import {firstPlan,PROFILE_ACCOUNT_ID} from '@/lib/profile';
import {adaptILP,createCoachTask,rankTasks} from '@/lib/ilpEngine';
import {orderTasks,OrderedTask,orderingNote} from '@/lib/planOrder';
import {getBrowserClient} from '@/lib/supabase/client';

type CoachTaskInput={title:string;category:ILPTask['category'];why:string;gameRule:string;metric:string;target:string;source?:'COACH';priority?:number};
type Ctx={tasks:ILPTask[];ordering:OrderedTask[];orderNote:string;allTasks:Record<string,ILPTask[]>;addTask:(task:CoachTaskInput)=>void;replaceTask:(oldId:string,task:CoachTaskInput)=>void;pauseTask:(id:string)=>void;completeTask:(id:string)=>void;refreshFromMatches:()=>string[]};
const C=createContext<Ctx|null>(null);
const KEY='climb_ilp_v6';

async function persistCloud(accountId:string,tasks:ILPTask[]){
  if(accountId===PROFILE_ACCOUNT_ID||accountId.startsWith('acct-'))return;
  const client=await getBrowserClient();if(!client)return;
  const {data}=await client.auth.getUser();if(!data.user)return;
  const rows=tasks.map(task=>({user_id:data.user!.id,riot_account_id:accountId,id:task.id,payload:{...task,accountId},updated_at:new Date().toISOString()}));
  if(!rows.length)return;
  const {error}=await client.from('ilp_tasks').upsert(rows,{onConflict:'user_id,riot_account_id,id'});
  if(error)console.error('[ilp] cloud save failed',error);
}

export function LearningPlanProvider({children}:{children:React.ReactNode}){
  const {active,profile,authenticated,hydrated}=useAccount();
  const [allTasks,setAllTasks]=useState<Record<string,ILPTask[]>>(defaultILP);

  useEffect(()=>{
    const raw=localStorage.getItem(KEY);if(raw){try{setAllTasks(prev=>({...prev,...JSON.parse(raw)}))}catch{}}
  },[]);

  useEffect(()=>{
    if(!hydrated||!authenticated||active.id===PROFILE_ACCOUNT_ID||active.id.startsWith('acct-'))return;
    let cancelled=false;
    void (async()=>{
      const client=await getBrowserClient();if(!client)return;
      const {data:userData}=await client.auth.getUser();if(!userData.user)return;
      const result=await client.from('ilp_tasks').select('id,payload').eq('user_id',userData.user.id).eq('riot_account_id',active.id).order('updated_at',{ascending:true});
      if(cancelled)return;
      if(result.error){console.error('[ilp] cloud load failed',result.error);return}
      if(result.data?.length){
        const tasks=result.data.map((row:any)=>({...row.payload,id:row.id,accountId:active.id})) as ILPTask[];
        setAllTasks(prev=>({...prev,[active.id]:tasks}));
        return;
      }
      let seed:ILPTask[]=[];
      try{
        const legacy=JSON.parse(localStorage.getItem(KEY)||'{}') as Record<string,ILPTask[]>;
        const old=legacy[PROFILE_ACCOUNT_ID];
        if(active.isPrimary&&old?.length)seed=old.map(t=>({...t,accountId:active.id}));
      }catch{/* no legacy plan */}
      if(!seed.length&&active.isPrimary&&profile)seed=firstPlan({...profile,id:active.id});
      if(seed.length){setAllTasks(prev=>({...prev,[active.id]:seed}));await persistCloud(active.id,seed)}
    })();
    return ()=>{cancelled=true};
  },[active.id,active.isPrimary,authenticated,hydrated,profile]);

  const persist=(next:Record<string,ILPTask[]>)=>{
    setAllTasks(next);
    try{localStorage.setItem(KEY,JSON.stringify(next))}catch{/* private mode */}
    if(authenticated)void persistCloud(active.id,next[active.id]||[]);
  };

  const rawTasks=useMemo(()=>{
    const stored=allTasks[active.id];
    if(stored&&stored.length)return stored;
    if(profile&&active.isPrimary)return firstPlan({...profile,id:active.id});
    return [];
  },[allTasks,active.id,active.isPrimary,profile]);
  const ordering=useMemo(()=>orderTasks(rawTasks,matchesFor(active.id)),[rawTasks,active.id]);
  const tasks=useMemo(()=>ordering.map(o=>o.task),[ordering]);
  const orderNote=useMemo(()=>orderingNote(ordering),[ordering]);

  const addTask=(input:CoachTaskInput)=>{
    const current=[...(allTasks[active.id]||rawTasks)];const task=createCoachTask(active.id,input);const activeTasks=current.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED');let next=current;
    if(activeTasks.length>=5){const replaceable=rankTasks(activeTasks).reverse()[0];next=current.map(t=>t.id===replaceable.id?{...t,status:'PAUSED' as const,lastUpdatedReason:`Paused automatically to make room for Coach task: ${task.title}`}:t)}
    next=[...next,task];persist({...allTasks,[active.id]:next});
  };
  const replaceTask=(oldId:string,input:CoachTaskInput)=>{const task=createCoachTask(active.id,input);const current=allTasks[active.id]||rawTasks;persist({...allTasks,[active.id]:[...current.map(t=>t.id===oldId?{...t,status:'PAUSED' as const,lastUpdatedReason:`Paused and replaced by Coach task: ${task.title}`}:t),task]})};
  const pauseTask=(id:string)=>{const current=allTasks[active.id]||rawTasks;persist({...allTasks,[active.id]:current.map(t=>t.id===id?{...t,status:'PAUSED' as const,lastUpdatedReason:'Paused by player.'}:t)})};
  const completeTask=(id:string)=>{const current=allTasks[active.id]||rawTasks;persist({...allTasks,[active.id]:current.map(t=>t.id===id?{...t,progress:100,status:'MASTERED' as const,successfulGames:t.masteryRequired||3,lastUpdatedReason:'Marked mastered after reviewed evidence.'}:t)})};
  const refreshFromMatches=()=>{const current=allTasks[active.id]||rawTasks;const {tasks:adapted,changes}=adaptILP(current,matchesFor(active.id));persist({...allTasks,[active.id]:adapted});return changes};

  useEffect(()=>{
    if(!rawTasks.length)return;
    const {tasks:adapted}=adaptILP(rawTasks,matchesFor(active.id));
    const before=JSON.stringify(rawTasks.map(t=>[t.id,t.progress,t.status,t.successfulGames]));
    const after=JSON.stringify(adapted.map(t=>[t.id,t.progress,t.status,t.successfulGames]));
    if(before!==after){const next={...allTasks,[active.id]:adapted};setAllTasks(next);try{localStorage.setItem(KEY,JSON.stringify(next))}catch{};if(authenticated)void persistCloud(active.id,adapted)}
  },[active.id]);

  return <C.Provider value={{tasks,ordering,orderNote,allTasks,addTask,replaceTask,pauseTask,completeTask,refreshFromMatches}}>{children}</C.Provider>;
}
export function useLearningPlan(){const c=useContext(C);if(!c)throw new Error('useLearningPlan outside provider');return c}
