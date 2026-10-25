'use client';
import Link from 'next/link';
import {useMemo} from 'react';
import {TftShell} from '@/components/TftShell';
import {useAccount} from '@/components/AccountContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {summarizeTft,tftCoachingRead,type TftMatch} from '@/lib/tft/types';
import {buildTacticianProfile} from '@/lib/tft/advancedCoach';
import {useTftDevelopment} from '@/lib/hooks/useTftDevelopment';

export default function TftCoach(){
  const {active}=useAccount();const {tftTier}=useSubscription();
  const {data:development,error}=useTftDevelopment(active.id);
  const matches=development?.matches??[];
  const loading=!development&&!error;
  const summary=useMemo(()=>summarizeTft(matches),[matches]);
  const read=useMemo(()=>tftCoachingRead(matches),[matches]);
  const profile=development?.profile??buildTacticianProfile([]);
  const spread=matches.length?Math.max(...matches.map(m=>m.placement))-Math.min(...matches.map(m=>m.placement)):0;
  const nextAction=development?.mission.nextGame||'Connect to load your account mission.';
  const dna=[
    {name:'Economy',skill:profile.skills.find(s=>s.key==='ECONOMY')},
    {name:'Tempo',skill:profile.skills.find(s=>s.key==='TEMPO')},
    {name:'Board Building',skill:profile.skills.find(s=>s.key==='BOARD_BUILDING')},
    {name:'Flexibility',skill:profile.skills.find(s=>s.key==='FLEXIBILITY')},
    {name:'Items & Augments',skill:profile.skills.find(s=>s.key==='ITEMS_AUGMENTS')},
    {name:'Endgame Decisions',skill:profile.skills.find(s=>s.key==='CONVERSION')},
  ];
  const reviewed=matches.filter(m=>m.decisionReview);
  const reviewCount=profile.skills.reduce((total,s)=>total+s.evidenceCount,0);
  const recurring=[
    {name:'Late stabilisation',count:reviewed.filter(m=>m.decisionReview?.rollTiming==='LATE').length},
    {name:'Forced contested line',count:reviewed.filter(m=>m.decisionReview?.pivotQuality==='FORCED_CONTESTED').length},
    {name:'Held components',count:reviewed.filter(m=>m.decisionReview?.itemChoice==='GREEDY_COMPONENTS').length},
  ].filter(x=>x.count>=2);

  return <TftShell><main className="tft-page">
    {error&&<p role="alert">{error}</p>}
    <section className="tft-hero">
      <div className="tft-hero-copy">
        <div className="eyebrow">MY TFT DNA · YOUR TACTICIAN IDENTITY</div>
        <h1>THIS IS THE PLAYER YOUR DECISIONS ARE BUILDING.</h1>
        <p>Like League My DNA, TFT is organised around six practice strands and one shared account mission. The point is not to memorise comps — it is to build decision habits that transfer.</p>
        <div className="tft-hero-actions">
          <Link className="btn primary" href="/tft/timeline">REVIEW LAST GAME →</Link>
          <Link className="btn secondary" href="/tft/game-plan">SET NEXT GAME PLAN</Link>
        </div>
      </div>
      <div className="tft-hero-side">
        <div className="tft-hero-signal primary"><span>SELF-REVIEW GRADE</span><strong>{profile.grade??'—'}</strong></div>
        <div className="tft-hero-signal"><span>REVIEW PRIORITY</span><strong>{profile.primaryLeak?.label||read.title}</strong></div>
        <div className="tft-hero-signal"><span>EXPLAINED DECISIONS</span><strong>{loading?'…':reviewCount}</strong></div>
      </div>
    </section>

    <section className="tft-dna-stage" aria-label="TFT Game DNA">
      <div className="tft-dna-stage-head">
        <div><span>TFT REVIEW PROFILE</span><strong>Your six-strand decision profile</strong></div>
        <small>Scores summarise explained player self-reviews. Recorded actions support review but do not establish decision quality. Missing reviews stay NOT OBSERVED.</small>
      </div>
      <div className="tft-dna-grid">
        {dna.map(d=><article className="tft-dna-card" key={d.name}>
          <small>{d.name.toUpperCase()}</small>
          <h3>{d.name}</h3>
          <span className="tft-dna-score">{d.skill?.score??'—'}</span>
          <div className="tft-dna-meter"><i style={{width:(d.skill?.score??0)+'%'}}/></div>
          <p>{d.skill?.score!=null?'SELF-REPORTED · '+d.skill.evidenceCount+' explained games':'NOT OBSERVED · add an explained decision review'}</p>
        </article>)}
      </div>
    </section>

    <section className="tft-focus-grid">
      <article className="tft-focus">
        <span>PRIORITY TFT MISSION</span>
        <h2>{development?.mission.title||'LOADING ACCOUNT MISSION'}</h2>
        <p>{development?.mission.progressLabel||'Your mission is shared with the Companion.'}</p><p>{development?.mission.progress??0}/{development?.mission.goal??3} recorded games ready to review · not verified mastery</p>
        <div className="tft-focus-rule"><small>YOUR JOB NEXT GAME</small><b>{nextAction}</b></div>
      </article>
      <aside className="tft-grade">
        <span>SELF-REVIEW GRADE</span>
        <strong>{profile.grade??'—'}</strong>
        <small>{profile.skills.filter(s=>s.score!==null).length}/6 areas reviewed<br/>self-reported · not verified mastery</small>
      </aside>
    </section>

    <section className="tft-mission-board">
      <div className="tft-mission-board-head">
        <div><div className="eyebrow">YOUR ACTIVE DEVELOPMENT</div><h2>6 PRACTICE AREAS</h2></div>
        <Link href="/tft/decision-lab" className="btn secondary">OPEN DECISION LAB</Link>
      </div>
      <div className="tft-mission-list">
        {profile.ilp.map(task=><article className="tft-mission" key={task.id}>
          <div className="eyebrow">#{task.priority} · {task.skill}</div>
          <strong>{task.title}</strong>
          <p>{task.target}</p>
          <div className="tft-mission-meta"><span>FAVOURABLE SELF-REVIEWS</span><b>{task.progress}/{task.goal}</b></div>
        </article>)}
      </div>
    </section>

    <div className="tft-section-head">
      <div><div className="eyebrow">DECISION TWIN · COACH MEMORY</div><h2>WHAT KEEPS REPEATING?</h2><p>Repeated mistakes become patterns. Patterns become missions. Self-reviews do not graduate missions or certify skill transfer.</p></div>
    </div>
    <section className="tft-review-grid">
      <article className="tft-review-card fix">
        <div className="eyebrow">RECURRING PATTERNS</div>
        <h3>{recurring.length?recurring[0].name:'NOT OBSERVED YET'}</h3>
        {recurring.length?recurring.map(x=><p key={x.name}><b>{x.name}</b> · self-reported in {x.count} games</p>):<p>At least two explicit reviews are needed before Decision Twin calls something a recurring pattern.</p>}
        <Link href="/tft/timeline" className="text-link">OPEN POST-GAME PROOF →</Link>
      </article>
      <article className="tft-review-card good">
        <div className="eyebrow">TRANSFER TEST · PRINCIPLE OWNED</div>
        <h3>PROVE THE RULE IN A NEW GAME.</h3>
        <p>Apply the same decision principle in a different comp, economy state or lobby. Explain the decision in each new context. A favourable result or self-review alone cannot prove mastery.</p>
        <Link href="/tft/decision-lab" className="text-link">OPEN TRANSFER PRACTICE →</Link>
      </article>
    </section>

    <div className="tft-section-head">
      <div><div className="eyebrow">SUPPORTING CONTEXT</div><h2>RESULTS WITHOUT CONFUSING THEM FOR SKILL.</h2><p>Placement is context. Explained self-reviews drive the reflection scores; recorded actions remain separately identified.</p></div>
    </div>
    <section className="tft-stat-strip">
      <div className="tft-stat"><span>CONSISTENCY</span><b>{matches.length?spread+' places':'—'}</b><small>placement spread</small></div>
      <div className="tft-stat"><span>RECENT FORM</span><b>{summary.games?summary.recentForm.toFixed(2):'—'}</b><small>latest five average</small></div>
      <div className="tft-stat"><span>TOP-4 RATE</span><b>{summary.games?Math.round(summary.top4Rate*100)+'%':'—'}</b><small>outcome context</small></div>
      <div className="tft-stat"><span>DECISION DEPTH</span><b>{loading?'…':reviewCount}</b><small>structured reviews</small></div>
      <div className="tft-stat"><span>PATTERNS</span><b>{recurring.length}</b><small>repeated leaks found</small></div>
      <div className="tft-stat"><span>ACCESS</span><b>{tftTier}</b><small>League + TFT</small></div>
    </section>
  </main></TftShell>;
}
