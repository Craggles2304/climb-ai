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
import {missionJudging,type MissionJudging} from '@/lib/howJudged';
import '../climb-plan-tabs.css';

type MissionTab='active'|'trees';

function MissionJudgingBox({judging}:{judging:MissionJudging}){
  return <div className="cp-judge">
    <span>HOW EACH GAME IS JUDGED</span>
    <dl>
      <div><dt>What OP CLIMB measures</dt><dd>{judging.measures}</dd></div>
      <div className="good"><dt>✓ Proven game</dt><dd>{judging.pass}</dd></div>
      <div className="nocount"><dt>– Doesn't count</dt><dd>{judging.doesNotCount}</dd></div>
    </dl>
  </div>;
}

export default function Missions(){
  const {active}=useAccount();
  const {tasks,allTasks,planReady,planError,setDnaFocusDomains}=useLearningPlan();
  const [tab,setTab]=useState<MissionTab>('active');
  const [selectedDomain,setSelectedDomain]=useState<DnaDomain|null>(null);
  const [swapTarget,setSwapTarget]=useState<DnaDomain|null>(null);
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

  useEffect(()=>{setSelectedDomain(current=>current??persistedDomains[0]??missions[0]?.domain??null)},[persistedDomains.join('|'),active.id,active.role]);

  const latestMatch=[...matches].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
  const selectedMission=missions.find(row=>row.domain===selectedDomain)??missions[0];
  function requestUnlock(domain:DnaDomain){
    setSelectedDomain(domain);
    if(persistedDomains.includes(domain)){
      setSwapTarget(null);
      setSaveMessage(`${DNA_DOMAIN_LABELS[domain]} is already one of your two active DNA trees. Choose a locked tree if you want to swap it out.`);
      return;
    }
    if(persistedDomains.length<2){
      const next=[...persistedDomains,domain];
      if(next.length===2&&setDnaFocusDomains(next)){
        setSwapTarget(null);
        setSaveMessage(`${DNA_DOMAIN_LABELS[domain]} is now unlocked for progression.`);
      }else{
        setSaveMessage('OP CLIMB needs two active DNA trees. Choose one more tree.');
      }
      return;
    }
    setSwapTarget(domain);
    setSaveMessage(`Unlock ${DNA_DOMAIN_LABELS[domain]}: choose which active tree to replace on this card.`);
  }

  function replaceActiveTree(replaceDomain:DnaDomain){
    if(!swapTarget)return;
    const next=persistedDomains.filter(domain=>domain!==replaceDomain).concat(swapTarget);
    if(next.length!==2){setSaveMessage('Could not build a valid two-tree selection. Refresh and try again.');return}
    const incoming=swapTarget;
    const ok=setDnaFocusDomains(next);
    if(ok){
      setSelectedDomain(incoming);
      setSwapTarget(null);
      setSaveMessage(`${DNA_DOMAIN_LABELS[incoming]} unlocked. ${DNA_DOMAIN_LABELS[replaceDomain]} is now locked. Changes are saved automatically.`);
    }else{
      setSaveMessage('Could not save that DNA tree swap. Refresh and try again.');
    }
  }

  useEffect(()=>{
    const read=()=>setTab(window.location.hash==='#trees'?'trees':'active');
    read();
    window.addEventListener('hashchange',read);
    return()=>window.removeEventListener('hashchange',read);
  },[]);
  function openTab(next:MissionTab,domain?:DnaDomain){
    setTab(next);
    if(domain)setSelectedDomain(domain);
    try{window.history.replaceState(null,'','#'+next)}catch{}
  }

  const activeCards=persistedDomains.map(domain=>missions.find(row=>row.domain===domain)).filter(Boolean) as typeof missions;

  return <AppShell><main className="missions-page cp-page">
    <header className="ms-head panel">
      <div>
        <div className="eyebrow">LEAGUE · {active.role} · MISSIONS</div>
        <h1>Your missions</h1>
        <p>You work on two missions at a time. Each one has a pass mark. Hit it in enough tracked games and the mission is passed, then the next one on that DNA tree starts.</p>
      </div>
      <Link className="btn secondary" href="/progress">OPEN MY CLIMB PLAN →</Link>
    </header>

    {planReady&&!planError&&baselineReady&&<nav className="cp-tabs ms-tabs" role="tablist" aria-label="Mission sections">
      <button type="button" role="tab" aria-selected={tab==='active'} className={tab==='active'?'active':''} onClick={()=>openTab('active')}><b>My 2 missions<em>{activeCards.length}</em></b><small>What to do + progress</small></button>
      <button type="button" role="tab" aria-selected={tab==='trees'} className={tab==='trees'?'active':''} onClick={()=>openTab('trees')}><b>All 6 DNA trees</b><small>Swap which two are active</small></button>
      <Link href="/ilp" className="cp-tab-link"><b>My DNA →</b><small>Full strand details</small></Link>
    </nav>}

    {planReady&&!planError&&baselineReady&&tab==='active'&&<section className="ms-active">
      {activeCards.length?activeCards.map(({domain,task})=>{
        const style={'--mission-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties;
        const level=dnaStrandLevel(roleTasks,domain,active.role);
        if(!task)return <article key={domain} className="panel ms-card" style={style}>
          <div className="ms-card-top"><span>{DNA_DOMAIN_LABELS[domain].toUpperCase()} · LV {level.level}</span><em className="ms-status locked">BUILDING</em></div>
          <h2>Mission being prepared</h2>
          <p>Keep playing tracked games so this tree has enough evidence for a fair mission.</p>
        </article>;
        const plain=plainLanguageFocus(task);
        const summary=missionSummary(task);
        const comparison=missionComparisonForMatch(task,latestMatch?.id);
        const passed=summary.remaining===0;
        const started=summary.confirmed>0||summary.reviewed>0;
        return <article key={domain} className="panel ms-card" style={style}>
          <div className="ms-card-top">
            <span>{DNA_DOMAIN_LABELS[domain].toUpperCase()} · LV {level.level}</span>
            <em className={'ms-status '+(passed?'passed':'progress')}>{passed?'PASSED':started?'IN PROGRESS':'NOT STARTED'}</em>
          </div>
          <h2>{plain.name}</h2>
          <p>{plain.meaning}</p>
          <ol className="cp-checklist">
            <li><i>1</i><div><span>Next game, do this</span><b>{plain.nextGame}</b></div></li>
          </ol>
          <MissionJudgingBox judging={missionJudging(task,plain.success)}/>
          <div>
            <div className="ms-count"><span>PROVEN GAMES</span><strong>{summary.confirmed} / {summary.required}</strong></div>
            <div className="cp-bar" style={{'--strand-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties}><i style={{width:`${Math.min(100,Math.round(summary.confirmed/Math.max(1,summary.required)*100))}%`}}/></div>
            <p className="cp-bar-note">{passed?'Pass mark reached. The next mission on this tree starts automatically.':`${summary.remaining} more proven game${summary.remaining===1?'':'s'} to pass.`}</p>
          </div>
          <div className="ms-latest"><span>Last game</span><b>{comparison.result==='NOT OBSERVED'?'NO RESULT YET':comparison.result}</b></div>
          <div className="ms-actions">
            <Link href="/live" className="btn primary">TAKE INTO MATCH ROOM →</Link>
            <button type="button" className="btn secondary" onClick={()=>openTab('trees',domain)}>DETAILS</button>
          </div>
        </article>;
      }):<article className="panel ms-card"><h2>Pick your two missions</h2><p>Choose which two DNA trees you want to work on first.</p><div className="ms-actions"><button type="button" className="btn primary" onClick={()=>openTab('trees')}>CHOOSE DNA TREES →</button></div></article>}
    </section>}

    {!planReady?<section className="panel panel-padding"><div className="eyebrow">LOADING MISSIONS</div><h2>Checking your current plan…</h2></section>:
    planError?<section className="panel panel-padding"><div className="eyebrow">PLAN LOAD ERROR</div><h2>Your missions could not be loaded.</h2><p>{planError}</p><button className="btn secondary" type="button" onClick={()=>window.location.reload()}>RETRY</button></section>:
    !baselineReady?<section className="panel panel-padding missions-baseline"><div className="eyebrow">DNA BASELINE · {baselineGames}/{DNA_BASELINE_GAMES} GAMES</div><h2>All six DNA trees unlock after the baseline.</h2><p>Play normally for {DNA_BASELINE_GAMES-baselineGames} more tracked {active.role} game{DNA_BASELINE_GAMES-baselineGames===1?'':'s'}. After game {DNA_BASELINE_GAMES}, all six trees appear at the same level of detail and you choose the two you want to develop first.</p><div className="missions-track" role="progressbar" aria-label="DNA baseline games" aria-valuenow={baselineGames} aria-valuemin={0} aria-valuemax={DNA_BASELINE_GAMES}><span style={{width:`${baselineGames/DNA_BASELINE_GAMES*100}%`}}/></div><Link className="btn primary" href="/live">OPEN MATCH ROOM →</Link></section>:
    tab!=='trees'?null:
    <section className="missions-tree-workspace">
      <div className="missions-tree-toolbar panel">
        <div><div className="eyebrow">YOUR 6 DNA TREES</div><h2>Pick which two you work on</h2><p>Only your two active trees count progress. Locked trees keep their level and history, so you can swap at any time without losing anything.</p></div>
        <div className="missions-tree-save">
          <span className={persistedDomains.length===2?'ready':'not-ready'}>{persistedDomains.length}/2 ACTIVE</span>
          <small>Changes save instantly</small>
        </div>
      </div>
      {saveMessage&&<div className="missions-focus-message">{saveMessage}</div>}

      <div className="missions-six-grid">
        {missions.map(({domain,task})=>{
          const style={'--mission-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties;
          const unlocked=persistedDomains.includes(domain);
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
            <button className={`missions-tree-toggle ${unlocked?'on':''}`} type="button" onClick={()=>requestUnlock(domain)}>
              <span>{unlocked?'ACTIVE DNA TREE':'UNLOCK THIS TREE'}</span><b>{unlocked?'✓':'＋'}</b>
            </button>
            {swapTarget===domain&&!unlocked&&<div className="missions-tree-swap">
              <span>YOU ALREADY HAVE 2 ACTIVE TREES</span>
              <b>Which one should this replace?</b>
              <div>{persistedDomains.map(activeDomain=><button key={activeDomain} type="button" onClick={()=>replaceActiveTree(activeDomain)}>REPLACE {DNA_DOMAIN_LABELS[activeDomain].toUpperCase()}</button>)}</div>
              <button className="missions-tree-swap-cancel" type="button" onClick={()=>{setSwapTarget(null);setSaveMessage('')}}>CANCEL</button>
            </div>}
          </article>;
        })}
      </div>

      {selectedMission&&(()=>{
        const {domain,task}=selectedMission;
        const style={'--mission-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties;
        const unlocked=persistedDomains.includes(domain);
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
              <div className="missions-job"><span>PASS MARK</span><strong>{plain.success}</strong></div>
              <MissionJudgingBox judging={missionJudging(task,plain.success)}/>
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
            {unlocked?<Link href="/live" className="btn primary">TAKE THIS MISSION INTO MATCH ROOM →</Link>:<button className="btn primary" type="button" onClick={()=>requestUnlock(domain)}>UNLOCK THIS TREE</button>}
          </div>
        </article>;
      })()}
    </section>}
  </main></AppShell>;
}
