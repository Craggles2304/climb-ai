'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useAccount} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';

type Device={id:string;account_key:string;device_name:string;created_at:string;last_seen_at:string|null};
type StrengthPoint={
  atSeconds:number;verdict:'YOU_STRONGER'|'EVEN'|'THEM_STRONGER';score:number;opponent:string|null;
  comparisonReason:string;reasons:string[];
  you:{level:number;itemGold:number;dead:boolean};
  them:{level:number;itemGold:number;dead:boolean}|null;
};
type Review={
  sessionId:string;status:'ACTIVE'|'COMPLETE'|string;startedAt:string;endedAt:string|null;lastSeenAt:string|null;
  snapshotCount:number;
  latestSnapshot:null|{gameTime:number;active:{championName:string;level:number}};
  summary?:{points?:StrengthPoint[];strongestWindow?:StrengthPoint|null;weakestWindow?:StrengthPoint|null;modelNote?:string};
};

export default function Live(){
  const {active,isOwnAccount}=useAccount();
  const {tasks}=useLearningPlan();
  const mission=tasks.find(t=>t.status!=='MASTERED'&&t.status!=='PAUSED');
  const [devices,setDevices]=useState<Device[]>([]);
  const [review,setReview]=useState<Review|null>(null);
  const [pairToken,setPairToken]=useState('');
  const [deviceName,setDeviceName]=useState('My Windows PC');
  const [origin,setOrigin]=useState('https://your-climb-domain.example');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  const refresh=useCallback(async()=>{
    try{
      const [deviceRes,reviewRes]=await Promise.all([
        fetch('/api/live/pair',{cache:'no-store'}),
        fetch(`/api/live/telemetry?accountId=${encodeURIComponent(active.id)}`,{cache:'no-store'}),
      ]);
      if(deviceRes.ok){
        const body=await deviceRes.json();
        setDevices((body.devices??[]).filter((d:Device)=>d.account_key===active.id));
      }
      if(reviewRes.ok){
        const body=await reviewRes.json();setReview(body.review??null);
      }
    }catch{/* Keep the last known status visible during a brief network loss. */}
  },[active.id]);

  useEffect(()=>{setOrigin(window.location.origin);void refresh();const id=window.setInterval(()=>void refresh(),10_000);return()=>window.clearInterval(id)},[refresh]);

  const paired=devices.length>0;
  const live=review?.status==='ACTIVE'&&isRecent(review.lastSeenAt,30_000);
  const stale=review?.status==='ACTIVE'&&!live;
  const status=live?'RECORDING':review?.status==='COMPLETE'?'POST-GAME READY':stale?'COMPANION OFFLINE':paired?'WAITING FOR GAME':'NOT PAIRED';
  const clock=review?.latestSnapshot?formatClock(review.latestSnapshot.gameTime):'—';
  const timeline=review?.status==='COMPLETE'?(review.summary?.points??[]):[];
  const powershell=pairToken?`$env:OP_WEB_URL="${origin}"\n$env:OP_TRACKER_TOKEN="${pairToken}"\nnpm start`:'';

  async function pair(){
    if(!isOwnAccount){setMessage('Switch to your own Riot account before pairing the tracker.');return}
    setBusy(true);setMessage('');setPairToken('');
    try{
      const response=await fetch('/api/live/pair',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountId:active.id,deviceName})});
      const body=await response.json();
      if(!response.ok){setMessage(body.error||'Pairing failed.');return}
      setPairToken(body.token||'');setMessage('PC paired. This token is shown once — use it in the companion setup below.');
      await refresh();
    }catch{setMessage('Could not reach the pairing service.')}
    finally{setBusy(false)}
  }

  return <AppShell>
    <PageHead title="Live Tracker" subtitle="Silent in-game recording → deterministic post-game power windows → better coaching evidence."/>

    <section className="wow-grid">
      <div className="glass wow-main">
        <div className="eyebrow">COMPANION STATUS</div>
        <h2>{status}</h2>
        {live?<>
          <p>CLIMB is recording permitted League telemetry in the background. It deliberately does not show live fight recommendations or hidden enemy cooldowns.</p>
          <div className="grid three" style={{marginTop:18}}>
            <Mini label="GAME CLOCK" value={clock}/>
            <Mini label="SNAPSHOTS" value={String(review?.snapshotCount??0)}/>
            <Mini label="CHAMPION" value={review?.latestSnapshot?.active.championName||'Detecting'}/>
          </div>
        </>:<p>{paired?'Your PC is paired. Start the companion before League; recording begins automatically when a match becomes available.':'Pair the Windows PC that runs League. The companion reads Riot’s local Live Client Data and sends compact snapshots to this account.'}</p>}
        <div className="mission-command"><span>PRE-GAME ILP CUE</span><b>{mission?.gameRule||'Open your ILP before queueing.'}</b></div>
      </div>

      <div className="dashboard-stack">
        <div className="glass stat-feature"><span>ACTIVE ACCOUNT</span><strong>{active.gameName}{active.tagline}</strong><small>{active.region} · {active.role}</small></div>
        <div className="glass stat-feature"><span>DURING GAME</span><strong>SILENT RECORDING</strong><small>No automatic shotcalling</small></div>
        <div className="glass stat-feature"><span>AFTER GAME</span><strong>POWER TIMELINE</strong><small>Levels · visible items · death windows</small></div>
      </div>
    </section>

    <section className="glass card dash-section">
      <div className="eyebrow">PAIR A WINDOWS PC</div>
      <h3>Connect the PC running League</h3>
      <p className="muted">Create a one-time device token. The server stores only its hash; revoking the device invalidates future uploads.</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end',marginTop:14}}>
        <label style={{display:'grid',gap:6,minWidth:220}}><span className="muted">Device name</span><input value={deviceName} onChange={e=>setDeviceName(e.target.value)} maxLength={80} style={{padding:'12px 14px',borderRadius:12}}/></label>
        <button className="btn primary" disabled={busy||!isOwnAccount} onClick={pair}>{busy?'PAIRING…':'PAIR THIS PC'}</button>
      </div>
      {!isOwnAccount&&<p className="muted" style={{marginTop:10}}>Switch from the demo account to your own Riot account before pairing.</p>}
      {message&&<p style={{marginTop:12}}>{message}</p>}
      {pairToken&&<div style={{marginTop:18,display:'grid',gap:10}}>
        <div><b>1. Keep this token private — it is shown once.</b></div>
        <code style={{display:'block',padding:14,borderRadius:12,overflowWrap:'anywhere',background:'rgba(255,255,255,.06)'}}>{pairToken}</code>
        <div><b>2. In PowerShell, inside <code>climb-ai-v6\companion</code>:</b></div>
        <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:14,borderRadius:12,background:'rgba(255,255,255,.06)'}}>{powershell}</pre>
        <div className="muted">Node.js 22+ is enough for the development companion. No AI model or Riot API key is required for the local recording loop.</div>
      </div>}
    </section>

    {review?.status==='COMPLETE'&&<section className="dash-section">
      <div className="glass card">
        <div className="eyebrow">POST-GAME POWER REVIEW</div>
        <h3>Who was stronger — and when it changed</h3>
        <p className="muted">This first deterministic model uses only visible level, visible item value and death/respawn state. It does not count unspent enemy gold or guess hidden cooldowns.</p>
        <div className="grid two" style={{marginTop:16}}>
          <WindowCard title="STRONGEST WINDOW" point={review.summary?.strongestWindow??null}/>
          <WindowCard title="HARDEST WINDOW" point={review.summary?.weakestWindow??null}/>
        </div>
        <div style={{display:'grid',gap:10,marginTop:18}}>
          {timeline.length?timeline.map((point,index)=><TimelineRow key={`${point.atSeconds}-${index}`} point={point}/>):<p className="muted">The session did not contain enough comparable snapshots to build a timeline.</p>}
        </div>
      </div>
    </section>}

    <div className="grid three dash-section">
      <div className="glass card"><div className="eyebrow">FREE CORE</div><h3>Math, not AI calls</h3><p className="muted">The tracker and strength timeline are deterministic. A language model is optional later for turning the finished timeline into richer coaching wording.</p></div>
      <div className="glass card"><div className="eyebrow">POLICY-SAFE DESIGN</div><h3>No live shotcaller</h3><p className="muted">The companion records permitted local state silently. Strength verdicts are withheld while the match is active and exposed after the session closes.</p></div>
      <div className="glass card"><div className="eyebrow">NEXT LEARNING LOOP</div><h3>Feed the ILP</h3><p className="muted">These post-game windows can become evidence for missions such as recognising level/item spikes and avoiding enemy-favoured fights.</p></div>
    </div>
  </AppShell>;
}

