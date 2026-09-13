'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAccount} from './AccountContext';
import {useSubscription} from './SubscriptionContext';
import {BRAND} from '@/lib/brand';
import {Wordmark} from './UI';
import {SessionBar} from './SessionBar';
import {TrackerDiagnosticMount} from './TrackerDiagnosticMount';
import {LivePregameMount} from './LivePregameMount';
import {LiveFightReviewMount} from './LiveFightReviewMount';
import {LiveCommandCenter} from './LiveCommandCenter';

const groups=[
  {label:'CLIMB',items:[['Dashboard','/dashboard','⌂'],['My Learning Plan','/ilp','◎'],['Missions','/missions','↗'],['Progress','/progress','◫']]},
  {label:'ANALYSE',items:[['Analyse','/analyse','◇'],['Live Companion','/live','●'],['Matchup Lab','/matchup-lab','⚔'],['Bot Duo Lab','/matchup-lab/bot-duo','◆']]},
  {label:'DEVELOP',items:[['My Main','/champions/main','★'],['Coach','/coach','✦'],['Uploads','/uploads','↑']]},
  {label:'ACCOUNT',items:[['Accounts','/account','◉'],['Subscription','/pricing','◇'],['Settings','/settings','⚙']]},
] as const;
const mobile=[['Home','/dashboard'],['ILP','/ilp'],['Analyse','/analyse'],['Coach','/coach'],['Profile','/account']];

const routeTitle=(path:string)=>{
  if(path==='/dashboard')return'DEVELOPMENT HQ';
  if(path==='/ilp')return'PLAYER DEVELOPMENT';
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

export function AppShell({children}:{children:React.ReactNode}){
  const {accounts,active,setActive}=useAccount();
  const {tier}=useSubscription();
  const path=usePathname();
  const live=path==='/live';
  const title=routeTitle(path);
  return <div className={`app-layout op-shell ${live?'is-live':''}`}>
    <aside className="sidebar op-sidebar">
      <div className="op-brand-block">
        <Link href="/dashboard" className="logo-link" aria-label={BRAND.name+' home'}><Wordmark size="sm" priority/></Link>
        <span className={`op-tier op-tier-${tier.toLowerCase()}`}>{tier}</span>
      </div>

      <div className="account-switch op-account-card">
        <div className="op-player-kicker"><span>PLAYER</span><i/></div>
        <select aria-label="Active Riot account" value={active.id} onChange={e=>setActive(e.target.value)}>
          {accounts.map(a=><option key={a.id} value={a.id}>{a.gameName}{a.tagline} · {a.region}</option>)}
        </select>
        <div className="op-account-meta"><strong>{active.rank}</strong><span>{active.role} · {active.region}</span></div>
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
        {active.champions.slice(0,3).map((c,i)=><Link href={'/champions/'+encodeURIComponent(c)} key={c}>
          <span className="champ-index">0{i+1}</span><div><b>{c}</b><small>OPEN DEVELOPMENT FILE</small></div><span className="op-arrow">›</span>
        </Link>)}
        <Link className="all-champs" href="/champions">OPEN CHAMPION LAB ›</Link>
      </div>
      <SessionBar/>
    </aside>

    <main className={`app-main op-main ${live?'op-live-main':''}`}>
      <header className="op-broadcast-hud">
        <div className="op-hud-brand"><span className="op-hud-mark">OP</span><div><small>COMPETITIVE PERFORMANCE SYSTEM</small><strong>{title}</strong></div></div>
        <div className="op-hud-player">
          <div><small>SUMMONER</small><strong>{active.gameName}{active.tagline}</strong></div>
          <div><small>RANK</small><strong>{active.rank}</strong></div>
          <div><small>ROLE</small><strong>{active.role}</strong></div>
          <div><small>ACCESS</small><strong className={tier==='PRO'?'volt':''}>{tier}</strong></div>
          <span className={`op-hud-state ${live?'live':''}`}><i/>{live?'COMPANION':'SYSTEM'} ONLINE</span>
        </div>
      </header>
      <div className="op-energy-rail"><i/><span>OP CLIMB // READ THE GAME. FIX THE LEAK. CLIMB.</span></div>
      <div className="op-screen-frame">
        {live?<><TrackerDiagnosticMount/><LivePregameMount/><LiveCommandCenter/><LiveFightReviewMount/></>:children}
      </div>
    </main>

    <nav className="mobile-nav"><div>{mobile.map(([n,h])=><Link className={path===h?'active':''} key={h} href={h}>{n}</Link>)}</div></nav>
  </div>;
}
