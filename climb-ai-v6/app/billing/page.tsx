'use client';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useSubscription} from '@/components/SubscriptionContext';
import {BillingPortalButton,UpgradeButton} from '@/components/BillingActions';
import {PLAN_COPY,PLAN_ENTITLEMENTS} from '@/lib/subscription';
import {TierUpgradePrompt} from '@/components/TierUpgradePrompt';

export default function Billing(){
  const {tier,loading}=useSubscription();
  const copy=PLAN_COPY[tier];
  return <AppShell>
    <PageHead title="Subscription" subtitle="Your current coaching depth and the next level it unlocks."/>
    <section className="glass card" style={{padding:24}}>
      <div className="eyebrow">CURRENT COACHING DEPTH</div>
      <h1 style={{margin:'8px 0'}}>{loading?'LOADING…':tier}</h1>
      <h2 style={{margin:'0 0 8px'}}>{copy.price}</h2>
      <p className="muted" style={{maxWidth:760}}>{copy.description}</p>
      <div style={{display:'grid',gap:7,margin:'18px 0'}}>
        {PLAN_ENTITLEMENTS[tier].map(item=><div key={item}>✓ {item}</div>)}
      </div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        {tier==='FREE'&&<UpgradeButton tier="PLUS" label="UNLOCK FULL GAME COACHING"/>}
        {tier==='PLUS'&&<><UpgradeButton tier="PRO" label="BUILD MY PLAYER MODEL"/><BillingPortalButton/></>}
        {tier==='PRO'&&<BillingPortalButton/>}
        <Link className="btn secondary" href="/pricing">COMPARE ALL THREE LEVELS</Link>
      </div>
      <p className="muted" style={{fontSize:11,marginTop:14}}>Checkout and subscription management are hosted by Stripe. OP CLIMB does not store your card details. Downgrades, cancellation and payment-method changes are handled in the Stripe billing portal.</p>
    </section>
    <TierUpgradePrompt/>
  </AppShell>;
}
