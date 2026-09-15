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

const groups=[
  {label:'CLIMB',items:[['Dashboard','/dashboard','⌂'],['My Active Five','/ilp','◎'],['Missions','/missions','↗'],['Progress','/progress','◫']]},
  {label:'ANALYSE',items:[['Analyse','/analyse','◇'],['Live Companion','/live','●'],['Matchup Lab','/matchup-lab','⚔'],['Bot Duo Lab','/matchup-lab/bot-duo','◆']]},
  {label:'DEVELOP',items:[['My Main','/champions/main','★'],['Coach','/coach','✦'],['Uploads','/uploads','↑']]},
  {label:'ACCOUNT',items:[['Accounts','/account','◉'],['Subscription','/pricing','◇'],['Settings','/settings','⚙']]},
] as const;
const mobile=[['Home','/dashboard'],['Active Five','/ilp'],['Analyse','/analyse'],['TFT','/tft'],['Profile','/account']];

const routeTitle=(path:string)=>{
  if(path==='/dashboard')return'DEVELOPMENT HQ';
  if(path==='/ilp')return'MY ACTIVE FIVE';
  if(path==='/live')return'LIVE COMPANION';
  if(path==='/analyse'||path.startsWith('/analyse/'))return'MATCH REVIEW';
  if(path==='/progress')return'PERFORMANCE';
  if(path==='/coach')return'COACH';
  if(path.startsWith('/matchup-lab'))return'MATCHUP LAB';
  if(path.startsWith('/champions'))return'CHAMPION LAB';
  if(path==='/missions')return'MISSIONS';
  if(path==='/uploads')return'UPLOADS';
  if(path==='/account')return'ACCOUNT';
  if(path==='/pricing')return'SUBSCRIPTION';
  return'OP CLIMB';
};

function RankLabGate({tier,depth,path,onOpen}:{tier:string;depth:number;path:string;onOpen:()=>void}){
  const isChampion=path.startsWith('/champions/main');
  return <section className="glass card" style={{maxWidth:820,margin:'26px auto',padding:'clamp(24px,4vw,46px)'}}>
    <div className="eyebrow">{tier} VIEW · DETAIL {depth}/10</div>
    <h1 style={{fontSize:'clamp(34px,5vw,58px)',lineHeight:.96,margin:'10px 0 14px'}}>{isChampion?'Keep your champion plan useful.':'Keep the matchup useful.'}</h1>
    <p className="muted" style={{fontSize:16,lineHeight:1.65,maxWidth:690}}>{isChampion?'Your normal Champion page already shows the stats, plans and power spikes that matter at your rank. The Main Champion Lab contains raw DPS, item-value tables and deeper modelling, so OP CLIMB keeps that technical layer closed by default.':'Your Coach and Companion already turn matchup evidence into rank-sized instructions. The full Matchup Lab contains combat scripts, derived stats, confidence reports and raw simulation detail, so it stays closed by default at this rank.'}</p>
    <div style={{display:'grid',gap:10,margin:'22px 0'}}>
      <div style={{padding:'14px 16px',border:'1px solid var(--border)'}}><span className="label">DEFAULT FOR {tier}</span><b style={{display:'block',marginTop:5}}>See the decision first. Hide the spreadsheet.</b></div>
      <div style={{padding:'14px 16px',border:'1px solid var(--border)'}}><span className="label">NOT DELETED</span><b style={{display:'block',marginTop:5}}>The full engine still runs underneath and the advanced lab is available whenever you choose.</b></div>
    </div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><Link className="btn primary" href={isChampion?'/champions':'/coach'}>{isChampion?'OPEN MY RANK-SIZED CHAMPION PLAN':'ASK MY COACH'}</Link><button className="btn secondary" onClick={onOpen}>OPEN ADVANCED LAB ANYWAY</button></div>
  </section>;
}

