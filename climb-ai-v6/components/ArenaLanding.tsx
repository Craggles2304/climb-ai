'use client';

import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import {OpMark} from './UI';
import {track} from '@/lib/analytics';
import {PLAN_COPY} from '@/lib/subscription';
import styles from './ArenaLanding.module.css';

type PreviewResponse={
  ok:boolean;
  error?:string;
  account?:{gameName:string;tagline:string;region:string};
  report?:{
    gamesAnalyzed:number;
    rank:string;
    primaryRole:string;
    mainChampion:string;
    winRate:number;
    insights:Array<{label:string;value:string;detail:string;tone:string}>;
    focus:{title:string;category:string;detail:string;rule:string;evidence:string};
  };
};

const REGIONS=['EUW','EUNE','NA','KR','BR','LAN','LAS','OCE','TR','JP'];
const journey=[
  {number:'01',label:'CONNECT',title:'Your setup, once.',body:'Pair the Windows Companion with your OP CLIMB account. It watches for League and brings your games into the same coaching history.',image:'/product/companion-home.png',caption:'Companion Home · sample account'},
  {number:'02',label:'PREPARE',title:'See the draft clearly.',body:'The live draft shows known picks, your matchup and the responsibility you carry into the game. Unknown opponents stay unknown.',image:'/product/companion-draft.png',caption:'Champion Select · sample draft'},
  {number:'03',label:'PLAY',title:'Keep one job in focus.',body:'Take the frozen pregame mission into the match. The compact overlay helps you remember the plan without covering the game.',image:'/product/companion-overlay.png',caption:'Learning HUD · sample plan'},
  {number:'04',label:'REVIEW',title:'Find the decisions that mattered.',body:'After the match, inspect supported moments, the evidence behind them and the better option for next time.',image:'/product/companion-review.png',caption:'Post-game Review · sample match'},
  {number:'05',label:'IMPROVE',title:'Make progress visible.',body:'Three tracked games establish your role baseline. Verified games then develop the six strands of your Game DNA.',image:'/product/companion-dna.png',caption:'My Game DNA · sample profile'},
] as const;
const domains=[
  {name:'Laning',color:'var(--arena-lime)',body:'Trades, spacing and pressure. Learn when your lane decisions create a real advantage.'},
  {name:'Waves & CS',color:'var(--arena-cyan)',body:'Farm, wave control and resets. See how small lane choices change the next two minutes.'},
  {name:'Vision & Map',color:'var(--arena-violet)',body:'Map awareness and useful information. Connect what you knew to the choice you made.'},
  {name:'Objectives',color:'var(--arena-gold)',body:'Preparation, timing and conversion. Turn priority into a plan before the objective starts.'},
  {name:'Teamfights',color:'var(--arena-red)',body:'Positioning, target access and discipline. Review the fight through the decisions you could control.'},
  {name:'Consistency',color:'#88aaff',body:'Repeatable habits across matches. A good decision matters more when it survives a new situation.'},
] as const;

