import type {Metadata} from 'next';
import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';
import {TrackView} from '@/components/TrackView';
import {BeginnerGlossary,LandingFaq,LandingFunnelTracking,ProofWithoutPretending,PublicMatchPreview} from '@/components/LandingConversion';

export const metadata:Metadata={
  title:{absolute:'OP CLIMB — One Clear Focus From Your League Games'},
  description:'Connect your Riot account, find the repeat that is costing you games, and take one clear rule into your next match.',
  alternates:{canonical:'/'},
};

const signals=[
  {k:'REPEAT',v:'2 DEATHS / 90S',tone:'bad'},
  {k:'GOLD HELD',v:'1,140g',tone:'warn'},
  {k:'NEXT GAME',v:'RECOVER FIRST',tone:'good'},
] as const;

const steps=[
  {step:'01',name:'PLAY',detail:'Play normally. Do not try to impress the app.'},
  {step:'02',name:'REVIEW',detail:'We look for the decision that keeps showing up.'},
  {step:'03',name:'FIX',detail:'You get one clear rule for the next game.'},
  {step:'04',name:'PROVE',detail:'We check whether the habit actually changed.'},
];

const StartFree=({placement}:{placement:string})=><div className="hero-actions" style={{display:'inline-flex',flexDirection:'column',alignItems:'flex-start',gap:7}}><Link className="btn primary" href="/signup" data-landing-cta={placement}>START FREE</Link><small className="muted" style={{fontSize:11}}>No card required</small></div>;

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
        <div className="eyebrow">COACHING FROM THE GAMES YOU ACTUALLY PLAY</div>
        <h1>STOP TRYING TO FIX EVERYTHING.<br/><span>FIX ONE THING.</span></h1>
        <p>Connect Riot. OP CLIMB looks at your games, finds the repeat that is hurting you most, and gives you one simple rule for the next match. Then it checks whether you changed it.</p>
        <StartFree placement="hero"/>
        <a href="#try-it" className="text-link" style={{display:'block',marginTop:14}}>SEE A REAL EXAMPLE FIRST ↓</a>
        <div className="public-proof-strip"><span>YOUR GAMES</span><span>ONE CLEAR FOCUS</span><span>REMEMBERS THE PATTERN</span><span>NO STAT DUMP</span></div>
      </div>

      <div className="landing-console" aria-label="Sample OP CLIMB coaching output">
        <div className="console-top"><div><span>LAST GAME</span><b>JINX · ADC</b></div><div className="console-score"><small>GOLD COACH</small><strong>01</strong><em>FOCUS</em></div></div>
        <div className="console-divider"/>
        <div className="console-priority"><span>THIS IS WHAT YOU'RE FIXING</span><strong>STOP THE SECOND DEATH</strong><small>After you die: take safe resources, get information back, then fight. No revenge play.</small></div>
        <div className="console-signals">{signals.map(x=><div key={x.k} className={`console-signal is-${x.tone}`}><span>{x.k}</span><b>{x.v}</b></div>)}</div>
        <div className="console-ladder" aria-label="Progress"><i className="done"/><i className="active"/><i/><i/><i/></div>
        <div className="console-timeline"><div><i className="warn"/><b>18:42</b><span>DIED</span></div><div><i className="blue"/><b>19:56</b><span>DIED AGAIN</span></div><div><i className="good"/><b>NEXT</b><span>RECOVER FIRST</span></div></div>
        <a href="#try-it" className="console-link">TRY THE EXAMPLE →</a>
      </div>
    </section>

    <PublicMatchPreview/>
    <BeginnerGlossary/>

    <section className="container landing-loop-v2" id="loop">
      <div className="landing-section-head"><div><div className="eyebrow">HOW IT WORKS</div><h2>PLAY. REVIEW. FIX. REPEAT.</h2></div><p>You do not need another dashboard full of numbers.</p></div>
      <div className="hunt-rail">{steps.map(({step,name,detail})=><div key={step}><span>{step}</span><b>{name}</b><small>{detail}</small></div>)}</div>
    </section>

    <section className="container landing-proof-grid">
      <article><span>01</span><div><b>WE SPOT THE REPEAT</b><strong>Not every mistake matters equally.</strong><small>We look for the behaviour that keeps appearing across your games.</small></div></article>
      <article><span>02</span><div><b>YOU GET ONE RULE</b><strong>Something you can remember while playing.</strong><small>No ten-point checklist. One job for the next game.</small></div></article>
      <article><span>03</span><div><b>WE CHECK THE NEXT GAME</b><strong>Did you actually change it?</strong><small>When the habit improves, your focus moves on.</small></div></article>
    </section>

    <ProofWithoutPretending/>

    <section className="container landing-tier-preview">
      <div className="landing-section-head"><div><div className="eyebrow">START SIMPLE</div><h2>THE COACHING GETS DEEPER WHEN YOU NEED IT.</h2></div><p>The first answer should be useful, not complicated.</p></div>
      <div className="tier-preview-grid">
        <div><span>FREE</span><strong>Find your focus</strong><small>Your recent games · one next-game rule · simple review</small></div>
        <div><span>PLUS</span><strong>Understand the pattern</strong><small>More game history · stronger comparisons · deeper coaching</small></div>
        <div className="is-pro"><span>PRO</span><strong>Build a long-term coach</strong><small>More history · repeated patterns · deeper champion and decision review</small></div>
      </div>
      <StartFree placement="tiers"/>
    </section>

    <section className="container landing-trust-strip"><div><b>TRY FIRST</b><span>See the coaching before you commit.</span></div><div><b>YOUR GAMES</b><span>Advice is tied back to what you actually did.</span></div><div><b>FREE TO START</b><span>No card required.</span></div><div><b>NO FAKE PROOF</b><span>No invented testimonials or made-up rank climbs.</span></div></section>

    <LandingFaq/>

    <section className="container landing-final-cta"><div className="eyebrow">GIVE YOUR NEXT GAME ONE JOB</div><h2>PLAY WITH A PURPOSE.<br/>SEE IF IT CHANGED.</h2><StartFree placement="final"/></section>
  </main>

  <PublicFooter/>
</>}
