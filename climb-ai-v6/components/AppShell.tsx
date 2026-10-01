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
  ['Overview','/dashboard','⌂','Your daily briefing'],
  ['Match room','/live','◇','Prepare + connect'],
  ['My climb','/ilp','◎','Focus + development'],
  ['Coach memory','/coach','✦','Ask + understand'],
  ['My games','/analyse','◈','Reviews + evidence'],
  ['Plans & unlocks','/pricing','◆','Coaching depth'],
] as const;
const mobile=[['Overview','/dashboard'],['Match','/live'],['Climb','/ilp'],['Coach','/coach'],['Games','/analyse']] as const;

const routeTitle=(path:string)=>{
  if(path==='/dashboard')return'YOUR CLIMB';
  if(path==='/session')return'NEXT GAME';
  if(path==='/coach')return'MY COACH';
  if(path==='/live')return'COMPANION';
  if(path==='/analyse'||path.startsWith('/analyse/'))return'MY GAMES';
  if(path==='/ilp')return'MY PROGRESS';
  if(path==='/validation')return'VALIDATION LAB';
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
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const gatedLab=path.startsWith('/matchup-lab')&&coaching.depth<7;
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
    const timer=window.setInterval(()=>void pull(),5*60_000);
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisible);
    return()=>{stopped=true;window.clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)};
  },[active.id]);
  useEffect(()=>{
    if(!progressToast)return;
    const timer=window.setTimeout(()=>setProgressToast(null),5200);
    return()=>window.clearTimeout(timer);
  },[progressToast]);

  return <div className={'app-layout op-shell client-auth-shell '+(live?'is-live':'')}>
    <aside className="sidebar op-sidebar client-auth-sidebar">
      <div className="client-sidebar-brand">
        <Link href="/dashboard" className="logo-link" aria-label={BRAND.name+' home'}><Wordmark size="sm" priority/></Link>
      </div>

      <div className="op-client-game-label"><span>L</span> LEAGUE OF LEGENDS</div>
      <div className="op-client-nav-caption">YOUR WORKSPACE</div>

      <nav className="op-nav client-primary-nav" aria-label="Main navigation">
        <div className="op-nav-group">
          {primary.map(([name,href,icon])=>{
            const activeLink=isPrimaryActive(path,href);
            return <Link className={activeLink?'active-nav':''} key={href} href={href}>
              <span className="op-nav-icon">{icon}</span><span>{name}</span>{name==='Coach memory'&&tier==='PRO'&&<small className="client-nav-pro">PRO</small>}{activeLink&&<i/>}
            </Link>;
          })}
        </div>
      </nav>

      <div className="client-sidebar-bottom">
        <SidebarTierStep tier={tier}/>
        <Link className="client-sidebar-help" href="/client">◎ <span>Take a quick tour</span></Link>
        <div className="client-mini-profile">
          <span className="client-player-avatar">{(active.gameName||'P').slice(0,1).toUpperCase()}</span>
          <div className="client-player-copy">
            <strong>{active.gameName}{active.tagline}</strong>
            <small>{active.rank} · {active.role} · CLIMB LV {xp.level}</small>
            {accounts.length>1&&<select aria-label="Active Riot account" value={active.id} onChange={e=>setActive(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.gameName}{a.tagline}</option>)}</select>}
          </div>
          <Link className="client-profile-settings" href="/settings" aria-label="Player settings">≡</Link>
        </div>
        <SyncHealth sync={progression?.sync??null}/>
        <SessionBar/>
      </div>
    </aside>

    <main className={'app-main op-main client-auth-main '+(live?'op-live-main':'')}>
      <header className="op-broadcast-hud client-auth-topbar">
        <div className="op-hud-brand">
          <div className="op-hud-crumb"><span>Player workspace</span><i>/</i><strong>{title}</strong></div>
        </div>
        <div className="client-topbar-right">
          <Link className="btn primary btn-small client-analyse-cta" href="/analyse">Analyse my games</Link>
          <span className="client-plan-badge">{tier} PLAN</span>
          <Link className="client-topbar-icon" href="/account" aria-label="Account">◉</Link>
          <Link className="client-topbar-icon" href="/settings" aria-label="Settings">⚙</Link>
        </div>
      </header>

      <div className="op-screen-frame client-auth-frame">
        {live?<><LivePregameMount/><LiveCommandCenter/><LiveFightReviewMount/></>:gatedLab&&!advancedOpen?<RankLabGate tier={coaching.tier} path={path} onOpen={()=>setAdvancedOpen(true)}/>:children}
      </div>
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
