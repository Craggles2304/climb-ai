'use client';
import {useState,Suspense} from 'react';
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {Wordmark} from '@/components/UI';
import {authService,AuthNotConfiguredError} from '@/lib/services/authService';
import {track} from '@/lib/analytics';

function LoginForm(){
  const router=useRouter();
  const params=useSearchParams();
  const next=params.get('next')||'/dashboard';
  const configured=authService.configured();

  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [resent,setResent]=useState(false);
  const [resendBusy,setResendBusy]=useState(false);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    setError('');setResent(false);setBusy(true);
    try{
      await authService.signIn(email,password);
      router.push(next);
      router.refresh();
    }catch(err){
      setError(err instanceof AuthNotConfiguredError
        ?err.message
        :err instanceof Error?err.message:'Something went wrong.');
    }finally{setBusy(false)}
  };

  const google=async()=>{
    setError('');setBusy(true);
    try{await authService.signInWithGoogle(next)}
    catch(err){
      setError(err instanceof Error?err.message:'Something went wrong.');
      setBusy(false);
    }
  };

  const resend=async()=>{
    if(!email)return setError('Enter the email address you signed up with first.');
    setError('');setResent(false);setResendBusy(true);
    try{
      await authService.resendConfirmation(email);
      setResent(true);
    }catch(err){
      setError(err instanceof Error?err.message:'Could not resend the confirmation email.');
    }finally{setResendBusy(false)}
  };

  const needsConfirmation=error.toLowerCase().includes('confirm your email');

  return <main className="container section">
    <Wordmark/>
    <div className="glass card form" style={{margin:'55px auto'}}>
      <div className="eyebrow">WELCOME BACK</div>
      <h1>Log in</h1>

      {!configured&&<div className="auth-message">
        Accounts are not switched on in this build. Everything works in demo mode —
        <Link href="/dashboard" className="text-link"> go straight in</Link>.
      </div>}

      <form onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" required
            value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" autoComplete="current-password" required
            value={password} onChange={e=>setPassword(e.target.value)}/>
        </label>
        <div className="login-actions">
          <button className="btn primary" type="submit" disabled={busy||!configured}>
            {busy?'SIGNING IN…':'LOG IN'}
          </button>
          <button className="btn google-btn" type="button" onClick={google} disabled={busy||!configured}>
            <span className="google-g">G</span> CONTINUE WITH GOOGLE
          </button>
        </div>
      </form>

      {error&&<div className="auth-message" role="alert">{error}</div>}
      {needsConfirmation&&<button className="btn secondary" type="button" onClick={resend} disabled={resendBusy||!email} style={{marginTop:10}}>
        {resendBusy?'SENDING…':'RESEND CONFIRMATION EMAIL'}
      </button>}
      {resent&&<div className="auth-message" role="status">New confirmation email sent. Open the newest email; it will return you to OVERPOWERED onboarding.</div>}

      <div className="divider"/>
      <p className="muted">
        No account? <Link href="/signup" className="text-link">CREATE ONE →</Link>
      </p>
      <p className="muted" style={{fontSize:12}}>
        Trying it out? <Link href="/dashboard" className="text-link"
          onClick={()=>track('landing_view',{via:'demo_from_login'})}>ENTER DEMO MODE →</Link>
      </p>
    </div>
  </main>;
}

export default function Login(){
  return <Suspense fallback={null}><LoginForm/></Suspense>;
}
