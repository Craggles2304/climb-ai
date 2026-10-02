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
import {currentGameDnaMissions} from '@/lib/gameDnaSnapshot';
import {dnaStrandLevel} from '@/lib/dnaLevel';

type Tab='CURRENT'|'EVIDENCE'|'HISTORY';
const clean=(value:string)=>value.replaceAll('_',' ');
const strandStyle=(domain:DnaDomain)=>({'--strand-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties);

export default function PlayerDevelopmentCentre(){
  const {active,refresh:refreshAccount}=useAccount();
  const {tier}=useSubscription();
  const {tasks,allTasks,refreshFromMatches,planReady,planError}=useLearningPlan();
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
    return currentGameDnaMissions(tasks,active.role).flatMap(({task})=>task?[task]:[]);
  },[tasks,active.role,baselineReady]);
  const displayTasks=useMemo(()=>selectedDomain?activeTasks.filter(task=>task.dnaDomain===selectedDomain):activeTasks,[activeTasks,selectedDomain]);
  const dnaLevels=useMemo(()=>Object.fromEntries(DNA_DOMAINS.map(domain=>[domain,dnaStrandLevel(tasks,domain,active.role)])) as Record<DnaDomain,ReturnType<typeof dnaStrandLevel>>,[tasks]);
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
      <h2>Pulling your six DNA missions…</h2>
      <p className="muted">OP CLIMB is loading one tracked mission for each Game DNA strand.</p>
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
          <p>{selectedDomain?DNA_DOMAIN_GUIDE[selectedDomain].summary:'Each DNA strand has one current mission. Every tracked game can bank a completion on any strand that clears its target.'}</p>
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
        >{DNA_DOMAIN_LABELS[domain]} · LV {dnaLevels[domain].level}</button>)}
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
      <button type="button" className={tab==='CURRENT'?'active':''} onClick={()=>setTab('CURRENT')}><b>DNA MISSIONS</b><small>{selectedDomain?displayTasks.length+' in '+DNA_DOMAIN_LABELS[selectedDomain]:activeTasks.length+'/6 active'}</small></button>
      <button type="button" className={tab==='EVIDENCE'?'active':''} onClick={()=>setTab('EVIDENCE')}><b>GAME PROOF</b><small>what counted on each strand</small></button>
      {tier==='PRO'?<button type="button" className={tab==='HISTORY'?'active':''} onClick={()=>setTab('HISTORY')}><b>HISTORY</b><small>{mastered.length} mastered · {paused.length} paused</small></button>:<Link className="ip-tab-lock" href="/pricing"><b>HISTORY 🔒</b><small>PRO persistent development</small></Link>}
    </nav>

    {tab==='CURRENT'&&<div className="ip-panel">
      {displayTasks.length?<div className="ip-mission-grid">
        {displayTasks.map(task=><MissionCard key={task.id} task={task} level={dnaLevels[task.dnaDomain]}/>)}
      </div>:<section className="ip-empty">
        <div className="eyebrow">DNA PLAN BUILDING</div>
        <h2>{selectedDomain?'This strand is waiting for its next mission.':'Your six DNA missions are being built.'}</h2>
        <p>Play a tracked game and OP CLIMB will keep one measurable mission attached to each DNA strand.</p>
        <Link className="btn primary" href="/live">OPEN COMPANION →</Link>
      </section>}

      {tier==='PRO'&&mastered.length>0&&<section className="panel panel-padding" style={{marginTop:18}}>
        <div className="section-head"><div><div className="eyebrow">RECENTLY MASTERED</div><h2>Completed strand missions moved into memory.</h2></div><button className="text-btn" type="button" onClick={()=>setTab('HISTORY')}>View history →</button></div>
        <div>
          {mastered.slice(0,6).map(task=><div className="habit done ip-strand-item" style={strandStyle(task.dnaDomain)} key={task.id}>
            <span className="habit-index">✓</span>
            <div><small className="ip-strand-label">{dnaDomainLabel(task.dnaDomain)}</small><h3>{plainLanguageFocus(task).name}</h3><p>{task.gameRule}</p></div>
            <span className="tag">Mastered</span>
          </div>)}
        </div>
      </section>}

      {activeTasks.length>0&&<section className="ip-next">
        <div>
          <span>HOW THE PLAN MOVES</span>
          <h2>Six strands. One mission on each.</h2>
          <p>After every tracked game, OP CLIMB checks all six missions. A mission banks a game when its target is met. Reach 3/3 and that strand moves to its next mission.</p>
        </div>
        <div className="ip-next-actions">
          <Link className="btn primary" href="/live">TRACK NEXT GAME →</Link>
        </div>
      </section>}
    </div>}

    {tab==='EVIDENCE'&&<div className="ip-panel">
      {displayTasks.length?<div className="ip-evidence-grid">
        {displayTasks.map(task=><EvidenceCard key={task.id} task={task} level={dnaLevels[task.dnaDomain]}/>)}
      </div>:<section className="ip-empty"><h2>No strand evidence yet.</h2><p>Complete tracked games to build the 0/3 → 3/3 mission history.</p></section>}
    </div>}

    {tier==='PRO'&&tab==='HISTORY'&&<div className="ip-panel">
      <section className="ip-history-grid">
        <Archive title="MASTERED" empty="Nothing mastered yet." tasks={mastered}/>
        <Archive title="PAUSED" empty="No paused missions." tasks={paused}/>
      </section>
    </div>}
  </AppShell>;
}

