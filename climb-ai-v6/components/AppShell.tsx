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
      <div className="op-screen-frame">{live?<><LivePregameMount/><LiveCommandCenter/><LiveFightReviewMount/></>:gatedLab&&!advancedOpen?<RankLabGate tier={coaching.tier} path={path} onOpen={()=>setAdvancedOpen(true)}/>:children}</div>
    </main>

    <nav className="mobile-nav"><div>{mobile.map(([name,href])=><Link className={isPrimaryActive(path,href)?'active':''} key={href} href={href}>{name}</Link>)}</div></nav>
    <BetaReporter/>
  </div>;
}
