'use client';

import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {matchesFor,useAccount} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {ClientGameDna,type ClientDnaMission} from '@/components/ClientGameDna';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {currentGameDnaMissions,gameDnaClientMissions} from '@/lib/gameDnaSnapshot';
import {taskAppliesToRole} from '@/lib/roleAwareLearning';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {missionSummary} from '@/lib/missionLoop';
import {DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';

type Device={account_key:string;last_seen_at:string|null};
const recent=(value:string|null,ms=90_000)=>Boolean(value&&Date.now()-Date.parse(value)<ms);

export default function Dashboard(){
  const {active}=useAccount();
  const {tasks,allTasks}=useLearningPlan();
  const [devices,setDevices]=useState<Device[]>([]);
  const [deviceLoaded,setDeviceLoaded]=useState(false);

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

  const matches=useMemo(()=>matchesFor(active.id)
    .filter(match=>match.durationSeconds>=300)
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)),[active.id]);
  const baselineGames=dnaBaselineGameCount(matches,active.role);
  const baselineReady=dnaBaselineReady(baselineGames);
  const accountTasks=allTasks[active.id]??tasks;
  const roleTasks=useMemo(()=>accountTasks.filter(task=>taskAppliesToRole(task,active.role)),[accountTasks,active.role]);
  const dnaMissions=useMemo<ClientDnaMission[]>(()=>gameDnaClientMissions(roleTasks,active.role),[roleTasks,active.role]);
  const activeMissions=useMemo(()=>baselineReady
    ?currentGameDnaMissions(roleTasks,active.role).flatMap(({task})=>task?[task]:[])
    :[],[roleTasks,active.role,baselineReady]);
  const focus=activeMissions[0]??null;
  const focusPlain=focus?plainLanguageFocus(focus):null;
  const focusProof=focus?missionSummary(focus):null;
  const mastered=roleTasks.filter(task=>task.status==='MASTERED').length;
  const linked=devices.length>0;
  const online=devices.some(device=>recent(device.last_seen_at));
  const latest=matches[0]??null;

  const next=!deviceLoaded
    ?{eyebrow:'CHECKING YOUR SETUP',title:'Finding your Companion…',body:'OP CLIMB is checking the one thing you need to do next.',cta:'CHECKING…',href:'/live'}
    :!linked
      ?{eyebrow:'STEP 1 · CONNECT',title:'Connect your Companion.',body:'Pair the Windows Companion once. After that, OP CLIMB follows your games automatically.',cta:'CONNECT COMPANION →',href:'/live'}
      :!online
        ?{eyebrow:'COMPANION OFFLINE',title:'Reconnect before you queue.',body:'Your PC is paired, but OP CLIMB is not receiving a live heartbeat right now.',cta:'OPEN MATCH ROOM →',href:'/live'}
        :!baselineReady
          ?{eyebrow:'STEP 2 · BUILD YOUR DNA',title:`Play baseline game ${Math.min(baselineGames+1,DNA_BASELINE_GAMES)} of ${DNA_BASELINE_GAMES}.`,body:`Play normally as ${active.role}. OP CLIMB is learning your real starting shape before it gives you a personalised fix.`,cta:'OPEN MATCH ROOM →',href:'/live'}
          :focus
            ?{eyebrow:'YOUR NEXT STEP',title:focusPlain?.name||focus.title,body:focusPlain?.nextGame||focus.gameRule,cta:'PLAY THE NEXT REP →',href:'/live'}
            :{eyebrow:'YOUR NEXT STEP',title:'Your DNA is ready for its next challenge.',body:'Open Match Room and OP CLIMB will attach the next evidence-backed job to your game.',cta:'OPEN MATCH ROOM →',href:'/live'};

  const steps=[
    {label:'CONNECT',done:linked,active:!linked},
    {label:'BASELINE',done:baselineReady,active:linked&&!baselineReady},
    {label:'FIND FIX',done:baselineReady&&Boolean(focus),active:baselineReady&&!focus},
    {label:'PROVE IT',done:Boolean(focusProof&&focusProof.confirmed>=focusProof.required),active:Boolean(focus&&focusProof&&focusProof.confirmed<focusProof.required)},
    {label:'EVOLVE',done:mastered>0,active:Boolean(focusProof&&focusProof.confirmed>=focusProof.required&&mastered===0)},
  ];

  return <AppShell>
    <header className="op-home-head">
      <div>
        <div className="eyebrow">HOME · {active.gameName}{active.tagline}</div>
        <h1>Know exactly what to do next.</h1>
        <p>Connect. Build your DNA. Fix one thing. Prove it in games. Evolve the player.</p>
      </div>
      <span className={'op-home-connection '+(online?'is-online':linked?'is-paired':'')}>
        <i/>{online?'COMPANION LIVE':linked?'COMPANION PAIRED':'COMPANION NOT CONNECTED'}
      </span>
    </header>

    <section className="op-next-step">
      <div>
        <span>{next.eyebrow}</span>
        <h2>{next.title}</h2>
        <p>{next.body}</p>
      </div>
      <Link className="btn primary" href={next.href} aria-disabled={!deviceLoaded}>{next.cta}</Link>
    </section>

    <section className="op-climb-path" aria-label="Your OP CLIMB journey">
      <div className="op-climb-path-head"><span>YOUR CLIMB PATH</span><b>{baselineReady?'DNA ACTIVE':`BASELINE ${Math.min(baselineGames,DNA_BASELINE_GAMES)}/${DNA_BASELINE_GAMES}`}</b></div>
      <ol>
        {steps.map((step,index)=><li key={step.label} className={step.done?'done':step.active?'active':''}>
          <i>{step.done?'✓':index+1}</i><span>{step.label}</span>
        </li>)}
      </ol>
    </section>

    <section className="op-home-dna">
      <div className="op-home-dna-head">
        <div>
          <div className="eyebrow">GAME DNA · THE HEART OF OP CLIMB</div>
          <h2>Your decisions become your player identity.</h2>
          <p>{baselineReady
            ?`This is your live ${active.role} development profile. Every tracked game can strengthen, expose or evolve one of the six strands.`
            :`Your ${active.role} DNA is building. Complete ${DNA_BASELINE_GAMES} real role games before OP CLIMB colours the profile and starts judging habits.`}</p>
        </div>
        <Link className="btn secondary" href="/ilp">OPEN MY DNA →</Link>
      </div>
      <div className="op-home-dna-stage">
        <ClientGameDna
          player={active.gameName+active.tagline}
          role={active.role}
          missions={dnaMissions}
          baselineGames={baselineGames}
          baselineRequired={DNA_BASELINE_GAMES}
        />
      </div>
    </section>

    <section className="op-home-focus-grid">
      <article className="panel op-home-focus">
        <div className="eyebrow">{baselineReady?'CURRENT FIX':'DNA BASELINE'}</div>
        {baselineReady&&focus?<>
          <span className="op-home-strand" style={({ '--strand-color':DNA_DOMAIN_COLORS[focus.dnaDomain]} as CSSProperties)}>
            {DNA_DOMAIN_LABELS[focus.dnaDomain]}
          </span>
          <h2>{focusPlain?.name||focus.title}</h2>
          <p>{focusPlain?.meaning||focus.why}</p>
          <div className="op-home-job"><span>YOUR JOB NEXT GAME</span><b>{focusPlain?.nextGame||focus.gameRule}</b></div>
          <div className="op-home-proof"><span>PROOF</span><b>{focusProof?.confirmed??0}/{focusProof?.required??3} clean games</b></div>
        </>:<>
          <h2>{baselineGames}/{DNA_BASELINE_GAMES} games observed.</h2>
          <p>Do not optimise for the system yet. Play normally. OP CLIMB needs your real habits before it decides what is holding you back.</p>
          <div className="op-home-job"><span>NEXT</span><b>Play {active.role} baseline game {Math.min(baselineGames+1,DNA_BASELINE_GAMES)}.</b></div>
        </>}
      </article>

      <article className="panel op-home-latest">
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
  </AppShell>;
}
