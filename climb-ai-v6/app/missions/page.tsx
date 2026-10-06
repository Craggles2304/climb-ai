'use client';

import Link from 'next/link';
import type {CSSProperties} from 'react';
import {AppShell} from '@/components/AppShell';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {currentGameDnaMissions,missionRepView} from '@/lib/gameDnaSnapshot';
import {missionSummary} from '@/lib/missionLoop';
import {missionComparisonForMatch} from '@/lib/missionComparison';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {canonicalLeagueRole,taskAppliesToRole} from '@/lib/roleAwareLearning';
import {missionDomainPath} from '@/lib/missionDomainPath';

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
      if(!task)return <Link className="panel missions-overview-card missions-card-empty" href={missionDomainPath(domain)} key={domain} style={style}><span>{String(index+1).padStart(2,'0')} · {DNA_DOMAIN_LABELS[domain].toUpperCase()}</span><h2>Mission building</h2><p>Awaiting enough evidence to set a measurable mission.</p><b>OPEN STRAND →</b></Link>;
      const plain=plainLanguageFocus(task);
      const summary=missionSummary(task);
      const rep=missionRepView(task);
      const comparison=missionComparisonForMatch(task,latestMatch?.id);
      return <Link className="panel missions-overview-card" href={missionDomainPath(domain)} key={domain} style={style}>
        <span>{String(index+1).padStart(2,'0')} · {DNA_DOMAIN_LABELS[domain].toUpperCase()}</span>
        <h2>{plain.name}</h2>
        <p>{plain.meaning}</p>
        <div className="missions-overview-meta"><strong>{summary.confirmed}/{summary.required} proven games</strong><em>{comparison.result}</em></div>
        <div className="missions-track" role="progressbar" aria-label={`${DNA_DOMAIN_LABELS[domain]} mission progress`} aria-valuenow={Math.min(summary.confirmed,summary.required)} aria-valuemin={0} aria-valuemax={summary.required}><span style={{width:`${rep.progress}%`}}/></div>
        <b>OPEN MISSION →</b>
      </Link>;
    })}</div>}
  </main></AppShell>;
}
