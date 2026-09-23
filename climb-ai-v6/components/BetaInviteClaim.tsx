'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';

export function BetaInviteClaim({token}:{token:string}){
  const router=useRouter();
  const [signedIn,setSignedIn]=useState<boolean|null>(null);
  const [tester,setTester]=useState<{cohort:number;status:string}|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    fetch('/api/beta/claim',{cache:'no-store'})
      .then(r=>r.json())
      .then(body=>{setSignedIn(Boolean(body.signedIn));setTester(body.tester??null)})
      .catch(()=>setSignedIn(false));
  },[]);

  const claim=async()=>{
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/beta/claim',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Could not claim your beta place.');
      setTester({cohort:Number(body.cohort),status:'ACTIVE'});
    }catch(raw){setError(raw instanceof Error?raw.message:'Could not claim your beta place.')}
    finally{setBusy(false)}
  };

  const signup=`/signup?beta=${encodeURIComponent(token)}`;
  const login=`/login?next=${encodeURIComponent('/beta/join?token='+token)}`;

  return <div className="glass card" style={{maxWidth:760,margin:'64px auto',padding:'clamp(26px,5vw,48px)'}}>
    <div className="eyebrow">FOUNDING BETA · CONTROLLED COHORT</div>
    <h1 style={{fontSize:'clamp(38px,6vw,66px)',lineHeight:.95,margin:'12px 0'}}>You have a beta place.</h1>
    <p className="muted" style={{fontSize:16,lineHeight:1.65}}>Founding Beta is the real-player validation phase. Your matches, friction reports and coaching feedback help decide what OP CLIMB fixes before the cohort expands.</p>

    {signedIn===null&&<p className="muted">CHECKING YOUR ACCOUNT…</p>}
    {tester?.status==='ACTIVE'&&<div style={{marginTop:22,padding:18,border:'1px solid rgba(214,255,47,.28)'}}>
      <span className="label">BETA ACCESS ACTIVE</span>
      <h2 style={{margin:'7px 0'}}>Cohort {tester.cohort}</h2>
      <p className="muted">Your account is now part of the controlled Founding Beta.</p>
      <div className="hero-actions"><Link className="btn primary" href="/onboarding">CONTINUE INTO OP CLIMB →</Link><Link className="btn secondary" href="/dashboard">GO TO HOME</Link></div>
    </div>}

    {signedIn===true&&!tester&&<div className="hero-actions"><button className="btn primary" disabled={busy} onClick={claim}>{busy?'CLAIMING…':'CLAIM MY FOUNDING BETA PLACE →'}</button></div>}

    {signedIn===false&&<div className="hero-actions">
      <Link className="btn primary" href={signup}>CREATE ACCOUNT & KEEP MY PLACE →</Link>
      <Link className="btn secondary" href={login}>I ALREADY HAVE AN ACCOUNT</Link>
    </div>}

    {error&&<div className="auth-message" role="alert">{error}</div>}
    <p className="muted" style={{fontSize:11,marginTop:22}}>Invite links are one-time, expire automatically and may be locked to the invited email address.</p>
  </div>;
}
