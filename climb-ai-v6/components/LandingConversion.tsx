'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {track} from '@/lib/analytics';
import styles from './LandingConversion.module.css';

type PreviewResult={
  id:string;champion:string;role:string;result:'WIN'|'LOSS';kda:string;csPerMin:string;rank:string;
  stamp:string;headline:string;detail:string;rule:string;evidence:string;
};

const SAMPLES:PreviewResult[]=[
  {
    id:'jinx',champion:'Jinx',role:'ADC',result:'LOSS',kda:'4 / 5 / 7',csPerMin:'6.3',rank:'GOLD SAMPLE',
    stamp:'22:14 · DEATH → BARON',headline:'THE DEATH WAS MORE EXPENSIVE THAN THE KILL GOLD.',
    detail:'You died before the map was stable. Baron went to the enemy 37 seconds later, so the real cost was the objective window you could no longer contest.',
    rule:'NEXT GAME RULE · Before a major objective, refuse the first neutral fight unless your team has numbers, setup or first damage.',
    evidence:'Illustrative sample · timestamped death with an objective consequence.',
  },
  {
    id:'hecarim',champion:'Hecarim',role:'JUNGLE',result:'WIN',kda:'8 / 4 / 11',csPerMin:'6.0',rank:'SILVER SAMPLE',
    stamp:'17:48 · POWER WINDOW',headline:'YOU HAD THE LEAD — BUT THE NEXT FIGHT DID NOT USE IT.',
    detail:'The sample shows a strong item and level window followed by a neutral engage. Winning the previous play did not automatically make the next fight good.',
    rule:'NEXT GAME RULE · After a successful play, spend the gold and create the next numbers edge before you force again.',
    evidence:'Illustrative sample · power conversion and reset timing.',
  },
  {
    id:'shen',champion:'Shen',role:'TOP',result:'WIN',kda:'3 / 3 / 14',csPerMin:'5.1',rank:'BRONZE SAMPLE',
    stamp:'12:27 · GOOD DECISION',headline:'THIS IS THE KIND OF PLAY OP CLIMB SHOULD NOT “FIX”.',
    detail:'The sample marks a lower-CS moment as good because the global play created a numbers advantage and converted into team value. Outcome and context both matter.',
    rule:'NEXT GAME RULE · Keep using your global pressure when the play creates a clear numbers edge; recover the safe side-lane resource afterwards.',
    evidence:'Illustrative sample · decision quality separated from raw farming stats.',
  },
];

export function LandingFunnelTracking(){
  useEffect(()=>{
    const fired=new Set<number>();
    let ticking=false;
    const readDepth=()=>{
      ticking=false;
      const root=document.documentElement;
      const max=Math.max(1,root.scrollHeight-window.innerHeight);
      const depth=Math.min(100,Math.round((window.scrollY/max)*100));
      for(const mark of [25,50,75,90])if(depth>=mark&&!fired.has(mark)){
        fired.add(mark);
        track('landing_scroll_depth',{depth:mark});
      }
    };
    const onScroll=()=>{
      if(ticking)return;
      ticking=true;
      window.requestAnimationFrame(readDepth);
    };
    const onClick=(event:MouseEvent)=>{
      const el=(event.target as Element|null)?.closest('[data-landing-cta]') as HTMLElement|null;
      if(!el)return;
      track('landing_cta_clicked',{placement:el.dataset.landingCta||'unknown',href:el.getAttribute('href')||''});
    };
    readDepth();
    window.addEventListener('scroll',onScroll,{passive:true});
    document.addEventListener('click',onClick);
    return()=>{
      window.removeEventListener('scroll',onScroll);
      document.removeEventListener('click',onClick);
    };
  },[]);
  return null;
}

export function PublicMatchPreview(){
  const [selected,setSelected]=useState(SAMPLES[0]);
  const [scanning,setScanning]=useState(false);
  const timer=useRef<number|null>(null);

  useEffect(()=>()=>{if(timer.current!==null)window.clearTimeout(timer.current)},[]);

  const choose=(sample:PreviewResult)=>{
    if(timer.current!==null)window.clearTimeout(timer.current);
    setScanning(true);
    track('public_demo_started',{sample:sample.id,champion:sample.champion,role:sample.role});
    timer.current=window.setTimeout(()=>{
      setSelected(sample);
      setScanning(false);
      track('public_demo_completed',{sample:sample.id,champion:sample.champion,role:sample.role,result:sample.result});
      timer.current=null;
    },420);
  };

  return <section className={styles.trySection} id="try-it">
    <div className={styles.sectionIntro}>
      <div className="eyebrow">TRY IT BEFORE YOU SIGN UP</div>
      <h2>PICK A GAME. WATCH OP CLIMB FIND THE COACHING MOMENT.</h2>
      <p>Choose a sample match and the page will surface the kind of decision OP CLIMB would carry into the next game. These are illustrative product samples, not testimonials or claimed player results.</p>
    </div>
    <div className={styles.tryGrid}>
      <div className={styles.lookupCard}>
        <div className={styles.sampleLabel}>CHOOSE A SAMPLE GAME</div>
        <div className={styles.sampleList}>{SAMPLES.map(sample=><button type="button" key={sample.id} className={sample.id===selected.id?styles.sampleActive:''} onClick={()=>choose(sample)} disabled={scanning}>
          <span><b>{sample.champion}</b><small>{sample.role} · {sample.rank.replace(' SAMPLE','')}</small></span><em>{sample.result}</em>
        </button>)}</div>
        <div className={styles.lookupNote}><b>YOUR OWN GAMES</b><span>Create a free account to connect your Riot profile or Windows Companion and build the full Fix Ladder from your evidence.</span></div>
        <div className={styles.ctaStack}><Link className="btn primary" href="/signup" data-landing-cta="sample-picker">START FREE</Link><small>Free to start · No card required</small></div>
      </div>

      <article className={`${styles.resultCard} ${scanning?styles.scanning:''}`} aria-live="polite" aria-busy={scanning}>
        {scanning?<div className={styles.scanState}><span>READING SAMPLE TIMELINE</span><strong>Finding the highest-value coaching moment…</strong><i/></div>:<>
          <div className={styles.resultHead}><div><span>SAMPLE MATCH</span><strong>{selected.champion} · {selected.role}</strong></div><b className={selected.result==='WIN'?styles.win:styles.loss}>{selected.result}</b></div>
          <div className={styles.statRow}><div><span>KDA</span><b>{selected.kda}</b></div><div><span>CS/MIN</span><b>{selected.csPerMin}</b></div><div><span>RANK</span><b>{selected.rank}</b></div></div>
          <div className={styles.moment}><span>{selected.stamp}</span><h3>{selected.headline}</h3><p>{selected.detail}</p><strong>{selected.rule}</strong><small>{selected.evidence}</small></div>
        </>}
      </article>
    </div>
  </section>;
}

