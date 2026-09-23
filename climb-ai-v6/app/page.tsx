import type {Metadata} from 'next';
import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';
import {TrackView} from '@/components/TrackView';
import {BeginnerGlossary,LandingFaq,LandingFunnelTracking,ProofWithoutPretending,PublicMatchPreview} from '@/components/LandingConversion';

export const metadata:Metadata={
  title:{absolute:'OP CLIMB — A League Coach That Learns How You Play'},
  description:'Turn your League games into one next-game decision, proof that it changed, and a coaching path that develops as you do.',
  alternates:{canonical:'/'},
};

const signals=[
  {k:'REPEAT',v:'2 DEATHS / 90S',tone:'bad'},
  {k:'GOLD HELD',v:'1,140g',tone:'warn'},
  {k:'NEXT GAME',v:'RECOVER FIRST',tone:'good'},
] as const;

const steps=[
  {step:'01',name:'PLAY',detail:'Play normally. OP CLIMB needs your real decisions, not a test performance.'},
  {step:'02',name:'FIND',detail:'It finds the repeated decision costing you most.'},
  {step:'03',name:'FIX',detail:'You get one clear rule to take into the next game.'},
  {step:'04',name:'PROVE',detail:'The next games decide whether the lesson stays, transfers or moves on.'},
];

const StartFree=({placement}:{placement:string})=><div className="hero-actions" style={{display:'inline-flex',flexDirection:'column',alignItems:'flex-start',gap:7}}><Link className="btn primary" href="/signup" data-landing-cta={placement}>START FREE</Link><small className="muted" style={{fontSize:11}}>No card required</small></div>;

