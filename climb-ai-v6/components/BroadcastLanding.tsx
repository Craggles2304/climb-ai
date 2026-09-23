'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {track} from '@/lib/analytics';
import styles from './BroadcastLanding.module.css';

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

const REGIONS=['EUW','EUNE','NA','KR','BR','LAN','LAS','OCE','TR','JP'] as const;

function splitRiotId(value:string){
  const index=value.lastIndexOf('#');
  if(index<=0||index===value.length-1)return null;
  return {gameName:value.slice(0,index).trim(),tagline:value.slice(index+1).trim()};
}

function sampleStat(index:number){
  const rows=[
    {label:'CS @ 10',value:'58.6',detail:'recent sample baseline',tone:'WATCH' as const,width:'59%'},
    {label:'EARLY-DEATH GAMES',value:'40%',detail:'4 of 10 sample games',tone:'WATCH' as const,width:'40%'},
    {label:'AVG DEATHS',value:'5.8',detail:'recent sample',tone:'NEUTRAL' as const,width:'58%'},
    {label:'WIN RATE · AHEAD @ 15',value:'71%',detail:'illustrative close-out rate',tone:'GOOD' as const,width:'71%'},
  ];
  return rows[index];
}

function ScoutingCard({result,busy,step}:{result:PreviewResponse|null;busy:boolean;step:number}){
  const report=result?.report;
  const stats=useMemo(()=>{
    if(!report)return [0,1,2,3].map(sampleStat);
    const dynamic=report.insights.map((insight,index)=>({
      label:insight.label,
      value:insight.value,
      detail:insight.detail,
      tone:insight.tone,
      width:index===0?'62%':index===1?'44%':'58%',
    }));
    dynamic.push({label:'RECENT WIN RATE',value:report.winRate+'%',detail:report.gamesAnalyzed+' ranked games analysed',tone:'NEUTRAL',width:Math.max(18,Math.min(90,report.winRate))+'%'});
    return dynamic.slice(0,4);
  },[report]);

  const steps=['Finding your Riot account…','Pulling recent ranked games…','Reading early-game and resource patterns…','Building your first coaching priority…'];

  return <div className={styles.scout} id="report" aria-live="polite">
    <div className={styles.scoutHead}>
      <div>
        <div className={styles.tag}>{report?'YOUR SCOUTING REPORT':'SCOUTING REPORT · SAMPLE'}</div>
        <div className={styles.player}>{report?((result?.account?.gameName||'YOU')+' · '+report.primaryRole):'JINX · ADC'}</div>
        <div className={styles.sample}>{report?'RIOT MATCH DATA':'SAMPLE DATA'}</div>
      </div>
      <div className={styles.rank}>
        <div>{report?.rank||'GOLD IV'}<br/><span>{report?(report.gamesAnalyzed+' GAMES'):'EXAMPLE'}</span></div>
        <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 34 12v16L20 37 6 28V12Z" fill="#2A2210" stroke="#E3B34C" strokeWidth="2"/><path d="M20 11 27 20 20 29 13 20Z" fill="#E3B34C"/></svg>
      </div>
    </div>
    <div className={styles.stats}>
      {stats.map((stat,index)=><div className={styles.stat} key={stat.label}>
        <div className={styles.k}>{stat.label}</div>
        <div className={styles.v}>{stat.value}</div>
        <div className={stat.tone==='GOOD'?styles.good:stat.tone==='WATCH'?styles.bad:styles.neutral}>{stat.detail}</div>
        <div className={styles.bar}><i style={{width:stat.width,background:stat.tone==='GOOD'?'var(--good)':stat.tone==='WATCH'?'var(--bad)':'var(--cyan)'}}/></div>
      </div>)}
    </div>
    <div className={styles.fix}>
      <div className={styles.tag}>◆ {report?'YOUR #1 FIX':'EXAMPLE #1 FIX'}</div>
      <strong>{report?.focus.title||'Protect the first reset'}</strong>
      <p>{report?.focus.detail||'When lane gets shaky before your first back, keep your HP and the wave instead of forcing another trade. The point is one clear job for the next game, not another page of stats.'}</p>
      {report?.focus.rule&&<small>{report.focus.rule}</small>}
    </div>

    {busy&&<div className={styles.overlay}>{steps.map((text,index)=><div key={text} className={index<step?styles.done:index===step?styles.on:''}>{text}</div>)}</div>}
  </div>;
}

