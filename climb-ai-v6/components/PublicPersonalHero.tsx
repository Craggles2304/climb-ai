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

function RiotForm({placement,onResult,onAvailability}:{placement:string;onResult?:(result:PreviewResponse)=>void;onAvailability?:(enabled:boolean)=>void}){
  const [riotId,setRiotId]=useState('');
  const [region,setRegion]=useState<(typeof REGIONS)[number]>('EUW');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [scanIndex,setScanIndex]=useState(0);
  const [available,setAvailable]=useState<boolean|null>(null);

  useEffect(()=>{
    let live=true;
    fetch('/api/public/preview').then(response=>response.json()).then(body=>{
      if(!live)return;
      const enabled=Boolean(body?.enabled);
      setAvailable(enabled);
      onAvailability?.(enabled);
    }).catch(()=>{
      if(!live)return;
      setAvailable(false);
      onAvailability?.(false);
    });
    return()=>{live=false};
  },[onAvailability]);

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

  if(available===false)return <div className={styles.lookupUnavailable}>
    <a className={styles.demoButton} href="#try-it" data-landing-cta={placement+'-sample-fallback'}>OPEN THE LIVE COACHING DEMO →</a>
    <span>Riot production access is currently off, so we&apos;re showing the coaching experience instead of sending you into a broken lookup.</span>
  </div>;

  return <form className={styles.riotForm} onSubmit={submit}>
    <label className={styles.riotInput}>
      <span>YOUR RIOT ID</span>
      <input value={riotId} onChange={event=>setRiotId(event.target.value)} placeholder="Name#TAG" autoComplete="off" aria-label="Riot ID"/>
    </label>
    <label className={styles.regionInput}>
      <span>REGION</span>
      <select value={region} onChange={event=>setRegion(event.target.value as (typeof REGIONS)[number])} aria-label="Region">
        {REGIONS.map(item=><option key={item}>{item}</option>)}
      </select>
    </label>
    <button className={styles.analyseButton} disabled={busy||available===null} type="submit">{available===null?'CHECKING RIOT…':busy?'ANALYSING…':'ANALYSE MY GAMES →'}</button>
    {busy&&<div className={styles.scanLine}><i/><span>{SCAN_STEPS[scanIndex]}</span></div>}
    {error&&<div className={styles.formError}>{error}</div>}
  </form>;
}

function SampleReport(){
  return <article className={styles.reportCard} aria-label="Example personal report">
    <div className={styles.reportChrome}><span>OP // PLAYER READ</span><b>01</b></div>
    <div className={styles.reportIdentity}>
      <div><small>EXAMPLE PROFILE</small><strong>JINX · ADC</strong><span>GOLD IV</span></div>
      <div className={styles.grade}><small>FOCUS</small><b>01</b></div>
    </div>
    <div className={styles.reportGrid}>
      <div><span>CS @ 10</span><strong>58.6</strong><small>recent baseline</small></div>
      <div data-tone="WATCH"><span>EARLY-DEATH GAMES</span><strong>40%</strong><small>death before 10:00</small></div>
      <div><span>AVG DEATHS</span><strong>5.8</strong><small>ranked sample</small></div>
    </div>
    <div className={styles.focusBlock}>
      <span>THIS WEEK&apos;S FIX</span>
      <strong>PROTECT THE FIRST RESET WINDOW.</strong>
      <p>When the lane becomes unstable, preserve HP and the wave before forcing another trade.</p>
      <div><b>RULE</b><small>Do not spend your next tempo window chasing a low-value trade.</small></div>
    </div>
    <div className={styles.lockedPlan}><span>FULL PLAYER MODEL</span><b>LOCKED UNTIL YOU SAVE YOUR HISTORY</b><i/><i/><i/></div>
    <small className={styles.honesty}>Illustrative layout. Personal reports use the player&apos;s own match evidence.</small>
  </article>;
}

