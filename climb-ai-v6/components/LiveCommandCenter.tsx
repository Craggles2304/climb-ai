'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useAccount} from './AccountContext';
import {PageHead} from './UI';
import {WindowsTrackerInstaller} from './WindowsTrackerInstaller';

type Device={id:string;account_key:string;device_name:string;last_seen_at:string|null};
type Item={itemId:number;displayName:string;count:number;price:number};
type Player={summonerName:string;riotId:string|null;championName:string;team:string;level:number;position:string|null;itemGold:number;items:Item[];scores:{kills:number;deaths:number;assists:number;creepScore:number;wardScore:number}};
type Snapshot={gameTime:number;active:{summonerName:string;riotId:string|null;championName:string;position:string|null;currentGold:number};players:Player[]};
type Review={status:string;lastSeenAt:string|null;snapshotCount:number;latestSnapshot:Snapshot|null};

export function LiveCommandCenter(){
  const {active,isOwnAccount,profile}=useAccount();
  const [devices,setDevices]=useState<Device[]>([]);
  const [review,setReview]=useState<Review|null>(null);
  const [pairToken,setPairToken]=useState('');
  const [deviceName,setDeviceName]=useState('My Windows PC');
  const [origin,setOrigin]=useState('https://opclimb.com');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  const refresh=useCallback(async()=>{
    try{
      const [d,r]=await Promise.all([
        fetch('/api/live/pair',{cache:'no-store'}),
        fetch(`/api/live/telemetry?accountId=${encodeURIComponent(active.id)}`,{cache:'no-store'}),
      ]);
      if(d.ok){const body=await d.json();setDevices((body.devices??[]).filter((x:Device)=>x.account_key===active.id))}
      if(r.ok){const body=await r.json();setReview(body.review??null)}
    }catch{}
  },[active.id]);

  useEffect(()=>{setOrigin(window.location.origin);void refresh();const id=window.setInterval(()=>void refresh(),10_000);return()=>window.clearInterval(id)},[refresh]);

  const paired=devices.length>0;
  const snapshot=review?.latestSnapshot??null;
  const me=useMemo(()=>snapshot?findMe(snapshot):null,[snapshot]);
  const ready=Boolean(review&&['COMPLETE','ABORTED'].includes(review.status)&&snapshot);
  const recording=Boolean(review?.status==='ACTIVE'&&recent(review.lastSeenAt,30_000));
  const status=recording?'RECORDING':ready?'REVIEW READY':paired?'READY FOR LEAGUE':'SETUP REQUIRED';
  const csMin=me&&snapshot?((me.scores.creepScore/Math.max(snapshot.gameTime/60,1/60))).toFixed(1):'—';

  async function pair(){
    if(!isOwnAccount){setMessage('Switch to your own Riot account before pairing.');return}
    setBusy(true);setMessage('');setPairToken('');
    try{
      const res=await fetch('/api/live/pair',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountId:active.id,deviceName,riotProfile:{gameName:active.gameName,tagline:active.tagline,region:active.region,role:active.role,rank:active.rank,champions:active.champions??[],frustration:profile?.frustration??''}})});
      const body=await res.json();
      if(!res.ok){setMessage(body.error||'Pairing failed.');return}
      setPairToken(body.token||'');setMessage('PC paired. Install the tracker once, then use the desktop shortcut before League.');await refresh();
    }catch{setMessage('Could not reach the pairing service.')}
    finally{setBusy(false)}
  }

  return <div className="op-live-command">
    <PageHead title="Live Companion" subtitle="Record quietly. Review the decisions that actually move your rank."/>

    <section className={`glass card op-live-status ${recording?'is-recording':ready?'is-ready':''}`}>
      <div className="op-live-status-copy">
        <div><div className="eyebrow">OP CLIMB COMPANION</div><h2>{status}</h2><p className="muted">{recording?'Your match is being recorded silently. No live tactical advice is shown.':ready?'The game is analysed. Start with the grade and the first Fix Ladder priority.':paired?'Tracker paired. Open the desktop companion before queueing.':'Pair this PC once to start recording League matches.'}</p></div>
        <span className="op-live-status-pill">{recording?'● LIVE':ready?'✓ ANALYSED':paired?'● WAITING':'SETUP'}</span>
      </div>
      {recording&&snapshot&&<div className="grid three op-live-recording"><Mini label="CHAMPION" value={snapshot.active.championName||'Detecting'}/><Mini label="GAME TIME" value={clock(snapshot.gameTime)}/><Mini label="SNAPSHOTS" value={String(review?.snapshotCount??0)}/></div>}
    </section>

    {ready&&snapshot&&me&&<section className="op-latest-match">
      <div className="glass card op-match-card">
        <div className="op-match-head">
          <div><div className="eyebrow">LATEST MATCH</div><h2>{me.championName} <span>· {role(snapshot.active.position)}</span></h2></div>
          <b>{clock(snapshot.gameTime)}</b>
        </div>
        <div className="grid three op-match-metrics">
          <Mini label="K / D / A" value={`${me.scores.kills} / ${me.scores.deaths} / ${me.scores.assists}`}/>
          <Mini label="CS / MIN" value={csMin}/>
          <Mini label="VISION" value={format(me.scores.wardScore)}/>
          <Mini label="LEVEL" value={String(me.level)}/>
          <Mini label="ITEM POWER" value={`${Math.round(me.itemGold)}g`}/>
          <Mini label="UNSPENT" value={`${Math.round(snapshot.active.currentGold)}g`}/>
        </div>
        <div className="op-next-read"><div className="eyebrow">READ THIS REPORT IN ORDER</div><b>OP Grade → Fix Ladder → Map Timing → Evidence</b><p className="muted">Raw telemetry stays hidden unless it helps explain a coaching decision.</p></div>
      </div>

      <details className="glass card op-quiet-details">
        <summary>SHOW MATCH DETAILS <span>build, matchup, teams & capture quality</span></summary>
        <div style={{display:'grid',gap:16,marginTop:18}}>
          <div><div className="eyebrow">FINAL BUILD</div><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:9}}>{me.items.length?me.items.map((item,i)=><span key={`${item.itemId}-${i}`} style={chip}>{item.displayName}{item.count>1?` ×${item.count}`:''}</span>):<span className="muted">No item data captured.</span>}</div></div>
          <Matchup snapshot={snapshot} me={me}/>
          <div className="grid two"><Team title="YOUR TEAM" players={snapshot.players.filter(p=>p.team===me.team)} /><Team title="ENEMY TEAM" players={snapshot.players.filter(p=>p.team!==me.team&&p.team!=='UNKNOWN')} /></div>
          <div><div className="eyebrow">CAPTURE QUALITY</div><p className="muted" style={{margin:'6px 0 0'}}>{review?.snapshotCount??0} snapshots · captured through {clock(snapshot.gameTime)} · {review?.status==='COMPLETE'?'session closed normally':'partial session'}</p></div>
        </div>
      </details>
    </section>}

    <details className="glass card op-quiet-details op-tracker-setup" open={!paired}>
      <summary>{paired?'TRACKER SETUP & DEVICES':'PAIR THIS WINDOWS PC'}</summary>
      <div style={{marginTop:16}}>
        <p className="muted">You only need this section for setup or reinstalling the tracker.</p>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end'}}>
          <label style={{display:'grid',gap:6,minWidth:220}}><span className="muted">Device name</span><input value={deviceName} onChange={e=>setDeviceName(e.target.value)} maxLength={80} style={{padding:'12px 14px',borderRadius:12}}/></label>
          <button className="btn primary" disabled={busy||!isOwnAccount} onClick={pair}>{busy?'PAIRING…':'PAIR A NEW PC'}</button>
        </div>
        {message&&<p style={{marginTop:12}}>{message}</p>}
        {pairToken&&<WindowsTrackerInstaller token={pairToken} origin={origin}/>} 
      </div>
    </details>
  </div>;
}

