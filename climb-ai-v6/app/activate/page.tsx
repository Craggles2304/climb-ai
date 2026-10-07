'use client';

import Link from 'next/link';
import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {Wordmark} from '@/components/UI';
import {matchesFor,useAccount} from '@/components/AccountContext';
import {useProMatch} from '@/components/useProMatch';
import {analyseMatch} from '@/lib/engine';
import {buildReview} from '@/lib/review';
import {track} from '@/lib/analytics';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';

interface SyncStatus{enabled:boolean;regions:string[];message:string}

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
  const {analysis:proAnalysis,loading:proLoading}=useProMatch(latest?.id);
  const report=useMemo(()=>latest?analyseMatch({...latest,proAnalysis:proAnalysis??undefined},matches.slice(1)):null,[latest,matches,proAnalysis]);
  const review=useMemo(()=>latest&&report?buildReview(latest,report):null,[latest,report]);
  const baselineGames=Math.min(dnaBaselineGameCount(matches,active.role),DNA_BASELINE_GAMES);
  const baselineReady=dnaBaselineReady(baselineGames);
  const score=report?Math.round(report.performance*10):null;

  const [syncStatus,setSyncStatus]=useState<SyncStatus|null>(null);
  const [syncing,setSyncing]=useState(false);
  const [syncError,setSyncError]=useState('');
  const autoSyncAttempted=useRef(false);
  const activationTracked=useRef(false);
  const completionTracked=useRef('');
  const ladderTracked=useRef('');
  const nextStepsRef=useRef<HTMLElement|null>(null);

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
    if(!hydrated||latest||activationTracked.current)return;
    activationTracked.current=true;
    track('activation_started',{authenticated});
  },[hydrated,latest,authenticated]);

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
        body:JSON.stringify({gameName:profile.gameName,tagline:profile.tagline.replace(/^#/,''),region:profile.region,count:1}),
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok||!body.ok)throw new Error(body.error||'Riot could not import your latest ranked game.');
      const imported=Array.isArray(body.matches)?body.matches.length:0;
      track('match_synced',{source:'activation',matches:imported});
      if(imported>0)track('first_match_added',{source:'riot'});
      await refresh();
      if(imported===0)setSyncError('No recent Ranked Solo/Duo game was found. Add your last match below instead.');
    }catch(err){setSyncError(err instanceof Error?err.message:'Riot could not import your latest ranked game.');}
    finally{setSyncing(false)}
  };

  useEffect(()=>{
    if(!hydrated||latest||!authenticated||!profile||!syncStatus?.enabled||autoSyncAttempted.current)return;
    autoSyncAttempted.current=true;void runSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[hydrated,latest,authenticated,profile,syncStatus?.enabled]);

  useEffect(()=>{
    if(!latest||!report||proLoading||completionTracked.current===latest.id)return;
    completionTracked.current=latest.id;
    const grade=Math.round(report.performance*10);
    track('analysis_completed',{source:latest.source,activation:true,grade,category:report.primary.category,evidence:proAnalysis?'pro':'fallback'});
    track('op_grade_viewed',{source:latest.source,grade,category:report.primary.category});
    track('activation_completed',{source:latest.source,grade});
  },[latest,report,proLoading,proAnalysis]);

  useEffect(()=>{
    if(!latest||!report||proLoading||!nextStepsRef.current||ladderTracked.current===latest.id)return;
    const node=nextStepsRef.current;
    const mark=()=>{if(ladderTracked.current===latest.id)return;ladderTracked.current=latest.id;track('fix_ladder_viewed',{source:latest.source,category:report.primary.category});};
    if(typeof IntersectionObserver==='undefined'){mark();return}
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=.25)){mark();observer.disconnect();}},{threshold:[.25]});
    observer.observe(node);return()=>observer.disconnect();
  },[latest,report,proLoading]);

  const submitManual=async(e:FormEvent)=>{
    e.preventDefault();setManualError('');
    const seconds=durationSeconds(duration);
    if(!champion.trim()){setManualError('Enter the champion you played.');return}
    if(seconds===null){setManualError('Enter game length as MM:SS, for example 31:42.');return}
    const values=[kills,deaths,assists,cs].map(Number);
    if(values.some(v=>!Number.isInteger(v)||v<0)){setManualError('Kills, deaths, assists and CS must be whole numbers.');return}
    setManualBusy(true);track('analysis_started',{source:'manual_activation'});
    try{
      const res=await fetch('/api/matches/manual',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({champion:champion.trim(),result,kills:values[0],deaths:values[1],assists:values[2],cs:values[3],durationSeconds:seconds})});
      const body=await res.json().catch(()=>({}));
      if(!res.ok||!body.ok)throw new Error(body.error||'The match could not be saved.');
      track('match_uploaded',{source:'manual_activation'});track('first_match_added',{source:'manual'});await refresh();
    }catch(err){setManualError(err instanceof Error?err.message:'The match could not be saved.')}
    finally{setManualBusy(false)}
  };

  if(!hydrated||(latest&&proLoading))return <main className="container section onboarding-page"><Wordmark/><section className="glass card" style={{maxWidth:780,margin:'42px auto',textAlign:'center'}}><div className="eyebrow">GETTING YOUR GAME READY</div><h1>{latest?'Reading the full game evidence…':'Finding something worth fixing…'}</h1><p className="muted">We’ll show you the focus before we show you the rest of the app.</p></section></main>;

  if(latest&&report&&review&&score!==null){
    return <main className="container section onboarding-page"><Wordmark/><div style={{maxWidth:980,margin:'34px auto 70px',display:'grid',gap:16}}>
      <section className="glass card" style={{padding:'clamp(24px,4vw,46px)',border:'1px solid rgba(182,246,107,.25)'}}><div className="eyebrow">{baselineReady?'YOUR FIRST FOCUS':'FIRST LOOK · FROM YOUR LAST GAME'}</div><h1 style={{fontSize:'clamp(38px,6vw,68px)',lineHeight:.95,margin:'12px 0 14px'}}>{review.biggestMistake.title}</h1><p style={{fontSize:18,lineHeight:1.6,maxWidth:820}}>{report.primary.inference}</p><div className="grid three" style={{marginTop:20}}><div><span className="label">THE GAME</span><b>{latest.champion} · {latest.result} · {latest.kills}/{latest.deaths}/{latest.assists}</b></div><div><span className="label">WHAT WE SAW</span><b>{report.primary.facts[1]||report.primary.facts[0]}</b></div><div><span className="label">EVIDENCE</span><b>{proAnalysis?'Riot timeline + game evidence':'Scoreboard starting point'}</b></div></div>{!baselineReady&&<div style={{marginTop:22}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12}}><span className="label">GAME DNA BASELINE</span><b>{baselineGames} of {DNA_BASELINE_GAMES} games</b></div><div role="progressbar" aria-label="Game DNA baseline" aria-valuemin={0} aria-valuemax={DNA_BASELINE_GAMES} aria-valuenow={baselineGames} style={{marginTop:8,height:8,background:'rgba(255,255,255,.08)'}}><div style={{width:`${baselineGames/DNA_BASELINE_GAMES*100}%`,height:'100%',background:'var(--accent,#b6f66b)'}}/></div><p className="muted" style={{marginTop:10,lineHeight:1.55}}>This is a first look from one game. Your full Game DNA, all six strands, unlocks after {DNA_BASELINE_GAMES} games in your role.</p></div>}</section>
      <section className="glass card"><div className="eyebrow">YOUR NEXT GAME HAS ONE JOB</div><h2 style={{marginBottom:8}}>{report.mission.title}</h2><p style={{fontSize:20,lineHeight:1.55,maxWidth:820}}>{report.mission.rules[0]}</p><div style={{marginTop:18,padding:'15px 16px',border:'1px solid rgba(255,255,255,.1)'}}><span className="label">WE'LL KNOW IT'S IMPROVING WHEN</span><b style={{display:'block',marginTop:6}}>{report.mission.target} {report.mission.unit}</b></div></section>
      <section ref={nextStepsRef} className="glass card"><div className="eyebrow">WHAT HAPPENS NOW</div><h2>Do not try to fix everything.</h2><div className="grid three" style={{marginTop:18}}><div><span className="label">01 · PLAY</span><b>Take that one rule into your next game.</b></div>{baselineReady?<><div><span className="label">02 · CHECK</span><b>We look for the same behaviour again.</b></div><div><span className="label">03 · MOVE ON</span><b>When it improves, your Coach gives you the next focus.</b></div></>:<><div><span className="label">02 · BUILD</span><b>Each game in your role adds to your Game DNA baseline.</b></div><div><span className="label">03 · REVEAL</span><b>After {DNA_BASELINE_GAMES} games your Game DNA appears and your Coach picks the next focus.</b></div></>}</div></section>
      <section className="glass card"><div className="hero-actions"><Link className="btn primary" href="/dashboard" onClick={()=>track('development_hq_entered',{source:'activation',grade:score})}>GO TO MY HOME →</Link><Link className="btn secondary" href={`/analyse/${encodeURIComponent(latest.id)}`}>SEE THIS GAME</Link></div></section>
    </div></main>;
  }

  const manualFallback=syncStatus?.enabled===false||Boolean(syncError)||!authenticated;
  return <main className="container section onboarding-page"><Wordmark/><div style={{maxWidth:860,margin:'34px auto 70px',display:'grid',gap:16}}>
    <section className="glass card" style={{textAlign:'center',padding:'clamp(24px,4vw,44px)'}}><div className="eyebrow">START WITH ONE REAL GAME</div><h1 style={{fontSize:'clamp(34px,6vw,62px)',lineHeight:.95,marginBottom:14}}>Let’s find the first thing worth fixing.</h1><p className="muted" style={{fontSize:16,lineHeight:1.65,maxWidth:650,margin:'0 auto'}}>We would rather wait for a real game than fill your screen with guesses.</p></section>
    {syncStatus===null&&<section className="glass card" style={{textAlign:'center'}}><div className="eyebrow">CHECKING RIOT</div><h3>Looking for your latest ranked game…</h3></section>}
    {syncStatus?.enabled&&!syncError&&<section className="glass card"><div className="eyebrow">LATEST RANKED GAME</div><h2>{syncing?'Getting your latest game…':'Your Riot account is connected.'}</h2><p className="muted">One game is enough for a first look. Your full Game DNA builds over 3 games in your role.</p>{!syncing&&<button className="btn primary" onClick={()=>void runSync()}>GET MY LATEST GAME</button>}</section>}
    {syncError&&<div className="glass card"><div className="eyebrow">RIOT DIDN'T GIVE US THE GAME</div><p>{syncError}</p><p className="muted">You can still start with the basics below.</p></div>}
    {manualFallback&&<form className="glass card" onSubmit={submitManual}><div className="eyebrow">QUICK FALLBACK · ABOUT 30 SECONDS</div><h2>Tell us about your last ranked game</h2><p className="muted">This is enough for a starting focus. We won’t pretend KDA and CS can tell us exact spacing, target choice or fight timing.</p><div className="grid two" style={{marginTop:18}}><label className="field">Champion<input className="input" value={champion} onChange={e=>setChampion(e.target.value)} placeholder="e.g. Galio" autoFocus/></label><label className="field">Result<select className="input" value={result} onChange={e=>setResult(e.target.value as 'WIN'|'LOSS')}><option value="WIN">Victory</option><option value="LOSS">Defeat</option></select></label><label className="field">Kills<input className="input" inputMode="numeric" value={kills} onChange={e=>setKills(e.target.value)} placeholder="8"/></label><label className="field">Deaths<input className="input" inputMode="numeric" value={deaths} onChange={e=>setDeaths(e.target.value)} placeholder="4"/></label><label className="field">Assists<input className="input" inputMode="numeric" value={assists} onChange={e=>setAssists(e.target.value)} placeholder="10"/></label><label className="field">CS<input className="input" inputMode="numeric" value={cs} onChange={e=>setCs(e.target.value)} placeholder="221"/></label><label className="field">Game length<input className="input" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="32:10"/></label></div>{manualError&&<p style={{marginTop:14}}>{manualError}</p>}{!authenticated&&<p className="muted">Your session is not signed in. Log in again so this game can be attached to your player profile.</p>}<button className="btn primary" disabled={manualBusy||!authenticated} style={{marginTop:18}}>{manualBusy?'CHECKING THE GAME…':'FIND MY FIRST FOCUS'}</button></form>}
  </div></main>;
}