function PersonalReport({data}:{data:PreviewResponse}){
  const report=data.report!;
  return <article className={styles.reportCard+' '+styles.personalReport} aria-live="polite">
    <div className={styles.reportChrome}><span>OP // YOUR PLAYER READ</span><b>LIVE</b></div>
    <div className={styles.reportIdentity}>
      <div><small>{data.account?.region}</small><strong>{data.account?.gameName}#{data.account?.tagline}</strong><span>{report.rank} · {report.primaryRole} · {report.mainChampion}</span></div>
      <div className={styles.grade}><small>GAMES</small><b>{report.gamesAnalyzed}</b></div>
    </div>
    <div className={styles.reportGrid}>
      {report.insights.map(insight=><div key={insight.label} data-tone={insight.tone}><span>{insight.label}</span><strong>{insight.value}</strong><small>{insight.detail}</small></div>)}
    </div>
    <div className={styles.focusBlock}><span>THIS WEEK&apos;S FIRST FIX · {report.focus.category.replaceAll('_',' ')}</span><strong>{report.focus.title}</strong><p>{report.focus.detail}</p><div><b>RULE</b><small>{report.focus.rule}</small></div><em>{report.focus.evidence}</em></div>
    <div className={styles.trendLine}><span>RECENT TREND</span><strong>{report.trend}</strong></div>
    <div className={styles.lockedPlan}><span>FULL PLAYER MODEL</span><b>SAVE THE HISTORY + BUILD THE PLAN</b><i/><i/><i/></div>
    <div className={styles.reportActions}><Link className={styles.analyseButton} href="/signup" data-landing-cta="personal-report-unlock">CREATE FREE ACCOUNT →</Link><small>No card required · this public preview is not saved</small></div>
  </article>;
}

export function PublicPersonalHero(){
  const [result,setResult]=useState<PreviewResponse|null>(null);
  const [available,setAvailable]=useState<boolean|null>(null);
  const proof=useMemo(()=>result?.report?(String(result.report.gamesAnalyzed)+' ranked games analysed · '+result.report.rank):'Personal coaching, not another stats page',[result]);

  return <section className={styles.heroShell} id="analyse">
    <div className={styles.heroGrid}/>
    <div className={'container '+styles.hero}>
      <div className={styles.heroCopy}>
        <div className={styles.systemLine}><span>OP CLIMB</span><i/><b>PLAYER DEVELOPMENT SYSTEM</b></div>
        <div className={styles.kicker}>YOUR GAMES → YOUR PATTERN → YOUR NEXT FIX</div>
        <h1><span>YOUR GAMES.</span><br/>YOUR COACH.</h1>
        <p>{available===false?'OP CLIMB is built to read your ranked evidence, find the pattern costing you games and turn it into one clear focus. Riot production access is currently off, so the site switches to the coaching demo instead of pretending the lookup works.':'Enter your Riot ID. OP CLIMB reads up to your last 20 ranked solo games, finds the pattern worth fixing first and gives you a personal coaching read before you create an account.'}</p>
        <RiotForm placement="hero" onResult={setResult} onAvailability={setAvailable}/>
        <div className={styles.formTrust}><span>NO CARD</span><span>NO GENERIC TIPS</span><span>{proof.toUpperCase()}</span></div>
      </div>
      <div className={styles.reportStage}>
        <div className={styles.stageLabel}><span>LIVE COACHING OUTPUT</span><b>01 / FIRST PRIORITY</b></div>
        {result?.report?<PersonalReport data={result}/>:<SampleReport/>}
        <div className={styles.stageFooter}><span>DECISION TWIN</span><i/><span>SCENARIO MEMORY</span><i/><span>PRINCIPLE ENGINE</span></div>
      </div>
    </div>
  </section>;
}

export function FinalRiotCta(){
  const [result,setResult]=useState<PreviewResponse|null>(null);
  if(result?.report)return <section className={'container '+styles.finalResult}><PersonalReport data={result}/></section>;
  return <section className={styles.finalShell}>
    <div className={'container '+styles.finalCta}>
      <div><div className={styles.kicker}>ONE INPUT. ONE FIRST FIX.</div><h2>PUT YOUR OWN GAMES<br/>ON THE SCREEN.</h2><p>Start with your Riot ID when live access is available, or use the coaching demo now.</p></div>
      <RiotForm placement="final" onResult={setResult}/>
    </div>
  </section>;
}
