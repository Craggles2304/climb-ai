'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {TftShell} from '@/components/TftShell';
import {useAccount} from '@/components/AccountContext';
import {analyzeTftTimeline,parseTftTimeline,type TftFinding,type TftTimeline} from '@/lib/tft/timeline';

type LinkedMatch={id:string;external_match_id:string;game_datetime:string;placement:number;level:number|null;last_round:number|null;comp_signature:string|null;gold_left:number|null};
type LatestReview={
  session:{id:string;pseudo_match_id:string;status:string;started_at:string;ended_at:string|null;summary:Record<string,unknown>};
  timeline:TftTimeline;
  findings:TftFinding[];
  linkedMatch:LinkedMatch|null;
};

export default function TftTimelinePage(){
  const {active}=useAccount();
  const [timeline,setTimeline]=useState<TftTimeline|null>(null);
  const [linkedMatch,setLinkedMatch]=useState<LinkedMatch|null>(null);
  const [serverFindings,setServerFindings]=useState<TftFinding[]|null>(null);
  const [session,setSession]=useState<LatestReview['session']|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [source,setSource]=useState<'AUTO'|'IMPORT'|'NONE'>('NONE');

  const loadLatest=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true);
    try{
      const res=await fetch(`/api/tft/telemetry?accountId=${encodeURIComponent(active.id)}`,{cache:'no-store'});
      const body=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(body?.error||'Could not load TFT recorder data.');
      const latest=body?.latest as LatestReview|null;
      if(latest?.timeline){
        setTimeline(latest.timeline);
        setLinkedMatch(latest.linkedMatch??null);
        setServerFindings(Array.isArray(latest.findings)?latest.findings:null);
        setSession(latest.session??null);
        setSource('AUTO');
        setError('');
      }else if(source!=='IMPORT'){
        setTimeline(null);setLinkedMatch(null);setServerFindings(null);setSession(null);setSource('NONE');
      }
    }catch(e){
      if(!silent)setError(e instanceof Error?e.message:'Could not load TFT recorder data.');
    }finally{if(!silent)setLoading(false)}
  },[active.id,source]);

  useEffect(()=>{void loadLatest(false)},[active.id]);
  useEffect(()=>{
    const timer=setInterval(()=>{if(document.visibilityState==='visible'&&source!=='IMPORT')void loadLatest(true)},30_000);
    return()=>clearInterval(timer);
  },[loadLatest,source]);

  const findings=useMemo(()=>serverFindings??(timeline?analyzeTftTimeline(timeline):[]),[serverFindings,timeline]);

  const importFile=async(file:File|undefined)=>{
    if(!file)return;
    try{
      const parsed=parseTftTimeline(JSON.parse(await file.text()));
      setTimeline(parsed);setLinkedMatch(null);setSession(null);setServerFindings(null);setSource('IMPORT');setError('');
    }catch(e){setTimeline(null);setError(e instanceof Error?e.message:'Could not read timeline.');}
  };

  return <TftShell><main className="container section">
    <div className="eyebrow">POST-GAME DECISION TWIN</div>
    <h1>TFT TIMELINE</h1>
    <p className="muted" style={{maxWidth:820}}>Your Companion records supported local-player TFT evidence silently during the game. Coaching appears here only after the match; OP CLIMB does not use the recorder to tell you what to buy, roll or position live.</p>

    <section className="glass card" style={{marginTop:18,padding:16}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'center',flexWrap:'wrap'}}>
        <div>
          <div className="eyebrow">AUTOMATIC COMPANION RECORDER</div>
          <h2 style={{margin:'6px 0'}}>{loading?'CHECKING…':source==='AUTO'?'LATEST GAME READY':'WAITING FOR A TFT GAME'}</h2>
          <p className="muted" style={{margin:0,maxWidth:760}}>
            {source==='AUTO'
              ?`${timeline?.points.length??0} compact checkpoints · own board, bench, shop, gold, level, HP and placement evidence.`
              :'Run the Overwolf-enabled OP CLIMB Companion, play TFT normally, then return here after the game.'}
          </p>
        </div>
        <button className="btn primary" type="button" onClick={()=>void loadLatest(false)} disabled={loading}>{loading?'CHECKING…':'REFRESH REVIEW'}</button>
      </div>
      {session&&<div className="cue-row" style={{marginTop:14}}><span>CAPTURE</span><b>{new Date(session.started_at).toLocaleString()} · {session.status}</b></div>}
      {error&&<p role="alert" style={{marginTop:12}}>{error}</p>}
    </section>

    <details className="glass card" style={{marginTop:12,padding:14}}>
      <summary style={{cursor:'pointer',fontWeight:800}}>Manual recorder import fallback</summary>
      <p className="muted" style={{fontSize:12}}>Use this only for a recorder JSON file. Automatic Companion capture is the normal path.</p>
      <input type="file" accept="application/json,.json" onChange={e=>void importFile(e.target.files?.[0])}/>
      {source==='IMPORT'&&<button className="btn secondary" type="button" style={{marginLeft:10}} onClick={()=>void loadLatest(false)}>RETURN TO AUTOMATIC</button>}
    </details>

    {timeline?<><section className="glass card" style={{marginTop:18}}>
      <div className="eyebrow">{source==='AUTO'?'COMPANION GAME':'IMPORTED GAME'} · {timeline.matchId}</div>
      <h2>{timeline.points.length} RECORDED CHECKPOINTS</h2>
      <p className="muted">{linkedMatch
        ?`Riot result linked: #${linkedMatch.placement}, level ${linkedMatch.level??'—'}, round ${linkedMatch.last_round??'—'}, ${linkedMatch.comp_signature??'board unresolved'}.`
        :'Official Riot match link not observed yet. Local Decision Twin evidence is still valid and the match can be linked when Riot history is available.'}</p>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',minWidth:760}}>
          <thead><tr>{['ROUND','GOLD','LEVEL','HP','PLACE','REFRESHES','PURCHASES','BOARD','ITEMS'].map(x=><th key={x} style={{padding:10}}>{x}</th>)}</tr></thead>
          <tbody>{timeline.points.map((p,i)=><tr key={`${p.at}-${i}`} style={{borderTop:'1px solid rgba(255,255,255,.12)'}}>
            {[p.round,p.gold,p.level,p.hp,p.placement,p.shopRefreshes,p.purchases,p.boardPower,p.completedItems].map((v,j)=><td key={j} style={{padding:10}}>{v??'—'}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12,marginTop:18}}>
      {findings.map(f=><article className="glass card" key={f.key}>
        <div className="eyebrow">{f.status}</div>
        <h3>{f.title}</h3>
        <p>{f.evidence}</p>
        <p className="muted">{f.principle}</p>
      </article>)}
    </section>

    <section className="glass card" style={{marginTop:18}}>
      <div className="eyebrow">EVIDENCE BOUNDARY</div>
      <h3>OWN-PLAYER DATA ONLY</h3>
      <p className="muted">The automatic recorder does not capture opponent boards, opponent roster, augment choices or the shared all-player item-bench feed. If a decision cannot be proven from supported evidence, OP CLIMB keeps it as NOT OBSERVED.</p>
    </section></>:<section className="glass card" style={{marginTop:18}}>
      <div className="eyebrow">EVIDENCE STATUS</div><h2>NOT OBSERVED</h2>
      <p className="muted">No completed automatic TFT timeline is stored for this account yet.</p>
    </section>}
  </main></TftShell>;
}
