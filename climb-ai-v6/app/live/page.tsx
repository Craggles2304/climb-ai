'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
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
type Item={itemId:number;displayName:string;count:number;price:number};
type Scores={kills:number;deaths:number;assists:number;creepScore:number;wardScore:number};
type Player={
  summonerName:string;riotId:string|null;championName:string;team:'ORDER'|'CHAOS'|'UNKNOWN';
  level:number;position:string|null;isDead:boolean;respawnTimer:number;itemGold:number;items:Item[];scores:Scores;
};
type MatchEvent={id:number|null;name:string;time:number;actor:string|null;target:string|null;raw:Record<string,unknown>};
type Snapshot={
  gameTime:number;gameMode:string|null;mapName:string|null;receivedAt:string;
  active:{summonerName:string;riotId:string|null;championName:string;team:'ORDER'|'CHAOS'|'UNKNOWN';level:number;position:string|null;currentGold:number};
  players:Player[];events:MatchEvent[];
};
type Review={
  sessionId:string;status:'ACTIVE'|'COMPLETE'|'ABORTED'|string;startedAt:string;endedAt:string|null;lastSeenAt:string|null;
  snapshotCount:number;latestSnapshot:Snapshot|null;
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
  const complete=review?.status==='COMPLETE';
  const partial=review?.status==='ABORTED';
  const reviewReady=Boolean(complete||partial);
  const status=live?'RECORDING':complete?'POST-GAME READY':partial?'PARTIAL REVIEW':stale?'COMPANION OFFLINE':paired?'WAITING FOR GAME':'NOT PAIRED';
  const clock=review?.latestSnapshot?formatClock(review.latestSnapshot.gameTime):'—';
  const timeline=reviewReady?(review?.summary?.points??[]):[];
  const opportunities=reviewReady?(review?.summary?.opportunities??[]):[];
  const snapshot=review?.latestSnapshot??null;
  const me=useMemo(()=>snapshot?findMe(snapshot):null,[snapshot]);
  const laneOpponent=useMemo(()=>snapshot&&me?findLaneOpponent(snapshot,me):null,[snapshot,me]);
  const myTeam=snapshot&&me?snapshot.players.filter(player=>player.team===me.team):[];
  const enemyTeam=snapshot&&me?snapshot.players.filter(player=>player.team!==me.team&&player.team!=='UNKNOWN'):[];
  const result=snapshot?inferResult(snapshot.events):'UNKNOWN';

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
    <PageHead title="Live Tracker" subtitle="Silent in-game recording → full post-game match breakdown → saved coaching evidence."/>

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
        </>:<p>{reviewReady?'Your latest recorded game is ready below.':paired?'Your PC is paired. Open the OVERPOWERED Tracker desktop shortcut before League; recording starts automatically when a match becomes available.':'Pair the Windows PC that runs League. Your Riot profile is saved to your login and the companion sends match snapshots to that account.'}</p>}
        <div className="mission-command"><span>{reviewReady?'ILP LEARNING LOOP':'PRE-GAME ILP CUE'}</span><b>{reviewReady?'Completed live games become evidence for your learning plan.':mission?.gameRule||'Open your ILP before queueing.'}</b></div>
      </div>

      <div className="dashboard-stack">
        <div className="glass stat-feature"><span>ACTIVE ACCOUNT</span><strong>{active.gameName}{active.tagline}</strong><small>{active.region} · {active.role}</small></div>
        <div className="glass stat-feature"><span>DURING GAME</span><strong>SILENT RECORDING</strong><small>No automatic shotcalling</small></div>
        <div className="glass stat-feature"><span>AFTER GAME</span><strong>FULL MATCH REVIEW</strong><small>Stats · teams · events · power windows</small></div>
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

    {reviewReady&&snapshot&&<section className="dash-section" style={{display:'grid',gap:18}}>
      <div className="glass card" style={{borderColor:partial?'rgba(255,170,70,.45)':undefined}}>
        <div className="eyebrow">{partial?'PARTIAL GAME REVIEW':'MATCH BREAKDOWN'}</div>
        <h2 style={{marginBottom:6}}>{snapshot.active.championName} · {positionLabel(snapshot.active.position)} · {formatClock(snapshot.gameTime)}</h2>
        <p className="muted" style={{marginTop:0}}>{partial?'Recording ended before the match finished. This review is shown for learning, but it is not treated as a completed game for ILP/mastery scoring.':'Recorded match complete. The review below is built from the telemetry captured during this game.'}</p>

        {me&&<>
          <div className="grid three" style={{marginTop:18}}>
            <Mini label="K / D / A" value={`${me.scores.kills} / ${me.scores.deaths} / ${me.scores.assists}`}/>
            <Mini label="CS" value={`${me.scores.creepScore} · ${csPerMinute(me.scores.creepScore,snapshot.gameTime)} / min`}/>
            <Mini label="VISION" value={formatOne(me.scores.wardScore)}/>
          </div>
          <div className="grid three" style={{marginTop:12}}>
            <Mini label="LEVEL" value={String(me.level)}/>
            <Mini label="VISIBLE ITEM VALUE" value={`${Math.round(me.itemGold)}g`}/>
            <Mini label="RESULT" value={partial?'INCOMPLETE':result}/>
          </div>

          <div className="grid two" style={{marginTop:18}}>
            <div className="glass card">
              <div className="eyebrow">YOUR FINAL BUILD</div>
              <h3 style={{marginTop:8}}>{me.championName}</h3>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{me.items.length?me.items.map((item,index)=><span key={`${item.itemId}-${index}`} style={pillStyle}>{item.displayName}{item.count>1?` ×${item.count}`:''}</span>):<span className="muted">No item data captured.</span>}</div>
              <p className="muted" style={{marginBottom:0,marginTop:12}}>Pocket gold at final snapshot: {Math.round(snapshot.active.currentGold)}g</p>
            </div>
            <div className="glass card">
              <div className="eyebrow">LANE MATCHUP</div>
              {laneOpponent?<><h3 style={{marginTop:8}}>{me.championName} vs {laneOpponent.championName}</h3><p className="muted">You: {me.scores.kills}/{me.scores.deaths}/{me.scores.assists}, {me.scores.creepScore} CS · Them: {laneOpponent.scores.kills}/{laneOpponent.scores.deaths}/{laneOpponent.scores.assists}, {laneOpponent.scores.creepScore} CS</p><p style={{marginBottom:0}}>Visible item value difference: <b>{signedGold(me.itemGold-laneOpponent.itemGold)}</b></p></>:<p className="muted">A same-role lane opponent could not be resolved from the final snapshot.</p>}
            </div>
          </div>
        </>}
      </div>

      <div className="grid two">
        <TeamCard title="YOUR TEAM" players={myTeam} highlightRiotId={snapshot.active.riotId}/>
        <TeamCard title="ENEMY TEAM" players={enemyTeam}/>
      </div>

      <div className="glass card">
        <div className="eyebrow">MATCH EVENT TIMELINE</div>
        <h3>Kills, objectives and major recorded events</h3>
        <p className="muted">Events are taken from Riot&apos;s local match feed. The final snapshot carries the most recent recorded event history.</p>
        <div style={{display:'grid',gap:8,marginTop:14}}>
          {importantEvents(snapshot.events).length?importantEvents(snapshot.events).map((event,index)=><EventRow key={`${event.id??event.time}-${index}`} event={event}/>):<p className="muted">No major events were present in the final snapshot.</p>}
        </div>
      </div>

      <div className="glass card">
        <div className="eyebrow">POST-GAME POWER REVIEW</div>
        <h3>Who was stronger — and when it changed</h3>
        <p className="muted">The model uses visible level, visible item value, your available health/mana and match state. It never pretends enemy pocket gold, proximity or hidden cooldowns are known.</p>
        <div className="grid two" style={{marginTop:16}}>
          <WindowCard title="STRONGEST WINDOW" point={review?.summary?.strongestWindow??null}/>
          <WindowCard title="HARDEST WINDOW" point={review?.summary?.weakestWindow??null}/>
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
        {review?.summary?.modelNote&&<p className="muted" style={{fontSize:12,marginTop:14}}>{review.summary.modelNote}</p>}
      </div>

      <div className="glass card">
        <div className="eyebrow">DATA QUALITY</div>
        <h3>{review?.snapshotCount??0} telemetry snapshots captured</h3>
        <p className="muted" style={{marginBottom:0}}>Captured through {clock}. {complete?'This session closed normally and can be used by the post-game learning loop.':'This session is incomplete and is displayed for review only.'}</p>
      </div>
    </section>}

    <div className="grid three dash-section">
      <div className="glass card"><div className="eyebrow">SAVED IDENTITY</div><h3>One player history</h3><p className="muted">Pairing saves the Riot identity to the signed-in user so later sessions build one evidence history instead of isolated demos.</p></div>
      <div className="glass card"><div className="eyebrow">POLICY-SAFE DESIGN</div><h3>No live shotcaller</h3><p className="muted">The companion records permitted local state silently. Fight-window verdicts are withheld while the match is active and exposed after the session closes.</p></div>
      <div className="glass card"><div className="eyebrow">NEXT LEARNING LOOP</div><h3>Feed the ILP</h3><p className="muted">Completed post-game windows become evidence for missions such as recognising level/item spikes and avoiding enemy-favoured fights.</p></div>
    </div>
  </AppShell>;
}

