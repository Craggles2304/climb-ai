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
  const {tasks,allTasks,refreshFromMatches,pauseTask}=useLearningPlan();
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

      {activeTasks.length>0&&<section className="ip-next">
        <div>
          <span>HOW THE PLAN MOVES</span>
          <h2>One mission at a time.</h2>
          <p>Only the core mission asks you to track reps. The watchlist stays in the background until repeated evidence says one behaviour should become your next mission.</p>
        </div>
        <div className="ip-next-actions">
          <Link className="btn primary" href="/session">START 3-GAME BLOCK →</Link>
          <Link className="btn secondary" href="/live">OPEN TRACKING</Link>
        </div>
      </section>}
    </div>}

    {tab==='EVIDENCE'&&<div className="ip-panel">
      {displayCoreTask?<div className="ip-evidence-grid"><EvidenceCard task={displayCoreTask}/></div>:<section className="ip-empty"><h2>{selectedDomain?'No core mission in '+DNA_DOMAIN_LABELS[selectedDomain]+'.':'No core mission evidence yet.'}</h2><p>{selectedDomain?'A watched focus does not create a second rep tracker. Open the full plan to see your core mission.':'Play tracked games to build the plan.'}</p></section>}
    </div>}

    {tier==='PRO'&&tab==='HISTORY'&&<div className="ip-panel">
      <section className="ip-history-grid">
        <Archive title="MASTERED" empty="Nothing mastered yet." tasks={mastered}/>
        <Archive title="PAUSED" empty="No paused missions." tasks={paused}/>
      </section>
    </div>}
  </AppShell>;
}

function MissionCard({task,pauseTask}:{task:ILPTask;pauseTask:(id:string)=>void}){
  const plain=plainLanguageFocus(task);
  const summary=missionSummary(task);
  const repProgress=Math.round(Math.min(summary.required,summary.confirmed)/Math.max(1,summary.required)*100);
  return <article className="ip-mission primary" style={strandStyle(task.dnaDomain)}>
    <div className="ip-mission-top">
      <span>CORE MISSION · THE ONLY SCORED FOCUS</span>
      <div className="ip-mission-meta"><MissionMeasurementBadge metric={task.metric} compact/><em>{dnaDomainLabel(task.dnaDomain)} · {clean(task.category)}</em></div>
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
      <div><span>YOU ARE LEARNING TO</span><b>{learningStageLabel(summary.stage)}</b></div>
    </div>

    <LearningPath stage={summary.stage}/>

    <div className="ip-progress">
      <div><AnimatedBar value={repProgress}/><b>{repProgress}%</b></div>
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

function WatchFocusCard({task,index}:{task:ILPTask;index:number}){
  const plain=plainLanguageFocus(task);
  return <article className="habit ip-strand-item" style={{...strandStyle(task.dnaDomain),padding:14,border:'1px solid var(--border)',background:'rgba(255,255,255,.02)'}}>
    <span className="habit-index">{index+1}</span>
    <div style={{minWidth:0,flex:1}}>
      <small className="ip-strand-label">{dnaDomainLabel(task.dnaDomain)} · WATCH FOCUS</small>
      <h3>{plain.name}</h3>
      <p>{plain.nextGame}</p>
    </div>
    <span className="tag">MONITORING</span>
  </article>;
}

function learningStageLabel(stage:string){
  if(stage==='DISCOVER')return'RECOGNISE THE SITUATION';
  if(stage==='PRACTISE')return'EXECUTE THE DECISION';
  if(stage==='REPEAT')return'REPEAT IT CONSISTENTLY';
  if(stage==='MASTERED')return'HABIT MASTERED';
  return clean(stage);
}

function attemptMeaning(outcome:string,banksPass:boolean){
  if(banksPass)return'You performed the behaviour strongly enough for this game to count toward mastery.';
  if(outcome==='NO_REP')return'The relevant situation was not observed clearly enough, so the game does not count against you.';
  if(outcome==='UNREWARDED')return'The situation occurred, but the behaviour did not clear the mission target this time.';
  if(outcome==='UNEARNED')return'The end result looked acceptable, but the decision evidence was not strong enough to bank the habit.';
  return'This game gave useful evidence, but not a proven rep.';
}

function LearningPath({stage}:{stage:string}){
  const stages=[
    ['DISCOVER','RECOGNISE'],
    ['PRACTISE','EXECUTE'],
    ['REPEAT','REPEAT'],
    ['MASTERED','MASTERED'],
  ] as const;
  const active=Math.max(0,stages.findIndex(([key])=>key===stage));
  return <div className="ip-learning-path">
    <div><span>LEARNING PATH</span><b>{active+1}/4</b></div>
    <ol>{stages.map(([key,label],index)=><li key={key} className={index<active?'done':index===active?'active':''}><i>{index<active?'✓':index+1}</i><span>{label}</span></li>)}</ol>
  </div>;
}

function EvidenceCard({task}:{task:ILPTask}){
  const summary=missionSummary(task);
  const recent=(task.missionHistory??[]).slice(-4).reverse();
  return <article className="ip-evidence-card" style={strandStyle(task.dnaDomain)}>
    <div className="ip-evidence-head">
      <div><span>CORE MISSION · {dnaDomainLabel(task.dnaDomain)}</span><h2>{plainLanguageFocus(task).name}</h2><MissionMeasurementBadge metric={task.metric} compact/></div>
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
    </div>:<div className="ip-no-reps">No reviewed core-mission reps yet.</div>}
  </article>;
}

function Archive({title,empty,tasks}:{title:string;empty:string;tasks:ILPTask[]}){
  return <article className="ip-archive">
    <div className="ip-archive-head"><span>{title}</span><b>{tasks.length}</b></div>
    {tasks.length?<div>{tasks.map(task=><details key={task.id} className="ip-strand-history" style={strandStyle(task.dnaDomain)}>
      <summary><b>{plainLanguageFocus(task).name}</b><span>{dnaDomainLabel(task.dnaDomain)} · {clean(task.category)}</span></summary>
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