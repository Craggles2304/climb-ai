'use client';

import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {matchesFor,useAccount} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {gameDnaStrands,gameMissionFocusPair} from '@/lib/gameDnaSnapshot';
import {DNA_DOMAINS,DNA_DOMAIN_COLORS,DNA_DOMAIN_GUIDE,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import {taskAppliesToRole} from '@/lib/roleAwareLearning';
import {missionSummary} from '@/lib/missionLoop';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {championSplash} from '@/lib/championArt';
import type {DnaDomain} from '@/lib/types';

const routes=[
  {label:'Command centre',href:'/dashboard',icon:'⌂',section:'OVERVIEW'},
  {label:'My Game DNA',href:'/ilp',icon:'⬡',section:'DEVELOPMENT'},
  {label:'Climb Plan',href:'/progress',icon:'↗',section:'DEVELOPMENT'},
  {label:'Missions',href:'/missions',icon:'✧',section:'DEVELOPMENT'},
  {label:'Match Room',href:'/live',icon:'◈',section:'INTELLIGENCE'},
  {label:'Match History',href:'/analyse',icon:'▤',section:'INTELLIGENCE'},
  {label:'My Coach',href:'/coach',icon:'◎',section:'INTELLIGENCE'},
] as const;

const nodePos=[
  {x:19,y:24},{x:50,y:12},{x:81,y:24},
  {x:19,y:76},{x:50,y:88},{x:81,y:76},
];
const branches=[
  'M168 154 355 266','M440 77 440 203','M713 154 525 266',
  'M168 486 355 374','M440 563 440 437','M713 486 525 374',
] as const;
const safeDate=(v:string)=>{const d=new Date(v);return Number.isFinite(d.valueOf())?d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}):'—'};
const safeValue=(v:number)=>Number.isFinite(v)?v.toFixed(1):'—';
const heroVisual=(name:string)=>name?championSplash(name):'/assets/jinx-splash.jpg';
const token=(domain:DnaDomain)=>({'--arena-gene-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties);
const age=(seconds:number)=>Math.max(0,Math.floor(seconds/60))+'m';

export function ArenaCommandDashboard(){
  const {active,accounts,setActive,authenticated,hydrated}=useAccount();
  const {tier}=useSubscription();
  const {tasks,allTasks}=useLearningPlan();
  const [selected,setSelected]=useState<DnaDomain>('LANING');
  const [dnaView,setDnaView]=useState<'MATRIX'|'DETAILS'>('MATRIX');
  const [navOpen,setNavOpen]=useState(false);
  const [deviceState,setDeviceState]=useState<'CHECKING'|'ONLINE'|'PAIRED'|'OFFLINE'>('CHECKING');
  const [latestFetched,setLatestFetched]=useState(0);

  useEffect(()=>{
    let stop=false;
    const poll=async()=>{
      try{
        const response=await fetch('/api/live/pair',{cache:'no-store'});
        if(!response.ok){if(!stop)setDeviceState('OFFLINE');return;}
        const data=await response.json();
        if(stop)return;
        const devices=(Array.isArray(data.devices)?data.devices:[]).filter((v:{account_key?:string})=>v.account_key===active.id);
        const online=devices.some((v:{last_seen_at?:string|null})=>v.last_seen_at&&Date.now()-Date.parse(v.last_seen_at)<90_000);
        setDeviceState(online?'ONLINE':devices.length?'PAIRED':'OFFLINE');
      }catch{if(!stop)setDeviceState('OFFLINE');}
    };
    setDeviceState('CHECKING');
    void poll();
    const timer=window.setInterval(()=>void poll(),30_000);
    return()=>{stop=true;window.clearInterval(timer)};
  },[active.id]);

  useEffect(()=>{
    const onRefresh=()=>setLatestFetched(v=>v+1);
    window.addEventListener('focus',onRefresh);
    return()=>window.removeEventListener('focus',onRefresh);
  },[]);

  const games=matchesFor(active.id).filter(m=>m.durationSeconds>=300).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  const recent=games.slice(0,10);
  const roleCount=dnaBaselineGameCount(games,active.role);
  const ready=dnaBaselineReady(roleCount);
  const relevant=useMemo(()=>(allTasks[active.id]??tasks).filter(t=>taskAppliesToRole(t,active.role)),[allTasks,tasks,active.id,active.role]);
  const strands=useMemo(()=>gameDnaStrands(relevant,active.role,ready),[relevant,active.role,ready]);
  const focus=ready?gameMissionFocusPair(relevant,active.role).map(x=>x.task):[];
  const main=focus[0]??null;
  const secondary=focus[1]??null;
  const mainPlain=main?plainLanguageFocus(main):null;
  const proof=main?missionSummary(main):null;
  const details=DNA_DOMAIN_GUIDE[selected];
  const chosen=strands.find(v=>v.domain===selected);
  const chosenTask=relevant.find(t=>t.dnaDomain===selected&&t.status!=='MASTERED'&&t.status!=='PAUSED');
  const chosenProof=chosenTask?missionSummary(chosenTask):null;
  const winRate=recent.length?Math.round(recent.filter(g=>g.result==='WIN').length/recent.length*100):null;
  const cs=recent.filter(g=>g.metrics.csPerMin>0&&Number.isFinite(g.metrics.csPerMin));
  const csAvg=cs.length?safeValue(cs.reduce((s,g)=>s+g.metrics.csPerMin,0)/cs.length):null;
  const kills=recent.reduce((s,g)=>s+g.kills,0),assists=recent.reduce((s,g)=>s+g.assists,0),deaths=recent.reduce((s,g)=>s+g.deaths,0);
  const kda=recent.length?(deaths===0?'Perfect':((kills+assists)/deaths).toFixed(2)):null;
  const reps=ready?relevant.reduce((s,t)=>s+missionSummary(t).confirmed,0):null;
  const featured=games[0]?.champion&&games[0].champion!=='Unknown'?games[0].champion:active.champions?.[0]||'Jinx';
  const status=deviceState==='ONLINE'?'COMPANION CONNECTED':deviceState==='PAIRED'?'DEVICE PAIRED':deviceState==='CHECKING'?'CHECKING CONNECTION':'COMPANION OFFLINE';
  const firstMatch=games[0];
  // Holds a stable, semantic loading screen until provider hydration completes.
  if(!hydrated)return <div className="op-arena-22 is-loading"><div className="op-a22-loader"><span>O<span>P</span></span><b>LOADING COMMAND CENTRE</b><small>Establishing your player identity…</small></div></div>;
  void latestFetched;
  return <div className="op-arena-22">
    <a className="op-a22-skip" href="#arena-main">SKIP TO PLAYER HQ</a>
    <div className="op-a22-layout">
      <aside className={'op-a22-rail '+(navOpen?'is-open':'')} aria-label="OP CLIMB application navigation">
        <Link href="/dashboard" className="op-a22-brand" onClick={()=>setNavOpen(false)}>
          <span className="op-a22-brandmark">O<span>P</span><i>↗</i></span>
          <span><b>OP CLIMB</b><small>YOUR EVOLUTION STARTS HERE</small></span>
        </Link>
        <div className="op-a22-game-selector"><span className="op-a22-game-icon">L</span><div><b>LEAGUE OF LEGENDS</b><small>PLAYER COMMAND CENTRE</small></div><span>▾</span></div>
        <div className="op-a22-navigation">{routes.map((route,index)=><div key={route.href}>
          {(index===0||routes[index-1].section!==route.section)&&<span className="op-a22-nav-caption">{route.section}</span>}
          <Link href={route.href} className={'op-a22-nav-item '+(index===0?'is-current':'')} aria-current={index===0?'page':undefined} onClick={()=>setNavOpen(false)}>
            <span aria-hidden="true">{route.icon}</span><b>{route.label}</b>{index===0&&<i/>}
          </Link>
        </div>)}</div>
        <div className="op-a22-rail-lower">
          <Link className="op-a22-tft-link" href="/tft"><span>◇</span> TEAMFIGHT TACTICS <i>↗</i></Link>
          <div className="op-a22-tier-card"><span>YOUR COACHING LICENSE</span><b>{tier}<i> ACTIVE</i></b><Link href="/pricing">VIEW PLAN BENEFITS ↗</Link></div>
          <Link href="/account" className="op-a22-rail-profile">
            <span>{active.gameName.slice(0,1).toUpperCase()}</span><div><b>{active.gameName||'Player'}</b><small>{active.rank} · {active.role}</small></div><i>⚙</i>
          </Link>
        </div>
      </aside>

      <div className="op-a22-workspace">
        <header className="op-a22-header">
          <div className="op-a22-header-left"><button type="button" className="op-a22-burger" aria-label={navOpen?'Close navigation':'Open navigation'} aria-expanded={navOpen} onClick={()=>setNavOpen(v=>!v)}>☰</button><span className="op-a22-header-location">THE ARENA</span><span className="op-a22-header-slash">/</span><b>COMMAND CENTRE</b></div>
          <div className="op-a22-header-actions">
            <span className={'op-a22-device-status '+(deviceState==='ONLINE'?'is-on':'')}><i/>{status}</span>
            {accounts.length>1&&<select className="op-a22-account-picker" aria-label="Switch Riot account" value={active.id} onChange={e=>setActive(e.target.value)}>{accounts.map(account=><option key={account.id} value={account.id}>{account.gameName}{account.tagline}</option>)}</select>}<span className="op-a22-header-tier">{tier}</span>
            <Link href="/settings" className="op-a22-header-settings" aria-label="Settings">⚙</Link>
          </div>
        </header>

        <main id="arena-main" className="op-a22-main">
          {!authenticated&&<div className="op-a22-demo-notice" role="status">◈ <strong>VISUAL DEMO</strong> — Example player data is shown until you sign in. Rankings and mission evidence are not yours. <Link href="/login">SIGN IN ↗</Link></div>}
          <div className="op-a22-crumb"><span className="op-a22-dot"/> PLAYER DEVELOPMENT HQ <i>/</i> SEASON 2026 <span className="op-a22-live-tag">● ACTIVE WORKSPACE</span></div>

          <section className="op-a22-identity" aria-label="Player identity">
            <img className="op-a22-identity-splash" src={heroVisual(featured)} alt="" aria-hidden="true" onError={e=>{e.currentTarget.src='/assets/jinx-splash.jpg'}}/>
            <div className="op-a22-identity-vignette"/>
            <div className="op-a22-identity-content">
              <div className="op-a22-identity-pre"><i/>SUMMONER PROFILE <span>EUW / {active.role.toUpperCase()}</span></div>
              <h1>{active.gameName}<small>{active.tagline}</small></h1>
              <div className="op-a22-identity-rank"><span className="op-a22-rank-crest" aria-hidden="true"><svg viewBox="0 0 100 108"><path d="M50 4 89 23 91 62 50 104 9 62 11 23Z" fill="#182434" stroke="#d9bb88" strokeWidth="3"/><path d="M50 18 75 33 74 63 50 89 26 63 25 33Z" fill="#243c56" stroke="#60cddb" strokeWidth="2"/><path d="M50 22 69 54 50 83 31 54Z" fill="#5cd1e3" stroke="#c9faff" strokeWidth="2"/><path d="M50 22 50 83 69 54Z" fill="#29699a"/></svg></span><div><span>RANKED SOLO / DUO</span><strong>{active.rank}</strong></div><span className="op-a22-rank-divider"/><div><span>YOUR ROLE</span><strong>{active.role}</strong></div></div>
              <p>{ready?(mainPlain?.nextGame||'Your personal coaching plan is ready. Find the next decision worth improving.'):'Every climb starts with evidence. Play three tracked role games to reveal your real Game DNA.'}</p>
              <div className="op-a22-identity-actions"><Link href="/live" className="op-a22-primary-action">ENTER MATCH ROOM <span>↗</span></Link><Link href="/ilp" className="op-a22-outline-action">VIEW MY GAME DNA</Link></div>
            </div>
            <div className="op-a22-identity-bottom"><span>FEATURED CHAMPION <b>{featured.toUpperCase()}</b></span><span>{Math.min(roleCount,DNA_BASELINE_GAMES)} / {DNA_BASELINE_GAMES} BASELINE GAMES</span></div>
          </section>

          <section className="op-a22-metrics" aria-label="Performance overview">
            <div className="op-a22-metric"><span className="op-a22-stat-id">01 / PERFORMANCE</span><div><strong>{winRate===null?'—':winRate+'%'}</strong><span className="op-a22-metric-shape">◢</span></div><b>RECENT WIN RATE</b><small>{recent.length?recent.length+' VERIFIED MATCH RECORDS':'NO MATCHES RECORDED'}</small></div>
            <div className="op-a22-metric"><span className="op-a22-stat-id">02 / COMBAT</span><div><strong>{kda??'—'}</strong><span className="op-a22-metric-shape">✕</span></div><b>COMBINED KDA</b><small>{recent.length?'LAST '+recent.length+' MATCHES':'AWAITING MATCH EVIDENCE'}</small></div>
            <div className="op-a22-metric"><span className="op-a22-stat-id">03 / ECONOMY</span><div><strong>{csAvg??'—'}</strong><span className="op-a22-metric-shape">▤</span></div><b>AVERAGE CS / MIN</b><small>{cs.length?cs.length+' GAMES WITH CS DATA':'NO CS EVIDENCE AVAILABLE'}</small></div>
            <div className="op-a22-metric is-evidence"><span className="op-a22-stat-id">04 / DEVELOPMENT</span><div><strong>{reps===null?'—':reps}</strong><span className="op-a22-metric-shape">⬡</span></div><b>PROVEN MISSION REPS</b><small>{ready?'EVIDENCE-BASED PROGRESS':'UNLOCK AFTER 3 ROLE GAMES'}</small></div>
          </section>

          <div className="op-a22-upper-grid">
            <section className="op-a22-dna op-a22-section" aria-labelledby="op-a22-dna-heading">
              <header className="op-a22-section-head"><div><span className="op-a22-section-kicker">PLAYER EVOLUTION / 01</span><h2 id="op-a22-dna-heading">YOUR <em>GAME DNA</em></h2><p>Six development strands. One player. Progress earned in-game.</p></div><div className="op-a22-segment"><button type="button" className={dnaView==='MATRIX'?'is-selected':''} aria-pressed={dnaView==='MATRIX'} onClick={()=>setDnaView('MATRIX')}>MATRIX</button><button type="button" className={dnaView==='DETAILS'?'is-selected':''} aria-pressed={dnaView==='DETAILS'} onClick={()=>setDnaView('DETAILS')}>DETAILS</button></div></header>
              {dnaView==='MATRIX'?<div className="op-a22-dna-map">
                <div className="op-a22-map-noise"/>
                <svg className="op-a22-paths" viewBox="0 0 880 640" preserveAspectRatio="none" aria-hidden="true">
                  <defs><linearGradient id="a22-path"><stop stopColor="#88dccb" stopOpacity=".55"/><stop offset="1" stopColor="#9167d0" stopOpacity=".45"/></linearGradient></defs>
                  {branches.map((path,index)=><g key={path}><path d={path} stroke="url(#a22-path)" strokeWidth="2" strokeDasharray={ready?'':'4 8'} fill="none" opacity={ready?'.73':'.3'}/><circle cx={[250,440,635,250,440,635][index]} cy={[215,155,215,425,492,425][index]} r="4" fill={DNA_DOMAIN_COLORS[DNA_DOMAINS[index]]} opacity={ready?'.85':'.28'}/></g>)}
                  <circle cx="440" cy="320" r="100" stroke="#598da5" strokeWidth="1" opacity=".22" fill="none"/>
                  <circle cx="440" cy="275" r="118" stroke="#598da5" strokeDasharray="5 10" strokeWidth="1" opacity=".16" fill="none"/>
                  <path d="M440 208 530 264 530 376 440 432 350 376 350 264Z" fill="#091925" stroke="#447c85" strokeWidth="2" opacity=".65"/>
                </svg>
                <div className="op-a22-central-seal"><div><span>O<span>P</span></span><strong>GAME DNA</strong><small>{ready?'EVIDENCE ACTIVE':'BASELINE LOCKED'}</small></div></div>
                {strands.map((strand,index)=>{
                  const isCurrent=selected===strand.domain;
                  return <button type="button" key={strand.domain} className={'op-a22-dna-node '+(isCurrent?'is-active ':'')+(ready?'is-unlocked':'is-locked')} style={{...token(strand.domain),left:nodePos[index].x+'%',top:nodePos[index].y+'%'}} onClick={()=>setSelected(strand.domain)} aria-label={'Inspect '+strand.label+' Game DNA'} aria-pressed={isCurrent}>
                    <span className="op-a22-dna-ring" style={{'--progress':ready?strand.progress+'%':'0%'} as CSSProperties}><i>{['✦','▤','◉','◆','✕','∞'][index]}</i></span>
                    <span className="op-a22-dna-label"><b>{strand.label}</b><small>{ready?(strand.activeCount?'LEVEL '+strand.level+' · '+strand.mastered+' MASTERED':'AWAITING EVIDENCE'):'AWAITING BASELINE'}</small></span>
                  </button>
                })}
                <span className="op-a22-dna-map-corner north">EVOLUTION MATRIX / REAL EVIDENCE</span><span className="op-a22-dna-map-corner south">6 STRANDS · 2 FOCUSED MISSIONS</span>
              </div>:<div className="op-a22-detail-list">{strands.map((strand,i)=><button key={strand.domain} type="button" className={'op-a22-detail-row '+(selected===strand.domain?'is-picked':'')} style={token(strand.domain)} onClick={()=>setSelected(strand.domain)} aria-pressed={selected===strand.domain}><span>0{i+1}</span><b>{strand.label}</b><i/><small>{!ready?'BASELINE NOT COMPLETE':strand.activeCount?'ACTIVE · LV '+strand.level:'AWAITING EVIDENCE'}</small><strong>↗</strong></button>)}</div>}
              <div className="op-a22-inspect" style={token(selected)}><div className="op-a22-inspect-index">◆ <span>STRAND INSPECTOR</span><b>{chosen?.label.toUpperCase()}</b></div><div className="op-a22-inspect-main"><p>{ready&&chosenTask?(plainLanguageFocus(chosenTask).nextGame||chosenTask.gameRule):details.summary}</p><span>{ready&&chosenProof&&chosenTask?chosenProof.confirmed+' / '+chosenProof.required+' VERIFIED REPS':ready?'NO VERIFIED REPS YET':'BASELINE '+Math.min(roleCount,DNA_BASELINE_GAMES)+' / '+DNA_BASELINE_GAMES}</span><Link href="/ilp">OPEN DNA ROOM ↗</Link></div></div>
            </section>

            <div className="op-a22-side-stack">
              <section className="op-a22-task op-a22-section" aria-labelledby="op-a22-task-heading"><header className="op-a22-section-head"><div><span className="op-a22-section-kicker">COACHING PROTOCOL / 02</span><h2 id="op-a22-task-heading">NEXT <em>MISSION</em></h2></div><span className="op-a22-task-insignia">✦</span></header>
                <div className="op-a22-task-inner"><div className="op-a22-active-row"><i/> {ready&&main?'ACTIVE MISSION':'COACHING DISCOVERY'} <span>{ready&&main?'01 / 02':'BASELINE'}</span></div>
                  {ready&&main?<><span className="op-a22-task-gene" style={token(main.dnaDomain)}>{DNA_DOMAIN_LABELS[main.dnaDomain].toUpperCase()}</span><h3>{mainPlain?.name||main.title}</h3><p>{mainPlain?.meaning||main.why}</p><div className="op-a22-instruction"><span>YOUR NEXT-GAME ORDER</span><b>{mainPlain?.nextGame||main.gameRule}</b></div><div className="op-a22-progress-meta"><span>PROOF OF IMPROVEMENT</span><b>{Math.min(proof?.confirmed??0,proof?.required??3)}/{proof?.required??3} BANKED</b></div><div className="op-a22-progress-track"><span style={{width:(Math.min(proof?.confirmed??0,proof?.required??3)/(proof?.required??3)*100)+'%'}}/></div>{secondary&&<div className="op-a22-task-secondary">SECOND FOCUS <b>{plainLanguageFocus(secondary).name||secondary.title}</b></div>}</>:<><div className="op-a22-empty-sigil">◇</div><h3>{ready?'YOUR MISSIONS ARE BEING PREPARED':'YOUR PROFILE IS TAKING SHAPE'}</h3><p>{ready?'Open your Game DNA room to inspect which role-specific missions are available.':'Complete '+Math.max(0,DNA_BASELINE_GAMES-roleCount)+' more tracked '+active.role+' games to unlock evidence-led coaching.'}</p><div className="op-a22-instruction"><span>YOUR NEXT-GAME ORDER</span><b>Play a normal '+active.role+' game. Let OP CLIMB observe your habits.</b></div></>}
                </div><Link href={ready?'/missions':'/live'} className="op-a22-task-cta">{ready?'OPEN MISSION BOARD':'START TRACKING GAMES'} <span>↗</span></Link>
              </section>
              <section className="op-a22-memory op-a22-section" aria-labelledby="op-a22-memory-heading"><header className="op-a22-section-head"><div><span className="op-a22-section-kicker">DECISION INTELLIGENCE / 03</span><h2 id="op-a22-memory-heading">COACH <em>MEMORY</em></h2></div><span className="op-a22-pro-tag">PRO</span></header><div className="op-a22-memory-core" aria-hidden="true"><span className="op-a22-memory-orbit"/><span className="op-a22-memory-heart">◎</span><span>DECISION</span><i/></div><p>{tier==='PRO'?'Your coach analyses recurring habits and whether learning transfers between games. Only observed decisions count.':'A coach that learns your habits, tracks repeated decisions and tests whether improvement transfers.'}</p><Link href={tier==='PRO'?'/coach':'/pricing'}>{tier==='PRO'?'EXPLORE YOUR LEARNING MEMORY':'UNLOCK PRO COACH'} ↗</Link></section>
            </div>
          </div>

          <section className="op-a22-history op-a22-section" aria-labelledby="op-a22-history-heading"><header className="op-a22-section-head"><div><span className="op-a22-section-kicker">AFTER-ACTION REPORT / 04</span><h2 id="op-a22-history-heading">RECENT <em>OPERATIONS</em></h2><p>Recorded matches. Clear outcomes. Evidence you can act on.</p></div><Link className="op-a22-link-subtle" href="/analyse">VIEW ALL MATCHES ↗</Link></header>
            <div className="op-a22-match-titles"><span>CHAMPION / RESULT</span><span>K/D/A</span><span>CS/MIN</span><span>DURATION</span><span>DATE</span><span>REVIEW</span></div>
            {games.length?<div className="op-a22-games">{games.slice(0,5).map(game=><Link key={game.id} href={'/analyse/'+encodeURIComponent(String(game.id))} className={'op-a22-match '+(game.result==='WIN'?'is-victory':'is-defeat')}>
              <span className="op-a22-champ"><span className="op-a22-champ-art"><img alt="" loading="lazy" src={heroVisual(game.champion)} onError={e=>{e.currentTarget.hidden=true}}/></span><span><b>{game.champion}</b><small>{game.result==='WIN'?'VICTORY':'DEFEAT'} <i>·</i> {game.role}</small></span></span>
              <span className="op-a22-match-stat">{game.kills}<i>/</i>{game.deaths}<i>/</i>{game.assists}</span>
              <span className="op-a22-match-stat">{game.metrics.csPerMin>0?safeValue(game.metrics.csPerMin):'—'}</span>
              <span className="op-a22-match-stat">{age(game.durationSeconds)}</span>
              <span className="op-a22-match-stat">{safeDate(game.createdAt)}</span>
              <span className="op-a22-match-link">↗</span>
            </Link>)}</div>:<div className="op-a22-empty-history"><span>◇</span><b>YOUR HISTORY HASN'T STARTED YET.</b><p>Record your first League game with the Companion to begin the evidence trail.</p><Link href="/live">GO TO MATCH ROOM ↗</Link></div>}
          </section>

          <footer className="op-a22-last-cta"><div><span>THE NEXT ASCENT</span><b>{ready?(mainPlain?.name||'YOUR COACH IS READY'):'BUILD YOUR BASELINE'}</b><small>{firstMatch?'LAST GAME: '+firstMatch.champion.toUpperCase()+' · '+safeDate(firstMatch.createdAt).toUpperCase():'ONE GAME AT A TIME. EVERY GAME MAKES YOUR COACH SMARTER.'}</small></div><Link href={ready?'/progress':'/live'}>{ready?'VIEW CLIMB PLAN':'PLAY YOUR FIRST GAMES'} ↗</Link></footer>
        </main>
      </div>
    </div>
  </div>;
}
