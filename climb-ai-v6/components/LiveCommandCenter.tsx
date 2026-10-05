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
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {useProMatch} from './useProMatch';
import {analyseMatch} from '@/lib/engine';
import {buildReview} from '@/lib/review';
import {positiveEvidenceForMatch} from '@/lib/positiveEvidence';
import {canonicalLeagueRole} from '@/lib/roleAwareLearning';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';

type Device={id:string;account_key:string;device_name:string;created_at:string;last_seen_at:string|null};type Item={itemId:number;displayName:string;count:number;price:number};type Player={summonerName:string;riotId:string|null;championName:string;team:string;level:number;position:string|null;itemGold:number;items:Item[];scores:{kills:number;deaths:number;assists:number;creepScore:number;wardScore:number}};type Snapshot={gameTime:number;active:{summonerName:string;riotId:string|null;championName:string;position:string|null;currentGold:number};players:Player[]};type Review={matchId?:string|null;status:string;lastSeenAt:string|null;snapshotCount:number;latestSnapshot:Snapshot|null;summary?:{processing?:{status?:string|null}|null}|null};
export function LiveCommandCenter(){const {active,isOwnAccount,profile,hydrated,refresh:refreshAccount}=useAccount();const {tasks}=useLearningPlan();const detail=coachingLevelFor(active.rank);const [devices,setDevices]=useState<Device[]>([]);const [devicesLoaded,setDevicesLoaded]=useState(false);const [review,setReview]=useState<Review|null>(null);const [pairCode,setPairCode]=useState('');const [pairExpiresAt,setPairExpiresAt]=useState('');const [pairStartedAt,setPairStartedAt]=useState(0);const [deviceName,setDeviceName]=useState('My Windows PC');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [session,setSession]=useState<ClimbSessionState|null>(null);const autoPairStarted=useRef(false);const connectedTracked=useRef(false);const recordingTracked=useRef(false);const completedReviewTracked=useRef('');
const refreshDevices=useCallback(async()=>{try{const response=await fetch('/api/live/pair',{cache:'no-store'});if(!response.ok)return;const body=await response.json();setDevices((body.devices??[]).filter((x:Device)=>x.account_key===active.id))}catch{}finally{setDevicesLoaded(true)}},[active.id]);const refreshReview=useCallback(async()=>{try{const response=await fetch(`/api/live/telemetry?accountId=${encodeURIComponent(active.id)}`,{cache:'no-store'});if(!response.ok)return;const body=await response.json();setReview(body.review??null)}catch{}},[active.id]);const refresh=useCallback(async()=>{await Promise.all([refreshDevices(),refreshReview()])},[refreshDevices,refreshReview]);
useEffect(()=>{connectedTracked.current=false;recordingTracked.current=false;completedReviewTracked.current='';setSession(readClimbSession(active.id));const sync=()=>setSession(readClimbSession(active.id));window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[active.id]);useEffect(()=>{setDevicesLoaded(false);autoPairStarted.current=false;void refresh();const reviewTick=()=>{if(document.visibilityState==='visible'){void refreshReview();setSession(readClimbSession(active.id))}};const deviceTick=()=>{if(document.visibilityState==='visible')void refreshDevices()};const onVisibility=()=>{if(document.visibilityState==='visible')void refresh()};const reviewId=window.setInterval(reviewTick,10_000);const deviceId=window.setInterval(deviceTick,30_000);document.addEventListener('visibilitychange',onVisibility);return()=>{window.clearInterval(reviewId);window.clearInterval(deviceId);document.removeEventListener('visibilitychange',onVisibility)}},[active.id,refresh,refreshDevices,refreshReview]);
useEffect(()=>{if(!pairCode)return;const tick=()=>{if(pairExpiresAt&&Date.now()>=new Date(pairExpiresAt).getTime()){setPairCode('');setPairExpiresAt('');setPairStartedAt(0);setMessage('That pairing link expired. Choose Connect installed Companion to create a fresh one.');return}void refreshDevices()};tick();const id=window.setInterval(tick,3_000);return()=>window.clearInterval(id)},[pairCode,pairExpiresAt,refreshDevices]);useEffect(()=>{if(!pairCode||!pairStartedAt)return;const newPcOnline=devices.some(device=>{const createdAt=new Date(device.created_at).getTime();return Number.isFinite(createdAt)&&createdAt>=pairStartedAt-5_000&&recent(device.last_seen_at,6*60_000)});if(newPcOnline){setPairCode('');setPairExpiresAt('');setPairStartedAt(0);setMessage('Companion heartbeat confirmed. This PC is connected and ready for League.')}},[devices,pairStartedAt,pairCode]);
const linked=devices.length>0,online=devices.some(device=>recent(device.last_seen_at,45_000)),lastDeviceSeenAt=devices.map(device=>device.last_seen_at).filter((value):value is string=>Boolean(value)).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]??null,cloudDisconnected=Boolean(linked&&!online&&lastDeviceSeenAt&&!recent(lastDeviceSeenAt,5*60_000)),snapshot=review?.latestSnapshot??null,me=useMemo(()=>snapshot?findMe(snapshot):null,[snapshot]),ready=Boolean(review&&['COMPLETE','ABORTED'].includes(review.status)&&snapshot),recording=Boolean(review?.status==='ACTIVE'&&recent(review.lastSeenAt,90_000)),staleActive=Boolean(review?.status==='ACTIVE'&&!recent(review.lastSeenAt,90_000)),status=recording?'RECORDING':staleActive?'GAME DATA LOST':online?'READY FOR LEAGUE':cloudDisconnected?'CLOUD SYNC DISCONNECTED':linked?'COMPANION OFFLINE':'SETUP REQUIRED',csMin=me&&snapshot?((me.scores.creepScore/Math.max(snapshot.gameTime/60,1/60))).toFixed(1):'—';
const postgameProcessing=Boolean(review&&['QUEUED','PROCESSING'].includes(String(review.summary?.processing?.status??'')));
useEffect(()=>{if(online&&!connectedTracked.current){connectedTracked.current=true;track('companion_connected',{accountId:active.id,deviceCount:devices.length})}},[online,active.id,devices.length]);
useEffect(()=>{if(recording&&!recordingTracked.current){recordingTracked.current=true;track('companion_recording_started',{accountId:active.id,sessionActive:Boolean(session)})}else if(!recording){recordingTracked.current=false}},[recording,active.id,session]);
useEffect(()=>{if(review?.status!=='COMPLETE')return;const signature=String(review.lastSeenAt||review.snapshotCount||'complete');if(completedReviewTracked.current===signature)return;completedReviewTracked.current=signature;track('companion_game_completed',{accountId:active.id,snapshotCount:review.snapshotCount,sessionActive:Boolean(session)});void refreshAccount()},[review?.status,review?.lastSeenAt,review?.snapshotCount,active.id,session,refreshAccount]);
const accountMatches=matchesFor(active.id);
const baselineGames=dnaBaselineGameCount(accountMatches,active.role);
const baselineReady=dnaBaselineReady(baselineGames);
const climbGames=session?gamesInSession(session,accountMatches):[];
const sessionTask=session?tasks.find(task=>task.id===session.taskId):undefined;
const activeMissions=baselineReady?tasks.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED'):[];
const trackingMissions=[...(sessionTask?[sessionTask]:[]),...activeMissions.filter(task=>task.id!==sessionTask?.id)].slice(0,3);
const nextGame=Math.min((climbGames.length+1),session?.targetGames||3);
const latestSessionGame=climbGames.at(-1);
const latestEvidence=sessionTask&&latestSessionGame?missionEvidence(sessionTask,latestSessionGame,active.rank):null;
const focusMission=baselineReady?(sessionTask??activeMissions[0]??null):null;

const latestMatch=useMemo(()=>[...accountMatches]
  .filter(match=>match.durationSeconds>=300)
  .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0],[accountMatches]);