function Mini({label,value}:{label:string;value:string}){return <div className="glass op-live-metric"><div className="eyebrow">{label}</div><strong>{value}</strong></div>}
function Matchup({snapshot,me}:{snapshot:Snapshot;me:Player}){const opponent=findOpponent(snapshot,me);return <div><div className="eyebrow">MATCHUP</div>{opponent?<p style={{margin:'6px 0 0'}}><b>{me.championName}</b> vs <b>{opponent.championName}</b> · CS {me.scores.creepScore}–{opponent.scores.creepScore} · visible item power {signed(me.itemGold-opponent.itemGold)}</p>:<p className="muted" style={{margin:'6px 0 0'}}>Same-role opponent could not be resolved.</p>}</div>}
function Team({title,players}:{title:string;players:Player[]}){return <div><div className="eyebrow">{title}</div><div style={{display:'grid',gap:7,marginTop:8}}>{players.map((p,i)=><div key={`${p.riotId||p.summonerName}-${i}`} style={{display:'flex',justifyContent:'space-between',gap:10,borderBottom:'1px solid rgba(255,255,255,.06)',paddingBottom:7}}><span><b>{p.championName}</b> <span className="muted">Lv {p.level}</span></span><span>{p.scores.kills}/{p.scores.deaths}/{p.scores.assists} · {p.scores.creepScore} CS</span></div>)}</div></div>}
function findMe(s:Snapshot){return s.players.find(p=>Boolean(s.active.riotId&&p.riotId===s.active.riotId))||s.players.find(p=>p.summonerName===s.active.summonerName)||s.players.find(p=>p.championName===s.active.championName)||null}
function findOpponent(s:Snapshot,me:Player){const enemies=s.players.filter(p=>p.team!==me.team&&p.team!=='UNKNOWN');return enemies.find(p=>Boolean(me.position&&p.position===me.position))||null}
function role(v:string|null){const x=(v||'').toUpperCase();return x==='BOTTOM'?'ADC':x||'ROLE UNKNOWN'}
function clock(sec:number){const n=Math.max(0,Math.round(sec));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}
function format(n:number){return Number.isInteger(n)?String(n):n.toFixed(1)}
function signed(n:number){return `${n>=0?'+':''}${Math.round(n)}g`}
function recent(value:string|null,ms:number){if(!value)return false;return Date.now()-new Date(value).getTime()<=ms}
const chip:React.CSSProperties={padding:'7px 10px',border:'1px solid rgba(255,255,255,.12)',borderRadius:999,fontSize:12};
