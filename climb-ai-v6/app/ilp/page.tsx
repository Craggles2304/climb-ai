'use client';
import {useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {AnimatedBar,AnimatedRing,useMounted,revealProps} from '@/components/Motion';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {ILPTask} from '@/lib/types';
import {LeakPriceInline} from '@/components/LeakPrice';
import {priceLeak} from '@/lib/costOfLeak';
import {TrackView} from '@/components/TrackView';

const clean=(s:string)=>s.replaceAll('_',' ');

function Pips({passes,required}:{passes:number;required:number}){
  return <div className="vf-pips" aria-label={`${passes} of ${required} passes`}>
    {Array.from({length:required},(_,i)=><i key={i} className={i<passes?'on':undefined}/>) }
  </div>;
}

function TrackCard({task,index,mounted,matches,pauseTask}:{task:ILPTask;index:number;mounted:boolean;matches:ReturnType<typeof matchesFor>;pauseTask:(id:string)=>void}){
  const req=task.masteryRequired||3;
  const done=task.successfulGames||0;
  return <details {...revealProps(mounted,index,'vf-track')}>
    <summary>
      <div className="vf-track-index">0{index+1}</div>
      <div className="vf-track-main">
        <div className="vf-track-topline"><span>{clean(task.category)}</span><b>{task.source==='COACH'?'COACH':'ENGINE'}</b></div>
        <h3>{task.title}</h3>
        <div className="vf-track-meter"><AnimatedBar value={task.progress} delay={index*60}/><strong>{task.progress}%</strong></div>
        <div className="vf-track-pass"><Pips passes={done} required={req}/><span>{done}/{req} PASSES</span></div>
      </div>
      <div className="vf-track-open">+</div>
    </summary>
    <div className="vf-track-detail">
      <div className="vf-coach-rule"><span>IN GAME</span><b>{task.gameRule}</b></div>
      <div className="vf-detail-grid">
        <div><span>PASS WHEN</span><p>{task.target}</p></div>
        <div><span>WHY IT MATTERS</span><p>{task.why}</p></div>
      </div>
      <div className="vf-track-foot">
        <div><span className="muted">Latest evidence</span><p>{task.lastUpdatedReason||task.evidence[task.evidence.length-1]||'Waiting for match evidence.'}</p><LeakPriceInline price={priceLeak(matches,task.metric)}/></div>
        <button className="btn secondary" onClick={e=>{e.preventDefault();pauseTask(task.id)}}>PAUSE</button>
      </div>
    </div>
  </details>;
}

export default function PlayerDevelopmentCentre(){
  const mounted=useMounted();
  const {active}=useAccount();
  const {tasks,refreshFromMatches,pauseTask}=useLearningPlan();
  const [changes,setChanges]=useState<string[]>([]);
  const activeTasks=tasks.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED').slice(0,5);
  const mastered=tasks.filter(t=>t.status==='MASTERED');
  const paused=tasks.filter(t=>t.status==='PAUSED');
  const passes=activeTasks.reduce((n,t)=>n+(t.successfulGames||0),0);
  const required=activeTasks.reduce((n,t)=>n+(t.masteryRequired||3),0)||1;
  const avgProgress=activeTasks.length?activeTasks.reduce((n,t)=>n+t.progress,0)/activeTasks.length:0;
  const momentum=Math.round(Math.min(100,avgProgress*.7+(passes/required)*100*.3));
  const directive=activeTasks[0];
  const accountMatches=matchesFor(active.id);
  const refresh=()=>setChanges(refreshFromMatches());

  return <AppShell>
    <TrackView event="ilp_view"/>
    <PageHead title="My Learning Plan" subtitle={`${active.gameName}${active.tagline} · ${active.rank} · ${active.role}`} action={<button className="btn secondary" onClick={refresh}>REFRESH EVIDENCE</button>}/>

    <section className="vf-ilp-hero">
      <div className="vf-focus">
        <div className="eyebrow">CURRENT FOCUS</div>
        <div className="vf-focus-kicker">01 / {activeTasks.length||0}</div>
        <h2>{directive?.title||'Play a tracked game to build your plan'}</h2>
        {directive&&<>
          <div className="vf-command"><span>NEXT GAME</span><b>{directive.gameRule}</b></div>
          <div className="vf-focus-actions"><Link className="btn primary" href="/live">PLAY + TRACK</Link><Link className="btn secondary" href="/coach">ASK COACH</Link></div>
        </>}
      </div>
      <div className="vf-ilp-score"><AnimatedRing value={momentum} label="MOMENTUM"/><div className="vf-score-caption">{passes}/{required} passes banked</div></div>
    </section>

    <div className="vf-stat-strip">
      <div><span>ACTIVE</span><b>{activeTasks.length}</b></div>
      <div><span>MASTERED</span><b>{mastered.length}</b></div>
      <div><span>AVG PROGRESS</span><b>{Math.round(avgProgress)}%</b></div>
      <div><span>PLAN STATE</span><b>{momentum>=75?'SHARP':momentum>=50?'BUILDING':'WORKING'}</b></div>
    </div>

    {changes.length>0&&<details className="glass card vf-adapted" open><summary>PLAN UPDATED · {changes.length} CHANGE{changes.length===1?'':'S'}</summary><div>{changes.map(c=><p key={c}>{c}</p>)}</div></details>}

    <section className="vf-section-head"><div><div className="eyebrow">5-TRACK LADDER</div><h2>Fix one behaviour at a time.</h2></div><Link href="/progress">HISTORY →</Link></section>

    <div className="vf-track-list">
      {activeTasks.map((task,index)=><TrackCard key={task.id} task={task} index={index} mounted={mounted} matches={accountMatches} pauseTask={pauseTask}/>) }
    </div>

    <details className="glass card vf-how">
      <summary>HOW THE PLAN ADAPTS</summary>
      <div className="vf-how-grid">
        <div><b>01</b><span>EVIDENCE</span><p>Each tracked game scores the behaviour.</p></div>
        <div><b>02</b><span>PASS</span><p>Clear the threshold and bank a pass.</p></div>
        <div><b>03</b><span>MASTER</span><p>Enough clean games retires the behaviour.</p></div>
        <div><b>04</b><span>PROMOTE</span><p>The next highest-impact leak moves up.</p></div>
      </div>
    </details>

    {(mastered.length>0||paused.length>0)&&<section className="vf-archive-grid">
      {mastered.length>0&&<details className="glass card"><summary>MASTERED · {mastered.length}</summary><div className="vf-mini-list">{mastered.map(t=><div key={t.id}><b>{t.title}</b><span>{t.lastUpdatedReason||'Mastered from repeated evidence.'}</span></div>)}</div></details>}
      {paused.length>0&&<details className="glass card"><summary>PAUSED · {paused.length}</summary><div className="vf-mini-list">{paused.map(t=><div key={t.id}><b>{t.title}</b><span>{t.lastUpdatedReason||'Paused.'}</span></div>)}</div></details>}
    </section>}
  </AppShell>;
}
