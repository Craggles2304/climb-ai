'use client';
import {useCallback,useEffect,useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useAccount} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {WindowsTrackerInstaller} from '@/components/WindowsTrackerInstaller';

type Device={id:string;account_key:string;riot_account_id?:string|null;device_name:string;created_at:string;last_seen_at:string|null};
type StrengthPoint={
  atSeconds:number;verdict:'YOU_STRONGER'|'EVEN'|'THEM_STRONGER';score:number;opponent:string|null;
  comparisonReason:string;reasons:string[];
  you:{level:number;itemGold:number;dead:boolean};
  them:{level:number;itemGold:number;dead:boolean}|null;
};
type Opportunity={
  atSeconds:number;type:'ALL_IN_CANDIDATE'|'PRESSURE_WINDOW'|'CAUTION_WINDOW';opponent:string;
  confidence:'HIGH'|'MEDIUM';score:number;headline:string;detail:string;limitation:string;
  evidence:{levelDelta:number;itemGoldDelta:number;currentGold:number;healthPct:number|null;manaPct:number|null};
};
type Review={
  sessionId:string;status:'ACTIVE'|'COMPLETE'|string;startedAt:string;endedAt:string|null;lastSeenAt:string|null;
  snapshotCount:number;
  latestSnapshot:null|{gameTime:number;active:{championName:string;level:number}};
  summary?:{points?:StrengthPoint[];opportunities?:Opportunity[];strongestWindow?:StrengthPoint|null;weakestWindow?:StrengthPoint|null;modelNote?:string};
};

export default function Live(){
  const {active,isOwnAccount,profile}=useAccount();
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
    }catch{}
  },[active.id]);

  useEffect(()=>{setOrigin(window.location.origin);void refresh();const id=window.setInterval(()=>void refresh(),10_000);return()=>window.clearInterval(id)},[refresh]);

  const paired=devices.length>0;
  const live=review?.status==='ACTIVE'&&isRecent(review.lastSeenAt,30_000);
  const stale=review?.status==='ACTIVE'&&!live;
  const status=live?'RECORDING':review?.status==='COMPLETE'?'POST-GAME READY':stale?'COMPANION OFFLINE':paired?'WAITING FOR GAME':'NOT PAIRED';
  const clock=review?.latestSnapshot?formatClock(review.latestSnapshot.gameTime):'—';
  const timeline=review?.status==='COMPLETE'?(review.summary?.points??[]):[];
  const opportunities=review?.status==='COMPLETE'?(review.summary?.opportunities??[]):[];

  async function pair(){
    if(!isOwnAccount){setMessage('Switch to your own Riot account before pairing the tracker.');return}
    setBusy(true);setMessage('');setPairToken('');
    try{
      const response=await fetch('/api/live/pair',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          accountId:active.id,deviceName,
          riotProfile:{
            gameName:active.gameName,tagline:active.tagline,region:active.region,
            role:active.role,rank:active.rank,champions:active.champions??[],
            frustration:profile?.frustration??'',
          },
        }),
      });
      const body=await response.json();
      if(!response.ok){setMessage(body.error||'Pairing failed.');return}
      setPairToken(body.token||'');
      setMessage(`PC paired to ${body.riotAccount?.game_name||active.gameName}. Download the Windows tracker below and run the setup once.`);
      await refresh();
    }catch{setMessage('Could not reach the pairing service.')}
    finally{setBusy(false)}
  }

  return <AppShell>
    <PageHead title="Live Tracker" subtitle="Silent in-game recording → deterministic post-game power windows → saved coaching evidence."/>

    <section className="wow-grid">
      <div className="glass wow-main">
        <div className="eyebrow">COMPANION STATUS</div>
        <h2>{status}</h2>
        {live?<>
          <p>OVERPOWERED is recording permitted League telemetry in the background. It deliberately does not show live fight recommendations or hidden enemy cooldowns.</p>
          <div className="grid three" style={{marginTop:18}}>
            <Mini label="GAME CLOCK" value={clock}/>
            <Mini label="SNAPSHOTS" value={String(review?.snapshotCount??0)}/>
            <Mini label="CHAMPION" value={review?.latestSnapshot?.active.championName||'Detecting'}/>
          </div>
        </>:<p>{paired?'Your PC is paired. Open the OVERPOWERED Tracker desktop shortcut before League; recording starts automatically when a match becomes available.':'Pair the Windows PC that runs League. Your Riot profile is saved to your login and the companion sends match snapshots to that account.'}</p>}
        <div className="mission-command"><span>PRE-GAME ILP CUE</span><b>{mission?.gameRule||'Open your ILP before queueing.'}</b></div>
      </div>

      <div className="dashboard-stack">
        <div className="glass stat-feature"><span>ACTIVE ACCOUNT</span><strong>{active.gameName}{active.tagline}</strong><small>{active.region} · {active.role}</small></div>
        <div className="glass stat-feature"><span>DURING GAME</span><strong>SILENT RECORDING</strong><small>No automatic shotcalling</small></div>
        <div className="glass stat-feature"><span>AFTER GAME</span><strong>POWER + FIGHT WINDOWS</strong><small>Timestamped coaching evidence</small></div>
      </div>
    </section>

    <section className="glass card dash-section">
      <div className="eyebrow">PAIR A WINDOWS PC</div>
      <h3>Connect the PC running League</h3>
      <p className="muted">Pairing permanently links this Riot profile, this PC and future live sessions to your signed-in OVERPOWERED account.</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end',marginTop:14}}>
        <label style={{display:'grid',gap:6,minWidth:220}}><span className="muted">Device name</span><input value={deviceName} onChange={e=>setDeviceName(e.target.value)} maxLength={80} style={{padding:'12px 14px',borderRadius:12}}/></label>
        <button className="btn primary" disabled={busy||!isOwnAccount} onClick={pair}>{busy?'PAIRING…':'PAIR THIS PC'}</button>
      </div>
      {!isOwnAccount&&<p className="muted" style={{marginTop:10}}>Switch to your own Riot account before pairing.</p>}
      {message&&<p style={{marginTop:12}}>{message}</p>}
      {pairToken&&<WindowsTrackerInstaller token={pairToken} origin={origin}/>} 
    </section>

    {review?.status==='COMPLETE'&&<section className="dash-section">
      <div className="glass card">
        <div className="eyebrow">POST-GAME POWER REVIEW</div>
        <h3>Who was stronger — and when it changed</h3>
        <p className="muted">The model uses visible level, visible item value, your available health/mana and match state. It never pretends enemy pocket gold, proximity or hidden cooldowns are known.</p>
        <div className="grid two" style={{marginTop:16}}>
          <WindowCard title="STRONGEST WINDOW" point={review.summary?.strongestWindow??null}/>
          <WindowCard title="HARDEST WINDOW" point={review.summary?.weakestWindow??null}/>
        </div>

        {opportunities.length>0&&<div style={{marginTop:24}}>
          <div className="eyebrow">TIMESTAMPED COACHING WINDOWS</div>
          <h3>Where the game state said act — or back off</h3>
          <div style={{display:'grid',gap:10,marginTop:14}}>
            {opportunities.map((window,index)=><OpportunityRow key={`${window.atSeconds}-${window.opponent}-${index}`} window={window}/>) }
          </div>
        </div>}

        <div style={{display:'grid',gap:10,marginTop:24}}>
          {timeline.length?timeline.map((point,index)=><TimelineRow key={`${point.atSeconds}-${index}`} point={point}/>):<p className="muted">The session did not contain enough comparable snapshots to build a timeline.</p>}
        </div>
        {review.summary?.modelNote&&<p className="muted" style={{fontSize:12,marginTop:14}}>{review.summary.modelNote}</p>}
      </div>
    </section>}

    <div className="grid three dash-section">
      <div className="glass card"><div className="eyebrow">SAVED IDENTITY</div><h3>One player history</h3><p className="muted">Pairing saves the Riot identity to the signed-in user so later sessions build one evidence history instead of isolated demos.</p></div>
      <div className="glass card"><div className="eyebrow">POLICY-SAFE DESIGN</div><h3>No live shotcaller</h3><p className="muted">The companion records permitted local state silently. Fight-window verdicts are withheld while the match is active and exposed after the session closes.</p></div>
      <div className="glass card"><div className="eyebrow">NEXT LEARNING LOOP</div><h3>Feed the ILP</h3><p className="muted">Saved post-game windows become evidence for missions such as recognising level/item spikes and avoiding enemy-favoured fights.</p></div>
    </div>
  </AppShell>;
}

