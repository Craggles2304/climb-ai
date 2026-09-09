'use client';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useAccount,matchesFor,missionFor} from '@/components/AccountContext';
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
import {METRIC_SPECS,clears} from '@/lib/metrics';
import {priceLeak} from '@/lib/costOfLeak';
import {climbScore} from '@/lib/engine';
import {championPlans} from '@/data/learning';
import {Match} from '@/lib/types';

/**
 * Recharts is ~115 kB and only one card needs it, so it is split out of the
 * dashboard's first load and swapped in behind a skeleton.
 */
const EconomyCurve=dynamic(
  ()=>import('@/components/EconomyCurve').then(m=>m.EconomyCurve),
  {
    ssr:false,
    loading:()=><div className="glass chart-card" aria-busy="true">
      <div className="chart-head"><div>
        <div className="eyebrow">ECONOMY CURVE</div>
        <div className="skeleton skeleton-lg" style={{marginTop:12}}/>
      </div></div>
      <div className="skeleton" style={{height:286,borderRadius:16}}/>
    </div>,
  },
);

export default function DevelopmentHQ(){
  const mounted=useMounted();
  const {active,isEmpty,profile}=useAccount();
  const matches=matchesFor(active.id);
  const last=matches[0];
  const mission=missionFor(active.id);
  const {tasks}=useLearningPlan();
  const score=climbScore(matches);

  const activeTasks=tasks.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED').slice(0,5);
  const masteredCount=tasks.filter(t=>t.status==='MASTERED').length;
  const passes=activeTasks.reduce((n,t)=>n+(t.successfulGames||0),0);
  const required=activeTasks.reduce((n,t)=>n+(t.masteryRequired||3),0)||1;
  const onTrack=activeTasks.filter(t=>t.progress>=55).length;

  // The lead behaviour is what the plan is currently chasing, so that is the
  // leak worth pricing at the top of the page.
  const leadMetric=activeTasks[0]?.metric||mission.metric;
  const leakPrice=priceLeak(matches,leadMetric);

  // Session state decides whether any of the coaching below is worth reading.
  const tilt=readTilt(matches);
  const session=currentSession(matches);

  // Did the last game clear the bar behind the lead behaviour? The player
  // supplies the other half — whether they actually ran the behaviour.
  const leadSpec=METRIC_SPECS[leadMetric];
  const lastValue=last&&leadSpec?last.metrics[leadSpec.key]:undefined;
  const lastCleared=leadSpec&&typeof lastValue==='number'?clears(leadSpec,lastValue):false;

  const recent=matches.slice(0,5);
  const avgOf=(k:keyof Match['metrics'])=>{
    const v=recent.map(m=>m.metrics[k]).filter((x):x is number=>typeof x==='number');
    return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
  };
  const lane=avgOf('laneCsPerMin');
  const post=avgOf('post15CsPerMin');
  const objective=avgOf('objectiveParticipation');

  // Which signal leads is a role question, not a "which field happens to exist"
  // question. Lane CS/min is not a jungler's economy story even when the field
  // is populated, so roles without a lane phase lead on objective involvement.
  const lanePhaseRole=active.role!=='JUNGLE';
  const laneSignal=lane!==null&&post!==null
    ?{value:`${lane.toFixed(1)} → ${post.toFixed(1)}`,
      detail:`Lane to post-15 CS/min across your last ${recent.length}. Target is 6.0 post-15 — ${post>=6?'currently clearing it.':`${(6-post).toFixed(1)} short.`}`}
    :null;
  const objectiveSignal=objective!==null
    ?{value:`${Math.round(objective*100)}%`,
      detail:`Objective involvement across your last ${recent.length}. Target is 70%.`}
    :null;
  const economy=(lanePhaseRole?laneSignal??objectiveSignal:objectiveSignal??laneSignal)
    ??{value:'UNAVAILABLE',detail:'Connect or upload matches to generate an economy signal.'};

  const headline=active.role==='JUNGLE'
    ?'ARRIVE BEFORE THE OBJECTIVE IS LOST.'
    :'DON’T GIVE AWAY YOUR MID-GAME ECONOMY.';

  if(isEmpty){
    return <AppShell>
      <TrackView event="dashboard_view" props={{state:'empty'}}/>
      <PageHead
        title="Development HQ"
        subtitle={`${active.gameName}${active.tagline} · ${active.rank} · ${active.role} · No matches analysed yet.`}
        action={<Link className="btn secondary" href="/account">SWITCH ACCOUNT</Link>}
      />
      {/* A player with no analysed games can still be in one right now, and
          the hypothesis rule is exactly what they should be carrying in. */}
      {profile&&<ErrorBoundary label="live_game" compact>
        <LiveGameCard
          gameName={profile.gameName} tagline={profile.tagline}
          region={profile.region} task={activeTasks[0]}
        />
      </ErrorBoundary>}
      <FirstRun task={activeTasks[0]} gameName={active.gameName}/>
    </AppShell>;
  }

  return <AppShell>
    <TrackView event="dashboard_view"/>
    <PageHead
      title="Development HQ"
      subtitle={`${active.gameName}${active.tagline} · ${active.rank} · ${active.role} · Everything below is what changes your next ranked game.`}
      action={<Link className="btn secondary" href="/account">SWITCH ACCOUNT</Link>}
    />

    <div className="v7-stack">
      {profile&&<ErrorBoundary label="live_game" compact><LiveGameCard gameName={profile.gameName} tagline={profile.tagline} region={profile.region} task={activeTasks[0]}/></ErrorBoundary>}

      <ErrorBoundary label="tilt" compact><TiltBanner read={tilt} results={sessionResults(session)}/></ErrorBoundary>

      <section className="hq-command">
        <div className="hq-top">
          <span className="v7-badge engine">NEXT GAME COMMAND</span>
          <span className="v7-badge">{mission.title}</span>
          <span className="v7-badge">{mission.status}</span>
        </div>
        <h2>{headline}</h2>
        <p>{mission.rules[0]}</p>

        <div className="hq-rules">
          <div><span className="label">Primary rule</span><b>{mission.rules[0]}</b></div>
          <div><span className="label">Priority call</span><b>{mission.rules[1]}</b></div>
          <div><span className="label">Hard limit</span><b>{mission.rules[2]}</b></div>
        </div>

        <div className="hq-progress">
          <AnimatedBar value={mission.successfulGames/mission.gamesRequired*100} delay={220}/>
          <span>{mission.successfulGames}/{mission.gamesRequired} PASSES · TARGET {mission.target} {mission.unit.toUpperCase()}</span>
        </div>

        {last&&leadSpec&&activeTasks[0]&&<BehaviourCheck
          matchId={last.id}
          taskId={activeTasks[0].id}
          behaviour={activeTasks[0].gameRule}
          clearedBar={lastCleared}
        />}

        <div className="hero-actions">
          <Link className="btn primary" href="/analyse">I&apos;M PLAYING NOW</Link>
          <Link className="btn secondary" href="/ilp">OPEN DEVELOPMENT CENTRE</Link>
          <Link className="btn secondary" href="/live">LIVE COMPANION</Link>
        </div>
      </section>

      <TrackView event={leakPrice.status==='READY'?'leak_priced':'leak_insufficient_sample'} props={{metric:leadMetric,gap:leakPrice.gapPoints,confidence:leakPrice.confidence,sample:leakPrice.sample}}/>
      <ErrorBoundary label="leak_price"><LeakPriceCard price={leakPrice} rankBand={active.rank} role={active.role}/></ErrorBoundary>

      <section className="hq-signals">
        <div {...revealProps(mounted,0,'glass hq-signal')}>
          <span>OP Score</span>
          <strong><CountUp value={score}/></strong>
          <small>Internal improvement score across your last 10. It does not predict Riot MMR.</small>
        </div>
        <div {...revealProps(mounted,1,'glass hq-signal')}>
          <span>Economy signal</span>
          <strong>{economy.value}</strong>
          <small>{economy.detail}</small>
        </div>
        <div {...revealProps(mounted,2,'glass hq-signal')}>
          <span>Last match verdict</span>
          <strong className={last?.result==='WIN'?'success':'danger'}>{last?last.result:'NO GAMES'}</strong>
          <small>{last
            ?`${last.champion} · ${last.kills}/${last.deaths}/${last.assists} · ${last.metrics.csPerMin.toFixed(1)} CS/min · ${last.metrics.deathsPost20??0} post-20 deaths`
            :'Upload or connect a match to generate a verdict.'}</small>
        </div>
        <div {...revealProps(mounted,3,'glass hq-signal')}>
          <span>Plan health</span>
          <strong>{onTrack}/{activeTasks.length} on track</strong>
          <small>{passes} of {required} passes banked · {masteredCount} behaviour{masteredCount===1?'':'s'} mastered.</small>
        </div>
      </section>

      <SyncPanel/>
    </div>

    <section className="v7-section">
      <ErrorBoundary label="economy_curve"><EconomyCurve matches={matches} role={active.role} target={lanePhaseRole?6.0:mission.target}/></ErrorBoundary>
    </section>

    <section className="v7-section">
      <div className="v7-section-head">
        <div>
          <div className="eyebrow">ACTIVE BEHAVIOURS</div>
          <h2>The five things match evidence is currently judging you against.</h2>
        </div>
        <Link className="v7-link" href="/ilp">OPEN DEVELOPMENT CENTRE →</Link>
      </div>
      <div className="hq-behaviours">
        {activeTasks.map((t,i)=>{
          const req=t.masteryRequired||3;
          const done=t.successfulGames||0;
          return <Link key={t.id} {...revealProps(mounted,i,'glass hq-behaviour')} href="/ilp">
            <div className="hq-bfoot">
              <span className="dc-index">0{i+1}</span>
              <span className={`v7-badge ${t.source==='COACH'?'coach':'engine'}`}>{t.source==='COACH'?'COACH':'ENGINE'}</span>
            </div>
            <span className="label">{t.category.replaceAll('_',' ')}</span>
            <h3>{t.title}</h3>
            <AnimatedBar value={t.progress} delay={i*60}/>
            <div className="hq-bfoot"><span>{t.progress}%</span><span>{done}/{req} PASSES</span></div>
          </Link>;
        })}
      </div>
    </section>

    <section className="v7-section">
      <div className="v7-section-head">
        <div>
          <div className="eyebrow">CHAMPION DEVELOPMENT</div>
          <h2>Role plans built around how your champions actually win at your rank.</h2>
        </div>
        <Link className="v7-link" href="/champions">CHAMPION LAB →</Link>
      </div>
      <div className="hq-champs">
        {active.champions.slice(0,3).map((c,i)=>{
          const plan=championPlans[c];
          return <Link key={c} {...revealProps(mounted,i,`glass hq-champ`)} href={`/champions/${encodeURIComponent(c)}`}>
            <span className="hq-rank">0{i+1}</span>
            <div>
              <div className="eyebrow">{active.role} · {active.rank.split(' · ')[0]}</div>
              <h3>{c}</h3>
              <p>{plan?.rankFocus[0]||'Lane plan, farm rules, teamfight job, side-lane decisions and power spikes for this champion at your rank.'}</p>
              <b>OPEN DEVELOPMENT PLAN →</b>
            </div>
          </Link>;
        })}
      </div>
    </section>
  </AppShell>;
}
