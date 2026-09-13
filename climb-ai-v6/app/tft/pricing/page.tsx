'use client';
import {TftShell} from '@/components/TftShell';
import {useSubscription} from '@/components/SubscriptionContext';

const plans=[
  {tier:'FREE',headline:'BUILD THE BASELINE',summary:'TFT match history, core placement trends and one active coaching focus.',features:['Recent ranked TFT import','Average placement + top-4 trend','One primary post-game fix','Static preparation only']},
  {tier:'PLUS',headline:'READ THE PATTERN',summary:'A separate TFT subscription for deeper board, economy and comp-pattern review.',features:['Longer TFT history','Economy / stabilisation pattern review','Comp + augment grouping','Deeper TFT learning plan']},
  {tier:'PRO',headline:'MODEL THE TACTICIAN',summary:'Persistent TFT coaching memory across sets and repeated decision patterns.',features:['Long-term tactician profile','Set-to-set pattern memory','Advanced comp/augment context','Deepest post-game coaching']},
] as const;

export default function TftPricing(){
  const {tftTier,lolTier}=useSubscription();
  return <TftShell><main className="container section">
    <div className="eyebrow">SEPARATE PRODUCT ACCESS</div><h1>TFT HAS ITS OWN SUBSCRIPTION.</h1><p className="muted" style={{maxWidth:760}}>League access does not automatically unlock TFT paid coaching, and TFT access does not unlock League paid coaching. A future bundle can grant both entitlements without merging the products.</p>
    <div className="glass card" style={{marginTop:18,display:'flex',gap:24,flexWrap:'wrap'}}><div><small className="muted">LEAGUE ACCESS</small><h3>{lolTier}</h3></div><div><small className="muted">TFT ACCESS</small><h3>{tftTier}</h3></div></div>
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16,marginTop:18}}>{plans.map(plan=><article key={plan.tier} className={`glass card ${plan.tier==='PRO'?'is-pro':''}`}>
      <div className="eyebrow">TFT {plan.tier}</div><h2>{plan.headline}</h2><p className="muted">{plan.summary}</p><div style={{display:'grid',gap:8,margin:'18px 0'}}>{plan.features.map(f=><div key={f}>✓ {f}</div>)}</div>
      {tftTier===plan.tier?<button className="btn secondary" disabled>CURRENT TFT PLAN</button>:plan.tier==='FREE'?<button className="btn secondary" disabled>FREE TIER</button>:<div><button className="btn primary" disabled>TFT CHECKOUT COMING</button><p className="muted" style={{fontSize:11}}>Pricing and Stripe checkout will be attached to this TFT entitlement separately before paid launch.</p></div>}
    </article>)}</section>
    <section className="glass card" style={{marginTop:18}}><div className="eyebrow">BUNDLE-READY</div><h3>LOL + TFT CAN BECOME ONE OPTIONAL BUNDLE.</h3><p className="muted">The database stores one entitlement per product, so a bundle can simply grant both. That keeps cancellation, upgrades and future pricing clean.</p></section>
  </main></TftShell>;
}
