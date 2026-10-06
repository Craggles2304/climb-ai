'use client';

import Link from 'next/link';
import type {CSSProperties} from 'react';
import {AppShell} from '@/components/AppShell';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {MissionMeasurementBadge} from '@/components/MissionMeasurementBadge';
import {DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {currentGameDnaMissions,missionRepView} from '@/lib/gameDnaSnapshot';
import {missionEvidence,missionSummary} from '@/lib/missionLoop';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {canonicalLeagueRole,taskAppliesToRole} from '@/lib/roleAwareLearning';

export default function Missions(){
  const {active}=useAccount();
  const {tasks,allTasks,planReady,planError}=useLearningPlan();
  const matches=matchesFor(active.id).filter(match=>match.durationSeconds>=300&&canonicalLeagueRole(match.role)===active.role);
  const baselineGames=dnaBaselineGameCount(matches,active.role);
  const baselineReady=dnaBaselineReady(baselineGames);
  const roleTasks=(allTasks[active.id]??tasks).filter(task=>taskAppliesToRole(task,active.role));
  const missions=currentGameDnaMissions(roleTasks,active.role);
  const activeCount=baselineReady?missions.filter(({task})=>Boolean(task)).length:0;
  const latestMatch=[...matches].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];

  return <AppShell><main className="missions-page">
    <header className="missions-head">
      <div><div className="eyebrow">LEAGUE · {active.role} · GAME DNA</div><h1>Your missions</h1><p>One current mission for each DNA strand. Your tracker updates when a finished game provides evidence.</p></div>
      <div className="missions-head-actions"><span>{activeCount}/6 ACTIVE</span><Link className="btn secondary" href="/ilp">OPEN MY DNA →</Link></div>
    </header>

    {!planReady?<section className="panel panel-padding"><div className="eyebrow">LOADING MISSIONS</div><h2>Checking your current plan…</h2></section>:
    planError?<section className="panel panel-padding"><div className="eyebrow">PLAN LOAD ERROR</div><h2>Your missions could not be loaded.</h2><p>{planError}</p><button className="btn secondary" type="button" onClick={()=>window.location.reload()}>RETRY</button></section>:
    !baselineReady?<section className="panel panel-padding missions-baseline"><div className="eyebrow">DNA BASELINE · {baselineGames}/{DNA_BASELINE_GAMES} GAMES</div><h2>Your six missions unlock after the baseline.</h2><p>Play normally for {DNA_BASELINE_GAMES-baselineGames} more tracked {active.role} game{DNA_BASELINE_GAMES-baselineGames===1?'':'s'}. OP CLIMB needs that evidence before assigning permanent strand missions.</p><div className="missions-track" role="progressbar" aria-label="DNA baseline games" aria-valuenow={baselineGames} aria-valuemin={0} aria-valuemax={DNA_BASELINE_GAMES}><span style={{width:`${baselineGames/DNA_BASELINE_GAMES*100}%`}}/></div><Link className="btn primary" href="/live">OPEN MATCH ROOM →</Link></section>:
    <div className="missions-grid">{missions.map(({domain,task},index)=>{
      const style={'--mission-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties;
      if(!task)return <article className="panel missions-card missions-card-empty" key={domain} style={style}><div className="missions-card-top"><span>{String(index+1).padStart(2,'0')} · {DNA_DOMAIN_LABELS[domain].toUpperCase()}</span><span>AWAITING EVIDENCE</span></div><h2>Mission building</h2><p>OP CLIMB has not found a reliable, measurable mission for this strand yet.</p><Link href={`/ilp?dna=${domain}`} className="text-link">VIEW DNA STRAND →</Link></article>;
      const plain=plainLanguageFocus(task);
      const summary=missionSummary(task);
      const rep=missionRepView(task);
      const evidence=missionEvidence(task,latestMatch,active.rank);
      return <article className="panel missions-card" key={domain} style={style}>
        <div className="missions-card-top"><span>{String(index+1).padStart(2,'0')} · {DNA_DOMAIN_LABELS[domain].toUpperCase()}</span><MissionMeasurementBadge metric={task.metric} compact/></div>
        <h2>{plain.name}</h2><p className="missions-meaning">{plain.meaning}</p>
        <div className="missions-job"><span>YOUR JOB NEXT GAME</span><strong>{plain.nextGame}</strong></div>
        <div className="missions-progress-head"><span>PROVEN GAMES</span><strong>{summary.confirmed}/{summary.required}</strong></div>
        <div className="missions-track" role="progressbar" aria-label={`${DNA_DOMAIN_LABELS[domain]} mission progress`} aria-valuenow={Math.min(summary.confirmed,summary.required)} aria-valuemin={0} aria-valuemax={summary.required}><span style={{width:`${rep.progress}%`}}/></div>
        <div className="missions-pips" aria-hidden="true">{Array.from({length:summary.required},(_,i)=><span className={i<summary.confirmed?'complete':''} key={i}/>)}</div>
        <p className="missions-progress-note">{summary.remaining?`${summary.remaining} more proven game${summary.remaining===1?'':'s'} to master this mission.`:'Mastery target reached. Your next strand mission will follow.'}</p>
        <div className="missions-evidence"><span>LATEST GAME</span><strong>{evidence.available?(evidence.clearedBar?'TARGET MET':'KEEP WORKING'):'NOT OBSERVED'}</strong><small>{evidence.reason}</small></div>
        <Link href={`/ilp?dna=${domain}`} className="text-link">OPEN STRAND DETAILS →</Link>
      </article>;
    })}</div>}
  </main></AppShell>;
}
