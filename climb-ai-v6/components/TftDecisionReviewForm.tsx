'use client';
import {useState} from 'react';
import {TFT_SKILL_KEYS} from '@/lib/tft/advancedCoach';
export function TftDecisionReviewForm({sessionId,rounds}:{sessionId:string;rounds:string[]}){
  const [skill,setSkill]=useState('ECONOMY');
  const [round,setRound]=useState(rounds[0]||'');
  const [verdict,setVerdict]=useState('UNCERTAIN');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();if(busy)return;setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/tft/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId,skill,assessment:{round,verdict,reason}})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save review.');
      setMessage('Self-review saved. Your TFT DNA and shared mission will refresh. This does not award verified mastery.');
    }catch(e){setMessage(e instanceof Error?e.message:'Could not save review.')}
    finally{setBusy(false)}
  };
  return <form className="glass card" style={{padding:20,marginTop:14}} onSubmit={submit}>
    <h2>EXPLAIN ONE RECORDED DECISION</h2>
    <p>Your assessment is labelled self-reported. The recording proves the action happened, not that the choice was optimal.</p>
    <label>Practice area<select value={skill} onChange={e=>setSkill(e.target.value)}>{TFT_SKILL_KEYS.map(k=><option key={k} value={k}>{k.replaceAll('_',' ')}</option>)}</select></label>
    <label>Recorded round<select value={round} onChange={e=>setRound(e.target.value)} required>{rounds.map(r=><option key={r}>{r}</option>)}</select></label>
    <label>Your assessment<select value={verdict} onChange={e=>setVerdict(e.target.value)}><option value="UNCERTAIN">Uncertain — do not score</option><option value="HELPED">Helped the intended decision</option><option value="HURT">Worked against the intended decision</option></select></label>
    <label>What did you choose, why, and what supports your assessment?<textarea required minLength={10} maxLength={500} rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <button className="btn primary" disabled={busy||!round||reason.trim().length<10}>{busy?'SAVING…':'SAVE SELF-REVIEW'}</button>
    {message&&<p role="status">{message}</p>}
  </form>;
}
