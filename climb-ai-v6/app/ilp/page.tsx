'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {AnimatedBar} from '@/components/Motion';
import {IlpExplainability} from '@/components/IlpExplainability';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {missionSummary} from '@/lib/missionLoop';
import type {ILPTask} from '@/lib/types';

type Tab='CURRENT'|'EVIDENCE'|'HISTORY';
const clean=(value:string)=>value.replaceAll('_',' ');

export default function PlayerDevelopmentCentre(){
  const {active}=useAccount();
  const {tasks,refreshFromMatches,pauseTask}=useLearningPlan();
  const [tab,setTab]=useState<Tab>('CURRENT');
  const [changes,setChanges]=useState<string[]>([]);

  const activeTasks=useMemo(
    ()=>tasks.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED').slice(0,2),
    [tasks],
  );
  const mastered=useMemo(()=>tasks.filter(task=>task.status==='MASTERED'),[tasks]);
  const paused=useMemo(()=>tasks.filter(task=>task.status==='PAUSED'),[tasks]);
  const matches=matchesFor(active.id).filter(match=>match.role===active.role);

  const planProgress=activeTasks.length
    ?Math.round(activeTasks.reduce((sum,task)=>sum+task.progress,0)/activeTasks.length)
    :0;
  const banked=activeTasks.reduce((sum,task)=>sum+missionSummary(task).confirmed,0);
  const required=activeTasks.reduce((sum,task)=>sum+missionSummary(task).required,0);
  const refresh=()=>setChanges(refreshFromMatches());

  return <AppShell>
    <section className="ip-head">
      <div>
        <div className="eyebrow">PLAYER DEVELOPMENT PLAN</div>
        <h1>Two things. Until they stick.</h1>
        <p>{active.gameName}{active.tagline} · {active.rank} · <b>{active.role}</b></p>
      </div>
      <button className="btn secondary" type="button" onClick={refresh}>CHECK NEW GAMES</button>
    </section>

    <section className="ip-summary">
      <div className="ip-summary-main">
        <span>CURRENT PLAN</span>
        <b>{activeTasks.length}/2 ACTIVE</b>
        <small>{matches.length} {active.role.toLowerCase()} games feeding this plan</small>
      </div>
      <div><span>CLEAN REPS</span><b>{banked}/{required||6}</b><small>evidence banked</small></div>
      <div><span>MASTERED</span><b>{mastered.length}</b><small>habits retired</small></div>
      <div><span>PLAN</span><b>{planProgress}%</b><small>mission progress</small></div>
    </section>

    {changes.length>0&&<section className="ip-update">
      <div><span>PLAN UPDATED</span><b>{changes.length} CHANGE{changes.length===1?'':'S'}</b></div>
      <details open><summary>WHAT CHANGED</summary>{changes.map(change=><p key={change}>{change}</p>)}</details>
    </section>}

    <nav className="ip-tabs" aria-label="Development plan sections">
      <button type="button" className={tab==='CURRENT'?'active':''} onClick={()=>setTab('CURRENT')}><b>CURRENT PLAN</b><small>{activeTasks.length} missions</small></button>
      <button type="button" className={tab==='EVIDENCE'?'active':''} onClick={()=>setTab('EVIDENCE')}><b>EVIDENCE</b><small>why these are here</small></button>
      <button type="button" className={tab==='HISTORY'?'active':''} onClick={()=>setTab('HISTORY')}><b>HISTORY</b><small>{mastered.length} mastered · {paused.length} paused</small></button>
    </nav>

    {tab==='CURRENT'&&<div className="ip-panel">
      {activeTasks.length?<div className="ip-mission-grid">
        {activeTasks.map((task,index)=><MissionCard key={task.id} task={task} index={index} pauseTask={pauseTask}/>)}
      </div>:<section className="ip-empty">
        <div className="eyebrow">PLAN BUILDING</div>
        <h2>Play a tracked game.</h2>
        <p>OP CLIMB needs real evidence before it chooses the two behaviours worth training.</p>
        <Link className="btn primary" href="/live">OPEN COMPANION →</Link>
      </section>}

      {activeTasks.length>0&&<section className="ip-next">
        <div>
          <span>HOW THE PLAN MOVES</span>
          <h2>Master one. Replace one.</h2>
          <p>When repeated evidence proves a mission has stuck, it leaves the active plan and the next recurring limiter takes its place. One unusual game does not rewrite your plan.</p>
        </div>
        <div className="ip-next-actions">
          <Link className="btn primary" href="/session">START 3-GAME BLOCK →</Link>
          <Link className="btn secondary" href="/live">OPEN TRACKING</Link>
        </div>
      </section>}
    </div>}

    {tab==='EVIDENCE'&&<div className="ip-panel">
      {activeTasks.length?<div className="ip-evidence-grid">
        {activeTasks.map((task,index)=><EvidenceCard key={task.id} task={task} index={index}/>)}
      </div>:<section className="ip-empty"><h2>No active evidence yet.</h2><p>Play tracked games to build the plan.</p></section>}
    </div>}

    {tab==='HISTORY'&&<div className="ip-panel">
      <section className="ip-history-grid">
        <Archive title="MASTERED" empty="Nothing mastered yet." tasks={mastered}/>
        <Archive title="PAUSED" empty="No paused missions." tasks={paused}/>
      </section>
    </div>}
  </AppShell>;
}

