'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import type {CSSProperties} from 'react';
import {AppShell} from '@/components/AppShell';
import {ArenaHeroArtwork} from '@/components/ArenaHeroArtwork';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {MissionMeasurementBadge} from '@/components/MissionMeasurementBadge';
import {ArenaDomainIcon} from '@/components/ArenaIcon';
import {MissionFlowVerification} from '@/components/MissionFlowVerification';
import {DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import type {DnaDomain} from '@/lib/types';
import {DNA_BASELINE_GAMES,dnaBaselineGameCount,dnaBaselineReady} from '@/lib/dnaGrowth';
import {currentGameDnaMissions,gameMissionFocusPair,gameDnaFocusSource,missionRepView} from '@/lib/gameDnaSnapshot';
import {missionSummary} from '@/lib/missionLoop';
import {missionComparisonForMatch} from '@/lib/missionComparison';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {canonicalLeagueRole,taskAppliesToRole} from '@/lib/roleAwareLearning';
import {dnaStrandLevel} from '@/lib/dnaLevel';

export default function Missions(){
  const {active}=useAccount();
  const {tasks,allTasks,planReady,planError,setDnaFocusDomains}=useLearningPlan();
  const [selectedDomain,setSelectedDomain]=useState<DnaDomain|null>(null);
  const [swapTarget,setSwapTarget]=useState<DnaDomain|null>(null);
  const [saveMessage,setSaveMessage]=useState('');
  const [saving,setSaving]=useState(false);
  const [showAllTrees,setShowAllTrees]=useState(false);
  const matches=matchesFor(active.id).filter(match=>match.durationSeconds>=300&&canonicalLeagueRole(match.role)===active.role);
  const baselineGames=dnaBaselineGameCount(matches,active.role);
  const baselineReady=dnaBaselineReady(baselineGames);
  const roleTasks=(allTasks[active.id]??tasks).filter(task=>taskAppliesToRole(task,active.role));
  const missions=currentGameDnaMissions(roleTasks,active.role);
  const fallbackPair=baselineReady?gameMissionFocusPair(roleTasks,active.role):[];
  const focusSource=gameDnaFocusSource(roleTasks,active.role);
  const playerConfirmed=focusSource==='PLAYER';
  const persistedDomains=useMemo(()=>{
    const direct=missions.filter(row=>row.task?.dnaFocusUnlocked===true).map(row=>row.domain);
    return direct.length===2?direct:fallbackPair.map(row=>row.domain);
  },[missions.map(row=>row.task?.id+':'+String(row.task?.dnaFocusUnlocked)).join('|'),fallbackPair.map(row=>row.domain).join('|')]);

  useEffect(()=>{setSelectedDomain(current=>current??persistedDomains[0]??missions[0]?.domain??null)},[persistedDomains.join('|'),active.id,active.role]);

  const latestMatch=[...matches].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
  const selectedMission=missions.find(row=>row.domain===selectedDomain)??missions[0];
  async function confirmRecommended(){
    if(persistedDomains.length!==2||saving)return;
    setSaving(true);
    setSaveMessage('Saving your two chosen missions…');
    try{
      const saved=await setDnaFocusDomains(persistedDomains);
      setSaveMessage(saved
        ?'Your two missions are saved to your account. Next: take them into a tracked match.'
        :'Could not save your choice. Your recommended missions remain visible. Please try again.');
    }finally{setSaving(false)}
  }

  async function requestUnlock(domain:DnaDomain){
    setSelectedDomain(domain);
    setShowAllTrees(true);
    if(saving)return;
    if(persistedDomains.includes(domain)){
      setSwapTarget(null);
      setSaveMessage(playerConfirmed?`${DNA_DOMAIN_LABELS[domain]} is already one of your confirmed trees. Choose a locked tree to swap it.`:'This tree is recommended, but not yet player-confirmed. Use CONFIRM THESE TWO above, or swap a tree first.');
      return;
    }
    if(persistedDomains.length<2){
      const next=[...persistedDomains,domain];
      if(next.length===2){
        setSaveMessage('Saving your two DNA tree choices…');
        setSaving(true);
        const saved=await setDnaFocusDomains(next).finally(()=>setSaving(false));
        if(saved){
        setSwapTarget(null);
        setSaveMessage(`${DNA_DOMAIN_LABELS[domain]} is now saved as an active mission. Your two missions appear above the trees.`);
        }else{setSaveMessage('We could not save your DNA selection. Your previous missions are still active. Please retry.')}
      }else{
        setSaveMessage('Choose one more DNA tree to complete your two active missions.');
      }
      return;
    }
    setSwapTarget(domain);
    setSaveMessage(`Unlock ${DNA_DOMAIN_LABELS[domain]}: choose which active tree to replace on this card.`);
  }

  async function replaceActiveTree(replaceDomain:DnaDomain){
    if(!swapTarget||saving)return;
    const next=persistedDomains.filter(domain=>domain!==replaceDomain).concat(swapTarget);
    if(next.length!==2){setSaveMessage('Could not build a valid two-tree selection. Refresh and try again.');return}
    const incoming=swapTarget;
    setSaveMessage('Saving your active mission choices…');
    setSaving(true);
    const ok=await setDnaFocusDomains(next).finally(()=>setSaving(false));
    if(ok){
      setSelectedDomain(incoming);
      setSwapTarget(null);
      setSaveMessage(`Saved: ${DNA_DOMAIN_LABELS[incoming]} is an active mission. ${DNA_DOMAIN_LABELS[replaceDomain]} is locked. Your missions are shown above.`);
    }else{
      setSaveMessage('Could not save that swap. Your previous two missions remain selected. Please try again.');
    }
  }

  return <AppShell><main className="missions-page">
    <header className="missions-head arena-visual-arthead arena-visual-missions"><ArenaHeroArtwork champion={active.champions?.[0]||"Jinx"} tag="YOUR MAIN" />
      <div>
        <div className="eyebrow">LEAGUE · {active.role} · GAME DNA</div>
        <h1>Your mission. Your next move.</h1>
        <p>Two coaching focuses. Clear actions for your next game. Real proof afterwards. You can explore all six Game DNA areas whenever you want.</p>
      </div>
      <div className="missions-head-actions"><span>{baselineReady?(playerConfirmed?'MISSIONS CONFIRMED':'YOUR COACH HAS 2 SUGGESTIONS'):'BASELINE IN PROGRESS'}</span><Link className="btn secondary" href="/ilp">EXPLORE GAME DNA →</Link></div>
    </header>

    {!planReady?<section className="panel panel-padding"><div className="eyebrow">LOADING MISSIONS</div><h2>Checking your current plan…</h2></section>:
    planError?<section className="panel panel-padding"><div className="eyebrow">PLAN LOAD ERROR</div><h2>Your missions could not be loaded.</h2><p>{planError}</p><button className="btn secondary" type="button" onClick={()=>window.location.reload()}>RETRY</button></section>:
    !baselineReady?<section className="panel panel-padding missions-baseline"><div className="eyebrow">STEP 1 OF 3 · BUILD YOUR GAME DNA</div>
    <h2>Your next job: play {DNA_BASELINE_GAMES-baselineGames} more tracked {active.role} game{DNA_BASELINE_GAMES-baselineGames===1?'':'s'}.</h2>
    <p>Play as normal. We need {DNA_BASELINE_GAMES} tracked games in the same role before coaching missions can be based on your play. You're at {baselineGames}/{DNA_BASELINE_GAMES}.</p>
    <div className="mission-simple-baseline-steps"><span><b>1 · NOW</b> Play a tracked game</span><span><b>2 · NEXT</b> Reveal your six Game DNA areas</span><span><b>3 · THEN</b> Confirm two coaching missions</span></div><div className="missions-track" role="progressbar" aria-label="DNA baseline games" aria-valuenow={baselineGames} aria-valuemin={0} aria-valuemax={DNA_BASELINE_GAMES}><span style={{width:`${baselineGames/DNA_BASELINE_GAMES*100}%`}}/></div><Link className="btn primary" href="/live">OPEN MATCH ROOM →</Link></section>:
    <section className="missions-tree-workspace">
      <section className="mission-next-action" aria-label="Your next coaching step">
        <div className="mission-next-eyebrow"><span className="mission-next-live-dot" /> YOUR NEXT STEP · {playerConfirmed?'READY TO PLAY':'ONE CHOICE TO MAKE'}</div>
        <div className="mission-next-layout">
          <div className="mission-next-main">
            <h2>{playerConfirmed?'PLAY YOUR NEXT GAME WITH THESE TWO JOBS':'CONFIRM YOUR TWO COACHING MISSIONS'}</h2>
            <p>{playerConfirmed
              ?'Both missions are saved. Read the two actions below, then play one tracked game. After the match, OP CLIMB checks what the evidence actually shows.'
              :'Your coach has suggested two areas based on your games. Read the actions below. Keep both, or choose another one. Nothing is marked as your personal choice until you confirm.'}</p>
            {playerConfirmed
              ?<Link href="/live" className="btn primary mission-next-cta">OPEN MATCH ROOM →</Link>
              :<div className="mission-next-buttons"><button className="btn primary mission-next-cta" type="button" onClick={()=>void confirmRecommended()} disabled={saving||persistedDomains.length!==2}>{saving?'SAVING…':'YES — CONFIRM THESE TWO →'}</button><button className="btn secondary" type="button" onClick={()=>setShowAllTrees(true)}>CHANGE A MISSION</button></div>}
          </div>
          <ol className="mission-next-steps">
            <li className={playerConfirmed?'is-complete':'is-current'}><b>{playerConfirmed?'✓':'01'}</b><span><strong>CHOOSE</strong><small>{playerConfirmed?'You confirmed your two missions':'Read both missions and confirm'}</small></span></li>
            <li className={playerConfirmed?'is-current':''}><b>02</b><span><strong>PLAY</strong><small>Practise the actions in one tracked game</small></span></li>
            <li><b>03</b><span><strong>REVIEW</strong><small>See what was proven, missed or not observed</small></span></li>
          </ol>
        </div>
      </section>

      <section className="missions-active-strip" aria-label="Two missions for your next game">
        <header>
          <div>
            <span className="eyebrow">{playerConfirmed?'YOUR SAVED COACHING PLAN':'SUGGESTED BY YOUR COACH · NOT CONFIRMED YET'}</span>
            <h2>{playerConfirmed?'YOUR TWO MISSIONS FOR NEXT GAME':'THESE ARE YOUR TWO SUGGESTED MISSIONS'}</h2>
            <p>{playerConfirmed?'Focus on the actions. Progress is awarded only when real match evidence supports it.':'You can accept these suggestions or change one before playing.'}</p>
          </div>
          <span className="mission-confirm-status">{playerConfirmed?'✓ SAVED TO YOUR ACCOUNT':'CONFIRM YOUR CHOICE ABOVE'}</span>
        </header>
        <div className="missions-active-grid">{persistedDomains.map((domain,index)=>{
          const task=missions.find(row=>row.domain===domain)?.task;
          const plain=task?plainLanguageFocus(task):null;
          const proof=task?missionSummary(task):null;
          return <button type="button" key={domain} className="missions-active-item" style={{'--mission-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties} onClick={()=>{setSelectedDomain(domain);setShowAllTrees(true)}}>
            <span className="missions-active-id"><ArenaDomainIcon domain={domain} size={24}/><b>MISSION {index+1} · {DNA_DOMAIN_LABELS[domain]}</b></span>
            <strong>{plain?.name||task?.title||'Mission loading'}</strong>
            <span className="mission-active-tag">DO THIS IN YOUR NEXT GAME</span>
            <span className="mission-active-instruction">{plain?.nextGame||task?.gameRule||'Your coach will show your action when your plan loads.'}</span>
            <span className="mission-active-proof-label">HOW PROGRESS IS CHECKED</span>
            <span className="mission-active-proof">{plain?.success||task?.target||'OP CLIMB needs verifiable game evidence.'}</span>
            <span className="missions-active-evidence"><span>{proof?proof.confirmed+'/'+proof.required+' PROVEN GAMES':'WAITING FOR EVIDENCE'}</span><b>FULL DETAILS ↗</b></span>
          </button>;
        })}{persistedDomains.length!==2&&<div className="missions-active-unavailable"><strong>YOUR TWO MISSIONS ARE NOT READY YET</strong><p>Choose your priorities from the six areas below, then save them.</p><button type="button" className="btn primary" onClick={()=>setShowAllTrees(true)}>CHOOSE MY MISSIONS →</button></div>}</div>
      </section>

      {saveMessage&&<div className="missions-focus-message" role="status" aria-live="polite">{saveMessage}</div>}

      <section className="mission-after-game" aria-labelledby="mission-after-title">
        <span className="mission-after-icon" aria-hidden="true">↳</span>
        <div><span className="eyebrow">AFTER YOUR NEXT TRACKED GAME</span><h2 id="mission-after-title">WE CHECK THE EVIDENCE. YOU GET YOUR NEXT JOB.</h2>
          <p><b>PROVEN</b> means the tracked game supports your behaviour. <b>MISSED</b> means it did not meet the goal. <b>NOT OBSERVED</b> means there wasn't enough evidence — no made-up progress. When you earn the required verified games, your coaching moves to the next challenge.</p></div>
      </section>

      <section className="mission-library" aria-label="Explore and switch Game DNA missions">
        <button className="mission-library-toggle" type="button" aria-expanded={showAllTrees} onClick={()=>setShowAllTrees(current=>!current)}>
          <span><small>OPTIONAL · CHANGE OR EXPLORE</small><strong>{showAllTrees?'HIDE THE SIX DNA AREAS':'VIEW ALL 6 DNA AREAS / CHANGE A MISSION'}</strong><em>Your two chosen areas are highlighted. The others stay measured.</em></span>
          <b aria-hidden="true">{showAllTrees?'−':'＋'}</b>
        </button>
        {showAllTrees&&<>
          <div className="missions-tree-toolbar panel">
            <div><div className="eyebrow">YOUR SIX GAME DNA AREAS</div><h2>Choose which two to work on.</h2><p>Pick a different area to swap one of your active missions. Locked areas still track your performance.</p></div>
            <div className="missions-tree-save"><span className={persistedDomains.length===2?'ready':'not-ready'}>{persistedDomains.length}/2 {playerConfirmed?'CONFIRMED':'SUGGESTED'}</span><small>{saving?'Saving to your account…':'Confirm or swap to save'}</small></div>
          </div>
      <div className="missions-six-grid">
        {missions.map(({domain,task})=>{
          const style={'--mission-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties;
          const unlocked=persistedDomains.includes(domain);
          const level=dnaStrandLevel(roleTasks,domain,active.role);
          const plain=task?plainLanguageFocus(task):null;
          const summary=task?missionSummary(task):null;
          const rep=task?missionRepView(task):null;
          const comparison=task?missionComparisonForMatch(task,latestMatch?.id):null;
          return <article key={domain} className={`missions-tree-card ${unlocked?'unlocked':'locked'} ${selectedDomain===domain?'selected':''}`} style={style}>
            <button className="missions-tree-open" type="button" onClick={()=>setSelectedDomain(domain)} aria-label={`Open ${DNA_DOMAIN_LABELS[domain]} mission details`}>
              <div className="missions-tree-top">
                <div><span className="arena-mission-symbol"><ArenaDomainIcon domain={domain} size={25}/>{DNA_DOMAIN_LABELS[domain].toUpperCase()}</span><b>LV {level.level}</b></div>
                <strong>{unlocked?(playerConfirmed?'PLAYER CHOSEN':'RECOMMENDED'):'LOCKED'}</strong>
              </div>
              <div className="missions-tree-level"><i style={{width:`${level.levelProgress}%`}}/></div>
              <h3>{plain?.name??'Mission building'}</h3>
              <p className="missions-tree-meaning">{plain?.meaning??'OP CLIMB is still collecting enough evidence to create a reliable mission for this strand.'}</p>
              <div className="missions-tree-job"><span>CURRENT MISSION</span><p>{plain?.nextGame??'Keep playing tracked games so this strand can become measurable.'}</p></div>
              <div className="missions-tree-proof">
                <div><span>PROVEN</span><b>{summary?`${summary.confirmed}/${summary.required}`:'—'}</b></div>
                <div><span>LATEST</span><b>{comparison?.result??'NOT OBSERVED'}</b></div>
              </div>
              <div className="missions-switch-track"><i style={{width:`${rep?.progress??0}%`}}/></div>
            </button>
            <button className={`missions-tree-toggle ${unlocked?'on':''}`} type="button" onClick={()=>requestUnlock(domain)}>
              <span>{unlocked?(playerConfirmed?'ACTIVE DNA TREE':'RECOMMENDED TREE'):'UNLOCK THIS TREE'}</span><b>{unlocked?'✓':'＋'}</b>
            </button>
            {swapTarget===domain&&!unlocked&&<div className="missions-tree-swap">
              <span>YOU ALREADY HAVE 2 ACTIVE TREES</span>
              <b>Which one should this replace?</b>
              <div>{persistedDomains.map(activeDomain=><button key={activeDomain} type="button" onClick={()=>replaceActiveTree(activeDomain)}>REPLACE {DNA_DOMAIN_LABELS[activeDomain].toUpperCase()}</button>)}</div>
              <button className="missions-tree-swap-cancel" type="button" onClick={()=>{setSwapTarget(null);setSaveMessage('')}}>CANCEL</button>
            </div>}
          </article>;
        })}
      </div>

      {selectedMission&&(()=>{
        const {domain,task}=selectedMission;
        const style={'--mission-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties;
        const unlocked=persistedDomains.includes(domain);
        if(!task)return null;
        const plain=plainLanguageFocus(task);
        const summary=missionSummary(task);
        const rep=missionRepView(task);
        const comparison=missionComparisonForMatch(task,latestMatch?.id);
        const level=dnaStrandLevel(roleTasks,domain,active.role);
        return <article className="panel missions-focus-card" style={style}>
          <div className="missions-focus-top">
            <div><span>{DNA_DOMAIN_LABELS[domain].toUpperCase()} · LV {level.level} · {unlocked?(playerConfirmed?'PLAYER CHOSEN':'RECOMMENDED'):'LOCKED'}</span><small>{unlocked?(playerConfirmed?'Player-confirmed priority for your next tracked game':'Coach suggestion. Confirm this pair to make it your chosen plan.'):'Fully measured, but progression is locked until you choose this as one of your two active trees'}</small></div>
            <MissionMeasurementBadge metric={task.metric} compact/>
          </div>
          <div className="missions-focus-main">
            <div className="missions-focus-copy">
              <h2>{plain.name}</h2><p className="missions-meaning">{plain.meaning}</p>
              <div className="missions-job"><span>YOUR JOB WHEN THIS TREE IS ACTIVE</span><strong>{plain.nextGame}</strong></div>
            </div>
            <aside className="missions-focus-proof">
              <div className="missions-progress-head"><span>PROVEN GAMES</span><strong>{summary.confirmed}/{summary.required}</strong></div>
              <div className="missions-track"><span style={{width:`${rep.progress}%`}}/></div>
              <p className="missions-progress-note">{summary.remaining?`${summary.remaining} more proven game${summary.remaining===1?'':'s'} to master this mission.`:'Mastery target reached. The next mission on this tree will follow.'}</p>
              <div className="missions-evidence"><span>LATEST GAME</span><strong>{comparison.result}</strong><small>{comparison.detail}</small></div>
              {comparison.events.length>0&&<div className="missions-specific-proof">{comparison.events.map((event,index)=><div key={index}><b>{event.clock}</b><span>{event.label}</span><small>{event.detail}</small></div>)}</div>}
            </aside>
          </div>
          <div className="missions-focus-actions">
            <Link href={`/ilp?dna=${domain}`} className="btn secondary">OPEN TREE DETAILS →</Link>
            {unlocked?<Link href="/live" className="btn primary">TAKE THIS MISSION INTO MATCH ROOM →</Link>:<button className="btn primary" type="button" onClick={()=>requestUnlock(domain)}>UNLOCK THIS TREE</button>}
          </div>
        </article>;
      })()}
        </>}
      </section>
      <details className="mission-advanced-check"><summary>OPTIONAL · CHECK COMPANION AND MISSION TRACKING <span>+</span></summary><MissionFlowVerification/></details>
    </section>}
  </main></AppShell>;
}