export default function Landing(){return <>
  <TrackView event="landing_view"/>
  <LandingFunnelTracking/>
  <header className="container public-topbar">
    <Link href="/" aria-label="OP CLIMB home"><Wordmark size="sm"/></Link>
    <nav><Link href="#loop">HOW IT WORKS</Link><Link href="/demo">DEMO</Link><Link href="/pricing">PRICING</Link><Link href="/login">LOG IN</Link><Link className="btn primary" href="/signup" data-landing-cta="top-nav">START FREE</Link></nav>
  </header>

  <main className="landing-v2">
    <section className="container landing-hero-v2">
      <div className="landing-copy">
        <div className="eyebrow">A LEAGUE COACH THAT LEARNS FROM YOUR REAL GAMES</div>
        <h1>DON&apos;T JUST REVIEW YOUR GAMES.<br/><span>BUILD A BETTER PLAYER.</span></h1>
        <p>OP CLIMB finds the decision that keeps costing you games, gives you one rule to fix it, then checks whether the change actually holds. As your evidence grows, the coaching moves on with you.</p>
        <StartFree placement="hero"/>
        <a href="#try-it" className="text-link" style={{display:'block',marginTop:14}}>SEE A REAL EXAMPLE FIRST ↓</a>
        <div className="public-proof-strip"><span>YOUR GAMES</span><span>ONE CLEAR FOCUS</span><span>REMEMBERS THE PATTERN</span><span>PROVES THE CHANGE</span></div>
      </div>

      <div className="landing-console" aria-label="Sample OP CLIMB coaching output">
        <div className="console-top"><div><span>LAST GAME</span><b>JINX · ADC</b></div><div className="console-score"><small>GOLD COACH</small><strong>01</strong><em>FOCUS</em></div></div>
        <div className="console-divider"/>
        <div className="console-priority"><span>THIS IS WHAT YOU&apos;RE FIXING</span><strong>STOP THE SECOND DEATH</strong><small>After you die: take safe resources, get information back, then fight. No revenge play.</small></div>
        <div className="console-signals">{signals.map(x=><div key={x.k} className={'console-signal is-'+x.tone}><span>{x.k}</span><b>{x.v}</b></div>)}</div>
        <div className="console-ladder" aria-label="Progress"><i className="done"/><i className="active"/><i/><i/><i/></div>
        <div className="console-timeline"><div><i className="warn"/><b>18:42</b><span>DIED</span></div><div><i className="blue"/><b>19:56</b><span>DIED AGAIN</span></div><div><i className="good"/><b>NEXT</b><span>RECOVER FIRST</span></div></div>
        <a href="#try-it" className="console-link">TRY THE EXAMPLE →</a>
      </div>
    </section>

    <PublicMatchPreview/>
    <BeginnerGlossary/>

    <section className="container landing-loop-v2" id="loop">
      <div className="landing-section-head"><div><div className="eyebrow">THE DEVELOPMENT LOOP</div><h2>PLAY. FIND. FIX. PROVE.</h2></div><p>The goal is not more information. It is better decisions that survive the next situation.</p></div>
      <div className="hunt-rail">{steps.map(({step,name,detail})=><div key={step}><span>{step}</span><b>{name}</b><small>{detail}</small></div>)}</div>
    </section>

    <section className="container landing-proof-grid">
      <article><span>01</span><div><b>WE FIND THE REPEAT</b><strong>Not every mistake deserves your attention.</strong><small>OP CLIMB prioritises the decision pattern that keeps reappearing in your evidence.</small></div></article>
      <article><span>02</span><div><b>YOU GET ONE RULE</b><strong>Something usable inside the next game.</strong><small>No ten-point checklist. One active development job until the evidence changes.</small></div></article>
      <article><span>03</span><div><b>THE COACH MOVES ON</b><strong>Improvement has to survive a new situation.</strong><small>PRO can test transfer across champions and contexts before treating a principle as owned.</small></div></article>
    </section>

    <ProofWithoutPretending/>

    <section className="container landing-tier-preview">
      <div className="landing-section-head"><div><div className="eyebrow">ONE COACHING JOURNEY · THREE DEPTHS</div><h2>START WITH THE PROBLEM. UNLOCK MORE ONLY WHEN YOU WANT MORE CONTEXT.</h2></div><p>The plans are not three different apps. Each level takes the same player journey one layer deeper.</p></div>
      <div className="landing-tier-journey">
        <article className="landing-tier-step"><em>YOU START HERE</em><span>FREE</span><strong>FIND THE PROBLEM</strong><p>See the repeated mistake, take one rule into the next game and prove whether it changes.</p><div className="landing-tier-locks"><small className="unlocked">✓ GAME REVIEW</small><small className="unlocked">✓ ONE ACTIVE FOCUS</small><small>🔒 FULL DRAFT PLAN</small></div></article>
        <article className="landing-tier-step"><em>WHEN YOU WANT THE WHOLE GAME</em><span>PLUS · £9.99</span><strong>UNDERSTAND THE GAME</strong><p>See how both comps win, what your role needed to do and the deeper context around the mistake.</p><div className="landing-tier-locks"><small className="unlocked">✓ FULL 5V5 READ</small><small className="unlocked">✓ 90-DAY CONTEXT</small><small>🔒 LONG-TERM PLAYER MEMORY</small></div></article>
        <article className="landing-tier-step is-pro"><em>WHEN YOU WANT A REAL DEVELOPMENT SYSTEM</em><span>PRO · £19.99</span><strong>DEVELOP THE PLAYER</strong><p>Build a coach that remembers your habits, tests whether learning transfers and decides what should replace a mastered lesson.</p><div className="landing-tier-locks"><small className="unlocked">✓ REMEMBERS YOU</small><small className="unlocked">✓ TESTS TRANSFER</small><small className="unlocked">✓ CHOOSES WHAT COMES NEXT</small></div></article>
      </div>
      <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}><StartFree placement="tiers"/><Link href="/pricing" className="text-link">SEE EXACTLY WHAT UNLOCKS AT EACH LEVEL →</Link></div>
    </section>

    <section className="container landing-trust-strip"><div><b>TRY FIRST</b><span>See the coaching before you commit.</span></div><div><b>YOUR GAMES</b><span>Advice is tied back to what you actually did.</span></div><div><b>FREE TO START</b><span>No card required.</span></div><div><b>NO FAKE PROOF</b><span>No invented testimonials or made-up rank climbs.</span></div></section>

    <LandingFaq/>

    <section className="container landing-final-cta"><div className="eyebrow">GIVE YOUR NEXT GAME ONE JOB</div><h2>FIX THE DECISION.<br/>PROVE IT HOLDS.</h2><StartFree placement="final"/></section>
  </main>

  <PublicFooter/>
</>};
