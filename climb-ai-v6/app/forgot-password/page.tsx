'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {PublicFooter} from '@/components/PublicFooter';
import {authService,AuthNotConfiguredError} from '@/lib/services/authService';

export default function ForgotPassword(){
  const configured=authService.configured();
  const [email,setEmail]=useState('');
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState('');
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');setBusy(true);try{await authService.requestPasswordReset(email);setSent(true)}catch(err){setError(err instanceof AuthNotConfiguredError?err.message:err instanceof Error?err.message:'Could not send the reset email.')}finally{setBusy(false)}};

  return <><main className="container section"><Wordmark/><div className="glass card form" style={{margin:'55px auto'}}><div className="eyebrow">ACCOUNT RECOVERY</div><h1>Reset your password</h1><p className="muted">Enter the email address on your OP CLIMB account. We’ll send you a secure reset link.</p>
    {!configured&&<div className="auth-message">Account recovery is not available in this build. <Link href="/demo" className="text-link">Open the public demo →</Link></div>}
    {!sent?<form onSubmit={submit}><label className="field"><span>Email</span><input className="input" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button className="btn primary" type="submit" disabled={busy||!configured}>{busy?'SENDING…':'SEND RESET LINK'}</button></form>:<div className="auth-message" role="status">If an OP CLIMB account exists for <strong>{email}</strong>, a password-reset email has been sent. Open the newest email and follow the link.</div>}
    {error&&<div className="auth-message" role="alert">{error}</div>}
    <div className="divider"/><p className="muted"><Link href="/login" className="text-link">← BACK TO LOG IN</Link></p><div className="auth-trust"><Link href="/privacy">PRIVACY</Link><Link href="/terms">TERMS</Link><Link href="/support">SUPPORT</Link></div>
  </div></main><PublicFooter compact/></>;
}
