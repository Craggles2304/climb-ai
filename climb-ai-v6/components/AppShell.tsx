'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAccount} from './AccountContext';
import {useSubscription} from './SubscriptionContext';
import {BRAND} from '@/lib/brand';
import {Wordmark} from './UI';
import {SessionBar} from './SessionBar';
import {LivePregameMount} from './LivePregameMount';
import {LiveFightReviewMount} from './LiveFightReviewMount';
import {LiveCommandCenter} from './LiveCommandCenter';
import {coachingLevelFor} from '@/lib/coachingLevel';
import {BetaReporter} from './BetaReporter';

const primary=[
  ['Home','/dashboard','⌂','Your next action'],
  ['My Coach','/coach','✦','Ask + understand'],
  ['My Games','/analyse','◇','Reviews + evidence'],
  ['My Progress','/ilp','◎','Focus + development'],
  ['Companion','/live','●','Connect League'],
] as const;
const mobile=[['Home','/dashboard'],['Coach','/coach'],['Games','/analyse'],['Progress','/ilp']] as const;

type RouteScene={code:string;kicker:string;title:string;copy:string;signals:[string,string,string];tone:string;watermark:string};
const routeScene=(path:string):RouteScene|null=>{
  if(path==='/dashboard')return{code:'HQ // 01',kicker:'PLAYER DEVELOPMENT HQ',title:'NEXT GAME. ONE JOB.',copy:'Your current focus, the evidence behind it and the next rep worth playing — without digging through a stat wall.',signals:['ONE ACTIVE FOCUS','EVIDENCE RUNNING','NEXT REP READY'],tone:'hq',watermark:'CLIMB'};
  if(path==='/coach')return{code:'COACH // 02',kicker:'COACH MEMORY',title:'ASK LESS. REMEMBER MORE.',copy:'Your coach carries the thread across games, so every answer starts from the player you are becoming rather than from zero.',signals:['PLAYER MEMORY','RANK AWARE','DECISION FIRST'],tone:'coach',watermark:'COACH'};
  if(path==='/analyse'||path.startsWith('/analyse/'))return{code:'REVIEW // 03',kicker:'MATCH REVIEW',title:'WATCH THE DECISION. NOT THE KDA.',copy:'Turn the last game into a small number of moments that explain what held, what broke and what deserves the next rep.',signals:['MATCH EVIDENCE','DECISION REVIEW','NEXT FIX'],tone:'review',watermark:'REVIEW'};
  if(path==='/ilp')return{code:'CLIMB // 04',kicker:'PLAYER DEVELOPMENT',title:'BUILD A PLAYER. NOT A STATLINE.',copy:'One active behaviour, four background signals and a development path that only moves when repeated evidence earns it.',signals:['ACTIVE FIVE','MASTERY REPS','ADAPTIVE PATH'],tone:'climb',watermark:'GROW'};
  if(path==='/progress')return{code:'CAREER // 05',kicker:'CAREER PROGRESSION',title:'PROVE THE CHANGE.',copy:'See whether the habits are actually moving across games, situations and patches — not just whether one match looked better.',signals:['TREND','TRANSFER','CAREER MAP'],tone:'climb',watermark:'PROGRESS'};
  if(path==='/session')return{code:'MATCH // 06',kicker:'NEXT GAME',title:'LOCK THE MISSION. PLAY.',copy:'Carry one useful rule into the game, let the Companion record the evidence, then review whether the behaviour held.',signals:['MISSION LOCKED','COMPANION READY','REVIEW AFTER'],tone:'match',watermark:'QUEUE'};
  if(path==='/advanced-statistics')return{code:'LAB // 07',kicker:'ADVANCED DATA ROOM',title:'OPEN THE DATA. KEEP THE DECISION.',copy:'The deeper numbers are here when you need them — without letting analytics replace the actual coaching question.',signals:['DEEP METRICS','CONTEXT FIRST','OPTIONAL LAYER'],tone:'lab',watermark:'DATA'};
  if(path==='/matchups'||path.startsWith('/matchup-lab')||path.startsWith('/champions')||path==='/missions')return{code:'LAB // 08',kicker:'MATCH INTELLIGENCE LAB',title:'DRAFT. TEST. UNDERSTAND.',copy:'Explore matchup shapes, champion plans and decision models without turning the product into a spreadsheet.',signals:['MATCHUP MODEL','DRAFT READ','SCENARIO TEST'],tone:'lab',watermark:'LAB'};
  if(path==='/billing'||path==='/pricing')return{code:'PLANS // 09',kicker:'COACHING DEPTH',title:'PAY FOR DEPTH. NOT NOISE.',copy:'Free proves the value. Plus explains the game. Pro builds the long-term player model and learning system.',signals:['FREE · FIND','PLUS · EXPLAIN','PRO · DEVELOP'],tone:'plans',watermark:'PRO'};
  if(path==='/account'||path==='/settings'||path==='/uploads')return{code:'SYSTEM // 10',kicker:'PLAYER SYSTEM',title:'KEEP THE SETUP CLEAN.',copy:'Riot identity, tracking, uploads and account controls live here so the coaching surfaces stay focused on playing better.',signals:['RIOT LINK','TRACKING','ACCOUNT'],tone:'system',watermark:'SYSTEM'};
  return null;
};
const routeTitle=(path:string)=>{
  if(path==='/dashboard')return'YOUR CLIMB';
  if(path==='/session')return'NEXT GAME';
  if(path==='/coach')return'MY COACH';
  if(path==='/live')return'COMPANION';
  if(path==='/analyse'||path.startsWith('/analyse/'))return'MY GAMES';
  if(path==='/ilp')return'MY PROGRESS';
  if(path==='/advanced-statistics')return'ADVANCED';
  if(path==='/progress')return'ADVANCED PROGRESS';
  if(path==='/matchups')return'MATCHUP ASSISTANT';
  if(path.startsWith('/matchup-lab'))return'ADVANCED MATCHUP';
  if(path.startsWith('/champions'))return'CHAMPIONS';
  if(path==='/missions')return'MISSION LAB';
  if(path==='/uploads')return'ADD A GAME';
  if(path==='/account')return'ACCOUNT';
  if(path==='/billing')return'SUBSCRIPTION';
  if(path==='/pricing')return'SUBSCRIPTION';
  if(path==='/settings')return'SETTINGS';
  return'OP CLIMB';
};
function isPrimaryActive(path:string,href:string){
  if(href==='/analyse')return path==='/analyse'||path.startsWith('/analyse/');
  return path===href;
}
function RankLabGate({tier,path,onOpen}:{tier:string;path:string;onOpen:()=>void}){
  const isChampion=path.startsWith('/champions/main');
  return <section className="glass card" style={{maxWidth:820,margin:'26px auto',padding:'clamp(24px,4vw,46px)'}}>
    <div className="eyebrow">ADVANCED TOOLS</div>
    <h1 style={{fontSize:'clamp(34px,5vw,58px)',lineHeight:.96,margin:'10px 0 14px'}}>{isChampion?'Your normal champion plan is enough for most games.':'You probably do not need the spreadsheet.'}</h1>
    <p className="muted" style={{fontSize:16,lineHeight:1.65,maxWidth:690}}>{isChampion?'Your '+tier+' plan already gives you the champion advice worth carrying into game. This page is the deeper numbers layer if you genuinely want it.':'Your '+tier+' Coach already turns the matchup into decisions you can use. This page is the deeper modelling layer if you genuinely want it.'}</p>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:22}}><Link className="btn primary" href={isChampion?'/champions':'/coach'}>{isChampion?'BACK TO MY CHAMPION PLAN':'ASK MY COACH'}</Link><button className="btn secondary" onClick={onOpen}>OPEN ADVANCED VIEW</button></div>
  </section>;
}
function SidebarTierStep({tier}:{tier:'FREE'|'PLUS'|'PRO'}){
  if(tier==='FREE')return <div className="op-sidebar-upgrade"><span>NEXT · PLUS</span><strong>Unlock the full game plan.</strong><Link href="/pricing">SEE WHAT CHANGES →</Link></div>;
  if(tier==='PLUS')return <div className="op-sidebar-upgrade"><span>NEXT · PRO</span><strong>Turn reviews into a coach that remembers you.</strong><Link href="/pricing">SEE WHAT CHANGES →</Link></div>;
  return <div className="op-sidebar-upgrade"><span>PRO ACTIVE</span><strong>Full player-model coaching is unlocked.</strong><Link href="/ilp">OPEN MY DEVELOPMENT →</Link></div>;
}

