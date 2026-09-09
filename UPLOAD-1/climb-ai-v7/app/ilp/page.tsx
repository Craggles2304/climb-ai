'use client';
import {useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {AnimatedBar,AnimatedRing,useMounted,revealProps} from '@/components/Motion';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {ILPTask} from '@/lib/types';
import {LeakPriceInline} from '@/components/LeakPrice';
import {priceLeak} from '@/lib/costOfLeak';
import {TrackView} from '@/components/TrackView';

const statusTone=(s:ILPTask['status'])=>s==='MASTERED'?'mastered':s==='EVIDENCE_BUILDING'?'evidence':'';
const clean=(s:string)=>s.replaceAll('_',' ');

function Pips({passes,required}:{passes:number;required:number}){
  return <div className="v7-pips" role="img" aria-label={`${passes} of ${required} passes banked`}>
    {Array.from({length:required},(_,i)=><i key={i} className={i<passes?'on':undefined}/>)}
  </div>;
}

export default function PlayerDevelopmentCentre(){
  const mounted=useMounted();
  const {active}=useAccount();
  const {tasks,ordering,orderNote,refreshFromMatches,pauseTask}=useLearningPlan();
  const [changes,setChanges]=useState<string[]>([]);

  const activeTasks=tasks.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED').slice(0,5);
  const mastered=tasks.filter(t=>t.status==='MASTERED');
  const paused=tasks.filter(t=>t.status==='PAUSED');

  const passes=activeTasks.reduce((n,t)=>n+(t.successfulGames||0),0);
  const required=activeTasks.reduce((n,t)=>n+(t.masteryRequired||3),0)||1;
  const avgProgress=activeTasks.length?activeTasks.reduce((n,t)=>n+t.progress,0)/activeTasks.length:0;
  const momentum=Math.round(Math.min(100,avgProgress*0.7+(passes/required)*100*0.3));
  const coachCount=tasks.filter(t=>t.source==='COACH'&&t.status!=='PAUSED').length;
  const directive=activeTasks[0];

  const accountMatches=matchesFor(active.id);
  const recentChampions=Array.from(new Set(accountMatches.slice(0,5).map(m=>m.champion)));
  const championContext=(t:ILPTask)=>{
    if(!recentChampions.length)return 'No match evidence on this account yet.';
    if(t.metric==='clipReview')return `Needs one reviewed clip · ${recentChampions.slice(0,2).join(' or ')}`;
    return `Measured across ${recentChampions.slice(0,3).join(' · ')}`;
  };

  // `ordering` covers every task including mastered and paused ones, so it is
  // looked up by id rather than by index into the filtered active list.
  const orderById=new Map(ordering.map(o=>[o.task.id,o]));

  const refresh=()=>setChanges(refreshFromMatches());

  return <AppShell>
    <TrackView event="ilp_view"/>
    <PageHead
      title="Player Development Centre"
      subtitle={`${active.gameName}${active.tagline} · ${active.rank} · ${active.role} · The five behaviours your next games are being judged against.`}
      action={<button className="btn secondary" onClick={refresh}>REFRESH FROM MATCHES</button>}
    />

    <div className="v7-stack">
      <section className="dc-hero">
        <div>
          <div className="v7-badge engine">ADAPTIVE DEVELOPMENT PLAN</div>
          <h2>Five behaviours. Moved by evidence, not opinion.</h2>
          <p>Every relevant match is scored against the metric behind each behaviour. A passing game banks a pass, a failing game gives one back. Reach the required passes and the behaviour retires so a higher-priority one can take the slot. The Coach can add or replace a behaviour, but the plan never grows past five.</p>
          <div className="dc-counters">
            <div><strong>{activeTasks.length}</strong><span>Active behaviours</span></div>
            <div><strong>{passes}/{required}</strong><span>Passes banked</span></div>
            <div><strong>{mastered.length}</strong><span>Mastered</span></div>
            <div><strong>{coachCount}</strong><span>Coach-added</span></div>
          </div>
        </div>
        <AnimatedRing value={momentum} label="PLAN MOMENTUM"/>
      </section>

      {changes.length>0&&<section className="glass card" style={{borderColor:'rgba(66,230,149,.3)'}}>
        <div className="v7-badge mastered">PLAN ADAPTED</div>
        <ul className="muted" style={{margin:'12px 0 0',paddingLeft:18,lineHeight:1.6,fontSize:13}}>
          {changes.map(c=><li key={c}>{c}</li>)}
        </ul>
      </section>}

      {directive&&<section className="dc-directive">
        <div className="v7-badge engine">HIGHEST PRIORITY · NEXT GAME</div>
        <h2>{directive.title}</h2>
        <p>{directive.why}</p>
        <div className="dc-dgrid">
          <div>
            <span className="label">DO THIS IN GAME</span>
            <b>{directive.gameRule}</b>
          </div>
          <div>
            <span className="label">THIS COUNTS AS A PASS</span>
            <b>{directive.target}</b>
          </div>
        </div>
        <div className="hero-actions">
          <Link className="btn primary" href="/analyse">I&apos;M PLAYING NOW</Link>
          <Link className="btn secondary" href="/coach">ASK THE COACH ABOUT THIS</Link>
        </div>
      </section>}
    </div>

    <section className="v7-section">
      <div className="v7-section-head">
        <div>
          <div className="eyebrow">DEVELOPMENT TRACKS</div>
          <h2>Each track states why it exists, what to do in game, and what proves it.</h2>
        </div>
        <Link className="v7-link" href="/progress">SEE PROGRESS HISTORY →</Link>
      </div>

      {/* A data-driven order the player cannot see the reason for is just a
          different arbitrary one, so the basis is stated. */}
      <p className="dc-ordering">{orderNote}</p>

      <div className="v7-stack">
        {activeTasks.map((t,i)=>{
          const req=t.masteryRequired||3;
          const done=t.successfulGames||0;
          return <article key={t.id} {...revealProps(mounted,i,`glass dc-track ${statusTone(t.status)==='mastered'?'is-mastered':''}`)}>
            <div className="dc-track-top">
              <div>
                <div className="dc-track-id">
                  <span className="dc-index">TRACK 0{i+1}</span>
                  <span className="label" style={{letterSpacing:'.1em'}}>{clean(t.category)}</span>
                </div>
                <h3>{t.title}</h3>
              </div>
              <div className="dc-flags">
                <span className={`v7-badge ${statusTone(t.status)}`}>{clean(t.status)}</span>
                <span className={`v7-badge ${t.source==='COACH'?'coach':'engine'}`}>{t.source==='COACH'?'COACH-ADDED':'MATCH ENGINE'}</span>
                {orderById.get(t.id)?.basis==='MEASURED_COST'
                  ? <span className="v7-badge engine">
                      RANKED BY COST · {orderById.get(t.id)!.price?.gapPoints}PT GAP
                    </span>
                  : <span className="v7-badge">PRIORITY {t.priority||50}</span>}
              </div>
            </div>

            <div className="dc-meter">
              <AnimatedBar value={t.progress} delay={i*70}/>
              <div className="dc-meter-num"><strong>{t.progress}%</strong><span>PROGRESS</span></div>
              <div className="dc-passes"><span>PASSES</span><Pips passes={done} required={req}/><span>{done}/{req}</span></div>
            </div>

            {/* The engine already gives a pass back on a failing game. Say so. */}
            <span className={`dc-stake ${done===req-1?'close':done>0?'risk':''}`}>
              {done===req-1
                ?'One clean game retires this behaviour.'
                :done>0
                  ?`${done} banked · a game that misses the bar takes one back.`
                  :'No passes banked yet. The first clean game starts the count.'}
            </span>

            <div className="dc-detail">
              <div>
                <span className="label">Why this is in your plan</span>
                <p>{t.why}</p>
              </div>
              <div>
                <span className="label">Exact in-game behaviour</span>
                <p>{t.gameRule}</p>
              </div>
              <div>
                <span className="label">Mastery test</span>
                <p>{t.target}</p>
                <span className="dc-champ">{championContext(t)}</span>
                <LeakPriceInline price={priceLeak(accountMatches,t.metric)}/>
              </div>
            </div>

            <div className="dc-foot">
              <p className="dc-adapt">
                <b>Latest adaptation</b>
                {t.lastUpdatedReason||t.evidence[t.evidence.length-1]||'No match evidence recorded against this behaviour yet.'}
              </p>
              <button className="btn secondary" onClick={()=>pauseTask(t.id)}>PAUSE TRACK</button>
            </div>
          </article>;
        })}
      </div>
    </section>

    <section className="v7-section">
      <div className="v7-section-head">
        <div>
          <div className="eyebrow">ADAPTIVE PLAN LOGIC</div>
          <h2>How a behaviour earns its slot, and how it loses it.</h2>
        </div>
      </div>
      <div className="dc-logic">
        <div>
          <span className="dc-step">01</span>
          <b>Evidence</b>
          <p>Each new match is scored against the metric behind the behaviour — post-15 CS/min, post-20 deaths, second-item timing, objective involvement.</p>
        </div>
        <div>
          <span className="dc-step">02</span>
          <b>Pass or give back</b>
          <p>A game that clears the threshold banks a pass. A game that misses it takes one back, so a single good game cannot fake mastery.</p>
        </div>
        <div>
          <span className="dc-step">03</span>
          <b>Mastery</b>
          <p>Required passes plus 85%+ progress retires the behaviour into Mastered, freeing the slot for the next highest-priority track.</p>
        </div>
        <div>
          <span className="dc-step">04</span>
          <b>Coach edits</b>
          <p>The Coach can add a track. If five are already active, the lowest-priority one is paused rather than growing the list.</p>
        </div>
      </div>
    </section>

    {mastered.length>0&&<section className="v7-section">
      <div className="v7-section-head">
        <div>
          <div className="eyebrow">MASTERED BEHAVIOURS</div>
          <h2>Retired from the active five on banked evidence.</h2>
        </div>
      </div>
      <div className="dc-mastered">
        {mastered.map(t=><div key={t.id}>
          <span className="v7-badge mastered">MASTERED</span>
          <b>{t.title}</b>
          <small>{t.lastUpdatedReason||'Retired after reviewed evidence.'}</small>
        </div>)}
      </div>
    </section>}

    {paused.length>0&&<section className="v7-section">
      <div className="v7-section-head">
        <div>
          <div className="eyebrow">PAUSED</div>
          <h2>Held back so the active plan stays at five.</h2>
        </div>
      </div>
      <div className="dc-mastered">
        {paused.map(t=><div key={t.id} style={{borderColor:'var(--border)',background:'rgba(255,255,255,.03)'}}>
          <span className="v7-badge">PAUSED</span>
          <b>{t.title}</b>
          <small>{t.lastUpdatedReason||'Paused.'}</small>
        </div>)}
      </div>
    </section>}
  </AppShell>;
}
