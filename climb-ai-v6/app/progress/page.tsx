'use client';

import {useEffect,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {ArenaHeroArtwork} from '@/components/ArenaHeroArtwork';
import {TrackView} from '@/components/TrackView';
import {useAccount} from '@/components/AccountContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {UpgradeButton} from '@/components/BillingActions';
import {DecisionTwinCommandCenter} from '@/components/DecisionTwinCommandCenter';
import {CareerDevelopmentMap} from '@/components/CareerDevelopmentMap';
import {LearningJourneyTimeline} from '@/components/LearningJourneyTimeline';
import {DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import type {DnaDomain} from '@/lib/types';

type DnaCard={domain:DnaDomain;label:string;score:number|null;lifetime:number|null;delta:number|null;trend:string;games:number;good:number;critical:number};
type Pattern={key:string;label:string;dnaDomain:DnaDomain;count:number;games:number;recentGames:number;severity:string;lastSeen:string;detail:string;repeated:boolean};
type MetricSummary={key:string;label:string;dnaDomain:DnaDomain;games:number;score:number|null;lifetime:number|null;evidence:string|null};
type GameMoment={clock:string;title:string;dnaDomain:DnaDomain;coaching:string;severity:number};
type RecentGame={
  matchId:string|null;createdAt:string;champion:string;role:string|null;result:string|null;
  kda:{kills:number;deaths:number;assists:number}|null;durationSeconds:number|null;
  fingerprint:{primary:string;sequence:string[];confidence:string;explanation:string};
  good:GameMoment[];critical:GameMoment[];
  strongestMetric:{label:string;score:number|null}|null;
  weakestMetric:{label:string;score:number|null}|null;
};
type ClimbPlan={
  ok:boolean;
  account:{gameName:string;tagline:string;role:string|null;rank:string;currentTier:string;nextTier:string};
  coverage:{gamesAnalyzed:number;totalHistoryRows:number;from:string|null;to:string|null;champions:string[];measuredMetrics:number;reconstructedMoments:number;goodMoments:number;criticalMoments:number};
  now:{skill:string;phase:string;rule:string;whyNow:string;evidence:string;completion:number|null;state:string;graduateWhen:string;nextSkill:string|null;task:{title:string;dnaDomain:DnaDomain;metric:string;target:string;progress:number}|null}|null;
  route:Array<{step:string;title:string;detail:string;state:string}>;
  dna:DnaCard[];
  patterns:Pattern[];
  strengths:MetricSummary[];
  weakMetrics:MetricSummary[];
  recentGames:RecentGame[];
  curriculum:{status:string;decision:{action:string;reason:string};graduated:Array<{label:string;phase:string;evidence:string}>;queue:Array<{label:string;phase:string;readiness:string;whyNow:string;gameRule:string}>};
  boundary:string;
};

const strandStyle=(domain:DnaDomain)=>({'--strand-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties);
const pretty=(value:string)=>String(value||'').replaceAll('_',' ');
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'}):'—';

export default function ClimbPlanPage(){
  const {active}=useAccount();
  const {tier}=useSubscription();
  const [plan,setPlan]=useState<ClimbPlan|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    if(tier!=='PRO'){setPlan(null);setError('');return}
    let cancelled=false;
    setLoading(true);setError('');
    fetch('/api/climb-plan?accountId='+encodeURIComponent(active.id),{cache:'no-store'})
      .then(async response=>{
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body?.error||'Could not build your Climb Plan.');
        return body as ClimbPlan;
      })
      .then(body=>{if(!cancelled)setPlan(body)})
      .catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'Could not build your Climb Plan.')})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[active.id,tier]);

  if(tier!=='PRO')return <AppShell>
    <main className="climb-plan-page">
      <section className="climb-plan-paywall panel">
        <div className="eyebrow">PRO · £19.99 · YOUR COMPLETE DEVELOPMENT PLAN</div>
        <h1>Do not just review games.<br/><span>Know exactly how to climb.</span></h1>
        <p>PLUS gives you Your Next Climb. PRO turns your whole history into one living progress plan: every Game DNA strand, every measured decision metric, every GOOD and CRITICAL reconstructed moment, repeated patterns, mastery, transfer and what should replace the current skill.</p>
        <div className="climb-plan-preview-grid">
          <article><span>01</span><b>YOUR CLIMB ROUTE</b><small>Now → prove → master → next</small></article>
          <article><span>02</span><b>ALL 6 DNA STRANDS</b><small>Recent form, lifetime level and trend</small></article>
          <article><span>03</span><b>PATTERN TRACKER</b><small>What keeps costing games across history</small></article>
          <article><span>04</span><b>GOOD + CRITICAL PROOF</b><small>What to repeat and what to remove</small></article>
          <article><span>05</span><b>DECISION TWIN</b><small>How your choices behave across situations</small></article>
          <article><span>06</span><b>LEARNING MEMORY</b><small>When a skill is actually learned, not just lucky</small></article>
        </div>
        <UpgradeButton tier="PRO" label="UNLOCK MY COMPLETE CLIMB PLAN"/>
      </section>
    </main>
  </AppShell>;

  if(loading&&!plan)return <AppShell><section className="panel climb-plan-loading"><div className="eyebrow">BUILDING YOUR CLIMB PLAN</div><h1>Reading your whole game history…</h1><p className="muted">Combining DNA, decision evidence, GOOD/CRITICAL sequences, recurring patterns and learning state.</p></section></AppShell>;
  if(error&&!plan)return <AppShell><section className="panel climb-plan-loading"><div className="eyebrow">CLIMB PLAN ERROR</div><h1>Your history is still safe.</h1><p className="muted">{error}</p><button className="btn primary" onClick={()=>window.location.reload()}>RETRY</button></section></AppShell>;
  if(!plan)return <AppShell><div/></AppShell>;

  const lowest=plan.dna.filter(item=>item.score!==null).sort((a,b)=>Number(a.score)-Number(b.score))[0]??null;
  const highest=plan.dna.filter(item=>item.score!==null).sort((a,b)=>Number(b.score)-Number(a.score))[0]??null;
  const repeated=plan.patterns.filter(item=>item.repeated);
  const currentDomain=plan.now?.task?.dnaDomain??lowest?.domain??'CONSISTENCY';

  return <AppShell><TrackView event="career_viewed"/>
    <main className="climb-plan-page">
      <header id="where-you-are" className="climb-plan-hero climb-plan-anchor arena-visual-arthead arena-visual-progress" style={strandStyle(currentDomain)}><ArenaHeroArtwork champion={active.champions?.[0]||"Jinx"} tag="YOUR MAIN" />
        <div className="climb-plan-hero-copy">
          <div className="eyebrow">PRO · MY CLIMB PLAN · {plan.account.role||'ROLE'} HISTORY</div>
          <h1>Your history becomes<br/><span>your route to the next rank.</span></h1>
          <p><b>The aim is simple:</b> stop guessing what to practise. OP CLIMB studies your game history, finds the behaviour with the biggest development value, gives you one rule to use in-game, checks the evidence, and only moves you on when the improvement is real.</p>
          <div className="climb-plan-rank-path">
            <div><span>YOU ARE HERE</span><strong>{plan.account.rank}</strong></div>
            <i>→</i>
            <div><span>NEXT TIER TARGET</span><strong>{plan.account.nextTier}</strong></div>
          </div>
        </div>
        <div className="climb-plan-proof">
          <div><strong>{plan.coverage.gamesAnalyzed}</strong><span>games analysed</span></div>
          <div><strong>{plan.coverage.measuredMetrics}</strong><span>decision metrics</span></div>
          <div><strong>{plan.coverage.reconstructedMoments}</strong><span>reconstructed moments</span></div>
          <div><strong>{repeated.length}</strong><span>repeated patterns</span></div>
        </div>
      </header>

      <nav className="climb-plan-path-nav" aria-label="Your climb path">
        <a href="#where-you-are"><span>01</span><b>WHERE YOU ARE</b><small>Rank + history</small></a>
        <a href="#fix-now"><span>02</span><b>FIX NOW</b><small>One priority</small></a>
        <a href="#prove-it"><span>03</span><b>PROVE IT</b><small>Evidence in games</small></a>
        <a href="#dna-progress"><span>04</span><b>TRACK PROGRESS</b><small>All 6 DNA strands</small></a>
        <a href="#patterns"><span>05</span><b>REMOVE PATTERNS</b><small>Recurring mistakes</small></a>
        <a href="#history"><span>06</span><b>LEARN FROM GAMES</b><small>GOOD + CRITICAL</small></a>
        <a href="#next-skill"><span>07</span><b>MOVE ON</b><small>Next skill</small></a>
      </nav>

      <section id="fix-now" className="climb-plan-answer panel climb-plan-anchor" style={strandStyle(currentDomain)}>
        <div className="climb-plan-answer-head">
          <div><span>STEP 02 · FIX NOW</span><h2>ONE THING TO IMPROVE NEXT</h2><p className="climb-plan-subheading">This is your current coaching focus. Ignore the noise and take this one behaviour into your next games.</p></div>
          <Link className="btn primary" href="/live">PLAY THE NEXT PROOF GAME →</Link>
        </div>
        {plan.now?<div className="climb-plan-now-grid">
          <article className="primary">
            <span>YOUR #1 CLIMB PRIORITY</span>
            <h3>{plan.now.skill}</h3>
            <p>{plan.now.whyNow}</p>
          </article>
          <article>
            <span>ONE RULE TO CARRY</span>
            <h3>Remember this</h3>
            <p>{plan.now.rule}</p>
          </article>
          <article>
            <span>WHY IT IS STILL ACTIVE</span>
            <h3>{plan.now.completion===null?'Evidence building':plan.now.completion+'% through the learning contract'}</h3>
            <p>{plan.now.evidence}</p>
          </article>
          <article>
            <span>WHEN OP CLIMB MOVES ON</span>
            <h3>{plan.now.nextSkill?'Next: '+plan.now.nextSkill:'Next skill chosen from new evidence'}</h3>
            <p>{plan.now.graduateWhen}</p>
          </article>
        </div>:<div className="climb-plan-empty"><h3>Your first long-term priority is still building.</h3><p>Keep playing tracked games. OP CLIMB will not invent a repeated pattern from a single match.</p></div>}
      </section>

      <section id="prove-it" className="climb-plan-route panel climb-plan-anchor">
        <div className="climb-plan-section-head"><div><span>STEP 03 · PROVE IT</span><h2>LEARN IT → USE IT → PROVE IT → MASTER IT</h2><p className="climb-plan-subheading">The app does not reward reading advice. It follows whether you can repeat the behaviour in real games, then tests whether it survives a new situation.</p></div><small>{plan.curriculum.decision.reason}</small></div>
        <div className="climb-route-grid">
          {plan.route.map((item,index)=><article key={item.step} className={index===0?'active':''}>
            <i>{String(index+1).padStart(2,'0')}</i>
            <span>{item.step}</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <small>{pretty(item.state)}</small>
          </article>)}
        </div>
      </section>

      <section id="dna-progress" className="climb-plan-dna panel climb-plan-anchor">
        <div className="climb-plan-section-head">
          <div><span>STEP 04 · TRACK PROGRESS</span><h2>YOUR WHOLE GAME DNA</h2><p className="climb-plan-subheading">Your current mission is only one part of the player. These six strands show what is improving, stable or slipping while you climb.</p></div>
          <small>{lowest?'Biggest current development need: '+lowest.label:'Building DNA evidence'}{highest?' · strongest current strand: '+highest.label:''}</small>
        </div>
        <div className="climb-dna-grid">
          {plan.dna.map(item=><article key={item.domain} style={strandStyle(item.domain)} className={(item.domain===currentDomain?'current ':'')+item.trend.toLowerCase()}>
            <div className="climb-dna-top"><span>{item.label.toUpperCase()}</span><b>{item.score===null?'—':item.score}</b></div>
            <div className="climb-dna-bar"><i style={{width:(item.score??0)+'%'}}/></div>
            <div className="climb-dna-meta">
              <span>{item.trend}</span>
              <span>{item.delta===null?'BUILDING':(item.delta>0?'+':'')+item.delta+' vs previous block'}</span>
            </div>
            <div className="climb-dna-proof"><span><b>{item.good}</b> GOOD</span><span><b>{item.critical}</b> CRITICAL</span><span><b>{item.games}</b> scored games</span></div>
          </article>)}
        </div>
      </section>

      <div className="climb-plan-two-col">
        <section id="patterns" className="climb-plan-patterns panel climb-plan-anchor">
          <div className="climb-plan-section-head"><div><span>STEP 05 · REMOVE REPEATING MISTAKES</span><h2>WHAT KEEPS HOLDING YOU BACK?</h2><p className="climb-plan-subheading">One bad game is noise. A mistake that keeps appearing across games becomes a coaching priority.</p></div><small>Repeated across separate games, not one-off mistakes.</small></div>
          {plan.patterns.length?<div className="climb-pattern-list">
            {plan.patterns.map((item,index)=><article key={item.key} style={strandStyle(item.dnaDomain)}>
              <div className="climb-pattern-rank">{String(index+1).padStart(2,'0')}</div>
              <div>
                <div className="climb-pattern-top"><span>{DNA_DOMAIN_LABELS[item.dnaDomain]} · {item.severity}</span><b>{item.games} games</b></div>
                <h3>{item.label}</h3>
                <p>{item.detail}</p>
                <small>{item.count} recorded occurrences · {item.recentGames}/5 recent games · last seen {date(item.lastSeen)}</small>
              </div>
            </article>)}
          </div>:<div className="climb-plan-empty"><h3>No repeated critical pattern dominates yet.</h3><p>That is useful information too. OP CLIMB will keep watching rather than manufacture a weakness.</p></div>}
        </section>

        <section className="climb-plan-strengths panel">
          <div className="climb-plan-section-head"><div><span>PROTECT YOUR STRENGTHS</span><h2>WHAT SHOULD YOU KEEP DOING?</h2><p className="climb-plan-subheading">Climbing is not only removing mistakes. These are behaviours the evidence says are already helping you.</p></div><small>Measured strengths across repeated games.</small></div>
          <div className="climb-strength-list">
            {plan.strengths.slice(0,6).map(item=><article key={item.key} style={strandStyle(item.dnaDomain)}>
              <div><span>{DNA_DOMAIN_LABELS[item.dnaDomain]}</span><b>{item.score??'—'}/100</b></div>
              <h3>{item.label}</h3>
              <p>{item.evidence||'Repeatedly strong across '+item.games+' analysed games.'}</p>
              <small>{item.games} games of evidence</small>
            </article>)}
            {!plan.strengths.length&&<div className="climb-plan-empty"><p>More repeated evidence is needed before OP CLIMB labels anything a stable strength.</p></div>}
          </div>
        </section>
      </div>

      <section id="history" className="climb-plan-history panel climb-plan-anchor">
        <div className="climb-plan-section-head">
          <div><span>STEP 06 · LEARN FROM EVERY GAME</span><h2>GOOD TO REPEAT. CRITICAL TO REMOVE.</h2><p className="climb-plan-subheading">Each match feeds the same development plan. GOOD moments show what to repeat; CRITICAL moments show where the same climb is breaking down.</p></div>
          <small>{date(plan.coverage.from)} → {date(plan.coverage.to)} · {plan.coverage.champions.slice(0,6).join(' · ')}</small>
        </div>
        <div className="climb-history-list">
          {plan.recentGames.map((game,index)=><article key={game.matchId||game.createdAt} className="climb-history-game">
            <header>
              <div className="climb-history-index">{String(index+1).padStart(2,'0')}</div>
              <div><span>{date(game.createdAt)} · {game.role||'ROLE'}</span><h3>{game.champion} {game.result?'· '+game.result:''}</h3></div>
              {game.kda&&<strong>{game.kda.kills}/{game.kda.deaths}/{game.kda.assists}</strong>}
            </header>
            <div className="climb-history-fingerprint">
              <span>DECISION FINGERPRINT</span>
              <b>{game.fingerprint?.primary||'BUILDING'}</b>
              <p>{game.fingerprint?.explanation}</p>
            </div>
            <div className="climb-history-sides">
              <div className="good">
                <span>GOOD · REPEAT THIS</span>
                {game.good.length?game.good.map(moment=><div key={moment.clock+moment.title}><b>{moment.clock}</b><p><strong>{moment.title}</strong>{moment.coaching}</p></div>):<small>No reconstructed GOOD sequence strong enough to show.</small>}
              </div>
              <div className="critical">
                <span>CRITICAL · THIS IS COSTING YOU</span>
                {game.critical.length?game.critical.map(moment=><div key={moment.clock+moment.title}><b>{moment.clock}</b><p><strong>{moment.title}</strong>{moment.coaching}</p></div>):<small>No reconstructed CRITICAL sequence strong enough to show.</small>}
              </div>
            </div>
            <footer>
              <span>BEST: {game.strongestMetric?game.strongestMetric.label+' '+game.strongestMetric.score+'/100':'building'}</span>
              <span>WORST: {game.weakestMetric?game.weakestMetric.label+' '+game.weakestMetric.score+'/100':'building'}</span>
            </footer>
          </article>)}
        </div>
      </section>

      <section id="next-skill" className="climb-plan-next panel climb-plan-anchor">
        <div className="climb-plan-section-head"><div><span>STEP 07 · MOVE ON WHEN YOU ARE READY</span><h2>MASTER THIS. THEN THE APP CHOOSES THE NEXT BEST SKILL.</h2><p className="climb-plan-subheading">You do not collect endless missions. When the current behaviour is proven and transferred, OP CLIMB retires it and promotes the next highest-value skill from your evidence.</p></div><small>Evidence gated, not a generic syllabus.</small></div>
        <div className="climb-next-grid">
          {plan.curriculum.queue.slice(0,4).map((item,index)=><article key={item.label}><span>{String(index+1).padStart(2,'0')} · {item.phase}</span><h3>{item.label}</h3><p>{item.whyNow}</p><small>{item.readiness} · {item.gameRule}</small></article>)}
          {!plan.curriculum.queue.length&&<div className="climb-plan-empty"><p>No replacement skill is being forced yet. OP CLIMB is waiting for the current learning contract to resolve.</p></div>}
        </div>
      </section>

      <details className="climb-plan-deep">
        <summary><b>OPEN THE DEEP COACH MODEL</b><span>Decision Twin · transfer · career memory · learning journey</span></summary>
        <div className="climb-plan-deep-body">
          <DecisionTwinCommandCenter accountId={active.id}/>
          <CareerDevelopmentMap accountId={active.id}/>
          <LearningJourneyTimeline accountId={active.id}/>
        </div>
      </details>

      <p className="climb-plan-boundary">{plan.boundary}</p>
    </main>
  </AppShell>;
}