const pillStyle:React.CSSProperties={padding:'7px 10px',border:'1px solid rgba(255,255,255,.12)',borderRadius:999,fontSize:12,background:'rgba(255,255,255,.04)'};

function Mini({label,value}:{label:string;value:string}){return <div className="glass card"><span className="eyebrow">{label}</span><strong style={{display:'block',fontSize:22,marginTop:4}}>{value}</strong></div>}

function TeamCard({title,players,highlightRiotId}:{title:string;players:Player[];highlightRiotId?:string|null}){
  return <div className="glass card"><div className="eyebrow">{title}</div><div style={{display:'grid',gap:8,marginTop:12}}>{players.map((player,index)=><div key={`${player.riotId||player.summonerName}-${index}`} style={{display:'grid',gridTemplateColumns:'minmax(100px,1.2fr) 70px 70px',gap:10,alignItems:'center',padding:'9px 0',borderBottom:index===players.length-1?'none':'1px solid rgba(255,255,255,.07)'}}><div><b>{player.championName}</b>{player.riotId===highlightRiotId&&<span style={{marginLeft:7,fontSize:10,opacity:.7}}>YOU</span>}<div className="muted" style={{fontSize:11}}>{positionLabel(player.position)} · L{player.level}</div></div><div style={{fontSize:12}}>{player.scores.kills}/{player.scores.deaths}/{player.scores.assists}</div><div className="muted" style={{fontSize:12,textAlign:'right'}}>{player.scores.creepScore} CS</div></div>)}</div></div>;
}

