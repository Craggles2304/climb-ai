'use client';
import {useMemo,useState} from 'react';
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
import {coachingLevelFor} from '@/lib/coachingLevel';
import {IlpExplainability} from '@/components/IlpExplainability';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';

const clean=(s:string)=>s.replaceAll('_',' ');

function Pips({passes,required}:{passes:number;required:number}){
  return <div className="vf-pips" aria-label={`${passes} of ${required} passes`}>
    {Array.from({length:required},(_,i)=><i key={i} className={i<passes?'on':undefined}/>) }
  </div>;
}

function TrackCard({task,index,mounted,matches,pauseTask,depth}:{task:ILPTask;index:number;mounted:boolean;matches:ReturnType<typeof matchesFor>;pauseTask:(id:string)=>void;depth:number}){
  const req=task.masteryRequired||3;
  const done=task.successfulGames||0;
  const plain=plainLanguageFocus(task);
  return <details {...revealProps(mounted,index,'vf-track')}>
    <summary>
      <div className="vf-track-index">0{index+1}</div>
      <div className="vf-track-main">
        <div className="vf-track-topline"><span>{clean(task.category)}</span><b>{task.source==='COACH'?'COACH':'GAME DATA'}</b></div>
        <h3>{task.title}</h3>
        <p className="vf-track-plain"><span>IN SIMPLE TERMS</span>{plain.meaning}</p>
        <div className="vf-track-meter"><AnimatedBar value={task.progress} delay={index*60}/><strong>{task.progress}%</strong></div>
        <div className="vf-track-pass"><Pips passes={done} required={req}/><span>{done}/{req} GAMES WHERE YOU DID THIS</span></div>
      </div>
      <div className="vf-track-open">+</div>
    </summary>
    <div className="vf-track-detail">
      <IlpExplainability task={task}/>
      <div className="vf-simple-rule"><span>YOUR SIMPLE RULE NEXT GAME</span><b>{plain.nextGame}</b></div>
      <details className="vf-technical-rule"><summary>COACH DETAIL · WHY WE CALL IT “{task.title}”</summary><p>{task.gameRule}</p></details>
      <div className="vf-detail-grid">
        <div><span>THIS COUNTS AS A GOOD GAME WHEN</span><p>{task.target}</p></div>
        {depth>=3&&<div><span>WHY</span><p>{task.why}</p></div>}
      </div>
      <div className="vf-track-foot">
        <div>
          {depth>=4&&<><span className="muted">What the games are showing</span><p>{task.lastUpdatedReason||task.evidence[task.evidence.length-1]||'Waiting for match evidence.'}</p></>}
          {depth>=5&&<LeakPriceInline price={priceLeak(matches,task.metric)}/>} 
        </div>
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
  const detail=useMemo(()=>coachingLevelFor(active.rank),[active.rank]);
  const activeTasks=tasks.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED').slice(0,5);
  const mastered=tasks.filter(t=>t.status==='MASTERED');
  const paused=tasks.filter(t=>t.status==='PAUSED');
  const passes=activeTasks.reduce((n,t)=>n+(t.successfulGames||0),0);
  const required=activeTasks.reduce((n,t)=>n+(t.masteryRequired||3),0)||1;
  const avgProgress=activeTasks.length?activeTasks.reduce((n,t)=>n+t.progress,0)/activeTasks.length:0;
  const momentum=Math.round(Math.min(100,avgProgress*.7+(passes/required)*100*.3));
  const directive=activeTasks[0];
  const directivePlain=directive?plainLanguageFocus(directive):null;
  const accountMatches=matchesFor(active.id);
  const refresh=()=>setChanges(refreshFromMatches());

  return <AppShell>
    <TrackView event="ilp_view"/>
    <PageHead title="My Active Five" subtitle={`${active.gameName}${active.tagline} · ${active.rank} · ${detail.tier} Coach`} action={<button className="btn secondary" onClick={refresh}>CHECK NEW GAMES</button>}/>

    <section className="vf-ilp-hero">
      <div className="vf-focus">
        <div className="eyebrow">#1 FOCUS · {detail.tier} DETAIL</div>
        <div className="vf-focus-kicker">01 / {activeTasks.length||0}</div>
        <h2>{directive?.title||'Play a tracked game to build your Active Five'}</h2>
        {directive&&directivePlain&&<>
          <div className="vf-focus-plain"><span>WHAT THIS ACTUALLY MEANS</span><p>{directivePlain.meaning}</p></div>
          <div className="vf-command"><span>YOUR SIMPLE RULE NEXT GAME</span><b>{directivePlain.nextGame}</b></div>
          <details className="vf-technical-rule vf-technical-rule-hero"><summary>SHOW COACH DETAIL</summary><p>{directive.gameRule}</p></details>
          <IlpExplainability task={directive} compact/>
          {detail.depth>=3&&<p className="muted" style={{margin:'10px 0 0'}}>{detail.summary}</p>}
          <div className="vf-focus-actions"><Link className="btn primary" href="/live">PLAY + TRACK</Link><Link className="btn secondary" href="/coach">ASK {detail.tier} COACH</Link></div>
        </>}
      </div>
      <div className="vf-ilp-score"><AnimatedRing value={momentum} label="PROGRESS"/><div className="vf-score-caption">{passes}/{required} good games banked</div></div>
    </section>

    <div className="vf-stat-strip">
      <div><span>ACTIVE</span><b>{activeTasks.length}/5</b></div>
      <div><span>MASTERED</span><b>{mastered.length}</b></div>
      <div><span>PROGRESS</span><b>{Math.round(avgProgress)}%</b></div>
      <div><span>COACH</span><b>{detail.tier}</b></div>
    </div>

    {changes.length>0&&<details className="glass card vf-adapted" open><summary>ACTIVE FIVE UPDATED · {changes.length} CHANGE{changes.length===1?'':'S'}</summary><div>{changes.map(c=><p key={c}>{c}</p>)}</div></details>}

    <section className="vf-section-head"><div><div className="eyebrow">YOUR ACTIVE FIVE</div><h2>Five things. #1 matters most.</h2><p className="muted">Each one is a habit OP CLIMB wants you to improve. The plain-English meaning is always shown; coach terminology is optional.</p></div>{detail.depth>=4&&<Link href="/progress">HISTORY →</Link>}</section>

    <div className="vf-track-list">
      {activeTasks.map((task,index)=><TrackCard key={task.id} task={task} index={index} mounted={mounted} matches={accountMatches} pauseTask={pauseTask} depth={detail.depth}/>) }
    </div>

    {detail.depth>=3&&<details className="glass card vf-how">
      <summary>HOW ACTIVE FIVE WORKS</summary>
      <div className="vf-how-grid">
        <div><b>01</b><span>PLAY</span><p>Play normally while OP CLIMB watches for this one habit.</p></div>
        <div><b>02</b><span>DO IT</span><p>If you make the better decision, that game counts toward the goal.</p></div>
        <div><b>03</b><span>MAKE IT A HABIT</span><p>Repeat the better decision across enough games and OP CLIMB marks it as learned.</p></div>
        <div><b>04</b><span>MOVE ON</span><p>Once it sticks, a new priority takes its place so you are not fixing everything at once.</p></div>
      </div>
    </details>}

    {(mastered.length>0||paused.length>0)&&detail.depth>=4&&<section className="vf-archive-grid">
      {mastered.length>0&&<details className="glass card"><summary>MASTERED · {mastered.length}</summary><div className="vf-mini-list">{mastered.map(t=><div key={t.id}><b>{t.title}</b><span>{t.lastUpdatedReason||'Mastered from repeated evidence.'}</span><IlpExplainability task={t} compact/></div>)}</div></details>}
      {paused.length>0&&<details className="glass card"><summary>PAUSED · {paused.length}</summary><div className="vf-mini-list">{paused.map(t=><div key={t.id}><b>{t.title}</b><span>{t.lastUpdatedReason||'Paused.'}</span></div>)}</div></details>}
    </section>}
  </AppShell>;
}
