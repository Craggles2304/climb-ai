'use client';
import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {matchesFor,useAccount} from './AccountContext';
import {useSubscription} from './SubscriptionContext';
import {SessionBar} from './SessionBar';
import {LivePregameMount} from './LivePregameMount';
import {LiveCommandCenter} from './LiveCommandCenter';
import {coachingLevelFor} from '@/lib/coachingLevel';
import {BetaReporter} from './BetaReporter';
import {useLearningPlan} from './LearningPlanContext';
import {accountProgress,type AccountProgress} from '@/lib/accountXp';
import {missionSummary} from '@/lib/missionLoop';
import {DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import {positiveEvidenceForMatch} from '@/lib/positiveEvidence';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {currentGameDnaMissions} from '@/lib/gameDnaSnapshot';
import {canonicalLeagueRole,taskAppliesToRole} from '@/lib/roleAwareLearning';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {buildJourneyState} from '@/lib/journeyState';

type ProgressionPayload={
  ok:boolean;
  progress:AccountProgress;
  recent:Array<{id:number;accountId:string|null;missionId:string|null;matchId:string|null;kind:'MISSION_REP'|'MISSION_MASTERED';xp:number;title:string;role:string|null;createdAt:string}>;
  sync:{accountId:string|null;status:string;lastSyncedAt:string|null;latestMatchAt:string|null;latestMatchId:string|null;latestMatchChampion:string|null;latestMatchRole:string|null};
};

const primary=[
  ['Home','/dashboard','⌂','Your next step'],
  ['My DNA','/ilp','⬡','Your player identity'],
  ['Missions','/missions','✦','Six DNA trackers'],
  ['Match Room','/live','◇','Prepare · play · review'],
  ['My Games','/analyse','▤','Past games and evidence'],
  ['Coach','/coach','◎','Ask why · understand more'],
] as const;
const mobile=[['Home','/dashboard'],['My DNA','/ilp'],['Missions','/missions'],['Match','/live']] as const;

const routeTitle=(path:string)=>{
  if(path==='/dashboard')return'HOME';
  if(path==='/game-dna')return'MY DNA';
  if(path==='/session')return'NEXT GAME';
  if(path==='/coach')return'COACH';
  if(path==='/live')return'MATCH ROOM';
  if(path==='/analyse'||path.startsWith('/analyse/'))return'MY GAMES';
  if(path==='/ilp')return'MY DNA';
  if(path==='/validation')return'VALIDATION LAB';
  if(path==='/advanced-statistics')return'ADVANCED';
  if(path==='/progress')return'ADVANCED PROGRESS';
  if(path==='/matchups')return'MATCHUP ASSISTANT';
  if(path.startsWith('/matchup-lab'))return'ADVANCED MATCHUP';
  if(path==='/champions/main')return'MY MAIN CHAMP';
  if(path.startsWith('/champions'))return'CHAMPIONS';
  if(path==='/missions')return'MISSIONS';
  if(path==='/uploads')return'ADD A GAME';
  if(path==='/account')return'ACCOUNT';
  if(path==='/billing')return'SUBSCRIPTION';
  if(path==='/pricing')return'SUBSCRIPTION';
  if(path==='/settings')return'SETTINGS';
  return'OP CLIMB';
};
function isPrimaryActive(path:string,href:string){
  if(href==='/ilp')return path==='/ilp'||path==='/game-dna';
  if(href==='/analyse')return path==='/analyse'||path.startsWith('/analyse/');
  if(href==='/coach')return path==='/coach';
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
  const next=tier==='FREE'?'Next unlock: the full match coaching loop.':tier==='PLUS'?'Next unlock: a coach that remembers.':'Your full player-model coaching is active.';
  return <div className="sidebar-plan">
    <span className="eyebrow">YOUR COACHING PLAN</span>
    <strong>{tier}<span>{tier==='PRO'?'ACTIVE':'PLAN'}</span></strong>
    <p>{next}</p>
    <Link className="btn btn-small" href="/pricing">Explore your unlocks <span>↗</span></Link>
  </div>;
}

export function AppShell({children}:{children:React.ReactNode}){
  const {accounts,active,setActive}=useAccount();
  const {tier}=useSubscription();
  const {tasks,allTasks}=useLearningPlan();
  const [journeyDevices,setJourneyDevices]=useState<Array<{account_key:string;last_seen_at:string|null}>>([]);
  const [journeyDeviceLoaded,setJourneyDeviceLoaded]=useState(false);
  const [journeyDnaRevealed,setJourneyDnaRevealed]=useState(false);
  const fallbackXp=accountProgress(allTasks[active.id]??tasks);
  const [progression,setProgression]=useState<ProgressionPayload|null>(null);
  const [progressToast,setProgressToast]=useState<{title:string;body:string;kind:'XP'|'LEVEL'}|null>(null);
  const [seenLearningMatch,setSeenLearningMatch]=useState<string>('');
  const xp=progression?.progress??fallbackXp;
  const latestLearningMatch=progression?.sync.latestMatchId??null;
  const latestLearning=useMemo(()=>{
    if(!latestLearningMatch)return[];
    return tasks.flatMap(task=>{
      const attempt=(task.missionHistory??[]).find(item=>item.matchId===latestLearningMatch);
      if(!attempt)return[];
      return[{task,attempt,summary:missionSummary(task)}];
    });
  },[tasks,latestLearningMatch]);
  const latestLearningEvents=useMemo(()=>progression?.recent?.filter(item=>item.matchId===latestLearningMatch)??[],[progression?.recent,latestLearningMatch]);
  const latestLearningMatchData=useMemo(()=>latestLearningMatch?matchesFor(active.id).find(match=>match.id===latestLearningMatch):undefined,[active.id,latestLearningMatch]);
  const latestStrengths=useMemo(()=>latestLearningMatchData?positiveEvidenceForMatch(latestLearningMatchData,active.rank):[],[latestLearningMatchData,active.rank]);
  const latestLearningAt=progression?.sync.latestMatchAt??null;
  const latestLearningRecent=Boolean(latestLearningAt&&Date.now()-Date.parse(latestLearningAt)<6*60*60*1000);
  const showLearningReceipt=Boolean(latestLearningMatch&&latestLearningRecent&&seenLearningMatch!==latestLearningMatch);
  const acknowledgeLearningMatch=()=>{
    if(!latestLearningMatch)return;
    try{localStorage.setItem('op:learning-receipt:seen:'+active.id,latestLearningMatch)}catch{}
    setSeenLearningMatch(latestLearningMatch);
  };
  const path=usePathname();
  const live=path==='/live';
  const title=routeTitle(path);
  const journeyMatches=useMemo(()=>matchesFor(active.id).filter(match=>match.durationSeconds>=300),[active.id,progression?.sync.latestMatchId]);
  const journeyBaselineGames=dnaBaselineGameCount(journeyMatches,active.role);
  const journeyBaselineReady=dnaBaselineReady(journeyBaselineGames);
  const journeyAccountTasks=allTasks[active.id]??tasks;
  const journeyRoleTasks=useMemo(()=>journeyAccountTasks.filter(task=>taskAppliesToRole(task,active.role)),[journeyAccountTasks,active.role]);
  const journeyFocus=useMemo(()=>journeyBaselineReady
    ?currentGameDnaMissions(journeyRoleTasks,active.role).flatMap(({task})=>task?[task]:[]).sort((a,b)=>(a.priority??99)-(b.priority??99))[0]??null
    :null,[journeyBaselineReady,journeyRoleTasks,active.role]);
  const journeyFocusPlain=journeyFocus?plainLanguageFocus(journeyFocus):null;
  const journeyFocusSummary=journeyFocus?missionSummary(journeyFocus):null;
  const journeyLinked=journeyDevices.length>0;
  const journeyOnline=journeyDevices.some(device=>Boolean(device.last_seen_at&&Date.now()-Date.parse(device.last_seen_at)<90_000));
  const journey=buildJourneyState({
    deviceLoaded:journeyDeviceLoaded,
    linked:journeyLinked,
    online:journeyOnline,
    baselineGames:journeyBaselineGames,
    dnaRevealed:journeyDnaRevealed,
    focusName:journeyFocusPlain?.name,
    focusJob:journeyFocusPlain?.nextGame,
    focusConfirmed:journeyFocusSummary?.confirmed,
    focusRequired:journeyFocusSummary?.required,
  });
  const coreJourneyRoute=path==='/dashboard'||path==='/live'||path==='/ilp'||path==='/missions'||path==='/game-dna'||path==='/coach'||path==='/analyse'||path.startsWith('/analyse/');
  useEffect(()=>{
    try{setJourneyDnaRevealed(localStorage.getItem('op:dna-revealed:'+active.id+':'+active.role)==='1')}catch{setJourneyDnaRevealed(false)}
  },[active.id,active.role]);
  useEffect(()=>{
    if(!journeyBaselineReady||(path!=='/ilp'&&path!=='/game-dna'))return;
    try{localStorage.setItem('op:dna-revealed:'+active.id+':'+active.role,'1')}catch{}
    setJourneyDnaRevealed(true);
  },[journeyBaselineReady,path,active.id,active.role]);
  const topbarAction=coreJourneyRoute?null:path==='/live'
    ?{label:'MY DNA',href:'/ilp'}
    :path==='/ilp'||path==='/game-dna'
      ?{label:'PLAY NEXT GAME',href:'/live'}
      :{label:'OPEN MATCH ROOM',href:'/live'};
  const coaching=coachingLevelFor(active.rank);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const gatedLab=path.startsWith('/matchup-lab')&&coaching.depth<7;
  useEffect(()=>{
    let link=document.querySelector<HTMLLinkElement>('link[data-op-client-css="1"]');
    if(!link){
      link=document.createElement('link');
      link.rel='stylesheet';
      link.href='/client/styles.css';
      link.dataset.opClientCss='1';
      document.head.appendChild(link);
    }
  },[]);
  useEffect(()=>{
    const view=path==='/dashboard'?'overview':path==='/live'?'match-room':path==='/ilp'||path==='/game-dna'?'climb':path==='/coach'?'coach-memory':path==='/pricing'||path==='/billing'?'plans':'overview';
    document.body.dataset.clientView=view;
    document.body.dataset.clientTier=tier.toLowerCase();
    return()=>{
      delete document.body.dataset.clientView;
      delete document.body.dataset.clientTier;
    };
  },[path,tier]);
  useEffect(()=>setAdvancedOpen(false),[path]);
  useEffect(()=>{
    try{setSeenLearningMatch(localStorage.getItem('op:learning-receipt:seen:'+active.id)||'')}catch{setSeenLearningMatch('')}
  },[active.id]);
  useEffect(()=>{
    let stopped=false;
    const pull=async()=>{
      try{
        const response=await fetch('/api/live/pair',{cache:'no-store'});
        if(!response.ok)return;
        const body=await response.json();
        if(stopped)return;
        setJourneyDevices((body.devices??[]).filter((device:{account_key:string})=>device.account_key===active.id));
      }catch{}finally{if(!stopped)setJourneyDeviceLoaded(true)}
    };
    setJourneyDeviceLoaded(false);
    void pull();
    const timer=window.setInterval(()=>void pull(),30_000);
    return()=>{stopped=true;window.clearInterval(timer)};
  },[active.id]);
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
    const timer=window.setInterval(()=>void pull(),30_000);
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisible);
    return()=>{stopped=true;window.clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)};
  },[active.id]);
  useEffect(()=>{
    if(!progressToast)return;
    const timer=window.setTimeout(()=>setProgressToast(null),5200);
    return()=>window.clearTimeout(timer);
  },[progressToast]);

  return <div className={'app-shell authenticated-client-shell '+(live?'is-live':'')}>
    <aside className="sidebar" aria-label="Primary navigation">
      <Link className="brand" href="/dashboard" aria-label="OP CLIMB home">
        <span className="brand-mark">OP<span>↗</span></span>
        <span>OP<span className="mint">CLIMB</span><small>THE PERSONAL LEAGUE COACH</small></span>
      </Link>
      <div className="game-label"><span className="game-rune">L</span> LEAGUE OF LEGENDS</div>
      <div className="game-switch" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,margin:'14px 0 20px'}}><Link className="btn primary" href="/dashboard" aria-current="page" style={{fontSize:11,minHeight:38,padding:'8px'}}>LEAGUE</Link><Link className="btn secondary" href="/tft" style={{fontSize:11,minHeight:38,padding:'8px'}}>TFT</Link></div>
      <p className="nav-caption">YOUR WORKSPACE</p>
      <nav aria-label="Main navigation">
        {primary.map(([name,href,icon,hint])=>{
          const activeLink=isPrimaryActive(path,href);
          return <Link className={'nav-link '+(href==='/ilp'?'nav-link-dna ':'')+(activeLink?'active':'')} aria-current={activeLink?'page':undefined} key={href} href={href}>
            <span className="nav-link-icon" aria-hidden="true">{icon}</span>
            <span className="nav-link-copy"><b>{name}</b><small>{hint}</small></span>
          </Link>;
        })}

      </nav>
      <div className="sidebar-bottom">
        <SidebarTierStep tier={tier}/>
        <Link className="sidebar-help" href="/client"><span>◎</span> Take a quick tour</Link>
        <div className="mini-profile">
          <span className="player-avatar">{(active.gameName||'P').slice(0,1).toUpperCase()}</span>
          <span><strong>{active.gameName}{active.tagline}</strong><small>{active.rank} · {active.role} · LV {xp.level}</small></span>
          <Link className="icon-button" href="/settings" aria-label="Player settings">≡</Link>
        </div>
        {accounts.length>1&&<select className="client-account-switch" aria-label="Active Riot account" value={active.id} onChange={e=>setActive(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.gameName}{a.tagline}</option>)}</select>}
        <SyncHealth sync={progression?.sync??null}/>
        <SessionBar/>
      </div>
    </aside>

    <div className="workspace">
      <header className="topbar">
        <Link className="mobile-brand" href="/dashboard">OP<span>CLIMB</span></Link>
        <div className="breadcrumb"><span>▦</span><span>Player workspace</span><span className="divider">/</span><strong>{title}</strong></div>
        <div className="topbar-right">
          {topbarAction&&<Link className="btn primary btn-small site-cta" href={topbarAction.href}>{topbarAction.label}</Link>}
          <span className="demo-badge">{tier} PLAN</span>
          <Link className="icon-button" href="/account" aria-label="Account">◉</Link>
          <Link className="icon-button" href="/settings" aria-label="Settings">⚙</Link>
        </div>
      </header>

      {coreJourneyRoute&&<section className={'op-journey-status phase-'+journey.phase.toLowerCase()} aria-label="Your OP CLIMB journey status">
        <div className="op-journey-status-step">
          <span>{journey.status}</span>
          {journey.progress&&<b>{journey.progress}</b>}
        </div>
        <div className="op-journey-status-copy">
          <strong>{journey.title}</strong>
          <small>{journey.body}</small>
        </div>
        <Link className="btn primary" href={journey.href} aria-disabled={journey.phase==='CHECKING'}>{journey.cta}</Link>
      </section>}

      <main id="content" tabIndex={-1}>
        {live?<><LivePregameMount/><LiveCommandCenter/></>:gatedLab&&!advancedOpen?<RankLabGate tier={coaching.tier} path={path} onOpen={()=>setAdvancedOpen(true)}/>:<div className="page">{children}</div>}
      </main>
    </div>

    <nav className="mobile-nav" aria-label="Mobile navigation">{mobile.map(([name,href])=><Link className={isPrimaryActive(path,href)?'active':''} key={href} href={href}>{name}</Link>)}</nav>
    {progressToast&&<div className={'op-progress-toast '+(progressToast.kind==='LEVEL'?'is-level':'')} role="status">
      <span>{progressToast.kind==='LEVEL'?'LEVEL UP':'PROGRESSION UPDATED'}</span>
      <b>{progressToast.title}</b>
      <small>{progressToast.body}</small>
    </div>}
    {showLearningReceipt&&<aside className="op-learning-receipt" role="status" style={journeyFocus?({'--strand-color':DNA_DOMAIN_COLORS[journeyFocus.dnaDomain]} as CSSProperties):undefined}>
      <div className="op-learning-receipt-head">
        <div><span>{journeyBaselineReady?'GAME COMPLETE · LEARNING UPDATED':'GAME COMPLETE · BASELINE UPDATED'}</span><strong>{progression?.sync.latestMatchChampion||'LATEST GAME'} · {progression?.sync.latestMatchRole||active.role}</strong></div>
        <button type="button" aria-label="Dismiss learning update" onClick={acknowledgeLearningMatch}>×</button>
      </div>
      {!journeyBaselineReady?<div className="op-learning-receipt-body">
        <h2>Baseline {Math.min(journeyBaselineGames,DNA_BASELINE_GAMES)}/{DNA_BASELINE_GAMES} complete.</h2>
        <p>This game is useful coaching evidence, but it is <strong>not a permanent DNA mission yet</strong>. Your six DNA missions unlock after game {DNA_BASELINE_GAMES}.</p>
        <div className="op-learning-strength-count">PROVISIONAL COACHING ONLY · {DNA_BASELINE_GAMES-journeyBaselineGames} GAME{DNA_BASELINE_GAMES-journeyBaselineGames===1?'':'S'} UNTIL DNA REVEAL</div>
      </div>:journeyBaselineGames===DNA_BASELINE_GAMES&&latestLearningMatchData&&canonicalLeagueRole(latestLearningMatchData.role)===active.role?<div className="op-learning-receipt-body">
        <h2>Your Game DNA is ready.</h2>
        <p>Baseline complete. Your six strands can now reveal their first missions, with one priority mission selected for your next game.</p>
        <div className="op-learning-mastered">◆ 3/3 BASELINE COMPLETE · DNA UNLOCKED</div>
      </div>:<div className="op-learning-receipt-body">
        <h2>{latestLearning.length
          ?latestLearning.some(item=>item.attempt.banksPass)
            ?'That game moved your Climb.'
            :'Game reviewed. Keep training the same habit.'
          :'Your game is in. OP CLIMB is measuring it now.'}</h2>
        {latestLearning.length?<div className="op-learning-receipt-missions">
          {latestLearning.slice(0,3).map(({task,attempt,summary})=><div key={task.id} style={({ '--strand-color':DNA_DOMAIN_COLORS[task.dnaDomain]} as CSSProperties)}>
            <span>{DNA_DOMAIN_LABELS[task.dnaDomain]}</span>
            <b>{plainLanguageFocus(task).name}</b>
            <strong className={attempt.banksPass?'good':'watch'}>{attempt.banksPass?'✓ PROVEN GAME':'○ NOT PROVEN'}</strong>
            <small>{summary.confirmed}/{summary.required} proven games · {learningStageLabel(summary.stage)}</small>
          </div>)}
        </div>:<p>Match data has synced. Mission evidence can take a short moment to finish processing.</p>}
        {latestStrengths.length>0&&<div className="op-learning-strength-count">✓ {latestStrengths.length} VERIFIED STRENGTH{latestStrengths.length===1?'':'S'} · GOOD PLAY MEASURED TOO</div>}
        {latestLearningEvents.some(item=>item.kind==='MISSION_MASTERED')&&<div className="op-learning-mastered">◆ HABIT MASTERED — moved into development history.</div>}
      </div>}
      <div className="op-learning-receipt-actions">
        <Link className="btn primary" onClick={acknowledgeLearningMatch} href={journeyBaselineReady?'/ilp':'/live'}>{journeyBaselineReady?(journeyDnaRevealed?'SEE MY DNA →':'REVEAL MY DNA →'):`PLAY BASELINE GAME ${Math.min(journeyBaselineGames+1,DNA_BASELINE_GAMES)} →`}</Link>
        {latestLearningMatch&&<Link className="btn secondary" onClick={acknowledgeLearningMatch} href={'/analyse/'+encodeURIComponent(latestLearningMatch)}>REVIEW THIS GAME</Link>}
      </div>
    </aside>}
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

function learningStageLabel(stage:string){
  if(stage==='DISCOVER')return'RECOGNISE';
  if(stage==='PRACTISE')return'EXECUTE';
  if(stage==='REPEAT')return'REPEAT';
  if(stage==='MASTERED')return'MASTERED';
  return stage;
}