export function AppShell({children}:{children:React.ReactNode}){
  const {accounts,active,setActive}=useAccount();
  const {tier}=useSubscription();
  const path=usePathname();
  const live=path==='/live';
  const title=routeTitle(path);
  const coaching=coachingLevelFor(active.rank);
  const scene=routeScene(path);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const gatedLab=(path.startsWith('/matchup-lab')||path==='/champions/main')&&coaching.depth<7;
  const advancedRoute=path==='/advanced-statistics'||path==='/progress'||path==='/matchups'||path.startsWith('/matchup-lab')||path.startsWith('/champions')||path==='/missions'||path==='/uploads';
  useEffect(()=>setAdvancedOpen(false),[path]);

  return <div className={'app-layout op-shell '+(live?'is-live':'')}>
    <aside className="sidebar op-sidebar">
      <div className="op-brand-block"><Link href="/dashboard" className="logo-link" aria-label={BRAND.name+' home'}><Wordmark size="sm" priority/></Link><span className={'op-tier op-tier-'+tier.toLowerCase()}>LEAGUE · {tier}</span></div>
      <div className="account-switch op-account-card">
        <div className="op-player-kicker"><span>YOU</span><i/></div>
        <select aria-label="Active Riot account" value={active.id} onChange={e=>setActive(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.gameName}{a.tagline} · {a.region}</option>)}</select>
        <div className="op-account-meta"><strong>{active.rank}</strong><span>{active.role} · {coaching.tier} COACH</span></div>
      </div>

      <nav className="op-nav" aria-label="Main navigation">
        <div className="op-nav-group">
          <div className="op-nav-label"><span>YOUR CLIMB</span></div>
          {primary.map(([name,href,icon,hint])=>{
            const activeLink=isPrimaryActive(path,href);
            return <Link className={activeLink?'active-nav':''} key={href} href={href}><span className="op-nav-icon">{icon}</span><span>{name}<small className="op-nav-hint">{hint}</small></span>{activeLink&&<i/>}</Link>;
          })}
        </div>
        <div className="op-nav-group">
          <div className="op-nav-label"><span>OPTIONAL</span></div>
          <Link className={advancedRoute?'active-nav':''} href="/advanced-statistics"><span className="op-nav-icon">▦</span><span>Advanced<small className="op-nav-hint">Extra numbers + tools</small></span>{advancedRoute&&<i/>}</Link>
        </div>
      </nav>

      <SidebarTierStep tier={tier}/>

      <div className="op-nav-group" style={{marginTop:'auto'}}>
        <div className="op-nav-label"><span>ACCOUNT</span></div>
        <Link href="/account"><span className="op-nav-icon">◉</span><span>Account</span></Link>
        <Link href="/billing"><span className="op-nav-icon">◆</span><span>Subscription · {tier}</span></Link>
        <Link href="/settings"><span className="op-nav-icon">⚙</span><span>Settings</span></Link>
      </div>
      <SessionBar/>
    </aside>

    <main className={'app-main op-main '+(live?'op-live-main':'')}>
      <header className="op-broadcast-hud">
        <div className="op-hud-brand"><div className="op-hud-crumb"><span>Player workspace</span><i>/</i><strong>{title}</strong></div></div>
        <div className="op-hud-player"><div><small>PLAYER</small><strong>{active.gameName}{active.tagline}</strong></div><div><small>RANK</small><strong>{active.rank}</strong></div><div><small>ROLE</small><strong>{active.role}</strong></div><span className={'op-hud-state '+(live?'live':'')}><i/>{live?'MATCH MODE':'READY'}</span></div>
      </header>
      <div className="op-energy-rail"><i/><span>ONE FOCUS. ONE GAME AT A TIME.</span></div>
      {!live&&scene&&<section className="op-route-scene" data-scene={scene.tone}>
        <div className="op-route-scene-copy">
          <div className="op-scene-kicker"><span>{scene.code}</span><i/>{scene.kicker}</div>
          <div className="op-scene-title">{scene.title}</div>
          <p>{scene.copy}</p>
          <div className="op-scene-signals">{scene.signals.map((signal,index)=><span key={signal}><b>{String(index+1).padStart(2,'0')}</b>{signal}</span>)}</div>
        </div>
        <div className="op-scene-visual" aria-hidden="true">
          <span className="op-scene-watermark">{scene.watermark}</span>
          <div className="op-scene-radar"><i/><i/><i/><b>OP</b></div>
          <div className="op-scene-bars"><i/><i/><i/><i/><i/><i/></div>
          <div className="op-scene-scanline"/>
        </div>
      </section>}
      <div className="op-screen-frame">{live?<><LivePregameMount/><LiveCommandCenter/><LiveFightReviewMount/></>:gatedLab&&!advancedOpen?<RankLabGate tier={coaching.tier} path={path} onOpen={()=>setAdvancedOpen(true)}/>:children}</div>
    </main>

    <nav className="mobile-nav"><div>{mobile.map(([name,href])=><Link className={isPrimaryActive(path,href)?'active':''} key={href} href={href}>{name}</Link>)}</div></nav>
    <BetaReporter/>
  </div>;
}
