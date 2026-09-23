'use client';
import Link from 'next/link';
import {useSubscription} from './SubscriptionContext';
import {UpgradeButton} from './BillingActions';

export function TierUpgradePrompt(){
  const {tier}=useSubscription();

  if(tier==='PRO'){
    return <section className="tier-unlock-card is-complete">
      <div className="tier-unlock-kicker"><span>PRO · FULL PLAYER MODEL ACTIVE</span><b>YOU ARE AT THE DEEPEST COACHING LAYER</b></div>
      <h3>Your coach can now remember, test and move you on.</h3>
      <p>OP CLIMB can connect recurring situations across games, test whether a fix transfers to new conditions and choose the next evidence-backed lesson instead of treating every match as a fresh start.</p>
      <div className="tier-unlock-preview">
        <div><span>REMEMBERS</span><strong>Recurring habits</strong></div>
        <div><span>TESTS</span><strong>Transfer + principles</strong></div>
        <div><span>MOVES ON</span><strong>Autonomous curriculum</strong></div>
      </div>
      <Link className="text-link" href="/ilp">OPEN MY DEVELOPMENT PATH →</Link>
    </section>;
  }

  const plus=tier==='FREE';
  const target=plus?'PLUS':'PRO';
  const title=plus?'Understand the whole game, not just the mistake.':'Turn separate reviews into a coach that actually knows you.';
  const body=plus
    ?'PLUS unlocks the full 5v5 draft read: how your team wins, how the enemy wins, what your role should do and the deeper economy and fight context around the mistake.'
    :'PRO remembers recurring situations across games, learns whether your fixes genuinely hold, tests them under new conditions and chooses what you should learn next.';
  const cells=plus
    ?[['FULL DRAFT','Win + loss conditions'],['YOUR ROLE','What this comp needs from you'],['MORE CONTEXT','90-day game history']]
    :[['REMEMBERS','Decision Twin + Scenario Memory'],['PROVES','Transfer + principle tests'],['DEVELOPS','Chooses the next lesson']];

  return <section className="tier-unlock-card">
    <div className="tier-unlock-kicker"><span>NEXT COACHING DEPTH · {target}</span><b>{plus?'READ THE GAME':'MODEL THE PLAYER'}</b></div>
    <h3>{title}</h3>
    <p>{body}</p>
    <div className="tier-unlock-preview">{cells.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="tier-unlock-actions">
      <UpgradeButton tier={target} label={plus?'UNLOCK FULL GAME COACHING':'BUILD MY PLAYER MODEL'}/>
      <Link className="text-link" href="/pricing">COMPARE ALL THREE LEVELS →</Link>
    </div>
  </section>;
}
