'use client';

import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {matchesFor,useAccount} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {ClientGameDna,type ClientDnaMission} from '@/components/ClientGameDna';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {gameDnaClientMissions,gameDnaStrands,gameMissionFocusPair} from '@/lib/gameDnaSnapshot';
import {taskAppliesToRole} from '@/lib/roleAwareLearning';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {missionSummary} from '@/lib/missionLoop';
import {DNA_DOMAIN_COLORS,DNA_DOMAIN_GUIDE,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import {buildJourneyState} from '@/lib/journeyState';
import {championSplash} from '@/lib/championArt';
import type {DnaDomain} from '@/lib/types';

type Device={account_key:string;last_seen_at:string|null};
const recent=(value:string|null,ms=90_000)=>Boolean(value&&Date.now()-Date.parse(value)<ms);
const portrait=(champion:string)=>championSplash(champion);
const shortDate=(value:string)=>{const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}):'—'};
const duration=(seconds:number)=>Number.isFinite(seconds)?Math.floor(seconds/60)+'m '+String(Math.round(seconds%60)).padStart(2,'0')+'s':'—';
const baseColours=(domain:DnaDomain)=>({'--dna-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties);

export default function Dashboard(){
  const {active,hydrated}=useAccount();
  const {tier}=useSubscription();
  const {tasks,allTasks}=useLearningPlan();
  const [devices,setDevices]=useState<Device[]>([]);
  const [deviceLoaded,setDeviceLoaded]=useState(false);
  const [dnaRevealed,setDnaRevealed]=useState(false);
  const [selectedDomain,setSelectedDomain]=useState<DnaDomain>('LANING');

  useEffect(()=>{
    try{setDnaRevealed(localStorage.getItem('op:dna-revealed:'+active.id+':'+active.role)==='1')}catch{setDnaRevealed(false)}
  },[active.id,active.role]);

  useEffect(()=>{
    let stopped=false;
    setDevices([]);
    setDeviceLoaded(false);
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

  // Read the refreshed account cache on each provider render. Memoising by ID alone
  // can retain the pre-hydration demo list after real Riot matches arrive.
  const matches=matchesFor(active.id)
    .filter(match=>match.durationSeconds>=300)
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  const baselineGames=dnaBaselineGameCount(matches,active.role);
  const baselineReady=dnaBaselineReady(baselineGames);
  const accountTasks=allTasks[active.id]??tasks;
  const roleTasks=useMemo(()=>accountTasks.filter(task=>taskAppliesToRole(task,active.role)),[accountTasks,active.role]);
  const dnaMissions=useMemo<ClientDnaMission[]>(()=>gameDnaClientMissions(roleTasks,active.role),[roleTasks,active.role]);
  const strands=useMemo(()=>gameDnaStrands(roleTasks,active.role,baselineReady),[roleTasks,active.role,baselineReady]);
  const activeMissions=useMemo(()=>baselineReady?gameMissionFocusPair(roleTasks,active.role).map(row=>row.task):[],[roleTasks,active.role,baselineReady]);
  const focus=activeMissions[0]??null;
  const secondFocus=activeMissions[1]??null;
  const focusPlain=focus?plainLanguageFocus(focus):null;
  const secondFocusPlain=secondFocus?plainLanguageFocus(secondFocus):null;
  const focusProof=focus?missionSummary(focus):null;
  const mastered=roleTasks.filter(task=>task.status==='MASTERED').length;
  const linked=devices.length>0;
  const online=devices.some(device=>recent(device.last_seen_at));
  const latest=matches[0]??null;
  const heroChampion=latest?.champion&&latest.champion!=='Unknown'?latest.champion:active.champions?.[0]||'';
  const verifiedReps=baselineReady?roleTasks.reduce((sum,task)=>sum+missionSummary(task).confirmed,0):0;
  const recentTen=matches.slice(0,10);
  const wins=recentTen.filter(match=>match.result==='WIN').length;
  const recentWinrate=recentTen.length?Math.round(wins/recentTen.length*100):null;
  const csMatches=recentTen.filter(match=>Number.isFinite(match.metrics.csPerMin)&&match.metrics.csPerMin>=0);
  const avgCs=csMatches.length?(csMatches.reduce((sum,match)=>sum+match.metrics.csPerMin,0)/csMatches.length).toFixed(1):null;
  const kills=recentTen.reduce((sum,match)=>sum+match.kills,0);
  const assists=recentTen.reduce((sum,match)=>sum+match.assists,0);
  const deaths=recentTen.reduce((sum,match)=>sum+match.deaths,0);
  const kda=recentTen.length?deaths===0?'Perfect':((kills+assists)/deaths).toFixed(2):null;
  const chosen=strands.find(strand=>strand.domain===selectedDomain)??strands[0];
  const domainFocus=roleTasks.find(task=>task.dnaDomain===selectedDomain&&task.status!=='MASTERED'&&task.status!=='PAUSED');
  const selectedGuide=DNA_DOMAIN_GUIDE[selectedDomain];

  const next=buildJourneyState({
    deviceLoaded,linked,online,baselineGames,dnaRevealed,
    focusName:activeMissions.length===2?'Two DNA trees unlocked':focusPlain?.name||focus?.title,
    focusJob:activeMissions.length===2?`1. ${focusPlain?.nextGame||focus?.gameRule||''}  2. ${secondFocusPlain?.nextGame||secondFocus?.gameRule||''}`:focusPlain?.nextGame||focus?.gameRule,
    focusConfirmed:focusProof?.confirmed,focusRequired:focusProof?.required,
  });
  const missionProven=Boolean(focusProof&&focusProof.confirmed>=focusProof.required);
  const steps=[
    {label:'CONNECT',done:linked,active:!linked},
    {label:'BASELINE',done:baselineReady,active:linked&&!baselineReady},
    {label:'REVEAL DNA',done:dnaRevealed,active:baselineReady&&!dnaRevealed},
    {label:'VERIFY',done:missionProven,active:Boolean(baselineReady&&focus&&!missionProven)},
    {label:'EVOLVE',done:mastered>0,active:Boolean(missionProven&&mastered===0)},
  ];

  if(!hydrated)return <AppShell><section className="arena-v21 arena-v21-loading" role="status" aria-live="polite"><span className="arena-v21-kicker">LOADING PLAYER HQ</span><h1>Preparing your climb.</h1><p>Synchronising your player identity and match evidence…</p></section></AppShell>;

  return <AppShell>
    <div className="arena-v21">
      <div className="arena-v21-intro"><div><span className="arena-v21-kicker">OP CLIMB / PLAYER HQ</span><span className="arena-v21-issue">YOUR GAME. YOUR GROWTH.</span></div><Link href="/live">OPEN MATCH ROOM <span aria-hidden="true">↗</span></Link></div>

      <header className="arena-v21-hero">
        {heroChampion&&<img className="arena-v21-hero-art" src={portrait(heroChampion)} alt="" aria-hidden="true" loading="eager" onError={event=>{event.currentTarget.hidden=true}}/>}
        <div className="arena-v21-hero-grain" aria-hidden="true"/>
        <div className="arena-v21-hero-content">
          <span className="arena-v21-kicker"><i className="arena-v21-status-led"/> PLAYER IDENTITY / {active.region}</span>
          <div className="arena-v21-hero-title"><h1>{active.gameName}<span>{active.tagline}</span></h1><div className="arena-v21-rank-medallion" aria-label={active.rank}><svg viewBox="0 0 96 106" aria-hidden="true"><path d="M48 3 85 21 89 62 48 103 7 62 11 21Z" fill="#14202d" stroke="#dcbb7c" strokeWidth="3"/><path d="M48 18 72 32 68 65 48 88 28 65 24 32Z" fill="#3a4c65" stroke="#91e4df" strokeWidth="2"/><path d="m48 25 19 27-19 26-19-26Z" fill="#86d8e8" stroke="#c4f8f8" strokeWidth="2"/><path d="m48 25 0 53 19-26Z" fill="#3d91be"/><path d="m29 52 38 0" stroke="#e4ffff" strokeWidth="2"/></svg><span>RANKED</span></div></div>
          <p className="arena-v21-hero-description">{baselineReady?(focusPlain?.nextGame||'Your next mission is ready. Keep turning evidence into improvement.'):`Build your real ${active.role} profile with ${DNA_BASELINE_GAMES} tracked games. No invented ratings — just your play.`}</p>
          <div className="arena-v21-badges"><span className="arena-v21-rank-badge">{active.rank}</span><span>{active.role} / MAIN ROLE</span><span>{Math.min(baselineGames,DNA_BASELINE_GAMES)}/{DNA_BASELINE_GAMES} BASELINE</span></div>
        </div>
        <div className="arena-v21-hero-bottom"><span>{heroChampion?'FEATURED · '+heroChampion.toUpperCase():'YOUR PLAYER PROFILE'}</span><span className={online?'arena-v21-connected is-live':linked?'arena-v21-connected is-linked':'arena-v21-connected'}><i/>{online?'COMPANION LIVE':linked?'COMPANION PAIRED':deviceLoaded?'PAIR YOUR COMPANION':'CHECKING COMPANION'}</span></div>
      </header>

      <section className="arena-v21-stats" aria-label="Your performance at a glance">
        <div className="arena-v21-stat"><span>RECENT WIN RATE</span><strong>{recentWinrate===null?'—':recentWinrate+'%'}</strong><small>{recentTen.length?`${wins} wins / last ${recentTen.length} games`:'Awaiting tracked games'}</small></div>
        <div className="arena-v21-stat"><span>RECENT KDA</span><strong>{kda??'—'}</strong><small>{recentTen.length?'Combined kills + assists / deaths':'Awaiting tracked games'}</small></div>
        <div className="arena-v21-stat"><span>AVERAGE CS / MIN</span><strong>{avgCs??'—'}</strong><small>{csMatches.length?`Last ${csMatches.length} recorded games`:'No CS evidence yet'}</small></div>
        <div className="arena-v21-stat arena-v21-stat-proof"><span>VERIFIED MISSION REPS</span><strong>{baselineReady?verifiedReps:'—'}</strong><small>{baselineReady?`${mastered} mastered missions`:`Unlock after ${DNA_BASELINE_GAMES} role games`}</small></div>
      </section>

      <div className="arena-v21-main-grid">
        <section className="arena-v21-panel arena-v21-dna" aria-labelledby="arena-v21-dna-title">
          <div className="arena-v21-panel-head"><div><span className="arena-v21-kicker">01 / YOUR DEVELOPMENT ENGINE</span><h2 id="arena-v21-dna-title">GAME <em>DNA</em></h2><p>{baselineReady?'Six evidence-led strands. Pick one to inspect where your development stands.':`Your profile stays neutral until ${DNA_BASELINE_GAMES} games establish your role baseline.`}</p></div><Link className="arena-v21-text-link" href="/ilp">EXPLORE FULL DNA ↗</Link></div>
          <div className="arena-v21-dna-visual"><div className="arena-v21-dna-aura" aria-hidden="true"/><ClientGameDna player={active.gameName+active.tagline} role={active.role} missions={dnaMissions} baselineGames={baselineGames} baselineRequired={DNA_BASELINE_GAMES}/><span className="arena-v21-visual-label">{baselineReady?'VERIFIED PLAYER PROFILE':'BASELINE / NO SCORES SHOWN'}</span></div>
          <div className="arena-v21-strands" role="group" aria-label="Inspect a Game DNA strand">
            {strands.map((strand,index)=><button type="button" key={strand.domain} className={'arena-v21-strand '+(selectedDomain===strand.domain?'is-selected':'')} style={baseColours(strand.domain)} aria-pressed={selectedDomain===strand.domain} onClick={()=>setSelectedDomain(strand.domain)}>
              <span className="arena-v21-strand-top"><i className="arena-v21-strand-symbol" aria-hidden="true"/><small>0{index+1}</small></span>
              <b>{strand.label}</b><span className="arena-v21-strand-track"><i style={{width:(baselineReady?strand.progress:0)+'%'}}/></span><small>{!baselineReady?'BASELINE':strand.mastered>0?`${strand.mastered} MASTERED`:strand.activeCount?'MISSION ACTIVE':'AWAITING EVIDENCE'}</small>
            </button>)}
          </div>
          <div className="arena-v21-strand-detail" style={baseColours(selectedDomain)} aria-live="polite"><span><b>{chosen?.label||DNA_DOMAIN_LABELS[selectedDomain]}</b><small>{baselineReady&&chosen?.activeCount?'TRACKED STRAND':'DEVELOPMENT STRAND'}</small></span><p>{baselineReady&&domainFocus?domainFocus.gameRule:selectedGuide.summary}</p><Link href="/ilp">VIEW STRAND →</Link></div>
        </section>

        <aside className="arena-v21-right-stack">
          <section className="arena-v21-panel arena-v21-mission" aria-labelledby="arena-v21-mission-title">
            <div className="arena-v21-panel-head"><div><span className="arena-v21-kicker">02 / YOUR NEXT CHALLENGE</span><h2 id="arena-v21-mission-title">ACTIVE <em>MISSION</em></h2></div><span className="arena-v21-pulse">● LIVE COACHING</span></div>
            {baselineReady&&focus?<><span className="arena-v21-mission-domain" style={baseColours(focus.dnaDomain)}><i/>{DNA_DOMAIN_LABELS[focus.dnaDomain]}</span><h3>{focusPlain?.name||focus.title}</h3><p>{focusPlain?.meaning||focus.why}</p><div className="arena-v21-mission-rule"><span>YOUR JOB NEXT GAME</span><strong>{focusPlain?.nextGame||focus.gameRule}</strong></div><div className="arena-v21-proof-header"><span>VERIFIED PROGRESS</span><b>{Math.min(focusProof?.confirmed??0,focusProof?.required??3)} / {focusProof?.required??3} REPS</b></div><div className="arena-v21-proof-bar" role="progressbar" aria-label="Verified mission repetitions" aria-valuemin={0} aria-valuemax={focusProof?.required??3} aria-valuenow={Math.min(focusProof?.confirmed??0,focusProof?.required??3)}><i style={{width:(Math.min(focusProof?.confirmed??0,focusProof?.required??3)/(focusProof?.required??3)*100)+'%'}}/></div>{secondFocus&&<div className="arena-v21-secondary-focus"><span>SECOND UNLOCKED MISSION</span><b>{secondFocusPlain?.name||secondFocus.title}</b></div>}</>:<div className="arena-v21-mission-empty"><span>◈</span><h3>{baselineReady?'Choose your next coaching focus.':'Your first mission is being discovered.'}</h3><p>{baselineReady?'Open Game DNA to see which evidence-backed focus is available.':`Play ${Math.max(0,DNA_BASELINE_GAMES-baselineGames)} more tracked ${active.role} ${DNA_BASELINE_GAMES-baselineGames===1?'game':'games'} to reveal your baseline and coaching missions.`}</p></div>}
            <Link className="arena-v21-action" href={baselineReady?'/missions':'/live'}>{baselineReady?'OPEN MY MISSIONS':'CONNECT & PLAY'} <span>↗</span></Link>
          </section>

          <section className="arena-v21-panel arena-v21-coach" aria-labelledby="arena-v21-coach-title"><div className="arena-v21-panel-head"><div><span className="arena-v21-kicker">03 / YOUR LEARNING INTELLIGENCE</span><h2 id="arena-v21-coach-title">COACH <em>MEMORY</em></h2></div><span className="arena-v21-tier">{tier}</span></div><div className="arena-v21-coach-graphic" aria-hidden="true"><span className="arena-v21-coach-ring"/><span className="arena-v21-coach-core">OP</span><i/><i/><i/></div><p>{tier==='PRO'?'Review recurring patterns and whether your decisions hold up across unfamiliar situations. Only verified evidence counts.':'Your matches reveal patterns. PRO adds the deeper memory layer that learns which decisions you can transfer between games.'}</p><div className="arena-v21-coach-footer"><span>{tier==='PRO'?mastered+' VERIFIED MISSIONS MASTERED':'PRO COACH MEMORY'}</span><Link href={tier==='PRO'?'/coach':'/pricing'}>{tier==='PRO'?'OPEN MY COACH':'EXPLORE PRO'} ↗</Link></div></section>
        </aside>
      </div>

      <section className="arena-v21-panel arena-v21-matches" aria-labelledby="arena-v21-matches-title">
        <div className="arena-v21-panel-head"><div><span className="arena-v21-kicker">04 / RECENT PERFORMANCE</span><h2 id="arena-v21-matches-title">MATCH <em>HISTORY</em></h2><p>Real games, readable stats, evidence you can return to.</p></div><Link className="arena-v21-text-link" href="/analyse">ALL MATCHES ↗</Link></div>
        <div className="arena-v21-match-head" aria-hidden="true"><span>CHAMPION / RESULT</span><span>KDA</span><span>CS / MIN</span><span>DURATION</span><span>DATE</span><span>REVIEW</span></div>
        {matches.length?<div className="arena-v21-match-list">{matches.slice(0,5).map(match=><Link key={match.id} href={'/analyse/'+encodeURIComponent(String(match.id))} className={'arena-v21-match '+(match.result==='WIN'?'is-win':'is-loss')} aria-label={match.champion+', '+(match.result==='WIN'?'victory':'defeat')+', review match'}>
          <span className="arena-v21-match-ident"><span className="arena-v21-match-art"><img src={portrait(match.champion)} alt="" loading="lazy" onError={event=>{event.currentTarget.hidden=true}}/></span><span><b>{match.champion}</b><small>{match.result==='WIN'?'VICTORY':'DEFEAT'} · {match.role}</small></span></span>
          <span className="arena-v21-match-number"><b>{match.kills} / {match.deaths} / {match.assists}</b><small>K / D / A</small></span>
          <span className="arena-v21-match-number"><b>{Number.isFinite(match.metrics.csPerMin)?match.metrics.csPerMin.toFixed(1):'—'}</b><small>CS / MIN</small></span>
          <span className="arena-v21-match-number"><b>{duration(match.durationSeconds)}</b><small>PLAYED</small></span>
          <span className="arena-v21-match-number"><b>{shortDate(match.createdAt)}</b><small>MATCH DATE</small></span>
          <span className="arena-v21-match-arrow" aria-hidden="true">↗</span>
        </Link>)}</div>:<div className="arena-v21-no-matches"><span>NO GAMES TRACKED</span><h3>Your match archive begins with game one.</h3><p>Install and pair the Companion to start recording your real League of Legends matches.</p><Link href="/live">OPEN MATCH ROOM ↗</Link></div>}
      </section>

      <section className="arena-v21-journey" aria-label="Your development journey"><div><span className="arena-v21-kicker">05 / THE CLIMB LOOP</span><h2>{next.title}</h2><p>{next.body}</p></div><ol>{steps.map((step,index)=><li key={step.label} className={step.done?'is-done':step.active?'is-active':''}><span>{step.done?'✓':String(index+1).padStart(2,'0')}</span><b>{step.label}</b></li>)}</ol><Link href={next.href} aria-disabled={!deviceLoaded}>{next.cta} ↗</Link></section>
    </div>
  </AppShell>;
}
