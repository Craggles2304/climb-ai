'use client';

import {useEffect,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
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

  return <AppShell>
    <main className="climb-plan-page">
      <header className="climb-plan-hero" style={strandStyle(currentDomain)}>
        <div className="climb-plan-hero-copy">
          <div className="eyebrow">PRO · MY CLIMB PLAN · {plan.account.role||'ROLE'} HISTORY</div>
          <h1>Your history already knows<br/><span>what should move you up.</span></h1>
          <p>This is not a match report. OP CLIMB is comparing your games against each other, following repeated decisions, protecting what is already working and keeping one development path active until the evidence says you are ready to move on.</p>
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

      <section className="climb-plan-answer panel" style={strandStyle(currentDomain)}>
        <div className="climb-plan-answer-head">
          <div><span>THE ANSWER AFTER EVERY GAME</span><h2>WHAT SHOULD I DO NOW?</h2></div>
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

      <section className="climb-plan-route panel">
        <div className="climb-plan-section-head"><div><span>YOUR CLIMB ROUTE</span><h2>One path. No dashboard hunting.</h2></div><small>{plan.curriculum.decision.reason}</small></div>
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

      <section className="climb-plan-dna panel">
        <div className="climb-plan-section-head">
          <div><span>YOUR WHOLE GAME DNA</span><h2>Six parts of the same climb.</h2></div>
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
        <section className="climb-plan-patterns panel">
          <div className="climb-plan-section-head"><div><span>CRITICAL PATTERNS</span><h2>What keeps coming back?</h2></div><small>Repeated across separate games, not one-off mistakes.</small></div>
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
          <div className="climb-plan-section-head"><div><span>KEEP THESE</span><h2>What is already helping you climb?</h2></div><small>Measured strengths across repeated games.</small></div>
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

      <section className="climb-plan-history panel">
        <div className="climb-plan-section-head">
          <div><span>YOUR HISTORY, CONNECTED</span><h2>Every game should explain the pattern — not reset the conversation.</h2></div>
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

      <section className="climb-plan-next panel">
        <div className="climb-plan-section-head"><div><span>WHAT COMES AFTER THE CURRENT FIX?</span><h2>Your plan already has a queue — but it is allowed to change when the evidence changes.</h2></div><small>Evidence gated, not a generic syllabus.</small></div>
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
