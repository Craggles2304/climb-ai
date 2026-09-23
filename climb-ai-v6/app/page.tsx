import type {Metadata} from 'next';
import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';
import {TrackView} from '@/components/TrackView';
import {BeginnerGlossary,LandingFaq,LandingFunnelTracking,ProofWithoutPretending,PublicMatchPreview} from '@/components/LandingConversion';
import {FinalRiotCta,PublicPersonalHero} from '@/components/PublicPersonalHero';

export const metadata:Metadata={
  title:{absolute:'OP CLIMB — Personal League Coaching From Your Own Games'},
  description:'Enter your Riot ID, analyse your recent ranked games and get a personal League coaching read before creating an account.',
  alternates:{canonical:'/'},
};

const steps=[
  {step:'01',name:'LINK YOUR RIOT ID',detail:'Enter Name#TAG and region. No OP CLIMB account is needed for the first read.'},
  {step:'02',name:'WE ANALYSE YOUR PLAY',detail:'We read up to your last 20 ranked solo games and look for repeated decision patterns, not just one bad KDA.'},
  {step:'03',name:'GET YOUR CLIMB PLAN',detail:'See the first priority immediately. Create a free account only when you want to save the history and build the full plan.'},
];

export default function Landing(){return <>
  <TrackView event="landing_view"/>
  <LandingFunnelTracking/>
  <header className="public-v4-topbar"><div className="container public-v4-topbar-inner">
    <Link href="/" aria-label="OP CLIMB home"><Wordmark size="sm"/></Link>
    <nav><Link href="#how-it-works">HOW IT WORKS</Link><Link href="#try-it">SAMPLE REPORT</Link><Link href="/pricing">PRICING</Link><Link href="/login">LOG IN</Link><Link className="btn primary" href="#analyse" data-landing-cta="top-nav">ANALYSE MY GAMES</Link></nav></div>
  </header>

  <main className="landing-v2 landing-v3 landing-v4">
    <PublicPersonalHero/>

    <section className="container landing-loop-v2" id="how-it-works">
      <div className="landing-section-head"><div><div className="eyebrow">HOW IT WORKS</div><h2>YOUR RIOT ID → YOUR PATTERN → YOUR PLAN.</h2></div><p>The first useful result should happen before an account form, not after one.</p></div>
      <div className="hunt-rail three-step">{steps.map(({step,name,detail})=><div key={step}><span>{step}</span><b>{name}</b><small>{detail}</small></div>)}</div>
    </section>

    <PublicMatchPreview/>

    <section className="container learning-personalization">
      <div className="landing-section-head"><div><div className="eyebrow">LEARNS HOW YOU PLAY</div><h2>THE COACHING SHOULD GET MORE SPECIFIC AS YOUR EVIDENCE GROWS.</h2></div><p>A tracker keeps describing games. OP CLIMB should increasingly describe the player behind them.</p></div>
      <div className="personalization-grid">
        <article className="personalization-card">
          <span>WEEK 1 · BASELINE</span>
          <strong>“Early deaths are appearing too often.”</strong>
          <p>The first games establish your own baseline: lane economy, death timing, role, champions and where repeated losses of tempo start.</p>
          <div><b>KNOWS</b><small>What happened repeatedly</small></div>
        </article>
        <i>→</i>
        <article className="personalization-card is-deep">
          <span>AFTER REPEATED EVIDENCE</span>
          <strong>“On your scaling ADC games, the first death is often followed by a rushed re-entry before information is restored.”</strong>
          <p>The player model can connect recurring situations, test whether a fix holds under new conditions and stop coaching a lesson once direct evidence says you own it.</p>
          <div><b>LEARNS</b><small>How the same decision shows up in different games</small></div>
        </article>
      </div>
      <small className="example-disclaimer">Illustrative progression, not a claimed player result. Personal conclusions are only shown when the player’s own evidence supports them.</small>
    </section>

    <ProofWithoutPretending/>

    <section className="container landing-tier-preview" id="plans">
      <div className="landing-section-head"><div><div className="eyebrow">ONE COACHING JOURNEY · THREE DEPTHS</div><h2>START FREE. PAY ONLY WHEN YOU WANT THE COACH TO GO DEEPER.</h2></div><p>The same journey continues through every tier: find the problem, understand the game, then develop the player over time.</p></div>
      <div className="landing-tier-journey">
        <article className="landing-tier-step"><em>FREE</em><span>£0</span><strong>FIND THE PROBLEM</strong><p>Recent evidence, one active focus and a simple review that gives the next game one job.</p><div className="landing-tier-locks"><small className="unlocked">✓ GAME REVIEW</small><small className="unlocked">✓ ONE ACTIVE FOCUS</small><small>🔒 FULL DRAFT PLAN</small></div></article>
        <article className="landing-tier-step"><em>PLUS</em><span>£9.99 / MONTH</span><strong>UNDERSTAND THE GAME</strong><p>Add the full 5v5 read, both win conditions, your role and deeper fight/economy context.</p><div className="landing-tier-locks"><small className="unlocked">✓ FULL 5V5 READ</small><small className="unlocked">✓ 90-DAY CONTEXT</small><small>🔒 LONG-TERM PLAYER MEMORY</small></div></article>
        <article className="landing-tier-step is-pro"><em>PRO</em><span>£19.99 / MONTH</span><strong>DEVELOP THE PLAYER</strong><p>Build a coach that remembers recurring habits, tests whether learning transfers and chooses what should come next.</p><div className="landing-tier-locks"><small className="unlocked">✓ REMEMBERS YOU</small><small className="unlocked">✓ TESTS TRANSFER</small><small className="unlocked">✓ CHOOSES WHAT COMES NEXT</small></div></article>
      </div>
      <div className="tier-actions"><Link href="/pricing" className="btn secondary">COMPARE EVERY UNLOCK</Link><Link href="#analyse" className="btn primary">ANALYSE MY GAMES FIRST</Link></div>
    </section>

    <BeginnerGlossary/>
    <LandingFaq/>
    <FinalRiotCta/>
  </main>

  <PublicFooter/>
</>};
