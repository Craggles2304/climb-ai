'use client';
import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';
import {useSubscription} from '@/components/SubscriptionContext';
import {BillingPortalButton,UpgradeButton} from '@/components/BillingActions';
import {PLAN_COPY,TIER_RANK,type SubscriptionTier} from '@/lib/subscription';

const positioning:Record<SubscriptionTier,{purpose:string;headline:string;summary:string;principle:string;why:string}>={
  FREE:{purpose:'PROVE THE COACHING LOOP',headline:"FIND WHAT'S HOLDING YOU BACK",summary:'Get a useful review, one next-game focus and evidence that the same mistake is changing.',principle:'FIND',why:'Best if you want to see whether OP CLIMB can genuinely help before paying anything.'},
  PLUS:{purpose:'DNA PLAYER PLAN',headline:'ALWAYS KNOW WHAT TO LEARN NEXT',summary:'Your six Game DNA strands become a managed development plan: weakness → teaching point → mission → evidence → mastery → transfer test → next skill.',principle:'CLIMB',why:'Best if you want OP CLIMB to manage your actual improvement instead of leaving you with a dashboard full of analysis.'},
  PRO:{purpose:'PERSISTENT PLAYER MODEL',headline:'BUILD A COACH THAT ACTUALLY KNOWS YOU',summary:'Keep the full PLUS development loop, then add Decision Twin, Coach Memory, recurring habits, learning velocity and long-term player identity.',principle:'REMEMBER',why:'Best if you want the coach to understand how your decisions and learning patterns evolve across many games, champions and situations.'},
};

const rows=[
  ['Game review','✓','✓','✓'],
  ['One next-game focus','✓','✓','✓'],
  ['DNA Player Plan · Your Next Climb','🔒','✓','✓'],
  ['Chooses the primary skill to learn next','🔒','✓','✓'],
  ['Mission → evidence → repeat → mastery','🔒','✓','✓'],
  ['Transfer test before skill retirement','🔒','✓','✓'],
  ['Moves on when the evidence says you are ready','🔒','✓','✓'],
  ['Full 5v5 draft plan','🔒','✓','✓'],
  ['Your role in the draft','🔒','✓','✓'],
  ['Win + loss conditions','🔒','✓','✓'],
  ['Deeper economy + fight context','🔒','✓','✓'],
  ['Fix Ladder depth','2 stages','4 stages','All 5 stages'],
  ['Progress history','7 days','90 days','Long-term'],
  ['Decision Twin + Coach Memory','🔒','🔒','✓'],
  ['Recurring habit memory','🔒','🔒','✓'],
  ['Learning velocity + adaptive coaching','🔒','🔒','✓'],
  ['Skill + decision-principle connections','🔒','🔒','✓'],
  ['Long-term champion + player identity','🔒','🔒','✓'],
] as const;

