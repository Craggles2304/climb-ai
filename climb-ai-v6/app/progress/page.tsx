'use client';

import {useEffect,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {TrackView} from '@/components/TrackView';
import {useAccount} from '@/components/AccountContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {UpgradeButton} from '@/components/BillingActions';
import {DecisionTwinCommandCenter} from '@/components/DecisionTwinCommandCenter';
import {CareerDevelopmentMap} from '@/components/CareerDevelopmentMap';
import {LearningJourneyTimeline} from '@/components/LearningJourneyTimeline';
import {DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import type {DnaDomain} from '@/lib/types';
import '../climb-plan-tabs.css';

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
type Gate={id:'EVIDENCE'|'EXECUTION'|'LOCAL_MASTERY'|'TRANSFER'|'OWNERSHIP';current:number;target:number;unit:string;met:boolean};
type PlanTask={
  title:string;dnaDomain:DnaDomain;metric:string;target:string;progress:number;
  plainName?:string|null;plainMeaning?:string|null;plainNextGame?:string|null;plainSuccess?:string|null;plainWhy?:string|null;
  proven?:number|null;required?:number|null;
};
type ClimbPlan={
  ok:boolean;
  account:{gameName:string;tagline:string;role:string|null;rank:string;currentTier:string;nextTier:string};
  coverage:{gamesAnalyzed:number;totalHistoryRows:number;from:string|null;to:string|null;champions:string[];measuredMetrics:number;reconstructedMoments:number;goodMoments:number;criticalMoments:number};
  now:{skill:string;phase:string;rule:string;whyNow:string;evidence:string;completion:number|null;state:string;graduateWhen:string;nextSkill:string|null;ageGames?:number|null;gates?:Gate[];task:PlanTask|null}|null;
  route:Array<{step:string;title:string;detail:string;state:string}>;
  dna:DnaCard[];
  patterns:Pattern[];
  strengths:MetricSummary[];
  weakMetrics:MetricSummary[];
  recentGames:RecentGame[];
  curriculum:{status:string;decision:{action:string;reason:string};graduated:Array<{label:string;phase:string;evidence:string}>;queue:Array<{label:string;phase:string;readiness:string;whyNow:string;gameRule:string}>};
  boundary:string;
};

type TabId='plan'|'skill'|'progress'|'mistakes'|'games'|'deep';
const TABS:Array<{id:TabId;label:string;hint:string}>=[
  {id:'plan',label:'My plan',hint:'Goal + next game'},
  {id:'skill',label:'Current skill',hint:'How to pass it'},
  {id:'progress',label:'Progress',hint:'Your 6 DNA strands'},
  {id:'mistakes',label:'Mistakes',hint:'What keeps repeating'},
  {id:'games',label:'Game reviews',hint:'Good + bad moments'},
  {id:'deep',label:'Deep model',hint:'Advanced coach data'},
];

/** Each pass step in plain English: what to do, and how it is counted. */
const GATE_COPY:Record<Gate['id'],{title:string;detail:string;unit:(gate:Gate)=>string}>={
  EVIDENCE:{title:'Play games where it comes up',detail:'OP CLIMB needs to see this situation in real games before it can judge you on it.',unit:gate=>`${Math.min(gate.current,gate.target)} of ${gate.target} games`},
  EXECUTION:{title:'Get it right 3 games in a row',detail:'Follow the rule cleanly in back-to-back games. One slip resets the streak.',unit:gate=>`${Math.min(gate.current,gate.target)} of ${gate.target} in a row`},
  LOCAL_MASTERY:{title:'Make it a habit',detail:'Keep doing it until it is consistent, not just a one-off good game.',unit:gate=>`Habit score ${Math.round(gate.current)} / ${gate.target}`},
  TRANSFER:{title:'Do it on a different champion or matchup',detail:'Prove it still works when the situation changes.',unit:gate=>`${Math.min(gate.current,gate.target)} of ${gate.target} games`},
  OWNERSHIP:{title:'Own it everywhere',detail:'The skill holds up across champions and matchups. Then it is retired and the next one starts.',unit:gate=>`Score ${Math.round(gate.current)} / ${gate.target}`},
};

const strandStyle=(domain:DnaDomain)=>({'--strand-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties);
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'}):'—';
const titleCase=(value:string)=>String(value||'').toLowerCase().replace(/(^|\s|-)\S/g,char=>char.toUpperCase());
const pct=(gate:Gate)=>gate.target>0?Math.max(0,Math.min(100,Math.round(gate.current/gate.target*100))):0;

function readTab():TabId{
  if(typeof window==='undefined')return'plan';
  const hash=window.location.hash.replace('#','') as TabId;
  return TABS.some(tab=>tab.id===hash)?hash:'plan';
}

export default function ClimbPlanPage(){
  const {active}=useAccount();
  const {tier}=useSubscription();
  const [plan,setPlan]=useState<ClimbPlan|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [tab,setTab]=useState<TabId>('plan');

  useEffect(()=>{
    setTab(readTab());
    const onHash=()=>setTab(readTab());
    window.addEventListener('hashchange',onHash);
    return()=>window.removeEventListener('hashchange',onHash);
  },[]);

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

  function openTab(next:TabId){
    setTab(next);
    try{window.history.replaceState(null,'','#'+next)}catch{}
    try{document.getElementById('climb-plan-tabs')?.scrollIntoView({block:'nearest'})}catch{}
  }

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

  const now=plan.now;
  const gates=(now?.gates??[]).filter(gate=>gate.id in GATE_COPY);
  const gatesMet=gates.filter(gate=>gate.met).length;
  const task=now?.task??null;
  const skillPercent=now?.completion!=null?Math.round(now.completion):gates.length?Math.round(gatesMet/gates.length*100):task?.required?Math.round((task.proven??0)/task.required*100):0;
  const currentDomain=task?.dnaDomain??plan.dna.find(item=>item.score!==null)?.domain??'CONSISTENCY';
  const nextGate=gates.find(gate=>!gate.met)??null;
  const done=plan.curriculum.graduated.slice(-3);
  const upcoming=plan.curriculum.queue.slice(0,3);
  const ladder=[
    ...done.map(item=>({label:item.label,state:'done' as const})),
    ...(now?[{label:now.skill,state:'now' as const}]:[]),
    ...upcoming.map(item=>({label:item.label,state:'next' as const})),
  ];
  const skillNumber=done.length+(now?1:0);
  const repeated=plan.patterns.filter(item=>item.repeated);
  const lowest=plan.dna.filter(item=>item.score!==null).sort((a,b)=>Number(a.score)-Number(b.score))[0]??null;
  const goalTo=plan.account.nextTier==='RANKED'?'Ranked':titleCase(plan.account.nextTier);
  const goalFrom=titleCase(plan.account.rank);
  const checklist=[
    now?.rule?{label:'Your in-game rule',text:now.rule}:null,
    task?.plainNextGame?{label:'What to do',text:task.plainNextGame}:null,
    task?.target&&task.target!==task.plainSuccess?{label:'Your target',text:task.target}:null,
    nextGate?{label:'What this game counts towards',text:GATE_COPY[nextGate.id].title+' ('+GATE_COPY[nextGate.id].unit(nextGate)+')'}:null,
  ].filter(Boolean) as Array<{label:string;text:string}>;
  const counts:Partial<Record<TabId,number>>={mistakes:repeated.length,games:plan.recentGames.length};

  return <AppShell><TrackView event="career_viewed"/>
    <main className="climb-plan-page cp-page">
      <header className="cp-head panel" style={strandStyle(currentDomain)}>
        <div className="cp-head-copy">
          <div className="eyebrow">MY CLIMB PLAN · {plan.account.role||'ROLE'}</div>
          <h1>{goalFrom} <i>→</i> <span>{goalTo}</span></h1>
          <p>{now?`Skill ${skillNumber} of ${ladder.length}: ${now.skill}. Pass it in real games, then the next skill unlocks.`:'Play a few more tracked games and OP CLIMB will set your first skill.'}</p>
        </div>
        <div className="cp-head-progress">
          <div className="cp-ring" style={{'--pct':skillPercent} as CSSProperties}><strong>{skillPercent}%</strong><span>CURRENT SKILL</span></div>
          <Link className="btn primary" href="/live">PLAY NEXT GAME →</Link>
        </div>
      </header>

      <nav id="climb-plan-tabs" className="cp-tabs" role="tablist" aria-label="Climb Plan sections">
        {TABS.map(item=><button key={item.id} type="button" role="tab" aria-selected={tab===item.id} className={tab===item.id?'active':''} onClick={()=>openTab(item.id)}>
          <b>{item.label}{counts[item.id]?<em>{counts[item.id]}</em>:null}</b><small>{item.hint}</small>
        </button>)}
      </nav>

      {tab==='plan'&&<div className="cp-panel" role="tabpanel">
        <section className="cp-section panel">
          <div className="cp-section-head"><h2>Your route</h2><p>One skill at a time. Each one unlocks when you have proven it in games.</p></div>
          {ladder.length?<ol className="cp-ladder">
            {ladder.map((step,index)=><li key={step.label+index} className={step.state}>
              <i>{step.state==='done'?'✓':index+1}</i>
              <div><span>{step.state==='done'?'PASSED':step.state==='now'?'IN PROGRESS · '+skillPercent+'%':'LOCKED · UNLOCKS NEXT'}</span><b>{step.label}</b></div>
            </li>)}
          </ol>:<p className="cp-empty">Your route appears after your first few tracked games.</p>}
        </section>

        {now?<div className="cp-two">
          <section className="cp-section panel cp-now" style={strandStyle(currentDomain)}>
            <div className="cp-section-head"><h2>Right now: {now.skill}</h2></div>
            <div className="cp-pass">
              <span>TO PASS THIS SKILL</span>
              <strong>{task?.plainSuccess||now.graduateWhen}</strong>
            </div>
            <div className="cp-bar" aria-label={'Skill progress '+skillPercent+'%'}><i style={{width:skillPercent+'%'}}/></div>
            <p className="cp-bar-note">{gates.length?`${gatesMet} of ${gates.length} steps passed.`:task?.required?`${task.proven??0} of ${task.required} proven games.`:'Progress builds with each tracked game.'}{nextGate?` Next step: ${GATE_COPY[nextGate.id].title.toLowerCase()} (${GATE_COPY[nextGate.id].unit(nextGate)}).`:''}</p>
            <button type="button" className="cp-link" onClick={()=>openTab('skill')}>See every step →</button>
          </section>

          <section className="cp-section panel">
            <div className="cp-section-head"><h2>Before your next game</h2><p>Read this in the lobby. That is all you need to focus on.</p></div>
            <ol className="cp-checklist">
              {checklist.map((item,index)=><li key={item.label}><i>{index+1}</i><div><span>{item.label}</span><b>{item.text}</b></div></li>)}
            </ol>
            <Link className="btn primary cp-cta" href="/live">OPEN MATCH ROOM →</Link>
          </section>
        </div>:<section className="cp-section panel"><div className="cp-section-head"><h2>Your first skill is still being chosen</h2><p>Keep playing tracked games. OP CLIMB will not invent a weakness from a single match.</p></div></section>}
      </div>}

      {tab==='skill'&&<div className="cp-panel" role="tabpanel">
        {now?<>
          <section className="cp-section panel cp-now" style={strandStyle(currentDomain)}>
            <div className="cp-section-head"><h2>{now.skill}</h2><p>{task?.plainMeaning||now.whyNow}</p></div>
            <div className="cp-rule"><span>THE RULE</span><strong>{now.rule}</strong></div>
            {task?.plainWhy&&<p className="cp-why"><b>Why it matters:</b> {task.plainWhy}</p>}
          </section>

          <section className="cp-section panel">
            <div className="cp-section-head"><h2>How you pass it</h2><p>{gates.length?`${gatesMet} of ${gates.length} steps done. Steps are checked automatically from your tracked games.`:'Steps are checked automatically from your tracked games.'}</p></div>
            {gates.length?<ol className="cp-steps">
              {gates.map((gate,index)=>{
                const copy=GATE_COPY[gate.id];
                const state=gate.met?'done':gate===nextGate?'now':'next';
                return <li key={gate.id} className={state}>
                  <i>{gate.met?'✓':index+1}</i>
                  <div>
                    <div className="cp-step-top"><b>{copy.title}</b><span>{gate.met?'PASSED':copy.unit(gate)}</span></div>
                    <p>{copy.detail}</p>
                    <div className="cp-bar small"><i style={{width:(gate.met?100:pct(gate))+'%'}}/></div>
                  </div>
                </li>;
              })}
            </ol>:<div className="cp-pass"><span>PASS MARK</span><strong>{task?.plainSuccess||now.graduateWhen}</strong>{task?.required?<small>{task.proven??0} of {task.required} proven games so far</small>:null}</div>}
          </section>

          <section className="cp-section panel">
            <div className="cp-section-head"><h2>After this</h2><p>{now.nextSkill?`When you pass ${now.skill}, you move on to ${now.nextSkill}.`:'When you pass this skill, OP CLIMB picks the next one from your games.'}</p></div>
            {upcoming.length>0&&<div className="cp-next-grid">
              {upcoming.map((item,index)=><article key={item.label}><span>{index===0?'UP NEXT':'LATER'} · LOCKED</span><b>{item.label}</b><p>{item.gameRule}</p></article>)}
            </div>}
          </section>
        </>:<section className="cp-section panel"><div className="cp-section-head"><h2>No skill yet</h2><p>Play tracked games so OP CLIMB can choose your first skill.</p></div></section>}
      </div>}

      {tab==='progress'&&<div className="cp-panel" role="tabpanel">
        <section className="cp-section panel">
          <div className="cp-section-head"><h2>Your 6 DNA strands</h2><p>{lowest?`Weakest right now: ${lowest.label}. `:''}Scores use your last 5 games; the arrow compares them with the 5 before.</p></div>
          <div className="climb-dna-grid">
            {plan.dna.map(item=><article key={item.domain} style={strandStyle(item.domain)} className={(item.domain===currentDomain?'current ':'')+item.trend.toLowerCase()}>
              <div className="climb-dna-top"><span>{item.label.toUpperCase()}</span><b>{item.score===null?'—':item.score}</b></div>
              <div className="climb-dna-bar"><i style={{width:(item.score??0)+'%'}}/></div>
              <div className="climb-dna-meta">
                <span>{item.trend}</span>
                <span>{item.delta===null?'NEEDS MORE GAMES':(item.delta>0?'▲ +':'▼ ')+item.delta}</span>
              </div>
              <div className="climb-dna-proof"><span><b>{item.good}</b> good</span><span><b>{item.critical}</b> critical</span><span><b>{item.games}</b> games</span></div>
            </article>)}
          </div>
        </section>
        <section className="cp-section panel">
          <div className="cp-section-head"><h2>Keep doing this</h2><p>Strengths that show up across several games.</p></div>
          {plan.strengths.length?<div className="cp-list">
            {plan.strengths.slice(0,6).map(item=><article key={item.key} style={strandStyle(item.dnaDomain)}>
              <div><span>{DNA_DOMAIN_LABELS[item.dnaDomain]}</span><b>{item.score??'—'}/100</b></div>
              <h3>{item.label}</h3>
              <p>{item.evidence||'Strong across '+item.games+' games.'}</p>
            </article>)}
          </div>:<p className="cp-empty">More games are needed before anything counts as a stable strength.</p>}
        </section>
      </div>}

      {tab==='mistakes'&&<div className="cp-panel" role="tabpanel">
        <section className="cp-section panel">
          <div className="cp-section-head"><h2>What keeps repeating</h2><p>One bad game is noise. These showed up in at least two separate games.</p></div>
          {repeated.length?<div className="cp-list">
            {repeated.map((item,index)=><article key={item.key} style={strandStyle(item.dnaDomain)}>
              <div><span>{String(index+1).padStart(2,'0')} · {DNA_DOMAIN_LABELS[item.dnaDomain]}</span><b>{item.games} games</b></div>
              <h3>{item.label}</h3>
              <p>{item.detail}</p>
              <small>{item.recentGames} of your last 5 games · last seen {date(item.lastSeen)}</small>
            </article>)}
          </div>:<p className="cp-empty">No mistake is repeating across your games right now.</p>}
        </section>
      </div>}

      {tab==='games'&&<div className="cp-panel" role="tabpanel">
        <section className="cp-section panel">
          <div className="cp-section-head"><h2>Recent game reviews</h2><p>{date(plan.coverage.from)} → {date(plan.coverage.to)} · {plan.coverage.gamesAnalyzed} games analysed</p></div>
          {plan.recentGames.length?<div className="cp-games">
            {plan.recentGames.map(game=><details key={game.matchId||game.createdAt} className="cp-game">
              <summary>
                <span>{date(game.createdAt)}</span>
                <b>{game.champion}</b>
                <em className={String(game.result||'').toLowerCase()}>{game.result||'—'}</em>
                <small>{game.kda?`${game.kda.kills}/${game.kda.deaths}/${game.kda.assists}`:''}</small>
                <small className="cp-game-counts"><i className="good">{game.good.length} good</i> <i className="bad">{game.critical.length} critical</i></small>
              </summary>
              <div className="cp-game-body">
                <div className="good"><span>REPEAT THIS</span>{game.good.length?game.good.map(moment=><p key={moment.clock+moment.title}><b>{moment.clock}</b> <strong>{moment.title}.</strong> {moment.coaching}</p>):<p className="cp-empty">Nothing stood out.</p>}</div>
                <div className="bad"><span>THIS COST YOU</span>{game.critical.length?game.critical.map(moment=><p key={moment.clock+moment.title}><b>{moment.clock}</b> <strong>{moment.title}.</strong> {moment.coaching}</p>):<p className="cp-empty">Nothing stood out.</p>}</div>
              </div>
            </details>)}
          </div>:<p className="cp-empty">Your reviewed games will appear here.</p>}
        </section>
      </div>}

      {tab==='deep'&&<div className="cp-panel" role="tabpanel">
        <section className="cp-section panel">
          <div className="cp-section-head"><h2>Deep coach model</h2><p>The detailed data behind your plan. You do not need this to follow the plan.</p></div>
          <div className="climb-plan-deep-body">
            <DecisionTwinCommandCenter accountId={active.id}/>
            <CareerDevelopmentMap accountId={active.id}/>
            <LearningJourneyTimeline accountId={active.id}/>
          </div>
        </section>
        <p className="climb-plan-boundary">{plan.boundary}</p>
      </div>}
    </main>
  </AppShell>;
}
