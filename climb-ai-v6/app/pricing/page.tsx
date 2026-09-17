'use client';
import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';
import {useSubscription} from '@/components/SubscriptionContext';
import {PLAN_COPY,SubscriptionTier} from '@/lib/subscription';

const plans:{n:SubscriptionTier;headline:string;summary:string;unlocks:string[];details:string[]}[]=[
  {n:'FREE',headline:'SEE THE LEAK',summary:'Useful first coaching loop with no payment.',unlocks:['Simple role-specific Companion plan','OP Match Grade','Fight + death control','2 Fix Ladder stages'],details:['Four-step pre-game execution plan','One Climb Mission','Basic CS / match review','Strength / weakness timestamps','3 detailed reviews per week','7-day progress view']},
  {n:'PLUS',headline:'UNDERSTAND HOW TO WIN',summary:'Adds the full match read: exactly how your draft wins, how it loses, and what your role must do.',unlocks:['OUR WIN CONDITION in Companion','THEY WIN IF / loss condition','Unspent gold + reset leaks','4 Fix Ladder stages'],details:['Full 5v5 draft win-condition sequence','Your role inside the win condition','Biggest throw condition','Thrown Advantage Rate','Underdog Conversion','Power Window Conversion','Resource Conversion','How you win / lose each reviewed fight','90-day analytics']},
  {n:'PRO',headline:'BUILD YOUR PLAYER MODEL',summary:'Persistent learning across games, champions and recurring decisions.',unlocks:['Everything in PLUS','Decision Fingerprint','Long-term pattern memory','All 5 Fix Ladder stages'],details:['Deep draft reasoning around formation and threats','Lead Protection','Reset Quality + Power-Spike Conversion','Objective Readiness + Farm-vs-Fight','Repeat Threat + Opponent Adaptation','Carry Preservation + Survival Value','Champion Identity coaching','Historical OP Leak Rate + Recovery trends','Deepest adaptive ILP']},
];

export default function Pricing(){
  const {tier}=useSubscription();
  return <>
    <header className="container public-topbar"><Link href="/" aria-label="OP CLIMB home"><Wordmark size="sm"/></Link><nav><Link href="/demo">DEMO</Link><Link href="/login">LOG IN</Link><Link className="btn primary" href="/signup">START FREE</Link></nav></header>
    <main className="container pricing-public">
      <section className="pricing-hero"><div className="eyebrow">COACHING DEPTH</div><h1>PAY FOR A DEEPER<br/><span>DIAGNOSIS.</span></h1><p>FREE stays simple and useful. PLUS unlocks the exact win/loss condition for the draft. PRO adds the deeper long-term player model — not just more charts.</p></section>
      <section className="pricing-grid-v2">{plans.map(plan=>{const copy=PLAN_COPY[plan.n];const current=tier===plan.n;return <article className={`pricing-card-v2 ${plan.n==='PRO'?'is-pro':''}`} key={plan.n}>
        <div className="pricing-card-top"><span>{plan.n}</span>{current&&<b>CURRENT</b>}</div>
        <strong className="pricing-price">{copy.price}</strong><h2>{plan.headline}</h2><p>{plan.summary}</p>
        <div className="pricing-unlocks">{plan.unlocks.map(x=><div key={x}><i/> {x}</div>)}</div>
        <details><summary>FULL FEATURE LIST</summary><ul>{plan.details.map(x=><li key={x}>{x}</li>)}</ul></details>
        {plan.n==='FREE'?<Link href="/signup" className="btn primary">START FREE</Link>:<div className="pricing-upgrade-note"><b>{plan.n} ACCESS</b><span>Active paid and trialing entitlements unlock the deeper Companion match read. Upgrade checkout is being connected.</span><Link href="/signup" className="text-link">CREATE ACCOUNT →</Link></div>}
      </article>})}</section>
      <section className="pricing-principle"><div><span>FREE</span><b>TELL ME WHAT TO DO</b></div><i>→</i><div><span>PLUS</span><b>TELL ME HOW THIS GAME IS WON</b></div><i>→</i><div><span>PRO</span><b>MODEL THE PLAYER</b></div></section>
      <section className="pricing-cta"><div className="eyebrow">TRY BEFORE YOU PAY</div><h2>OPEN THE PUBLIC COACHING DEMO.</h2><div><Link href="/demo" className="btn primary">TRY DEMO</Link><Link href="/signup" className="btn secondary">START FREE</Link></div></section>
    </main>
    <PublicFooter/>
  </>;
}
