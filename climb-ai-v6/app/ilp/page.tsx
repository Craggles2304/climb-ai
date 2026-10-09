'use client';

import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {UpgradeButton} from '@/components/BillingActions';
import {hasTier} from '@/lib/subscription';
import {AnimatedBar} from '@/components/Motion';
import {IlpExplainability} from '@/components/IlpExplainability';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {missionSummary} from '@/lib/missionLoop';
import type {DnaDomain,ILPTask,Match,Role} from '@/lib/types';
import {XP_PER_MISSION_MASTERY,XP_PER_PROVEN_REP} from '@/lib/accountXp';
import {verifiedMissionRep} from '@/lib/verifiedMissionProof';
import {MissionMeasurementBadge} from '@/components/MissionMeasurementBadge';
import {DNA_DOMAINS,DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS,dnaDomainLabel} from '@/lib/dnaDomain';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {DnaRoleSwitcher} from '@/components/DnaRoleSwitcher';
import {taskFreshness} from '@/lib/ilpCloudMerge';
import {currentGameDnaMissions,gameMissionFocusPair} from '@/lib/gameDnaSnapshot';
import {dnaStrandLevel} from '@/lib/dnaLevel';
import {isDnaStrandMission} from '@/lib/dnaStrandMissions';
import {canonicalLeagueRole,LEAGUE_ROLES,taskAppliesToRole} from '@/lib/roleAwareLearning';
import {DnaHelix,type HelixHabit} from '@/components/DnaHelix';
import {DnaHud,DnaSectionHead,DnaTabs,HabitCard,type DnaTab,type HabitMissionState,type RecentMoment} from '@/components/CareerDnaPanels';
import {WeeklyReport} from '@/components/WeeklyReport';
import {careerFor,type GameRecord} from '@/lib/dna/career';
import {buildDNA,dnaHeadline,DNA_WINDOW,type CareerDNA,type HabitReading} from '@/lib/dna/dna';
import {habitDomain,habitOfTask} from '@/lib/dna/plan';
import {weeklyReport} from '@/lib/dna/report';
import {HABITS,HABIT_IDS,type HabitId} from '@/lib/habits/library';
import {HABIT_COLOURS} from '@/lib/habits/colours';
import {groupMoments} from '@/lib/habits/moments';

