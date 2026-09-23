'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {BetaExperiment} from '@/lib/server/betaExperimentRepository';
import type {BetaExperimentRecommendation} from '@/lib/betaOperationsModel';

const metricLabel=(key:string)=>({
  activationToGradePct:'Signup → first coaching value',
  companionAdoptionPct:'Companion adoption',
  trackedGameAfterCompanionPct:'Connected → tracked game',
  sessionCompletionPct:'3-game session completion',
  careerAdoptionPct:'Development Career adoption',
  usefulFeedbackPct:'Coaching usefulness',
  day1ReturnPct:'Day-1 return',
  day7ReturnPct:'Day-7 return',
} as Record<string,string>)[key]||key;

export function BetaExperimentConsole({
  active,
  history,
  recommendation,
  currentValue,
  recommendedBaseline,
}:{
  active:BetaExperiment|null;
  history:BetaExperiment[];
  recommendation:BetaExperimentRecommendation|null;
  currentValue:number|null;
  recommendedBaseline:number|null;
}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const request=async(method:'POST'|'PATCH',body:Record<string,unknown>)=>{
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/admin/beta-experiments',{
        method,headers:{'content-type':'application/json'},body:JSON.stringify(body),
      });
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'Beta experiment update failed.');
      router.refresh();
    }catch(raw){setError(raw instanceof Error?raw.message:'Beta experiment update failed.')}
    finally{setBusy(false)}
  };

  return <section className="glass card" style={{marginBottom:18,border:'1px solid rgba(83,161,255,.2)'}}>
    <div className="eyebrow">STAGE 6 · RELEASE EXPERIMENT</div>
    {active?<>
      <div style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'flex-start',flexWrap:'wrap'}}>
        <div style={{maxWidth:820}}>
          <h2 style={{margin:'8px 0'}}>{active.name}</h2>
          <p className="muted">{active.hypothesis}</p>
        </div>
        <span className="v7-badge engine">RUNNING</span>
      </div>
      <div className="grid four" style={{marginTop:16}}>
        <div><span className="label">METRIC</span><b style={{display:'block',marginTop:5}}>{metricLabel(active.metricKey)}</b></div>
        <div><span className="label">BASELINE</span><b style={{display:'block',marginTop:5}}>{active.baselineValue}%</b></div>
        <div><span className="label">CURRENT</span><b style={{display:'block',marginTop:5}}>{currentValue===null?'NO DATA':`${currentValue}%`}</b></div>
        <div><span className="label">TARGET</span><b style={{display:'block',marginTop:5}}>{active.targetValue}%</b></div>
      </div>
      <p className="muted" style={{fontSize:12}}>Frozen on build <b>{active.startCommit||'unknown'}</b> · web v{active.startVersion||'unknown'} · started {new Date(active.startedAt).toLocaleString('en-GB')}.</p>
      <div className="hero-actions">
        <button className="btn primary" disabled={busy} onClick={()=>void request('PATCH',{id:active.id,action:'COMPLETE'})}>{busy?'SCORING…':'CLOSE & SCORE EXPERIMENT'}</button>
        <button className="btn secondary" disabled={busy} onClick={()=>void request('PATCH',{id:active.id,action:'CANCELLED'})}>CANCEL</button>
      </div>
    </>:recommendation?<>
      <h2 style={{margin:'8px 0'}}>{recommendation.title}</h2>
      <p>{recommendation.hypothesis}</p>
      <div className="grid three" style={{marginTop:16}}>
        <div><span className="label">WHY THIS FIRST</span><b style={{display:'block',marginTop:5}}>{recommendation.reason}</b></div>
        <div><span className="label">BASELINE</span><b style={{display:'block',marginTop:5}}>{recommendedBaseline===null?'NO DATA':`${recommendedBaseline}%`}</b></div>
        <div><span className="label">PROPOSED TARGET</span><b style={{display:'block',marginTop:5}}>{recommendedBaseline===null?'WAIT':`${Math.min(100,recommendedBaseline+recommendation.targetDelta)}%`}</b></div>
      </div>
      <div className="hero-actions"><button className="btn primary" disabled={busy||recommendedBaseline===null} onClick={()=>void request('POST',{action:'START_RECOMMENDED'})}>{busy?'STARTING…':'START HIGHEST-IMPACT EXPERIMENT →'}</button></div>
    </>:<>
      <h2 style={{margin:'8px 0'}}>No rescue experiment is needed yet.</h2>
      <p className="muted">Keep collecting real beta usage. OP CLIMB will propose the next experiment when a measurable blocker exists.</p>
    </>}
    {error&&<p className="danger">{error}</p>}
    {history.length>0&&<details style={{marginTop:18}}><summary>PAST EXPERIMENTS · {history.length}</summary><div style={{overflowX:'auto',marginTop:12}}><table className="table"><thead><tr><th>Experiment</th><th>Metric</th><th>Baseline</th><th>Final</th><th>Target</th><th>Outcome</th></tr></thead><tbody>{history.map(item=><tr key={item.id}><td><b>{item.name}</b></td><td>{metricLabel(item.metricKey)}</td><td>{item.baselineValue}%</td><td>{item.latestValue===null?'—':`${item.latestValue}%`}</td><td>{item.targetValue}%</td><td>{item.outcome||item.status}</td></tr>)}</tbody></table></div></details>}
  </section>;
}
