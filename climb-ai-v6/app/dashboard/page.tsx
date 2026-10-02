'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {filterHistoryForTier,historyWindowLabel} from '@/lib/subscription';
import {TrackView} from '@/components/TrackView';
import {FirstRun} from '@/components/FirstRun';
import {LiveGameCard} from '@/components/LiveGameCard';
import {ErrorBoundary} from '@/components/ErrorState';
import {ClientGameDna,type ClientDnaMission} from '@/components/ClientGameDna';
import {getMainChampion,setMainChampion} from '@/lib/mainChampion';
import type {Match,Role} from '@/lib/types';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {missionSummary} from '@/lib/missionLoop';
import {missionRankBand} from '@/lib/rankMissionBenchmarks';
import {DNA_DOMAINS,DNA_DOMAIN_GENE,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady,dnaTaskProgress,dnaTaskState} from '@/lib/dnaGrowth';
import {currentGameDnaMissions,gameDnaClientMissions} from '@/lib/gameDnaSnapshot';

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
  const {tier}=useSubscription();
  const allTrackedMatches=matchesFor(active.id);
  const matches=filterHistoryForTier(allTrackedMatches,tier);
  const baselineGames=useMemo(()=>dnaBaselineGameCount(allTrackedMatches,active.role),[allTrackedMatches,active.role]);
  const baselineReady=dnaBaselineReady(baselineGames);
  const {tasks}=useLearningPlan();
  const leadTask=baselineReady?tasks.find(task=>task.status!=='MASTERED'&&task.status!=='PAUSED'):undefined;
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

  const planMissions=baselineReady?currentGameDnaMissions(tasks,active.role).flatMap(({task})=>task?[task]:[]):[];

  const recentMatches=matches.slice(0,3);
  const activeMission=planMissions[0]??leadTask;
  const missionPlain=activeMission?plainLanguageFocus(activeMission):null;
  const missionProof=activeMission?missionSummary(activeMission):null;
  const currentWinRate=matches.length?Math.round(matches.filter(match=>match.result==='WIN').length/matches.length*100):0;
  const dnaMissions=useMemo<ClientDnaMission[]>(()=>gameDnaClientMissions(tasks,active.role),[tasks,active.role]);
  const masteredMemories=tasks.filter(task=>task.status==='MASTERED').length;
  const learningMemories=tasks.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED').length;

  return <AppShell>
    <TrackView event="dashboard_view" props={{state:isEmpty?'empty':'ready'}}/>

    <header className="page-head">
      <div>
        <div className="eyebrow">YOUR DAILY BRIEFING · {active.gameName}{active.tagline}</div>
        <h1>Welcome back, {active.gameName}.</h1>
        <p>One focus. Every game. Lasting improvement.</p>
      </div>
      <Link className="btn btn-small" href="/client">Explore the client ◎</Link>
    </header>

    {profile&&<ErrorBoundary label="live_game" compact><LiveGameCard gameName={profile.gameName} tagline={profile.tagline} region={profile.region} task={leadTask}/></ErrorBoundary>}
    {isEmpty&&<FirstRun task={leadTask} gameName={active.gameName}/>}

    <div className="overview-top">
      <section className="mission">
        {mainChampion&&<img className="mission-art" src={championSplash(mainChampion)} alt="" aria-hidden="true"/>}
        <div className="mission-copy">
          <div className="eyebrow">◎ YOUR NEXT GAME PLAN</div>
          <h2>{baselineReady?(missionPlain?.name||'Build the next'):'Build your baseline'}<br/><em>{baselineReady?(activeMission?'rep.':'useful focus.'):`${Math.min(baselineGames,DNA_BASELINE_GAMES)}/${DNA_BASELINE_GAMES} games.`}</em></h2>
          <p><strong>{baselineReady?(missionPlain?.success||'Your next tracked game creates the next useful rep.'):'Play normally for three tracked games.'}</strong><br/>{baselineReady?(missionPlain?.why||'OP CLIMB turns your real match evidence into one clear decision to carry into queue.'):'OP CLIMB is observing before it gives you personalised challenges. Your DNA stays at 0% until the baseline is complete.'}</p>
          <div className="mission-actions">
            <Link className="btn primary" href="/live">Open my match plan →</Link>
            <Link className="pin-btn" href="/ilp" aria-label="Open my climb">⌖</Link>
          </div>
        </div>
        <span className="art-credit">{mainChampion||'YOUR MAIN'} · {active.role}</span>
      </section>

      <aside className="rank-card panel">
        <div className="eyebrow">YOUR RANKED SNAPSHOT</div>
        <div className="rank-main">
          <span className="rank-emblem">♜</span>
          <div><h3>{active.rank}</h3><p>{active.role}</p></div>
        </div>
        <div className="rank-progress">
          <div className="progress-track"><span style={{width:(activeMission?.progress??0)+'%'}}/></div>
          <div className="between" style={{marginTop:8}}><small>{baselineReady?'Current focus':'DNA baseline'}</small><small>{baselineReady?(activeMission?activeMission.progress+'%':'Building'):`${Math.min(baselineGames,DNA_BASELINE_GAMES)}/${DNA_BASELINE_GAMES}`}</small></div>
        </div>
        <div className="rank-footer">
          <div><b className="mint">{matches.length||'—'}</b><small>Tracked games</small></div>
          <div><b>{matches.length?currentWinRate+'%':'—'}</b><small>Win rate</small></div>
        </div>
      </aside>
    </div>

    <div className="metric-row">
      <div className="panel metric"><span className="metric-icon">◎</span><div><div className="value">{baselineReady?(activeMission?activeMission.progress+'%':'—'):'0%'}</div><p>{baselineReady?'Current focus':'DNA baseline'}</p></div></div>
      <div className="panel metric"><span className="metric-icon">✓</span><div><div className="value">{missionProof?missionProof.confirmed+'/'+missionProof.required:'—'}</div><p>Proven reps</p></div></div>
      <div className="panel metric"><span className="metric-icon">↗</span><div><div className="value">{championStats.games?championStats.csPerMin:'—'}</div><p>CS / min · {mainChampion||'main'}</p></div></div>
      <div className="panel metric"><span className="metric-icon">◈</span><div><div className="value">{tier==='PRO'?masteredMemories:tier==='PLUS'?'90D':'7D'}</div><p>{tier==='PRO'?'Coaching memories':'History window'}</p></div></div>
    </div>

    <section className="loop-section">
      <div className="section-head">
        <div><h2>Stop repeating. Start improving.</h2></div>
        <span className="eyebrow">THE OP COACHING LOOP</span>
      </div>
      <div className="loop-grid">
        <Link className="panel loop-card" href="/live"><span className="loop-number">01</span><span className="metric-icon">⚔</span><h3>Know your win condition</h3><p>A plan for the lane, the fight and your job.</p><span className="link-label">Prepare your next game →</span></Link>
        <Link className="panel loop-card" href="/analyse"><span className="loop-number">02</span><span className="metric-icon">▣</span><h3>Find the turning point</h3><p>One decision to understand. Not twenty graphs.</p><span className="link-label">Review your last game →</span></Link>
        <Link className="panel loop-card" href="#coach-memory"><span className="loop-number">03</span><span className="metric-icon">◎</span><h3>Make the habit stick</h3><p>A coach that remembers and tests your progress.</p><span className="link-label">Explore coaching memory →</span></Link>
      </div>
    </section>

    <div className="overview-bottom">
      <section className="panel panel-padding">
        <div className="section-head"><h2>Every game has a lesson.</h2><Link className="text-btn" href="/analyse">Match review →</Link></div>
        <div className="match-list">
          {recentMatches.length?recentMatches.map(match=><Link href="/analyse" className={'match-row '+(match.result==='WIN'?'':'loss')} key={match.id}>
            <span className="result-line"/>
            <span className="champion-avatar" style={{backgroundImage:`url(${championSplash(match.champion)})`}}/>
            <span className="match-name"><strong><span className="match-result">{match.result==='WIN'?'VICTORY':'DEFEAT'}</span>{match.champion}</strong><small>{match.role} · tracked match</small></span>
            <span className="kda">{match.kills} / {match.deaths} / {match.assists}<small>{match.metrics.csPerMin?match.metrics.csPerMin.toFixed(1)+' CS/min':'Review ready'}</small></span>
            <span>→</span>
          </Link>):<div className="match-row"><span className="result-line"/><span className="champion-avatar"/><span className="match-name"><strong>NO TRACKED MATCHES YET</strong><small>Connect the Companion to begin.</small></span><Link className="text-btn" href="/live">Connect →</Link></div>}
        </div>
        <p className="sample-caption">YOUR MATCHES · SELECT A GAME TO SEE THE COACH’S READ</p>
      </section>

      {tier==='PRO'?<section className="panel panel-padding memory-card" id="coach-memory">
        <div className="eyebrow" style={{color:'var(--gold)'}}>{active.role} GAME DNA · PRO</div>
        <h2>Your {active.role} development profile.</h2>
        <div className="dashboard-dna-preview"><ClientGameDna compact player={active.gameName+active.tagline} role={active.role} missions={dnaMissions} baselineGames={baselineGames} baselineRequired={DNA_BASELINE_GAMES}/></div>
        <div className="memory-mini"><span>Memories banked<br/>Learning now</span><strong>{masteredMemories} <small>/ {learningMemories}</small></strong></div>
        <p>Only {active.role} games progress this DNA. Other roles keep separate strands, levels, missions and history.</p>
        <Link className="btn gold" href="/coach">Open Coach →</Link>
      </section>:<section className="panel panel-padding memory-card memory-locked">
        <div className="eyebrow" style={{color:'var(--gold)'}}>COACH MEMORY · PRO</div>
        <h2>A coach that remembers you.</h2>
        <p>{tier==='PLUS'?'PLUS understands the current game. PRO adds persistent cross-game memory, transfer tests and Game DNA.':'FREE proves the coaching loop. PRO adds persistent cross-game memory, transfer tests and Game DNA.'}</p>
        <div className="memory-mini"><span>YOUR CURRENT HISTORY</span><strong>{historyWindowLabel(tier)}</strong></div>
        <Link className="btn gold" href="/pricing">See PRO memory →</Link>
      </section>}
    </div>

    <section className="home-plan-strip">
      <span className="metric-icon">◆</span>
      <div><h3>Find your focus. Build your game. Develop the player.</h3><p>Your plan changes coaching depth, not the Client workspace around you.</p></div>
      <Link className="btn" href="/pricing">Compare unlocks →</Link>
    </section>
  </AppShell>;
}