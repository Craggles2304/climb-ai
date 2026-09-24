'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {track} from '@/lib/analytics';
import styles from './BroadcastLanding.module.css';
import {OpMark} from './UI';

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
const SAMPLE_STATS=[
  {label:'CS @ 10',value:'58.6',detail:'▼ 7.4 vs sample Gold avg',tone:'WATCH' as const,width:'59%',marker:'66%'},
  {label:'Early-death games',value:'40%',detail:'▲ 2× sample Gold avg',tone:'WATCH' as const,width:'40%',marker:'20%'},
  {label:'Damage share',value:'31%',detail:'▲ sample top 20% of ADCs',tone:'GOOD' as const,width:'78%',marker:'60%'},
  {label:'Win rate · ahead at 15',value:'71%',detail:'Example: closes games well',tone:'GOOD' as const,width:'71%',marker:'62%'},
];

function splitRiotId(value:string){
  const index=value.lastIndexOf('#');
  if(index<=0||index===value.length-1)return null;
  return {gameName:value.slice(0,index).trim(),tagline:value.slice(index+1).trim()};
}

function ScoutingCard({result,busy,step,demoName}:{result:PreviewResponse|null;busy:boolean;step:number;demoName:string}){
  const report=result?.report;
  const stats=useMemo(()=>{
    if(!report)return SAMPLE_STATS;
    const dynamic=report.insights.map((insight,index)=>({
      label:insight.label,
      value:insight.value,
      detail:insight.detail,
      tone:insight.tone,
      width:index===0?'62%':index===1?'44%':'58%',
      marker:index===0?'66%':index===1?'20%':'60%',
    }));
    dynamic.push({
      label:'Recent win rate',
      value:report.winRate+'%',
      detail:report.gamesAnalyzed+' ranked games analysed',
      tone:'GOOD' as const,
      width:Math.max(18,Math.min(90,report.winRate))+'%',
      marker:'50%',
    });
    return dynamic.slice(0,4);
  },[report]);

  const steps=[
    'Finding '+(demoName||'your Riot ID')+' on Riot…',
    'Pulling 20 ranked games…',
    'Mapping early deaths and lane patterns…',
    'Comparing your recent evidence…',
    'Found your #1 fix',
  ];

  const playerName=report
    ? ((result?.account?.gameName||'YOU')+' · '+report.primaryRole).toUpperCase()
    : (demoName?demoName.split('#')[0].toUpperCase()+' · ADC':'JINX · ADC');

  return <div className={styles.scout} id="scout" aria-live="polite">
    <div className={styles['scout-head']}>
      <div>
        <div className={styles.tag}>{report?'Scouting report · recent ranked':'Scouting report · last 20 ranked'}</div>
        <div className={styles.player}>{playerName}</div>
        <div className={styles.sample}>{report?'RIOT MATCH DATA':'SAMPLE DATA'}</div>
      </div>
      <div className={styles.rank}>
        <div>{report?.rank||'GOLD IV'}<br/><span>{report?(report.gamesAnalyzed+' GAMES'):'47 LP'}</span></div>
        <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 34 12v16L20 37 6 28V12Z" fill="#2a2519" stroke="#e8c086" strokeWidth="2"/><path d="M20 11 27 20 20 29 13 20Z" fill="#e8c086"/></svg>
      </div>
    </div>

    <div className={styles.stats}>
      {stats.map(stat=><div className={styles.stat} key={stat.label}>
        <div className={styles.k}>{stat.label}</div>
        <div className={styles.v}>{stat.value}</div>
        <div className={stat.tone==='GOOD'?styles.good:stat.tone==='WATCH'?styles.bad:styles.neutral}>{stat.detail}</div>
        <div className={styles.bar}>
          <i style={{'--w':stat.width,'--c':stat.tone==='GOOD'?'var(--good)':stat.tone==='WATCH'?'var(--bad)':'var(--teal)'} as React.CSSProperties}/>
          <u style={{'--m':stat.marker} as React.CSSProperties}/>
        </div>
      </div>)}
    </div>

    <div className={styles.fix}>
      <div className={styles.tag}>Your #1 fix this week</div>
      <strong>{report?.focus.title||'Protect the first reset'}</strong>
      <p>{report?.focus.detail||'When lane gets shaky before your first back, keep your HP and the wave instead of forcing another trade. The sample shows how OP CLIMB turns one pattern into one job for the next game.'}</p>
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
  const [demoName,setDemoName]=useState('');

  useEffect(()=>{
    let alive=true;
    fetch('/api/public/preview')
      .then(response=>response.json())
      .then(body=>{if(alive)setAvailable(Boolean(body?.enabled))})
      .catch(()=>{if(alive)setAvailable(false)});
    return()=>{alive=false};
  },[]);

  useEffect(()=>{
    if(!busy){setStep(0);return}
    const timer=window.setInterval(()=>setStep(current=>Math.min(4,current+1)),550);
    return()=>window.clearInterval(timer);
  },[busy]);

  const runSample=(name:string)=>{
    setResult(null);
    setDemoName(name||'You#EUW');
    setBusy(true);
    window.setTimeout(()=>setBusy(false),5*550+700);
  };

  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    const entered=riotId.trim()||'You#EUW';

    if(available===false){
      runSample(entered);
      return;
    }

    const parsed=splitRiotId(entered);
    if(!parsed){setError('Enter your Riot ID like Name#TAG.');return}
    setBusy(true);
    setError('');
    setDemoName(entered);
    track('public_riot_preview_started',{placement:'broadcast_home',region});
    try{
      const response=await fetch('/api/public/preview',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({...parsed,region}),
      });
      const body=await response.json().catch(()=>({ok:false,error:'Could not read Riot data.'})) as PreviewResponse;
      if(!response.ok||!body.ok||!body.report)throw new Error(body.error||'Could not analyse those games.');
      setResult(body);
      track('public_riot_preview_completed',{placement:'broadcast_home',region,games:body.report.gamesAnalyzed,rank:body.report.rank});
    }catch(err){
      const message=err instanceof Error?err.message:'Could not analyse those games.';
      setError(message);
      setBusy(false);
      window.setTimeout(()=>runSample(entered),0);
      track('public_riot_preview_failed',{placement:'broadcast_home',region,message});
    }finally{
      setBusy(false);
    }
  };

  return <div className={styles.page}>
    <div className={styles.ticker} aria-label="Example climbs ticker">
      <div className={styles.live}>EXAMPLE CLIMBS</div>
      <div className={styles.track}>
        <span><b>Kai#EUW</b> Silver I → <span className={styles.up}>Gold IV</span> · fix: first reset</span>
        <span><b>moonlane#NA1</b> focus streak <span className={styles.up}>5 games</span> · 0 deaths pre-10</span>
        <span><b>Tomás#LAS</b> CS@10 <span className={styles.up}>+11</span> this week</span>
        <span><b>veyra#EUNE</b> Plat II → <span className={styles.up}>Plat I</span> · fix: vision before objectives</span>
        <span><b>Squad “Baron Buffers”</b> +312 LP combined this week</span>
        <span><b>jun#KR1</b> new fix unlocked · <span className={styles.up}>tempo on crash</span></span>
      </div>
    </div>

    <div className={styles.wrap}>
      <nav className={styles.nav}>
        <Link className={styles.logo} href="/">
          <OpMark/>
          <span>OP<span className={styles.mintText}>CLIMB</span></span>
        </Link>
        <div className={styles.navlinks}>
          <a href="#how-it-works" className={styles['hide-sm']}>How it works</a>
          <a href="#pricing" className={styles['hide-sm']}>Plans</a>
          <a href="/client" className={styles.clientNav}><span className={styles['hide-sm']}>Client demo</span><span className={styles['show-sm']}>Demo</span></a>
          <Link href="/login" className={styles['hide-sm']}>Sign in</Link>
          <Link href="/signup" className={styles.navPrimary}>Start free</Link>
        </div>
      </nav>

      <header className={styles.hero} id="report">
        <div>
          <div className={styles.eyebrow}>Season 2026 · Split 3 is live</div>
          <h1>Your games.<em className={styles.gold}>Your coach.</em></h1>
          <p className={styles.lede}>Enter your Riot ID. We read your last 20 ranked games, find the one decision pattern worth fixing first, and turn it into a focused coaching plan.</p>
          <form className={styles.lockin} onSubmit={submit}>
            <input value={riotId} onChange={e=>setRiotId(e.target.value)} placeholder="Name#TAG" autoComplete="off" aria-label="Riot ID"/>
            <select value={region} onChange={e=>setRegion(e.target.value as (typeof REGIONS)[number])} aria-label="Region">{REGIONS.map(item=><option key={item}>{item}</option>)}</select>
            <button className={styles['lock-btn']} type="submit" disabled={busy||available===null}>Lock in</button>
          </form>
          {error&&<div className={styles.error}>{error} Showing the sample report instead.</div>}
          <div className={styles.chips}><span>No card</span><span>No install to start</span><span>Result before sign-up</span></div>
          <a className={styles.clientLink} href="/client">Want to see inside first? Explore the interactive client →</a>
        </div>

        <ScoutingCard result={result} busy={busy} step={step} demoName={demoName}/>
      </header>
    </div>

    <section className={styles.section} id="how-it-works">
      <div className={styles.wrap}>
        <div className={styles['sec-head']}>
          <div><div className={styles.eyebrow}>Your season arc</div><h2>It learns how you play.</h2></div>
          <p>Stat sites show the same numbers every week. OP CLIMB keeps a record of your games, so the advice gets sharper the more you play.</p>
        </div>
        <div className={styles.arc}>
          <div className={styles.wk}><div className={styles.node}><span>W1</span></div><h3>Baseline</h3><p>20 games scanned. Your weakest habit found.</p><q>“You die before 10 min in 40% of games.”</q></div>
          <div className={styles.wk}><div className={styles.node}><span>W2</span></div><h3>First fix</h3><p>One focus, tracked every game you play.</p><q>“3 games in a row, no early deaths. Keep going.”</q></div>
          <div className={styles.wk}><div className={styles.node}><span>W4</span></div><h3>Your pattern</h3><p>It spots when and why the mistakes happen.</p><q>“Your early deaths come after a lost bot-lane 2v2 at level 2 against engage supports.”</q></div>
          <div className={styles.wk}><div className={styles.node}><span>W8</span></div><h3>Next rank</h3><p>The fix stuck, so it picks the next one.</p><q>“Next fix: rotate mid after first tower.”</q></div>
        </div>
      </div>
    </section>

    <section className={styles.section} id="squads">
      <div className={styles.wrap}>
        <div className={styles['sec-head']}>
          <div><div className={styles.eyebrow}>Climb with your squad</div><h2>Built to be played.</h2></div>
          <p>Weekly challenges, focus streaks and squad-style boards show how the coaching loop can stay visible between games.</p>
        </div>
        <div className={styles.split}>
          <div className={styles.board}>
            <div className={styles['board-h']}><b>Squad board · this week</b><span className={styles.note}>EXAMPLE</span></div>
            <div className={styles.row}><span className={styles.pos}>1</span><span className={styles.who}>Kai<small>Jungle · Gold II</small></span><span className={styles.pill+' '+styles.hot}>7-game streak</span><span className={styles.lp}>+142 LP</span></div>
            <div className={styles.row}><span className={styles.pos}>2</span><span className={styles.who}>moonlane<small>Mid · Plat IV</small></span><span className={styles.pill}>fix locked in</span><span className={styles.lp}>+96 LP</span></div>
            <div className={styles.row}><span className={styles.pos}>3</span><span className={styles.who}>Tomás<small>ADC · Silver I</small></span><span className={styles.pill}>CS +11</span><span className={styles.lp}>+61 LP</span></div>
            <div className={styles.row}><span className={styles.pos}>4</span><span className={styles.who}>veyra<small>Support · Gold IV</small></span><span className={styles.pill}>vision 2.1/min</span><span className={styles.lp}>+40 LP</span></div>
          </div>

          <div className={styles.board+' '+styles.challenge}>
            <div className={styles.tag+' '+styles.cyan}>Weekly challenge · ends Sunday</div>
            <h3>Clean laning phase</h3>
            <p>Finish 5 ranked games with zero deaths before 10:00.</p>
            <div className={styles.prog} aria-label="3 of 5 games complete"><i className={styles.on}/><i className={styles.on}/><i className={styles.on}/><i/><i/></div>
            <div className={styles.note}>3 / 5 COMPLETE · EXAMPLE</div>
            <div className={styles.badges}>
              <div className={styles.badge}>◆ Streak</div>
              <div className={styles.badge}>◇ Fix locked</div>
              <div className={styles.badge}>▣ Locked</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className={styles.section} id="pricing">
      <div className={styles.wrap}>
        <div className={styles['sec-head']}>
          <div><div className={styles.eyebrow}>Free → Plus → Pro</div><h2>Free finds it. Plus explains it. Pro develops it.</h2></div>
          <p>Start without paying. Upgrade only when you want deeper game context or a coach that remembers your development across matches.</p>
        </div>
        <div className={styles.tiers}>
          <div className={styles.tier}>
            <div className={styles.role}>Find what to fix</div><h3>Free</h3><div className={styles.price}>£0</div>
            <p className={styles.fit}><b>Choose Free if:</b> you want to prove OP CLIMB can find something useful before you spend anything.</p>
            <ul><li>Scan your recent ranked games</li><li>Get your #1 next-game fix</li><li>Track one active focus</li><li>See whether that focus is improving</li></ul>
            <a className={styles.go} href="#report">Try the free coach</a>
          </div>
          <div className={styles.tier+' '+styles.feat}>
            <span className={styles.flag}>GAME-BY-GAME COACHING</span><div className={styles.role}>Understand every game</div><h3>Plus</h3><div className={styles.price}>£9.99<small> / month</small></div>
            <p className={styles.fit}><b>Choose Plus if:</b> you want to understand the whole match, not just the mistake OP CLIMB found.</p>
            <ul><li>Everything in Free</li><li>Full 5v5 draft + win conditions</li><li>Your exact role in the game plan</li><li>Deeper fight, reset and economy context</li><li>90 days of history</li></ul>
            <Link className={styles.go} href="/pricing">Compare Plus</Link>
          </div>
          <div className={styles.tier}>
            <div className={styles.role}>Build your personal coach</div><h3>Pro</h3><div className={styles.price}>£19.99<small> / month</small></div>
            <p className={styles.fit}><b>Choose Pro if:</b> you want OP CLIMB to learn you over time and decide what your development needs next.</p>
            <ul><li>Everything in Plus</li><li>Decision Twin remembers recurring habits</li><li>Checks whether a fix really sticks</li><li>Tests skills in new champions and situations</li><li>Moves you to the next lesson when ready</li></ul>
            <Link className={styles.go} href="/pricing">See how Pro develops you</Link>
          </div>
        </div>
        <div className={styles.planFoot}><span>No card needed to start · Cancel paid plans anytime · No fake rank guarantees</span><Link href="/pricing">Compare every plan →</Link></div>
      </div>
    </section>

    <footer className={styles.footer}>
      <div className={styles.wrap}>
        <p className={styles.note}>SAMPLE DATA NOTICE · names, ranks and example climb results shown on this page are illustrative.</p>
        <p>OP CLIMB isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.</p>
      </div>
    </footer>
  </div>;
}
