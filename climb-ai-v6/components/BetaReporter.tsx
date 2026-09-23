'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {track} from '@/lib/analytics';

export function BetaReporter(){
  const path=usePathname();
  const [tester,setTester]=useState<{cohort:number;status:string}|null>(null);
  const [open,setOpen]=useState(false);
  const [kind,setKind]=useState<'BUG'|'FRICTION'|'COACHING'>('FRICTION');
  const [severity,setSeverity]=useState<'BLOCKER'|'HIGH'|'MEDIUM'|'LOW'>('MEDIUM');
  const [summary,setSummary]=useState('');
  const [details,setDetails]=useState('');
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    let cancelled=false;
    fetch('/api/beta/report',{cache:'no-store'})
      .then(r=>r.json())
      .then(body=>{if(!cancelled)setTester(body.tester??null)})
      .catch(()=>{});
    return()=>{cancelled=true};
  },[]);

  if(tester?.status!=='ACTIVE')return null;

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');setSent(false);
    try{
      const response=await fetch('/api/beta/report',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({kind,severity,surface:path,summary,details}),
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Could not submit beta report.');
      track('beta_report_submitted',{kind,severity,surface:path,cohort:tester.cohort});
      setSummary('');setDetails('');setSent(true);
    }catch(raw){setError(raw instanceof Error?raw.message:'Could not submit beta report.')}
    finally{setBusy(false)}
  };

  return <>
    <button className="beta7-fab" onClick={()=>{setOpen(true);setSent(false);setError('')}}>
      FOUNDING BETA · C{tester.cohort} · REPORT
    </button>
    {open&&<div className="beta7-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <section className="beta7-modal glass" role="dialog" aria-modal="true" aria-label="Report Founding Beta issue">
        <div className="beta7-modal-head"><div><div className="eyebrow">FOUNDING BETA REPORT</div><h2>What got in your way?</h2></div><button className="btn secondary" onClick={()=>setOpen(false)}>CLOSE</button></div>
        <p className="muted">This is tied to your beta account, the current page and the exact production build so the founder can reproduce it.</p>
        <form onSubmit={submit}>
          <div className="grid two">
            <label className="field"><span>Type</span><select className="input" value={kind} onChange={e=>setKind(e.target.value as any)}><option value="FRICTION">Friction / confusing</option><option value="BUG">Bug / broken</option><option value="COACHING">Coaching felt wrong</option></select></label>
            <label className="field"><span>Severity</span><select className="input" value={severity} onChange={e=>setSeverity(e.target.value as any)}><option value="BLOCKER">Blocker</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label>
          </div>
          <label className="field"><span>Short summary</span><input className="input" required minLength={3} maxLength={240} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="Example: Companion connected but never started recording"/></label>
          <label className="field"><span>What happened?</span><textarea className="input" rows={5} maxLength={4000} value={details} onChange={e=>setDetails(e.target.value)} placeholder="What you expected, what happened, and what you tried."/></label>
          <div className="hero-actions"><button className="btn primary" disabled={busy||summary.trim().length<3}>{busy?'SENDING…':'SEND BETA REPORT →'}</button></div>
        </form>
        {sent&&<div className="auth-message" role="status">Report saved. Thank you — this is now in the founder triage queue.</div>}
        {error&&<div className="auth-message" role="alert">{error}</div>}
      </section>
    </div>}
  </>;
}