const GLOSSARY=[
  ['KDA','Kills / deaths / assists. Useful context, but not proof that every decision was good or bad.'],
  ['CS/min','Creep score per minute — how consistently you collect minions and other farm over game time.'],
  ['Tempo','Who can move, reset or act first because of wave state, health, gold spent and map timing.'],
  ['Fix Ladder','OP CLIMB’s five-stage progression for one leak: discover it, control it, repeat the fix and prove mastery.'],
  ['Decision Fingerprint','A PRO-level pattern built from repeated decisions across several games, not a judgement from one match.'],
];

export function BeginnerGlossary(){
  const fired=useRef(false);
  return <details className={styles.glossary} onToggle={e=>{
    if((e.currentTarget as HTMLDetailsElement).open&&!fired.current){fired.current=true;track('landing_glossary_opened',{})}
  }}>
    <summary><span>NEW TO LEAGUE OR COACHING METRICS?</span><b>OPEN THE 60-SECOND GLOSSARY +</b></summary>
    <div className={styles.glossaryGrid}>{GLOSSARY.map(([term,definition])=><div key={term}><strong>{term}</strong><p>{definition}</p></div>)}</div>
  </details>;
}

const FAQ=[
  ['What games and ranks does OP CLIMB support?','The main coaching product is for League of Legends. The public try-it uses sample games during beta. The coaching model is designed for every rank from Iron upward; what changes is the standard and the priority, not whether you are “high enough” to use it.'],
  ['Is the Windows Companion safe to use?','The Companion does not inject into League or automate gameplay. It reads Riot client/live-client data, keeps matchup guidance precomputed, and uses the detailed evidence for post-game coaching rather than hidden-information live shotcalling.'],
  ['Do I need to pay or enter a card to start?','No card is required to create an account. FREE is the starting tier; PLUS and PRO are the deeper diagnosis tiers shown on the pricing page.'],
  ['Do I need the Companion installed?','No. You can start with the web app and supported match inputs. The Windows Companion adds richer match capture, champ-select matchup planning and detailed post-game evidence.'],
  ['Will OP CLIMB guarantee I rank up?','No coaching product can honestly guarantee rank. OP CLIMB is built to make one repeated decision visible, give you a specific next-game rule and then measure whether the behaviour changes.'],
];

export function LandingFaq(){
  return <section className={styles.faqSection} id="faq">
    <div className={styles.sectionIntro}><div className="eyebrow">BEFORE YOU START</div><h2>THE QUESTIONS THAT SHOULD BE ANSWERED BEFORE SIGN-UP.</h2></div>
    <div className={styles.faqList}>{FAQ.map(([question,answer])=><details key={question} onToggle={e=>{
      if((e.currentTarget as HTMLDetailsElement).open)track('landing_faq_opened',{question});
    }}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>
    <div className={styles.ctaStack}><Link className="btn primary" href="/signup" data-landing-cta="faq">START FREE</Link><small>Free to start · No card required</small></div>
  </section>;
}

export function ProofWithoutPretending(){
  return <section className={styles.proofSection}>
    <div className={styles.sectionIntro}><div className="eyebrow">FOUNDING BETA · VERIFIED CASE STUDIES</div><h2>PROOF WE CAN DEFEND.</h2><p>OP CLIMB is collecting its first founding-player case studies now. Every published result will show the player quote, starting rank, ending rank, timeframe and games played. Until those exist, the interactive sample above shows the product without dressing a sample up as a success story.</p></div>
    <div className={styles.proofGrid}>
      <article><span>PRODUCT PROOF</span><strong>See the coaching interaction now.</strong><p>Switch between sample games and judge whether the diagnosis is more useful than another static stats panel.</p></article>
      <article><span>CASE-STUDY STANDARD</span><strong>Rank + timeframe + games.</strong><p>Beta results will put the evidence next to the quote instead of hiding behind vague “I improved” copy.</p></article>
      <article><span>NO VANITY COUNTER</span><strong>User counts come when they mean something.</strong><p>Early beta numbers stay off the hero until there is enough usage for the number to increase trust rather than reduce it.</p></article>
    </div>
  </section>;
}
