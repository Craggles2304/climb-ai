'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import type {CSSProperties} from 'react';
import {AppShell} from '@/components/AppShell';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {MissionMeasurementBadge} from '@/components/MissionMeasurementBadge';
import {DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import type {DnaDomain} from '@/lib/types';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {currentGameDnaMissions,gameMissionFocusPair,missionRepView} from '@/lib/gameDnaSnapshot';
import {missionSummary} from '@/lib/missionLoop';
import {missionComparisonForMatch} from '@/lib/missionComparison';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {canonicalLeagueRole,taskAppliesToRole} from '@/lib/roleAwareLearning';
import {dnaStrandLevel} from '@/lib/dnaLevel';

export default function Missions(){
  const {active}=useAccount();
  const {tasks,allTasks,planReady,planError,setDnaFocusDomains}=useLearningPlan();
  const [selectedDomain,setSelectedDomain]=useState<DnaDomain|null>(null);
  const [draftDomains,setDraftDomains]=useState<DnaDomain[]>([]);
  const [saveMessage,setSaveMessage]=useState('');
  const matches=matchesFor(active.id).filter(match=>match.durationSeconds>=300&&canonicalLeagueRole(match.role)===active.role);
  const baselineGames=dnaBaselineGameCount(matches,active.role);
  const baselineReady=dnaBaselineReady(baselineGames);
  const roleTasks=(allTasks[active.id]??tasks).filter(task=>taskAppliesToRole(task,active.role));
  const missions=currentGameDnaMissions(roleTasks,active.role);
  const fallbackPair=baselineReady?gameMissionFocusPair(roleTasks,active.role):[];
  const persistedDomains=useMemo(()=>{
    const direct=missions.filter(row=>row.task?.dnaFocusUnlocked===true).map(row=>row.domain);
    return direct.length===2?direct:fallbackPair.map(row=>row.domain);
  },[missions.map(row=>row.task?.id+':'+String(row.task?.dnaFocusUnlocked)).join('|'),fallbackPair.map(row=>row.domain).join('|')]);

  useEffect(()=>{setDraftDomains(persistedDomains);setSelectedDomain(current=>current??persistedDomains[0]??missions[0]?.domain??null)},[persistedDomains.join('|'),active.id,active.role]);

  const latestMatch=[...matches].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
  const selectedMission=missions.find(row=>row.domain===selectedDomain)??missions[0];
  const dirty=draftDomains.length===2&&draftDomains.slice().sort().join('|')!==persistedDomains.slice().sort().join('|');

  function toggleDomain(domain:DnaDomain){
    setSaveMessage('');
    setDraftDomains(current=>{
      if(current.includes(domain))return current.filter(item=>item!==domain);
      if(current.length>=2){setSaveMessage('You can only keep two DNA trees unlocked. Lock one of your current trees first.');return current}
      return[...current,domain];
    });
    setSelectedDomain(domain);
  }

  function saveFocus(){
    if(draftDomains.length!==2){setSaveMessage('Choose exactly two DNA trees to keep unlocked.');return}
    const ok=setDnaFocusDomains(draftDomains);
    setSaveMessage(ok?'Your two active DNA trees are saved. Only these two can bank mission progress.':'Could not save those two trees. Refresh and try again.');
  }

  return <AppShell><main className="missions-page">
    <header className="missions-head">
      <div>
        <div className="eyebrow">LEAGUE · {active.role} · GAME DNA</div>
        <h1>Choose your two DNA trees</h1>
        <p>All six strands stay fully visible, measured and levelled. You choose which two stay unlocked for progression. Only those two can bank mission reps until you swap one out.</p>
      </div>
      <div className="missions-head-actions"><span>{draftDomains.length}/2 UNLOCKED</span><Link className="btn secondary" href="/ilp">OPEN MY DNA →</Link></div>
    </header>

    {!planReady?<section className="panel panel-padding"><div className="eyebrow">LOADING MISSIONS</div><h2>Checking your current plan…</h2></section>:
    planError?<section className="panel panel-padding"><div className="eyebrow">PLAN LOAD ERROR</div><h2>Your missions could not be loaded.</h2><p>{planError}</p><button className="btn secondary" type="button" onClick={()=>window.location.reload()}>RETRY</button></section>:
    !baselineReady?<section className="panel panel-padding missions-baseline"><div className="eyebrow">DNA BASELINE · {baselineGames}/{DNA_BASELINE_GAMES} GAMES</div><h2>All six DNA trees unlock after the baseline.</h2><p>Play normally for {DNA_BASELINE_GAMES-baselineGames} more tracked {active.role} game{DNA_BASELINE_GAMES-baselineGames===1?'':'s'}. After game {DNA_BASELINE_GAMES}, all six trees appear at the same level of detail and you choose the two you want to develop first.</p><div className="missions-track" role="progressbar" aria-label="DNA baseline games" aria-valuenow={baselineGames} aria-valuemin={0} aria-valuemax={DNA_BASELINE_GAMES}><span style={{width:`${baselineGames/DNA_BASELINE_GAMES*100}%`}}/></div><Link className="btn primary" href="/live">OPEN MATCH ROOM →</Link></section>:
    <section className="missions-tree-workspace">
      <div className="missions-tree-toolbar panel">
        <div><div className="eyebrow">YOUR 6 DNA TREES</div><h2>Unlock two. Keep all six visible.</h2><p>The lock only controls progression. Locked trees still keep their level, mission, history and evidence.</p></div>
        <div className="missions-tree-save">
          <span className={draftDomains.length===2?'ready':'not-ready'}>{draftDomains.length}/2 SELECTED</span>
          <button className="btn primary" type="button" disabled={!dirty||draftDomains.length!==2} onClick={saveFocus}>{dirty?'SAVE ACTIVE TREES':'ACTIVE TREES SAVED'}</button>
        </div>
      </div>
      {saveMessage&&<div className="missions-focus-message">{saveMessage}</div>}

      <div className="missions-six-grid">
        {missions.map(({domain,task})=>{
          const style={'--mission-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties;
          const unlocked=draftDomains.includes(domain);
          const level=dnaStrandLevel(roleTasks,domain,active.role);
          const plain=task?plainLanguageFocus(task):null;
          const summary=task?missionSummary(task):null;
          const rep=task?missionRepView(task):null;
          const comparison=task?missionComparisonForMatch(task,latestMatch?.id):null;
          return <article key={domain} className={`missions-tree-card ${unlocked?'unlocked':'locked'} ${selectedDomain===domain?'selected':''}`} style={style}>
            <button className="missions-tree-open" type="button" onClick={()=>setSelectedDomain(domain)} aria-label={`Open ${DNA_DOMAIN_LABELS[domain]} mission details`}>
              <div className="missions-tree-top">
                <div><span>{DNA_DOMAIN_LABELS[domain].toUpperCase()}</span><b>LV {level.level}</b></div>
                <strong>{unlocked?'UNLOCKED':'LOCKED'}</strong>
              </div>
              <div className="missions-tree-level"><i style={{width:`${level.levelProgress}%`}}/></div>
              <h3>{plain?.name??'Mission building'}</h3>
              <p className="missions-tree-meaning">{plain?.meaning??'OP CLIMB is still collecting enough evidence to create a reliable mission for this strand.'}</p>
              <div className="missions-tree-job"><span>CURRENT MISSION</span><p>{plain?.nextGame??'Keep playing tracked games so this strand can become measurable.'}</p></div>
              <div className="missions-tree-proof">
                <div><span>PROVEN</span><b>{summary?`${summary.confirmed}/${summary.required}`:'—'}</b></div>
                <div><span>LATEST</span><b>{comparison?.result??'NOT OBSERVED'}</b></div>
              </div>
              <div className="missions-switch-track"><i style={{width:`${rep?.progress??0}%`}}/></div>
            </button>
            <button className={`missions-tree-toggle ${unlocked?'on':''}`} type="button" onClick={()=>toggleDomain(domain)}>
              <span>{unlocked?'UNLOCKED FOR PROGRESSION':'UNLOCK THIS TREE'}</span><b>{unlocked?'✓':'＋'}</b>
            </button>
          </article>;
        })}
      </div>

      {selectedMission&&(()=>{
        const {domain,task}=selectedMission;
        const style={'--mission-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties;
        const unlocked=draftDomains.includes(domain);
        if(!task)return null;
        const plain=plainLanguageFocus(task);
        const summary=missionSummary(task);
        const rep=missionRepView(task);
        const comparison=missionComparisonForMatch(task,latestMatch?.id);
        const level=dnaStrandLevel(roleTasks,domain,active.role);
        return <article className="panel missions-focus-card" style={style}>
          <div className="missions-focus-top">
            <div><span>{DNA_DOMAIN_LABELS[domain].toUpperCase()} · LV {level.level} · {unlocked?'UNLOCKED':'LOCKED'}</span><small>{unlocked?'This tree can bank progression in your next tracked game':'Fully measured, but progression is locked until you choose this as one of your two active trees'}</small></div>
            <MissionMeasurementBadge metric={task.metric} compact/>
          </div>
          <div className="missions-focus-main">
            <div className="missions-focus-copy">
              <h2>{plain.name}</h2><p className="missions-meaning">{plain.meaning}</p>
              <div className="missions-job"><span>YOUR JOB WHEN THIS TREE IS ACTIVE</span><strong>{plain.nextGame}</strong></div>
            </div>
            <aside className="missions-focus-proof">
              <div className="missions-progress-head"><span>PROVEN GAMES</span><strong>{summary.confirmed}/{summary.required}</strong></div>
              <div className="missions-track"><span style={{width:`${rep.progress}%`}}/></div>
              <p className="missions-progress-note">{summary.remaining?`${summary.remaining} more proven game${summary.remaining===1?'':'s'} to master this mission.`:'Mastery target reached. The next mission on this tree will follow.'}</p>
              <div className="missions-evidence"><span>LATEST GAME</span><strong>{comparison.result}</strong><small>{comparison.detail}</small></div>
              {comparison.events.length>0&&<div className="missions-specific-proof">{comparison.events.map((event,index)=><div key={index}><b>{event.clock}</b><span>{event.label}</span><small>{event.detail}</small></div>)}</div>}
            </aside>
          </div>
          <div className="missions-focus-actions">
            <Link href={`/ilp?dna=${domain}`} className="btn secondary">OPEN TREE DETAILS →</Link>
            {unlocked?<Link href="/live" className="btn primary">TAKE THIS MISSION INTO MATCH ROOM →</Link>:<button className="btn primary" type="button" onClick={()=>toggleDomain(domain)}>UNLOCK THIS TREE</button>}
          </div>
        </article>;
      })()}
    </section>}
  </main></AppShell>;
}
