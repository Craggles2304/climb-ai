'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Wordmark} from '@/components/UI';
import {authService,AuthNotConfiguredError} from '@/lib/services/authService';

export default function ResetPassword(){
  const configured=authService.configured();
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [error,setError]=useState('');

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    setError('');
    if(password.length<8)return setError('Use at least eight characters for your new password.');
    if(password!==confirm)return setError('The two passwords do not match.');
    setBusy(true);
    try{
      await authService.updatePassword(password);
      setDone(true);
    }catch(err){
      setError(err instanceof AuthNotConfiguredError
        ?err.message
        :err instanceof Error?err.message:'Could not update your password.');
    }finally{setBusy(false)}
  };

  return <main className="container section">
    <Wordmark/>
    <div className="glass card form" style={{margin:'55px auto'}}>
      <div className="eyebrow">SECURE YOUR ACCOUNT</div>
      <h1>Choose a new password</h1>

      {!configured&&<div className="auth-message">Account recovery is not available in this build.</div>}

      {!done?<form onSubmit={submit}>
        <label className="field">
          <span>New password</span>
          <input className="input" type="password" autoComplete="new-password" required minLength={8}
            value={password} onChange={e=>setPassword(e.target.value)}/>
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <input className="input" type="password" autoComplete="new-password" required minLength={8}
            value={confirm} onChange={e=>setConfirm(e.target.value)}/>
        </label>
        <button className="btn primary" type="submit" disabled={busy||!configured}>
          {busy?'UPDATING…':'UPDATE PASSWORD'}
        </button>
      </form>:<div className="auth-message" role="status">
        Your OP CLIMB password has been updated successfully.
      </div>}

      {error&&<div className="auth-message" role="alert">{error}</div>}

      <div className="divider"/>
      <p className="muted">
        {done?<Link href="/dashboard" className="text-link">CONTINUE TO OP CLIMB →</Link>
          :<Link href="/login" className="text-link">← BACK TO LOG IN</Link>}
      </p>
    </div>
  </main>;
}
