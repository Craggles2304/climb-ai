'use client';
import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';
import {useSubscription} from '@/components/SubscriptionContext';
import {BillingPortalButton,UpgradeButton} from '@/components/BillingActions';
import {PLAN_COPY,TIER_RANK,type SubscriptionTier} from '@/lib/subscription';

const positioning:Record<SubscriptionTier,{purpose:string;headline:string;summary:string;principle:string;why:string}>={
  FREE:{purpose:'PROVE THE COACHING LOOP',headline:"FIND WHAT'S HOLDING YOU BACK",summary:'Get a useful review, one next-game focus and evidence that the same mistake is changing.',principle:'FIND',why:'Best if you want to see whether OP CLIMB can genuinely help before paying anything.'},
  PLUS:{purpose:'GAME-BY-GAME COACHING',headline:'UNDERSTAND THE WHOLE MATCH',summary:'Add the full 5v5 draft, both win conditions, your role and deeper fight, reset and economy context.',principle:'UNDERSTAND',why:'Best if you want each game explained properly, but do not yet need a long-term player model.'},
  PRO:{purpose:'LONG-TERM PLAYER DEVELOPMENT',headline:'BUILD A COACH THAT ACTUALLY KNOWS YOU',summary:'Turn separate reviews into persistent memory that tests learning, transfer and what should come next.',principle:'DEVELOP',why:'Best if you want OP CLIMB to learn your recurring decisions and manage your development over time.'},
};

const rows=[
  ['Game review','✓','✓','✓'],
  ['One next-game focus','✓','✓','✓'],
  ['Fix Ladder depth','2 stages','4 stages','All 5 stages'],
  ['Progress history','7 days','90 days','Long-term'],
  ['Full 5v5 draft plan','🔒','✓','✓'],
  ['Your role in the draft','🔒','✓','✓'],
  ['Win + loss conditions','🔒','✓','✓'],
  ['Deeper economy + fight context','🔒','✓','✓'],
  ['Remembers recurring habits','🔒','🔒','✓'],
  ['Learns whether you really fixed it','🔒','🔒','✓'],
  ['Tests the fix in new situations','🔒','🔒','✓'],
  ['Connects skills to deeper principles','🔒','🔒','✓'],
  ['Chooses what you should learn next','🔒','🔒','✓'],
] as const;

export default function Pricing(){
  const {tier}=useSubscription();
  return <>
    <header className="container public-topbar"><Link href="/" aria-label="OP CLIMB home"><Wordmark size="sm"/></Link><nav><Link href="/#how-it-works">HOW IT WORKS</Link><Link href="/client">CLIENT DEMO</Link><Link href="/login">LOG IN</Link><Link className="btn primary" href="/signup">START FREE</Link></nav></header>
    <main className="container pricing-public">
      <section className="pricing-hero">
        <div className="eyebrow">START FREE · UPGRADE WHEN THE VALUE IS CLEAR</div>
        <h1>FREE FINDS IT.<br/><span>PLUS EXPLAINS IT. PRO DEVELOPS IT.</span></h1>
        <p>You do not need to pay to find out whether OP CLIMB is useful. FREE proves the coaching loop. PLUS gives you deeper game-by-game understanding. PRO turns those separate reviews into a coach that learns your development over time.</p>
      </section>

      <section className="pricing-story" aria-label="OP CLIMB coaching depth">
        <div className="pricing-story-step"><span>FREE</span><strong>PROVE IT HELPS</strong><small>Find the repeated mistake worth fixing first and take one clear job into your next game.</small></div>
        <i className="pricing-story-arrow">→</i>
        <div className="pricing-story-step"><span>PLUS</span><strong>UNDERSTAND EVERY GAME</strong><small>See the full draft, both win conditions, your role and the deeper context behind the review.</small></div>
        <i className="pricing-story-arrow">→</i>
        <div className="pricing-story-step is-pro"><span>PRO</span><strong>BUILD YOUR PERSONAL COACH</strong><small>Remember patterns, test whether learning transfers and move your development forward only when the evidence says you are ready.</small></div>
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
                ?current?<Link href="/dashboard" className="btn secondary">OPEN MY CLIMB</Link>:<span className="pricing-included">INCLUDED IN {tier}</span>
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
        <div className="pricing-compare-head"><div><span>WHAT CHANGES</span><strong>Compare the same journey row by row</strong></div><div><span>FREE</span><strong>Find</strong></div><div><span>PLUS</span><strong>Understand</strong></div><div><span>PRO</span><strong>Develop</strong></div></div>
        {rows.map(([name,free,plus,pro])=><div className="pricing-feature-row" key={name}>
          <div className="pricing-feature-name">{name}</div>
          {[free,plus,pro].map((value,index)=><div key={index} className={'pricing-feature-cell '+(value==='🔒'?'is-locked':'is-yes')+(index===2?' is-pro':'')}>{value}</div>)}
        </div>)}
        <div className="pricing-compare-note">Branded systems such as Decision Twin, Scenario Memory, Skill Transfer and Autonomous Curriculum sit underneath the PRO outcomes above. You are paying for a coach that remembers and develops you—not for more dashboard clutter.</div>
      </section>

      <section className="glass card" style={{marginTop:22,padding:22}}>
        <div className="eyebrow">WHY PRO EXISTS</div>
        <h2 style={{margin:'8px 0'}}>THE END GOAL IS NOT MORE ANALYSIS. IT IS A COACH THAT CAN MOVE ON WITH YOU.</h2>
        <p className="muted" style={{maxWidth:920}}>PRO is where OP CLIMB stops treating every match as a separate review. It can remember recurring situations, test whether a learned decision survives a different champion or pressure pattern, connect different behaviours to a shared decision principle and advance your curriculum only when direct evidence supports it.</p>
      </section>

      <section className="pricing-cta"><div className="eyebrow">NOT READY TO PAY?</div><h2>START FREE. UPGRADE ONLY WHEN YOU CAN SEE WHAT YOU ARE PAYING FOR.</h2><div><Link href="/signup" className="btn primary">START FREE</Link><Link href="/client" className="btn secondary">EXPLORE THE CLIENT</Link></div></section>
    </main>
    <PublicFooter/>
  </>;
}
