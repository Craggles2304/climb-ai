'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import type {CSSProperties} from 'react';
import {AppShell} from '@/components/AppShell';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {MissionMeasurementBadge} from '@/components/MissionMeasurementBadge';
import {DNA_DOMAINS,DNA_DOMAIN_COLORS,DNA_DOMAIN_GUIDE,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {currentGameDnaMissions,missionRepView} from '@/lib/gameDnaSnapshot';
import {missionComparisonForMatch} from '@/lib/missionComparison';
import {missionDomainFromSlug,missionDomainPath} from '@/lib/missionDomainPath';
import {missionSummary} from '@/lib/missionLoop';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {canonicalLeagueRole,taskAppliesToRole} from '@/lib/roleAwareLearning';

export default function MissionDetail(){
  const params=useParams<{domain:string}>();
  const domain=missionDomainFromSlug(params.domain);
  const {active}=useAccount();
  const {tasks,allTasks,planReady,planError}=useLearningPlan();
  const matches=matchesFor(active.id).filter(match=>match.durationSeconds>=300&&canonicalLeagueRole(match.role)===active.role);
  const baselineGames=dnaBaselineGameCount(matches,active.role);
  const baselineReady=dnaBaselineReady(baselineGames);
  const roleTasks=(allTasks[active.id]??tasks).filter(task=>taskAppliesToRole(task,active.role));
  const task=domain?currentGameDnaMissions(roleTasks,active.role).find(row=>row.domain===domain)?.task:null;
  const latestMatch=[...matches].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
  const index=domain?DNA_DOMAINS.indexOf(domain):-1;
  const style=domain?{'--mission-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties:undefined;

  if(!domain)return <AppShell><main className="mission-detail"><Link href="/missions" className="text-link">← ALL MISSIONS</Link><section className="panel panel-padding"><h1>Mission not found</h1><p>Choose one of your six DNA strands from the Missions page.</p></section></main></AppShell>;

  const label=DNA_DOMAIN_LABELS[domain];
  const guide=DNA_DOMAIN_GUIDE[domain];
  const plain=task?plainLanguageFocus(task):null;
  const summary=task?missionSummary(task):null;
  const rep=task?missionRepView(task):null;
  const comparison=task?missionComparisonForMatch(task,latestMatch?.id):null;

  return <AppShell><main className="mission-detail" style={style}>
    <nav className="mission-detail-breadcrumb" aria-label="Mission navigation"><Link href="/missions">← ALL MISSIONS</Link><span>{String(index+1).padStart(2,'0')} / 06 · {label.toUpperCase()}</span></nav>
    <header className="mission-detail-head"><div><div className="eyebrow">{active.role} GAME DNA · {label.toUpperCase()}</div><h1>{plain?.name??label}</h1><p>{plain?.meaning??guide.summary}</p></div><Link className="btn secondary" href={`/ilp?dna=${domain}`}>VIEW IN MY DNA →</Link></header>

    {!planReady?<section className="panel panel-padding"><h2>Loading your mission…</h2></section>:
    planError?<section className="panel panel-padding"><h2>Your mission could not be loaded.</h2><p>{planError}</p><button className="btn secondary" onClick={()=>window.location.reload()}>RETRY</button></section>:
    !baselineReady?<section className="panel panel-padding mission-detail-empty"><div className="eyebrow">DNA BASELINE · {baselineGames}/{DNA_BASELINE_GAMES} GAMES</div><h2>Your {label} mission unlocks after the baseline.</h2><p>Play {DNA_BASELINE_GAMES-baselineGames} more tracked {active.role} game{DNA_BASELINE_GAMES-baselineGames===1?'':'s'} normally. OP CLIMB will use the evidence to choose a measurable mission for this strand.</p><Link className="btn primary" href="/live">OPEN MATCH ROOM →</Link></section>:
    !task?<section className="panel panel-padding mission-detail-empty"><div className="eyebrow">AWAITING EVIDENCE</div><h2>Your {label} mission is building.</h2><p>{guide.summary} OP CLIMB will show a target here when it can measure one reliably.</p><Link className="btn secondary" href="/missions">BACK TO MISSIONS</Link></section>:
    <div className="mission-detail-layout">
      <div className="mission-detail-main">
        <section className="panel mission-detail-section"><div className="eyebrow">OVERVIEW</div><h2>What this mission is about</h2><p>{plain?.meaning}</p><p>{plain?.why}</p><div className="mission-detail-measure"><span>WHAT OP CLIMB MEASURES</span><MissionMeasurementBadge metric={task.metric} compact/></div></section>

        <section className="panel mission-detail-section"><div className="eyebrow">YOUR GOAL</div><h2>The decision to practise</h2><p className="mission-detail-callout">{plain?.nextGame}</p><p>{task.gameRule}</p></section>

        <section className="panel mission-detail-section"><div className="eyebrow">HOW TO COMPLETE IT</div><h2>Three clear steps</h2><ol className="mission-detail-steps"><li><span>01</span><div><h3>Take the goal into a tracked game</h3><p>Keep the decision above in mind. The Companion records evidence quietly while you play.</p></div></li><li><span>02</span><div><h3>Meet this game’s target</h3><p>{task.target}</p><small>{plain?.success}</small></div></li><li><span>03</span><div><h3>Build {summary?.required} proven games</h3><p>After each match, OP CLIMB reviews the evidence. A game only moves the tracker when it confirms the target was met.</p></div></li></ol></section>

        <section className="panel mission-detail-section"><div className="eyebrow">LATEST GAME EVIDENCE</div><h2>How your last {active.role} game compared</h2><div className="mission-detail-verdict"><strong>{comparison?.result}</strong><p>{comparison?.detail}</p></div>{latestMatch?<Link className="text-link" href={`/analyse/${encodeURIComponent(latestMatch.id)}`}>OPEN FULL GAME REVIEW →</Link>:<p>No finished {active.role} game is available yet.</p>}</section>
      </div>

      <aside className="mission-detail-side"><section className="panel mission-detail-progress"><div className="eyebrow">YOUR PROGRESS</div><strong>{summary?.confirmed}/{summary?.required}</strong><span>PROVEN GAMES</span><div className="missions-track" role="progressbar" aria-label={`${label} mission progress`} aria-valuenow={Math.min(summary?.confirmed??0,summary?.required??1)} aria-valuemin={0} aria-valuemax={summary?.required??1}><span style={{width:`${rep?.progress??0}%`}}/></div><p>{summary?.remaining?`${summary.remaining} more proven game${summary.remaining===1?'':'s'} needed.`:'Mastery target reached.'}</p><small>{summary?.reviewed} game{summary?.reviewed===1?'':'s'} reviewed for this mission</small></section><Link className="btn primary" href="/live">OPEN MATCH ROOM →</Link></aside>
    </div>}

    <nav className="mission-detail-next" aria-label="Other DNA missions">{index>0&&<Link href={missionDomainPath(DNA_DOMAINS[index-1])}>← {DNA_DOMAIN_LABELS[DNA_DOMAINS[index-1]]}</Link>}<Link href="/missions">ALL SIX MISSIONS</Link>{index<DNA_DOMAINS.length-1&&<Link href={missionDomainPath(DNA_DOMAINS[index+1])}>{DNA_DOMAIN_LABELS[DNA_DOMAINS[index+1]]} →</Link>}</nav>
  </main></AppShell>;
}
