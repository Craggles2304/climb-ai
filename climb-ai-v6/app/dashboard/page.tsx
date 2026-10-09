'use client';

import {useEffect,useMemo,useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {matchesFor,useAccount} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {gameMissionFocusPair} from '@/lib/gameDnaSnapshot';
import {canonicalLeagueRole,taskAppliesToRole} from '@/lib/roleAwareLearning';
import {buildJourneyState} from '@/lib/journeyState';
import {filterHistoryForTier,hasTier,historyWindowLabel} from '@/lib/subscription';
import {verifiedMissionMastery} from '@/lib/verifiedMissionProof';
import {careerFor} from '@/lib/dna/career';
import {buildDNA} from '@/lib/dna/dna';
import {HABIT_COLOURS} from '@/lib/habits/colours';
import {getMainChampion,MAIN_CHAMPION_EVENT} from '@/lib/mainChampion';
import {climbJourney,mainChampion,matchRowViews,missionView,parseRank,recentForm,strandViews} from '@/lib/dashboard/model';
import {buildLearningLadder,type LearningLadder} from '@/lib/dashboard/learningLadder';
import {PlayerHero} from '@/components/dashboard/PlayerHero';
import {ClimbJourney,MissionCard,type MissionPhase} from '@/components/dashboard/MissionPanel';
import {GameDnaOverview} from '@/components/dashboard/GameDnaOverview';
import {MatchHistory} from '@/components/dashboard/MatchHistory';
import {CoachingIntelligence,type HabitsBlock,type Loadable,type MemorySnapshot} from '@/components/dashboard/CoachingIntelligence';
import s from '@/components/dashboard/Dashboard.module.css';

type Device={account_key:string;last_seen_at:string|null};
const recent=(value:string|null,ms=90_000)=>Boolean(value&&Date.now()-Date.parse(value)<ms);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCKED={state:'LOCKED' as const,data:null};

/**
 * Home — the player's coaching HQ (Arena V2.1).
 * Player identity → next mission → Game DNA → recent matches → coaching intelligence.
 * Every section reads the same account, plan and match evidence the rest of OP CLIMB uses.
 */
export default function Dashboard(){
  const {active,hydrated,authenticated}=useAccount();
  const {tasks,allTasks,planReady,planError}=useLearningPlan();
  const {tier}=useSubscription();
  const plus=hasTier(tier,'PLUS');
  const pro=hasTier(tier,'PRO');
  const [devices,setDevices]=useState<Device[]>([]);
  const [deviceLoaded,setDeviceLoaded]=useState(false);
  const [dnaRevealed,setDnaRevealed]=useState(false);
  const [chosenMain,setChosenMain]=useState<string|null>(null);
  const [twin,setTwin]=useState<Loadable<LearningLadder>>(LOCKED);
  const [memory,setMemory]=useState<Loadable<MemorySnapshot>>(LOCKED);

  useEffect(()=>{
    document.body.dataset.arenaPage='dashboard';
    return()=>{delete document.body.dataset.arenaPage};
  },[]);

  useEffect(()=>{
    try{setDnaRevealed(localStorage.getItem('op:dna-revealed:'+active.id+':'+active.role)==='1')}catch{setDnaRevealed(false)}
  },[active.id,active.role]);

  useEffect(()=>{
    const read=()=>setChosenMain(getMainChampion());
    read();
    window.addEventListener(MAIN_CHAMPION_EVENT,read);
    return()=>window.removeEventListener(MAIN_CHAMPION_EVENT,read);
  },[]);

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

  // PRO: Decision Twin V5 and Coach Memory. Other tiers never call the PRO endpoints.
  useEffect(()=>{
    if(!pro||!UUID.test(active.id)){setTwin(LOCKED);setMemory(LOCKED);return}
    let cancelled=false;
    setTwin({state:'LOADING',data:null});
    setMemory({state:'LOADING',data:null});
    fetch('/api/decision-twin?accountId='+encodeURIComponent(active.id),{cache:'no-store'})
      .then(async response=>{const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body?.error||'The Decision Twin could not be built.');return body})
      .then(body=>{if(!cancelled)setTwin({state:'READY',data:buildLearningLadder(body)})})
      .catch(error=>{if(!cancelled)setTwin({state:'ERROR',data:null,error:error instanceof Error?error.message:null})});
    fetch('/api/coach/memory?accountId='+encodeURIComponent(active.id)+'&role='+encodeURIComponent(active.role),{cache:'no-store'})
      .then(async response=>{const body=await response.json().catch(()=>({}));if(!response.ok||!body?.ok)throw new Error(body?.error||'Coach Memory unavailable.');return body})
      .then(body=>{if(!cancelled)setMemory({state:'READY',data:{
        count:Number(body.count)||0,
        mastered:Array.isArray(body.mastered)?body.mastered.length:0,
        due:Array.isArray(body.regression)?body.regression.length:0,
        transfer:Array.isArray(body.transfer)?body.transfer.length:0,
        top:body.leagueMind?.summary||body.memories?.[0]?.summary||null,
      }})})
      .catch(()=>{if(!cancelled)setMemory({state:'ERROR',data:null})});
    return()=>{cancelled=true};
  },[pro,active.id,active.role]);

  const matches=useMemo(()=>matchesFor(active.id)
    .filter(match=>match.durationSeconds>=300)
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)),[active.id,hydrated,allTasks]);
  const roleMatches=useMemo(()=>matches.filter(match=>canonicalLeagueRole(match.role)===active.role),[matches,active.role]);
  const windowMatches=useMemo(()=>filterHistoryForTier(matches,tier),[matches,tier]);
  const baselineGames=dnaBaselineGameCount(matches,active.role);
  const baselineReady=dnaBaselineReady(baselineGames);
  const accountTasks=allTasks[active.id]??tasks;
  const roleTasks=useMemo(()=>accountTasks.filter(task=>taskAppliesToRole(task,active.role)),[accountTasks,active.role]);
  const focusPair=useMemo(()=>baselineReady?gameMissionFocusPair(roleTasks,active.role):[],[roleTasks,active.role,baselineReady]);
  const missions=useMemo(()=>focusPair.map(({task})=>missionView(task)),[focusPair]);
  const primary=missions[0]??null;
  const secondary=missions[1]??null;
  const mastered=useMemo(()=>roleTasks.filter(verifiedMissionMastery).length,[roleTasks]);
  const dna=useMemo(()=>buildDNA(careerFor(roleMatches)),[roleMatches]);
  const strands=useMemo(()=>strandViews({tasks:roleTasks,role:active.role,baselineReady,dna,allHabits:plus}),[roleTasks,active.role,baselineReady,dna,plus]);
  const rows=useMemo(()=>matchRowViews(windowMatches,focusPair.map(({task})=>task)),[windowMatches,focusPair]);
  const form=useMemo(()=>recentForm(windowMatches,10),[windowMatches]);
  const main=useMemo(()=>mainChampion(roleMatches,active.champions,chosenMain),[roleMatches,active.champions,chosenMain]);
  const linked=devices.length>0;
  const online=devices.some(device=>recent(device.last_seen_at));

  const next=buildJourneyState({
    deviceLoaded,
    linked,
    online,
    baselineGames,
    dnaRevealed,
    focusName:missions.length===2?'Two DNA trees unlocked':primary?.name,
    focusJob:missions.length===2?`1. ${primary?.nextGame||''}  2. ${secondary?.nextGame||''}`:primary?.nextGame,
    focusConfirmed:primary?.confirmed,
    focusRequired:primary?.required,
  });
  const stages=climbJourney({deviceLoaded,linked,online,baselineGames,role:active.role,dnaRevealed,missions,masteredCount:mastered});

  const phase:MissionPhase=!hydrated||(authenticated&&!planReady)?'CHECKING'
    :planError?'ERROR'
    :!baselineReady?'BASELINE'
    :!dnaRevealed?'REVEAL'
    :primary?'MISSION':'EMPTY';

  const habits:HabitsBlock={
    stage:dna.stage,
    careerGames:dna.careerGames,
    nextAt:dna.next?.at??null,
    items:(plus?dna.habits.slice(0,3):dna.habits.slice(0,1)).map(reading=>({
      id:reading.id,name:reading.def.name,occurred:reading.occurred,measured:reading.measured,level:reading.level,
      colour:HABIT_COLOURS[reading.id],trend:pro?reading.trend?.direction??null:null,
    })),
    hidden:plus?0:Math.max(0,dna.habits.length-1),
  };
  const formWindow=tier==='PRO'?'Last 10':tier==='PLUS'?'Last 10 · 90 days':'Last 10 · 7 days';

  return <AppShell>
    <div className={s.page} data-arena="">
      <PlayerHero
        gameName={active.gameName}
        tagline={active.tagline}
        region={active.region}
        rank={parseRank(active.rank)}
        role={active.role}
        main={main}
        form={form}
        formWindow={formWindow}
        companion={{loaded:deviceLoaded,linked,online}}
        baseline={{games:baselineGames,required:DNA_BASELINE_GAMES,ready:baselineReady}}
      />

      <div className={s.rowMission}>
        <MissionCard phase={phase} role={active.role} baseline={{games:baselineGames,required:DNA_BASELINE_GAMES}} primary={primary} secondary={secondary} error={planError} primaryAction={next.phase==='MISSION'}/>
        <ClimbJourney stages={stages} next={next}/>
      </div>

      <GameDnaOverview
        key={active.id+':'+active.role}
        role={active.role}
        strands={strands}
        baseline={{games:baselineGames,required:DNA_BASELINE_GAMES,ready:baselineReady}}
        tier={tier}
        initialDomain={primary?.domain??null}
      />

      <div className={s.rowLower}>
        <MatchHistory rows={rows} windowLabel={historyWindowLabel(tier)} tier={tier} loading={!hydrated} olderHidden={Math.max(0,matches.length-windowMatches.length)}/>
        <CoachingIntelligence
          tier={tier}
          baselineReady={baselineReady}
          habits={habits}
          ladder={twin}
          memory={memory}
          improvement={{mastered,broken:pro?dna.broken.length:null}}
        />
      </div>
    </div>
  </AppShell>;
}
