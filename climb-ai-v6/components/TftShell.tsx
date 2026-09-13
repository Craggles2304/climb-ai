'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAccount} from './AccountContext';
import {useSubscription} from './SubscriptionContext';
import {Wordmark} from './UI';

const items=[
  ['TFT HQ','/tft','⌂'],
  ['Game Plan','/tft/game-plan','◎'],
  ['Carry Builder','/tft/carry-builder','♛'],
  ['Board Lab','/tft/board-lab','⬡'],
  ['Board Compare','/tft/board-compare','⇄'],
  ['Decision Lab','/tft/decision-lab','◈'],
  ['Set Lab','/tft/set-lab','★'],
  ['Match History','/tft/matches','◇'],
  ['TFT Coach','/tft/coach','✦'],
  ['TFT Subscription','/tft/pricing','◆'],
] as const;

export function TftShell({children}:{children:React.ReactNode}){
  const path=usePathname();
  const {active}=useAccount();
  const {tftTier}=useSubscription();
  const title=path==='/tft'?'TFT HQ':path.includes('game-plan')?'GAME PLAN':path.includes('carry-builder')?'CARRY BUILDER':path.includes('board-compare')?'BOARD COMPARE':path.includes('board-lab')?'BOARD LAB':path.includes('decision-lab')?'DECISION LAB':path.includes('set-lab')?'SET LAB':path.includes('matches')?'MATCH HISTORY':path.includes('coach')?'TFT COACH':'TFT ACCESS';
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
        <div className="op-account-meta"><strong>{active.region}</strong><span>Shared Riot identity</span></div>
      </div>

      <nav className="op-nav" aria-label="TFT navigation">
        <div className="op-nav-group">
          <div className="op-nav-label"><span>TFT CLIMB</span></div>
          {items.map(([name,href,icon])=>{const isActive=path===href;return <Link className={isActive?'active-nav':''} key={href} href={href}><span className="op-nav-icon">{icon}</span><span>{name}</span>{isActive&&<i/>}</Link>})}
        </div>
        <div className="op-nav-group">
          <div className="op-nav-label"><span>PRODUCT</span></div>
          <Link href="/dashboard"><span className="op-nav-icon">↩</span><span>League of Legends</span></Link>
          <Link href="/account"><span className="op-nav-icon">◉</span><span>Riot Accounts</span></Link>
        </div>
      </nav>

      <div className="glass card" style={{padding:14,marginTop:16}}>
        <div className="eyebrow">RIOT-SAFE COACHING</div>
        <p className="muted" style={{fontSize:11,margin:'8px 0 0'}}>TFT CLIMB focuses on post-game learning, practice scenarios and static prep. It does not adaptively tell you what to buy, roll or position during a live game.</p>
      </div>
    </aside>

    <main className="app-main op-main">
      <header className="op-broadcast-hud">
        <div className="op-hud-brand"><span className="op-hud-mark">TFT</span><div><small>OP CLIMB · TACTICIAN DEVELOPMENT</small><strong>{title}</strong></div></div>
        <div className="op-hud-player">
          <div><small>RIOT ID</small><strong>{active.gameName}{active.tagline}</strong></div>
          <div><small>REGION</small><strong>{active.region}</strong></div>
          <div><small>TFT ACCESS</small><strong className={tftTier==='PRO'?'volt':''}>{tftTier}</strong></div>
          <span className="op-hud-state"><i/>POST-GAME SYSTEM</span>
        </div>
      </header>
      <div className="op-energy-rail"><i/><span>TFT CLIMB // FIND THE CORE. BUILD THE BOARD. COMPARE THE CHANGE. REVIEW THE DECISION.</span></div>
      <div className="op-screen-frame">{children}</div>
    </main>
  </div>;
}
