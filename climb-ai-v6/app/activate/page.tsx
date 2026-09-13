'use client';

import Link from 'next/link';
import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {Wordmark} from '@/components/UI';
import {matchesFor,useAccount} from '@/components/AccountContext';
import {analyseMatch} from '@/lib/engine';
import {buildReview} from '@/lib/review';
import {track} from '@/lib/analytics';

interface SyncStatus{enabled:boolean;regions:string[];message:string}

type GradeBand='BROKEN'|'EXPOSED'|'STABLE'|'SHARP'|'OVERPOWERED';

function gradeBand(score:number):GradeBand{
  if(score<40)return 'BROKEN';
  if(score<55)return 'EXPOSED';
  if(score<70)return 'STABLE';
  if(score<85)return 'SHARP';
  return 'OVERPOWERED';
}

function durationSeconds(raw:string):number|null{
  const value=raw.trim();
  const clock=value.match(/^(\d{1,2}):(\d{2})$/);
  if(clock){
    const minutes=Number(clock[1]),seconds=Number(clock[2]);
    if(seconds<60)return minutes*60+seconds;
  }
  const minutes=Number(value);
  return Number.isFinite(minutes)&&minutes>=5?Math.round(minutes*60):null;
}

export default function Activate(){
  const {active,profile,authenticated,hydrated,refresh}=useAccount();
  const matches=matchesFor(active.id);
  const latest=matches[0];
  const report=useMemo(()=>latest?analyseMatch(latest,matches.slice(1)):null,[latest,matches]);
  const review=useMemo(()=>latest&&report?buildReview(latest,report):null,[latest,report]);
  const score=report?Math.round(report.performance*10):null;

  const [syncStatus,setSyncStatus]=useState<SyncStatus|null>(null);
  const [syncing,setSyncing]=useState(false);
  const [syncError,setSyncError]=useState('');
  const autoSyncAttempted=useRef(false);
  const completionTracked=useRef('');

  const [champion,setChampion]=useState('');
  const [result,setResult]=useState<'WIN'|'LOSS'>('WIN');
  const [kills,setKills]=useState('');
  const [deaths,setDeaths]=useState('');
  const [assists,setAssists]=useState('');
  const [cs,setCs]=useState('');
  const [duration,setDuration]=useState('');
  const [manualBusy,setManualBusy]=useState(false);
  const [manualError,setManualError]=useState('');

  useEffect(()=>{
    if(hydrated&&!champion&&active.isPrimary&&active.champions[0])setChampion(active.champions[0]);
  },[hydrated,active.id,active.isPrimary,active.champions,champion]);

  useEffect(()=>{
    let cancelled=false;
    fetch('/api/riot/sync')
      .then(r=>r.ok?r.json():Promise.reject(new Error(String(r.status))))
      .then((data:SyncStatus)=>{if(!cancelled)setSyncStatus(data)})
      .catch(()=>{if(!cancelled)setSyncStatus({enabled:false,regions:[],message:'Riot sync is unavailable right now.'})});
    return()=>{cancelled=true};
  },[]);

  const runSync=async()=>{
    if(!profile||!authenticated||syncing)return;
    setSyncing(true);setSyncError('');
    track('analysis_started',{source:'riot_activation'});
    try{
      const res=await fetch('/api/riot/sync',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          gameName:profile.gameName,
          tagline:profile.tagline.replace(/^#/,''),
          region:profile.region,
          count:1,
        }),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok||!body.ok)throw new Error(body.error||'Riot could not import your latest ranked game.');
      track('match_synced',{source:'activation',matches:Array.isArray(body.matches)?body.matches.length:0});
      await refresh();
      if(!Array.isArray(body.matches)||body.matches.length===0)setSyncError('No recent Ranked Solo/Duo game was found. Add your last match below instead.');
    }catch(err){
      setSyncError(err instanceof Error?err.message:'Riot could not import your latest ranked game.');
    }finally{setSyncing(false)}
  };

  useEffect(()=>{
    if(!hydrated||latest||!authenticated||!profile||!syncStatus?.enabled||autoSyncAttempted.current)return;
    autoSyncAttempted.current=true;
    void runSync();
  // runSync deliberately reads the current profile/account state when this gate opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[hydrated,latest,authenticated,profile,syncStatus?.enabled]);

  useEffect(()=>{
    if(!latest||!report||completionTracked.current===latest.id)return;
    completionTracked.current=latest.id;
    track('analysis_completed',{
      source:latest.source,
      activation:true,
      grade:Math.round(report.performance*10),
      category:report.primary.category,
    });
  },[latest,report]);

  const submitManual=async(e:FormEvent)=>{
    e.preventDefault();
    setManualError('');
    const seconds=durationSeconds(duration);
    if(!champion.trim()){setManualError('Enter the champion you played.');return}
    if(seconds===null){setManualError('Enter game length as MM:SS, for example 31:42.');return}
    const values=[kills,deaths,assists,cs].map(Number);
    if(values.some(v=>!Number.isInteger(v)||v<0)){setManualError('Kills, deaths, assists and CS must be whole numbers.');return}

    setManualBusy(true);
    track('analysis_started',{source:'manual_activation'});
    try{
      const res=await fetch('/api/matches/manual',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          champion:champion.trim(),result,
          kills:values[0],deaths:values[1],assists:values[2],cs:values[3],durationSeconds:seconds,
        }),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok||!body.ok)throw new Error(body.error||'The match could not be saved.');
      track('match_uploaded',{source:'manual_activation'});
      await refresh();
    }catch(err){setManualError(err instanceof Error?err.message:'The match could not be saved.')}
    finally{setManualBusy(false)}
  };

  if(!hydrated){
    return <main className="container section onboarding-page">
      <Wordmark/>
      <section className="glass card" style={{maxWidth:780,margin:'42px auto',textAlign:'center'}}>
        <div className="eyebrow">ACTIVATING OP CLIMB</div>
        <h1>Preparing your player profile…</h1>
        <p className="muted">Your first useful coaching screen comes before the full dashboard.</p>
      </section>
    </main>;
  }

  if(latest&&report&&review&&score!==null){
    const band=gradeBand(score);
    const ladder=[
      {stage:'QUICK WIN',body:report.mission.rules[0],state:'READY'},
      {stage:'CONTROL',body:report.mission.rules[1],state:'READY'},
      {stage:'DISCIPLINE',body:report.mission.rules[2],state:'READY'},
      {stage:'ADVANCED',body:'Unlocks when richer match or live telemetry shows how this leak repeats in real decision windows.',state:'BUILDING'},
      {stage:'MASTERY',body:`Prove the behaviour across ${report.mission.gamesRequired} relevant games. OP CLIMB will track whether the leak actually disappears.`,state:'LOCKED'},
    ];

    return <main className="container section onboarding-page">
      <Wordmark/>
      <div style={{maxWidth:980,margin:'34px auto 70px',display:'grid',gap:16}}>
        <section className="glass card" style={{padding:'clamp(22px,4vw,42px)'}}>
          <div className="eyebrow">ACTIVATION COMPLETE · FIRST REAL EVIDENCE</div>
          <div style={{display:'grid',gridTemplateColumns:'minmax(150px,.55fr) minmax(0,1.45fr)',gap:28,alignItems:'center',marginTop:18}}>
            <div>
              <div style={{fontSize:'clamp(64px,10vw,104px)',lineHeight:.82,fontWeight:950,letterSpacing:'-.07em'}}>{score}</div>
              <div style={{fontWeight:950,letterSpacing:'.14em',fontSize:18,marginTop:14}}>{band}</div>
              <div className="muted" style={{fontSize:11,marginTop:5}}>FIRST OP GRADE / 100</div>
            </div>
            <div>
              <span className="v7-badge engine">FOUNDATION GRADE · {latest.source.toUpperCase()} EVIDENCE</span>
              <h1 style={{marginBottom:8}}>{review.headline}</h1>
              <p className="muted" style={{fontSize:15,lineHeight:1.65}}>
                {latest.champion} · {latest.result} · {latest.kills}/{latest.deaths}/{latest.assists} · {latest.metrics.csPerMin.toFixed(1)} CS/min. This is useful immediately, but OP CLIMB will upgrade the confidence as timeline and live decision evidence arrives.
              </p>
            </div>
          </div>
        </section>

        <section className="glass card">
          <div className="eyebrow">YOUR #1 LEAK</div>
          <h2 style={{marginBottom:6}}>{review.biggestMistake.title}</h2>
          <p style={{fontSize:17,lineHeight:1.6,maxWidth:820}}>{report.primary.inference}</p>
          <div className="grid three" style={{marginTop:16}}>
            <div><span className="label">EVIDENCE</span><b>{report.primary.facts[1]}</b></div>
            <div><span className="label">CONFIDENCE</span><b>{Math.round(report.primary.confidence*100)}% · FIRST SAMPLE</b></div>
            <div><span className="label">NEXT GAME TARGET</span><b>{report.mission.target} {report.mission.unit}</b></div>
          </div>
        </section>

        <section className="glass card">
          <div className="eyebrow">OP FIX LADDER</div>
          <h2>Do the first fix. Earn the deeper ones.</h2>
          <div style={{display:'grid',gap:9,marginTop:18}}>
            {ladder.map((item,index)=><div key={item.stage} style={{display:'grid',gridTemplateColumns:'56px minmax(110px,.35fr) minmax(0,1.65fr) auto',gap:14,alignItems:'center',padding:'14px 16px',border:'1px solid rgba(255,255,255,.1)',borderRadius:14}}>
              <b style={{fontSize:20}}>0{index+1}</b>
              <span className="eyebrow">{item.stage}</span>
              <span style={{lineHeight:1.45}}>{item.body}</span>
              <span className="v7-badge">{item.state}</span>
            </div>)}
          </div>
        </section>

        <section className="glass card" style={{border:'1px solid rgba(214,255,47,.25)'}}>
          <div className="eyebrow">TAKE THIS INTO YOUR NEXT GAME</div>
          <h2 style={{marginBottom:8}}>{report.mission.title}</h2>
          <p style={{fontSize:18,lineHeight:1.55}}>{report.mission.rules[0]}</p>
          <div className="hero-actions" style={{marginTop:18}}>
            <Link className="btn primary" href="/dashboard">OPEN DEVELOPMENT HQ</Link>
            <Link className="btn secondary" href={`/analyse/${encodeURIComponent(latest.id)}`}>OPEN FULL MATCH REVIEW</Link>
          </div>
        </section>
      </div>
    </main>;
  }

  const manualFallback=syncStatus?.enabled===false||Boolean(syncError)||!authenticated;

  return <main className="container section onboarding-page">
    <Wordmark/>
    <div style={{maxWidth:860,margin:'34px auto 70px',display:'grid',gap:16}}>
      <section className="glass card" style={{textAlign:'center',padding:'clamp(24px,4vw,44px)'}}>
        <div className="eyebrow">ONE MATCH → FIRST OP GRADE</div>
        <h1 style={{fontSize:'clamp(34px,6vw,62px)',lineHeight:.95,marginBottom:14}}>Get your first fix before you see the app.</h1>
        <p className="muted" style={{fontSize:16,lineHeight:1.65,maxWidth:650,margin:'0 auto'}}>
          No empty dashboard. OP CLIMB needs one real game to replace your onboarding guess with evidence and build your first Fix Ladder.
        </p>
      </section>

      {syncStatus===null&&<section className="glass card" style={{textAlign:'center'}}>
        <div className="eyebrow">CHECKING RIOT CONNECTION</div><h3>Looking for the fastest route to your latest ranked game…</h3>
      </section>}

      {syncStatus?.enabled&&!syncError&&<section className="glass card">
        <div className="eyebrow">RIOT MATCH IMPORT</div>
        <h2>{syncing?'Importing your latest Ranked Solo/Duo game…':'Your Riot account is ready to import.'}</h2>
        <p className="muted">OP CLIMB only needs the newest game to create the first grade. More history can sync after activation.</p>
        {!syncing&&<button className="btn primary" onClick={()=>void runSync()}>IMPORT LATEST GAME</button>}
      </section>}

      {syncError&&<div className="glass card"><div className="eyebrow">RIOT IMPORT DID NOT COMPLETE</div><p>{syncError}</p><p className="muted">You can still get your first grade immediately from the essentials below.</p></div>}

      {manualFallback&&<form className="glass card" onSubmit={submitManual}>
        <div className="eyebrow">FAST FALLBACK · ABOUT 30 SECONDS</div>
        <h2>Enter your last ranked game</h2>
        <p className="muted">These numbers create a real foundation grade. OP CLIMB will not pretend they prove spacing, target selection or exact fight timing.</p>
        <div className="grid two" style={{marginTop:18}}>
          <label className="field">Champion<input className="input" value={champion} onChange={e=>setChampion(e.target.value)} placeholder="e.g. Galio" autoFocus/></label>
          <label className="field">Result<select className="input" value={result} onChange={e=>setResult(e.target.value as 'WIN'|'LOSS')}><option value="WIN">Victory</option><option value="LOSS">Defeat</option></select></label>
          <label className="field">Kills<input className="input" inputMode="numeric" value={kills} onChange={e=>setKills(e.target.value)} placeholder="8"/></label>
          <label className="field">Deaths<input className="input" inputMode="numeric" value={deaths} onChange={e=>setDeaths(e.target.value)} placeholder="4"/></label>
          <label className="field">Assists<input className="input" inputMode="numeric" value={assists} onChange={e=>setAssists(e.target.value)} placeholder="10"/></label>
          <label className="field">CS<input className="input" inputMode="numeric" value={cs} onChange={e=>setCs(e.target.value)} placeholder="221"/></label>
          <label className="field">Game length<input className="input" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="32:10"/></label>
        </div>
        {manualError&&<p style={{marginTop:14}}>{manualError}</p>}
        {!authenticated&&<p className="muted">Your session is not signed in. Log in again so this match can be attached to your player profile.</p>}
        <button className="btn primary" disabled={manualBusy||!authenticated} style={{marginTop:18}}>{manualBusy?'BUILDING YOUR GRADE…':'BUILD MY FIRST OP GRADE'}</button>
      </form>}
    </div>
  </main>;
}