export function BroadcastLanding(){
  const [riotId,setRiotId]=useState('');
  const [region,setRegion]=useState<(typeof REGIONS)[number]>('EUW');
  const [available,setAvailable]=useState<boolean|null>(null);
  const [result,setResult]=useState<PreviewResponse|null>(null);
  const [busy,setBusy]=useState(false);
  const [step,setStep]=useState(0);
  const [error,setError]=useState('');

  useEffect(()=>{
    let alive=true;
    fetch('/api/public/preview').then(r=>r.json()).then(body=>{if(alive)setAvailable(Boolean(body?.enabled))}).catch(()=>{if(alive)setAvailable(false)});
    return()=>{alive=false};
  },[]);

  useEffect(()=>{
    if(!busy){setStep(0);return}
    const timer=window.setInterval(()=>setStep(current=>Math.min(3,current+1)),650);
    return()=>window.clearInterval(timer);
  },[busy]);

  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    if(available===false){
      document.getElementById('report')?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    const parsed=splitRiotId(riotId);
    if(!parsed){setError('Enter your Riot ID like Name#TAG.');return}
    setBusy(true);setError('');
    track('public_riot_preview_started',{placement:'broadcast_home',region});
    try{
      const response=await fetch('/api/public/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...parsed,region})});
      const body=await response.json().catch(()=>({ok:false,error:'Could not read Riot data.'})) as PreviewResponse;
      if(!response.ok||!body.ok||!body.report)throw new Error(body.error||'Could not analyse those games.');
      setResult(body);
      track('public_riot_preview_completed',{placement:'broadcast_home',region,games:body.report.gamesAnalyzed,rank:body.report.rank});
    }catch(err){
      const message=err instanceof Error?err.message:'Could not analyse those games.';
      setError(message);
      track('public_riot_preview_failed',{placement:'broadcast_home',region,message});
    }finally{
      setBusy(false);
    }
  };

  return <div className={styles.page}>
    <div className={styles.ticker} aria-label="OP CLIMB beta product feed">
      <div className={styles.live}><i/>BETA</div>
      <div className={styles.track}>
        <span><b>FREE</b> find the problem · one active focus</span>
        <span><b>PLUS</b> understand the game · full 5v5 read</span>
        <span><b>PRO</b> develop the player · long-term memory + transfer tests</span>
        <span><b>FOCUS LOOP</b> play → find → fix → prove</span>
        <span><b>FIRST RESULT</b> before sign-up when Riot access is available</span>
        <span><b>PLAYER MODEL</b> advice gets sharper as evidence grows</span>
      </div>
    </div>

    <div className={styles.wrap}>
      <nav className={styles.nav}>
        <Link className={styles.logo} href="/" aria-label="OP CLIMB home">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 29 16 16 30 3 16Z" fill="none" stroke="#E3B34C" strokeWidth="2"/><path d="M16 9 22 16 16 23 10 16Z" fill="#35D6E8"/></svg>
          OP<span>CLIMB</span>
        </Link>
        <div className={styles.navlinks}>
          <a href="#report">Sample report</a>
          <a href="#journey">How it learns</a>
          <a href="#pricing">Pricing</a>
          <Link href="/login" className={styles.btnGhost}>Sign in</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>FOUNDING BETA · PLAYER DEVELOPMENT SYSTEM</div>
          <h1>YOUR GAMES.<span className={styles.gold}>YOUR COACH.</span></h1>
          <p className={styles.lede}>{available===false?'The Riot-ID analyser is built, but production Riot API access is currently off. The scouting card shows the exact coaching format without pretending a live lookup is available.':'Enter your Riot ID. We read up to your last 20 ranked solo games, find the one repeated decision worth fixing first, and turn it into a clear next-game plan.'}</p>
          <form className={styles.lockin} onSubmit={submit}>
            <input value={riotId} onChange={e=>setRiotId(e.target.value)} placeholder="Name#TAG" autoComplete="off" aria-label="Riot ID"/>
            <select value={region} onChange={e=>setRegion(e.target.value as (typeof REGIONS)[number])} aria-label="Region">{REGIONS.map(item=><option key={item}>{item}</option>)}</select>
            <button className={styles.lockBtn} type="submit" disabled={busy||available===null}>{available===null?'Checking…':available===false?'View sample':'Lock in'}</button>
          </form>
          {error&&<div className={styles.error}>{error}</div>}
          <div className={styles.chips}><span>No card</span><span>No install to start</span><span>{available===false?'Sample mode while Riot access is off':'Result before sign-up'}</span></div>
        </div>
        <ScoutingCard result={result} busy={busy} step={step}/>
      </header>
    </div>

    <section className={styles.section} id="journey">
      <div className={styles.wrap}>
        <div className={styles.secHead}>
          <div><div className={styles.eyebrow}>YOUR SEASON ARC</div><h2>IT LEARNS HOW YOU PLAY.</h2></div>
          <p>Stat sites show the same numbers every week. OP CLIMB keeps the coaching history, so the next focus is based on what you have actually fixed and what still repeats.</p>
        </div>
        <div className={styles.arc}>
          <div className={styles.wk}><div className={styles.node}><span>W1</span></div><h3>Baseline</h3><p>Recent games establish your first repeated pattern.</p><q>“Early deaths are appearing too often.”</q></div>
          <div className={styles.wk}><div className={styles.node}><span>W2</span></div><h3>First fix</h3><p>One focus is tracked instead of ten generic tips.</p><q>“Two clean games. Keep the same rule.”</q></div>
          <div className={styles.wk}><div className={styles.node}><span>W4</span></div><h3>Your pattern</h3><p>The coach starts connecting when and why the same decision appears.</p><q>“The re-entry after first contact is the repeating problem.”</q></div>
          <div className={styles.wk}><div className={styles.node}><span>NEXT</span></div><h3>Move on</h3><p>Once the evidence says the fix holds, the next lesson replaces it.</p><q>“Local fix stable. Test it under a new condition.”</q></div>
        </div>
      </div>
    </section>

    <section className={styles.section}>
      <div className={styles.wrap}>
        <div className={styles.secHead}>
          <div><div className={styles.eyebrow}>BUILT TO BE PLAYED</div><h2>ONE FOCUS. ONE QUEUE AT A TIME.</h2></div>
          <p>The dashboard keeps the active job first and lets the deeper systems work in the background.</p>
        </div>
        <div className={styles.split}>
          <div className={styles.board}>
            <div className={styles.boardH}><b>YOUR DEVELOPMENT BOARD</b><span className={styles.note}>EXAMPLE VIEW</span></div>
            <div className={styles.row}><span className={styles.pos}>01</span><span className={styles.who}>Current focus<small>Reset discipline</small></span><span className={styles.pillHot}>ACTIVE</span><span className={styles.lp}>2 / 3 clean</span></div>
            <div className={styles.row}><span className={styles.pos}>02</span><span className={styles.who}>Background watch<small>Farm vs setup</small></span><span className={styles.pill}>WATCHING</span><span className={styles.lp}>68%</span></div>
            <div className={styles.row}><span className={styles.pos}>03</span><span className={styles.who}>Recent streak<small>Clean starts</small></span><span className={styles.pill}>EVIDENCE</span><span className={styles.lp}>3 games</span></div>
            <div className={styles.row}><span className={styles.pos}>04</span><span className={styles.who}>Next coaching depth<small>Full game context</small></span><span className={styles.pill}>PLUS</span><span className={styles.lp}>Locked</span></div>
          </div>
          <div className={styles.challenge}>
            <div className={styles.tag}>THIS WEEK&apos;S FOCUS · EXAMPLE</div>
            <h3>Clean first ten</h3>
            <p>Finish three tracked games without giving away an early death, then see whether the same discipline holds in a different matchup.</p>
            <div className={styles.prog} aria-label="2 of 3 games complete"><i className={styles.on}/><i className={styles.on}/><i/></div>
            <div className={styles.note}>2 / 3 CLEAN GAMES</div>
            <div className={styles.badges}><span>◆ Focus active</span><span>◇ Evidence tracked</span><span>▣ Next test locked</span></div>
          </div>
        </div>
      </div>
    </section>

    <section className={styles.section} id="pricing">
      <div className={styles.wrap}>
        <div className={styles.secHead}>
          <div><div className={styles.eyebrow}>CHOOSE YOUR DEPTH</div><h2>START FREE. UNLOCK THE NEXT LAYER.</h2></div>
          <p>Every plan follows the same coaching journey. The difference is how much context and memory the coach can use.</p>
        </div>
        <div className={styles.tiers}>
          <article className={styles.tier}>
            <div className={styles.role}>Find the problem</div><h3>Free</h3><div className={styles.price}>£0</div>
            <ul><li>Recent game review</li><li>Your #1 active focus</li><li>2 Fix Ladder stages</li><li>7-day progress context</li></ul>
            <Link className={styles.go} href="/signup">Start free</Link>
          </article>
          <article className={styles.tier+' '+styles.feat}>
            <span className={styles.flag}>NEXT LAYER</span><div className={styles.role}>Understand the game</div><h3>Plus</h3><div className={styles.price}>£9.99<small> / month</small></div>
            <ul><li>Everything in Free</li><li>Full 5v5 game plan</li><li>Both win conditions + your role</li><li>90-day history</li><li>4 Fix Ladder stages</li></ul>
            <Link className={styles.go} href="/pricing">Unlock Plus</Link>
          </article>
          <article className={styles.tier}>
            <div className={styles.role}>Develop the player</div><h3>Pro</h3><div className={styles.price}>£19.99<small> / month</small></div>
            <ul><li>Everything in Plus</li><li>Recurring habit memory</li><li>Scenario + transfer tests</li><li>Principle-level learning</li><li>Autonomous next lesson</li></ul>
            <Link className={styles.go} href="/pricing">See Pro</Link>
          </article>
        </div>
        <p className={styles.fine}>No fake rank guarantees. Upgrade when you want a deeper coach, not a noisier dashboard.</p>
      </div>
    </section>

    <footer className={styles.footer}>
      <div className={styles.wrap}>
        <div className={styles.footerLinks}><Link href="/pricing">Pricing</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link></div>
        <p>OP CLIMB is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.</p>
      </div>
    </footer>
  </div>;
}
