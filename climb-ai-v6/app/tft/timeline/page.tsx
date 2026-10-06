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

  return <TftShell><main className="tft-page">
    <section className="tft-hero">
      <div className="tft-hero-copy">
        <div className="eyebrow">MATCH ROOM · TFT POST-GAME</div>
        <h1>WHERE DID THE GAME ACTUALLY TURN?</h1>
        <p>The Companion records supported local-player evidence quietly during the match. After the game, Decision Twin turns those checkpoints into a timeline of economy, stabilisation and board-development decisions.</p>
        <div className="tft-hero-actions">
          <button className="btn primary" type="button" onClick={()=>void loadLatest(false)} disabled={loading}>{loading?'CHECKING…':'REFRESH LAST GAME'}</button>
          <a className="btn secondary" href="/tft/coach">OPEN MY TFT DNA</a>
        </div>
      </div>
      <div className="tft-hero-side">
        <div className="tft-hero-signal primary"><span>RECORDER</span><strong>{loading?'CHECKING':source==='AUTO'?'GAME READY':'WAITING'}</strong></div>
        <div className="tft-hero-signal"><span>CHECKPOINTS</span><strong>{timeline?.points.length??0}</strong></div>
        <div className="tft-hero-signal"><span>PROVEN FINDINGS</span><strong>{findings.filter(f=>f.status==='OBSERVED').length}</strong></div>
      </div>
    </section>

    <section className="tft-path" aria-label="TFT review flow">
      <div className="tft-path-head"><span>POST-GAME FLOW</span><b>FROM DATA TO NEXT MISSION</b></div>
      <ol>
        <li className="done"><i>1</i><span>RECORD</span></li>
        <li className={timeline?'done':'active'}><i>2</i><span>BUILD TIMELINE</span></li>
        <li className={timeline?'active':''}><i>3</i><span>FIND TURNING POINT</span></li>
        <li><i>4</i><span>UPDATE DNA</span></li>
        <li><i>5</i><span>NEXT MISSION</span></li>
      </ol>
    </section>

    {error&&<section className="glass card" style={{padding:16,marginBottom:14}}><div className="eyebrow">RECORDER STATUS</div><b>{error}</b></section>}

    {timeline?<>
      <section className="tft-timeline-card">
        <div className="tft-timeline-head">
          <div>
            <div className="eyebrow">{source==='AUTO'?'COMPANION GAME':'IMPORTED GAME'} · {timeline.matchId}</div>
            <h2>{timeline.points.length} RECORDED CHECKPOINTS</h2>
            <p>{linkedMatch
              ?'Riot result linked: #'+linkedMatch.placement+', level '+(linkedMatch.level??'—')+', round '+(linkedMatch.last_round??'—')+', '+(linkedMatch.comp_signature??'board unresolved')+'.'
              :'Official Riot result is not linked yet. Local Decision Twin evidence remains usable and can be linked later.'}</p>
          </div>
          {session?<div className="tft-hero-signal"><span>CAPTURED</span><strong>{new Date(session.started_at).toLocaleDateString()}</strong></div>:null}
        </div>
        <div className="tft-timeline-table">
          <table>
            <thead><tr>{['ROUND','GOLD','LEVEL','HP','PLACE','REFRESHES','PURCHASES','BOARD','ITEMS'].map(x=><th key={x}>{x}</th>)}</tr></thead>
            <tbody>{timeline.points.map((p,i)=><tr key={p.at+'-'+i}>
              {[p.round,p.gold,p.level,p.hp,p.placement,p.shopRefreshes,p.purchases,p.boardPower,p.completedItems].map((v,j)=><td key={j}>{v??'—'}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <div className="tft-section-head">
        <div><div className="eyebrow">DECISION TWIN · KEY FINDINGS</div><h2>WHAT HELPED. WHAT HURT.</h2><p>Only evidence-backed findings are treated as real coaching signals. Everything else stays NOT OBSERVED.</p></div>
      </div>
      <section className="tft-review-grid">
        {findings.map(f=><article className={'tft-review-card '+(f.status==='OBSERVED'?'fix':'good')} key={f.key}>
          <div className="eyebrow">{f.status}</div>
          <h3>{f.title}</h3>
          <p>{f.evidence}</p>
          <p><b>PRINCIPLE:</b> {f.principle}</p>
        </article>)}
      </section>

      <section className="glass card" style={{marginTop:14,padding:20}}>
        <div className="eyebrow">EVIDENCE BOUNDARY</div>
        <h3>NO FAKE CREDIT. NO FAKE BLAME.</h3>
        <p className="muted">The recorder uses supported own-player evidence only. If OP CLIMB cannot prove the decision from the captured game state, that behaviour stays NOT OBSERVED instead of being invented.</p>
      </section>
    </>:<section className="tft-focus-grid">
      <article className="tft-focus">
        <span>EVIDENCE STATUS</span>
        <h2>WAITING FOR YOUR NEXT TFT GAME.</h2>
        <p>Run the Overwolf-enabled OP CLIMB Companion and play normally. The review appears here after the match without needing a manual JSON import.</p>
        <div className="tft-focus-rule"><small>WHAT HAPPENS NEXT</small><b>Play → record → review → update TFT DNA → carry one mission into the next game.</b></div>
      </article>
      <aside className="tft-grade"><span>STATUS</span><strong>—</strong><small>NO COMPLETED TIMELINE<br/>NOT OBSERVED</small></aside>
    </section>}

    <details className="glass card" style={{marginTop:14,padding:16}}>
      <summary style={{cursor:'pointer',fontWeight:800}}>MANUAL RECORDER IMPORT · FALLBACK ONLY</summary>
      <p className="muted" style={{fontSize:12}}>Use this only if automatic Companion capture is unavailable.</p>
      <input type="file" accept="application/json,.json" onChange={e=>void importFile(e.target.files?.[0])}/>
      {source==='IMPORT'&&<button className="btn secondary" type="button" style={{marginLeft:10}} onClick={()=>void loadLatest(false)}>RETURN TO AUTOMATIC</button>}
    </details>
  </main></TftShell>;
}
