'use client';
import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';
import {useSubscription} from '@/components/SubscriptionContext';
import {BillingPortalButton,UpgradeButton} from '@/components/BillingActions';
import {PLAN_COPY,PLAN_ENTITLEMENTS,SubscriptionTier} from '@/lib/subscription';

const positioning:Record<SubscriptionTier,{headline:string;summary:string;principle:string}>={
  FREE:{headline:'PROVE THE LOOP',summary:'See whether OP CLIMB can find something useful from your games before you pay.',principle:'FIND THE REPEAT'},
  PLUS:{headline:'UNDERSTAND THIS GAME',summary:'Unlock the complete draft read: how your team wins, how the enemy wins, and what your role must do.',principle:'READ THE GAME'},
  PRO:{headline:'MODEL HOW YOU LEARN',summary:'Turn isolated reviews into a persistent development system that remembers, tests transfer and chooses what comes next.',principle:'MODEL THE PLAYER'},
};

export default function Pricing(){
  const {tier}=useSubscription();
  return <>
    <header className="container public-topbar"><Link href="/" aria-label="OP CLIMB home"><Wordmark size="sm"/></Link><nav><Link href="/demo">DEMO</Link><Link href="/login">LOG IN</Link><Link className="btn primary" href="/signup">START FREE</Link></nav></header>
    <main className="container pricing-public">
      <section className="pricing-hero">
        <div className="eyebrow">ONE PRODUCT · THREE DEPTHS</div>
        <h1>START WITH A USEFUL ANSWER.<br/><span>PAY FOR DEEPER COACHING.</span></h1>
        <p>FREE proves the coaching loop. PLUS explains the game in front of you. PRO builds the persistent player model: Decision Twin, Scenario Memory, transfer testing and an Autonomous Curriculum.</p>
      </section>

      <section className="pricing-grid-v2">
        {(['FREE','PLUS','PRO'] as SubscriptionTier[]).map(plan=>{
          const copy=PLAN_COPY[plan];
          const position=positioning[plan];
          const current=tier===plan;
          return <article className={'pricing-card-v2 '+(plan==='PRO'?'is-pro':'')} key={plan}>
            <div className="pricing-card-top"><span>{plan}</span>{current&&<b>CURRENT</b>}</div>
            <strong className="pricing-price">{copy.price}</strong>
            <h2>{position.headline}</h2>
            <p>{position.summary}</p>
            <div className="pricing-unlocks">{PLAN_ENTITLEMENTS[plan].map(item=><div key={item}><i/> {item}</div>)}</div>
            <div style={{marginTop:18}}>
              {plan==='FREE'
                ?<Link href="/signup" className="btn primary">START FREE</Link>
                :current
                  ?<BillingPortalButton label="MANAGE CURRENT PLAN"/>
                  :<UpgradeButton tier={plan} label={tier==='FREE'?'CHOOSE '+plan:'MOVE TO '+plan}/>}
            </div>
          </article>;
        })}
      </section>

      <section className="pricing-principle">
        <div><span>FREE</span><b>{positioning.FREE.principle}</b></div><i>→</i>
        <div><span>PLUS</span><b>{positioning.PLUS.principle}</b></div><i>→</i>
        <div><span>PRO</span><b>{positioning.PRO.principle}</b></div>
      </section>

      <section className="glass card" style={{marginTop:18,padding:22}}>
        <div className="eyebrow">WHY PRO EXISTS</div>
        <h2 style={{margin:'8px 0'}}>NOT MORE CHARTS. A COACH THAT CAN MOVE YOU ON.</h2>
        <p className="muted" style={{maxWidth:900}}>PRO is where OP CLIMB stops treating every match as a separate review. It remembers recurring situations, tests whether a learned decision transfers to new champions and contexts, and advances your curriculum only when repeated evidence says the lesson holds.</p>
      </section>

      <section className="pricing-cta"><div className="eyebrow">TRY BEFORE YOU PAY</div><h2>OPEN THE PUBLIC COACHING DEMO.</h2><div><Link href="/demo" className="btn primary">TRY DEMO</Link><Link href="/signup" className="btn secondary">START FREE</Link></div></section>
    </main>
    <PublicFooter/>
  </>;
}
