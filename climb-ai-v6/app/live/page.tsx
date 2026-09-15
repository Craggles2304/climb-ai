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
type Insight={title:string;detail:string};

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
      if(reviewRes.ok){const body=await reviewRes.json();setReview(body.review??null)}
    }catch{}
  },[active.id]);

  useEffect(()=>{setOrigin(window.location.origin);void refresh();const id=window.setInterval(()=>void refresh(),10_000);return()=>window.clearInterval(id)},[refresh]);

  const paired=devices.length>0;
  const live=review?.status==='ACTIVE'&&isRecent(review.lastSeenAt,30_000);
  const stale=review?.status==='ACTIVE'&&!live;
  const complete=review?.status==='COMPLETE';
  const partial=review?.status==='ABORTED';
  const reviewReady=Boolean(complete||partial);
  const status=live?'GAME DETECTED':complete?'REVIEW READY':partial?'PARTIAL REVIEW':stale?'COMPANION OFFLINE':paired?'READY FOR NEXT GAME':'SET UP COMPANION';
  const snapshot=review?.latestSnapshot??null;
  const me=useMemo(()=>snapshot?findMe(snapshot):null,[snapshot]);
  const laneOpponent=useMemo(()=>snapshot&&me?findLaneOpponent(snapshot,me):null,[snapshot,me]);
  const result=snapshot?inferResult(snapshot.events):'UNKNOWN';
  const clock=snapshot?formatClock(snapshot.gameTime):'—';
  const postGame=useMemo(()=>snapshot&&me?buildPostGameReview({me,laneOpponent,review,snapshot,result,missionRule:mission?.gameRule,partial:Boolean(partial)}):null,[snapshot,me,laneOpponent,review,result,mission?.gameRule,partial]);

  async function pair(){
    if(!isOwnAccount){setMessage('Switch to your own Riot account before pairing the tracker.');return}
    setBusy(true);setMessage('');setPairToken('');
    try{
      const response=await fetch('/api/live/pair',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          accountId:active.id,deviceName,
          riotProfile:{gameName:active.gameName,tagline:active.tagline,region:active.region,role:active.role,rank:active.rank,champions:active.champions??[],frustration:profile?.frustration??''},
        }),
      });
      const body=await response.json();
      if(!response.ok){setMessage(body.error||'Pairing failed.');return}
      setPairToken(body.token||'');
      setMessage(`PC paired to ${body.riotAccount?.game_name||active.gameName}. Run the Windows tracker before League.`);
      await refresh();
    }catch{setMessage('Could not reach the pairing service.')}finally{setBusy(false)}
  }

  const setup=<div className="glass card">
    <div className="eyebrow">ONE-TIME SETUP</div>
    <h3>Connect the PC running League</h3>
    <p className="muted">Once paired, the Companion detects matches and records permitted telemetry automatically.</p>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end',marginTop:14}}>
      <label style={{display:'grid',gap:6,minWidth:220}}><span className="muted">Device name</span><input value={deviceName} onChange={e=>setDeviceName(e.target.value)} maxLength={80} style={{padding:'12px 14px',borderRadius:12}}/></label>
      <button className="btn primary" disabled={busy||!isOwnAccount} onClick={pair}>{busy?'PAIRING…':'PAIR THIS PC'}</button>
    </div>
    {!isOwnAccount&&<p className="muted" style={{marginTop:10}}>Switch to your own Riot account before pairing.</p>}
    {message&&<p style={{marginTop:12}}>{message}</p>}
    {pairToken&&<WindowsTrackerInstaller token={pairToken} origin={origin}/>} 
  </div>;

  return <AppShell>
    <PageHead title="League Companion" subtitle="One focus during the game. The important lessons after it."/>

    <section className="glass card" style={{padding:24}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'flex-start',flexWrap:'wrap'}}>
        <div>
          <div className="eyebrow">COMPANION</div>
          <h1 style={{margin:'5px 0 6px'}}>{status}</h1>
          <p className="muted" style={{margin:0}}>{live?'The Companion is recording quietly. Keep playing — no live shotcalling or clutter.':reviewReady?'Your match is finished. Read the short review below.':paired?'Open the Windows tracker before League. The rest is automatic.':'Pair this PC once, then the Companion stays simple.'}</p>
        </div>
        <span className={`op-tier ${live?'op-tier-pro':paired?'op-tier-plus':'op-tier-free'}`}>{live?'RECORDING':paired?'CONNECTED':'SETUP'}</span>
      </div>

      {live&&<div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:16,alignItems:'center',marginTop:22,padding:18,borderRadius:16,background:'rgba(255,255,255,.04)'}}>
        <div><div className="eyebrow">ONE FOCUS</div><h2 style={{margin:'5px 0'}}>{mission?.title||'Play your normal game'}</h2><p style={{margin:0}}>{mission?.gameRule||'The Companion will find the useful review points after the game.'}</p></div>
        <div style={{textAlign:'right'}}><div className="eyebrow">{snapshot?.active.championName||'LEAGUE'}</div><strong style={{fontSize:30}}>{clock}</strong></div>
      </div>}

      {!live&&!reviewReady&&paired&&<div className="mission-command" style={{marginTop:18}}><span>NEXT GAME FOCUS</span><b>{mission?.gameRule||'Play a tracked game so OP CLIMB can create evidence.'}</b></div>}
    </section>

    {!paired?<section className="dash-section">{setup}</section>:<details className="glass card dash-section"><summary style={{cursor:'pointer',fontWeight:800}}>COMPANION SETUP / RE-PAIR PC</summary><div style={{marginTop:14}}>{setup}</div></details>}

    {reviewReady&&snapshot&&me&&postGame&&<section className="dash-section" style={{display:'grid',gap:16}}>
      <div className="glass card" style={{padding:22,borderColor:partial?'rgba(255,170,70,.45)':undefined}}>
        <div className="eyebrow">{partial?'PARTIAL REVIEW':'POST-GAME REVIEW'}</div>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'end',flexWrap:'wrap'}}>
          <div><h2 style={{margin:'5px 0'}}>{me.championName} · {partial?'INCOMPLETE':result}</h2><p className="muted" style={{margin:0}}>{positionLabel(me.position)} · {formatClock(snapshot.gameTime)} · {me.scores.kills}/{me.scores.deaths}/{me.scores.assists} · {csPerMinuteNumber(me.scores.creepScore,snapshot.gameTime).toFixed(1)} CS/min</p></div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><span className="op-tier op-tier-plus">{postGame.good.length} GOOD</span><span className="op-tier op-tier-free">{postGame.critical.length} CRITICAL</span></div>
        </div>
      </div>

      <div className="grid two">
        <ReviewColumn title="GOOD POINTS" tone="good" items={postGame.good}/>
        <ReviewColumn title="CRITICAL POINTS" tone="critical" items={postGame.critical}/>
      </div>

      <div className="glass card" style={{padding:22}}>
        <div className="eyebrow">ONE THING NEXT GAME</div>
        <h2 style={{margin:'6px 0 8px'}}>{postGame.nextTitle}</h2>
        <p style={{margin:0,fontSize:16}}>{postGame.nextFocus}</p>
      </div>

      <details className="glass card">
        <summary style={{cursor:'pointer',fontWeight:800}}>VIEW EVIDENCE BEHIND THE REVIEW</summary>
        <div style={{display:'grid',gap:12,marginTop:16}}>
          <div className="grid three">
            <Mini label="K / D / A" value={`${me.scores.kills} / ${me.scores.deaths} / ${me.scores.assists}`}/>
            <Mini label="CS / MIN" value={csPerMinuteNumber(me.scores.creepScore,snapshot.gameTime).toFixed(1)}/>
            <Mini label="SNAPSHOTS" value={String(review?.snapshotCount??0)}/>
          </div>
          <div className="grid two">
            <WindowCard title="BEST VISIBLE WINDOW" point={review?.summary?.strongestWindow??null}/>
            <WindowCard title="HARDEST VISIBLE WINDOW" point={review?.summary?.weakestWindow??null}/>
          </div>
          {review?.summary?.modelNote&&<p className="muted" style={{margin:0}}>{review.summary.modelNote}</p>}
          <p className="muted" style={{margin:0,fontSize:12}}>The Companion uses visible game state only. It does not pretend to know hidden cooldowns, enemy pocket gold or exact intentions.</p>
        </div>
      </details>
    </section>}
  </AppShell>;
}