function MissionCard({task,index,pauseTask}:{task:ILPTask;index:number;pauseTask:(id:string)=>void}){
  const plain=plainLanguageFocus(task);
  const summary=missionSummary(task);
  return <article className={'ip-mission '+(index===0?'primary':'secondary')}>
    <div className="ip-mission-top">
      <span>MISSION 0{index+1}</span>
      <em>{clean(task.category)}</em>
    </div>
    <h2>{task.title}</h2>
    <p className="ip-meaning">{firstSentence(plain.meaning)}</p>

    <div className="ip-rule">
      <span>TAKE INTO YOUR NEXT GAME</span>
      <b>{plain.nextGame}</b>
    </div>

    <div className="ip-target">
      <div><span>PROOF BAR</span><b>{task.target}</b></div>
      <div><span>STAGE</span><b>{summary.stage}</b></div>
    </div>

    <div className="ip-progress">
      <div><AnimatedBar value={task.progress}/><b>{task.progress}%</b></div>
      <Pips passes={summary.confirmed} required={summary.required}/>
      <small>{summary.confirmed}/{summary.required} clean reps · {summary.remaining?summary.remaining+' still needed':'ready for mastery check'}</small>
    </div>

    <details className="ip-mission-details">
      <summary>WHY THIS MISSION?</summary>
      <IlpExplainability task={task}/>
      <p>{task.lastUpdatedReason||task.evidence.at(-1)||'Waiting for more evidence.'}</p>
      <button className="btn secondary" type="button" onClick={event=>{event.preventDefault();pauseTask(task.id)}}>PAUSE MISSION</button>
    </details>
  </article>;
}

function firstSentence(value:string){
  const sentence=value.trim().match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  return sentence||value.trim();
}

function EvidenceCard({task,index}:{task:ILPTask;index:number}){
  const summary=missionSummary(task);
  const recent=(task.missionHistory??[]).slice(-4).reverse();
  return <article className="ip-evidence-card">
    <div className="ip-evidence-head">
      <div><span>MISSION 0{index+1}</span><h2>{task.title}</h2></div>
      <b>{summary.stage}</b>
    </div>
    <IlpExplainability task={task}/>
    <div className="ip-evidence-reason">
      <span>LATEST READ</span>
      <p>{task.lastUpdatedReason||'Evidence is still building.'}</p>
    </div>
    {recent.length>0?<div className="ip-rep-list">
      {recent.map(rep=><div key={rep.matchId}>
        <span className={rep.banksPass?'good':'watch'}>{rep.banksPass?'BANKED':'REVIEWED'}</span>
        <b>{clean(rep.outcome)}</b>
        <small>{clean(rep.adherence)} adherence</small>
      </div>)}
    </div>:<div className="ip-no-reps">No reviewed mission reps yet.</div>}
  </article>;
}

function Archive({title,empty,tasks}:{title:string;empty:string;tasks:ILPTask[]}){
  return <article className="ip-archive">
    <div className="ip-archive-head"><span>{title}</span><b>{tasks.length}</b></div>
    {tasks.length?<div>{tasks.map(task=><details key={task.id}>
      <summary><b>{task.title}</b><span>{clean(task.category)}</span></summary>
      <p>{task.lastUpdatedReason||task.evidence.at(-1)||'No additional evidence note.'}</p>
      {task.status==='MASTERED'&&<IlpExplainability task={task} compact/>}
    </details>)}</div>:<p className="muted">{empty}</p>}
  </article>;
}

function Pips({passes,required}:{passes:number;required:number}){
  return <div className="ip-pips" aria-label={passes+' of '+required+' clean reps'}>
    {Array.from({length:required},(_,index)=><i key={index} className={index<passes?'on':''}/>)}
  </div>;
}
