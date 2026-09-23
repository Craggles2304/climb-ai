'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

type Invite={id:string;email:string|null;cohort:number;status:string;expiresAt:string;claimedAt:string|null};
type Tester={userId:string;gameName:string|null;tagline:string|null;email:string|null;cohort:number;status:string;joinedAt:string;lastActivityAt:string|null};
type Report={id:string;player:string;kind:string;severity:string;surface:string;summary:string;details:string|null;buildCommit:string|null;webVersion:string|null;status:string;createdAt:string};

export function BetaCohortConsole({snapshot}:{snapshot:{invites:Invite[];testers:Tester[];reports:Report[];activeSlots:number;pendingSlots:number;cap:number}}){
  const router=useRouter();
  const [email,setEmail]=useState('');
  const [cohort,setCohort]=useState(1);
  const [expiresDays,setExpiresDays]=useState(7);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [inviteUrl,setInviteUrl]=useState('');

  const create=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');setInviteUrl('');
    try{
      const response=await fetch('/api/admin/beta-cohort',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'CREATE_INVITE',email,cohort,expiresDays})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Could not create invite.');
      setInviteUrl(String(body.url||''));setEmail('');router.refresh();
    }catch(raw){setError(raw instanceof Error?raw.message:'Could not create invite.')}
    finally{setBusy(false)}
  };

  const patch=async(body:Record<string,unknown>)=>{
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/admin/beta-cohort',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'Beta cohort update failed.');
      router.refresh();
    }catch(raw){setError(raw instanceof Error?raw.message:'Beta cohort update failed.')}
    finally{setBusy(false)}
  };

  const copy=async()=>{if(inviteUrl)await navigator.clipboard.writeText(inviteUrl)};

  return <>
    <section className="glass card" style={{marginBottom:18,border:'1px solid rgba(214,255,47,.22)'}}>
      <div className="eyebrow">STAGE 7 · CONTROLLED FOUNDING BETA</div>
      <div style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'flex-end',flexWrap:'wrap'}}>
        <div><h2 style={{margin:'8px 0'}}>Invite deliberately. Learn from every tester.</h2><p className="muted" style={{maxWidth:850}}>Founding Beta is capped at {snapshot.cap} active + pending places. Invite links are one-time, expire automatically and can be locked to one email.</p></div>
        <span className="op-tier op-tier-pro">{snapshot.activeSlots} ACTIVE · {snapshot.pendingSlots} PENDING · {snapshot.cap} CAP</span>
      </div>
    </section>

    <div className="grid two" style={{marginBottom:18}}>
      <section className="glass card">
        <div className="eyebrow">CREATE BETA INVITE</div>
        <form className="form" onSubmit={create}>
          <label className="field"><span>Email lock · optional</span><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tester@example.com"/></label>
          <div className="grid two">
            <label className="field"><span>Cohort</span><input className="input" type="number" min={1} max={999} value={cohort} onChange={e=>setCohort(Number(e.target.value)||1)}/></label>
            <label className="field"><span>Expires in days</span><input className="input" type="number" min={1} max={30} value={expiresDays} onChange={e=>setExpiresDays(Number(e.target.value)||7)}/></label>
          </div>
          <button className="btn primary" disabled={busy}>{busy?'CREATING…':'CREATE ONE-TIME INVITE'}</button>
        </form>
        {inviteUrl&&<div className="beta7-invite-url"><input className="input" readOnly value={inviteUrl}/><button className="btn secondary" onClick={copy}>COPY</button></div>}
        {error&&<div className="auth-message" role="alert">{error}</div>}
      </section>

      <section className="glass card">
        <div className="eyebrow">COHORT HEALTH</div>
        <div className="grid three" style={{marginTop:12}}>
          <div><span className="label">ACTIVE TESTERS</span><b style={{display:'block',fontSize:28,marginTop:4}}>{snapshot.activeSlots}</b></div>
          <div><span className="label">PENDING INVITES</span><b style={{display:'block',fontSize:28,marginTop:4}}>{snapshot.pendingSlots}</b></div>
          <div><span className="label">OPEN REPORTS</span><b style={{display:'block',fontSize:28,marginTop:4}}>{snapshot.reports.filter(r=>r.status==='OPEN'||r.status==='REVIEWING').length}</b></div>
        </div>
        <p className="muted" style={{marginTop:18}}>The operating target is not “25 signups.” It is 10–25 people who actually connect, play, complete coaching loops and tell us where the product breaks.</p>
      </section>
    </div>

    <section className="glass card" style={{marginBottom:18}}>
      <div className="eyebrow">ACTIVE TESTERS</div>
      <h2>Who is actually in the controlled cohort.</h2>
      <div style={{overflowX:'auto',marginTop:14}}><table className="table"><thead><tr><th>Tester</th><th>Cohort</th><th>Status</th><th>Joined</th><th>Last activity</th><th></th></tr></thead><tbody>{snapshot.testers.length?snapshot.testers.map(t=><tr key={t.userId}><td><b>{t.gameName?(t.gameName+(t.tagline?'#'+t.tagline:'')):(t.email||'Beta tester')}</b><small style={{display:'block'}}>{t.email||''}</small></td><td>{t.cohort}</td><td><span className={'beta7-status '+t.status.toLowerCase()}>{t.status}</span></td><td>{new Date(t.joinedAt).toLocaleDateString('en-GB')}</td><td>{t.lastActivityAt?new Date(t.lastActivityAt).toLocaleString('en-GB'):'NO EVENT'}</td><td><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{t.status!=='ACTIVE'&&t.status!=='REMOVED'&&<button className="btn secondary" disabled={busy} onClick={()=>void patch({action:'UPDATE_TESTER',userId:t.userId,status:'ACTIVE'})}>ACTIVATE</button>}{t.status==='ACTIVE'&&<button className="btn secondary" disabled={busy} onClick={()=>void patch({action:'UPDATE_TESTER',userId:t.userId,status:'PAUSED'})}>PAUSE</button>}{!['COMPLETED','REMOVED'].includes(t.status)&&<button className="btn secondary" disabled={busy} onClick={()=>void patch({action:'UPDATE_TESTER',userId:t.userId,status:'COMPLETED'})}>COMPLETE</button>}{t.status!=='REMOVED'&&<button className="btn secondary" disabled={busy} onClick={()=>void patch({action:'UPDATE_TESTER',userId:t.userId,status:'REMOVED'})}>REMOVE</button>}</div></td></tr>):<tr><td colSpan={6}>No controlled beta testers have claimed an invite yet.</td></tr>}</tbody></table></div>
    </section>

    <section className="glass card" style={{marginBottom:18}}>
      <div className="eyebrow">INVITE LEDGER</div>
      <div style={{overflowX:'auto',marginTop:14}}><table className="table"><thead><tr><th>Email lock</th><th>Cohort</th><th>Status</th><th>Expires</th><th></th></tr></thead><tbody>{snapshot.invites.length?snapshot.invites.map(invite=><tr key={invite.id}><td>{invite.email||'ANY EMAIL'}</td><td>{invite.cohort}</td><td><span className={'beta7-status '+invite.status.toLowerCase()}>{invite.status}</span></td><td>{new Date(invite.expiresAt).toLocaleString('en-GB')}</td><td>{invite.status==='PENDING'&&<button className="btn secondary" disabled={busy} onClick={()=>void patch({action:'REVOKE_INVITE',id:invite.id})}>REVOKE</button>}</td></tr>):<tr><td colSpan={5}>No beta invites created yet.</td></tr>}</tbody></table></div>
    </section>

    <section className="glass card" style={{marginBottom:18}}>
      <div className="eyebrow">BETA REPORT TRIAGE</div>
      <h2>Bugs, friction and coaching that felt wrong.</h2>
      <div style={{overflowX:'auto',marginTop:14}}><table className="table"><thead><tr><th>Report</th><th>Severity</th><th>Surface</th><th>Build</th><th>Status</th><th></th></tr></thead><tbody>{snapshot.reports.length?snapshot.reports.map(report=><tr key={report.id}><td style={{minWidth:300}}><b>{report.kind} · {report.player}</b><div>{report.summary}</div>{report.details&&<small>{report.details}</small>}</td><td><span className={'beta7-status '+report.severity.toLowerCase()}>{report.severity}</span></td><td>{report.surface}</td><td>{report.buildCommit||'—'}<small style={{display:'block'}}>{report.webVersion?'v'+report.webVersion:''}</small></td><td><span className={'beta7-status '+report.status.toLowerCase()}>{report.status}</span></td><td><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{report.status==='OPEN'&&<button className="btn secondary" disabled={busy} onClick={()=>void patch({action:'UPDATE_REPORT',id:report.id,status:'REVIEWING'})}>REVIEW</button>}{!['RESOLVED','WONT_FIX'].includes(report.status)&&<button className="btn secondary" disabled={busy} onClick={()=>void patch({action:'UPDATE_REPORT',id:report.id,status:'RESOLVED'})}>RESOLVE</button>}</div></td></tr>):<tr><td colSpan={6}>No beta reports yet.</td></tr>}</tbody></table></div>
    </section>
  </>;
}