function Mini({label,value}:{label:string;value:string}){return <div className="glass card"><span className="eyebrow">{label}</span><strong style={{display:'block',fontSize:22,marginTop:4}}>{value}</strong></div>}

function WindowCard({title,point}:{title:string;point:StrengthPoint|null}){
  return <div className="glass card"><div className="eyebrow">{title}</div>{point?<><h3>{formatClock(point.atSeconds)} · {labelOf(point.verdict)}</h3><p className="muted">vs {point.opponent||'enemy'} · score {signed(point.score)}</p><p>{point.reasons.join(' · ')}</p></>:<p className="muted">No reliable comparison yet.</p>}</div>;
}

function TimelineRow({point}:{point:StrengthPoint}){
  return <div className="glass card" style={{display:'grid',gridTemplateColumns:'90px minmax(0,1fr)',gap:14,alignItems:'start'}}>
    <strong>{formatClock(point.atSeconds)}</strong>
    <div><b>{labelOf(point.verdict)} · {signed(point.score)}</b><div className="muted" style={{marginTop:4}}>vs {point.opponent||'enemy'} · You L{point.you.level} / {Math.round(point.you.itemGold)}g visible items{point.them?` · Them L${point.them.level} / ${Math.round(point.them.itemGold)}g`:''}</div><div style={{marginTop:6}}>{point.reasons.join(' · ')}</div><small className="muted" style={{display:'block',marginTop:6}}>{point.comparisonReason}</small></div>
  </div>;
}

function labelOf(value:StrengthPoint['verdict']){return value==='YOU_STRONGER'?'YOU STRONGER':value==='THEM_STRONGER'?'THEY ARE STRONGER':'EVEN WINDOW'}
function signed(value:number){return `${value>0?'+':''}${Math.round(value*10)/10}`}
function formatClock(seconds:number){const s=Math.max(0,Math.floor(seconds));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function isRecent(value:string|null|undefined,windowMs:number){if(!value)return false;const time=Date.parse(value);return Number.isFinite(time)&&Date.now()-time<=windowMs}
