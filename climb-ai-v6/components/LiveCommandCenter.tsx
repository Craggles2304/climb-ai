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

  return <>
    <PageHead title="Live Companion" subtitle="Record the game quietly. Review only the decisions that matter."/>

    <section className="glass card" style={{display:'grid',gap:16,marginBottom:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'center',flexWrap:'wrap'}}>
        <div><div className="eyebrow">OP CLIMB COMPANION</div><h2 style={{margin:'5px 0 4px'}}>{status}</h2><p className="muted" style={{margin:0}}>{recording?'Your match is being recorded silently. No live tactical advice is shown.':ready?'Your latest match is ready. Start with the grade and Fix Ladder below.':paired?'Open the desktop tracker before queueing.':'Pair this PC once to start recording League matches.'}</p></div>
        <span style={statusPill(recording,ready)}>{recording?'● LIVE':ready?'✓ ANALYSED':paired?'● WAITING':'SETUP'}</span>
      </div>
      {recording&&snapshot&&<div className="grid three"><Mini label="CHAMPION" value={snapshot.active.championName||'Detecting'}/><Mini label="GAME TIME" value={clock(snapshot.gameTime)}/><Mini label="SNAPSHOTS" value={String(review?.snapshotCount??0)}/></div>}
    </section>

    {ready&&snapshot&&me&&<section style={{display:'grid',gap:14,marginBottom:18}}>
      <div className="glass card">
        <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'end',flexWrap:'wrap'}}>
          <div><div className="eyebrow">LATEST MATCH</div><h2 style={{margin:'5px 0 0'}}>{me.championName} · {role(snapshot.active.position)}</h2></div>
          <b style={{fontSize:22}}>{clock(snapshot.gameTime)}</b>
        </div>
        <div className="grid three" style={{marginTop:16}}>
          <Mini label="K / D / A" value={`${me.scores.kills} / ${me.scores.deaths} / ${me.scores.assists}`}/>
          <Mini label="CS / MIN" value={csMin}/>
          <Mini label="VISION" value={format(me.scores.wardScore)}/>
          <Mini label="LEVEL" value={String(me.level)}/>
          <Mini label="ITEM POWER" value={`${Math.round(me.itemGold)}g`}/>
          <Mini label="UNSPENT" value={`${Math.round(snapshot.active.currentGold)}g`}/>
        </div>
        <div style={{marginTop:16,padding:'13px 15px',border:'1px solid rgba(255,255,255,.10)',borderRadius:14}}><div className="eyebrow">WHAT TO LOOK AT NEXT</div><b>OP Grade → Fix Ladder → exact coaching timestamps</b><p className="muted" style={{margin:'5px 0 0'}}>The raw event feed is intentionally hidden. OP CLIMB should explain the pattern, not make you read telemetry.</p></div>
      </div>

      <details className="glass card">
        <summary style={{cursor:'pointer',fontWeight:800}}>SHOW MATCH DETAILS <span className="muted" style={{fontWeight:500}}>· build, matchup, teams & capture quality</span></summary>
        <div style={{display:'grid',gap:16,marginTop:18}}>
          <div><div className="eyebrow">FINAL BUILD</div><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:9}}>{me.items.length?me.items.map((item,i)=><span key={`${item.itemId}-${i}`} style={chip}>{item.displayName}{item.count>1?` ×${item.count}`:''}</span>):<span className="muted">No item data captured.</span>}</div></div>
          <Matchup snapshot={snapshot} me={me}/>
          <div className="grid two"><Team title="YOUR TEAM" players={snapshot.players.filter(p=>p.team===me.team)} /><Team title="ENEMY TEAM" players={snapshot.players.filter(p=>p.team!==me.team&&p.team!=='UNKNOWN')} /></div>
          <div><div className="eyebrow">CAPTURE QUALITY</div><p className="muted" style={{margin:'6px 0 0'}}>{review?.snapshotCount??0} snapshots · captured through {clock(snapshot.gameTime)} · {review?.status==='COMPLETE'?'session closed normally':'partial session'}</p></div>
        </div>
      </details>
    </section>}

    <details className="glass card" style={{marginBottom:18}} open={!paired}>
      <summary style={{cursor:'pointer',fontWeight:800}}>{paired?'TRACKER SETUP & DEVICES':'PAIR THIS WINDOWS PC'}</summary>
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
  </>;
}

function Mini({label,value}:{label:string;value:string}){return <div className="glass" style={{padding:'14px 16px'}}><div className="eyebrow">{label}</div><strong style={{fontSize:20,display:'block',marginTop:5}}>{value}</strong></div>}
function Matchup({snapshot,me}:{snapshot:Snapshot;me:Player}){const opponent=findOpponent(snapshot,me);return <div><div className="eyebrow">MATCHUP</div>{opponent?<p style={{margin:'6px 0 0'}}><b>{me.championName}</b> vs <b>{opponent.championName}</b> · CS {me.scores.creepScore}–{opponent.scores.creepScore} · visible item power {signed(me.itemGold-opponent.itemGold)}</p>:<p className="muted" style={{margin:'6px 0 0'}}>Same-role opponent could not be resolved.</p>}</div>}
function Team({title,players}:{title:string;players:Player[]}){return <div><div className="eyebrow">{title}</div><div style={{display:'grid',gap:7,marginTop:8}}>{players.map((p,i)=><div key={`${p.riotId||p.summonerName}-${i}`} style={{display:'flex',justifyContent:'space-between',gap:10,borderBottom:'1px solid rgba(255,255,255,.06)',paddingBottom:7}}><span><b>{p.championName}</b> <span className="muted">Lv {p.level}</span></span><span>{p.scores.kills}/{p.scores.deaths}/{p.scores.assists} · {p.scores.creepScore} CS</span></div>)}</div></div>}
function findMe(s:Snapshot){return s.players.find(p=>Boolean(s.active.riotId&&p.riotId===s.active.riotId))||s.players.find(p=>p.summonerName===s.active.summonerName)||s.players.find(p=>p.championName===s.active.championName)||null}
function findOpponent(s:Snapshot,me:Player){const enemies=s.players.filter(p=>p.team!==me.team&&p.team!=='UNKNOWN');return enemies.find(p=>Boolean(me.position&&p.position===me.position))||null}
function role(v:string|null){const x=(v||'').toUpperCase();return x==='BOTTOM'?'ADC':x||'ROLE UNKNOWN'}
function clock(sec:number){const n=Math.max(0,Math.round(sec));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}
function format(n:number){return Number.isInteger(n)?String(n):n.toFixed(1)}
function signed(n:number){return `${n>=0?'+':''}${Math.round(n)}g`}
function recent(value:string|null,ms:number){if(!value)return false;return Date.now()-new Date(value).getTime()<=ms}
function statusPill(live:boolean,ready:boolean):React.CSSProperties{return{padding:'9px 12px',borderRadius:999,border:'1px solid rgba(255,255,255,.14)',fontWeight:900,fontSize:12,letterSpacing:'.06em',opacity:live||ready?1:.8}}
const chip:React.CSSProperties={padding:'7px 10px',border:'1px solid rgba(255,255,255,.12)',borderRadius:999,fontSize:12};
