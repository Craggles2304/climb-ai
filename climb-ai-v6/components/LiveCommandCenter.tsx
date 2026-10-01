'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useAccount,matchesFor} from './AccountContext';
import {useLearningPlan} from './LearningPlanContext';
import {PageHead} from './UI';
import {WindowsTrackerInstaller} from './WindowsTrackerInstaller';
import {coachingLevelFor} from '@/lib/coachingLevel';
import {missionEvidence} from '@/lib/missionLoop';
import {readClimbSession,sessionGames as gamesInSession,type ClimbSessionState} from '@/lib/climbSession';
import {track} from '@/lib/analytics';
import {MissionMeasurementBadge} from './MissionMeasurementBadge';

type Device={id:string;account_key:string;device_name:string;created_at:string;last_seen_at:string|null};type Item={itemId:number;displayName:string;count:number;price:number};type Player={summonerName:string;riotId:string|null;championName:string;team:string;level:number;position:string|null;itemGold:number;items:Item[];scores:{kills:number;deaths:number;assists:number;creepScore:number;wardScore:number}};type Snapshot={gameTime:number;active:{summonerName:string;riotId:string|null;championName:string;position:string|null;currentGold:number};players:Player[]};type Review={matchId?:string|null;status:string;lastSeenAt:string|null;snapshotCount:number;latestSnapshot:Snapshot|null};
export function LiveCommandCenter(){const {active,isOwnAccount,profile,hydrated,refresh:refreshAccount}=useAccount();const {tasks}=useLearningPlan();const detail=coachingLevelFor(active.rank);const [devices,setDevices]=useState<Device[]>([]);const [devicesLoaded,setDevicesLoaded]=useState(false);const [review,setReview]=useState<Review|null>(null);const [pairCode,setPairCode]=useState('');const [pairExpiresAt,setPairExpiresAt]=useState('');const [pairStartedAt,setPairStartedAt]=useState(0);const [deviceName,setDeviceName]=useState('My Windows PC');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [session,setSession]=useState<ClimbSessionState|null>(null);const autoPairStarted=useRef(false);const connectedTracked=useRef(false);const recordingTracked=useRef(false);const completedReviewTracked=useRef('');
const refreshDevices=useCallback(async()=>{try{const response=await fetch('/api/live/pair',{cache:'no-store'});if(!response.ok)return;const body=await response.json();setDevices((body.devices??[]).filter((x:Device)=>x.account_key===active.id))}catch{}finally{setDevicesLoaded(true)}},[active.id]);const refreshReview=useCallback(async()=>{try{const response=await fetch(`/api/live/telemetry?accountId=${encodeURIComponent(active.id)}`,{cache:'no-store'});if(!response.ok)return;const body=await response.json();setReview(body.review??null)}catch{}},[active.id]);const refresh=useCallback(async()=>{await Promise.all([refreshDevices(),refreshReview()])},[refreshDevices,refreshReview]);
useEffect(()=>{connectedTracked.current=false;recordingTracked.current=false;completedReviewTracked.current='';setSession(readClimbSession(active.id));const sync=()=>setSession(readClimbSession(active.id));window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[active.id]);useEffect(()=>{setDevicesLoaded(false);autoPairStarted.current=false;void refresh();const reviewTick=()=>{if(document.visibilityState==='visible'){void refreshReview();setSession(readClimbSession(active.id))}};const deviceTick=()=>{if(document.visibilityState==='visible')void refreshDevices()};const onVisibility=()=>{if(document.visibilityState==='visible')void refresh()};const reviewId=window.setInterval(reviewTick,60_000);const deviceId=window.setInterval(deviceTick,2*60_000);document.addEventListener('visibilitychange',onVisibility);return()=>{window.clearInterval(reviewId);window.clearInterval(deviceId);document.removeEventListener('visibilitychange',onVisibility)}},[active.id,refresh,refreshDevices,refreshReview]);
useEffect(()=>{if(!pairCode)return;const tick=()=>{if(pairExpiresAt&&Date.now()>=new Date(pairExpiresAt).getTime()){setPairCode('');setPairExpiresAt('');setPairStartedAt(0);setMessage('That pairing link expired. Choose Connect installed Companion to create a fresh one.');return}void refreshDevices()};tick();const id=window.setInterval(tick,3_000);return()=>window.clearInterval(id)},[pairCode,pairExpiresAt,refreshDevices]);useEffect(()=>{if(!pairCode||!pairStartedAt)return;const newPcOnline=devices.some(device=>{const createdAt=new Date(device.created_at).getTime();return Number.isFinite(createdAt)&&createdAt>=pairStartedAt-5_000&&recent(device.last_seen_at,6*60_000)});if(newPcOnline){setPairCode('');setPairExpiresAt('');setPairStartedAt(0);setMessage('Companion heartbeat confirmed. This PC is connected and ready for League.')}},[devices,pairStartedAt,pairCode]);
const linked=devices.length>0,online=devices.some(device=>recent(device.last_seen_at,45_000)),snapshot=review?.latestSnapshot??null,me=useMemo(()=>snapshot?findMe(snapshot):null,[snapshot]),ready=Boolean(review&&['COMPLETE','ABORTED'].includes(review.status)&&snapshot),recording=Boolean(review?.status==='ACTIVE'&&recent(review.lastSeenAt,90_000)),staleActive=Boolean(review?.status==='ACTIVE'&&!recent(review.lastSeenAt,90_000)),status=recording?'RECORDING':staleActive?'GAME DATA LOST':online?'READY FOR LEAGUE':linked?'COMPANION OFFLINE':'SETUP REQUIRED',csMin=me&&snapshot?((me.scores.creepScore/Math.max(snapshot.gameTime/60,1/60))).toFixed(1):'—';
useEffect(()=>{if(online&&!connectedTracked.current){connectedTracked.current=true;track('companion_connected',{accountId:active.id,deviceCount:devices.length})}},[online,active.id,devices.length]);
useEffect(()=>{if(recording&&!recordingTracked.current){recordingTracked.current=true;track('companion_recording_started',{accountId:active.id,sessionActive:Boolean(session)})}else if(!recording){recordingTracked.current=false}},[recording,active.id,session]);
useEffect(()=>{if(review?.status!=='COMPLETE')return;const signature=String(review.lastSeenAt||review.snapshotCount||'complete');if(completedReviewTracked.current===signature)return;completedReviewTracked.current=signature;track('companion_game_completed',{accountId:active.id,snapshotCount:review.snapshotCount,sessionActive:Boolean(session)});void refreshAccount()},[review?.status,review?.lastSeenAt,review?.snapshotCount,active.id,session,refreshAccount]);
const accountMatches=matchesFor(active.id);const climbGames=session?gamesInSession(session,accountMatches):[];const sessionTask=session?tasks.find(task=>task.id===session.taskId):undefined;const activeMissions=tasks.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED');const trackingMissions=[...(sessionTask?[sessionTask]:[]),...activeMissions.filter(task=>task.id!==sessionTask?.id)].slice(0,3);const nextGame=Math.min((climbGames.length+1),session?.targetGames||3);const latestSessionGame=climbGames.at(-1);const latestEvidence=sessionTask&&latestSessionGame?missionEvidence(sessionTask,latestSessionGame,active.rank):null;const focusMission=sessionTask??activeMissions[0]??null;
async function pair(source:'manual'|'auto'='manual'){if(!isOwnAccount){setMessage('Switch to your own Riot account before pairing.');return}const startedAt=Date.now();track('companion_pair_started',{accountId:active.id,source});setBusy(true);setMessage('');setPairCode('');setPairExpiresAt('');setPairStartedAt(startedAt);try{const res=await fetch('/api/live/pair/code',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountId:active.id,deviceName,riotProfile:{gameName:active.gameName,tagline:active.tagline,region:active.region,role:active.role,rank:active.rank,champions:active.champions??[],frustration:profile?.frustration??''}})});const body=await res.json();if(!res.ok){setPairStartedAt(0);setMessage(body.error||'Pairing failed.');return}setPairCode(body.code||'');setPairExpiresAt(body.expiresAt||'');setMessage('Secure pairing ready. If the Companion is already installed, use Open Companion & Connect below — no reinstall is needed.')}catch{setPairStartedAt(0);setMessage('Could not reach the pairing service.')}finally{setBusy(false)}}
useEffect(()=>{if(!hydrated||!devicesLoaded||!isOwnAccount||online||pairCode||busy||autoPairStarted.current)return;autoPairStarted.current=true;setMessage('Installed Companion detected. Creating a secure one-time pairing…');void pair('auto')},[hydrated,devicesLoaded,isOwnAccount,online,pairCode,busy,active.id]);
return <div className="match-room">
  <header className="page-head">
    <div>
      <div className="eyebrow">MATCH ROOM · PREPARE → PLAY</div>
      <h1>Know your job before you queue.</h1>
      <p>One focus, one reminder, your champion context and a quiet Companion connection.</p>
    </div>
    <span className={'match-room-state '+(recording?'recording':online?'ready':'offline')}>{recording?'● TRACKING':online?'● READY':'○ CONNECT'}</span>
  </header>

  <section className="match-room-focus panel">
    <div className="eyebrow">{recording?'GAME IN PROGRESS · TRACKING ONLY':'YOUR ONE FOCUS'}</div>
    <h2>{focusMission?.title||session?.taskTitle||'Build your first measurable focus'}</h2>
    <p>{recording?'OP CLIMB is recording the evidence you entered the match with. It will not add live tactical advice.':focusMission?.gameRule||session?.gameRule||'Play one tracked game and OP CLIMB will turn the evidence into one clear next-game rule.'}</p>
    {!recording&&<div className="match-room-cue"><span>REMEMBER</span><strong>{focusMission?.gameRule||session?.gameRule||'One decision. Keep it simple.'}</strong></div>}
    {session&&<div className="match-room-proof"><span>SESSION</span><b>GAME {nextGame}/{session.targetGames}</b><small>{focusMission?.target||session.target}</small></div>}
  </section>

  <div className="match-room-grid">
    <section className="panel panel-padding">
      <div className="eyebrow">CHAMPION PLAN</div>
      <h2 style={{margin:'9px 0'}}>Take the matchup into the game.</h2>
      <p className="muted">Your champion-specific plan stays separate from the coaching focus so you are not carrying five different jobs into queue.</p>
      <div className="mission-actions" style={{marginTop:18}}>
        <Link className="btn" href="/champions/main">Open champion plan →</Link>
        <Link className="btn" href="/ilp">Why this focus?</Link>
      </div>
    </section>

    <section className={'panel panel-padding match-room-companion '+(online?'is-ready':'')}>
      <div className="eyebrow">COMPANION STATUS</div>
      <h2 style={{margin:'9px 0'}}>{status}</h2>
      <p className="muted">{recording?'Tracking is healthy. Coaching resumes after the game.':staleActive?'Fresh telemetry has stopped. Reconnect the Companion before relying on this game as evidence.':online?'Companion is connected. Leave it in the Windows tray and play normally.':linked?'Your PC is registered but the Companion is offline.':'Connect the Windows Companion once so OP CLIMB can record your League matches.'}</p>
      <div className={'match-room-ready '+(online?'is-ready':'')}>{recording?'GAME ACTIVE':online?'READY FOR GAME':'COMPANION NOT READY'}</div>
    </section>
  </div>

  {ready&&review?.matchId&&<section className="panel panel-padding match-room-complete">
    <div><div className="eyebrow">GAME COMPLETE</div><h2>Review it in My Games.</h2><p className="muted">Match Room is for preparation. The coaching review now lives where your match history lives.</p></div>
    <Link className="btn primary" href={'/analyse/'+encodeURIComponent(review.matchId)}>Open review →</Link>
  </section>}

  <details className="panel panel-padding match-room-setup" open={!online||Boolean(pairCode)}>
    <summary>{online?'COMPANION SETUP & DEVICES':linked?'COMPANION OFFLINE — RECONNECT':'CONNECT THIS WINDOWS PC'}</summary>
    <div style={{marginTop:16}}>
      <p className="muted">Already installed? Connect it directly below. Only download the installer if this PC does not have OP CLIMB Companion yet.</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end'}}>
        <label style={{display:'grid',gap:6,minWidth:220}}><span className="muted">Device name</span><input value={deviceName} onChange={e=>setDeviceName(e.target.value)} maxLength={80} style={{padding:'12px 14px'}}/></label>
        <button className="btn primary" type="button" disabled={busy||!isOwnAccount} onClick={()=>void pair()}>{busy?'CREATING SECURE PAIRING…':online?'PAIR ANOTHER PC':'CONNECT INSTALLED COMPANION'}</button>
        <a className="btn" href="/download/windows" target="_blank" rel="noopener">DOWNLOAD COMPANION</a>
      </div>
      {message&&<p style={{marginTop:12}}>{message}</p>}
      {pairCode&&<WindowsTrackerInstaller code={pairCode}/>}
    </div>
  </details>
</div>;
}
function Mini({label,value}:{label:string;value:string}){return <div className="glass op-live-metric"><div className="eyebrow">{label}</div><strong>{value}</strong></div>}function findMe(s:Snapshot){return s.players.find(p=>Boolean(s.active.riotId&&p.riotId===s.active.riotId))||s.players.find(p=>p.summonerName===s.active.summonerName)||s.players.find(p=>p.championName===s.active.championName)||null}function role(v:string|null){const x=(v||'').toUpperCase();return x==='BOTTOM'?'ADC':x||'ROLE UNKNOWN'}function clock(sec:number){const n=Math.max(0,Math.round(sec));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}function recent(value:string|null,ms:number){if(!value)return false;return Date.now()-new Date(value).getTime()<=ms}