function ReviewColumn({title,tone,items}:{title:string;tone:'good'|'critical';items:Insight[]}){
  return <div className="glass card" style={{padding:20}}><div className="eyebrow">{title}</div><div style={{display:'grid',gap:12,marginTop:12}}>{items.map((item,index)=><div key={`${tone}-${index}`} style={{padding:'12px 0',borderBottom:index===items.length-1?'none':'1px solid rgba(255,255,255,.08)'}}><div style={{display:'grid',gridTemplateColumns:'30px 1fr',gap:10}}><strong>{tone==='good'?'✓':'!'}</strong><div><b>{item.title}</b><p className="muted" style={{margin:'4px 0 0'}}>{item.detail}</p></div></div></div>)}</div></div>;
}

function buildPostGameReview({me,laneOpponent,review,snapshot,result,missionRule,partial}:{me:Player;laneOpponent:Player|null;review:Review|null;snapshot:Snapshot;result:string;missionRule?:string;partial:boolean}){
  const good:Insight[]=[];
  const critical:Insight[]=[];
  const cspm=csPerMinuteNumber(me.scores.creepScore,snapshot.gameTime);
  const itemDiff=laneOpponent?me.itemGold-laneOpponent.itemGold:null;
  const strongest=review?.summary?.strongestWindow??null;
  const weakest=review?.summary?.weakestWindow??null;
  const opportunities=review?.summary?.opportunities??[];
  const caution=opportunities.filter(o=>o.type==='CAUTION_WINDOW');
  const favourable=opportunities.filter(o=>o.type==='ALL_IN_CANDIDATE'||o.type==='PRESSURE_WINDOW');

  if(result==='WIN')good.push({title:'You converted the game',detail:'The recorded game ended in a win. Keep the behaviours that created repeatable value, not just the final result.'});
  if(me.scores.deaths<=3)good.push({title:'Deaths were controlled',detail:`You finished with ${me.scores.deaths} deaths, which protected your uptime and map presence.`});
  if(cspm>=6.5)good.push({title:'Economy stayed healthy',detail:`You finished at ${cspm.toFixed(1)} CS/min, a solid resource baseline for this review.`});
  if(itemDiff!==null&&itemDiff>=350)good.push({title:'You finished ahead in visible item value',detail:`You were about ${Math.round(itemDiff)}g ahead of the resolved lane opponent in completed visible items at the final snapshot.`});
  if(strongest?.verdict==='YOU_STRONGER')good.push({title:`Real power window at ${formatClock(strongest.atSeconds)}`,detail:shortReasons(strongest.reasons,'The visible level/item state favoured you in this window.')});
  if(favourable.length>=2)good.push({title:'You created multiple favourable states',detail:`The tracker found ${favourable.length} visible pressure/all-in windows across the game.`});

  if(me.scores.deaths>=5)critical.push({title:'Too many deaths reduced your control',detail:`You died ${me.scores.deaths} times. Review the first avoidable death before worrying about mechanics later in the game.`});
  if(cspm<5.8)critical.push({title:'Farm dropped too low',detail:`You finished at ${cspm.toFixed(1)} CS/min. That makes later item windows harder to reach on time.`});
  if(itemDiff!==null&&itemDiff<=-350)critical.push({title:'You finished behind the lane opponent in visible items',detail:`The final visible item-value gap was about ${Math.abs(Math.round(itemDiff))}g against you.`});
  if(weakest?.verdict==='THEM_STRONGER')critical.push({title:`Hardest window at ${formatClock(weakest.atSeconds)}`,detail:shortReasons(weakest.reasons,'The visible state favoured the opponent here. This is a key moment to review.')});
  if(caution.length>=2)critical.push({title:'Repeated enemy-favoured windows',detail:`The tracker found ${caution.length} caution windows. The pattern matters more than any single fight.`});
  if(partial)critical.push({title:'The recording was incomplete',detail:'Use these points as partial evidence only. This session should not decide ILP mastery.'});

  const goodTrimmed=dedupeInsights(good).slice(0,3);
  const criticalTrimmed=dedupeInsights(critical).slice(0,3);
  if(!goodTrimmed.length)goodTrimmed.push({title:'No fake praise',detail:'The captured telemetry did not confirm a strong positive performance signal clearly enough. More complete games will make this section stronger.'});
  if(!criticalTrimmed.length)criticalTrimmed.push({title:'No major red flag confirmed',detail:'The captured telemetry did not show a clear critical leak. Keep the current ILP focus until repeated evidence says otherwise.'});

  const nextTitle=missionRule?'KEEP THE ILP CUE':'FIX THE CLEAREST LEAK';
  const nextFocus=missionRule||criticalTrimmed[0].detail;
  return{good:goodTrimmed,critical:criticalTrimmed,nextTitle,nextFocus};
}

