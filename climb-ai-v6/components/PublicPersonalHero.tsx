'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {track} from '@/lib/analytics';
import styles from './PublicPersonalHero.module.css';

type Insight={label:string;value:string;detail:string;tone:'GOOD'|'WATCH'|'NEUTRAL'};
type PreviewReport={
  gamesAnalyzed:number;
  rank:string;
  primaryRole:string;
  mainChampion:string;
  winRate:number;
  insights:Insight[];
  focus:{title:string;category:string;detail:string;rule:string;evidence:string};
  trend:string;
};
type PreviewResponse={
  ok:boolean;
  error?:string;
  account?:{gameName:string;tagline:string;region:string};
  report?:PreviewReport;
};

const REGIONS=['EUW','EUNE','NA','KR','BR','LAN','LAS','OCE','TR','RU','JP'] as const;
const SCAN_STEPS=[
  'Finding your Riot account…',
  'Scanning up to 20 ranked games…',
  'Checking lane, deaths and resource patterns…',
  'Building your first coaching read…',
];

function splitRiotId(value:string){
  const index=value.lastIndexOf('#');
  if(index<=0||index===value.length-1)return null;
  return{gameName:value.slice(0,index).trim(),tagline:value.slice(index+1).trim()};
}

function RiotForm({placement,onResult}:{placement:string;onResult?:(result:PreviewResponse)=>void}){
  const [riotId,setRiotId]=useState('');
  const [region,setRegion]=useState<(typeof REGIONS)[number]>('EUW');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [scanIndex,setScanIndex]=useState(0);

  useEffect(()=>{
    if(!busy){setScanIndex(0);return}
    const timer=window.setInterval(()=>setScanIndex(index=>Math.min(SCAN_STEPS.length-1,index+1)),950);
    return()=>window.clearInterval(timer);
  },[busy]);

  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    if(busy)return;
    const parsed=splitRiotId(riotId);
    if(!parsed){setError('Enter your Riot ID like Name#TAG.');return}
    setBusy(true);setError('');
    track('public_riot_preview_started',{placement,region});
    try{
      const response=await fetch('/api/public/preview',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({...parsed,region}),
      });
      const body=await response.json().catch(()=>({ok:false,error:'Could not read the response.'})) as PreviewResponse;
      if(!response.ok||!body.ok||!body.report)throw new Error(body.error||'Could not analyse those games.');
      track('public_riot_preview_completed',{placement,region,games:body.report.gamesAnalyzed,rank:body.report.rank});
      onResult?.(body);
    }catch(err){
      const message=err instanceof Error?err.message:'Could not analyse those games.';
      setError(message);
      track('public_riot_preview_failed',{placement,region,message});
    }finally{
      setBusy(false);
    }
  };

  return <form className={styles.riotForm} onSubmit={submit}>
    <label className={styles.riotInput}>
      <span>RIOT ID</span>
      <input value={riotId} onChange={event=>setRiotId(event.target.value)} placeholder="Name#TAG" autoComplete="off" aria-label="Riot ID"/>
    </label>
    <label className={styles.regionInput}>
      <span>REGION</span>
      <select value={region} onChange={event=>setRegion(event.target.value as (typeof REGIONS)[number])} aria-label="Region">
        {REGIONS.map(item=><option key={item}>{item}</option>)}
      </select>
    </label>
    <button className="btn primary" disabled={busy} type="submit">{busy?'ANALYSING…':'ANALYSE MY GAMES →'}</button>
    {busy&&<div className={styles.scanLine}><i/><span>{SCAN_STEPS[scanIndex]}</span></div>}
    {error&&<div className={styles.formError}>{error}</div>}
  </form>;
}