export default function Pricing(){
  const {tier}=useSubscription();
  return <>
    <header className="container public-topbar"><Link href="/" aria-label="OP CLIMB home"><Wordmark size="sm"/></Link><nav><Link href="/#how-it-works">HOW IT WORKS</Link><Link href="/client">CLIENT DEMO</Link><Link href="/login">LOG IN</Link><Link className="btn primary" href="/signup">START FREE</Link></nav></header>
    <main className="container pricing-public">
      <section className="pricing-hero">
        <div className="eyebrow">START FREE · UPGRADE WHEN THE VALUE IS CLEAR</div>
        <h1>FREE FINDS IT.<br/><span>PLUS BUILDS YOUR CLIMB. PRO LEARNS YOU.</span></h1>
        <p>You do not need to pay to find out whether OP CLIMB is useful. FREE proves the coaching loop. PLUS turns Game DNA into a clear player plan that always tells you what to learn next. PRO adds the persistent player model that remembers how you play and how you learn over time.</p>
      </section>

      <section className="pricing-story" aria-label="OP CLIMB coaching depth">
        <div className="pricing-story-step"><span>FREE</span><strong>PROVE IT HELPS</strong><small>Find the repeated mistake worth fixing first and take one clear job into your next game.</small></div>
        <i className="pricing-story-arrow">→</i>
        <div className="pricing-story-step"><span>PLUS</span><strong>YOUR NEXT CLIMB</strong><small>Game DNA becomes your player plan: learn it, prove it, master it, transfer-test it and move on.</small></div>
        <i className="pricing-story-arrow">→</i>
        <div className="pricing-story-step is-pro"><span>PRO</span><strong>BUILD YOUR PERSONAL COACH</strong><small>Add Decision Twin, Coach Memory and long-term learning intelligence on top of the full PLUS development loop.</small></div>
      </section>

      <section className="pricing-grid-v2">
        {(['FREE','PLUS','PRO'] as SubscriptionTier[]).map(plan=>{
          const copy=PLAN_COPY[plan];
          const position=positioning[plan];
          const current=tier===plan;
          const included=TIER_RANK[tier]>TIER_RANK[plan];
          return <article className={'pricing-card-v2 '+(plan==='PRO'?'is-pro ':plan==='PLUS'?'is-plus ':'')+(current?'is-current':'')} key={plan}>
            <div className="pricing-card-top"><span>{plan}</span>{current&&<b>CURRENT</b>}</div>
            <strong className="pricing-price">{copy.price}</strong>
            <div className="pricing-purpose">{position.purpose}</div>
            <h2>{position.headline}</h2>
            <p className="pricing-card-outcome">{position.summary}</p>
            <div className="pricing-card-why">{position.why}</div>
            <div style={{marginTop:18}}>
              {plan==='FREE'
                ?current?<Link href="/dashboard" className="btn secondary">OPEN HOME</Link>:<span className="pricing-included">INCLUDED IN {tier}</span>
                :current
                  ?<BillingPortalButton label="MANAGE CURRENT PLAN"/>
                  :included
                    ?<span className="pricing-included">INCLUDED IN {tier}</span>
                    :<UpgradeButton tier={plan} label={plan==='PLUS'?'UNLOCK FULL GAME COACHING':'BUILD MY PLAYER MODEL'}/>}
            </div>
          </article>;
        })}
      </section>

      <section className="pricing-compare" aria-label="Compare OP CLIMB plans">
        <div className="pricing-compare-head"><div><span>WHAT CHANGES</span><strong>Compare the same journey row by row</strong></div><div><span>FREE</span><strong>Find</strong></div><div><span>PLUS</span><strong>Climb</strong></div><div><span>PRO</span><strong>Remember</strong></div></div>
        {rows.map(([name,free,plus,pro])=><div className="pricing-feature-row" key={name}>
          <div className="pricing-feature-name">{name}</div>
          {[free,plus,pro].map((value,index)=><div key={index} className={'pricing-feature-cell '+(value==='🔒'?'is-locked':'is-yes')+(index===2?' is-pro':'')}>{value}</div>)}
        </div>)}
        <div className="pricing-compare-note">PLUS is where Game DNA becomes the actual player plan: one clear next skill, evidence, mastery and a transfer check before the system moves on. PRO keeps that journey and adds the deeper Decision Twin and Coach Memory layer.</div>
      </section>

      <section className="glass card" style={{marginTop:22,padding:22}}>
        <div className="eyebrow">WHY PRO STILL EXISTS</div>
        <h2 style={{margin:'8px 0'}}>PLUS MANAGES THE PLAN. PRO BUILDS THE MODEL OF YOU.</h2>
        <p className="muted" style={{maxWidth:920}}>PLUS already tells you what to learn next and manages the evidence-backed DNA journey. PRO goes deeper: it remembers recurring situations, builds your Decision Twin, learns which coaching support helps you most, connects behaviours into broader decision principles and develops a long-term champion and player identity.</p>
      </section>

      <section className="pricing-cta"><div className="eyebrow">NOT READY TO PAY?</div><h2>START FREE. UPGRADE ONLY WHEN YOU CAN SEE WHAT YOU ARE PAYING FOR.</h2><div><Link href="/signup" className="btn primary">START FREE</Link><Link href="/client" className="btn secondary">EXPLORE THE CLIENT</Link></div></section>
    </main>
    <PublicFooter/>
  </>;
}
