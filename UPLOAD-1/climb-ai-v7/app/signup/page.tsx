'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Wordmark} from '@/components/UI';
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

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    setError('');setBusy(true);
    track('signup_started',{});
    try{
      const user=await authService.signUp(email,password);
      // With email confirmation on there is no session yet, which is not an error.
      if(user.id==='pending'){setCheck(true);return}
      router.push('/onboarding');
      router.refresh();
    }catch(err){
      setError(err instanceof AuthNotConfiguredError
        ?err.message
        :err instanceof Error?err.message:'Something went wrong.');
    }finally{setBusy(false)}
  };

  if(check){
    return <main className="container section">
      <Wordmark/>
      <div className="glass card form" style={{margin:'55px auto'}}>
        <div className="eyebrow">ALMOST THERE</div>
        <h1>Check your email.</h1>
        <p className="muted">
          We sent a confirmation link to <b>{email}</b>. Open it and you will land straight
          in onboarding.
        </p>
        <Link href="/dashboard" className="btn secondary">EXPLORE DEMO MODE MEANWHILE</Link>
      </div>
    </main>;
  }

  return <main className="container section">
    <Wordmark/>
    <div className="glass card form" style={{margin:'55px auto'}}>
      <div className="eyebrow">START THE HUNT</div>
      <h1>Create account</h1>

      {/* With auth off, showing a dead form with disabled buttons is a wall.
          The product works fully without an account, so send them into it. */}
      {!configured&&<>
        <p className="muted">
          Accounts are not switched on in this build — you do not need one. Go through
          onboarding and the product works exactly as it will with an account, saved to
          this browser.
        </p>
        <Link className="btn primary" href="/onboarding">START ONBOARDING</Link>
        <div className="divider"/>
        <p className="muted" style={{fontSize:12}}>
          Prefer to look around first? <Link href="/dashboard" className="text-link">SEE DEMO DATA →</Link>
        </p>
      </>}

      {configured&&<form onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" required
            value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" autoComplete="new-password" required minLength={8}
            value={password} onChange={e=>setPassword(e.target.value)}/>
          <small className="muted" style={{fontSize:11}}>At least eight characters.</small>
        </label>
        <div className="login-actions">
          <button className="btn primary" type="submit" disabled={busy||!configured}>
            {busy?'CREATING…':'CREATE ACCOUNT'}
          </button>
          <button className="btn google-btn" type="button" disabled={busy||!configured}
            onClick={()=>authService.signInWithGoogle('/onboarding').catch(e=>setError(e.message))}>
            <span className="google-g">G</span> CONTINUE WITH GOOGLE
          </button>
        </div>
      </form>}

      {error&&<div className="auth-message" role="alert">{error}</div>}

      <p className="muted">No paywall after signup. The first goal is to generate a useful mission.</p>
      <p className="muted" style={{fontSize:12}}>
        Already have an account? <Link href="/login" className="text-link">LOG IN →</Link>
      </p>
    </div>
  </main>;
}