const embeddedLastGameAnalysis=latestMatch?.proAnalysis;
const {analysis:fetchedLastGameAnalysis,loading:lastGameAnalysisLoading}=useProMatch(embeddedLastGameAnalysis?undefined:latestMatch?.id);
const lastGameAnalysis=embeddedLastGameAnalysis??fetchedLastGameAnalysis??undefined;
const lastGameRole=canonicalLeagueRole(latestMatch?.role);
const lastGameHistory=useMemo(()=>latestMatch?[...accountMatches]
  .filter(match=>match.id!==latestMatch.id&&(!lastGameRole||canonicalLeagueRole(match.role)===lastGameRole))
  .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))
  .slice(0,5):[],[accountMatches,latestMatch?.id,lastGameRole]);
const lastGameReport=useMemo(()=>latestMatch?analyseMatch({...latestMatch,proAnalysis:lastGameAnalysis},lastGameHistory):null,[latestMatch,lastGameAnalysis,lastGameHistory]);
const lastGameReview=useMemo(()=>latestMatch&&lastGameReport?buildReview({...latestMatch,proAnalysis:lastGameAnalysis},lastGameReport,active.rank):null,[latestMatch,lastGameAnalysis,lastGameReport,active.rank]);
const lastGameStrengths=useMemo(()=>latestMatch?positiveEvidenceForMatch({...latestMatch,proAnalysis:lastGameAnalysis},active.rank):[],[latestMatch,lastGameAnalysis,active.rank]);
const lastGameMoments=useMemo(()=>reviewMoments(lastGameAnalysis),[lastGameAnalysis]);
async function pair(source:'manual'|'auto'='manual'){if(!isOwnAccount){setMessage('Switch to your own Riot account before pairing.');return}const startedAt=Date.now();track('companion_pair_started',{accountId:active.id,source});setBusy(true);setMessage('');setPairCode('');setPairExpiresAt('');setPairStartedAt(startedAt);try{const res=await fetch('/api/live/pair/code',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({accountId:active.id,deviceName,riotProfile:{gameName:active.gameName,tagline:active.tagline,region:active.region,role:active.role,rank:active.rank,champions:active.champions??[],frustration:profile?.frustration??''}})});const body=await res.json();if(!res.ok){setPairStartedAt(0);setMessage(body.error||'Pairing failed.');return}setPairCode(body.code||'');setPairExpiresAt(body.expiresAt||'');setMessage('Secure pairing ready. If the Companion is already installed, use Open Companion & Connect below — no reinstall is needed.')}catch{setPairStartedAt(0);setMessage('Could not reach the pairing service.')}finally{setBusy(false)}}
useEffect(()=>{if(!hydrated||!devicesLoaded||!isOwnAccount||online||pairCode||busy||autoPairStarted.current)return;autoPairStarted.current=true;setMessage('Installed Companion detected. Creating a secure one-time pairing…');void pair('auto')},[hydrated,devicesLoaded,isOwnAccount,online,pairCode,busy,active.id]);
return <div className="match-room">
  <header className="page-head">
    <div>
      <div className="eyebrow">{recording?'MATCH ROOM · LIVE TRACKING':postgameProcessing?'MATCH ROOM · GAME COMPLETE':cloudDisconnected?'MATCH ROOM · CLOUD SYNC DISCONNECTED':latestMatch?'MATCH ROOM · LAST GAME':'MATCH ROOM · PREPARE → PLAY'}</div>
      <h1>{recording?'Game in progress.':postgameProcessing?'Your review is processing.':cloudDisconnected?'Your desktop and Match Room are out of sync.':latestMatch?latestMatch.champion+' · '+(latestMatch.result==='WIN'?'VICTORY':'DEFEAT'):'Know your job before you queue.'}</h1>
      <p>{recording?'OP CLIMB is quietly collecting evidence. Coaching resumes when the game ends.':postgameProcessing?'The match is safely stored. OP CLIMB is building the review, evidence and learning updates in the post-game queue.':cloudDisconnected?'Your Companion may still be reading League locally, but this page is not receiving its heartbeat. Reconnect the installed Companion once; the review below is only the last cloud-synced game.':latestMatch?'See what happened, where it went wrong and the one thing to carry into your next game.':'One focus, one reminder, your champion context and a quiet Companion connection.'}</p>
    </div>
    <span className={'match-room-state '+(recording?'recording':postgameProcessing?'recording':cloudDisconnected?'offline':latestMatch||online?'ready':'offline')}>{recording?'● TRACKING':postgameProcessing?'● PROCESSING':cloudDisconnected?'○ RECONNECT':latestMatch?'● REVIEW READY':online?'● READY':'○ CONNECT'}</span>
  </header>

  {recording&&<section className="panel panel-padding match-room-live-stats">
    <div className="match-room-live-head">
      <div>
        <div className="eyebrow">LIVE MATCH DATA · TRACKING ONLY</div>
        <h2>{me?.championName||snapshot?.active.championName||'League match'} · {role(me?.position??snapshot?.active.position??null)}</h2>
        <p>Stats update from the Companion. OP CLIMB is recording evidence only — it does not add live tactical advice.</p>
      </div>
      <span className="match-room-live-dot">● LIVE</span>
    </div>
    {snapshot&&me?<><div className="match-room-live-metrics">
      <Mini label="GAME TIME" value={clock(snapshot.gameTime)}/>
      <Mini label="FARM" value={String(me.scores.creepScore)}/>
      <Mini label="CS / MIN" value={csMin}/>
      <Mini label="KDA" value={me.scores.kills+'/'+me.scores.deaths+'/'+me.scores.assists}/>
      <Mini label="CURRENT GOLD" value={Math.round(snapshot.active.currentGold).toLocaleString()}/>
      <Mini label="LEVEL" value={String(me.level)}/>
    </div>
    <div className="match-room-live-items">
      <span className="eyebrow">CURRENT ITEMS</span>
      <div>{me.items.length?me.items.map((item,index)=><span key={item.itemId+'-'+index}><b>{item.displayName}</b>{item.count>1?<small>×{item.count}</small>:null}</span>):<em>No completed item data yet.</em>}</div>
    </div></>:<div className="match-room-live-wait">Waiting for the first live snapshot from the Companion…</div>}
  </section>}

  {cloudDisconnected&&<section className="panel panel-padding match-room-sync-alert">
    <div>
      <div className="eyebrow">SYNC BROKEN · LOCAL APP ≠ CLOUD MATCH ROOM</div>
      <h2>Your current game cannot reach this page yet.</h2>
      <p>OP CLIMB has not received a fresh Companion heartbeat for more than five minutes. Do not reinstall. Reconnect the installed Companion below so the next game, post-game review and Match Room all use the same session.</p>
    </div>
    <button className="btn primary" type="button" disabled={busy||!isOwnAccount} onClick={()=>void pair()}>{busy?'CREATING SECURE PAIRING…':'RECONNECT INSTALLED COMPANION'}</button>
  </section>}

  {postgameProcessing&&<section className="panel panel-padding match-room-complete">
    <div>
      <div className="eyebrow">GAME COMPLETE · PROCESSING</div>
      <h2>Your match is safe. The heavy work is queued.</h2>
      <p className="muted">Analysis, review events and learning updates now run outside the Companion upload request. This keeps game-end spikes stable when many players finish together.</p>
    </div>
    <span className="match-room-state recording">● QUEUED</span>
  </section>}

  {!recording&&!postgameProcessing&&latestMatch&&lastGameReport&&lastGameReview&&<section className="match-room-last-game">
    <article className="panel match-room-review-hero">
      <div>
        <div className="eyebrow">{cloudDisconnected?'LAST CLOUD-SYNCED GAME':'LAST GAME REVIEW'} · {canonicalLeagueRole(latestMatch.role)||latestMatch.role}</div>
        <h2>{lastGameReview.headline}</h2>
        <p>{latestMatch.champion} · {latestMatch.kills}/{latestMatch.deaths}/{latestMatch.assists} · {clock(latestMatch.durationSeconds)} · {latestMatch.result==='WIN'?'Victory':'Defeat'}</p>
      </div>
      <div className="match-room-review-stats">
        <span><small>CS / MIN</small><b>{Number.isFinite(latestMatch.metrics.csPerMin)?latestMatch.metrics.csPerMin.toFixed(1):'—'}</b></span>
        <span><small>DEATHS</small><b>{latestMatch.deaths}</b></span>
        <span><small>ROLE</small><b>{canonicalLeagueRole(latestMatch.role)||latestMatch.role}</b></span>
      </div>
    </article>

    <div className="match-room-review-grid">
      <article className="panel panel-padding match-room-review-card is-problem">
        <div className="eyebrow">WHAT HURT YOU</div>
        <h3>{lastGameReview.biggestMistake.title}</h3>
        <p>{lastGameReport.primary.inference}</p>
        <div className="match-room-proof-list">
          {lastGameReview.biggestMistake.evidence.slice(0,3).map((line,index)=><div key={index}><span>{String(index+1).padStart(2,'0')}</span><b>{line}</b></div>)}
        </div>
      </article>

      <article className="panel panel-padding match-room-review-card is-strength">
        <div className="eyebrow">WHAT YOU DID WELL</div>
        {lastGameStrengths.length?<>{lastGameStrengths.slice(0,2).map(item=><div className="match-room-strength" key={item.id}><span>✓ {item.subskill}</span><h3>{item.title}</h3><p>{item.whatHappened}</p></div>)}</>:<><h3>No verified strength yet.</h3><p>OP CLIMB will not invent praise. It only calls a strength when the evidence clears the bar.</p></>}
      </article>

      <article className="panel panel-padding match-room-review-card">
        <div className="eyebrow">KEY MOMENTS</div>
        <h3>{lastGameMoments.length?'Where the game told the story.':'Still building timestamp evidence.'}</h3>
        <div className="match-room-moment-list">
          {lastGameMoments.map(moment=><div key={moment.key}><strong>{moment.clock}</strong><span><b>{moment.label}</b><small>{moment.detail}</small></span></div>)}
          {!lastGameMoments.length&&<p>{lastGameAnalysisLoading?'Reading the full game evidence…':'No reliable timestamped coaching moments were available for this game.'}</p>}
        </div>
      </article>

      <article className="panel panel-padding match-room-review-card is-next">
        <div className="eyebrow">NEXT GAME · ONE THING</div>
        <h3>{lastGameReport.mission.title}</h3>
        <p>{lastGameReview.mission.rule}</p>
        <div className="match-room-pass-bar"><span>WE'LL KNOW IT'S IMPROVING WHEN</span><b>{lastGameReview.mission.target}</b></div>
      </article>
    </div>

    <div className="match-room-review-actions">
      <Link className="btn primary" href={'/analyse/'+encodeURIComponent(latestMatch.id)}>OPEN FULL GAME REVIEW →</Link>
      <Link className="btn secondary" href="/ilp">SEE MY DNA</Link>
    </div>
  </section>}


  <section className="match-room-focus panel">
    <div className="eyebrow">{recording?'GAME IN PROGRESS · TRACKING ONLY':baselineReady?'NEXT MATCH · YOUR ONE FOCUS':'NEXT MATCH · DNA BASELINE'}</div>
    <h2>{baselineReady?(focusMission?.title||session?.taskTitle||'Your first challenge is building'):`Baseline game ${Math.min(baselineGames+1,DNA_BASELINE_GAMES)} of ${DNA_BASELINE_GAMES}`}</h2>
    <p>{recording?'OP CLIMB is recording the evidence you entered the match with. It will not add live tactical advice.':baselineReady?(focusMission?.gameRule||session?.gameRule||'Your next tracked game will keep shaping your evidence-backed challenge.'):'Play normally. OP CLIMB is learning your starting habits before it gives you a personalised challenge.'}</p>
    {!recording&&<div className="match-room-cue"><span>REMEMBER</span><strong>{baselineReady?(focusMission?.gameRule||session?.gameRule||'One decision. Keep it simple.'):'Do not change your play for the system yet — give it a real baseline.'}</strong></div>}
    {session&&<div className="match-room-proof"><span>SESSION</span><b>GAME {nextGame}/{session.targetGames}</b><small>{focusMission?.target||session.target}</small></div>}
  </section>

  <div className="match-room-grid">
    <section className="panel panel-padding">
      <div className="eyebrow">CHAMPION PLAN</div>
      <h2 style={{margin:'9px 0'}}>Take the matchup into the game.</h2>
      <p className="muted">Your champion-specific plan stays separate from the coaching focus so you are not carrying five different jobs into queue.</p>
      <div className="mission-actions" style={{marginTop:18}}>
        <Link className="btn" href="/champions/main">Open champion plan →</Link>
        <Link className="btn" href="/ilp">{baselineReady?'Open My DNA':'How DNA baseline works'}</Link>
      </div>
    </section>

    <section className={'panel panel-padding match-room-companion '+(online?'is-ready':'')}>
      <div className="eyebrow">COMPANION STATUS</div>
      <h2 style={{margin:'9px 0'}}>{status}</h2>
      <p className="muted">{recording?'Tracking is healthy. Coaching resumes after the game.':staleActive?'Fresh telemetry has stopped. Reconnect the Companion before relying on this game as evidence.':online?'Companion is connected. Leave it in the Windows tray and play normally.':cloudDisconnected?'This PC is registered, but its cloud heartbeat is stale. The desktop may still look live locally; reconnect it before trusting Match Room or post-game sync.':linked?'Your PC is registered but the Companion is offline.':'Connect the Windows Companion once so OP CLIMB can record your League matches.'}</p>
      <div className={'match-room-ready '+(online?'is-ready':'')}>{recording?'GAME ACTIVE':online?'READY FOR GAME':'COMPANION NOT READY'}</div>
    </section>
  </div>

  {ready&&review?.matchId&&review.matchId!==latestMatch?.id&&<section className="panel panel-padding match-room-complete">
    <div><div className="eyebrow">GAME COMPLETE · PROCESSING</div><h2>Your latest review is being attached.</h2><p className="muted">The match has ended. OP CLIMB is turning the recorded evidence into the Match Room review above.</p></div>
    <div className="mission-actions">
      <Link className="btn secondary" href={'/analyse/'+encodeURIComponent(review.matchId)}>OPEN SAVED MATCH</Link>
    </div>
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

type ReviewMoment={key:string;clock:string;label:string;detail:string};

function reviewMoments(analysis?:ProMatchAnalysis):ReviewMoment[]{
  if(!analysis)return[];
  const rows:ReviewMoment[]=[];
  for(const leak of analysis.leakSignals??[]){
    for(const seconds of leak.evidenceSeconds??[]){
      if(!Number.isFinite(seconds))continue;
      rows.push({key:'leak-'+leak.key+'-'+seconds,clock:clock(seconds),label:leak.label,detail:leak.detail});
    }
  }
  for(const metric of Object.values(analysis.metrics??{})){
    if(!metric)continue;
    for(const evidence of metric.evidence??[]){
      if(typeof evidence.atSeconds!=='number'||!Number.isFinite(evidence.atSeconds))continue;
      rows.push({key:'metric-'+metric.key+'-'+evidence.atSeconds+'-'+evidence.label,clock:clock(evidence.atSeconds),label:evidence.label||metric.label,detail:evidence.detail||metric.summary});
    }
  }
  const seen=new Set<string>();
  return rows
    .sort((a,b)=>clockSeconds(a.clock)-clockSeconds(b.clock))
    .filter(row=>{const key=row.clock+'|'+row.label+'|'+row.detail;if(seen.has(key))return false;seen.add(key);return true})
    .slice(0,3);
}

function clockSeconds(value:string){
  const [m,s]=value.split(':').map(Number);
  return (Number.isFinite(m)?m:0)*60+(Number.isFinite(s)?s:0);
}
function Mini({label,value}:{label:string;value:string}){return <div className="glass op-live-metric"><div className="eyebrow">{label}</div><strong>{value}</strong></div>}function findMe(s:Snapshot){return s.players.find(p=>Boolean(s.active.riotId&&p.riotId===s.active.riotId))||s.players.find(p=>p.summonerName===s.active.summonerName)||s.players.find(p=>p.championName===s.active.championName)||null}function role(v:string|null){const x=(v||'').toUpperCase();return x==='BOTTOM'?'ADC':x||'ROLE UNKNOWN'}function clock(sec:number){const n=Math.max(0,Math.round(sec));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}function recent(value:string|null,ms:number){if(!value)return false;return Date.now()-new Date(value).getTime()<=ms}
