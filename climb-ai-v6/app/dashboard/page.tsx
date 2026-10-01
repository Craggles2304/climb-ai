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

  const recentMatches=matches.slice(0,3);
  const activeMission=planMissions[0]??leadTask;
  const missionPlain=activeMission?plainLanguageFocus(activeMission):null;
  const missionProof=activeMission?missionSummary(activeMission):null;
  const currentWinRate=matches.length?Math.round(matches.filter(match=>match.result==='WIN').length/matches.length*100):0;
  const memoryGenes=[
    {id:'lane',label:'Laning',hint:'Trades, spacing, recalls',categories:['LANING','TRADING','RECALL_TIMING']},
    {id:'wave',label:'Waves & CS',hint:'Wave states, farming, resources',categories:['FARMING','WAVE_MANAGEMENT','RESOURCE_COLLECTION']},
    {id:'vision',label:'Vision & map',hint:'Vision, tracking, map checks',categories:['VISION','MAP_AWARENESS']},
    {id:'objectives',label:'Objectives',hint:'Objectives, tempo, conversion',categories:['OBJECTIVES','TEMPO']},
    {id:'fights',label:'Teamfights',hint:'Positioning, targets, survival',categories:['TEAMFIGHTING','TARGET_SELECTION','POSITIONING','DEATHS']},
    {id:'consistency',label:'Consistency',hint:'Repeat the read under pressure',categories:['CONSISTENCY','CHAMPION_MASTERY','MATCHUPS']},
  ].map(gene=>{
    const geneTasks=tasks.filter(task=>gene.categories.includes(task.category));
    const score=geneTasks.length?Math.round(geneTasks.reduce((sum,task)=>sum+Math.max(0,Math.min(100,task.progress||0)),0)/geneTasks.length):0;
    const mastered=geneTasks.filter(task=>task.status==='MASTERED').length;
    return{...gene,score,mastered,total:geneTasks.length};
  });
  const dnaStrength=Math.round(memoryGenes.reduce((sum,gene)=>sum+gene.score,0)/memoryGenes.length);
  const masteredMemories=tasks.filter(task=>task.status==='MASTERED').length;
  const learningMemories=tasks.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED').length;

  return <AppShell>
    <TrackView event="dashboard_view" props={{state:isEmpty?'empty':'ready'}}/>
    <div className="client-auth-dashboard">
      <header className="client-auth-head">
        <div>
          <div className="eyebrow">YOUR DAILY BRIEFING · {active.gameName}{active.tagline}</div>
          <h1>Welcome back, {active.gameName}.</h1>
          <p>One focus. Every game. Lasting improvement. Your real account, match evidence and coaching plan now live inside the same Client system you explored before signing in.</p>
        </div>
        <Link className="btn secondary" href="/account">PLAYER PROFILE →</Link>
      </header>

      {profile&&<ErrorBoundary label="live_game" compact><LiveGameCard gameName={profile.gameName} tagline={profile.tagline} region={profile.region} task={leadTask}/></ErrorBoundary>}
      {isEmpty&&<FirstRun task={leadTask} gameName={active.gameName}/>}

      <section className="client-overview-top">
        <article className="client-mission-hero">
          {mainChampion&&<img className="client-mission-art" src={championSplash(mainChampion)} alt="" aria-hidden="true"/>}
          <div className="client-mission-shade"/>
          <div className="client-mission-copy">
            <div className="eyebrow">YOUR NEXT GAME PLAN · {missionRankBand(active.rank)}</div>
            <h2>{missionPlain?.name||'Build your next'}<br/><em>{activeMission?'rep.':'useful focus.'}</em></h2>
            <p>{missionPlain?.why||'Play a tracked game and OP CLIMB will turn the evidence into one clear job for your next queue.'}</p>
            <div className="client-mission-actions">
              <Link className="btn primary" href="/live">OPEN MATCH ROOM →</Link>
              <Link className="btn secondary" href="/ilp">OPEN MY CLIMB</Link>
            </div>
          </div>
        </article>

        <aside className="glass client-rank-card">
          <div>
            <div className="eyebrow">YOUR RANKED SNAPSHOT</div>
            <div className="rank-name">{active.rank}</div>
            <div className="rank-role">{active.role} · {mainChampion||'Main champion not set'}</div>
          </div>
          <div className="client-rank-metrics">
            <div><span>TRACKED GAMES</span><b>{matches.length||'—'}</b></div>
            <div><span>WIN RATE</span><b>{matches.length?currentWinRate+'%':'—'}</b></div>
            <div><span>MAIN GAMES</span><b>{championStats.games||'—'}</b></div>
            <div><span>MAIN KDA</span><b>{championStats.games?championStats.kda:'—'}</b></div>
          </div>
        </aside>
      </section>

      <section className="client-metric-row" aria-label="Player development snapshot">
        <article className="client-metric"><span>ACTIVE FOCUS</span><b>{activeMission?activeMission.progress+'%':'—'}</b><small>{missionPlain?.success||'Waiting for measurable evidence'}</small></article>
        <article className="client-metric"><span>PROVEN REPS</span><b>{missionProof?missionProof.confirmed+'/'+missionProof.required:'—'}</b><small>{activeMission?missionRankBand(active.rank)+' proof bar':'No active mission yet'}</small></article>
        <article className="client-metric"><span>MAIN CHAMPION</span><b>{mainChampion||'—'}</b><small>{championStats.games?championStats.games+' tracked games':'Choose or establish your main'}</small></article>
        <article className="client-metric"><span>CS / MIN</span><b>{championStats.games?championStats.csPerMin:'—'}</b><small>{championStats.games?'Across tracked '+mainChampion+' games':'Build a baseline from real games'}</small></article>
      </section>

      <section className="client-loop-section">
        <div className="client-section-head">
          <div><div className="eyebrow">THE OP COACHING LOOP</div><h2>Stop repeating. Start improving.</h2></div>
          <span className="eyebrow">REAL ACCOUNT · REAL EVIDENCE</span>
        </div>
        <div className="client-loop-grid">
          <Link className="client-loop-card" href="/live"><span className="step">01 · PREPARE</span><h3>Know your job.</h3><p>Open the Match room before queueing and carry one useful rule into the game.</p><span className="link">Prepare next game →</span></Link>
          <Link className="client-loop-card" href="/analyse"><span className="step">02 · REVIEW</span><h3>Find the decision.</h3><p>Use your real match evidence to understand what held, what broke and what matters next.</p><span className="link">Review my games →</span></Link>
          <Link className="client-loop-card" href="/coach"><span className="step">03 · REMEMBER</span><h3>Build coaching memory.</h3><p>Your coach carries the thread across games so each answer starts from your development history.</p><span className="link">Open Coach memory →</span></Link>
        </div>
      </section>

      <section className="client-memory-section" id="coach-memory">
        <header className="client-memory-head">
          <div>
            <div className="eyebrow">THE OP CLIMB DIFFERENCE / SEASON-LONG COACHING</div>
            <h2>A coach that remembers you.</h2>
            <p>Your last game is one chapter. Your development is the whole story.</p>
          </div>
          <Link className="btn secondary" href="/coach">OPEN FULL COACH MEMORY →</Link>
        </header>

        <section className="client-dna-panel">
          <div className="client-dna-visual" aria-label="Game DNA based on your real development plan">
            <div className="client-dna-title"><span>GAME DNA</span><strong>{active.gameName}{active.tagline}</strong></div>
            <div className="client-dna-helix" aria-hidden="true">
              {memoryGenes.map((gene,index)=><div className="client-dna-rung" key={gene.id} style={{'--dna-progress':gene.score+'%','--dna-order':index} as React.CSSProperties}><i/><b/><span/></div>)}
            </div>
            <div className="client-dna-score"><b>{dnaStrength}%</b><span>DNA strength</span><small>{masteredMemories} memories · {learningMemories} learning</small></div>
          </div>
          <div className="client-dna-side">
            <div className="client-section-head"><div><span className="eyebrow">YOUR GAME DNA · MEMORY</span><h3>Every mission writes to memory.</h3></div><span className="client-plan-badge">REAL DATA</span></div>
            <p>Each part of your game strengthens as missions move from active practice into repeatable evidence. Mastered missions stay visible as memory rather than disappearing.</p>
            <div className="client-dna-genes">
              {memoryGenes.map(gene=><div className="client-dna-gene" key={gene.id}>
                <i style={{width:gene.score+'%'}}/>
                <div><strong>{gene.label}</strong><small>{gene.hint}</small></div>
                <b>{gene.score}%</b>
              </div>)}
            </div>
          </div>
        </section>

        <div className="client-memory-grid">
          <article className="client-memory-timeline-card">
            <div className="client-section-head"><h3>One habit. Your real context.</h3><span className="client-plan-badge">MEMORY</span></div>
            <div className="client-memory-timeline">
              <div><span>01</span><section><strong>Current focus</strong><p>{missionPlain?.name||'Build the first measurable focus.'} {missionPlain?.why||'OP CLIMB is waiting for enough real evidence to choose the next repeat.'}</p></section></div>
              <div><span>02</span><section><strong>Evidence building</strong><p>{missionProof?missionProof.confirmed+' of '+missionProof.required+' proven reps currently support this mission.':'No proven reps yet. The next tracked game starts the evidence trail.'}</p></section></div>
              <div><span>03</span><section><strong>Across games</strong><p>{matches.length?matches.length+' tracked games are available to test whether the same decision keeps appearing.':'Connect the Companion or add a game so the coach can compare the same decision across matches.'}</p></section></div>
              <div><span>04</span><section><strong>Next test</strong><p>{activeMission&&activeMission.status==='MASTERED'?'This habit is mastered. The coach can now re-test it in a new situation before moving on.':'Carry the current rule into the next game, then check whether it held without adding more advice.'}</p></section></div>
            </div>
          </article>

          <aside className="client-memory-carry-card">
            <span className="eyebrow">WHAT THE COACH CARRIES FORWARD</span>
            <h3>Not just your numbers.</h3>
            <div className="client-memory-criteria">
              <div><b>01</b><span>Recurring decision patterns</span></div>
              <div><b>02</b><span>Your current focus and why it matters</span></div>
              <div><b>03</b><span>Evidence that supports—or challenges—the read</span></div>
              <div><b>04</b><span>When the habit holds without help</span></div>
              <div><b>05</b><span>The next useful test, not a random tip</span></div>
            </div>
            <div className="client-memory-goal"><strong>The goal: need less help.</strong><p>Progress means you make the read yourself, even when the matchup or game state changes.</p></div>
            <Link className="btn secondary" href="/coach">ASK MY COACH →</Link>
          </aside>
        </div>
      </section>

      <section className="client-overview-bottom">
        <article className="glass client-real-matches">
          <div className="client-section-head">
            <div><div className="eyebrow">YOUR REAL MATCHES</div><h2>Every game has a lesson.</h2></div>
            <Link className="text-link" href="/analyse">MATCH REVIEW →</Link>
          </div>
          <div className="client-match-list">
            {recentMatches.length?recentMatches.map(match=><div className="client-match-row" key={match.id}>
              <div><span className={'result '+(match.result==='WIN'?'win':'loss')}>{match.result==='WIN'?'VICTORY':'DEFEAT'}</span></div>
              <div><div className="champ">{match.champion}</div><div className="meta">{match.role} · {match.kills}/{match.deaths}/{match.assists}</div></div>
              <Link className="text-link" href="/analyse">REVIEW →</Link>
            </div>):<div className="client-match-row"><div/><div><div className="champ">No tracked matches yet</div><div className="meta">Connect the Companion or add a game to start building your evidence.</div></div><Link className="text-link" href="/live">CONNECT →</Link></div>}
          </div>
        </article>

        <aside className="glass client-memory-card">
          <div className="eyebrow">COACH MEMORY</div>
          <h2>Your coach shouldn’t start from zero.</h2>
          <p>Keep the focus, evidence and repeated decisions connected across games. The authenticated workspace uses your actual development record rather than demo examples.</p>
          <div className="memory-progress"><span>CURRENT DEVELOPMENT THREAD</span><b>{missionPlain?.name||'BUILDING BASELINE'}</b></div>
          <Link className="btn secondary" href="/coach">OPEN COACH MEMORY →</Link>
        </aside>
      </section>

      <section className="client-plan-strip">
        <div><h3>Find your focus. Build your game. Develop the player.</h3><p>Your subscription changes coaching depth, not the visual system. The same Client workspace stays around you.</p></div>
        <Link className="btn secondary" href="/pricing">PLANS & UNLOCKS →</Link>
      </section>
    </div>
  </AppShell>;
}
