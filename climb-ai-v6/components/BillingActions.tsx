'use client';
import {useState} from 'react';
import {useSubscription} from '@/components/SubscriptionContext';
import {track} from '@/lib/analytics';

export function UpgradeButton({tier,label,className='btn primary'}:{tier:'PLUS'|'PRO';label?:string;className?:string}){
  const {tier:current}=useSubscription();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const click=async()=>{
    if(busy)return;
    setBusy(true);setError('');
    track('checkout_started',{product:'LOL',targetTier:tier,currentTier:current});
    try{
      const response=await fetch('/api/billing/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tier})});
      const body=await response.json().catch(()=>({}));
      if(response.status===401){window.location.assign('/login?next=/pricing');return}
      if(!response.ok||!body?.url)throw new Error(body?.error||'Could not open checkout.');
      window.location.assign(body.url);
    }catch(err){setError(err instanceof Error?err.message:'Could not open checkout.');setBusy(false)}
  };
  const defaultLabel=current==='FREE'?'UPGRADE TO '+tier:'MANAGE PLAN';
  return <div>
    <button className={className} onClick={click} disabled={busy}>{busy?'OPENING…':label??defaultLabel}</button>
    {error&&<small className="muted" style={{display:'block',marginTop:7}}>{error}</small>}
  </div>;
}

export function BillingPortalButton({label='MANAGE SUBSCRIPTION',className='btn secondary'}:{label?:string;className?:string}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const click=async()=>{
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/billing/portal',{method:'POST'});
      const body=await response.json().catch(()=>({}));
      if(!response.ok||!body?.url)throw new Error(body?.error||'Could not open billing portal.');
      window.location.assign(body.url);
    }catch(err){setError(err instanceof Error?err.message:'Could not open billing portal.');setBusy(false)}
  };
  return <div><button className={className} onClick={click} disabled={busy}>{busy?'OPENING…':label}</button>{error&&<small className="muted" style={{display:'block',marginTop:7}}>{error}</small>}</div>;
}

export function ProMoatGate({compact=false}:{compact?:boolean}){
  return <div className="glass card" style={{padding:compact?16:24}}>
    <div className="eyebrow">PRO · DEVELOPS THE PLAYER</div>
    <h3 style={{margin:'6px 0'}}>This is where OP CLIMB stops treating every game as a separate review.</h3>
    <p className="muted">PRO remembers recurring habits, checks whether a fix survives new situations and moves you onto the next evidence-backed lesson when the current one is genuinely learned.</p>
    <UpgradeButton tier="PRO" label="BUILD MY PLAYER MODEL"/>
  </div>;
}
