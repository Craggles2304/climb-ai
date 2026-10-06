'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAccount} from './AccountContext';
import {useSubscription} from './SubscriptionContext';
import {Wordmark} from './UI';

const coreItems=[
  ['TFT HQ','/tft','⌂'],
  ['My TFT DNA','/tft/coach','✦'],
  ['Post-Game Timeline','/tft/timeline','◷'],
  ['Match History','/tft/matches','◇'],
] as const;

const labItems=[
  ['Game Plan','/tft/game-plan','◎'],
  ['Roll Lab','/tft/roll-lab','％'],
  ['Pivot Planner','/tft/transition-planner','↯'],
  ['Board Lab','/tft/board-lab','⬡'],
  ['Item Finder','/tft/item-finder','◫'],
  ['Augment Lab','/tft/augment-lab','✣'],
  ['Carry Builder','/tft/carry-builder','♛'],
  ['Board Compare','/tft/board-compare','⇄'],
  ['Decision Lab','/tft/decision-lab','◈'],
  ['Set Lab','/tft/set-lab','★'],
] as const;

const titleFor=(path:string)=>{
  if(path==='/tft')return'TFT HQ';
  if(path.includes('timeline'))return'POST-GAME TIMELINE';
  if(path.includes('game-plan'))return'GAME PLAN';
  if(path.includes('item-finder'))return'ITEM FINDER';
  if(path.includes('augment-lab'))return'AUGMENT LAB';
  if(path.includes('roll-lab'))return'ROLL LAB';
  if(path.includes('carry-builder'))return'CARRY BUILDER';
  if(path.includes('transition-planner'))return'PIVOT PLANNER';
  if(path.includes('board-compare'))return'BOARD COMPARE';
  if(path.includes('board-lab'))return'BOARD LAB';
  if(path.includes('decision-lab'))return'DECISION LAB';
  if(path.includes('set-lab'))return'SET LAB';
  if(path.includes('matches'))return'MATCH HISTORY';
  if(path.includes('coach'))return'MY TFT DNA';
  return'TFT ACCESS';
};

export function TftShell({children}:{children:React.ReactNode}){
  const path=usePathname();
  const {active}=useAccount();
  const {tftTier}=useSubscription();
  const title=titleFor(path);
  const isLab=['/tft/game-plan','/tft/roll-lab','/tft/transition-planner','/tft/board-lab','/tft/item-finder','/tft/augment-lab','/tft/carry-builder','/tft/board-compare','/tft/decision-lab','/tft/set-lab'].some(route=>path===route);
  const nav=(items:readonly (readonly [string,string,string])[])=>items.map(([name,href,icon])=>{
    const isActive=path===href;
    return <Link className={isActive?'active-nav':''} key={href} href={href}>
      <span className="op-nav-icon">{icon}</span><span>{name}</span>{isActive&&<i/>}
    </Link>;
  });

  return <div className="app-layout op-shell">
    <aside className="sidebar op-sidebar">
      <div className="op-brand-block">
        <Link href="/tft" className="logo-link" aria-label="OP CLIMB TFT home"><Wordmark size="sm" priority/></Link>
        <span className={`op-tier op-tier-${tftTier.toLowerCase()}`}>TFT · {tftTier}</span>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,margin:'10px 0 16px'}}>
        <Link className="btn secondary" href="/dashboard" style={{padding:'9px 8px',fontSize:11,textAlign:'center'}}>LEAGUE</Link>
        <Link className="btn primary" href="/tft" style={{padding:'9px 8px',fontSize:11,textAlign:'center'}}>TFT</Link>
      </div>

      <div className="account-switch op-account-card">
        <div className="op-player-kicker"><span>TACTICIAN</span><i/></div>
        <strong style={{display:'block',fontSize:14}}>{active.gameName}{active.tagline}</strong>
        <div className="op-account-meta"><strong>{active.region}</strong><span>One Riot identity · two climbs</span></div>
      </div>

      <nav className="op-nav" aria-label="TFT navigation">
        <div className="op-nav-group">
          <div className="op-nav-label"><span>YOUR TFT CLIMB</span></div>
          {nav(coreItems)}
        </div>
        <div className="op-nav-group">
          <div className="op-nav-label"><span>COACHING LABS</span></div>
          {nav(labItems)}
        </div>
        <div className="op-nav-group">
          <div className="op-nav-label"><span>ACCOUNT</span></div>
          <Link href="/tft/pricing"><span className="op-nav-icon">◆</span><span>Plan & Access</span></Link>
          <Link href="/dashboard"><span className="op-nav-icon">↩</span><span>League of Legends</span></Link>
          <Link href="/account"><span className="op-nav-icon">◉</span><span>Riot Accounts</span></Link>
        </div>
      </nav>

      <div className="glass card" style={{padding:14,marginTop:16}}>
        <div className="eyebrow">MATCH RECORDER</div>
        <b style={{display:'block',marginTop:5}}>Record quietly. Coach afterwards.</b>
        <p className="muted" style={{fontSize:11,margin:'6px 0 0'}}>Your own TFT evidence builds the timeline and DNA. Live prescriptive coaching stays off.</p>
      </div>
    </aside>

    <main className="app-main op-main">
      <header className="op-broadcast-hud">
        <div className="op-hud-brand"><span className="op-hud-mark">TFT</span><div><small>OP CLIMB · DECISION TWIN</small><strong>{title}</strong></div></div>
        <div className="op-hud-player">
          <div><small>RIOT ID</small><strong>{active.gameName}{active.tagline}</strong></div>
          <div><small>REGION</small><strong>{active.region}</strong></div>
          <div><small>PLAN</small><strong className={tftTier==='PRO'?'volt':''}>{tftTier}</strong></div>
          <span className="op-hud-state"><i/>TFT COACHING ONLINE</span>
        </div>
      </header>
      <div className="op-energy-rail"><i/><span>TFT // RECORD THE DECISION · FIND THE PATTERN · TRAIN THE PRINCIPLE · PROVE THE TRANSFER.</span></div>
      <div className={`op-screen-frame ${isLab?'tft-lab-surface':''}`}>{children}</div>
    </main>
  </div>;
}
