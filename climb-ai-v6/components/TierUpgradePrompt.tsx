'use client';
import Link from 'next/link';
import {useSubscription} from './SubscriptionContext';
import {UpgradeButton} from './BillingActions';

export function TierUpgradePrompt(){
  const {tier}=useSubscription();

  if(tier==='PRO'){
    return <section className="tier-unlock-card is-complete">
      <div className="tier-unlock-kicker"><span>PRO · FULL PLAYER MODEL ACTIVE</span><b>YOU ARE AT THE DEEPEST COACHING LAYER</b></div>
      <h3>Your DNA plan is active — and your coach can now learn you as well.</h3>
      <p>PLUS already manages Your Next Climb. PRO adds the persistent player model underneath it: recurring-habit memory, Decision Twin, learning velocity, principle connections and long-term identity.</p>
      <div className="tier-unlock-preview">
        <div><span>REMEMBERS</span><strong>Recurring habits + scenarios</strong></div>
        <div><span>LEARNS</span><strong>Decision Twin + coaching velocity</strong></div>
        <div><span>CONNECTS</span><strong>Skills + deeper principles</strong></div>
      </div>
      <Link className="text-link" href="/ilp">OPEN MY DEVELOPMENT PATH →</Link>
    </section>;
  }

  const plus=tier==='FREE';
  const target=plus?'PLUS':'PRO';
  const title=plus?'Turn your Game DNA into a real player plan.':'Add a persistent model of how you play and learn.';
  const body=plus
    ?'PLUS unlocks YOUR NEXT CLIMB: OP CLIMB selects the primary DNA weakness, teaches one rule, gives you the mission, checks the evidence, repeats it to mastery, transfer-tests it and then moves you on.'
    :'PRO keeps the complete DNA player plan and adds Decision Twin, Coach Memory, recurring-habit memory, learning velocity and long-term player identity.';
  const cells=plus
    ?[['NEXT CLIMB','One primary skill to learn'],['PROVE IT','Mission → evidence → mastery'],['MOVE ON','Transfer test → next skill']]
    :[['REMEMBERS','Decision Twin + Coach Memory'],['ADAPTS','Learning velocity + support'],['CONNECTS','Skills + player identity']];

  return <section className="tier-unlock-card">
    <div className="tier-unlock-kicker"><span>NEXT COACHING DEPTH · {target}</span><b>{plus?'BUILD THE CLIMB':'MODEL THE PLAYER'}</b></div>
    <h3>{title}</h3>
    <p>{body}</p>
    <div className="tier-unlock-preview">{cells.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="tier-unlock-actions">
      <UpgradeButton tier={target} label={plus?'UNLOCK MY DNA PLAYER PLAN':'BUILD MY PLAYER MODEL'}/>
      <Link className="text-link" href="/pricing">COMPARE ALL THREE LEVELS →</Link>
    </div>
  </section>;
}
