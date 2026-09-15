import type {Metadata} from 'next';
import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';
import {HUNT_STAGES} from '@/lib/brand';
import {TrackView} from '@/components/TrackView';
import {BeginnerGlossary,LandingFaq,LandingFunnelTracking,ProofWithoutPretending,PublicMatchPreview} from '@/components/LandingConversion';

export const metadata:Metadata={
  title:{absolute:'OP CLIMB — League of Legends Coaching That Learns How You Play'},
  description:'Find the repeated decision costing you League games, get one next-game rule, then prove you fixed it across future matches.',
  alternates:{canonical:'/'},
};

const signals=[
  {k:'FIGHT STATE',v:'RED',tone:'bad'},
  {k:'UNSPENT',v:'1,140g',tone:'warn'},
  {k:'NEXT RULE',v:'ADD AN EDGE',tone:'good'},
] as const;

const StartFree=({placement}:{placement:string})=><div className="hero-actions" style={{display:'inline-flex',flexDirection:'column',alignItems:'flex-start',gap:7}}><Link className="btn primary" href="/signup" data-landing-cta={placement}>START FREE</Link><small className="muted" style={{fontSize:11}}>Free to start · No card required</small></div>;

export default function Landing(){return <>
  <TrackView event="landing_view"/>
  <LandingFunnelTracking/>
  <header className="container public-topbar">
    <Link href="/" aria-label="OP CLIMB home"><Wordmark size="sm"/></Link>
    <nav><Link href="/demo">DEMO</Link><Link href="/pricing">PRICING</Link><Link href="/login">LOG IN</Link><Link className="btn primary" href="/signup" data-landing-cta="top-nav">START FREE</Link></nav>
  </header>

  <main className="landing-v2">
    <section className="container landing-hero-v2">
      <div className="landing-copy">
        <div className="eyebrow">LEAGUE COACHING THAT REMEMBERS YOUR MISTAKES</div>
        <h1>STOP READING STATS.<br/><span>FIX THE DECISION.</span></h1>
        <p>OP CLIMB watches the evidence from your games, finds the habit that keeps costing you, gives you one rule to carry into the next match, then checks whether you fixed it.</p>
        <StartFree placement="hero"/>
        <a href="#try-it" className="text-link" style={{display:'block',marginTop:14}}>OR TRY THE COACHING INTERACTION FIRST ↓</a>
        <div className="public-proof-strip"><span>POST-GAME COACHING</span><span>FIX LADDER</span><span>MULTI-GAME MEMORY</span><span>NO LIVE SHOTCALLING</span></div>
      </div>

      <div className="landing-console" aria-label="Sample OP CLIMB coaching output">
        <div className="console-top"><div><span>SAMPLE MATCH</span><b>JINX · ADC</b></div><div className="console-score"><small>OP SCORE</small><strong>63</strong><em>STABLE</em></div></div>
        <div className="console-divider"/>
        <div className="console-priority"><span>CURRENT PRIORITY · CONTROL</span><strong>STOP ACCEPTING RED-STATE FIGHTS</strong><small>If visible state is red, create numbers, setup or first damage before committing.</small></div>
        <div className="console-signals">{signals.map(x=><div key={x.k} className={`console-signal is-${x.tone}`}><span>{x.k}</span><b>{x.v}</b></div>)}</div>
        <div className="console-ladder" aria-label="Fix Ladder"><i className="done"/><i className="active"/><i/><i/><i/></div>
        <div className="console-timeline"><div><i className="warn"/><b>02:12</b><span>RESET</span></div><div><i className="blue"/><b>08:50</b><span>POWER</span></div><div><i className="good"/><b>12:27</b><span>GOOD</span></div></div>
        <a href="#try-it" className="console-link">TRY THE INTERACTIVE SAMPLE →</a>
      </div>
    </section>

    <PublicMatchPreview/>
    <BeginnerGlossary/>

    <section className="container landing-loop-v2" id="loop">
      <div className="landing-section-head"><div><div className="eyebrow">THE LOOP</div><h2>ONE FOCUS. UNTIL THE EVIDENCE CHANGES.</h2></div><p>Stats are evidence. The product is the behaviour change.</p></div>
      <div className="hunt-rail">{HUNT_STAGES.map(({step,name,detail})=><div key={step}><span>{step}</span><b>{name}</b><small>{detail}</small></div>)}</div>
    </section>

    <section className="container landing-proof-grid">
      <article><span>01</span><div><b>DECISION REVIEW</b><strong>Was the fight actually good?</strong><small>Separate decision quality from whether the play happened to work.</small></div></article>
      <article><span>02</span><div><b>MAP & TEMPO</b><strong>Were you moving at the right time?</strong><small>Connect fights to reset, objective and power windows.</small></div></article>
      <article><span>03</span><div><b>DECISION FINGERPRINT</b><strong>What keeps repeating?</strong><small>PRO remembers patterns across games instead of judging one match in isolation.</small></div></article>
    </section>

    <ProofWithoutPretending/>

    <section className="container landing-tier-preview">
      <div className="landing-section-head"><div><div className="eyebrow">COACHING DEPTH</div><h2>START USEFUL. UNLOCK DEEPER DIAGNOSIS.</h2></div><p>One product path. More depth as you need it.</p></div>
      <div className="tier-preview-grid">
        <div><span>FREE</span><strong>See the leak</strong><small>OP Grade · basic fight/death coaching · first Fix Ladder stages</small></div>
        <div><span>PLUS</span><strong>Understand the leak</strong><small>Economy · red-state fights · chain deaths · power conversion</small></div>
        <div className="is-pro"><span>PRO</span><strong>Build your player model</strong><small>Decision Fingerprint · long-term history · champion identity · deepest ILP</small></div>
      </div>
      <StartFree placement="tiers"/>
    </section>

    <section className="container landing-trust-strip"><div><b>TRY FIRST</b><span>Interactive coaching sample before signup.</span></div><div><b>POST-GAME COACHING</b><span>No hidden-info live shotcalling.</span></div><div><b>FREE TO START</b><span>No card required to create an account.</span></div><div><b>REAL PROOF ONLY</b><span>No invented testimonials or rank climbs.</span></div></section>

    <LandingFaq/>

    <section className="container landing-final-cta"><div className="eyebrow">YOUR NEXT GAME SHOULD HAVE A PURPOSE</div><h2>FIND THE LEAK.<br/>PLAY WITH ONE RULE.</h2><StartFree placement="final"/></section>
  </main>

  <PublicFooter/>
</>}
