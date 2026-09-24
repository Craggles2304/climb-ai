'use client';

import {useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {AnimatedBar,AnimatedRing} from '@/components/Motion';
import {TrackView} from '@/components/TrackView';
import {FirstRun} from '@/components/FirstRun';
import {LiveGameCard} from '@/components/LiveGameCard';
import {ErrorBoundary} from '@/components/ErrorState';
import {missionEvidence} from '@/lib/missionLoop';
import {coachingLevelFor} from '@/lib/coachingLevel';
import {track} from '@/lib/analytics';
import {IlpExplainability} from '@/components/IlpExplainability';
import {TierUpgradePrompt} from '@/components/TierUpgradePrompt';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';

export default function Home(){
  const {active,isEmpty,profile}=useAccount();
  const matches=matchesFor(active.id);
  const {tasks}=useLearningPlan();
  const detail=coachingLevelFor(active.rank);
  const [feedback,setFeedback]=useState<'yes'|'no'|null>(null);
  const activeTasks=tasks.filter(t=>t.status!=='MASTERED'&&t.status!=='PAUSED').slice(0,5);
  const leadTask=activeTasks[0];
  const leadPlain=leadTask?plainLanguageFocus(leadTask):null;
  const last=matches[0];
  const recent=matches.slice(0,3);
  const leadEvidence=leadTask?missionEvidence(leadTask,last):null;
  const goodGames=leadTask?.successfulGames||0;
  const needed=leadTask?.masteryRequired||3;
  let cleanStartStreak=0;
  for(const match of matches){
    if(match.metrics.deathsPre10===0)cleanStartStreak++;
    else break;
  }

  const leaveFeedback=(value:'yes'|'no')=>{
    if(!leadTask||feedback)return;
    setFeedback(value);
    track('feedback_given',{surface:'home_focus',useful:value==='yes',rank:active.rank,category:leadTask.category,taskId:leadTask.id});
  };

  if(isEmpty)return <AppShell>
    <TrackView event="dashboard_view" props={{state:'empty'}}/>
    <PageHead title="Your Climb" subtitle={active.gameName+active.tagline+' · '+active.rank+' · '+active.role}/>
    {profile&&<ErrorBoundary label="live_game" compact><LiveGameCard gameName={profile.gameName} tagline={profile.tagline} region={profile.region} task={leadTask}/></ErrorBoundary>}
    <FirstRun task={leadTask} gameName={active.gameName}/>
  </AppShell>;

  return <AppShell>
    <TrackView event="dashboard_view"/>
    <PageHead title="Your Climb" subtitle={active.gameName+active.tagline+' · '+active.rank+' · '+active.role}/>

    <div className="v7-stack">
      {profile&&<ErrorBoundary label="live_game" compact><LiveGameCard gameName={profile.gameName} tagline={profile.tagline} region={profile.region} task={leadTask}/></ErrorBoundary>}

      <section className="hq-command hq-command-v2">
        <div className="hq-command-copy">
          <div className="hq-top"><span className="v7-badge engine">{detail.tier} COACH</span><span className="v7-badge">YOUR #1 FOCUS</span></div>
          <h2>{leadTask?.title||'Play one tracked game'}</h2>
          <p className="hq-focus-meaning">{leadPlain?.meaning||'Give OP CLIMB one proper game and it will find the first repeat worth fixing.'}</p>

          <div className="hq-main-rule">
            <span>ONE RULE FOR YOUR NEXT GAME</span>
            <b>{leadPlain?.nextGame||leadTask?.gameRule||'Play normally. We need a real game before giving you a rule.'}</b>
          </div>

          {detail.depth>=3&&leadTask?.target&&<div className="hq-pass-condition"><span>THIS IS WORKING WHEN</span><b>{leadTask.target}</b></div>}

          {cleanStartStreak>=2&&<div className="focus-streak"><b>🔥 {cleanStartStreak} STRONG STARTS IN A ROW</b><span>No deaths before 10:00 in your latest {cleanStartStreak} tracked games.</span></div>}

          {leadTask&&leadEvidence&&detail.depth>=2&&<div className="hq-evidence-note">
            <span>WHY THIS IS YOUR FOCUS</span>
            <b>{leadEvidence.available?'We saw it in your games.':'We are still building proof.'}</b>
            <p>{leadEvidence.reason}</p>
          </div>}

          <div className="hero-actions"><Link className="btn primary" href="/session">START NEXT GAME →</Link><Link className="btn secondary" href="/coach">ASK MY COACH</Link></div>

          {leadTask&&<div className="hq-feedback">
            <span>Did this focus actually help?</span>
            {!feedback?<><button className="btn secondary" onClick={()=>leaveFeedback('yes')}>YES</button><button className="btn secondary" onClick={()=>leaveFeedback('no')}>NOT REALLY</button></>:<b>{feedback==='yes'?'Good — keep the same simple rule next game.':'Thanks — tell Coach what felt wrong and we’ll use that feedback.'}</b>}
            {feedback==='no'&&<Link className="text-link" href="/coach">TELL COACH →</Link>}
          </div>}
        </div>

        <aside className="hq-focus-visual">
          <div className="hq-focus-number"><small>CURRENT PRIORITY</small><strong>#1</strong></div>
          <AnimatedRing value={leadTask?.progress||0} label="FOCUS PROGRESS"/>
          <div className="hq-focus-reps"><b>{goodGames}/{needed}</b><span>successful games</span></div>
          <p>One focus in game. Everything else stays in the background.</p>
          {leadTask&&<details className="hq-coach-detail"><summary>SHOW COACH DETAIL</summary><IlpExplainability task={leadTask} compact/></details>}
        </aside>
      </section>

      <TierUpgradePrompt/>
    </div>

    {activeTasks.length>1&&<section className="v7-section hq-watch-section">
      <div className="v7-section-head"><div><div className="eyebrow">BACKGROUND TRACKING</div><h2>You focus on one thing. OP CLIMB watches the rest.</h2><p className="muted">These habits are not extra instructions for your next game. They are signals we keep measuring until one deserves your attention.</p></div><Link className="v7-link" href="/ilp">OPEN DEVELOPMENT PLAN →</Link></div>
      <div className="hq-behaviours">{activeTasks.slice(1).map((task,index)=>{const plain=plainLanguageFocus(task);return <Link key={task.id} className="glass hq-behaviour" href="/ilp"><div className="hq-bfoot"><span className="dc-index">0{index+2}</span><span className="v7-badge">WATCHING</span></div><h3>{task.title}</h3><p>{plain.meaning}</p>{detail.depth>=4&&<><AnimatedBar value={task.progress||0} delay={index*60}/><div className="hq-bfoot"><span>{task.progress||0}%</span><span>{task.successfulGames||0}/{task.masteryRequired||3} successful games</span></div></>}</Link>})}</div>
    </section>}

    <section className="v7-section hq-recent-section">
      <div className="v7-section-head"><div><div className="eyebrow">RECENT GAMES</div><h2>Your last games, without the stat-wall.</h2><p className="muted">Open a game when you want the full review. Here you only need the result, your KDA and the next step.</p></div><Link className="v7-link" href="/analyse">ALL GAMES →</Link></div>
      {recent.length?<div className="hq-match-grid">{recent.map((match,index)=><Link href={'/analyse/'+encodeURIComponent(match.id)} key={match.id} className="hq-match-card" data-result={match.result}><span className="hq-match-watermark">{match.champion}</span><div className="hq-match-top"><span>GAME 0{index+1}</span><strong>{match.result}</strong></div><div className="hq-match-champ">{match.champion}</div><div className="hq-match-kda"><b>{match.kills}</b><span>/</span><b>{match.deaths}</b><span>/</span><b>{match.assists}</b><small>K / D / A</small></div><div className="hq-match-open">OPEN COACH REVIEW →</div></Link>)}</div>:<div className="glass card hq-empty-match"><b>No tracked games yet.</b><p className="muted">Play with the Companion or add a game and this page starts becoming personal.</p><Link className="btn primary" href="/session">START NEXT GAME</Link></div>}
    </section>
  </AppShell>;
}