export function AppShell({children}:{children:React.ReactNode}){
  const {accounts,active,setActive}=useAccount();
  const {tier,tftTier}=useSubscription();
  const path=usePathname();
  const live=path==='/live';
  const title=routeTitle(path);
  const coaching=coachingLevelFor(active.rank);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const gatedLab=(path.startsWith('/matchup-lab')||path==='/champions/main')&&coaching.depth<7;
  useEffect(()=>setAdvancedOpen(false),[path]);
  return <div className={`app-layout op-shell ${live?'is-live':''}`}>
    <aside className="sidebar op-sidebar">
      <div className="op-brand-block">
        <Link href="/dashboard" className="logo-link" aria-label={BRAND.name+' home'}><Wordmark size="sm" priority/></Link>
        <span className={`op-tier op-tier-${tier.toLowerCase()}`}>LOL · {tier}</span>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,margin:'10px 0 16px'}}>
        <Link className="btn primary" href="/dashboard" style={{padding:'9px 8px',fontSize:11,textAlign:'center'}}>LEAGUE</Link>
        <Link className="btn secondary" href="/tft" style={{padding:'9px 8px',fontSize:11,textAlign:'center'}}>TFT · {tftTier}</Link>
      </div>

      <div className="account-switch op-account-card">
        <div className="op-player-kicker"><span>PLAYER</span><i/></div>
        <select aria-label="Active Riot account" value={active.id} onChange={e=>setActive(e.target.value)}>
          {accounts.map(a=><option key={a.id} value={a.id}>{a.gameName}{a.tagline} · {a.region}</option>)}
        </select>
        <div className="op-account-meta"><strong>{active.rank}</strong><span>{active.role} · {coaching.tier} VIEW {coaching.depth}/10</span></div>
      </div>

      <nav className="op-nav" aria-label="Main navigation">
        {groups.map(group=><div className="op-nav-group" key={group.label}>
          <div className="op-nav-label"><span>{group.label}</span></div>
          {group.items.map(([n,h,icon])=>{
            const activeLink=path===h||((h==='/champions/main'||h==='/matchup-lab')&&path.startsWith(h+'/'));
            return <Link className={activeLink?'active-nav':''} key={h} href={h}>
              <span className="op-nav-icon">{icon}</span><span>{n}</span>{activeLink&&<i/>}
            </Link>;
          })}
        </div>)}
      </nav>

      <div className="your-champs op-champ-stack">
        <div className="op-nav-label"><span>CHAMPION POOL</span></div>
        {active.champions.slice(0,coaching.depth<=2?1:coaching.depth<=4?2:3).map((c,i)=><Link href={'/champions/'+encodeURIComponent(c)} key={c}>
          <span className="champ-index">0{i+1}</span><div><b>{c}</b><small>{coaching.depth<=2?'OPEN SIMPLE PLAN':'OPEN DEVELOPMENT PLAN'}</small></div><span className="op-arrow">›</span>
        </Link>)}
        <Link className="all-champs" href="/champions">OPEN CHAMPION LAB ›</Link>
      </div>
      <SessionBar/>
    </aside>

    <main className={`app-main op-main ${live?'op-live-main':''}`}>
      <header className="op-broadcast-hud">
        <div className="op-hud-brand"><span className="op-hud-mark">OP</span><div><small>{coaching.tier} COACHING VIEW · {coaching.depth}/10</small><strong>{title}</strong></div></div>
        <div className="op-hud-player">
          <div><small>SUMMONER</small><strong>{active.gameName}{active.tagline}</strong></div>
          <div><small>RANK</small><strong>{active.rank}</strong></div>
          <div><small>ROLE</small><strong>{active.role}</strong></div>
          <div><small>LOL ACCESS</small><strong className={tier==='PRO'?'volt':''}>{tier}</strong></div>
          <span className={`op-hud-state ${live?'live':''}`}><i/>{live?'COMPANION':'SYSTEM'} ONLINE</span>
        </div>
      </header>
      <div className="op-energy-rail"><i/><span>OP CLIMB // YOUR RANK SETS THE DETAIL. THE ENGINE KEEPS THE FULL DATA.</span></div>
      <div className="op-screen-frame">
        {live?<><LivePregameMount/><LiveCommandCenter/><LiveFightReviewMount/></>:gatedLab&&!advancedOpen?<RankLabGate tier={coaching.tier} depth={coaching.depth} path={path} onOpen={()=>setAdvancedOpen(true)}/>:children}
      </div>
    </main>

    <nav className="mobile-nav"><div>{mobile.map(([n,h])=><Link className={path===h?'active':''} key={h} href={h}>{n}</Link>)}</div></nav>
  </div>;
}
