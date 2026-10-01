'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {TrackView} from '@/components/TrackView';
import {FirstRun} from '@/components/FirstRun';
import {LiveGameCard} from '@/components/LiveGameCard';
import {ErrorBoundary} from '@/components/ErrorState';
import {getMainChampion,setMainChampion} from '@/lib/mainChampion';
import type {Match,Role} from '@/lib/types';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {missionSummary} from '@/lib/missionLoop';
import {missionRankBand} from '@/lib/rankMissionBenchmarks';
import {MissionMeasurementBadge} from '@/components/MissionMeasurementBadge';

const CHAMPION_ASSET_IDS:Record<string,string>={
  Wukong:'MonkeyKing','Nunu & Willump':'Nunu','Renata Glasc':'Renata',"K'Sante":'KSante',"Cho'Gath":'Chogath',"Kai'Sa":'Kaisa',"Vel'Koz":'Velkoz',LeBlanc:'Leblanc',"Bel'Veth":'Belveth',"Rek'Sai":'RekSai',"Kog'Maw":'KogMaw','Dr. Mundo':'DrMundo','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Jarvan IV':'JarvanIV','Lee Sin':'LeeSin','Aurelion Sol':'AurelionSol','Twisted Fate':'TwistedFate','Tahm Kench':'TahmKench','Xin Zhao':'XinZhao'
};
const championAsset=(name:string)=>CHAMPION_ASSET_IDS[name]||name.replace(/[^A-Za-z0-9]/g,'');
const championSplash=(name?:string)=>name?`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championAsset(name)}_0.jpg`:'';

type MissionCard={
  id:string;
  title:string;
  target:string;
  unit:string;
  reason:string;
  baseline:string;
  last:string;
  tone:'lime'|'teal';
};

const avg=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const round1=(value:number)=>Math.round(value*10)/10;
const numbers=(values:Array<number|undefined>,includeZero=false)=>values.filter((value):value is number=>typeof value==='number'&&Number.isFinite(value)&&(includeZero||value>0));

function higherTarget(values:number[],minimumStep:number,ceilingStep:number){
  const average=avg(values);
  const best=Math.max(...values);
  const stretch=Math.max(minimumStep,average*.08);
  const desired=average+stretch;
  const capped=best>average?Math.min(desired,best):Math.min(desired,average+ceilingStep);
  return Math.max(1,Math.round(capped));
}

