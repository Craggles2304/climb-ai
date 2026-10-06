'use client';
import Link from 'next/link';
import {TftShell} from '@/components/TftShell';
import {useSubscription} from '@/components/SubscriptionContext';
import {PLAN_COPY} from '@/lib/subscription';

export default function TftPricing(){
  const {tier}=useSubscription();
  return <TftShell><main className="container section"><div className="eyebrow">ONE OP CLIMB MEMBERSHIP</div><h1>LEAGUE + TFT. ONE PLAN.</h1><p className="muted">Your existing OP CLIMB subscription applies to both games. There is no separate TFT checkout.</p><section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16,marginTop:20}}>{(['FREE','PLUS','PRO'] as const).map(name=><article className="glass card" key={name}><div className="eyebrow">{name}</div><h2>{PLAN_COPY[name].price}</h2><p>{PLAN_COPY[name].description}</p><p className="muted">League and TFT access included.</p>{tier===name?<b>CURRENT PLAN</b>:<Link className="btn secondary" href="/pricing">VIEW SHARED PLANS</Link>}</article>)}</section></main></TftShell>;
}
