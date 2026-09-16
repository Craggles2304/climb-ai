'use client';

import {useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {MetricCard,PageHead} from '@/components/UI';
import {matchesFor,useAccount} from '@/components/AccountContext';
import {useLearningPlan} from '@/components/LearningPlanContext';
import {useProMatch} from '@/components/useProMatch';
import {analyseMatch} from '@/lib/engine';
import {buildReview} from '@/lib/review';
import {TurningPoints} from '@/components/TurningPoints';
import {coachingLevelFor} from '@/lib/coachingLevel';

const pct=(n?:number)=>n===undefined?'Unavailable':`${Math.round(n*100)}%`;
const num=(n?:number,suffix='')=>n===undefined?'Unavailable':`${n>0&&suffix==='g'?'+':''}${Number.isInteger(n)?n:n.toFixed(1)}${suffix}`;
const liveTask=(status:string)=>status!=='MASTERED'&&status!=='PAUSED';

export default function Analysis(){
  const params=useParams<{match:string}>();
  const {active,hydrated}=useAccount();
  const {tasks,addTask}=useLearningPlan();
  const [tracked,setTracked]=useState(false);
  const id=String(params.match||'');
  const matches=matchesFor(active.id);
  const match=matches.find(m=>m.id===id);
  const detail=coachingLevelFor(active.rank);
  const embeddedPro=match?.proAnalysis;
  const {analysis:fetchedPro,loading:fetchingPro}=useProMatch(embeddedPro?undefined:match?.id);
  const proAnalysis=embeddedPro??fetchedPro??undefined;
  const proLoading=!embeddedPro&&fetchingPro;

  if(!hydrated)return <AppShell><section className="glass card"><div className="eyebrow">MATCH REVIEW</div><h2>Loading your evidence…</h2></section></AppShell>;

  if(!match)return <AppShell><PageHead title="Match not found" subtitle="This review is not attached to the active Riot account."/><section className="glass card"><p className="muted">Switch back to the account that played this game or open a match from Analyse.</p><Link className="btn primary" href="/analyse">OPEN ANALYSE</Link></section></AppShell>;

  if(proLoading)return <AppShell><section className="glass card"><div className="eyebrow">COACHING EVIDENCE</div><h2>Reading the full game evidence…</h2><p className="muted">The review will appear once its coaching authority is resolved, so a scoreboard fallback cannot flash a different limiter first.</p></section></AppShell>;

  const recent=matches.filter(m=>m.id!==match.id);
  const report=analyseMatch({...match,proAnalysis},recent);
  const review=buildReview(match,report);
  const visible=detail.visiblePoints;
  const reviewPoints=detail.reviewPoints;
  const existingTask=tasks.find(task=>liveTask(task.status)&&(task.metric===report.mission.metric||task.category===report.mission.category));
  const trackMission=()=>{
    if(tracked)return;
    addTask({title:report.mission.title,category:report.mission.category,why:`Post-game review detected this as the highest-value repeatable behaviour. ${report.primary.inference}`,gameRule:report.mission.rules[0]||report.primary.suggestion,metric:report.mission.metric,target:`${report.mission.target} ${report.mission.unit} across ${report.mission.gamesRequired} relevant games`,source:'COACH',priority:96});
    setTracked(true);
  };

  return <AppShell>
    <PageHead title={`${match.champion} vs ${match.opponent||'Unknown'}`} subtitle={`${match.result} · ${match.rank} · ${detail.tier} REVIEW ${detail.depth}/10${detail.depth>=3?` · ${Math.floor(match.durationSeconds/60)}:${String(match.durationSeconds%60).padStart(2,'0')}`:''}`}/>
    <div className="grid five"><MetricCard label={detail.depth<=2?'SCORELINE':'KDA'} value={`${match.kills}/${match.deaths}/${match.assists}`}/>{detail.depth>=2&&<MetricCard label="CS/MIN" value={match.metrics.csPerMin.toFixed(1)}/>} {detail.depth>=4&&<MetricCard label="GOLD/MIN" value={match.metrics.goldPerMin??'N/A'}/>} {detail.depth>=5&&<MetricCard label="KILL PARTICIPATION" value={pct(match.metrics.killParticipation)}/>} {detail.depth>=6&&<MetricCard label="DAMAGE SHARE" value={pct(match.metrics.damageShare)}/>}</div>
    {detail.depth>=3&&<div className="phase-grid" style={{marginTop:18}}><div className="glass card"><div className="eyebrow">LANE PHASE</div><div className="league-row"><span>CS @ 10</span><b>{match.metrics.csAt10??'Unavailable'}</b></div>{detail.depth>=4&&<div className="league-row"><span>CS @ 15</span><b>{match.metrics.csAt15??'Unavailable'}</b></div>}{detail.depth>=4&&<div className="league-row"><span>Lane CS/min</span><b>{num(match.metrics.laneCsPerMin)}</b></div>}{detail.depth>=5&&<div className="league-row"><span>Gold diff @ 15</span><b>{num(match.metrics.goldDiffAt15,'g')}</b></div>}{detail.depth>=6&&<div className="league-row"><span>XP diff @ 15</span><b>{num(match.metrics.xpDiffAt15)}</b></div>}{detail.depth>=7&&<div className="league-row"><span>Level @ 15</span><b>{match.metrics.levelAt15??'Unavailable'}</b></div>}</div><div className="glass card"><div className="eyebrow">AFTER LANE</div><div className="league-row"><span>Post-15 CS/min</span><b>{num(match.metrics.post15CsPerMin)}</b></div>{detail.depth>=4&&<div className="league-row"><span>First item</span><b>{match.metrics.firstItemMinute?`${match.metrics.firstItemMinute.toFixed(1)}m`:'Unavailable'}</b></div>}{detail.depth>=5&&<div className="league-row"><span>Second item</span><b>{match.metrics.secondItemMinute?`${match.metrics.secondItemMinute.toFixed(1)}m`:'Unavailable'}</b></div>}{detail.depth>=5&&<div className="league-row"><span>Objective involvement</span><b>{pct(match.metrics.objectiveParticipation)}</b></div>}{detail.depth>=7&&<div className="league-row"><span>Items shown</span><b>{match.items?.join(' · ')||'Unavailable'}</b></div>}</div><div className="glass card"><div className="eyebrow">DEATHS</div><div className="league-row"><span>After 20</span><b>{match.metrics.deathsPost20??'Unavailable'}</b></div>{detail.depth>=4&&<div className="league-row"><span>Before 10</span><b>{match.metrics.deathsPre10??'Unavailable'}</b></div>}{detail.depth>=4&&<div className="league-row"><span>10–20</span><b>{match.metrics.deaths10to20??'Unavailable'}</b></div>}{detail.depth>=5&&<div className="league-row"><span>Solo deaths</span><b>{match.metrics.soloDeaths??'Unavailable'}</b></div>}{detail.depth>=6&&<div className="league-row"><span>Teamfight deaths</span><b>{match.metrics.teamfightDeaths??'Unavailable'}</b></div>}</div></div>}
    {detail.depth>=4&&<TurningPoints matchId={id}/>} 
    <section className="glass review" style={{marginTop:18}}><div className="review-top"><div className="eyebrow">{detail.tier} MATCH REVIEW</div><span className="v7-badge">DETAIL {detail.depth}/10 · {review.performance}/10</span></div><h2 className="review-headline">{review.headline}</h2><div className="review-grid"><div><span className="label">WHAT WENT WELL</span><ul className="review-list">{review.didWell.slice(0,reviewPoints).map(line=><li key={line}>{line}</li>)}</ul></div><div><span className="label">DO THIS INSTEAD</span><ol className="review-list is-ordered">{review.whatToDoInstead.slice(0,reviewPoints).map(line=><li key={line}>{line}</li>)}</ol></div></div><div className="review-mistake"><span className="label">#1 PROBLEM</span><h3>{review.biggestMistake.title}</h3>{detail.depth>=2&&<ul className="review-evidence">{review.biggestMistake.evidence.slice(0,visible).map(fact=><li key={fact}>{fact}</li>)}</ul>}{detail.depth>=3&&<p className="review-why">{review.biggestMistake.whyItMatters}</p>}</div>{detail.depth>=6&&<p className="review-note">{proAnalysis?'Coaching priority selected from persisted Riot/timeline/telemetry evidence.':'Full PRO evidence is unavailable for this match, so OP CLIMB is using the measured scoreboard fallback without inventing missing evidence.'}</p>}</section>
    <div className="glass card mission-card" style={{marginTop:18}}><div className="eyebrow">{detail.depth<=2?'YOUR NEXT FIX':'BIGGEST REPEATABLE LEAK'}</div><h2>{report.primary.category.replaceAll('_',' ')}</h2><div className={detail.depth>=4?'grid three':'grid two'}><div><div className="label">WHAT THE GAME SHOWED</div>{report.primary.facts.slice(0,visible).map(fact=><p key={fact}>{fact}</p>)}</div>{detail.depth>=4&&<div><div className="label">WHY</div><p className="muted">{report.primary.inference}</p>{detail.depth>=6&&<><div className="label">CONFIDENCE</div><p>{Math.round(report.primary.confidence*100)}%</p></>}</div>}<div><div className="label">NEXT BEHAVIOUR</div><p className="muted">{report.primary.suggestion}</p></div></div></div>
    <div className="glass card" style={{marginTop:18}}><div className="eyebrow">NEXT GAME</div><h2>{report.mission.title}</h2>{report.mission.rules.slice(0,detail.depth<=1?1:detail.depth<=2?2:3).map((rule,index)=><div className="cue-row" key={rule}><span>{['WHEN','DO','CHECK'][index]??'RULE'}</span><b>{rule}</b></div>)}{detail.depth>=3&&<p className="muted">Pass condition: {report.mission.target} {report.mission.unit} across {report.mission.gamesRequired} relevant games.</p>}{existingTask&&!tracked?<><p className="muted">This matches an active development mission. Tracking it will update that mission instead of creating a duplicate.</p><button type="button" className="btn primary" onClick={trackMission}>UPDATE ACTIVE MISSION</button></>:tracked?<><p className="success">Development plan updated. This review is now connected to your active five.</p><Link href="/ilp" className="btn primary">OPEN DEVELOPMENT PLAN</Link></>:<button type="button" className="btn primary" onClick={trackMission}>ADD TO DEVELOPMENT PLAN</button>}</div>
    {detail.depth>=7&&<div className="glass card data-note" style={{marginTop:18}}><div className="eyebrow">DATA RELIABILITY</div><p className="muted">Scoreboard-only matches create a foundation grade from KDA, CS and duration. Exact recall quality, spacing, target selection and fight timing require Riot timeline, live telemetry or reviewed video evidence.</p></div>}
  </AppShell>;
}
