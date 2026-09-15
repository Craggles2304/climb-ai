'use client';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {AnimatedBar,CountUp,useMounted,revealProps} from '@/components/Motion';
import dynamic from 'next/dynamic';
import {SyncPanel} from '@/components/SyncPanel';
import {LeakPriceCard} from '@/components/LeakPrice';
import {TrackView} from '@/components/TrackView';
import {TiltBanner} from '@/components/TiltBanner';
import {FirstRun} from '@/components/FirstRun';
import {LiveGameCard} from '@/components/LiveGameCard';
import {ErrorBoundary} from '@/components/ErrorState';
import {BehaviourCheck} from '@/components/BehaviourCheck';
import {readTilt,sessionResults} from '@/lib/tilt';
import {currentSession} from '@/lib/sessions';
import {missionEvidence,missionSummary} from '@/lib/missionLoop';
import {priceLeak} from '@/lib/costOfLeak';
import {climbScore} from '@/lib/engine';
import {championPlans} from '@/data/learning';
import {Match} from '@/lib/types';
import {coachingLevelFor} from '@/lib/coachingLevel';

const EconomyCurve=dynamic(
  ()=>import('@/components/EconomyCurve').then(m=>m.EconomyCurve),
  {ssr:false,loading:()=><div className="glass chart-card" aria-busy="true"><div className="chart-head"><div><div className="eyebrow">ECONOMY TREND</div><div className="skeleton skeleton-lg" style={{marginTop:12}}/></div></div><div className="skeleton" style={{height:286,borderRadius:16}}/></div>},
);

