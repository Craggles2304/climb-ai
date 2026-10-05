'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {matchesFor,useAccount} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {ClientGameDna,type ClientDnaMission} from '@/components/ClientGameDna';
import {DnaRoleSwitcher} from '@/components/DnaRoleSwitcher';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount} from '@/lib/dnaGrowth';
import {gameDnaClientMissions} from '@/lib/gameDnaSnapshot';
import {LEAGUE_ROLES,taskAppliesToRole} from '@/lib/roleAwareLearning';
import type {Role} from '@/lib/types';

export default function GameDnaPage(){
  const {active}=useAccount();
  const {tasks,allTasks}=useLearningPlan();
  const [viewRole,setViewRole]=useState<Role>(active.role);

  useEffect(()=>{
    const requested=new URLSearchParams(window.location.search).get('role') as Role|null;
    setViewRole(requested&&LEAGUE_ROLES.includes(requested)?requested:active.role);
  },[active.id,active.role]);

  const trackedMatches=matchesFor(active.id).filter(match=>match.durationSeconds>=300);
  const roleGameCounts=Object.fromEntries(LEAGUE_ROLES.map(role=>[role,dnaBaselineGameCount(trackedMatches,role)])) as Record<Role,number>;
  const baselineGames=roleGameCounts[viewRole]??0;
  const accountTasks=allTasks[active.id]??tasks;
  const roleTasks=useMemo(()=>accountTasks.filter(task=>taskAppliesToRole(task,viewRole)),[accountTasks,viewRole]);
  const missions=useMemo<ClientDnaMission[]>(()=>gameDnaClientMissions(roleTasks,viewRole),[roleTasks,viewRole]);
  const baselineReady=baselineGames>=DNA_BASELINE_GAMES;

  const chooseRole=(role:Role)=>{
    setViewRole(role);
    const url=new URL(window.location.href);
    url.searchParams.set('role',role);
    window.history.replaceState({},'',url);
  };

  return <AppShell>
    <header className="dna-page-hero">
      <div>
        <div className="eyebrow">GAME DNA · YOUR PLAYER IDENTITY</div>
        <h1>Your DNA is your OP CLIMB identity.</h1>
        <p>Six connected strands turn every tracked role game into a living player profile. This is the core of OP CLIMB: play, prove the decision, evolve the strand.</p>
      </div>
      <div className="dna-page-hero-actions">
        <Link className="btn primary" href="/live">TRACK NEXT GAME →</Link>
        <Link className="btn secondary" href={`/ilp?role=${viewRole}`}>OPEN MY DNA</Link>
      </div>
    </header>

    <DnaRoleSwitcher role={viewRole} primaryRole={active.role} gameCounts={roleGameCounts} baselineRequired={DNA_BASELINE_GAMES} onChange={chooseRole}/>

    <section className="dna-page-stage" aria-label={`${viewRole} interactive Game DNA`}>
      <div className="dna-page-stage-head">
        <div>
          <span>INTERACTIVE {viewRole} DNA</span>
          <strong>{baselineReady?'Your live development profile':`Baseline building · ${Math.min(baselineGames,DNA_BASELINE_GAMES)}/${DNA_BASELINE_GAMES} games`}</strong>
        </div>
        <small>{baselineReady?'Select a strand to inspect its current mission and growth.':'Your first three games teach OP CLIMB what your starting shape really is.'}</small>
      </div>
      <ClientGameDna player={active.gameName+active.tagline} role={viewRole} missions={missions} baselineGames={baselineGames} baselineRequired={DNA_BASELINE_GAMES}/>
    </section>

    <section className="dna-page-loop">
      <div><span>01</span><strong>PLAY</strong><p>Every meaningful tracked game adds role-specific evidence.</p></div>
      <div><span>02</span><strong>PROVE</strong><p>Repeat the right decision until a mission becomes a real habit.</p></div>
      <div><span>03</span><strong>EVOLVE</strong><p>Your strands level up and the tree changes with your development.</p></div>
    </section>
  </AppShell>;
}