function Mini({label,value}:{label:string;value:string}){return <div className="glass card"><span className="eyebrow">{label}</span><strong style={{display:'block',fontSize:22,marginTop:4}}>{value}</strong></div>}

function WindowCard({title,point}:{title:string;point:StrengthPoint|null}){
  return <div className="glass card"><div className="eyebrow">{title}</div>{point?<><h3>{formatClock(point.atSeconds)} · {labelOf(point.verdict)}</h3><p className="muted">vs {point.opponent||'enemy'} · score {signed(point.score)}</p><p>{point.reasons.join(' · ')}</p></>:<p className="muted">No reliable comparison yet.</p>}</div>;
}

function OpportunityRow({window}:{window:Opportunity}){
  const item=window.evidence.itemGoldDelta;
  return <div className="glass card" style={{display:'grid',gridTemplateColumns:'90px minmax(0,1fr)',gap:14,alignItems:'start'}}>
    <strong>{formatClock(window.atSeconds)}</strong>
    <div>
      <b>{window.headline} · {window.confidence} CONFIDENCE</b>
      <div className="muted" style={{marginTop:4}}>vs {window.opponent} · {window.evidence.levelDelta>0?'+':''}{window.evidence.levelDelta} level · {item>0?'+':''}{Math.round(item)}g visible items · {Math.round(window.evidence.currentGold)}g in pocket</div>
      <div style={{marginTop:6}}>{window.detail}</div>
      <small className="muted" style={{display:'block',marginTop:6}}>{window.limitation}</small>
    </div>
  </div>;
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
