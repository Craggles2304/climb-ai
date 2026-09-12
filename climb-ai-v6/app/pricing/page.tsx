'use client';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useSubscription} from '@/components/SubscriptionContext';
import {PLAN_COPY,SubscriptionTier} from '@/lib/subscription';

const plans:{n:SubscriptionTier;headline:string;features:string[]}[]=[
  {n:'FREE',headline:'Find the obvious leak',features:['OP Match Grade + custom BROKEN → OVERPOWERED scale','Fight Selection + Death Control','Basic CS / match review','First 2 Fix Ladder stages','Strength / weakness timestamps','3 detailed reviews per week','7-day progress view']},
  {n:'PLUS',headline:'Understand your decisions',features:['Everything in Free','Unspent Gold Exposure','Red-State Fight Rate','Chain-Death Rate','Thrown Advantage Rate','Underdog Conversion','Power Window Conversion','Resource Conversion','First 4 Fix Ladder stages','How you win / how you lose each reviewed fight','90-day analytics']},
  {n:'PRO',headline:'Build a player model',features:['Everything in Plus','All 5 Fix Ladder stages','Lead Protection','Reset Quality + Power-Spike Conversion as richer post-game data lands','Objective Readiness + Farm-vs-Fight analysis','Repeat Threat + Opponent Adaptation','Carry Preservation + Survival Value','Champion Identity coaching','Persistent Decision Fingerprint','Historical OP Leak Rate + Recovery trends','Full counterfactual “better decision” coaching','Long-term history + deepest ILP adaptation']},
];

export default function Pricing(){
  const {tier}=useSubscription();
  return <AppShell><PageHead title="Subscription" subtitle="Pay for deeper diagnosis, longer memory and harder coaching — not just more charts."/>
    <div className="grid three">{plans.map(plan=>{const copy=PLAN_COPY[plan.n];const current=tier===plan.n;return <div className="glass card" key={plan.n} style={{position:'relative',borderColor:current?'rgba(160,255,80,.42)':undefined}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><div className="eyebrow">{plan.n}</div>{current&&<span style={{fontSize:9,fontWeight:900,letterSpacing:'.1em'}}>CURRENT</span>}</div>
      <div className="big-number" style={{fontSize:38}}>{copy.price}</div><h3 style={{marginTop:8}}>{plan.headline}</h3><p className="muted" style={{fontSize:12}}>{copy.description}</p>
      <ul className="muted">{plan.features.map(x=><li key={x} style={{margin:'9px 0'}}>{x}</li>)}</ul>
      <button className={`btn ${plan.n==='PLUS'?'primary':'secondary'}`} disabled={current}>{current?'CURRENT PLAN':plan.n==='FREE'?'FREE PLAN':'CHOOSE '+plan.n}</button>
    </div>})}</div>
    <div className="glass card" style={{marginTop:18}}><div className="eyebrow">HOW OP CLIMB TIERS WORK</div><h2>The coaching gets more sophisticated as the tier rises.</h2><p className="muted">FREE should still be useful enough to prove the product. PLUS unlocks the economic and fight-state leaks that explain a large share of avoidable losses. PRO is the long-term learning system: it combines games, builds a Decision Fingerprint, spots recurring patterns and pushes those patterns into the adaptive ILP.</p></div>
    <div className="glass card" style={{marginTop:18}}><div className="eyebrow">FOUNDING MEMBER</div><h2>Configured from admin, never hard-coded into entitlement logic.</h2><p className="muted">Founders can be granted a temporary PRO entitlement through the same central tier system. The billing provider will become the source of truth once Checkout/webhooks are connected.</p></div>
  </AppShell>;
}