function QuickPreview(){
  const [enabled,setEnabled]=useState<boolean|null>(null);
  const [riotId,setRiotId]=useState('');
  const [region,setRegion]=useState('EUW');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState<PreviewResponse|null>(null);
  useEffect(()=>{
    let alive=true;
    fetch('/api/public/preview').then(r=>r.json()).then(body=>{if(alive)setEnabled(Boolean(body?.enabled))}).catch(()=>{if(alive)setEnabled(false)});
    return()=>{alive=false};
  },[]);
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const split=riotId.trim().lastIndexOf('#');
    if(split<1||split===riotId.trim().length-1){setError('Enter a Riot ID in the form Name#TAG.');return}
    setError('');
    setResult(null);
    setBusy(true);
    const gameName=riotId.trim().slice(0,split);
    const tagline=riotId.trim().slice(split+1);
    track('public_riot_preview_started',{placement:'arena_landing',region});
    try{
      const response=await fetch('/api/public/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({gameName,tagline,region})});
      const body=await response.json() as PreviewResponse;
      if(!response.ok||!body.ok||!body.report)throw new Error(body.error||'The scouting preview is unavailable right now.');
      setResult(body);
      track('public_riot_preview_completed',{placement:'arena_landing',region,games:body.report.gamesAnalyzed,rank:body.report.rank});
    }catch(caught){
      setError(caught instanceof Error?caught.message:'The scouting preview is unavailable right now.');
      track('public_riot_preview_failed',{placement:'arena_landing',region});
    }finally{setBusy(false)}
  };
  return <section className={styles.preview} id="preview" aria-labelledby="preview-title">
    <div className={styles.previewIntro}>
      <span className={styles.kicker}>A LOOK AT YOUR GAMES</span>
      <h2 id="preview-title">The first useful answer starts with evidence.</h2>
      <p>Enter a Riot ID for a quick ranked scouting report. Your full Game DNA begins after three tracked role games with the Companion.</p>
      <form className={styles.previewForm} onSubmit={submit}>
        <label className={styles.srOnly} htmlFor="arena-riot-id">Riot ID</label>
        <input id="arena-riot-id" value={riotId} onChange={event=>setRiotId(event.target.value)} placeholder="Name#TAG" autoComplete="off"/>
        <label className={styles.srOnly} htmlFor="arena-region">Region</label>
        <select id="arena-region" value={region} onChange={event=>setRegion(event.target.value)}>{REGIONS.map(item=><option key={item}>{item}</option>)}</select>
        <button type="submit" disabled={busy||enabled!==true}>{busy?'CHECKING…':'SCOUT MY GAMES'}</button>
      </form>
      {enabled===false&&<p className={styles.formNote}>Live scouting is unavailable at the moment. You can still start with the Companion.</p>}
      {error&&<p className={styles.formError} role="alert">{error}</p>}
    </div>
    <div className={styles.previewResult} aria-live="polite">
      {result?.report?<><span>RIOT MATCH DATA · {result.report.gamesAnalyzed} GAMES</span>
        <h3>{result.account?.gameName}#{result.account?.tagline}</h3>
        <div className={styles.previewFacts}><b>{result.report.rank}</b><b>{result.report.primaryRole}</b><b>{result.report.winRate}% recent win rate</b></div>
        <strong>{result.report.focus.title}</strong>
        <p>{result.report.focus.detail}</p>
        <small>{result.report.focus.evidence}</small>
      </>:<><span>WHAT THE SCOUTING PREVIEW DOES</span><h3>ONE PATTERN.<br/>ONE NEXT STEP.</h3><p>When Riot match data is available, this panel shows your recent games and a specific focus. It never substitutes sample numbers for your results.</p><div className={styles.previewGhost}><i/><i/><i/></div><small>No player data loaded</small></>}
    </div>
  </section>;
}