function MissionCard({task,level}:{task:ILPTask;level:ReturnType<typeof dnaStrandLevel>}){
  const plain=plainLanguageFocus(task);
  const summary=missionSummary(task);
  const repProgress=Math.round(Math.min(summary.required,summary.confirmed)/Math.max(1,summary.required)*100);
  return <article className="ip-mission primary" style={strandStyle(task.dnaDomain)}>
    <div className="ip-mission-top">
      <span>{dnaDomainLabel(task.dnaDomain).toUpperCase()} · LV {level.level} · DNA MISSION</span>
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
      <small>{summary.confirmed}/{summary.required} games completed · {summary.remaining?summary.remaining+' more clean game'+(summary.remaining===1?'':'s')+' needed':'mission complete'}</small>
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
          <p>Each tracked game that clears the target banks one completion. Reach {summary.required}/{summary.required} and this mission is mastered. Your {dnaDomainLabel(task.dnaDomain)} level is uncapped: {level.xpIntoLevel}/{level.xpForNextLevel} DNA XP toward LV {level.level+1}.</p>
        </section>
        <section>
          <span>04 · WHY IT IS STILL ACTIVE</span>
          <h3>{summary.remaining?`${summary.remaining} proven rep${summary.remaining===1?'':'s'} still needed`:'Ready for a mastery check'}</h3>
          <p>{task.lastUpdatedReason||task.evidence.at(-1)||'OP CLIMB is waiting for enough reliable match evidence to judge the pattern.'}</p>
        </section>
      </div>
      <IlpExplainability task={task}/>
    </details>
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

function EvidenceCard({task,level}:{task:ILPTask;level:ReturnType<typeof dnaStrandLevel>}){
  const summary=missionSummary(task);
  const recent=(task.missionHistory??[]).slice(-4).reverse();
  return <article className="ip-evidence-card" style={strandStyle(task.dnaDomain)}>
    <div className="ip-evidence-head">
      <div><span>{dnaDomainLabel(task.dnaDomain).toUpperCase()} · LV {level.level} · DNA MISSION</span><h2>{plainLanguageFocus(task).name}</h2><MissionMeasurementBadge metric={task.metric} compact/></div>
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
    </div>:<div className="ip-no-reps">No tracked games have counted for this strand mission yet.</div>}
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

function dedupeArchiveTasks(tasks:ILPTask[]){
  const map=new Map<string,ILPTask>();
  tasks.forEach(task=>{
    const key=task.title.toLowerCase()+'|'+task.metric.toLowerCase()+'|'+task.dnaDomain;
    const prev=map.get(key);
    if(!prev||taskFreshness(task)>=taskFreshness(prev))map.set(key,task);
  });
  return [...map.values()];
}

function Pips({passes,required}:{passes:number;required:number}){
  return <div className="ip-pips" aria-label={passes+' of '+required+' clean reps'}>
    {Array.from({length:required},(_,index)=><i key={index} className={index<passes?'on':''}/>)}
  </div>;
}