function EventRow({event}:{event:MatchEvent}){
  const label=event.name==='ChampionKill'&&event.actor&&event.target?`${event.actor} killed ${event.target}`:eventLabel(event);
  return <div style={{display:'grid',gridTemplateColumns:'70px minmax(0,1fr)',gap:12,padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,.06)'}}><strong>{formatClock(event.time)}</strong><div><b>{prettyEventName(event.name)}</b><div className="muted" style={{fontSize:12,marginTop:2}}>{label}</div></div></div>;
}

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

function findMe(snapshot:Snapshot){
  return snapshot.players.find(player=>Boolean(snapshot.active.riotId&&player.riotId===snapshot.active.riotId))
    ??snapshot.players.find(player=>Boolean(snapshot.active.summonerName&&player.summonerName===snapshot.active.summonerName))
    ??snapshot.players.find(player=>player.championName===snapshot.active.championName&&player.team===snapshot.active.team)
    ??null;
}
function findLaneOpponent(snapshot:Snapshot,me:Player){
  if(!me.position)return null;
  return snapshot.players.find(player=>player.team!==me.team&&player.position===me.position)??null;
}
function importantEvents(events:MatchEvent[]){
  const allowed=new Set(['ChampionKill','DragonKill','BaronKill','HeraldKill','HordeKill','TurretKilled','InhibKilled','FirstBlood','Multikill','GameEnd']);
  return events.filter(event=>allowed.has(event.name));
}
function inferResult(events:MatchEvent[]){
  for(let i=events.length-1;i>=0;i--){
    if(events[i].name.toLowerCase()!=='gameend')continue;
    const value=String(events[i].raw?.Result??events[i].raw?.result??'').toLowerCase();
    if(value.includes('win'))return'WIN';
    if(value.includes('lose')||value.includes('loss'))return'LOSS';
  }
  return'UNKNOWN';
}
function eventLabel(event:MatchEvent){
  if(event.actor&&event.target)return`${event.actor} → ${event.target}`;
  if(event.actor)return event.actor;
  if(event.target)return event.target;
  return prettyEventName(event.name);
}
function prettyEventName(name:string){return name.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/Kill$/,' Kill')}
function positionLabel(value:string|null){const v=(value||'').toUpperCase();return v==='BOTTOM'?'ADC':v==='UTILITY'?'SUPPORT':v==='MIDDLE'?'MID':v==='TOP'?'TOP':v==='JUNGLE'?'JUNGLE':v||'UNKNOWN'}
function csPerMinute(cs:number,seconds:number){if(seconds<=0)return'0.0';return (cs/(seconds/60)).toFixed(1)}
function formatOne(value:number){return Number.isFinite(value)?value.toFixed(1):'0.0'}
function signedGold(value:number){return`${value>0?'+':''}${Math.round(value)}g`}
function labelOf(value:StrengthPoint['verdict']){return value==='YOU_STRONGER'?'YOU STRONGER':value==='THEM_STRONGER'?'THEY ARE STRONGER':'EVEN WINDOW'}
function signed(value:number){return `${value>0?'+':''}${Math.round(value*10)/10}`}
function formatClock(seconds:number){const s=Math.max(0,Math.floor(seconds));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function isRecent(value:string|null|undefined,windowMs:number){if(!value)return false;const time=Date.parse(value);return Number.isFinite(time)&&Date.now()-time<=windowMs}
