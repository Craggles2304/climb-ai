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
import type {DnaDomain,ILPTask,Role} from '@/lib/types';
import {accountProgress,XP_PER_MISSION_MASTERY,XP_PER_PROVEN_REP} from '@/lib/accountXp';
import {missionRankBand} from '@/lib/rankMissionBenchmarks';
import {MissionMeasurementBadge} from '@/components/MissionMeasurementBadge';
import {DNA_DOMAINS,DNA_DOMAIN_COLORS,DNA_DOMAIN_GUIDE,DNA_DOMAIN_LABELS,dnaDomainLabel} from '@/lib/dnaDomain';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {DnaRoleSwitcher} from '@/components/DnaRoleSwitcher';
import {ClientGameDna,type ClientDnaMission} from '@/components/ClientGameDna';
import {taskFreshness} from '@/lib/ilpCloudMerge';
import {currentGameDnaMissions,gameDnaClientMissions} from '@/lib/gameDnaSnapshot';
import {dnaStrandLevel} from '@/lib/dnaLevel';
import {canonicalLeagueRole,LEAGUE_ROLES,taskAppliesToRole} from '@/lib/roleAwareLearning';

type Tab='CURRENT'|'EVIDENCE'|'HISTORY';
const clean=(value:string)=>value.replaceAll('_',' ');
const strandStyle=(domain:DnaDomain)=>({'--strand-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties);

export default function PlayerDevelopmentCentre(){
  const {active,refresh:refreshAccount}=useAccount();
  const {tier}=useSubscription();
  const {tasks,allTasks,planReady,planError}=useLearningPlan();
  const [tab,setTab]=useState<Tab>('CURRENT');
  const [changes,setChanges]=useState<string[]>([]);
  const [checking,setChecking]=useState(false);
  const [selectedDomain,setSelectedDomain]=useState<DnaDomain|null>(null);
  const [viewRole,setViewRole]=useState<Role>(active.role);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const raw=params.get('dna');
    const role=params.get('role') as Role|null;
    setSelectedDomain(DNA_DOMAINS.includes(raw as DnaDomain)?raw as DnaDomain:null);
    setViewRole(role&&LEAGUE_ROLES.includes(role)?role:active.role);
  },[active.id,active.role]);

  const chooseDomain=(domain:DnaDomain|null)=>{
    setSelectedDomain(domain);
    const url=new URL(window.location.href);
    if(domain)url.searchParams.set('dna',domain);else url.searchParams.delete('dna');
    window.history.replaceState({},'',url.pathname+url.search);
  };
  const chooseRole=(role:Role)=>{
    setViewRole(role);
    const url=new URL(window.location.href);
    url.searchParams.set('role',role);
    url.searchParams.delete('game');
    window.history.replaceState({},'',url.pathname+url.search);
  };

  const accountMatches=matchesFor(active.id).filter(match=>match.durationSeconds>=300);
  const roleGameCounts=Object.fromEntries(LEAGUE_ROLES.map(role=>[role,dnaBaselineGameCount(accountMatches,role)])) as Record<Role,number>;
  const allRoleMatches=accountMatches.filter(match=>canonicalLeagueRole(match.role)===viewRole);
  const baselineGames=roleGameCounts[viewRole]??0;
  const baselineReady=dnaBaselineReady(baselineGames);
  const accountTasks=allTasks[active.id]??tasks;
  const roleTasks=useMemo(()=>accountTasks.filter(task=>taskAppliesToRole(task,viewRole)),[accountTasks,viewRole]);
  const dnaMissions=useMemo<ClientDnaMission[]>(()=>gameDnaClientMissions(roleTasks,viewRole),[roleTasks,viewRole]);
  const activeTasks=useMemo(()=>{
    if(!baselineReady)return[];
    return currentGameDnaMissions(roleTasks,viewRole).flatMap(({task})=>task?[task]:[]);
  },[roleTasks,viewRole,baselineReady]);
  const priorityTask=useMemo(()=>[...activeTasks].sort((a,b)=>(a.priority??99)-(b.priority??99))[0]??null,[activeTasks]);
  const focusDomain=selectedDomain??priorityTask?.dnaDomain??null;
  const focusTask=useMemo(()=>focusDomain?activeTasks.find(task=>task.dnaDomain===focusDomain)??null:null,[activeTasks,focusDomain]);
  const displayTasks=useMemo(()=>focusTask?[focusTask]:[],[focusTask]);
  const dnaLevels=useMemo(()=>Object.fromEntries(DNA_DOMAINS.map(domain=>[domain,dnaStrandLevel(roleTasks,domain,viewRole)])) as Record<DnaDomain,ReturnType<typeof dnaStrandLevel>>,[roleTasks,viewRole]);
  const masteredAll=useMemo(()=>dedupeArchiveTasks(roleTasks.filter(task=>task.status==='MASTERED')),[roleTasks]);
  const pausedAll=useMemo(()=>dedupeArchiveTasks(roleTasks.filter(task=>task.status==='PAUSED')),[roleTasks]);
  const mastered=useMemo(()=>selectedDomain?masteredAll.filter(task=>task.dnaDomain===selectedDomain):masteredAll,[masteredAll,selectedDomain]);
  const paused=useMemo(()=>selectedDomain?pausedAll.filter(task=>task.dnaDomain===selectedDomain):pausedAll,[pausedAll,selectedDomain]);
  const matches=filterHistoryForTier(allRoleMatches,tier);
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
    <header className="my-dna-hero">
      <div>
        <div className="eyebrow">MY DNA · {viewRole} PLAYER IDENTITY</div>
        <h1>Your game starts here.</h1>
        <p>Six strands will become your living player profile. OP CLIMB keeps them at zero until it has seen three real {viewRole} games, so your DNA is earned from evidence rather than guessed.</p>
      </div>
      <Link className="btn primary" href="/live">PLAY BASELINE GAME {Math.min(baselineGames+1,DNA_BASELINE_GAMES)} →</Link>
    </header>

    <DnaRoleSwitcher role={viewRole} primaryRole={active.role} gameCounts={roleGameCounts} baselineRequired={DNA_BASELINE_GAMES} onChange={chooseRole}/>

    <section className="my-dna-stage" aria-label={`${viewRole} Game DNA baseline`}>
      <div className="my-dna-stage-head">
        <div><span>GAME DNA · BUILDING</span><strong>{baselineGames}/{DNA_BASELINE_GAMES} games observed</strong></div>
        <small>Play normally. Your first three role games establish the starting shape.</small>
      </div>
      <ClientGameDna player={active.gameName+active.tagline} role={viewRole} missions={dnaMissions} baselineGames={baselineGames} baselineRequired={DNA_BASELINE_GAMES}/>
    </section>

    <section className="op-dna-baseline-callout panel">
      <div><span>WHAT HAPPENS NEXT</span><h2>Finish the baseline → reveal your first real fix.</h2><p>After game three, OP CLIMB turns repeated evidence into six strand missions and tells you which one to carry into the next game.</p></div>
      <Link className="btn secondary" href="/live">OPEN MATCH ROOM →</Link>
    </section>
  </AppShell>;

  return <AppShell>
    <header className="my-dna-hero">
      <div>
        <div className="eyebrow">MY DNA · YOUR PLAYER IDENTITY</div>
        <h1>This is the player your decisions are building.</h1>
        <p>Game DNA is the centre of OP CLIMB. Every tracked {viewRole} game updates the evidence behind these six strands, while missions turn the weakest behaviours into something you can actually train.</p>
      </div>
      <Link className="btn primary" href="/live">PLAY NEXT GAME →</Link>
    </header>

    <DnaRoleSwitcher role={viewRole} primaryRole={active.role} gameCounts={roleGameCounts} baselineRequired={DNA_BASELINE_GAMES} onChange={chooseRole}/>

    <div className="my-dna-workspace">
      <section className="my-dna-stage" aria-label={`${viewRole} interactive Game DNA`}>
        <div className="my-dna-stage-head">
          <div><span>LIVE {viewRole} GAME DNA</span><strong>Your six-strand development profile</strong></div>
          <small>Select a strand. Its mission opens beside your DNA.</small>
        </div>
        <ClientGameDna player={active.gameName+active.tagline} role={viewRole} missions={dnaMissions} baselineGames={baselineGames} baselineRequired={DNA_BASELINE_GAMES}/>
      </section>

      <MissionHub
        tasks={activeTasks}
        focusDomain={focusDomain}
        levels={dnaLevels}
        role={viewRole}
        onSelect={chooseDomain}
      />
    </div>

    {changes.length>0&&<section className="ip-update">
      <div><span>PLAN UPDATED</span><b>{changes.length} CHANGE{changes.length===1?'':'S'}</b></div>
      <details open><summary>WHAT CHANGED</summary>{changes.map(change=><p key={change}>{change}</p>)}</details>
    </section>}

    <nav className="ip-tabs ip-tabs-optional" aria-label="Optional DNA detail">
      <button type="button" className={tab==='EVIDENCE'?'active':''} onClick={()=>setTab(tab==='EVIDENCE'?'CURRENT':'EVIDENCE')}><b>GAME PROOF</b><small>{tab==='EVIDENCE'?'hide proof':'open proof for selected mission'}</small></button>
      {tier==='PRO'?<button type="button" className={tab==='HISTORY'?'active':''} onClick={()=>setTab(tab==='HISTORY'?'CURRENT':'HISTORY')}><b>HISTORY</b><small>{tab==='HISTORY'?'hide history':mastered.length+' mastered · '+paused.length+' paused'}</small></button>:<Link className="ip-tab-lock" href="/pricing"><b>HISTORY 🔒</b><small>PRO persistent development</small></Link>}
    </nav>

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

function MissionHub({tasks,focusDomain,levels,role,onSelect}:{tasks:ILPTask[];focusDomain:DnaDomain|null;levels:Record<DnaDomain,ReturnType<typeof dnaStrandLevel>>;role:Role;onSelect:(domain:DnaDomain)=>void}){
  const focusTask=focusDomain?tasks.find(task=>task.dnaDomain===focusDomain)??null:null;
  return <section className="dna-mission-hub" aria-label={role+' Game DNA missions'}>
    <div className="dna-mission-hub-head">
      <div>
        <div className="eyebrow">YOUR 6 DNA MISSIONS</div>
        <h2>Every strand has one job.</h2>
        <p>You do not need to memorise six coaching reports. Each strand carries one simple behaviour to practise, and OP CLIMB checks it automatically in your tracked {role} games.</p>
      </div>
      <div className="dna-mission-how" aria-label="How missions work">
        <span><b>1</b><small>DO</small><em>one clear behaviour</em></span>
        <span><b>2</b><small>PROVE</small><em>bank it in tracked games</em></span>
        <span><b>3</b><small>MASTER</small><em>3/3 → next mission</em></span>
      </div>
    </div>

    <div className="dna-mission-rail" aria-label="Choose a DNA mission">
      {DNA_DOMAINS.map(domain=>{
        const task=tasks.find(item=>item.dnaDomain===domain);
        if(!task)return <div key={domain} className="dna-mission-chip empty" style={strandStyle(domain)}><small>{DNA_DOMAIN_LABELS[domain]}</small><b>Building mission…</b></div>;
        const plain=plainLanguageFocus(task);
        const summary=missionSummary(task);
        return <button
          key={domain}
          type="button"
          className={'dna-mission-chip '+(focusDomain===domain?'active':'')}
          style={strandStyle(domain)}
          onClick={()=>onSelect(domain)}
          aria-pressed={focusDomain===domain}
        >
          <small>{DNA_DOMAIN_LABELS[domain]} · LV {levels[domain].level}</small>
          <b>{plain.name}</b>
          <span>{summary.confirmed}/{summary.required} proven</span>
        </button>;
      })}
    </div>

    {focusTask?<MissionSpotlight task={focusTask} level={levels[focusTask.dnaDomain]} role={role}/>:<div className="dna-mission-spotlight empty">
      <div><span>MISSION BUILDING</span><h3>Your next mission will appear here.</h3><p>Play another tracked {role} game so OP CLIMB can attach a measurable behaviour to this strand.</p></div>
    </div>}
  </section>;
}

function MissionSpotlight({task,level,role}:{task:ILPTask;level:ReturnType<typeof dnaStrandLevel>;role:Role}){
  const plain=plainLanguageFocus(task);
  const summary=missionSummary(task);
  const repProgress=Math.round(Math.min(summary.required,summary.confirmed)/Math.max(1,summary.required)*100);
  return <article className="dna-mission-spotlight" style={strandStyle(task.dnaDomain)}>
    <div className="dna-mission-spotlight-top">
      <div>
        <span>{dnaDomainLabel(task.dnaDomain).toUpperCase()} · LV {level.level} · YOUR MISSION</span>
        <h2>{plain.name}</h2>
      </div>
      <div className="dna-mission-count"><b>{summary.confirmed}/{summary.required}</b><small>PROVEN GAMES</small></div>
    </div>

    <div className="dna-mission-explain">
      <section><span>WHAT THIS MEANS</span><p>{plain.meaning}</p></section>
      <section className="primary"><span>YOUR JOB NEXT GAME</span><p>{plain.nextGame}</p></section>
      <section><span>WHY IT MATTERS</span><p>{plain.why}</p></section>
      <section><span>HOW YOU PROVE IT</span><p>{plain.success}</p></section>
    </div>

    <div className="dna-mission-proof">
      <div>
        <span>MISSION PROGRESS</span>
        <AnimatedBar value={repProgress}/>
        <small>{summary.remaining?summary.remaining+' more proven '+role+' game'+(summary.remaining===1?'':'s')+' needed':'Mastery reached — the next strand mission can unlock.'}</small>
      </div>
      <Pips passes={summary.confirmed} required={summary.required}/>
      <Link className="btn primary" href="/live">TAKE THIS INTO MY NEXT GAME →</Link>
    </div>
  </article>;
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

function proofClock(seconds:number){
  const safe=Math.max(0,Math.round(Number(seconds)||0));
  const minutes=Math.floor(safe/60);
  return minutes+':'+String(safe%60).padStart(2,'0');
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
      {recent.map(rep=>{
        const proof=rep.evidenceV2;
        const state=proof?.state??(rep.banksPass?'BANKED':rep.outcome==='NO_REP'?'NOT_OBSERVED':'MISSED');
        const stateClass=state==='BANKED'?'good':'watch';
        return <div key={rep.matchId}>
          <span className={stateClass}>{clean(state)}</span>
          <b>{proof?.observedValueLabel||clean(rep.outcome)}</b>
          <small>{proof?proof.measurementSource.replaceAll('_',' ')+' · '+proof.confidence+' confidence':clean(rep.adherence)+' adherence'}</small>
          {proof&&<details className="ip-mission-details">
            <summary>SHOW THE PROOF <span>{proof.opportunities} {proof.opportunities===1?'opportunity':'opportunities'} · {proof.successes} {proof.successes===1?'success':'successes'} · {proof.misses} {proof.misses===1?'miss':'misses'}</span></summary>
            <div className="ip-mission-brief">
              <section>
                <span>RESULT</span>
                <h3>{clean(proof.state)}</h3>
                <p>{proof.observedValueLabel} against {proof.targetLabel}. {proof.reason}</p>
              </section>
              <section>
                <span>EVIDENCE SOURCE</span>
                <h3>{proof.measurementSource.replaceAll('_',' ')}</h3>
                <p>{proof.confidence} confidence · reconstructed from {proof.reconstruction.fields.join(' + ')||'the recorded match evidence'}.</p>
              </section>
              <section>
                <span>RECORDED MOMENTS</span>
                <h3>{proof.events.length?proof.events.length+' proof point'+(proof.events.length===1?'':'s'):'No valid opportunity observed'}</h3>
                {proof.events.length?proof.events.map((event,index)=><p key={index}><b>{typeof event.atSeconds==='number'?proofClock(event.atSeconds)+' · ':''}{event.label}</b> — {event.detail}</p>):<p>This game stays neutral. It does not add a pass or a failure to the mission.</p>}
              </section>
              <section>
                <span>RECONSTRUCTION</span>
                <h3>How OP CLIMB reached the result</h3>
                <p>{proof.reconstruction.formula}</p>
              </section>
            </div>
          </details>}
        </div>;
      })}
    </div>:<div className="ip-no-reps">No tracked games have created proof for this strand mission yet.</div>}
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