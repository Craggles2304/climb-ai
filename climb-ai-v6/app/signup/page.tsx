'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';
import {authService,AuthNotConfiguredError} from '@/lib/services/authService';
import {track} from '@/lib/analytics';

export default function Signup(){
  const router=useRouter();
  const configured=authService.configured();
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [check,setCheck]=useState(false);
  const betaNext=()=>{if(typeof window==='undefined')return '/onboarding';const token=new URLSearchParams(window.location.search).get('beta');return token&&/^[A-Za-z0-9_-]{20,160}$/.test(token)?`/beta/join?token=${encodeURIComponent(token)}`:'/onboarding'};

  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');setBusy(true);track('signup_started',{});try{const next=betaNext();const user=await authService.signUp(email,password,next);if(user.id==='pending'){setCheck(true);return}router.push(next);router.refresh()}catch(err){setError(err instanceof AuthNotConfiguredError?err.message:err instanceof Error?err.message:'Something went wrong.')}finally{setBusy(false)}};

  if(check)return <><main className="container section"><Wordmark/><div className="glass card form" style={{margin:'55px auto'}}><div className="eyebrow">ALMOST THERE</div><h1>Check your email.</h1><p className="muted">We sent a confirmation link to <b>{email}</b>. Open it and you will land straight in onboarding.</p><Link href="/demo" className="btn secondary">EXPLORE THE PUBLIC DEMO</Link><div className="auth-trust"><Link href="/privacy">PRIVACY</Link><Link href="/terms">TERMS</Link><Link href="/support">SUPPORT</Link></div></div></main><PublicFooter compact/></>;

  return <><main className="container section auth-page"><Wordmark/><div className="auth-signup-shell">
    <section className="auth-value-panel" aria-labelledby="signup-value-title">
      <div className="eyebrow">YOUR FIRST WIN</div>
      <h2 id="signup-value-title">ONE USEFUL JOB FOR YOUR NEXT GAME.</h2>
      <p>Connect your Riot ID after signup. OP CLIMB looks for the repeated decision costing you games and turns it into one clear focus.</p>
      <div className="auth-value-list">
        <div><span>01</span><strong>CREATE YOUR FREE ACCOUNT</strong><small>No card required.</small></div>
        <div><span>02</span><strong>CONNECT YOUR RIOT ID</strong><small>Your first setup takes about two minutes.</small></div>
        <div><span>03</span><strong>GET YOUR NEXT-GAME FOCUS</strong><small>A clear action—not another wall of statistics.</small></div>
      </div>
      <div className="auth-proof-strip"><span>LAST 20 RANKED GAMES</span><span>ONE PERSONAL FOCUS</span><span>START FREE</span></div>
    </section>
    <div className="glass card form auth-signup-form"><div className="eyebrow">START YOUR CLIMB</div><h1>Create account</h1>
      {!configured&&<><p className="muted">Accounts are not switched on in this build. You can still inspect the product without signing up.</p><Link className="btn primary" href="/demo">OPEN PUBLIC DEMO</Link><div className="divider"/></>}
      {configured&&<form onSubmit={submit}><label className="field"><span>Email</span><input className="input" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label className="field"><span>Password</span><input className="input" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/><small className="muted" style={{fontSize:11}}>At least eight characters.</small></label><div className="login-actions"><button className="btn primary" type="submit" disabled={busy||!configured}>{busy?'CREATING…':'CREATE FREE ACCOUNT'}</button><button className="btn google-btn" type="button" disabled={busy||!configured} onClick={()=>authService.signInWithGoogle(betaNext()).catch(e=>setError(e.message))}><span className="google-g">G</span> CONTINUE WITH GOOGLE</button></div></form>}
      {error&&<div className="auth-message" role="alert">{error}</div>}
      <p className="auth-reassurance">Free to start · No card required · Cancel upgrades anytime</p>
      <p className="muted" style={{fontSize:12}}>Already have an account? <Link href="/login" className="text-link">LOG IN →</Link></p><p className="muted" style={{fontSize:12}}>Want to see the product first? <Link href="/demo" className="text-link">OPEN DEMO →</Link></p>
      <div className="auth-trust"><Link href="/privacy">PRIVACY</Link><Link href="/terms">TERMS</Link><Link href="/support">SUPPORT</Link></div>
    </div>
  </div></main><PublicFooter compact/></>;
}