function SampleReport(){
  return <article className={styles.reportCard} aria-label="Example personal report">
    <div className={styles.reportHead}><div><span>EXAMPLE PERSONAL READ</span><strong>JINX · ADC</strong></div><b>GOLD IV</b></div>
    <div className={styles.reportGrid}>
      <div><span>CS @ 10</span><strong>58.6</strong><small>your recent baseline</small></div>
      <div><span>EARLY-DEATH GAMES</span><strong>40%</strong><small>death before 10:00</small></div>
      <div><span>AVG DEATHS</span><strong>5.8</strong><small>last ranked sample</small></div>
    </div>
    <div className={styles.focusBlock}><span>TOP FIX THIS WEEK</span><strong>PROTECT THE FIRST RESET WINDOW</strong><p>When the lane becomes unstable, preserve HP and the wave before forcing another trade.</p></div>
    <div className={styles.lockedPlan}><span>FULL CLIMB PLAN</span><b>🔒 ACCOUNT REQUIRED</b><i/><i/><i/></div>
    <small className={styles.honesty}>Illustrative layout only. Your report uses your Riot match data and your own baseline.</small>
  </article>;
}

function PersonalReport({data}:{data:PreviewResponse}){
  const report=data.report!;
  return <article className={styles.reportCard+' '+styles.personalReport} aria-live="polite">
    <div className={styles.reportHead}><div><span>YOUR FIRST OP CLIMB READ</span><strong>{data.account?.gameName}#{data.account?.tagline}</strong></div><b>{report.rank}</b></div>
    <div className={styles.identityRow}><span>{report.primaryRole}</span><span>{report.mainChampion}</span><span>{report.gamesAnalyzed} GAMES</span><span>{report.winRate}% WR</span></div>
    <div className={styles.reportGrid}>
      {report.insights.map(insight=><div key={insight.label} data-tone={insight.tone}><span>{insight.label}</span><strong>{insight.value}</strong><small>{insight.detail}</small></div>)}
    </div>
    <div className={styles.focusBlock}><span>FIRST COACHING PRIORITY · {report.focus.category.replaceAll('_',' ')}</span><strong>{report.focus.title}</strong><p>{report.focus.detail}</p><b>{report.focus.rule}</b><small>{report.focus.evidence}</small></div>
    <div className={styles.trendLine}><span>RECENT TREND</span><strong>{report.trend}</strong></div>
    <div className={styles.lockedPlan}><span>YOUR FULL CLIMB PLAN</span><b>🔒 SAVE THE HISTORY + BUILD THE PLAN</b><i/><i/><i/></div>
    <div className={styles.reportActions}><Link className="btn primary" href="/signup" data-landing-cta="personal-report-unlock">CREATE FREE ACCOUNT TO UNLOCK</Link><small>No card required · this public preview is not saved</small></div>
  </article>;
}

export function PublicPersonalHero(){
  const [result,setResult]=useState<PreviewResponse|null>(null);
  const proof=useMemo(()=>result?.report?(String(result.report.gamesAnalyzed)+' ranked games analysed · '+result.report.rank):'No account needed for the first result',[result]);

  return <section className={'container landing-hero-v2 '+styles.hero} id="analyse">
    <div className={styles.heroCopy}>
      <div className="eyebrow">COACHING BUILT FROM YOUR OWN GAMES</div>
      <h1>CLIMB FASTER WITH COACHING<br/><span>BUILT AROUND HOW YOU PLAY.</span></h1>
      <p>Enter your Riot ID. OP CLIMB reads up to your last 20 ranked solo games, finds the pattern worth fixing first and gives you a partial personal report before you create an account.</p>
      <RiotForm placement="hero" onResult={setResult}/>
      <div className={styles.formTrust}><span>✓ NO ACCOUNT FOR THE PREVIEW</span><span>✓ RIOT MATCH DATA</span><span>✓ {proof.toUpperCase()}</span></div>
    </div>
    {result?.report?<PersonalReport data={result}/>:<SampleReport/>}
  </section>;
}

export function FinalRiotCta(){
  const [result,setResult]=useState<PreviewResponse|null>(null);
  if(result?.report)return <section className={'container '+styles.finalResult}><PersonalReport data={result}/></section>;
  return <section className={'container '+styles.finalCta}>
    <div><div className="eyebrow">YOUR GAMES ARE THE SALES PITCH</div><h2>DON&apos;T SIGN UP BLIND.<br/>SEE YOUR FIRST RESULT.</h2><p>Enter the Riot ID you actually play ranked on. We&apos;ll show the partial read first.</p></div>
    <RiotForm placement="final" onResult={setResult}/>
  </section>;
}