export default function DevelopmentHQ(){
  const mounted=useMounted();
  const {active,isEmpty,profile}=useAccount();
  const matches=matchesFor(active.id);
  const last=matches[0];
  const {tasks,recordMissionResult}=useLearningPlan();
  const detail=coachingLevelFor(active.rank);
  const score=climbScore(matches);

  const activeTasks=tasks.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED').slice(0,5);
  const leadTask=activeTasks[0];
  const leadMission=leadTask?missionSummary(leadTask):null;
  const leadEvidence=leadTask?missionEvidence(leadTask,last):null;
  const masteredCount=tasks.filter(t=>t.status==='MASTERED').length;
  const passes=activeTasks.reduce((n,t)=>n+(t.successfulGames||0),0);
  const required=activeTasks.reduce((n,t)=>n+(t.masteryRequired||3),0)||1;
  const onTrack=activeTasks.filter(t=>t.progress>=55).length;
  const leadMetric=leadTask?.metric||'post15CsPerMin';
  const leakPrice=priceLeak(matches,leadMetric);
  const tilt=readTilt(matches);
  const session=currentSession(matches);

  const recent=matches.slice(0,5);
  const avgOf=(k:keyof Match['metrics'])=>{const v=recent.map(m=>m.metrics[k]).filter((x):x is number=>typeof x==='number');return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
  const lane=avgOf('laneCsPerMin');
  const post=avgOf('post15CsPerMin');
  const objective=avgOf('objectiveParticipation');
  const lanePhaseRole=active.role!=='JUNGLE';
  const laneSignal=lane!==null&&post!==null?{value:`${lane.toFixed(1)} → ${post.toFixed(1)}`,detail:`Lane to post-15 CS/min across your last ${recent.length}. ${post>=6?'You are currently clearing the 6.0 target.':`You are ${(6-post).toFixed(1)} below the 6.0 target.`}`}:null;
  const objectiveSignal=objective!==null?{value:`${Math.round(objective*100)}%`,detail:`Objective involvement across your last ${recent.length}.`}:null;
  const economy=(lanePhaseRole?laneSignal??objectiveSignal:objectiveSignal??laneSignal)??{value:'UNAVAILABLE',detail:'Connect or upload matches to generate a signal.'};
  const headline=leadTask?leadTask.title.toUpperCase():(active.role==='JUNGLE'?'ARRIVE BEFORE THE OBJECTIVE IS LOST.':'BUILD YOUR FIRST NEXT-GAME MISSION.');
  const championCount=detail.depth<=1?1:detail.depth<=3?2:3;

  if(isEmpty){
    return <AppShell><TrackView event="dashboard_view" props={{state:'empty'}}/><PageHead title="Development HQ" subtitle={`${active.gameName}${active.tagline} · ${active.rank} · ${detail.tier} VIEW ${detail.depth}/10`} action={<Link className="btn secondary" href="/account">SWITCH ACCOUNT</Link>}/>{profile&&<ErrorBoundary label="live_game" compact><LiveGameCard gameName={profile.gameName} tagline={profile.tagline} region={profile.region} task={leadTask}/></ErrorBoundary>}<FirstRun task={leadTask} gameName={active.gameName}/></AppShell>;
  }

  return <AppShell>
    <TrackView event="dashboard_view"/>
    <PageHead title="Development HQ" subtitle={`${active.gameName}${active.tagline} · ${active.rank} · ${detail.tier} VIEW ${detail.depth}/10 · ${detail.summary}`} action={<Link className="btn secondary" href="/account">SWITCH ACCOUNT</Link>}/>

    <div className="v7-stack">
      {profile&&<ErrorBoundary label="live_game" compact><LiveGameCard gameName={profile.gameName} tagline={profile.tagline} region={profile.region} task={leadTask}/></ErrorBoundary>}
      {detail.depth>=2&&<ErrorBoundary label="tilt" compact><TiltBanner read={tilt} results={sessionResults(session)}/></ErrorBoundary>}

      <section className="hq-command">
        <div className="hq-top"><span className="v7-badge engine">{detail.tier} COACH</span><span className="v7-badge">#1 FOCUS</span>{detail.depth>=3&&<span className="v7-badge">{leadMission?.stage||'DISCOVER'}</span>}</div>
        <h2>{headline}</h2>
        <p>{leadTask?.gameRule||'Track a meaningful game and OP CLIMB will promote the first evidence-backed behaviour.'}</p>

        <div className="hq-rules">
          <div><span className="label">DO THIS NEXT GAME</span><b>{leadTask?.gameRule||'Collect a full match first.'}</b></div>
          {detail.depth>=2&&<div><span className="label">WHY</span><b>{leadTask?.why||'The plan is waiting for enough evidence to isolate the next behaviour.'}</b></div>}
          {detail.depth>=3&&<div><span className="label">PASS WHEN</span><b>{leadTask?.target||'Complete one meaningful tracked game.'}</b></div>}
        </div>

        <div className="hq-progress"><AnimatedBar value={leadTask?.progress||0} delay={220}/><span>{detail.depth<=2?`${leadTask?.progress||0}% COMPLETE`:(leadMission?`${leadMission.confirmed}/${leadMission.required} CONFIRMED REPS · ${leadTask?.progress||0}%`:'0/3 CONFIRMED REPS')}</span></div>

        {detail.depth>=3&&(last&&leadTask&&leadEvidence?.available?<BehaviourCheck matchId={last.id} taskId={leadTask.id} behaviour={leadTask.gameRule} clearedBar={leadEvidence.clearedBar} onResult={attempt=>recordMissionResult(leadTask.id,attempt)}/>:leadTask&&leadEvidence?<div className="rep"><div className="eyebrow">MISSION EVIDENCE</div><b className="rep-headline">No guessed pass.</b><p className="rep-detail">{leadEvidence.reason}</p></div>:null)}

        <div className="hero-actions"><Link className="btn primary" href="/live">PLAY + TRACK</Link><Link className="btn secondary" href="/ilp">MY ACTIVE FIVE</Link>{detail.depth>=3&&<Link className="btn secondary" href="/missions">MISSION LAB</Link>}</div>
      </section>

      {detail.depth>=5&&<><TrackView event={leakPrice.status==='READY'?'leak_priced':'leak_insufficient_sample'} props={{metric:leadMetric,gap:leakPrice.gapPoints,confidence:leakPrice.confidence,sample:leakPrice.sample}}/><ErrorBoundary label="leak_price"><LeakPriceCard price={leakPrice} rankBand={active.rank} role={active.role}/></ErrorBoundary></>}

      <section className="hq-signals">
        <div {...revealProps(mounted,0,'glass hq-signal')}><span>{detail.depth<=2?'YOUR LEVEL':'OP SCORE'}</span><strong><CountUp value={score}/></strong><small>{detail.depth<=2?'A simple improvement score. Higher means your recent habits are moving the right way.':'Internal improvement score across your last 10. It does not predict Riot MMR.'}</small></div>
        {detail.depth>=2&&<div {...revealProps(mounted,1,'glass hq-signal')}><span>{lanePhaseRole?'FARM AFTER LANE':'OBJECTIVE SETUP'}</span><strong>{economy.value}</strong><small>{detail.depth>=4?economy.detail:'This is the main economy signal worth watching right now.'}</small></div>}
        {detail.depth>=3&&<div {...revealProps(mounted,2,'glass hq-signal')}><span>LAST GAME</span><strong className={last?.result==='WIN'?'success':'danger'}>{last?last.result:'NO GAMES'}</strong><small>{last?`${last.champion} · ${last.kills}/${last.deaths}/${last.assists}${detail.depth>=4?` · ${last.metrics.csPerMin.toFixed(1)} CS/min`:''}${detail.depth>=6?` · ${last.metrics.deathsPost20??0} post-20 deaths`:''}`:'Upload or connect a match to generate a verdict.'}</small></div>}
        {detail.depth>=4&&<div {...revealProps(mounted,3,'glass hq-signal')}><span>ACTIVE FIVE HEALTH</span><strong>{onTrack}/{activeTasks.length} on track</strong><small>{passes} of {required} passes banked · {masteredCount} mastered.</small></div>}
      </section>
      {detail.depth>=3&&<SyncPanel/>}
    </div>

    {detail.depth>=4&&<section className="v7-section"><ErrorBoundary label="economy_curve"><EconomyCurve matches={matches} role={active.role} target={lanePhaseRole?6:.7}/></ErrorBoundary></section>}

    <section className="v7-section">
      <div className="v7-section-head"><div><div className="eyebrow">MY ACTIVE FIVE</div><h2>{detail.depth<=2?'Five simple things to improve. #1 matters most.':'The behaviours your games are currently testing.'}</h2></div><Link className="v7-link" href="/ilp">OPEN ACTIVE FIVE →</Link></div>
      <div className="hq-behaviours">{activeTasks.map((t,i)=>{const req=t.masteryRequired||3;const done=t.successfulGames||0;return <Link key={t.id} {...revealProps(mounted,i,'glass hq-behaviour')} href="/ilp"><div className="hq-bfoot"><span className="dc-index">0{i+1}</span>{detail.depth>=4&&<span className={`v7-badge ${t.source==='COACH'?'coach':'engine'}`}>{t.source==='COACH'?'COACH':'GAME DATA'}</span>}</div>{detail.depth>=3&&<span className="label">{t.category.replaceAll('_',' ')}</span>}<h3>{t.title}</h3><AnimatedBar value={t.progress} delay={i*60}/><div className="hq-bfoot"><span>{t.progress}%</span>{detail.depth>=3&&<span>{done}/{req} GOOD GAMES</span>}</div></Link>})}</div>
    </section>

    <section className="v7-section">
      <div className="v7-section-head"><div><div className="eyebrow">CHAMPION DEVELOPMENT</div><h2>{detail.depth<=2?'Only the champion advice you need at your level.':'Champion plans grow in detail as your rank grows.'}</h2></div><Link className="v7-link" href="/champions">CHAMPIONS →</Link></div>
      <div className="hq-champs">{active.champions.slice(0,championCount).map((c,i)=>{const plan=championPlans[c];return <Link key={c} {...revealProps(mounted,i,'glass hq-champ')} href={`/champions/${encodeURIComponent(c)}`}><span className="hq-rank">0{i+1}</span><div><div className="eyebrow">{detail.tier} · {active.role}</div><h3>{c}</h3>{detail.depth>=2&&<p>{plan?.rankFocus[0]||'Your next champion-specific focus.'}</p>}<b>OPEN {detail.tier} PLAN →</b></div></Link>})}</div>
    </section>
  </AppShell>;
}