function buildGameMissions(samples:Match[],role:Role,champion:string):MissionCard[]{
  if(!samples.length){
    const farmRole=role==='ADC'||role==='MID'||role==='TOP';
    return [
      farmRole
        ?{id:'starter-cs10',title:'BUILD A CLEAN LANE',target:'50',unit:'CS @ 10:00',reason:`Starter target for your first tracked ${champion} game. Optimus will recalibrate it from your real baseline.`,baseline:'CALIBRATION GAME',last:'NO TRACKED BASELINE',tone:'lime'}
        :{id:'starter-survive',title:'START CLEAN',target:'0',unit:'DEATHS BEFORE 10:00',reason:`A simple first-game target while Optimus learns your ${champion} baseline.`,baseline:'CALIBRATION GAME',last:'NO TRACKED BASELINE',tone:'lime'},
      {id:'starter-deaths',title:'LIMIT FREE DEATHS',target:'≤ 4',unit:'TOTAL DEATHS',reason:'Conservative starter target. After this game the target will move to your actual level.',baseline:'CALIBRATION GAME',last:'NO TRACKED BASELINE',tone:'teal'},
    ];
  }

  const cs10=numbers(samples.map(match=>match.metrics.csAt10));
  const csMinute=numbers(samples.map(match=>match.metrics.csPerMin));
  const earlyDeaths=numbers(samples.map(match=>match.metrics.deathsPre10),true);
  const deaths=samples.map(match=>match.deaths).filter(Number.isFinite);
  const vision=numbers(samples.map(match=>match.metrics.visionScore));
  const kp=numbers(samples.map(match=>match.metrics.killParticipation)).map(value=>value<=1?value*100:value);
  const objectives=numbers(samples.map(match=>match.metrics.objectiveParticipation)).map(value=>value<=1?value*100:value);

  const last=samples[0];
  const first:MissionCard=(()=>{
    if((role==='ADC'||role==='MID'||role==='TOP')&&cs10.length>=2){
      const average=avg(cs10);
      const best=Math.max(...cs10);
      const target=higherTarget(cs10,3,6);
      return{id:'cs10',title:'WIN THE FIRST 10',target:String(target),unit:'CS @ 10:00',reason:`Your recent ${champion} average is ${Math.round(average)}. This is a small, reachable stretch — not a perfect-CS challenge.`,baseline:`AVG ${Math.round(average)} · BEST ${Math.round(best)}`,last:`LAST ${Math.round(last.metrics.csAt10||0)}`,tone:'lime'};
    }
    if(role==='SUPPORT'&&vision.length>=2){
      const average=avg(vision);
      const best=Math.max(...vision);
      const target=higherTarget(vision,2,5);
      return{id:'vision',title:'CONTROL MORE VISION',target:String(target),unit:'VISION SCORE',reason:`Your recent average is ${round1(average)}. The target only moves a little above your baseline.`,baseline:`AVG ${round1(average)} · BEST ${round1(best)}`,last:`LAST ${round1(last.metrics.visionScore||0)}`,tone:'lime'};
    }
    if(role==='JUNGLE'&&objectives.length>=2){
      const average=avg(objectives);
      const best=Math.max(...objectives);
      const target=Math.min(100,higherTarget(objectives,5,10));
      return{id:'objectives',title:'BE IN THE OBJECTIVE GAME',target:`${target}%`,unit:'OBJECTIVE PARTICIPATION',reason:`Your recent average is ${Math.round(average)}%. This asks for one realistic step above it.`,baseline:`AVG ${Math.round(average)}% · BEST ${Math.round(best)}%`,last:`LAST ${Math.round((last.metrics.objectiveParticipation||0)*(last.metrics.objectiveParticipation&&last.metrics.objectiveParticipation<=1?100:1))}%`,tone:'lime'};
    }
    if(csMinute.length>=2){
      const average=avg(csMinute);
      const best=Math.max(...csMinute);
      const target=Math.min(best>average?best:average+.5,average+.5);
      return{id:'cspm',title:'KEEP YOUR FARM MOVING',target:round1(target).toFixed(1),unit:'CS / MIN',reason:`Your recent average is ${round1(average)}. The target is only half a CS per minute higher.`,baseline:`AVG ${round1(average)} · BEST ${round1(best)}`,last:`LAST ${round1(last.metrics.csPerMin)}`,tone:'lime'};
    }
    const average=avg(deaths);
    const best=Math.min(...deaths);
    const target=Math.max(best,Math.floor(average-1));
    return{id:'deaths-primary',title:'CUT ONE DEATH',target:`≤ ${target}`,unit:'TOTAL DEATHS',reason:`You average ${round1(average)} deaths. This only asks you to remove roughly one.`,baseline:`AVG ${round1(average)} · BEST ${best}`,last:`LAST ${last.deaths}`,tone:'lime'};
  })();

  const earlyDeathGames=earlyDeaths.filter(value=>value>0).length;
  if(first.id!=='starter-survive'&&earlyDeaths.length>=2&&earlyDeathGames>0){
    return[first,{id:'early-deaths',title:'SURVIVE THE OPENING',target:'0',unit:'DEATHS BEFORE 10:00',reason:`You died before 10:00 in ${earlyDeathGames} of your last ${earlyDeaths.length} tracked games. This target removes that exact leak.`,baseline:`${earlyDeaths.length-earlyDeathGames}/${earlyDeaths.length} CLEAN STARTS`,last:`LAST ${last.metrics.deathsPre10||0}`,tone:'teal'}];
  }

  if(kp.length>=2){
    const average=avg(kp);
    const best=Math.max(...kp);
    const target=Math.min(100,higherTarget(kp,4,8));
    return[first,{id:'kp',title:'BE PART OF MORE KILLS',target:`${target}%`,unit:'KILL PARTICIPATION',reason:`Your recent average is ${Math.round(average)}%. This target stays inside your demonstrated range.`,baseline:`AVG ${Math.round(average)}% · BEST ${Math.round(best)}%`,last:`LAST ${Math.round((last.metrics.killParticipation||0)*(last.metrics.killParticipation&&last.metrics.killParticipation<=1?100:1))}%`,tone:'teal'}];
  }

  const average=avg(deaths);
  const best=Math.min(...deaths);
  const target=Math.max(best,Math.floor(average-1));
  return[first,{id:'deaths',title:'CUT ONE DEATH',target:`≤ ${target}`,unit:'TOTAL DEATHS',reason:`You average ${round1(average)} deaths in the sample. The mission only asks for one cleaner game.`,baseline:`AVG ${round1(average)} · BEST ${best}`,last:`LAST ${last.deaths}`,tone:'teal'}];
}