function dedupeInsights(items:Insight[]){const seen=new Set<string>();return items.filter(item=>{const key=item.title.toLowerCase();if(seen.has(key))return false;seen.add(key);return true})}
function shortReasons(reasons:string[],fallback:string){return reasons.length?reasons.slice(0,2).join(' · '):fallback}
function Mini({label,value}:{label:string;value:string}){return <div className="glass card"><span className="eyebrow">{label}</span><strong style={{display:'block',fontSize:22,marginTop:4}}>{value}</strong></div>}
function WindowCard({title,point}:{title:string;point:StrengthPoint|null}){return <div className="glass card"><div className="eyebrow">{title}</div>{point?<><h3>{formatClock(point.atSeconds)} · {labelOf(point.verdict)}</h3><p className="muted">vs {point.opponent||'enemy'} · score {signed(point.score)}</p><p>{shortReasons(point.reasons,point.comparisonReason)}</p></>:<p className="muted">No reliable comparison yet.</p>}</div>}
function findMe(snapshot:Snapshot){return snapshot.players.find(player=>Boolean(snapshot.active.riotId&&player.riotId===snapshot.active.riotId))??snapshot.players.find(player=>Boolean(snapshot.active.summonerName&&player.summonerName===snapshot.active.summonerName))??snapshot.players.find(player=>player.championName===snapshot.active.championName&&player.team===snapshot.active.team)??null}
function findLaneOpponent(snapshot:Snapshot,me:Player){if(!me.position)return null;return snapshot.players.find(player=>player.team!==me.team&&player.position===me.position)??null}
function inferResult(events:MatchEvent[]){for(let i=events.length-1;i>=0;i--){if(events[i].name.toLowerCase()!=='gameend')continue;const value=String(events[i].raw?.Result??events[i].raw?.result??'').toLowerCase();if(value.includes('win'))return'WIN';if(value.includes('lose')||value.includes('loss'))return'LOSS'}return'UNKNOWN'}
function positionLabel(value:string|null){const v=(value||'').toUpperCase();return v==='BOTTOM'?'ADC':v==='UTILITY'?'SUPPORT':v==='MIDDLE'?'MID':v==='TOP'?'TOP':v==='JUNGLE'?'JUNGLE':v||'UNKNOWN'}
function csPerMinuteNumber(cs:number,seconds:number){return seconds>0?cs/(seconds/60):0}
function labelOf(value:StrengthPoint['verdict']){return value==='YOU_STRONGER'?'YOU STRONGER':value==='THEM_STRONGER'?'THEY ARE STRONGER':'EVEN'}
function signed(value:number){return `${value>0?'+':''}${Math.round(value*10)/10}`}
function formatClock(seconds:number){const s=Math.max(0,Math.floor(seconds));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function isRecent(value:string|null|undefined,windowMs:number){if(!value)return false;const time=Date.parse(value);return Number.isFinite(time)&&Date.now()-time<=windowMs}
