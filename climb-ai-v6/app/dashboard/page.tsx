'use client';

import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {matchesFor,useAccount} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {ClientGameDna,type ClientDnaMission} from '@/components/ClientGameDna';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {gameDnaClientMissions,gameMissionFocusPair} from '@/lib/gameDnaSnapshot';
import {taskAppliesToRole} from '@/lib/roleAwareLearning';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {missionSummary} from '@/lib/missionLoop';
import {DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import {buildJourneyState} from '@/lib/journeyState';
import {championSplash} from '@/lib/championArt';
import {DashboardMatchInsights} from '@/components/DashboardMatchInsights';
import {DashboardDnaInspector} from '@/components/DashboardDnaInspector';
import {ArenaChampionsPanel} from '@/components/ArenaChampionsPanel';
import {ArenaRankPanel} from '@/components/ArenaRankPanel';
import {ArenaIcon} from '@/components/ArenaIcon';

type Device={account_key:string;last_seen_at:string|null};
const recent=(value:string|null,ms=90_000)=>Boolean(value&&Date.now()-Date.parse(value)<ms);

export default function Dashboard(){
  const {active,hydrated,authenticated}=useAccount();
  const {tasks,allTasks}=useLearningPlan();
  const [devices,setDevices]=useState<Device[]>([]);
  const [deviceLoaded,setDeviceLoaded]=useState(false);
  const [dnaRevealed,setDnaRevealed]=useState(false);

  useEffect(()=>{
    try{setDnaRevealed(localStorage.getItem('op:dna-revealed:'+active.id+':'+active.role)==='1')}catch{setDnaRevealed(false)}
  },[active.id,active.role]);

  useEffect(()=>{
    let stopped=false;
    const pull=async()=>{
      try{
        const response=await fetch('/api/live/pair',{cache:'no-store'});
        if(!response.ok)return;
        const body=await response.json();
        if(stopped)return;
        setDevices((body.devices??[]).filter((device:Device)=>device.account_key===active.id));
      }catch{}finally{if(!stopped)setDeviceLoaded(true)}
    };
    void pull();
    const timer=window.setInterval(()=>void pull(),30_000);
    return()=>{stopped=true;window.clearInterval(timer)};
  },[active.id]);

  const matches=matchesFor(active.id)
    .filter(match=>match.durationSeconds>=300)
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  const baselineGames=dnaBaselineGameCount(matches,active.role);
  const baselineReady=dnaBaselineReady(baselineGames);
  const accountTasks=allTasks[active.id]??tasks;
  const roleTasks=useMemo(()=>accountTasks.filter(task=>taskAppliesToRole(task,active.role)),[accountTasks,active.role]);
  const dnaMissions=useMemo<ClientDnaMission[]>(()=>gameDnaClientMissions(roleTasks,active.role),[roleTasks,active.role]);
  const activeMissions=useMemo(()=>baselineReady
    ?gameMissionFocusPair(roleTasks,active.role).map(({task})=>task)
    :[],[roleTasks,active.role,baselineReady]);
  const focus=activeMissions[0]??null;
  const secondFocus=activeMissions[1]??null;
  const focusPlain=focus?plainLanguageFocus(focus):null;
  const secondFocusPlain=secondFocus?plainLanguageFocus(secondFocus):null;
  const focusProof=focus?missionSummary(focus):null;
  const mastered=roleTasks.filter(task=>task.status==='MASTERED').length;
  const linked=devices.length>0;
  const online=devices.some(device=>recent(device.last_seen_at));
  const latest=matches[0]??null;
  const heroChampion=latest?.champion&&latest.champion!=='Unknown'?latest.champion:active.champions?.[0]||'Jinx';

  const next=buildJourneyState({
    deviceLoaded,
    linked,
    online,
    baselineGames,
    dnaRevealed,
    focusName:activeMissions.length===2?'Two DNA trees unlocked':focusPlain?.name||focus?.title,
    focusJob:activeMissions.length===2?`1. ${focusPlain?.nextGame||focus?.gameRule||''}  2. ${secondFocusPlain?.nextGame||secondFocus?.gameRule||''}`:focusPlain?.nextGame||focus?.gameRule,
    focusConfirmed:focusProof?.confirmed,
    focusRequired:focusProof?.required,
  });

  const missionProven=Boolean(focusProof&&focusProof.confirmed>=focusProof.required);
  const steps=[
    {label:'CONNECT COMPANION',done:linked,active:!linked},
    {label:'PLAY 3 GAMES',done:baselineReady,active:linked&&!baselineReady},
    {label:'REVEAL DNA',done:baselineReady,active:false},
    {label:'TRAIN 2 MISSIONS',done:missionProven,active:Boolean(baselineReady&&focus&&!missionProven)},
    {label:'EVOLVE DNA',done:mastered>0,active:Boolean(missionProven&&mastered===0)},
  ];

  if(!hydrated)return <AppShell><section className="arena-original-loading" role="status">Loading your Riot player data…</section></AppShell>;

  return <AppShell>
    <header className="op-home-head op-home-head-dna arena-player-hero arena-pro-hero">
      <img className="arena-player-hero-art" src={championSplash(heroChampion)} alt="" aria-hidden="true" onError={event=>{event.currentTarget.hidden=true}}/>
      <div className="arena-player-hero-copy">
        <span className="arena-pro-hero-kicker"><i/> OP CLIMB <b>COMPETITIVE PERFORMANCE HQ</b><small>SEASON 2026</small></span>
        <div className="eyebrow">YOUR CLIMB · {active.role} PLAYER</div>
        <h1>{active.gameName}<span>{active.tagline}</span></h1>
        <p>{baselineReady
          ?'Your Game DNA is active. '+(focusPlain?.nextGame||'Take one clear mission into the next game.')
          :'Play '+DNA_BASELINE_GAMES+' tracked '+active.role+' games to reveal a player shape built from evidence.'}</p>
        <div className="arena-pro-hero-actions"><Link href="/live" className="arena-pro-hero-primary"><ArenaIcon name="match" size={18}/> OPEN MATCH ROOM <span>↗</span></Link><Link href="/ilp" className="arena-pro-hero-secondary"><ArenaIcon name="dna" size={17}/> MY GAME DNA</Link></div>
        <div className="arena-player-hero-meta"><b>{active.rank}</b><span>{active.role}</span><span>{Math.min(baselineGames,DNA_BASELINE_GAMES)}/{DNA_BASELINE_GAMES} BASELINE GAMES</span></div>
      </div>
      <ArenaRankPanel rank={active.rank} role={active.role} champion={heroChampion} region={active.region}/>
      <span className={'op-home-connection '+(online?'is-online':linked?'is-paired':'')}>
        <i/>{online?'COMPANION LIVE':linked?'COMPANION PAIRED':'COMPANION NOT CONNECTED'}
      </span>
      {latest&&<small className="arena-player-hero-credit">LAST PLAYED · {latest.champion}</small>}
    </header>

    <nav className="arena-pro-fast-nav" aria-label="Player headquarters sections">
      <Link href="#arena-perf"><ArenaIcon name="signal" size={18}/><span><b>PERFORMANCE</b><small>RECENT FORM</small></span><i>01</i></Link>
      <Link href="#arena-game-dna"><ArenaIcon name="dna" size={18}/><span><b>GAME DNA</b><small>PLAYER DEVELOPMENT</small></span><i>02</i></Link>
      <Link href="#arena-mission"><ArenaIcon name="target" size={18}/><span><b>COACHING PLAN</b><small>YOUR NEXT FIX</small></span><i>03</i></Link>
      <Link href="#arena-champions"><ArenaIcon name="sword" size={18}/><span><b>CHAMPIONS</b><small>YOUR POOL</small></span><i>04</i></Link>
      <Link href="#arena-match-list"><ArenaIcon name="history" size={18}/><span><b>MATCH HISTORY</b><small>POST-GAME INTEL</small></span><i>05</i></Link>
    </nav>

    <div id="arena-perf"><DashboardMatchInsights matches={matches} isDemo={!authenticated} mode="form"/></div>

    <section id="arena-game-dna" className="op-home-dna op-home-dna-primary arena-pro-dna-hq">
      <div className="op-home-dna-head">
        <div>
          <div className="eyebrow">YOUR GAME DNA · THE CENTRE OF OP CLIMB</div>
          <h2>{baselineReady?'This is how you actually play.':'Play three games. Reveal your DNA.'}</h2>
          <p>{baselineReady
            ?`Your live ${active.role} profile measures six parts of your game. You choose two DNA trees to keep unlocked for progression while the whole player profile keeps updating.`
            :`Connect the Companion and play ${DNA_BASELINE_GAMES} normal ${active.role} games. OP CLIMB keeps the profile neutral until it has enough evidence to reveal your real starting shape.`}</p>
        </div>
        <Link className="btn primary" href="/ilp">{baselineReady?'EXPLORE MY DNA →':'SEE MY DNA BUILD →'}</Link>
      </div>
      <DashboardDnaInspector tasks={roleTasks} role={active.role} baselineReady={baselineReady} baselineGames={baselineGames} baselineRequired={DNA_BASELINE_GAMES}/>
      <div className="op-home-dna-stage arena-pro-dna-stage">
        <div className="arena-pro-dna-stage-top" aria-hidden="true"><span><i/> GAME DNA ENGINE</span><span>LIVE PLAYER MODEL · {active.role}</span></div>
        <ClientGameDna
          player={active.gameName+active.tagline}
          role={active.role}
          missions={dnaMissions}
          baselineGames={baselineGames}
          baselineRequired={DNA_BASELINE_GAMES}
        />
      </div>
    </section>

    <section className="op-next-step">
      <div>
        <span>{next.status}</span>
        <h2>{next.title}</h2>
        <p>{next.body}</p>
      </div>
      <Link className="btn primary" href={next.href} aria-disabled={!deviceLoaded}>{next.cta}</Link>
    </section>

    <section className="op-climb-path" aria-label="Your OP CLIMB journey">
      <div className="op-climb-path-head"><span>THE DNA LOOP</span><b>{baselineReady?'DNA ACTIVE':`BASELINE ${Math.min(baselineGames,DNA_BASELINE_GAMES)}/${DNA_BASELINE_GAMES}`}</b></div>
      <ol>
        {steps.map((step,index)=><li key={step.label} className={step.done?'done':step.active?'active':''}>
          <i>{step.done?'✓':index+1}</i><span>{step.label}</span>
        </li>)}
      </ol>
    </section>

    <section id="arena-mission" className="op-home-focus-grid arena-pro-focus-grid">
      <article className={"panel op-home-focus arena-pro-focus "+(baselineReady?"is-ready":"is-baseline")}>
        <div className="eyebrow">{baselineReady?'CURRENT FIX':'DNA BASELINE'}</div>
        {baselineReady&&focus?<>
          <span className="op-home-strand" style={({ '--strand-color':DNA_DOMAIN_COLORS[focus.dnaDomain]} as CSSProperties)}>
            {DNA_DOMAIN_LABELS[focus.dnaDomain]}
          </span>
          <h2>{focusPlain?.name||focus.title}</h2>
          <p>{focusPlain?.meaning||focus.why}</p>
          <div className="op-home-job"><span>YOUR JOB NEXT GAME</span><b>{focusPlain?.nextGame||focus.gameRule}</b></div>
          <div className="op-home-proof"><span>VERIFIED MATCH EVIDENCE</span><b>{focusProof?.confirmed??0}/{focusProof?.required??3} clean games</b></div>
          <div className="arena-pro-mission-track" role="progressbar" aria-label="Verified coaching mission progress" aria-valuemin={0} aria-valuemax={focusProof?.required??3} aria-valuenow={Math.min(focusProof?.confirmed??0,focusProof?.required??3)}>
            <i style={{width:(Math.min(focusProof?.confirmed??0,focusProof?.required??3)/(focusProof?.required??3)*100)+'%'}}/>
          </div>
          {secondFocus&&<span className="arena-pro-second-mission">SECOND FOCUS · {secondFocusPlain?.name||secondFocus.title}</span>}
        </>:<>
          <h2>{baselineGames}/{DNA_BASELINE_GAMES} games observed.</h2>
          <p>Do not optimise for the system yet. Play normally. OP CLIMB needs your real habits before it decides what is holding you back.</p>
          <div className="op-home-job"><span>NEXT</span><b>Play {active.role} baseline game {Math.min(baselineGames+1,DNA_BASELINE_GAMES)}.</b></div>
        </>}
      </article>

      <article className="panel op-home-latest arena-pro-latest">
        {latest&&<img className="arena-pro-latest-backdrop" src={championSplash(latest.champion)} alt="" aria-hidden="true" loading="lazy" onError={event=>{event.currentTarget.hidden=true}}/>}
        <div className="eyebrow">LATEST GAME</div>
        {latest?<>
          <h2>{latest.champion} · {latest.result==='WIN'?'VICTORY':'DEFEAT'}</h2>
          <div className="op-home-latest-stats">
            <span><small>KDA</small><b>{latest.kills}/{latest.deaths}/{latest.assists}</b></span>
            <span><small>CS / MIN</small><b>{Number.isFinite(latest.metrics.csPerMin)?latest.metrics.csPerMin.toFixed(1):'—'}</b></span>
            <span><small>ROLE</small><b>{latest.role}</b></span>
          </div>
          <Link className="text-btn" href="/live">REVIEW IN MATCH ROOM →</Link>
        </>:<>
          <h2>No tracked game yet.</h2>
          <p>Your first game starts the DNA baseline.</p>
          <Link className="text-btn" href="/live">CONNECT AND PLAY →</Link>
        </>}
      </article>
    </section>

    <div id="arena-champions"><ArenaChampionsPanel account={active} matches={matches} isDemo={!authenticated}/></div>

    <div id="arena-match-list"><DashboardMatchInsights matches={matches} isDemo={!authenticated} mode="archive"/></div>
  </AppShell>;
}