export default function Home(){
  const {active,isEmpty,profile}=useAccount();
  const matches=matchesFor(active.id);
  const {tasks}=useLearningPlan();
  const leadTask=tasks.find(task=>task.status!=='MASTERED'&&task.status!=='PAUSED');
  const [mainChampion,setMainChampionState]=useState<string>('');

  useEffect(()=>{
    const picked=getMainChampion()||active.champions?.[0]||'';
    const counts=new Map<string,number>();
    for(const match of matches)counts.set(match.champion,(counts.get(match.champion)||0)+1);
    const mostPlayed=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0];
    let next=picked||mostPlayed?.[0]||'';
    if(mostPlayed&&picked&&mostPlayed[0]!==picked){
      const pickedGames=counts.get(picked)||0;
      const [candidate,candidateGames]=mostPlayed;
      if(candidateGames>=5&&candidateGames>=pickedGames+3)next=candidate;
    }
    if(next){
      setMainChampionState(next);
      if(getMainChampion()!==next)setMainChampion(next);
    }
  },[active.id,active.champions,matches]);

  const championMatches=useMemo(()=>mainChampion?matches.filter(match=>match.champion===mainChampion):[],[mainChampion,matches]);
  const championStats=useMemo(()=>{
    if(!championMatches.length)return{games:0,winRate:0,kda:0,csPerMin:0};
    const wins=championMatches.filter(match=>match.result==='WIN').length;
    const kills=championMatches.reduce((sum,match)=>sum+match.kills,0);
    const deaths=championMatches.reduce((sum,match)=>sum+match.deaths,0);
    const assists=championMatches.reduce((sum,match)=>sum+match.assists,0);
    const cspm=championMatches.reduce((sum,match)=>sum+(match.metrics.csPerMin||0),0)/championMatches.length;
    return{games:championMatches.length,winRate:Math.round(wins/championMatches.length*100),kda:round1((kills+assists)/Math.max(1,deaths)),csPerMin:round1(cspm)};
  },[championMatches]);

  const planMissions=tasks.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED').slice(0,3);
  const latestMatches=matches.slice(0,3);
  const recentSample=matches.slice(0,20);
  const recentWins=recentSample.filter(match=>match.result==='WIN').length;
  const coreFocus=planMissions[0]?plainLanguageFocus(planMissions[0]):null;
  const playerName=active.gameName&&active.gameName!=='Complete onboarding'?active.gameName:'player';

  return <AppShell>
    <TrackView event="dashboard_view" props={{state:isEmpty?'empty':'ready'}}/>
    <div className="v7-stack client-home">
      <header className="client-home-intro">
        <div><p className="client-home-label">YOUR DAILY BRIEFING</p><h1>Welcome back, {playerName}.</h1><p>One focus. Every game. Lasting improvement.</p></div>
        <Link className="btn secondary" href="/analyse">Analyse my games →</Link>
      </header>
      {isEmpty&&<PageHead title="Your Climb" subtitle={active.gameName+active.tagline+' · '+active.rank+' · '+active.role}/>}
      {profile&&<ErrorBoundary label="live_game" compact><LiveGameCard gameName={profile.gameName} tagline={profile.tagline} region={profile.region} task={leadTask}/></ErrorBoundary>}
      {isEmpty&&<FirstRun task={leadTask} gameName={active.gameName}/>}

      <div className="client-home-top">
        <section className="client-home-plan">
          {mainChampion&&<img src={championSplash(mainChampion)} alt="" aria-hidden="true" className="client-home-plan-art"/>}
          <div className="client-home-plan-copy">
            <p className="client-home-label">YOUR NEXT GAME PLAN</p>
            <h2>Less autopilot.<br/><em>More intention.</em></h2>
            <p className="client-home-focus"><strong>{coreFocus?coreFocus.name:'Find your first focus.'}</strong><br/>{coreFocus?coreFocus.success:'Play a tracked game to build your personal coaching plan.'}</p>
            <Link className="btn primary" href="/session">Open my match plan →</Link>
          </div>
          {mainChampion&&<span className="client-home-art-credit">{mainChampion} · {active.role}</span>}
        </section>
        <aside className="client-home-rank">
          <p className="client-home-label">YOUR RANKED SNAPSHOT</p>
          <div><span className="client-home-rank-icon" aria-hidden="true">◇</span><strong>{active.rank}</strong></div>
          <p>{active.gameName}{active.tagline} · {active.region}</p>
          <div className="client-home-rank-footer"><div><b>{recentSample.length}</b><span>Recent games</span></div><div><b>{recentSample.length?`${Math.round(recentWins/recentSample.length*100)}%`:'—'}</b><span>Win rate</span></div></div>
        </aside>
      </div>

      <div className="client-home-metrics">
        <div><strong>{championStats.games||'—'}</strong><span>{mainChampion?`${mainChampion} games`:'Main champion games'}</span></div>
        <div><strong>{championStats.games?`${championStats.winRate}%`:'—'}</strong><span>Main champion win rate</span></div>
        <div><strong>{championStats.games?championStats.kda:'—'}</strong><span>Main champion KDA</span></div>
        <div><strong>{championStats.games?championStats.csPerMin:'—'}</strong><span>Main champion CS / min</span></div>
      </div>

      <section className="client-home-games">
        <div className="client-home-section-heading"><div><p className="client-home-label">MATCH REVIEW</p><h2>Every game has a lesson.</h2></div><Link href="/analyse">See all games →</Link></div>
        {latestMatches.length?<div className="client-home-match-list">{latestMatches.map(match=><Link href="/analyse" key={match.id} className={`client-home-match ${match.result==='WIN'?'win':'loss'}`}><span className="client-home-match-result">{match.result==='WIN'?'Victory':'Defeat'}</span><strong>{match.champion}</strong><span>{match.role} · {match.kills} / {match.deaths} / {match.assists}</span><span aria-hidden="true">→</span></Link>)}</div>:<p className="client-home-no-games">Your reviewed games will appear here after your first tracked match.</p>}
      </section>

      <section className="hq-main-card">
        {mainChampion&&<img className="hq-main-art" src={championSplash(mainChampion)} alt="" aria-hidden="true"/>}
        <div className="hq-main-overlay"/>
        <div className="hq-main-content">
          <div className="hq-main-topline"><span className="v7-badge engine">YOUR MAIN</span><span className="v7-badge">{championStats.games>=3?'AUTO-UPDATES FROM YOUR GAMES':'YOUR STARTING PICK'}</span></div>
          <div className="hq-main-copy">
            <div>
              <p className="hq-main-kicker">MAIN CHAMPION</p>
              <h2>{mainChampion||'CHOOSE YOUR MAIN'}</h2>
              <p className="hq-main-note">{mainChampion?'This starts from the champion you picked. If another champion clearly becomes your most played, Optimus updates it automatically.':'Pick your main champion so Optimus can build your player profile around what you actually play.'}</p>
            </div>
            <Link className="btn secondary" href="/champions/main">{mainChampion?'OPEN CHAMPION →':'CHOOSE MAIN →'}</Link>
          </div>
          <div className="hq-main-stats">
            <div><span>GAMES</span><b>{championStats.games||'—'}</b></div>
            <div><span>WIN RATE</span><b>{championStats.games?`${championStats.winRate}%`:'—'}</b></div>
            <div><span>KDA</span><b>{championStats.games?championStats.kda:'—'}</b></div>
            <div><span>CS / MIN</span><b>{championStats.games?championStats.csPerMin:'—'}</b></div>
          </div>
        </div>
      </section>
    </div>

    <section className="v7-section hq-game-missions">
      <div className="v7-section-head hq-mission-head">
        <div><div className="eyebrow">NEXT GAME · {missionRankBand(active.rank)} TARGETS</div><h2>One core. Two support.</h2><p className="muted">Your Core mission is the main job. Support missions keep developing in the background, and every proof bar scales with your current rank.</p></div>
      </div>
      {planMissions.length?<div className="hq-mission-grid">
        {planMissions.map((task,index)=>{
          const plain=plainLanguageFocus(task),summary=missionSummary(task);
          return <article key={task.id} className={`hq-mission-card ${index===0?'lime':'teal'} ${index===0?'is-core':''}`}>
            <div className="hq-mission-top"><span>{index===0?'CORE MISSION':'SUPPORT 0'+index}</span><MissionMeasurementBadge metric={task.metric} compact/></div>
            <h3>{plain.name}</h3>
            <div className="hq-mission-target"><strong>{task.progress}%</strong><span>{plain.success}</span></div>
            <div className="hq-mission-proof"><span>{summary.confirmed}/{summary.required} PROVEN REPS</span><span>{missionRankBand(active.rank)} BAR</span></div>
            <div className="hq-mission-why"><span>{index===0?'WHY THIS IS CORE':'WHY THIS SUPPORTS YOU'}</span><p>{plain.why}</p></div>
          </article>;
        })}
      </div>:<div className="glass card"><div className="eyebrow">PLAN BUILDING</div><h3>Play a tracked game.</h3><p className="muted">OP CLIMB will only create missions when your actual match data contains something it can measure.</p></div>}
    </section>
  </AppShell>;
}