export function ArenaLanding(){
  const [stage,setStage]=useState(0);
  const [domain,setDomain]=useState(0);
  return <div className={styles.page}>
    <a className={styles.skip} href="#main">Skip to content</a>
    <header className={styles.nav}>
      <Link className={styles.brand} href="/" aria-label="OP CLIMB home"><span className={styles.brandMark}><OpMark/></span><span>OP <b>CLIMB</b></span></Link>
      <nav aria-label="Public navigation"><a href="#experience">Experience</a><a href="#dna">Game DNA</a><Link href="/pricing">Pricing</Link><a href="#download">Download</a></nav>
      <div className={styles.navEnd}><Link href="/login">SIGN IN</Link><Link className={styles.navCta} href="/signup">START FREE <span aria-hidden="true">↗</span></Link></div>
    </header>

    <main id="main">
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroArt}><img src="/assets/jinx-splash.jpg" alt=""/><span>FEATURED CHAMPION ART · JINX</span></div>
        <div className={styles.heroGrid} aria-hidden="true"/>
        <div className={styles.heroInner}>
          <div className={styles.heroIndex}><span>OP / 001</span><span>THE CLIMB STARTS HERE</span></div>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}><i/> PERSONAL LEAGUE COACHING</span>
            <h1 id="hero-title">STOP GUESSING.<br/><em>START CLIMBING.</em></h1>
            <p>Your personal League of Legends AI coach. Understand your matches, fix your habits and build measurable improvement.</p>
            <div className={styles.heroActions}><Link className={styles.primaryButton} href="/signup">START CLIMBING FREE <span aria-hidden="true">↗</span></Link><a className={styles.secondaryButton} href="#experience">EXPLORE THE COMPANION <span aria-hidden="true">↓</span></a></div>
          </div>
          <div className={styles.heroFoot}><span>CONNECT <i/> PREPARE <i/> PLAY <i/> REVIEW <i/> IMPROVE</span><span>SCROLL TO ENTER THE ARENA ↓</span></div>
        </div>
      </section>

      <section className={styles.productFrame} id="experience" aria-labelledby="experience-title">
        <div className={styles.frameHeading}><div><span className={styles.kicker}>01 / THE EXPERIENCE</span><h2 id="experience-title">A COACHING COMMAND CENTRE.<br/><em>BUILT AROUND YOUR NEXT GAME.</em></h2></div><p>See the actual Companion interface, rendered with clearly marked sample player data. Your own screen uses your connected Riot account and verified match evidence.</p></div>
        <div className={styles.frameImage}><a href="/product/companion-home.png" target="_blank" rel="noopener" aria-label="Open full Companion Home screenshot"><img src="/product/companion-home.png" alt="OP CLIMB Companion Home screen showing Game DNA and a next mission using sample player data"/></a><span>APPLICATION CAPTURE <b>·</b> SAMPLE PLAYER DATA</span></div>
      </section>

      <section className={styles.journey} aria-labelledby="journey-title">
        <div className={styles.sectionLead}><span className={styles.kicker}>02 / THE MATCH LOOP</span><h2 id="journey-title">EVERY GAME HAS<br/><em>A PURPOSE.</em></h2><p>The same coaching thread runs from the draft to the review. Choose a stage to see where the Companion helps.</p></div>
        <div className={styles.journeyLayout}>
          <div className={styles.stageTabs} role="tablist" aria-label="Explore the OP CLIMB match loop">
            {journey.map((item,index)=><button type="button" key={item.label} role="tab" id={'arena-tab-'+index} aria-controls="arena-stage-panel" aria-selected={stage===index} tabIndex={stage===index?0:-1} onClick={()=>setStage(index)} className={stage===index?styles.stageActive:''}><span>{item.number}</span><b>{item.label}</b><span aria-hidden="true">↗</span></button>)}
          </div>
          <div className={styles.stagePanel} id="arena-stage-panel" role="tabpanel" aria-labelledby={'arena-tab-'+stage}>
            <div className={styles.stageVisual}><img src={journey[stage].image} alt={journey[stage].caption}/><span>APP CAPTURE · SAMPLE DATA</span></div>
            <div className={styles.stageCopy}><span>{journey[stage].number} / {journey[stage].label}</span><h3>{journey[stage].title}</h3><p>{journey[stage].body}</p><small>{journey[stage].caption}</small></div>
          </div>
        </div>
      </section>

      <section className={styles.dna} id="dna" aria-labelledby="dna-title">
        <div className={styles.dnaHeader}><div><span className={styles.kicker}>03 / YOUR PLAYER IDENTITY</span><h2 id="dna-title">SIX STRANDS.<br/><em>ONE PLAYER.</em></h2></div><p>Game DNA begins with a three game role baseline. The shape grows only when tracked matches provide evidence. Explore what each strand measures.</p></div>
        <div className={styles.dnaLayout}>
          <div className={styles.dnaVisual} aria-label="Illustrative Game DNA constellation; no player scores shown">
            <svg viewBox="0 0 620 520" role="img" aria-label="Six connected Game DNA domains around a central player identity">
              <path className={styles.dnaOrbit} d="M310 66 513 176 513 345 310 455 107 345 107 176Z"/>
              <path className={styles.dnaInner} d="M310 142 435 211 435 310 310 381 185 310 185 211Z"/>
              {[[310,66],[513,176],[513,345],[310,455],[107,345],[107,176]].map(([x,y],index)=><g key={index}><line className={styles.dnaLine} x1="310" y1="260" x2={x} y2={y}/><circle className={domain===index?styles.dnaNodeActive:styles.dnaNode} cx={x} cy={y} r={domain===index?19:13} style={{'--node-color':domains[index].color} as React.CSSProperties}/></g>)}
              <circle className={styles.dnaHub} cx="310" cy="260" r="74"/><text x="310" y="253" textAnchor="middle" className={styles.dnaHubTitle}>GAME DNA</text><text x="310" y="278" textAnchor="middle" className={styles.dnaHubSub}>YOUR PLAYER SHAPE</text>
            </svg>
            <span className={styles.sampleLabel}>EXPLAINER · NO PLAYER SCORES</span>
          </div>
          <div className={styles.domainPanel}>
            <span className={styles.panelIndex}>STRAND {String(domain+1).padStart(2,'0')} / 06</span>
            <h3 style={{color:domains[domain].color}}>{domains[domain].name}</h3>
            <p>{domains[domain].body}</p>
            <div className={styles.domainChoices} role="group" aria-label="Choose a Game DNA domain">{domains.map((item,index)=><button type="button" key={item.name} onClick={()=>setDomain(index)} aria-pressed={domain===index} style={{'--node-color':item.color} as React.CSSProperties}><i/>{item.name}<span>0{index+1}</span></button>)}</div>
            <div className={styles.dnaRule}><b>HOW PROGRESS WORKS</b><p>After the baseline, missions progress from verified match evidence. Unobserved decisions do not earn credit.</p></div>
          </div>
        </div>
      </section>

      <QuickPreview/>

      <section className={styles.plans} id="plans" aria-labelledby="plans-title">
        <div className={styles.plansIntro}><span className={styles.kicker}>04 / CHOOSE YOUR DEPTH</span><h2 id="plans-title">START FREE.<br/><em>GROW WITH THE COACH.</em></h2><p>Useful from the first tier. Upgrade for the level of context and long term memory you want.</p></div>
        <div className={styles.planLayout}>
          <article className={styles.planFree}><span>FREE / FIND THE FOCUS</span><h3>Start with the next fix.</h3><strong>{PLAN_COPY.FREE.price}</strong><p>Get a review, one next game focus and a way to see whether the habit changes.</p><Link href="/signup">START FREE ↗</Link></article>
          <article className={styles.planPlus}><span>PLUS / UNDERSTAND THE GAME</span><h3>See the whole picture.</h3><strong>{PLAN_COPY.PLUS.price}</strong><p>Make Game DNA a managed player plan, with deeper match context, a full draft plan and 90 days of history.</p><Link href="/pricing">EXPLORE PLUS ↗</Link></article>
          <article className={styles.planPro}><span>PRO / BUILD YOUR COACH</span><h3>A coach that remembers.</h3><strong>{PLAN_COPY.PRO.price}</strong><p>Add Decision Twin, Coach Memory and long term development intelligence to the full Plus experience.</p><Link href="/pricing">EXPLORE PRO ↗</Link></article>
        </div>
        <Link className={styles.compareLink} href="/pricing">COMPARE EVERY INCLUDED FEATURE <span aria-hidden="true">↗</span></Link>
      </section>

      <section className={styles.download} id="download" aria-labelledby="download-title">
        <div className={styles.downloadArt}><img src="/assets/jinx-splash.jpg" alt=""/></div>
        <div className={styles.downloadBody}><span className={styles.kicker}>05 / WINDOWS COMPANION</span><h2 id="download-title">READY WHEN<br/><em>YOU QUEUE.</em></h2><p>Download the Windows Companion, sign in to OP CLIMB and pair this PC from the Match Room. The app will guide you through the first tracked game.</p><ol><li><b>01</b> Install the Companion on Windows</li><li><b>02</b> Pair this PC with your account</li><li><b>03</b> Play normally and build your baseline</li></ol><div className={styles.downloadActions}><a className={styles.primaryButton} href="/download/windows">DOWNLOAD FOR WINDOWS ↗</a><Link href="/live">PAIRING GUIDE ↗</Link></div><small>The download link serves the currently published installer. This redesign remains a preview until approved.</small></div>
      </section>
    </main>
    <footer className={styles.footer}><Link href="/" className={styles.footerBrand}>OP <b>CLIMB</b></Link><span>YOUR GAMES. YOUR COACH. YOUR CLIMB.</span><div><Link href="/privacy">PRIVACY</Link><Link href="/terms">TERMS</Link><Link href="/support">SUPPORT</Link></div><small>OP CLIMB is not endorsed by Riot Games. League of Legends and related artwork are trademarks of Riot Games.</small></footer>
  </div>;
}