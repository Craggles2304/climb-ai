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
import {useLearningPlan} from './LearningPlanContext';
import {accountProgress,type AccountProgress} from '@/lib/accountXp';

type ProgressionPayload={
  ok:boolean;
  progress:AccountProgress;
  recent:Array<{id:number;accountId:string|null;missionId:string|null;matchId:string|null;kind:'MISSION_REP'|'MISSION_MASTERED';xp:number;title:string;role:string|null;createdAt:string}>;
  sync:{accountId:string|null;status:string;lastSyncedAt:string|null;latestMatchAt:string|null;latestMatchId:string|null;latestMatchChampion:string|null;latestMatchRole:string|null};
};

const primary=[
  ['Home','/dashboard','⌂','Your next action'],
  ['My Main Champ','/champions/main','◈','Build + abilities'],
  ['My Coach','/coach','✦','Ask + understand'],
  ['My Games','/analyse','◇','Reviews + evidence'],
  ['My Progress','/ilp','◎','Focus + development'],
  ['Companion','/live','●','Connect League'],
] as const;
const mobile=[['Home','/dashboard'],['Main','/champions/main'],['Coach','/coach'],['Games','/analyse'],['Progress','/ilp']] as const;

type RouteScene={code:string;kicker:string;title:string;copy:string;signals:[string,string,string];tone:string;watermark:string};
const routeScene=(path:string):RouteScene|null=>{
  if(path==='/dashboard')return{code:'HQ // 01',kicker:'PLAYER DEVELOPMENT HQ',title:'NEXT GAME. ONE JOB.',copy:'Your current focus, the evidence behind it and the next rep worth playing — without digging through a stat wall.',signals:['ONE ACTIVE FOCUS','EVIDENCE RUNNING','NEXT REP READY'],tone:'hq',watermark:'CLIMB'};
  if(path==='/champions/main')return{code:'MAIN // 02',kicker:'YOUR CHAMPION LAB',title:'KNOW YOUR MAIN.',copy:'Your champion, your build and what the numbers actually become when you change the items.',signals:['YOUR MAIN','BUILD SIMULATOR','ABILITY DAMAGE'],tone:'lab',watermark:'MAIN'};
  if(path==='/coach')return{code:'COACH // 02',kicker:'COACH MEMORY',title:'ASK LESS. REMEMBER MORE.',copy:'Your coach carries the thread across games, so every answer starts from the player you are becoming rather than from zero.',signals:['PLAYER MEMORY','RANK AWARE','DECISION FIRST'],tone:'coach',watermark:'COACH'};
  if(path==='/analyse'||path.startsWith('/analyse/'))return{code:'REVIEW // 03',kicker:'MATCH REVIEW',title:'WATCH THE DECISION. NOT THE KDA.',copy:'Turn the last game into a small number of moments that explain what held, what broke and what deserves the next rep.',signals:['MATCH EVIDENCE','DECISION REVIEW','NEXT FIX'],tone:'review',watermark:'REVIEW'};
  if(path==='/ilp')return{code:'CLIMB // 04',kicker:'PLAYER DEVELOPMENT',title:'BUILD A PLAYER. NOT A STATLINE.',copy:'One core mission. Two support missions. All rank-scaled and only moved by repeated match evidence.',signals:['CORE FOCUS','2 SUPPORT','RANK-SCALED'],tone:'climb',watermark:'GROW'};
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
  if(path==='/champions/main')return'MY MAIN CHAMP';
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
  const {tasks,allTasks}=useLearningPlan();
  const fallbackXp=accountProgress(allTasks[active.id]??tasks);
  const [progression,setProgression]=useState<ProgressionPayload|null>(null);
  const [progressToast,setProgressToast]=useState<{title:string;body:string;kind:'XP'|'LEVEL'}|null>(null);
  const xp=progression?.progress??fallbackXp;
  const path=usePathname();
  const live=path==='/live';
  const title=routeTitle(path);
  const coaching=coachingLevelFor(active.rank);
  const scene=routeScene(path);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const gatedLab=path.startsWith('/matchup-lab')&&coaching.depth<7;
  const advancedRoute=path==='/advanced-statistics'||path==='/progress'||path==='/matchups'||path.startsWith('/matchup-lab')||(path.startsWith('/champions')&&path!=='/champions/main')||path==='/missions'||path==='/uploads';
  useEffect(()=>setAdvancedOpen(false),[path]);
  useEffect(()=>{
    let stopped=false,busy=false;
    const pull=async()=>{
      if(stopped||busy||document.visibilityState!=='visible')return;
      busy=true;
      try{
        const response=await fetch('/api/progression?accountId='+encodeURIComponent(active.id),{cache:'no-store'});
        const body=await response.json() as ProgressionPayload;
        if(!response.ok||!body?.ok||stopped)return;
        setProgression(body);
        const levelKey='op:progression:last-level';
        const txKey='op:progression:last-tx';
        const previousLevel=Number(localStorage.getItem(levelKey)||'0');
        const newest=body.recent?.[0];
        const previousTx=Number(localStorage.getItem(txKey)||'0');
        if(previousLevel>0&&body.progress.level>previousLevel){
          setProgressToast({kind:'LEVEL',title:'CLIMB LEVEL '+body.progress.level,body:body.progress.title+' unlocked · '+body.progress.xp.toLocaleString()+' XP'});
        }else if(previousTx>0&&newest&&newest.id>previousTx){
          setProgressToast({
            kind:'XP',
            title:newest.kind==='MISSION_MASTERED'?'MISSION MASTERED · +'+newest.xp+' XP':'PROVEN REP · +'+newest.xp+' XP',
            body:newest.title,
          });
        }
        localStorage.setItem(levelKey,String(body.progress.level));
        if(newest)localStorage.setItem(txKey,String(newest.id));
      }catch{}finally{busy=false}
    };
    const onFocus=()=>void pull();
    const onVisible=()=>{if(document.visibilityState==='visible')void pull()};
    void pull();
    const timer=window.setInterval(()=>void pull(),15_000);
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisible);
    return()=>{stopped=true;window.clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)};
  },[active.id]);
  useEffect(()=>{
    if(!progressToast)return;
    const timer=window.setTimeout(()=>setProgressToast(null),5200);
    return()=>window.clearTimeout(timer);
  },[progressToast]);

  return <div className={'app-layout op-shell '+(live?'is-live':'')}>
    <aside className="sidebar op-sidebar">
      <div className="op-brand-block"><Link href="/dashboard" className="logo-link" aria-label={BRAND.name+' home'}><Wordmark size="sm" priority/></Link><span className={'op-tier op-tier-'+tier.toLowerCase()}>LEAGUE · {tier}</span></div>
      <div className="account-switch op-account-card">
        <div className="op-player-kicker"><span>YOU</span><i/></div>
        <select aria-label="Active Riot account" value={active.id} onChange={e=>setActive(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.gameName}{a.tagline} · {a.region}</option>)}</select>
        <div className="op-account-meta"><strong>{active.rank}</strong><span>{active.role} · {coaching.tier} COACH</span></div>
        <div className="op-account-xp">
          <div><span>CLIMB LV {xp.level}</span><b>{xp.xp.toLocaleString()} XP</b></div>
          <i><em style={{width:xp.levelProgress+'%'}}/></i>
          <small>{xp.title} · {Math.max(0,xp.nextLevelXp-xp.xp).toLocaleString()} XP TO LV {xp.level+1}</small>
        </div>
        <SyncHealth sync={progression?.sync??null}/>
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
    {progressToast&&<div className={'op-progress-toast '+(progressToast.kind==='LEVEL'?'is-level':'')} role="status">
      <span>{progressToast.kind==='LEVEL'?'LEVEL UP':'PROGRESSION UPDATED'}</span>
      <b>{progressToast.title}</b>
      <small>{progressToast.body}</small>
    </div>}
    <BetaReporter/>
  </div>;
}


function SyncHealth({sync}:{sync:ProgressionPayload['sync']|null}){
  if(!sync)return <div className="op-sync-health"><i/><span>SYNC CHECKING…</span></div>;
  const status=String(sync.status||'').toLowerCase();
  const processing=/sync|process|enrich|pending/.test(status)&&!/ready|complete/.test(status);
  const stamp=sync.lastSyncedAt||sync.latestMatchAt;
  return <div className={'op-sync-health '+(processing?'is-processing':'is-ready')}>
    <i/>
    <span>{processing?'GAME DATA · PROCESSING':stamp?'LAST GAME SYNCED · '+relativeTime(stamp)+' ✓':'WAITING FOR FIRST GAME'}</span>
  </div>;
}

function relativeTime(value:string){
  const ms=Date.now()-Date.parse(value);
  if(!Number.isFinite(ms)||ms<0)return'JUST NOW';
  const minutes=Math.floor(ms/60_000);
  if(minutes<1)return'JUST NOW';
  if(minutes<60)return minutes+'M AGO';
  const hours=Math.floor(minutes/60);
  if(hours<24)return hours+'H AGO';
  return Math.floor(hours/24)+'D AGO';
}
