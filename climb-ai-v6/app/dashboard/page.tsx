'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
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

  const recentMatches=matches.slice(0,3);
  const activeMission=planMissions[0]??leadTask;
  const missionPlain=activeMission?plainLanguageFocus(activeMission):null;
  const missionProof=activeMission?missionSummary(activeMission):null;
  const currentWinRate=matches.length?Math.round(matches.filter(match=>match.result==='WIN').length/matches.length*100):0;
  const dnaMissions=useMemo<ClientDnaMission[]>(()=>{
    const defs:Array<{id:ClientDnaMission['c'];label:string;categories:string[]}>= [
      {id:'lane',label:'Laning',categories:['LANING','TRADING','RECALL_TIMING']},
      {id:'wave',label:'Waves & CS',categories:['FARMING','WAVE_MANAGEMENT','RESOURCE_COLLECTION']},
      {id:'vision',label:'Vision & map',categories:['VISION','MAP_AWARENESS']},
      {id:'obj',label:'Objectives',categories:['OBJECTIVES','TEMPO']},
      {id:'fight',label:'Teamfights',categories:['TEAMFIGHTING','TARGET_SELECTION','POSITIONING','DEATHS']},
      {id:'mind',label:'Mindset',categories:['CONSISTENCY','CHAMPION_MASTERY','MATCHUPS','ITEMISATION']},
    ];
    return defs.flatMap(def=>{
      const real=tasks.filter(task=>def.categories.includes(task.category)).slice(0,4).map(task=>({
        c:def.id,
        n:task.title,
        s:(task.status==='MASTERED'?3:task.progress>=100?2:1) as 0|1|2|3,
      }));
      while(real.length<4)real.push({c:def.id,n:`Awaiting next ${def.label} mission`,s:0});
      return real;
    });
  },[tasks]);
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
          <h2>{missionPlain?.name||'Build the next'}<br/><em>{activeMission?'rep.':'useful focus.'}</em></h2>
          <p><strong>{missionPlain?.success||'Your next tracked game creates the baseline.'}</strong><br/>{missionPlain?.why||'OP CLIMB turns your real match evidence into one clear decision to carry into queue.'}</p>
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
          <div className="between" style={{marginTop:8}}><small>Current focus</small><small>{activeMission?activeMission.progress+'%':'Building'}</small></div>
        </div>
        <div className="rank-footer">
          <div><b className="mint">{matches.length||'—'}</b><small>Tracked games</small></div>
          <div><b>{matches.length?currentWinRate+'%':'—'}</b><small>Win rate</small></div>
        </div>
      </aside>
    </div>

    <div className="metric-row">
      <div className="panel metric"><span className="metric-icon">◎</span><div><div className="value">{activeMission?activeMission.progress+'%':'—'}</div><p>Current focus</p></div></div>
      <div className="panel metric"><span className="metric-icon">✓</span><div><div className="value">{missionProof?missionProof.confirmed+'/'+missionProof.required:'—'}</div><p>Proven reps</p></div></div>
      <div className="panel metric"><span className="metric-icon">↗</span><div><div className="value">{championStats.games?championStats.csPerMin:'—'}</div><p>CS / min · {mainChampion||'main'}</p></div></div>
      <div className="panel metric"><span className="metric-icon">◈</span><div><div className="value">{masteredMemories}</div><p>Coaching memories</p></div></div>
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

      <section className="panel panel-padding memory-card">
        <div className="eyebrow" style={{color:'var(--gold)'}}>COACH MEMORY</div>
        <h2>Your coach shouldn’t start from zero.</h2>
        <p>Keep your patterns, test your fixes and find the next thing worth working on.</p>
        <div className="memory-mini"><span>Current memories<br/>Learning now</span><strong>{masteredMemories} <small>/ {learningMemories}</small></strong></div>
        <Link className="btn gold" href="#coach-memory">See what your coach remembers →</Link>
      </section>
    </div>

    <section id="coach-memory" style={{marginTop:30}}>
      <header className="page-head">
        <div>
          <div className="eyebrow">THE OP CLIMB DIFFERENCE / SEASON-LONG COACHING</div>
          <h1>A coach that remembers you.</h1>
          <p>Your last game is one chapter. Your development is the whole story.</p>
        </div>
        <Link className="btn btn-small" href="/coach">Open full coach →</Link>
      </header>

      <ClientGameDna player={active.gameName+active.tagline} missions={dnaMissions}/>

      <div className="climb-grid">
        <section className="panel panel-padding memory-panel">
          <div className="section-head"><h2>One habit. Your real context.</h2><span className="tag gold">Memory</span></div>
          <div className="memory-timeline">
            <div className="memory-event"><span>NOW</span><div><h3>Find the repeat.</h3><p>{missionPlain?.name||'Build the first measurable focus.'} {missionPlain?.why||'OP CLIMB is waiting for enough evidence to choose the first repeat.'}</p></div></div>
            <div className="memory-event"><span>PROOF</span><div><h3>Practise one decision.</h3><p>{missionProof?missionProof.confirmed+' of '+missionProof.required+' proven reps currently support this mission.':'The next tracked game starts the evidence trail.'}</p></div></div>
            <div className="memory-event"><span>GAMES</span><div><h3>Use fewer prompts.</h3><p>{matches.length?matches.length+' tracked games can now test whether the same decision holds across different situations.':'Connect the Companion so the coach can compare the same decision across games.'}</p></div></div>
            <div className="memory-event"><span>NEXT</span><div><h3>Test it somewhere new.</h3><p>{activeMission?.status==='MASTERED'?'This habit is mastered. Re-test it in a new situation before moving on.':'Carry the same rule into the next game and check whether it holds without adding more advice.'}</p></div></div>
          </div>
        </section>

        <aside className="panel panel-padding">
          <span className="eyebrow accent">WHAT THE COACH CARRIES FORWARD</span>
          <h2 style={{marginTop:12}}>Not just your numbers.</h2>
          <div className="criteria">
            <div><span className="mint">◎</span><span>Recurring decision patterns</span></div>
            <div><span className="mint">◎</span><span>Your current focus and why it matters</span></div>
            <div><span className="mint">◎</span><span>Examples that support—or challenge—the read</span></div>
            <div><span className="mint">◎</span><span>When the habit holds without help</span></div>
            <div><span className="mint">◎</span><span>The next useful test, not a random tip</span></div>
          </div>
          <div className="micro-box"><strong>The goal: need less help.</strong><p>Progress means you make the read yourself, even in a new situation.</p></div>
          <Link className="btn gold" style={{width:'100%',marginTop:20}} href="/coach">Open Coach memory →</Link>
        </aside>
      </div>

      <div className="memory-outcomes">
        <article className="panel outcome"><span className="eyebrow">MEMORIES BANKED</span><strong>{masteredMemories}</strong><p>Mastered missions that stay in the player model.</p></article>
        <article className="panel outcome"><span className="eyebrow">LEARNING NOW</span><strong>{learningMemories}</strong><p>Active development threads still gathering evidence.</p></article>
        <article className="panel outcome"><span className="eyebrow">THE NEXT TEST</span><strong>{activeMission?'NEXT GAME':'BASELINE'}</strong><p>{activeMission?'Can the current read hold again without extra help?':'Play a tracked game to establish the first real coaching thread.'}</p></article>
      </div>
    </section>

    <section className="home-plan-strip">
      <span className="metric-icon">◆</span>
      <div><h3>Find your focus. Build your game. Develop the player.</h3><p>Your plan changes coaching depth, not the Client workspace around you.</p></div>
      <Link className="btn" href="/pricing">Compare unlocks →</Link>
    </section>
  </AppShell>;
}
