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
import {accountProgress,XP_PER_MISSION_MASTERY,XP_PER_PROVEN_REP} from '@/lib/accountXp';
import {awarenessMissions} from '@/lib/awarenessMissions';
import type {Role} from '@/lib/types';

type Tab='CURRENT'|'EVIDENCE'|'HISTORY';
const clean=(value:string)=>value.replaceAll('_',' ');

export default function PlayerDevelopmentCentre(){
  const {active,refresh:refreshAccount}=useAccount();
  const {tasks,allTasks,refreshFromMatches,pauseTask}=useLearningPlan();
  const [tab,setTab]=useState<Tab>('CURRENT');
  const [changes,setChanges]=useState<string[]>([]);
  const [checking,setChecking]=useState(false);

  const activeTasks=useMemo(
    ()=>tasks.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED').slice(0,2),
    [tasks],
  );
  const mastered=useMemo(()=>tasks.filter(task=>task.status==='MASTERED'),[tasks]);
  const paused=useMemo(()=>tasks.filter(task=>task.status==='PAUSED'),[tasks]);
  const matches=matchesFor(active.id).filter(match=>match.role===active.role);
  const xp=accountProgress(allTasks[active.id]??tasks);

  const planProgress=activeTasks.length
    ?Math.round(activeTasks.reduce((sum,task)=>sum+task.progress,0)/activeTasks.length)
    :0;
  const banked=activeTasks.reduce((sum,task)=>sum+missionSummary(task).confirmed,0);
  const required=activeTasks.reduce((sum,task)=>sum+missionSummary(task).required,0);
  const refresh=async()=>{
    setChecking(true);
    try{
      await refreshAccount();
      setChanges(['Latest match data fetched. New evidence will be applied to your two missions automatically.']);
    }finally{
      setChecking(false);
    }
  };

  return <AppShell>
    <section className="ip-head">
      <div>
        <div className="eyebrow">PLAYER DEVELOPMENT PLAN</div>
        <h1>Two things. Until they stick.</h1>
        <p>{active.gameName}{active.tagline} · {active.rank} · <b>{active.role}</b></p>
      </div>
      <button className="btn secondary" type="button" disabled={checking} onClick={()=>void refresh()}>{checking?'CHECKING…':'CHECK NEW GAMES'}</button>
    </section>

    <section className="ip-summary">
      <div className="ip-summary-main">
        <span>CURRENT PLAN</span>
        <b>{activeTasks.length}/2 ACTIVE</b>
        <small>{matches.length} {active.role.toLowerCase()} games feeding this plan</small>
      </div>
      <div><span>PROVEN REPS</span><b>{banked}/{required||6}</b><small>tracked or reviewed evidence</small></div>
      <div><span>CLIMB LEVEL</span><b>LV {xp.level}</b><small>{xp.xp.toLocaleString()} XP · {xp.title}</small></div>
      <div><span>PLAN</span><b>{planProgress}%</b><small>{Math.max(0,xp.nextLevelXp-xp.xp).toLocaleString()} XP to level {xp.level+1}</small></div>
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
        {activeTasks.map((task,index)=><MissionCard key={task.id} task={task} index={index} role={active.role} pauseTask={pauseTask}/>) }
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

function MissionCard({task,index,role,pauseTask}:{task:ILPTask;index:number;role:Role;pauseTask:(id:string)=>void}){
  const plain=plainLanguageFocus(task);
  const summary=missionSummary(task);
  const sideMissions=awarenessMissions(task,role);
  return <article className={'ip-mission '+(index===0?'primary':'secondary')}>
    <div className="ip-mission-top">
      <span>MISSION 0{index+1}</span>
      <em>{clean(task.category)}</em>
    </div>
    <h2>{plain.name}</h2>
    <div className="ip-layman">
      <span>WHAT THIS MEANS</span>
      <p>{plain.meaning}</p>
    </div>

    <div className="ip-rule">
      <span>YOUR JOB NEXT GAME</span>
      <b>{plain.nextGame}</b>
    </div>

    <div className="ip-target">
      <div><span>HOW YOU PASS</span><b>{plain.success}</b></div>
      <div><span>WHERE YOU'RE AT</span><b>{stageLabel(summary.stage)}</b></div>
    </div>

    {sideMissions.length>0&&<div className="ip-sidequests">
      <div className="ip-sidequests-head">
        <div><span>SIDE MISSIONS</span><b>Keep these in your head too.</b></div>
        <em>AWARENESS ONLY · NOT SCORED</em>
      </div>
      <div className="ip-sidequest-list">
        {sideMissions.map((side,sideIndex)=><article key={side.id}>
          <span>SIDE 0{sideIndex+1}</span>
          <div><b>{side.name}</b><p>{side.meaning}</p><small>{side.cue}</small></div>
        </article>)}
      </div>
      <footer>No XP · No pass/fail · Does not affect mastery</footer>
    </div>}

    <div className="ip-progress">
      <div><AnimatedBar value={task.progress}/><b>{task.progress}%</b></div>
      <Pips passes={summary.confirmed} required={summary.required}/>
      <small>{summary.confirmed}/{summary.required} proven reps · +{XP_PER_PROVEN_REP} XP each · {summary.remaining?summary.remaining+' still needed':'ready for mastery check'}</small>
    </div>

    <div className="ip-xp-reward"><span>MISSION REWARD</span><b>+{XP_PER_MISSION_MASTERY} XP</b><small>when mastered · +{XP_PER_PROVEN_REP} XP per proven game</small></div>
    <details className="ip-mission-details">
      <summary>BREAK IT DOWN <span>WHY · WHAT · HOW YOU PASS</span></summary>
      <div className="ip-mission-brief">
        <section>
          <span>01 · WHY THIS ONE</span>
          <h3>Why it matters</h3>
          <p>{plain.why}</p>
        </section>
        <section>
          <span>02 · WHAT TO DO</span>
          <h3>Remember one thing</h3>
          <p>{plain.nextGame}</p>
        </section>
        <section>
          <span>03 · HOW YOU PASS</span>
          <h3>{plain.success}</h3>
          <p>Each clean game banks one rep. Get {summary.required} clean reps and meet the tracking target to move this mission toward mastery.</p>
        </section>
        <section>
          <span>04 · WHY IT IS STILL ACTIVE</span>
          <h3>{summary.remaining?`${summary.remaining} proven rep${summary.remaining===1?'':'s'} still needed`:'Ready for a mastery check'}</h3>
          <p>{task.lastUpdatedReason||task.evidence.at(-1)||'OP CLIMB is waiting for enough reliable match evidence to judge the pattern.'}</p>
        </section>
      </div>
      <IlpExplainability task={task}/>
      <button className="btn secondary" type="button" onClick={event=>{event.preventDefault();pauseTask(task.id)}}>PAUSE MISSION</button>
    </details>
  </article>;
}

function stageLabel(stage:string){
  if(stage==='DISCOVER')return'NEW';
  if(stage==='PRACTISE')return'PRACTISING';
  if(stage==='REPEAT')return'REPEATING';
  if(stage==='MASTERED')return'MASTERED';
  return clean(stage);
}

function EvidenceCard({task,index}:{task:ILPTask;index:number}){
  const summary=missionSummary(task);
  const recent=(task.missionHistory??[]).slice(-4).reverse();
  return <article className="ip-evidence-card">
    <div className="ip-evidence-head">
      <div><span>MISSION 0{index+1}</span><h2>{plainLanguageFocus(task).name}</h2></div>
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
      <summary><b>{plainLanguageFocus(task).name}</b><span>{clean(task.category)}</span></summary>
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