type NextClimbGate={id:string;label:string;current:number;target:number;unit:string;met:boolean;evidence:string};
type NextClimbResponse={
  ok?:boolean;
  tier?:'FREE'|'PLUS'|'PRO';
  role?:Role;
  status?:string;
  gamesAnalyzed?:number;
  message?:string;
  boundary?:string;
  plan?:{
    dnaDomain:DnaDomain;
    behaviourKey:string;
    skill:string;
    phase:string;
    state:string;
    action:string;
    whyNow:string;
    teachingPoint:string;
    evidence:string;
    graduationRule:string;
    completion:number;
    gates:NextClimbGate[];
    transferTest:{active:boolean;needsNovelChampionOrContext:boolean;behaviourKey:string|null};
    retireWhen:string;
    nextSkill:string|null;
    decisionReason:string;
  }|null;
};
const clean=(value:string)=>value.replaceAll('_',' ');
const strandStyle=(domain:DnaDomain)=>({'--strand-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties);
const pct=(n:number)=>`${Math.round(n*100)}%`;

/** My DNA sub-tabs, one on screen at a time. The URL hash keeps the tab across refreshes and makes it linkable. */
type DnaTabId='strand'|'missions'|'habits'|'week'|'change';
const DNA_TAB_IDS:DnaTabId[]=['strand','missions','habits','week','change'];
/** Rungs shown on the strand. Older games stay in the career; the strand shows the recent stretch. */
const STRAND_GAMES=30;

/** The latest few timestamped occurrences of one habit, newest game first. */
function recentMoments(matches:Match[],id:HabitId,limit=3):RecentMoment[]{
  const out:RecentMoment[]=[];
  for(const m of matches){
    if(!Array.isArray(m.habitMoments))continue;
    for(const g of groupMoments(m.habitMoments,id)){
      out.push({matchId:m.id,champion:m.champion,when:new Date(m.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'}),t:g.t,d:g.items[0].d});
      if(out.length>=limit)return out;
    }
  }
  return out;
}

/**
 * My DNA — the Game DNA room.
 *
 * Six strands are the player being built; the Career DNA habits inside them
 * are what follows the player from game to game. Everything is read per role.
 *
 * FREE:  the scan, the strand with its biggest habit lit, that one habit, the six strand missions.
 * PLUS:  every habit on the strand, the grid, the full weekly report, every moment, Your Next Climb.
 * PRO:   long-term memory — change against the birth DNA, habits broken, mastered and paused missions.
 */
export default function PlayerDevelopmentCentre(){
  const {active,refresh:refreshAccount}=useAccount();
  const {tier}=useSubscription();
  const plus=hasTier(tier,'PLUS');
  const pro=hasTier(tier,'PRO');
  const {tasks,allTasks,planReady,planError,startHabitMission}=useLearningPlan();
  const [showProof,setShowProof]=useState(false);
  const [changes,setChanges]=useState<string[]>([]);
  const [checking,setChecking]=useState(false);
  const [selectedDomain,setSelectedDomain]=useState<DnaDomain|null>(null);
  const [viewRole,setViewRole]=useState<Role>(active.role);
  const [nextClimb,setNextClimb]=useState<NextClimbResponse|null>(null);
  const [nextClimbLoading,setNextClimbLoading]=useState(false);
  const [tab,setTab]=useState<DnaTabId>('strand');
  const [focusHabit,setFocusHabit]=useState<HabitId|null>(null);
  const [gameId,setGameId]=useState<string|null>(null);
  const tabsTop=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const raw=params.get('dna');
    const role=params.get('role') as Role|null;
    const domain=DNA_DOMAINS.includes(raw as DnaDomain)?raw as DnaDomain:null;
    setSelectedDomain(domain);
    setViewRole(role&&LEAGUE_ROLES.includes(role)?role:active.role);
    setGameId(params.get('game'));
    setFocusHabit(null);
    // A saved tab wins; older links still land where they point (?dna= is a strand mission, ?game= a rung).
    const hash=window.location.hash.slice(1) as DnaTabId;
    setTab(DNA_TAB_IDS.includes(hash)?hash:domain?'missions':'strand');
  },[active.id,active.role]);
  // Back/forward and in-page links change only the hash, so follow it while the page is open.
  useEffect(()=>{
    const onHash=()=>{
      const hash=window.location.hash.slice(1) as DnaTabId;
      if(DNA_TAB_IDS.includes(hash))setTab(hash);
    };
    window.addEventListener('hashchange',onHash);
    return()=>window.removeEventListener('hashchange',onHash);
  },[]);

  const writeUrl=(url:URL)=>window.history.replaceState({},'',url.pathname+url.search+url.hash);
  const chooseDomain=(domain:DnaDomain|null)=>{
    setSelectedDomain(domain);
    const url=new URL(window.location.href);
    if(domain)url.searchParams.set('dna',domain);else url.searchParams.delete('dna');
    writeUrl(url);
  };
  const chooseRole=(role:Role)=>{
    setViewRole(role);
    setFocusHabit(null);
    setGameId(null);
    const url=new URL(window.location.href);
    url.searchParams.set('role',role);
    url.searchParams.delete('game');
    writeUrl(url);
  };
  const openTab=(id:DnaTabId)=>{
    setTab(id);
    try{const url=new URL(window.location.href);url.hash=id;writeUrl(url)}catch{/* sandboxed */}
    // Deep in a long panel? Bring the new panel's top back into view under the sticky tabs.
    const anchor=tabsTop.current;
    if(anchor&&anchor.getBoundingClientRect().top<0)window.scrollTo({top:anchor.getBoundingClientRect().top+window.scrollY-8});
  };

  const accountMatches=matchesFor(active.id).filter(match=>match.durationSeconds>=300);
  const roleGameCounts=Object.fromEntries(LEAGUE_ROLES.map(role=>[role,dnaBaselineGameCount(accountMatches,role)])) as Record<Role,number>;
  const allRoleMatches=accountMatches.filter(match=>canonicalLeagueRole(match.role)===viewRole);
  const baselineGames=roleGameCounts[viewRole]??0;
  const baselineReady=dnaBaselineReady(baselineGames);
  const accountTasks=allTasks[active.id]??tasks;
  const roleTasks=useMemo(()=>accountTasks.filter(task=>taskAppliesToRole(task,viewRole)),[accountTasks,viewRole]);
  const activeTasks=useMemo(()=>{
    if(!baselineReady)return[];
    return currentGameDnaMissions(roleTasks,viewRole).flatMap(({task})=>task?[task]:[]);
  },[roleTasks,viewRole,baselineReady]);
  const priorityTask=useMemo(()=>gameMissionFocusPair(activeTasks,viewRole)[0]?.task??[...activeTasks].sort((a,b)=>(b.priority??0)-(a.priority??0))[0]??null,[activeTasks,viewRole]);
  const recommendedDomain=nextClimb?.plan?.dnaDomain??priorityTask?.dnaDomain??null;
  const focusDomain=selectedDomain??recommendedDomain;
  const focusTask=useMemo(()=>focusDomain?activeTasks.find(task=>task.dnaDomain===focusDomain)??null:null,[activeTasks,focusDomain]);
  const displayTasks=useMemo(()=>focusTask?[focusTask]:[],[focusTask]);
  const dnaLevels=useMemo(()=>Object.fromEntries(DNA_DOMAINS.map(domain=>[domain,dnaStrandLevel(roleTasks,domain,viewRole)])) as Record<DnaDomain,ReturnType<typeof dnaStrandLevel>>,[roleTasks,viewRole]);
  const masteredAll=useMemo(()=>dedupeArchiveTasks(roleTasks.filter(task=>task.status==='MASTERED')),[roleTasks]);
  const pausedAll=useMemo(()=>dedupeArchiveTasks(roleTasks.filter(task=>task.status==='PAUSED')),[roleTasks]);
  const mastered=useMemo(()=>selectedDomain?masteredAll.filter(task=>task.dnaDomain===selectedDomain):masteredAll,[masteredAll,selectedDomain]);
  const paused=useMemo(()=>selectedDomain?pausedAll.filter(task=>task.dnaDomain===selectedDomain):pausedAll,[pausedAll,selectedDomain]);

  // Career DNA: the habits behind this role's games, read from the same matches as the strands.
  const career=careerFor(allRoleMatches);
  const dna=buildDNA(career);
  const report=weeklyReport(career);
  const relevant=career.filter(game=>game.relevant);
  const strandGames=relevant.slice(-STRAND_GAMES);
  const strandOffset=relevant.length-strandGames.length;
  const flaggedIds=dna.habits.map(h=>h.id);
  const quietIds=HABIT_IDS.filter(id=>!flaggedIds.includes(id)&&strandGames.some(game=>typeof game.habits[id]==='number'));
  // FREE sees its biggest habit lit on the strand; the rest of the DNA is a PLUS read.
  const helixIds=plus||!flaggedIds.length?[...flaggedIds,...quietIds]:flaggedIds.slice(0,1);
  const helixHabits:HelixHabit[]=helixIds.map(id=>({
    id,name:HABITS[id].name,occursAt:HABITS[id].occursAt,colour:HABIT_COLOURS[id],
    group:DNA_DOMAIN_LABELS[habitDomain(id)],groupColour:DNA_DOMAIN_COLORS[habitDomain(id)],
  }));
  const shownHabits=plus?dna.habits:dna.habits.slice(0,1);
  const hiddenHabits=dna.habits.length-shownHabits.length;
  const flaggedCount=dna.habits.filter(h=>h.level!=='WATCH').length;
  const hasChange=dna.broken.length>0||dna.strengths.length>0;

  // A habit can be its strand's mission; this is where each one stands.
  const habitMissions=new Map<HabitId,ILPTask>();
  for(const task of roleTasks){
    const id=habitOfTask(task);
    if(id&&isDnaStrandMission(task)&&task.status!=='MASTERED'&&task.status!=='PAUSED')habitMissions.set(id,task);
  }
  const missionStateFor=(id:HabitId):HabitMissionState=>{
    const task=habitMissions.get(id);
    if(!task)return{state:'NONE'};
    const summary=missionSummary(task);
    return{state:'ACTIVE',confirmed:summary.confirmed,required:summary.required,locked:task.dnaFocusUnlocked!==true};
  };
  const openHabitMission=(id:HabitId)=>{chooseDomain(habitDomain(id));openTab('missions')};
  const makeHabitMission=(h:HabitReading)=>{
    startHabitMission({habit:h.id,role:viewRole,reading:h});
    openHabitMission(h.id);
  };
  const showOnStrand=(id:HabitId)=>{setFocusHabit(id);openTab('strand')};

  useEffect(()=>{
    if(tier==='FREE'||!baselineReady){
      setNextClimb(null);
      setNextClimbLoading(false);
      return;
    }
    let cancelled=false;
    setNextClimbLoading(true);
    fetch('/api/player-plan?accountId='+encodeURIComponent(active.id)+'&role='+encodeURIComponent(viewRole),{cache:'no-store'})
      .then(async response=>{
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(String(body?.error||'Player plan unavailable'));
        return body as NextClimbResponse;
      })
      .then(body=>{if(!cancelled)setNextClimb(body)})
      .catch(()=>{if(!cancelled)setNextClimb({ok:false,message:'Your Next Climb is temporarily unavailable. Your DNA missions are still tracking normally.'})})
      .finally(()=>{if(!cancelled)setNextClimbLoading(false)});
    return()=>{cancelled=true};
  },[active.id,viewRole,tier,baselineReady,allRoleMatches.length]);

  const refresh=async()=>{
    setChecking(true);
    try{
      await refreshAccount();
      setChanges([baselineReady?'Latest match data fetched. New evidence will be applied to your current challenges automatically.':'Latest match data fetched. Baseline progress will update when the tracked game is available.']);
    }finally{
      setChecking(false);
    }
  };

  if(!planReady)return <AppShell>
    <section className="panel panel-padding">
      <div className="eyebrow">LOADING YOUR PLAYER PLAN</div>
      <h2>Checking your DNA journey…</h2>
      <p className="muted">Before the three-game baseline finishes, OP CLIMB only shows provisional coaching. Permanent DNA missions appear after the reveal.</p>
    </section>
  </AppShell>;

  if(planError)return <AppShell>
    <section className="panel panel-padding">
      <div className="eyebrow">PLAN LOAD ERROR</div>
      <h2>Your plan is still stored.</h2>
      <p className="muted">{planError}</p>
      <button className="btn secondary" type="button" onClick={()=>window.location.reload()}>RETRY PLAN LOAD</button>
    </section>
  </AppShell>;

  const tabs:DnaTab[]=[
    {id:'strand',label:'STRAND',hint:relevant.length?`${relevant.length} game${relevant.length===1?'':'s'} sequenced`:'No games yet'},
    {id:'missions',label:'MISSIONS',hint:baselineReady?`${activeTasks.length} strand mission${activeTasks.length===1?'':'s'} live`:`${Math.min(baselineGames,DNA_BASELINE_GAMES)}/${DNA_BASELINE_GAMES} baseline games`},
    {id:'habits',label:'HABITS',hint:dna.stage==='SCANNING'?'Reads from 3 games':`${flaggedCount} flagged · ${dna.habits.length-flaggedCount} watch`},
    {id:'week',label:'THIS WEEK',hint:report.status==='NOT_ENOUGH'?`${report.needed} more game${report.needed===1?'':'s'} to unlock`:`${report.wins}W ${report.losses}L · 7 days`},
    {id:'change',label:'CHANGE',locked:!pro,hint:!pro?'Long-term memory':dna.broken.length?`${dna.broken.length} habit${dna.broken.length===1?'':'s'} broken`:`${masteredAll.length} mission${masteredAll.length===1?'':'s'} mastered`},
  ];

  return <AppShell>
    <div className="dna-page">
      <header className="dna-room-banner">
        <div className="dna-room-copy">
          <div className="dna-room-kicker"><span>DNA // {viewRole}</span><i aria-hidden="true"/>{baselineReady?'MY DNA · YOUR PLAYER IDENTITY':`MY DNA · ${viewRole} PLAYER IDENTITY`}</div>
          <h1>Decode your DNA.</h1>
          <p>{baselineReady
            ?<>Game DNA is the centre of OP CLIMB. Every tracked {viewRole} game updates the evidence behind these six strands, and the habits inside them show what follows you from game to game.</>
            :<>Six strands will become your living player profile. OP CLIMB keeps them at zero until it has seen three real {viewRole} games, so your DNA is earned from evidence rather than guessed.</>}</p>
          <div className="dna-room-signals">{['FIRST READ AT 3','PATTERNS AT 5','DNA AT 10'].map((signal,i)=><span key={signal}><b>{String(i+1).padStart(2,'0')}</b>{signal}</span>)}</div>
        </div>
        <div className="dna-room-side">
          <div className="dna-room-visual" aria-hidden="true">
            <span className="dna-room-watermark">DNA</span>
            <div className="dna-room-bars">{Array.from({length:6},(_,i)=><i key={i}/>)}</div>
          </div>
          <Link className="btn primary" href="/live">{baselineReady?'PLAY NEXT GAME →':`PLAY BASELINE GAME ${Math.min(baselineGames+1,DNA_BASELINE_GAMES)} →`}</Link>
        </div>
      </header>

      <DnaRoleSwitcher role={viewRole} primaryRole={active.role} gameCounts={roleGameCounts} baselineRequired={DNA_BASELINE_GAMES} onChange={chooseRole}/>

      <DnaHud dna={dna} headline={dnaHeadline(dna)} showHistory={pro} action={<>
        <button type="button" className="dna-sync" onClick={refresh} disabled={checking}>{checking?'SYNCING…':'↻ SYNC NOW'}</button>
        {changes.map(change=><small key={change}>{change}</small>)}
      </>}/>

      <div ref={tabsTop} className="dna-tabs-anchor" aria-hidden="true"/>
      <DnaTabs tabs={tabs} active={tab} onChange={id=>openTab(id as DnaTabId)}/>

      {tab==='strand'&&<section className="glass dna-helix-wrap dna-tabpanel" id="dna-panel-strand" role="tabpanel" aria-labelledby="dna-tab-strand">
        <DnaSectionHead index={1} kicker={`${viewRole} GENOME STRAND`} title="Your strand"
          aside={relevant.length>0&&<span className="dna-mono">{strandOffset>0?`LAST ${strandGames.length} OF ${relevant.length}`:`${relevant.length} GAME${relevant.length===1?'':'S'}`} · DRAG TO ROTATE</span>}/>
        {relevant.length>0?<>
          <p className="dna-lede">Every rung is a tracked {viewRole} game, oldest on the left. Its colours are the habits that showed up in it, grouped under the DNA strand each one belongs to. Pick a habit to light it up across your games.</p>
          <DnaHelix games={strandGames} offset={strandOffset} birthEnd={Math.max(0,Math.min(DNA_WINDOW,relevant.length)-strandOffset)}
            habits={helixHabits} focus={focusHabit} onFocus={setFocusHabit} selectId={gameId}/>
          {plus&&<details className="dna-grid-toggle">
            <summary>See it as a grid</summary>
            <HabitGrid games={relevant} dna={dna}/>
          </details>}
        </>:<div className="dna-empty">
          <p>Your strand grows one rung for every tracked {viewRole} game. Your first read comes after 3.</p>
          <Link className="btn primary" href="/live">OPEN MATCH ROOM →</Link>
        </div>}
      </section>}

      {tab==='missions'&&<section className="dna-section dna-tabpanel dna-missions-panel" id="dna-panel-missions" role="tabpanel" aria-labelledby="dna-tab-missions">
        <DnaSectionHead index={2} kicker={`${viewRole} STRAND MISSIONS`} title="Your missions"/>
        {baselineReady?<>
          <NextClimbPlan response={nextClimb} loading={nextClimbLoading} tier={tier} role={viewRole}/>
          <MissionHub tasks={activeTasks} focusDomain={focusDomain} levels={dnaLevels} role={viewRole} onSelect={chooseDomain}/>
          <nav className="ip-tabs ip-tabs-optional" aria-label="Optional DNA detail">
            <button type="button" className={showProof?'active':''} onClick={()=>setShowProof(open=>!open)} aria-pressed={showProof}><b>GAME PROOF</b><small>{showProof?'hide proof':'open proof for selected mission'}</small></button>
          </nav>
          {showProof&&<div className="ip-panel">
            {displayTasks.length?<div className="ip-evidence-grid">
              {displayTasks.map(task=><EvidenceCard key={task.id} task={task} level={dnaLevels[task.dnaDomain]}/>)}
            </div>:<section className="ip-empty"><h2>No strand evidence yet.</h2><p>Complete tracked games to build the 0/3 → 3/3 mission history.</p></section>}
          </div>}
        </>:<section className="op-dna-baseline-callout panel">
          <div><span>WHAT HAPPENS NEXT</span><h2>Finish the baseline → reveal your first real fix.</h2><p>After game three, OP CLIMB turns repeated evidence into six strand missions and tells you which one to carry into the next game.</p></div>
          <Link className="btn secondary" href="/live">OPEN MATCH ROOM →</Link>
        </section>}
      </section>}

      {tab==='habits'&&<section className="dna-section dna-tabpanel" id="dna-panel-habits" role="tabpanel" aria-labelledby="dna-tab-habits">
        <DnaSectionHead index={3} kicker={dna.stage==='ESTABLISHED'?'ACTIVE HABITS':'EARLY READS'}
          title={dna.stage==='ESTABLISHED'?'Your habits':dna.stage==='PATTERNS'?'Patterns forming':'Early signals'}
          aside={shownHabits.length>0&&<span className="dna-mono">RANKED BY IMPACT</span>}/>
        {shownHabits.length>0
          ?<div className="dna-habits">{shownHabits.map((h,i)=>{
            const domain=habitDomain(h.id);
            return <HabitCard key={h.id} h={h} rank={i+1} stage={dna.stage} showTrend={pro}
              colour={HABIT_COLOURS[h.id]} strand={{label:DNA_DOMAIN_LABELS[domain],colour:DNA_DOMAIN_COLORS[domain]}}
              mission={missionStateFor(h.id)} focused={focusHabit===h.id} dimmed={!!focusHabit&&focusHabit!==h.id}
              moments={plus?recentMoments(allRoleMatches,h.id):recentMoments(allRoleMatches.slice(0,1),h.id)}
              onMakeMission={()=>makeHabitMission(h)} onOpenMission={()=>openHabitMission(h.id)} onShow={()=>showOnStrand(h.id)}/>;
          })}</div>
          :<div className="glass card dna-empty"><p>{dnaHeadline(dna)}</p></div>}
        {hiddenHabits>0&&<div className="glass card dna-upgrade">
          <div className="dna-kicker"><span>PLUS</span><i aria-hidden="true"/>LOCKED READS</div>
          <h2 className="dna-title">{hiddenHabits} more habit{hiddenHabits===1?'':'s'} in your DNA</h2>
          <p className="muted">PLUS lights every habit on your strand and adds the full weekly report and the moments to watch back from every game.</p>
          <UpgradeButton tier="PLUS"/>
        </div>}
      </section>}

      {tab==='week'&&<section className="dna-section dna-tabpanel dna-week-panel" id="dna-panel-week" role="tabpanel" aria-labelledby="dna-tab-week">
        <WeeklyReport report={report} compact={!plus}/>
        {dna.latestGame&&(dna.latestGame.showed.length+dna.latestGame.avoided.length)>0&&<div className={`glass card dna-latest ${dna.latestGame.result==='WIN'?'win':'loss'}`}>
          <div className="dna-kicker"><span>{dna.latestGame.result==='WIN'?'W':'L'}</span><i aria-hidden="true"/>LAST GAME · {dna.latestGame.champion.toUpperCase()}</div>
          <div className="dna-latest-rows">
            {dna.latestGame.avoided.map(id=><span key={id} className="avoided" style={{'--habit':HABIT_COLOURS[id]} as CSSProperties}><i aria-hidden="true"/>{HABITS[id].name}<b>AVOIDED</b></span>)}
            {dna.latestGame.showed.map(id=><span key={id} className="showed" style={{'--habit':HABIT_COLOURS[id]} as CSSProperties}><i aria-hidden="true"/>{HABITS[id].name}<b>AGAIN</b></span>)}
          </div>
        </div>}
      </section>}

      {tab==='change'&&<section className="dna-section dna-tabpanel" id="dna-panel-change" role="tabpanel" aria-labelledby="dna-tab-change">
        <DnaSectionHead index={5} kicker="LONG-TERM MEMORY" title="What has changed"/>
        {!pro?<div className="glass card dna-upgrade">
          <div className="dna-kicker"><span>PRO</span><i aria-hidden="true"/>LONG-TERM MEMORY</div>
          <h2 className="dna-title">See the habits you have broken</h2>
          <p className="muted">PRO keeps your first 10 games as your birth DNA and measures every habit against it, so you can see what you have fixed and what is creeping back — next to every strand mission you have mastered or paused.</p>
          <UpgradeButton tier="PRO"/>
        </div>:<>
          {hasChange?<div className="dna-pair">
            {dna.broken.length>0&&<div className="glass card dna-list">
              <span className="dna-label">HABITS BROKEN</span>
              {dna.broken.map(h=><p key={h.id} className="dna-line" style={{'--habit':HABIT_COLOURS[h.id]} as CSSProperties}>
                <b><i className="habit-dot" aria-hidden="true"/>{h.def.name}</b><span>{pct(h.trend!.birthRate)} → {pct(h.rate)}</span>
              </p>)}
            </div>}
            {dna.strengths.length>0&&<div className="glass card dna-list">
              <span className="dna-label">CLEAN TRAITS · RARELY HAPPENS</span>
              {dna.strengths.map(h=><p key={h.id} className="dna-line" style={{'--habit':HABIT_COLOURS[h.id]} as CSSProperties}>
                <b><i className="habit-dot" aria-hidden="true"/>{h.def.name}</b><span>{h.occurred} / {h.measured}</span>
              </p>)}
            </div>}
          </div>:<div className="glass card dna-empty">
            <p>{relevant.length>DNA_WINDOW
              ?'Nothing has moved far enough from your first 10 games yet. Keep playing and this fills in.'
              :`Your first 10 games become your birth DNA. ${Math.max(0,DNA_WINDOW+1-relevant.length)} more tracked game${DNA_WINDOW+1-relevant.length===1?'':'s'} and change starts being measured.`}</p>
          </div>}
          <section className="ip-history-grid">
            <Archive title="MASTERED" empty="Nothing mastered yet." tasks={mastered}/>
            <Archive title="PAUSED" empty="No paused missions." tasks={paused}/>
          </section>
        </>}
      </section>}

      <p className="dna-footnote">
        Every habit is counted from Riot’s own match data for each tracked game. Remakes are ignored, and a game
        only counts towards a habit when that habit could actually be measured in it. Games synced before habit
        tracking existed only count for the habits their stored stats can show.
      </p>
    </div>
  </AppShell>;
}

/**
 * The strand as a grid: one row per habit, one column per game, oldest on the left.
 * The same data as the helix, laid flat for reading row by row.
 */
function HabitGrid({games,dna}:{games:GameRecord[];dna:CareerDNA}){
  const shown=games.slice(-STRAND_GAMES);
  const offset=games.length-shown.length;
  const flagged=new Set(dna.habits.map(h=>h.id));
  const rows=[...dna.habits.map(h=>h.id),...HABIT_IDS.filter(id=>!flagged.has(id))]
    .filter(id=>shown.some(g=>typeof g.habits[id]==='number'));
  const birthEnd=Math.min(DNA_WINDOW,games.length)-offset; // columns inside the first 10
  // Open on the latest games — the ones the current read is built from.
  const scroller=useRef<HTMLDivElement>(null);
  useEffect(()=>{const el=scroller.current;if(el)el.scrollLeft=el.scrollWidth},[games.length]);

  return <div className="dna-strand-flat">
    <div className="dna-strand-scroll" ref={scroller} tabIndex={0} aria-label="Habit grid, scrolls sideways">
      <table className="dna-strand" style={{'--cols':shown.length} as CSSProperties}>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Habit</span></th>
            {shown.map((g,i)=>{
              const n=offset+i+1;
              const mark=n===3||n===5||n===10;
              return <th scope="col" key={g.id} className={`${mark?'milestone':''} ${i<birthEnd?'birth':''}`}>
                <span title={`Game ${n}: ${g.champion}, ${g.result==='WIN'?'win':'loss'}`}>{mark?n:''}</span>
              </th>;
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(id=>{
            const def=HABITS[id];
            return <tr key={id} className={flagged.has(id)?'flagged':''} style={{'--habit':HABIT_COLOURS[id]} as CSSProperties}>
              <th scope="row"><i className="habit-dot" aria-hidden="true"/>{def.name}</th>
              {shown.map((g,i)=>{
                const v=g.habits[id];
                const state=typeof v!=='number'?'na':v>=def.occursAt?'hit':'clean';
                return <td key={g.id} className={`${state} ${i<birthEnd?'birth':''}`}
                  title={`${def.name} — game ${offset+i+1} (${g.champion}): ${state==='na'?'not measurable':state==='hit'?`yes (${v})`:'no'}`}/>;
              })}
            </tr>;
          })}
          <tr className="results">
            <th scope="row">Result</th>
            {shown.map(g=><td key={g.id} className={g.result==='WIN'?'win':'loss'} title={g.result==='WIN'?'Win':'Loss'}/>)}
          </tr>
        </tbody>
      </table>
    </div>
  </div>;
}

function NextClimbPlan({response,loading,tier,role}:{response:NextClimbResponse|null;loading:boolean;tier:'FREE'|'PLUS'|'PRO';role:Role}){
  if(tier==='FREE')return <section className="next-climb panel is-locked">
    <div className="next-climb-head">
      <div><div className="eyebrow">PLUS · DNA PLAYER PLAN</div><h2>YOUR NEXT CLIMB</h2><p>Turn your six DNA strands into one clear development journey instead of guessing what to work on next.</p></div>
      <Link className="btn primary" href="/pricing">UNLOCK MY PLAYER PLAN →</Link>
    </div>
    <div className="next-climb-flow is-preview">
      {['WEAKNESS','TEACH','MISSION','EVIDENCE','MASTER','TRANSFER','RETIRE','NEXT SKILL'].map((label,index)=><span key={label}><b>{index+1}</b><small>{label}</small></span>)}
    </div>
  </section>;

  if(loading)return <section className="next-climb panel">
    <div className="eyebrow">PLUS · DNA PLAYER PLAN</div><h2>Choosing Your Next Climb…</h2><p className="muted">Checking your latest verified {role} evidence before changing the plan.</p>
  </section>;

  const plan=response?.plan;
  if(!plan)return <section className="next-climb panel">
    <div className="next-climb-head"><div><div className="eyebrow">PLUS · DNA PLAYER PLAN</div><h2>YOUR NEXT CLIMB</h2><p>{response?.message||'OP CLIMB is still building enough repeated evidence to choose the next skill honestly.'}</p></div><Link className="btn primary" href="/live">PLAY NEXT GAME →</Link></div>
  </section>;

  const state=String(plan.state||plan.phase||'TEACH').toUpperCase();
  const activeIndex=state==='COMPLETE'||plan.phase==='GRADUATED'?7:state==='TRANSFER_TEST'?5:state==='STABILISE'?4:state==='PRACTISE'?3:state==='REOPEN'?3:state==='TEACH'?2:1;
  const steps=[
    ['WEAKNESS',plan.skill],
    ['TEACH',plan.teachingPoint],
    ['MISSION','Take the rule into the next relevant game'],
    ['EVIDENCE','Only verified decision evidence counts'],
    ['MASTER','Repeat clean decisions until local mastery is stable'],
    ['TRANSFER','Prove the same principle in a genuinely new condition'],
    ['RETIRE','Retire only when the graduation gate is met'],
    ['NEXT SKILL',plan.nextSkill||'Chosen from your next strongest DNA need'],
  ] as const;
  const primaryGate=plan.gates?.find(gate=>!gate.met)??plan.gates?.at(-1)??null;

  return <section className="next-climb panel" style={strandStyle(plan.dnaDomain)}>
    <div className="next-climb-head">
      <div>
        <div className="eyebrow">PLUS · DNA PLAYER PLAN · {dnaDomainLabel(plan.dnaDomain).toUpperCase()}</div>
        <h2>YOUR NEXT CLIMB</h2>
        <p><b>{plan.skill}</b> is the current evidence-backed priority. OP CLIMB keeps this objective active until the learning gate says it is genuinely ready to move on.</p>
      </div>
      <div className="next-climb-state"><span>{clean(state)}</span><strong>{Math.max(0,Math.min(100,Math.round(plan.completion||0)))}%</strong><small>CURRICULUM COMPLETE</small></div>
    </div>

    <div className="next-climb-focus">
      <article><span>CURRENT WEAKNESS</span><strong>{plan.skill}</strong><p>{plan.whyNow}</p></article>
      <article className="primary"><span>TEACHING POINT</span><strong>ONE RULE</strong><p>{plan.teachingPoint}</p></article>
      <article><span>NEXT PROOF GATE</span><strong>{primaryGate?.label||'Keep building verified evidence'}</strong><p>{primaryGate?.evidence||plan.evidence}</p></article>
    </div>

    <div className="next-climb-flow" aria-label="Your Next Climb learning path">
      {steps.map(([label,detail],index)=><div key={label} className={index<activeIndex?'done':index===activeIndex?'active':'future'}>
        <i>{index<activeIndex?'✓':index+1}</i><span>{label}</span><small>{detail}</small>
      </div>)}
    </div>

    <div className="next-climb-bottom">
      <div><span>{plan.transferTest.active?'TRANSFER TEST ACTIVE':'HOW THIS SKILL ENDS'}</span><b>{plan.transferTest.active?'Apply the same principle without relying on the original cue.':plan.retireWhen}</b></div>
      <div><span>AFTER THIS</span><b>{plan.nextSkill?plan.nextSkill:'OP CLIMB chooses the next DNA priority from fresh evidence.'}</b></div>
      <Link className="btn primary" href="/live">{plan.transferTest.active?'TAKE THE TRANSFER TEST →':'TAKE THIS INTO MY NEXT GAME →'}</Link>
    </div>
    <small className="next-climb-boundary">{response?.boundary}</small>
  </section>;
}

function MissionHub({tasks,focusDomain,levels,role,onSelect}:{tasks:ILPTask[];focusDomain:DnaDomain|null;levels:Record<DnaDomain,ReturnType<typeof dnaStrandLevel>>;role:Role;onSelect:(domain:DnaDomain)=>void}){
  const focusPair=gameMissionFocusPair(tasks,role);
  const focusIds=new Map(focusPair.map((item,index)=>[item.task.id,index+1]));
  const focusTask=focusDomain?tasks.find(task=>task.dnaDomain===focusDomain)??null:null;
  return <section className="dna-mission-hub" aria-label={role+' Game DNA missions'}>
    <div className="dna-mission-hub-head">
      <div>
        <div className="eyebrow">YOUR 6 DNA STRANDS · PLAYER PLAN</div>
        <h2>One primary Climb. Two live missions. Six strands developing.</h2>
        <p>OP CLIMB ranks the evidence and highlights the most important DNA skill as Your Next Climb. Your two unlocked trees can still bank progress in each tracked {role} game while all six strands keep developing over time.</p>
      </div>
      <div className="dna-mission-how" aria-label="How missions work">
        <span><b>1</b><small>DO</small><em>one clear behaviour</em></span>
        <span><b>2</b><small>PROVE</small><em>bank it in tracked games</em></span>
        <span><b>3</b><small>MASTER</small><em>local mastery → transfer test</em></span>
      </div>
    </div>

    <div className="dna-mission-rail" aria-label="Choose a DNA mission">
      {DNA_DOMAINS.map(domain=>{
        const task=tasks.find(item=>item.dnaDomain===domain);
        if(!task)return <div key={domain} className="dna-mission-chip empty" style={strandStyle(domain)}><small>{DNA_DOMAIN_LABELS[domain]}</small><b>Building mission…</b></div>;
        const plain=plainLanguageFocus(task);
        const summary=missionSummary(task);
        return <button
          key={domain}
          type="button"
          className={'dna-mission-chip '+(focusDomain===domain?'active':'')}
          style={strandStyle(domain)}
          onClick={()=>onSelect(domain)}
          aria-pressed={focusDomain===domain}
        >
          <small>{DNA_DOMAIN_LABELS[domain]} · LV {levels[domain].level}{focusIds.has(task.id)?` · UNLOCKED ${focusIds.get(task.id)}/2`:''}</small>
          <b>{plain.name}</b>
          <span>{focusIds.has(task.id)?'UNLOCKED · ':''}{summary.confirmed}/{summary.required} proven</span>
        </button>;
      })}
    </div>

    {focusTask?<MissionSpotlight task={focusTask} level={levels[focusTask.dnaDomain]} role={role}/>:<div className="dna-mission-spotlight empty">
      <div><span>MISSION BUILDING</span><h3>Your next mission will appear here.</h3><p>Play another tracked {role} game so OP CLIMB can attach a measurable behaviour to this strand.</p></div>
    </div>}
  </section>;
}

function MissionSpotlight({task,level,role}:{task:ILPTask;level:ReturnType<typeof dnaStrandLevel>;role:Role}){
  const plain=plainLanguageFocus(task);
  const summary=missionSummary(task);
  const repProgress=Math.round(Math.min(summary.required,summary.confirmed)/Math.max(1,summary.required)*100);
  return <article className="dna-mission-spotlight" style={strandStyle(task.dnaDomain)}>
    <div className="dna-mission-spotlight-top">
      <div>
        <span>{dnaDomainLabel(task.dnaDomain).toUpperCase()} · LV {level.level} · YOUR MISSION</span>
        <h2>{plain.name}</h2>
      </div>
      <div className="dna-mission-count"><b>{summary.confirmed}/{summary.required}</b><small>PROVEN GAMES</small></div>
    </div>

    <div className="dna-mission-explain">
      <section><span>WHAT THIS MEANS</span><p>{plain.meaning}</p></section>
      <section className="primary"><span>YOUR JOB NEXT GAME</span><p>{plain.nextGame}</p></section>
      <section><span>WHY IT MATTERS</span><p>{plain.why}</p></section>
      <section><span>HOW YOU PROVE IT</span><p>{plain.success}</p></section>
    </div>

    <div className="dna-mission-proof">
      <div>
        <span>MISSION PROGRESS</span>
        <AnimatedBar value={repProgress}/>
        <small>{summary.remaining?summary.remaining+' more proven '+role+' game'+(summary.remaining===1?'':'s')+' needed':'Mastery reached — the next strand mission can unlock.'}</small>
      </div>
      <Pips passes={summary.confirmed} required={summary.required}/>
      <Link className="btn primary" href="/live">TAKE THIS INTO MY NEXT GAME →</Link>
    </div>
  </article>;
}

function MissionCard({task,level}:{task:ILPTask;level:ReturnType<typeof dnaStrandLevel>}){
  const plain=plainLanguageFocus(task);
  const summary=missionSummary(task);
  const repProgress=Math.round(Math.min(summary.required,summary.confirmed)/Math.max(1,summary.required)*100);
  return <article className="ip-mission primary" style={strandStyle(task.dnaDomain)}>
    <div className="ip-mission-top">
      <span>{dnaDomainLabel(task.dnaDomain).toUpperCase()} · LV {level.level} · DNA MISSION</span>
      <div className="ip-mission-meta"><MissionMeasurementBadge metric={task.metric} compact/><em>{dnaDomainLabel(task.dnaDomain)} · {clean(task.category)}</em></div>
    </div>
    <h2>{plain.name}</h2>
    <div className="ip-layman">
      <span>WHAT THIS MEANS</span>
      <p>{plain.meaning}</p>
    </div>

    <div className="ip-rule">
      <span>YOUR JOB NEXT GAME</span>
      <b>{plain.nextGame}</b>
    </div>

    <div className="ip-target">
      <div><span>HOW YOU PASS</span><b>{plain.success}</b></div>
      <div><span>YOU ARE LEARNING TO</span><b>{learningStageLabel(summary.stage)}</b></div>
    </div>

    <LearningPath stage={summary.stage}/>

    <div className="ip-progress">
      <div><AnimatedBar value={repProgress}/><b>{repProgress}%</b></div>
      <Pips passes={summary.confirmed} required={summary.required}/>
      <small>{summary.confirmed}/{summary.required} games completed · {summary.remaining?summary.remaining+' more clean game'+(summary.remaining===1?'':'s')+' needed':'mission complete'}</small>
    </div>

    <div className="ip-xp-reward"><span>MISSION REWARD</span><b>+{XP_PER_MISSION_MASTERY} XP</b><small>when mastered · +{XP_PER_PROVEN_REP} XP per proven game</small></div>
    <details className="ip-mission-details">
      <summary>BREAK IT DOWN <span>WHY · WHAT · HOW YOU PASS</span></summary>
      <div className="ip-mission-brief">
        <section>
          <span>01 · WHY THIS ONE</span>
          <h3>Why it matters</h3>
          <p>{plain.why}</p>
        </section>
        <section>
          <span>02 · WHAT TO DO</span>
          <h3>Remember one thing</h3>
          <p>{plain.nextGame}</p>
        </section>
        <section>
          <span>03 · HOW YOU PASS</span>
          <h3>{plain.success}</h3>
          <p>Each tracked game that clears the target banks one completion. Reach {summary.required}/{summary.required} and this mission is mastered. Your {dnaDomainLabel(task.dnaDomain)} level is uncapped: {level.xpIntoLevel}/{level.xpForNextLevel} DNA XP toward LV {level.level+1}.</p>
        </section>
        <section>
          <span>04 · WHY IT IS STILL ACTIVE</span>
          <h3>{summary.remaining?`${summary.remaining} proven rep${summary.remaining===1?'':'s'} still needed`:'Ready for a mastery check'}</h3>
          <p>{task.lastUpdatedReason||task.evidence.at(-1)||'OP CLIMB is waiting for enough reliable match evidence to judge the pattern.'}</p>
        </section>
      </div>
      <IlpExplainability task={task}/>
    </details>
  </article>;
}

function learningStageLabel(stage:string){
  if(stage==='DISCOVER')return'RECOGNISE THE SITUATION';
  if(stage==='PRACTISE')return'EXECUTE THE DECISION';
  if(stage==='REPEAT')return'REPEAT IT CONSISTENTLY';
  if(stage==='MASTERED')return'HABIT MASTERED';
  return clean(stage);
}

function proofClock(seconds:number){
  const safe=Math.max(0,Math.round(Number(seconds)||0));
  const minutes=Math.floor(safe/60);
  return minutes+':'+String(safe%60).padStart(2,'0');
}

function attemptMeaning(outcome:string,banksPass:boolean){
  if(banksPass)return'You performed the behaviour strongly enough for this game to count toward mastery.';
  if(outcome==='NO_REP')return'The relevant situation was not observed clearly enough, so the game does not count against you.';
  if(outcome==='UNREWARDED')return'The situation occurred, but the behaviour did not clear the mission target this time.';
  if(outcome==='UNEARNED')return'The end result looked acceptable, but the decision evidence was not strong enough to bank the habit.';
  return'This game gave useful evidence, but not a proven rep.';
}

function LearningPath({stage}:{stage:string}){
  const stages=[
    ['DISCOVER','RECOGNISE'],
    ['PRACTISE','EXECUTE'],
    ['REPEAT','REPEAT'],
    ['MASTERED','MASTERED'],
  ] as const;
  const active=Math.max(0,stages.findIndex(([key])=>key===stage));
  return <div className="ip-learning-path">
    <div><span>LEARNING PATH</span><b>{active+1}/4</b></div>
    <ol>{stages.map(([key,label],index)=><li key={key} className={index<active?'done':index===active?'active':''}><i>{index<active?'✓':index+1}</i><span>{label}</span></li>)}</ol>
  </div>;
}

function EvidenceCard({task,level}:{task:ILPTask;level:ReturnType<typeof dnaStrandLevel>}){
  const summary=missionSummary(task);
  const recent=(task.missionHistory??[]).slice(-4).reverse();
  return <article className="ip-evidence-card" style={strandStyle(task.dnaDomain)}>
    <div className="ip-evidence-head">
      <div><span>{dnaDomainLabel(task.dnaDomain).toUpperCase()} · LV {level.level} · DNA MISSION</span><h2>{plainLanguageFocus(task).name}</h2><MissionMeasurementBadge metric={task.metric} compact/></div>
      <b>{summary.stage}</b>
    </div>
    <IlpExplainability task={task}/>
    <div className="ip-evidence-reason">
      <span>LATEST READ</span>
      <p>{task.lastUpdatedReason||'Evidence is still building.'}</p>
    </div>
    {recent.length>0?<div className="ip-rep-list">
      {recent.map(rep=>{
        const proof=rep.evidenceV2;
        const state=verifiedMissionRep(task,rep)?'BANKED':proof?.state==='MISSED'?'MISSED':'NOT_OBSERVED';
        const stateClass=state==='BANKED'?'good':'watch';
        return <div key={rep.matchId}>
          <span className={stateClass}>{clean(state)}</span>
          <b>{proof?.observedValueLabel||clean(rep.outcome)}</b>
          <small>{proof?proof.measurementSource.replaceAll('_',' ')+' · '+proof.confidence+' confidence':clean(rep.adherence)+' adherence'}</small>
          {proof&&<details className="ip-mission-details">
            <summary>SHOW THE PROOF <span>{proof.opportunities} {proof.opportunities===1?'opportunity':'opportunities'} · {proof.successes} {proof.successes===1?'success':'successes'} · {proof.misses} {proof.misses===1?'miss':'misses'}</span></summary>
            <div className="ip-mission-brief">
              <section>
                <span>RESULT</span>
                <h3>{clean(proof.state)}</h3>
                <p>{proof.observedValueLabel} against {proof.targetLabel}. {proof.reason}</p>
              </section>
              <section>
                <span>EVIDENCE SOURCE</span>
                <h3>{proof.measurementSource.replaceAll('_',' ')}</h3>
                <p>{proof.confidence} confidence · reconstructed from {proof.reconstruction.fields.join(' + ')||'the recorded match evidence'}.</p>
              </section>
              <section>
                <span>RECORDED MOMENTS</span>
                <h3>{proof.events.length?proof.events.length+' proof point'+(proof.events.length===1?'':'s'):'No valid opportunity observed'}</h3>
                {proof.events.length?proof.events.map((event,index)=><p key={index}><b>{typeof event.atSeconds==='number'?proofClock(event.atSeconds)+' · ':''}{event.label}</b> — {event.detail}</p>):<p>This game stays neutral. It does not add a pass or a failure to the mission.</p>}
              </section>
              <section>
                <span>RECONSTRUCTION</span>
                <h3>How OP CLIMB reached the result</h3>
                <p>{proof.reconstruction.formula}</p>
              </section>
            </div>
          </details>}
        </div>;
      })}
    </div>:<div className="ip-no-reps">No tracked games have created proof for this strand mission yet.</div>}
  </article>;
}

function Archive({title,empty,tasks}:{title:string;empty:string;tasks:ILPTask[]}){
  return <article className="ip-archive">
    <div className="ip-archive-head"><span>{title}</span><b>{tasks.length}</b></div>
    {tasks.length?<div>{tasks.map(task=><details key={task.id} className="ip-strand-history" style={strandStyle(task.dnaDomain)}>
      <summary><b>{plainLanguageFocus(task).name}</b><span>{dnaDomainLabel(task.dnaDomain)} · {clean(task.category)}</span></summary>
      <p>{task.lastUpdatedReason||task.evidence.at(-1)||'No additional evidence note.'}</p>
      {task.status==='MASTERED'&&<IlpExplainability task={task} compact/>}
    </details>)}</div>:<p className="muted">{empty}</p>}
  </article>;
}

function dedupeArchiveTasks(tasks:ILPTask[]){
  const map=new Map<string,ILPTask>();
  tasks.forEach(task=>{
    const key=task.title.toLowerCase()+'|'+task.metric.toLowerCase()+'|'+task.dnaDomain;
    const prev=map.get(key);
    if(!prev||taskFreshness(task)>=taskFreshness(prev))map.set(key,task);
  });
  return [...map.values()];
}

function Pips({passes,required}:{passes:number;required:number}){
  return <div className="ip-pips" aria-label={passes+' of '+required+' clean reps'}>
    {Array.from({length:required},(_,index)=><i key={index} className={index<passes?'on':''}/>)}
  </div>;
}