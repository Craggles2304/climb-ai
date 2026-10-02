'use client';

import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {filterHistoryForTier,historyWindowLabel} from '@/lib/subscription';
import {AnimatedBar} from '@/components/Motion';
import {IlpExplainability} from '@/components/IlpExplainability';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {missionSummary} from '@/lib/missionLoop';
import type {DnaDomain,ILPTask} from '@/lib/types';
import {accountProgress,XP_PER_MISSION_MASTERY,XP_PER_PROVEN_REP} from '@/lib/accountXp';
import {missionRankBand} from '@/lib/rankMissionBenchmarks';
import {MissionMeasurementBadge} from '@/components/MissionMeasurementBadge';
import {DNA_DOMAINS,DNA_DOMAIN_COLORS,DNA_DOMAIN_GUIDE,DNA_DOMAIN_LABELS,dnaDomainLabel} from '@/lib/dnaDomain';
import {positiveEvidenceForMatch} from '@/lib/positiveEvidence';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {MyClimbGameImpact} from '@/components/MyClimbGameImpact';
import {taskFreshness} from '@/lib/ilpCloudMerge';

type Tab='CURRENT'|'EVIDENCE'|'HISTORY';
const clean=(value:string)=>value.replaceAll('_',' ');
const strandStyle=(domain:DnaDomain)=>({'--strand-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties);

export default function PlayerDevelopmentCentre(){
  const {active,refresh:refreshAccount}=useAccount();
  const {tier}=useSubscription();
  const {tasks,allTasks,refreshFromMatches,pauseTask,planReady,planError}=useLearningPlan();
  const [tab,setTab]=useState<Tab>('CURRENT');
  const [changes,setChanges]=useState<string[]>([]);
  const [checking,setChecking]=useState(false);
  const [selectedDomain,setSelectedDomain]=useState<DnaDomain|null>(null);
  const [selectedGame,setSelectedGame]=useState<string>('');

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const raw=params.get('dna');
    setSelectedDomain(DNA_DOMAINS.includes(raw as DnaDomain)?raw as DnaDomain:null);
    setSelectedGame(params.get('game')||'');
  },[]);

  const chooseDomain=(domain:DnaDomain|null)=>{
    setSelectedDomain(domain);
    const url=new URL(window.location.href);
    if(domain)url.searchParams.set('dna',domain);else url.searchParams.delete('dna');
    window.history.replaceState({},'',url.pathname+url.search);
  };

  const allRoleMatches=matchesFor(active.id).filter(match=>match.durationSeconds>=300&&match.role===active.role);
  const baselineGames=useMemo(()=>dnaBaselineGameCount(allRoleMatches,active.role),[allRoleMatches,active.role]);
  const baselineReady=dnaBaselineReady(baselineGames);
  const activeTasks=useMemo(()=>{
    if(!baselineReady)return[];
    const live=tasks.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED').slice(0,3);
    return tier==='FREE'?live.slice(0,1):live;
  },[tasks,tier,baselineReady]);
  const coreTask=activeTasks[0]??null;
  const watchTasks=activeTasks.slice(1);
  const displayCoreTask=useMemo(()=>coreTask&&(!selectedDomain||coreTask.dnaDomain===selectedDomain)?coreTask:null,[coreTask,selectedDomain]);
  const displayWatchTasks=useMemo(()=>selectedDomain?watchTasks.filter(task=>task.dnaDomain===selectedDomain):watchTasks,[watchTasks,selectedDomain]);
  const masteredAll=useMemo(()=>dedupeArchiveTasks(tasks.filter(task=>task.status==='MASTERED')),[tasks]);
  const pausedAll=useMemo(()=>dedupeArchiveTasks(tasks.filter(task=>task.status==='PAUSED')),[tasks]);
  const mastered=useMemo(()=>selectedDomain?masteredAll.filter(task=>task.dnaDomain===selectedDomain):masteredAll,[masteredAll,selectedDomain]);
  const paused=useMemo(()=>selectedDomain?pausedAll.filter(task=>task.dnaDomain===selectedDomain):pausedAll,[pausedAll,selectedDomain]);
  const matches=filterHistoryForTier(allRoleMatches,tier);
  const selectedMatch=useMemo(()=>selectedGame?matches.find(match=>match.id===selectedGame):undefined,[matches,selectedGame]);
  const impactMatch=selectedMatch??matches[0];
  const impactMatchId=impactMatch?.id??'';
  const gameLearning=useMemo(()=>impactMatchId?tasks.flatMap(task=>{
    const attempt=(task.missionHistory??[]).find(item=>item.matchId===impactMatchId);
    return attempt?[{task,attempt,summary:missionSummary(task)}]:[];
  }):[],[tasks,impactMatchId]);
  const gameStrengths=useMemo(()=>impactMatch?positiveEvidenceForMatch(impactMatch,active.rank):[],[impactMatch,active.rank]);
  const xp=accountProgress(allTasks[active.id]??tasks);

  const refresh=async()=>{
    setChecking(true);
    try{
      await refreshAccount();
      setChanges([baselineReady?'Latest match data fetched. New evidence will be applied to your current challenges automatically.':'Latest match data fetched. Baseline progress will update when the tracked game is available.']);
    }finally{
      setChecking(false);
    }
  };

  if(!planReady)return <AppShell>
    <section className="panel panel-padding">
      <div className="eyebrow">LOADING YOUR PLAN</div>
      <h2>Pulling your core mission…</h2>
      <p className="muted">OP CLIMB is loading the evidence-backed plan already stored for this Riot account.</p>
    </section>
  </AppShell>;

  if(planError)return <AppShell>
    <section className="panel panel-padding">
      <div className="eyebrow">PLAN LOAD ERROR</div>
      <h2>Your plan is still stored.</h2>
      <p className="muted">{planError}</p>
      <button className="btn secondary" type="button" onClick={()=>window.location.reload()}>RETRY PLAN LOAD</button>
    </section>
  </AppShell>;

  if(!baselineReady)return <AppShell>
    <MyClimbGameImpact
      match={impactMatch}
      learning={[]}
      strengths={[]}
      activeTasks={[]}
      baselineGames={baselineGames}
      baselineRequired={DNA_BASELINE_GAMES}
    />
  </AppShell>;

  return <AppShell>
    {impactMatch&&<MyClimbGameImpact
      match={impactMatch}
      learning={gameLearning}
      strengths={gameStrengths}
      activeTasks={activeTasks}
      baselineGames={baselineGames}
      baselineRequired={DNA_BASELINE_GAMES}
    />}

    <section className="ip-dna-filter panel panel-padding" style={selectedDomain?({'--strand-color':DNA_DOMAIN_COLORS[selectedDomain]} as CSSProperties):undefined}>
      <div className="ip-dna-filter-head">
        <div>
          <div className="eyebrow">GAME DNA → MY CLIMB</div>
          <h2>{selectedDomain?DNA_DOMAIN_LABELS[selectedDomain]:'Your development plan'}</h2>
          <p>{selectedDomain?DNA_DOMAIN_GUIDE[selectedDomain].summary:'One scored core mission sits at the centre. Up to two watch focuses stay in the background until they earn promotion.'}</p>
        </div>
        {selectedDomain&&<button className="btn secondary" type="button" onClick={()=>chooseDomain(null)}>SHOW FULL PLAN</button>}
      </div>
      <div className="ip-dna-filter-tabs" aria-label="Filter development plan by Game DNA strand">
        <button type="button" className={!selectedDomain?'active':''} onClick={()=>chooseDomain(null)}>ALL</button>
        {DNA_DOMAINS.map(domain=><button
          key={domain}
          type="button"
          className={selectedDomain===domain?'active':''}
          style={({ '--strand-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties)}
          onClick={()=>chooseDomain(domain)}
        >{DNA_DOMAIN_LABELS[domain]}</button>)}
      </div>
      {selectedDomain&&<div className="ip-dna-filter-detail">
        <p>{DNA_DOMAIN_GUIDE[selectedDomain].purpose}</p>
        <div>{DNA_DOMAIN_GUIDE[selectedDomain].subskills.map(skill=><span key={skill}>{skill}</span>)}</div>
      </div>}
    </section>

    {changes.length>0&&<section className="ip-update">
      <div><span>PLAN UPDATED</span><b>{changes.length} CHANGE{changes.length===1?'':'S'}</b></div>
      <details open><summary>WHAT CHANGED</summary>{changes.map(change=><p key={change}>{change}</p>)}</details>
    </section>}

    <nav className="ip-tabs" aria-label="Development plan sections">
      <button type="button" className={tab==='CURRENT'?'active':''} onClick={()=>setTab('CURRENT')}><b>CURRENT PLAN</b><small>{selectedDomain?((displayCoreTask?1:0)+displayWatchTasks.length)+' in '+DNA_DOMAIN_LABELS[selectedDomain]:(coreTask?'1 core · '+watchTasks.length+' watched':'building')}</small></button>
      <button type="button" className={tab==='EVIDENCE'?'active':''} onClick={()=>setTab('EVIDENCE')}><b>CORE PROOF</b><small>why the main mission is here</small></button>
      {tier==='PRO'?<button type="button" className={tab==='HISTORY'?'active':''} onClick={()=>setTab('HISTORY')}><b>HISTORY</b><small>{mastered.length} mastered · {paused.length} paused</small></button>:<Link className="ip-tab-lock" href="/pricing"><b>HISTORY 🔒</b><small>PRO persistent development</small></Link>}
    </nav>

    {tab==='CURRENT'&&<div className="ip-panel">
      {(displayCoreTask||displayWatchTasks.length)?<>
        {displayCoreTask&&<div className="ip-mission-grid"><MissionCard task={displayCoreTask} pauseTask={pauseTask}/></div>}
        {displayWatchTasks.length>0&&<section className="panel panel-padding" style={{marginTop:16}}>
          <div className="section-head">
            <div><div className="eyebrow">WATCHLIST · NOT EXTRA MISSIONS</div><h2>What OP CLIMB is monitoring next.</h2></div>
            <small>These do not need another checklist in your head. They only become the core mission if repeated evidence promotes them.</small>
          </div>
          <div style={{display:'grid',gap:10}}>
            {displayWatchTasks.map((task,index)=><WatchFocusCard key={task.id} task={task} index={index}/>)}
          </div>
        </section>}
      </>:selectedDomain?<section className="ip-empty">
        <div className="eyebrow">{DNA_DOMAIN_LABELS[selectedDomain].toUpperCase()} · NOT CURRENTLY PRIORITISED</div>
        <h2>This strand is not in your plan right now.</h2>
        <p>{tier==='FREE'?'FREE keeps one measurable core mission live at a time.':'OP CLIMB only promotes a strand when repeated evidence makes it important enough.'}</p>
        <button className="btn secondary" type="button" onClick={()=>chooseDomain(null)}>SHOW CURRENT PLAN</button>
      </section>:<section className="ip-empty">
        <div className="eyebrow">PLAN BUILDING</div>
        <h2>Play a tracked game.</h2>
        <p>OP CLIMB needs real evidence before it chooses your core mission.</p>
        <Link className="btn primary" href="/live">OPEN COMPANION →</Link>
      </section>}

      {tier==='PRO'&&mastered.length>0&&<section className="panel panel-padding" style={{marginTop:18}}>
        <div className="section-head"><div><div className="eyebrow">RECENTLY MASTERED</div><h2>Habits that moved into memory.</h2></div><button className="text-btn" type="button" onClick={()=>setTab('HISTORY')}>View history →</button></div>
        <div>
          {mastered.slice(0,3).map(task=><div className="habit done ip-strand-item" style={strandStyle(task.dnaDomain)} key={task.id}>
            <span className="habit-index">✓</span>
            <div><small className="ip-strand-label">{dnaDomainLabel(task.dnaDomain)}</small><h3>{plainLanguageFocus(task).name}</h3><p>{task.gameRule}</p></div>
            <span className="tag">Mastered</span>
          </div>)}
        </div>
      </section>}
