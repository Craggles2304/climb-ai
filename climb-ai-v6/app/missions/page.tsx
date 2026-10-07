'use client';

import Link from 'next/link';
import {useState} from 'react';
import type {CSSProperties} from 'react';
import {AppShell} from '@/components/AppShell';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {MissionMeasurementBadge} from '@/components/MissionMeasurementBadge';
import {DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {currentGameDnaMissions,gameMissionFocusPair,missionRepView} from '@/lib/gameDnaSnapshot';
import {missionSummary} from '@/lib/missionLoop';
import {missionComparisonForMatch} from '@/lib/missionComparison';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {canonicalLeagueRole,taskAppliesToRole} from '@/lib/roleAwareLearning';

export default function Missions(){
  const {active}=useAccount();
  const {tasks,allTasks,planReady,planError}=useLearningPlan();
  const [selectedDomain,setSelectedDomain]=useState<string|null>(null);
  const matches=matchesFor(active.id).filter(match=>match.durationSeconds>=300&&canonicalLeagueRole(match.role)===active.role);
  const baselineGames=dnaBaselineGameCount(matches,active.role);
  const baselineReady=dnaBaselineReady(baselineGames);
  const roleTasks=(allTasks[active.id]??tasks).filter(task=>taskAppliesToRole(task,active.role));
  const missions=currentGameDnaMissions(roleTasks,active.role);
  const focusPair=baselineReady?gameMissionFocusPair(roleTasks,active.role):[];
  const focusIds=new Set(focusPair.map(item=>item.task.id));
  const background=missions.filter(({task})=>!task||!focusIds.has(task.id));
  const latestMatch=[...matches].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
  const fallbackMission=focusPair[0]??missions.find(({task})=>Boolean(task))??missions[0];
  const selectedMission=missions.find(({domain})=>domain===selectedDomain)??fallbackMission;

  return <AppShell><main className="missions-page">
    <header className="missions-head">
      <div><div className="eyebrow">LEAGUE · {active.role} · GAME DNA</div><h1>Your two missions</h1><p>OP CLIMB picks exactly two focus missions for each game. Only those two can bank progress; the other four DNA strands stay in the background until they are selected.</p></div>
      <div className="missions-head-actions"><span>{focusPair.length}/2 GAME MISSIONS</span><Link className="btn secondary" href="/ilp">OPEN MY DNA →</Link></div>
    </header>

    {!planReady?<section className="panel panel-padding"><div className="eyebrow">LOADING MISSIONS</div><h2>Checking your current plan…</h2></section>:
    planError?<section className="panel panel-padding"><div className="eyebrow">PLAN LOAD ERROR</div><h2>Your missions could not be loaded.</h2><p>{planError}</p><button className="btn secondary" type="button" onClick={()=>window.location.reload()}>RETRY</button></section>:
    !baselineReady?<section className="panel panel-padding missions-baseline"><div className="eyebrow">DNA BASELINE · {baselineGames}/{DNA_BASELINE_GAMES} GAMES</div><h2>Your two-game mission loop unlocks after the baseline.</h2><p>Play normally for {DNA_BASELINE_GAMES-baselineGames} more tracked {active.role} game{DNA_BASELINE_GAMES-baselineGames===1?'':'s'}. OP CLIMB needs that evidence before choosing your first two focus missions.</p><div className="missions-track" role="progressbar" aria-label="DNA baseline games" aria-valuenow={baselineGames} aria-valuemin={0} aria-valuemax={DNA_BASELINE_GAMES}><span style={{width:`${baselineGames/DNA_BASELINE_GAMES*100}%`}}/></div><Link className="btn primary" href="/live">OPEN MATCH ROOM →</Link></section>:
    <section className="missions-focus-shell">
      <div className="missions-game-pair">
        {focusPair.map(({domain,task},index)=>{
          const style={'--mission-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties;
          const plain=plainLanguageFocus(task);
          const summary=missionSummary(task);
          const rep=missionRepView(task);
          const selected=selectedMission?.task?.id===task.id;
          return <button key={task.id} type="button" className={`missions-game-card ${selected?'active':''}`} style={style} onClick={()=>setSelectedDomain(domain)}>
            <span className="missions-switch-kicker">FOCUS {index+1} OF 2 · {DNA_DOMAIN_LABELS[domain].toUpperCase()}</span>
            <strong>{plain.name}</strong>
            <p>{plain.nextGame}</p>
            <div className="missions-switch-meta"><span>{summary.confirmed}/{summary.required} PROVEN</span><b>{selected?'OPEN':'VIEW'}</b></div>
            <div className="missions-switch-track"><i style={{width:`${rep.progress}%`}}/></div>
          </button>;
        })}
      </div>

      <p className="missions-pair-note">These are the only two missions that can score in your next tracked {active.role} game.</p>

      {selectedMission&&(()=>{
        const {domain,task}=selectedMission;
        const style={'--mission-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties;
        const isFocus=Boolean(task&&focusIds.has(task.id));
        if(!task)return <article className="panel missions-focus-card missions-card-empty" style={style}><div className="missions-focus-top"><div><span>{DNA_DOMAIN_LABELS[domain].toUpperCase()}</span><small>AWAITING EVIDENCE</small></div></div><h2>Mission building</h2><p className="missions-meaning">OP CLIMB has not found a reliable, measurable mission for this strand yet.</p><Link href={`/ilp?dna=${domain}`} className="btn secondary">VIEW DNA STRAND →</Link></article>;

        const plain=plainLanguageFocus(task);
        const summary=missionSummary(task);
        const rep=missionRepView(task);
        const comparison=missionComparisonForMatch(task,latestMatch?.id);

        return <article className="panel missions-focus-card" style={style}>
          <div className="missions-focus-top">
            <div><span>{isFocus?'THIS GAME · SCORED MISSION':'BACKGROUND DNA · NOT SCORED THIS GAME'} · {DNA_DOMAIN_LABELS[domain].toUpperCase()}</span><small>{isFocus?'One of your two jobs for the next game':'This strand remains part of your DNA but will not bank a rep this game'}</small></div>
            <MissionMeasurementBadge metric={task.metric} compact/>
          </div>
          <div className="missions-focus-main">
            <div className="missions-focus-copy">
              <h2>{plain.name}</h2><p className="missions-meaning">{plain.meaning}</p>
              <div className="missions-job"><span>YOUR JOB NEXT GAME</span><strong>{plain.nextGame}</strong></div>
            </div>
            <aside className="missions-focus-proof">
              <div className="missions-progress-head"><span>PROVEN GAMES</span><strong>{summary.confirmed}/{summary.required}</strong></div>
              <div className="missions-track" role="progressbar" aria-label={`${DNA_DOMAIN_LABELS[domain]} mission progress`} aria-valuenow={Math.min(summary.confirmed,summary.required)} aria-valuemin={0} aria-valuemax={summary.required}><span style={{width:`${rep.progress}%`}}/></div>
              <div className="missions-pips" aria-hidden="true">{Array.from({length:summary.required},(_,i)=><span className={i<summary.confirmed?'complete':''} key={i}/>)}</div>
              <p className="missions-progress-note">{summary.remaining?`${summary.remaining} more proven game${summary.remaining===1?'':'s'} to master this mission.`:'Mastery target reached. Your next strand mission will follow.'}</p>
              <div className="missions-evidence"><span>LATEST GAME</span><strong>{comparison.result}</strong><small>{comparison.detail}</small></div>
              {comparison.events.length>0&&<div className="missions-specific-proof">{comparison.events.map((event,index)=><div key={index}><b>{event.clock}</b><span>{event.label}</span><small>{event.detail}</small></div>)}</div>}
            </aside>
          </div>
          <div className="missions-focus-actions"><Link href={`/ilp?dna=${domain}`} className="btn secondary">OPEN STRAND DETAILS →</Link>{isFocus&&<Link href="/live" className="btn primary">OPEN MATCH ROOM →</Link>}</div>
        </article>;
      })()}

      <details className="missions-background">
        <summary>OTHER 4 DNA STRANDS · MONITORED, NOT SCORED THIS GAME</summary>
        <div className="missions-switcher">
          {background.map(({domain,task},index)=>{
            const style={'--mission-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties;
            const plain=task?plainLanguageFocus(task):null;
            const summary=task?missionSummary(task):null;
            const rep=task?missionRepView(task):null;
            return <button key={domain} type="button" className="missions-switch" style={style} onClick={()=>setSelectedDomain(domain)}>
              <span className="missions-switch-kicker">{String(index+1).padStart(2,'0')} · {DNA_DOMAIN_LABELS[domain].toUpperCase()}</span>
              <strong>{plain?.name??'MISSION BUILDING'}</strong>
              <div className="missions-switch-meta"><span>{summary?`${summary.confirmed}/${summary.required} PROVEN`:'AWAITING EVIDENCE'}</span><b>VIEW</b></div>
              <div className="missions-switch-track"><i style={{width:`${rep?.progress??0}%`}}/></div>
            </button>;
          })}
        </div>
      </details>
    </section>}
  </main></AppShell>;
}
