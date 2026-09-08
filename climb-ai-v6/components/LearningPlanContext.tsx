'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {ILPTask} from '@/lib/types';
import {defaultILP} from '@/data/learning';
import {useAccount,matchesFor} from './AccountContext';
import {adaptILP,createCoachTask,rankTasks} from '@/lib/ilpEngine';

type CoachTaskInput={title:string;category:ILPTask['category'];why:string;gameRule:string;metric:string;target:string;source?:'COACH';priority?:number};
type Ctx={tasks:ILPTask[];allTasks:Record<string,ILPTask[]>;addTask:(task:CoachTaskInput)=>void;replaceTask:(oldId:string,task:CoachTaskInput)=>void;pauseTask:(id:string)=>void;completeTask:(id:string)=>void;refreshFromMatches:()=>string[]};
const C=createContext<Ctx|null>(null);
const KEY='climb_ilp_v6';
export function LearningPlanProvider({children}:{children:React.ReactNode}){
 const {active}=useAccount();const [allTasks,setAllTasks]=useState<Record<string,ILPTask[]>>(defaultILP);
 useEffect(()=>{const raw=localStorage.getItem(KEY);if(raw){try{setAllTasks(JSON.parse(raw))}catch{}}},[]);
 const persist=(next:Record<string,ILPTask[]>)=>{setAllTasks(next);localStorage.setItem(KEY,JSON.stringify(next))};
 const rawTasks=useMemo(()=>allTasks[active.id]||[],[allTasks,active.id]);
 const tasks=useMemo(()=>rankTasks(rawTasks),[rawTasks]);
 const addTask=(input:CoachTaskInput)=>{const current=[...(allTasks[active.id]||[])];const task=createCoachTask(active.id,input);const activeTasks=current.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED');let next=current;if(activeTasks.length>=5){const replaceable=rankTasks(activeTasks).reverse()[0];next=current.map(t=>t.id===replaceable.id?{...t,status:'PAUSED' as const,lastUpdatedReason:`Paused automatically to make room for Coach task: ${task.title}`} : t);}
   next=[...next,task];persist({...allTasks,[active.id]:next});};
 const replaceTask=(oldId:string,input:CoachTaskInput)=>{const task=createCoachTask(active.id,input);const current=allTasks[active.id]||[];persist({...allTasks,[active.id]:[...current.map(t=>t.id===oldId?{...t,status:'PAUSED' as const,lastUpdatedReason:`Paused and replaced by Coach task: ${task.title}`} : t),task]})};
 const pauseTask=(id:string)=>{const current=allTasks[active.id]||[];persist({...allTasks,[active.id]:current.map(t=>t.id===id?{...t,status:'PAUSED' as const,lastUpdatedReason:'Paused by player.'}:t)})};
 const completeTask=(id:string)=>{const current=allTasks[active.id]||[];persist({...allTasks,[active.id]:current.map(t=>t.id===id?{...t,progress:100,status:'MASTERED' as const,successfulGames:t.masteryRequired||3,lastUpdatedReason:'Marked mastered after reviewed evidence.'}:t)})};
 const refreshFromMatches=()=>{const current=allTasks[active.id]||[];const {tasks:adapted,changes}=adaptILP(current,matchesFor(active.id));persist({...allTasks,[active.id]:adapted});return changes};
 useEffect(()=>{if(!rawTasks.length)return;const {tasks:adapted}=adaptILP(rawTasks,matchesFor(active.id));const before=JSON.stringify(rawTasks.map(t=>[t.id,t.progress,t.status,t.successfulGames]));const after=JSON.stringify(adapted.map(t=>[t.id,t.progress,t.status,t.successfulGames]));if(before!==after){const next={...allTasks,[active.id]:adapted};setAllTasks(next);localStorage.setItem(KEY,JSON.stringify(next));}},[active.id]);
 return <C.Provider value={{tasks,allTasks,addTask,replaceTask,pauseTask,completeTask,refreshFromMatches}}>{children}</C.Provider>}
export function useLearningPlan(){const c=useContext(C);if(!c)throw new Error('useLearningPlan outside provider');return c}
