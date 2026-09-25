'use client';

import {useEffect,useState} from 'react';
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
import type {Match} from '@/lib/types';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {XP_PER_MISSION_MASTERY,XP_PER_PROVEN_REP} from '@/lib/accountXp';

const pct=(n?:number)=>n===undefined?'Unavailable':`${Math.round(n*100)}%`;
const num=(n?:number,suffix='')=>n===undefined?'Unavailable':`${n>0&&suffix==='g'?'+':''}${Number.isInteger(n)?n:n.toFixed(1)}${suffix}`;
const liveTask=(status:string)=>status!=='MASTERED'&&status!=='PAUSED';

export default function Analysis(){
  const params=useParams<{match:string}>();
  const {active,hydrated}=useAccount();
  const {tasks}=useLearningPlan();
  const [serverMatch,setServerMatch]=useState<Match|null>(null);
  const [serverLoading,setServerLoading]=useState(false);
  const [serverCheckedId,setServerCheckedId]=useState('');
  const id=String(params.match||'');
  const matches=matchesFor(active.id);
  const cachedMatch=matches.find(m=>m.id===id);
  const match=cachedMatch??serverMatch??undefined;
  const detail=coachingLevelFor(active.rank);
  const embeddedPro=match?.proAnalysis;
  const {analysis:fetchedPro,loading:fetchingPro}=useProMatch(embeddedPro?undefined:match?.id);
  const proAnalysis=embeddedPro??fetchedPro??undefined;
  const proLoading=!embeddedPro&&fetchingPro;

  useEffect(()=>{setServerMatch(null);setServerCheckedId('')},[id,active.id]);

  useEffect(()=>{
    if(!hydrated||!id||cachedMatch||serverCheckedId===id)return;
    const controller=new AbortController();
    setServerLoading(true);
    void fetch('/api/analyse',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({matchId:id}),
      signal:controller.signal,
    }).then(async response=>{
      const body=await response.json().catch(()=>null);
      if(controller.signal.aborted)return;
      if(response.ok&&body?.match&&body.match.riotAccountId===active.id)setServerMatch(body.match as Match);
    }).catch(()=>{}).finally(()=>{
      if(controller.signal.aborted)return;
      setServerCheckedId(id);
      setServerLoading(false);
    });
    return()=>controller.abort();
  },[hydrated,id,cachedMatch,serverCheckedId,active.id]);

  if(!hydrated)return <AppShell><section className="glass card"><div className="eyebrow">MATCH REVIEW</div><h2>Loading your evidence…</h2></section></AppShell>;

  if(!cachedMatch&&(serverLoading||serverCheckedId!==id))return <AppShell><section className="glass card"><div className="eyebrow">MATCH REVIEW</div><h2>Loading the saved match…</h2><p className="muted">Opening the server copy directly so a newly completed Companion game cannot be blocked by stale browser state.</p></section></AppShell>;

  if(!match)return <AppShell><PageHead title="Match not found" subtitle="This review is not attached to the active Riot account."/><section className="glass card"><p className="muted">Switch back to the account that played this game or open a match from Analyse.</p><Link className="btn primary" href="/analyse">OPEN ANALYSE</Link></section></AppShell>;

  if(proLoading)return <AppShell><section className="glass card"><div className="eyebrow">COACHING EVIDENCE</div><h2>Reading the full game evidence…</h2><p className="muted">The review will appear once its coaching authority is resolved, so a scoreboard fallback cannot flash a different limiter first.</p></section></AppShell>;

  const recent=matches.filter(m=>m.id!==match.id);
  const report=analyseMatch({...match,proAnalysis},recent);
  const review=buildReview(match,report);
  const visible=detail.visiblePoints;
  const reviewPoints=detail.reviewPoints;
  const missionResults=tasks.flatMap(task=>{
    const attempt=(task.missionHistory??[]).find(rep=>rep.matchId===id);
    return attempt?[{task,attempt}]:[];
  });
  const existingTask=tasks.find(task=>liveTask(task.status)&&(task.metric===report.mission.metric||task.category===report.mission.category));

  return <AppShell>
    <PageHead title={`${match.champion} vs ${match.opponent||'Unknown'}`} subtitle={`${match.result} · ${match.rank} · ${detail.tier} REVIEW ${detail.depth}/10${detail.depth>=3?` · ${Math.floor(match.durationSeconds/60)}:${String(match.durationSeconds%60).padStart(2,'0')}`:''}`}/>
    {missionResults.length>0&&<section className="ar-mission-update">
      <div className="ar-mission-update-head"><div><div className="eyebrow">MISSION UPDATE</div><h2>This game counted.</h2></div><Link href="/ilp">OPEN MY PROGRESS →</Link></div>
      <div className="ar-mission-update-grid">{missionResults.map(({task,attempt})=>{
        const plain=plainLanguageFocus(task);
        const latest=(task.missionHistory??[]).at(-1)?.matchId===id;
        const mastered=task.status==='MASTERED'&&latest&&attempt.banksPass;
        const xp=attempt.banksPass?XP_PER_PROVEN_REP+(mastered?XP_PER_MISSION_MASTERY:0):0;
        return <article key={task.id}>
          <span>{attempt.banksPass?'PROVEN REP':'REVIEWED GAME'}</span>
          <b>{plain.name}</b>
          <strong className={attempt.banksPass?'good':'watch'}>{mastered?'MASTERED ✓':attempt.banksPass?'PASS ✓':'NOT BANKED'}</strong>
          <small>{attempt.banksPass?('+'+xp+' XP · '+(mastered?'mission completed':'rep banked')):'The metric did not clear the proof bar this game.'}</small>
        </article>;
      })}</div>
    </section>}
    <div className="grid five"><MetricCard label={detail.depth<=2?'SCORELINE':'KDA'} value={`${match.kills}/${match.deaths}/${match.assists}`}/>{detail.depth>=2&&<MetricCard label="CS/MIN" value={match.metrics.csPerMin.toFixed(1)}/>} {detail.depth>=4&&<MetricCard label="GOLD/MIN" value={match.metrics.goldPerMin??'N/A'}/>} {detail.depth>=5&&<MetricCard label="KILL PARTICIPATION" value={pct(match.metrics.killParticipation)}/>} {detail.depth>=6&&<MetricCard label="DAMAGE SHARE" value={pct(match.metrics.damageShare)}/>}</div>
    {detail.depth>=3&&<div className="phase-grid" style={{marginTop:18}}><div className="glass card"><div className="eyebrow">LANE PHASE</div><div className="league-row"><span>CS @ 10</span><b>{match.metrics.csAt10??'Unavailable'}</b></div>{detail.depth>=4&&<div className="league-row"><span>CS @ 15</span><b>{match.metrics.csAt15??'Unavailable'}</b></div>}{detail.depth>=4&&<div className="league-row"><span>Lane CS/min</span><b>{num(match.metrics.laneCsPerMin)}</b></div>}{detail.depth>=5&&<div className="league-row"><span>Gold diff @ 15</span><b>{num(match.metrics.goldDiffAt15,'g')}</b></div>}{detail.depth>=6&&<div className="league-row"><span>XP diff @ 15</span><b>{num(match.metrics.xpDiffAt15)}</b></div>}{detail.depth>=7&&<div className="league-row"><span>Level @ 15</span><b>{match.metrics.levelAt15??'Unavailable'}</b></div>}</div><div className="glass card"><div className="eyebrow">AFTER LANE</div><div className="league-row"><span>Post-15 CS/min</span><b>{num(match.metrics.post15CsPerMin)}</b></div>{detail.depth>=4&&<div className="league-row"><span>First item</span><b>{match.metrics.firstItemMinute?`${match.metrics.firstItemMinute.toFixed(1)}m`:'Unavailable'}</b></div>}{detail.depth>=5&&<div className="league-row"><span>Second item</span><b>{match.metrics.secondItemMinute?`${match.metrics.secondItemMinute.toFixed(1)}m`:'Unavailable'}</b></div>}{detail.depth>=5&&<div className="league-row"><span>Objective involvement</span><b>{pct(match.metrics.objectiveParticipation)}</b></div>}{detail.depth>=7&&<div className="league-row"><span>Items shown</span><b>{match.items?.join(' · ')||'Unavailable'}</b></div>}</div><div className="glass card"><div className="eyebrow">DEATHS</div><div className="league-row"><span>After 20</span><b>{match.metrics.deathsPost20??'Unavailable'}</b></div>{detail.depth>=4&&<div className="league-row"><span>Before 10</span><b>{match.metrics.deathsPre10??'Unavailable'}</b></div>}{detail.depth>=4&&<div className="league-row"><span>10–20</span><b>{match.metrics.deaths10to20??'Unavailable'}</b></div>}{detail.depth>=5&&<div className="league-row"><span>Solo deaths</span><b>{match.metrics.soloDeaths??'Unavailable'}</b></div>}{detail.depth>=6&&<div className="league-row"><span>Teamfight deaths</span><b>{match.metrics.teamfightDeaths??'Unavailable'}</b></div>}</div></div>}
    {detail.depth>=4&&<TurningPoints matchId={id}/>} 
    <section className="glass review" style={{marginTop:18}}><div className="review-top"><div className="eyebrow">{detail.tier} MATCH REVIEW</div><span className="v7-badge">DETAIL {detail.depth}/10 · {review.performance}/10</span></div><h2 className="review-headline">{review.headline}</h2><div className="review-grid"><div><span className="label">WHAT WENT WELL</span><ul className="review-list">{review.didWell.slice(0,reviewPoints).map(line=><li key={line}>{line}</li>)}</ul></div><div><span className="label">DO THIS INSTEAD</span><ol className="review-list is-ordered">{review.whatToDoInstead.slice(0,reviewPoints).map(line=><li key={line}>{line}</li>)}</ol></div></div><div className="review-mistake"><span className="label">#1 PROBLEM</span><h3>{review.biggestMistake.title}</h3>{detail.depth>=2&&<ul className="review-evidence">{review.biggestMistake.evidence.slice(0,visible).map(fact=><li key={fact}>{fact}</li>)}</ul>}{detail.depth>=3&&<p className="review-why">{review.biggestMistake.whyItMatters}</p>}</div>{detail.depth>=6&&<p className="review-note">{proAnalysis?'Coaching priority selected from persisted Riot/timeline/telemetry evidence.':'Full PRO evidence is unavailable for this match, so OP CLIMB is using the measured scoreboard fallback without inventing missing evidence.'}</p>}</section>
    <div className="glass card mission-card" style={{marginTop:18}}><div className="eyebrow">{detail.depth<=2?'YOUR NEXT FIX':'BIGGEST REPEATABLE LEAK'}</div><h2>{report.primary.category.replaceAll('_',' ')}</h2><div className={detail.depth>=4?'grid three':'grid two'}><div><div className="label">WHAT THE GAME SHOWED</div>{report.primary.facts.slice(0,visible).map(fact=><p key={fact}>{fact}</p>)}</div>{detail.depth>=4&&<div><div className="label">WHY</div><p className="muted">{report.primary.inference}</p>{detail.depth>=6&&<><div className="label">CONFIDENCE</div><p>{Math.round(report.primary.confidence*100)}%</p></>}</div>}<div><div className="label">NEXT BEHAVIOUR</div><p className="muted">{report.primary.suggestion}</p></div></div></div>
    <div className="glass card" style={{marginTop:18}}><div className="eyebrow">NEXT GAME</div><h2>{report.mission.title}</h2>{report.mission.rules.slice(0,detail.depth<=1?1:detail.depth<=2?2:3).map((rule,index)=><div className="cue-row" key={rule}><span>{['WHEN','DO','CHECK'][index]??'RULE'}</span><b>{rule}</b></div>)}{detail.depth>=3&&<p className="muted">Pass condition: {report.mission.target} {report.mission.unit} across {report.mission.gamesRequired} relevant games.</p>}<p className="muted">{existingTask?'This review matches one of your active measurable missions. OP CLIMB updates it automatically from the finished game.':'Your three-mission plan only changes when repeated measurable evidence is strong enough. The highest-priority limiter becomes Core; the other two remain Support.'}</p><Link href="/ilp" className="btn primary">OPEN DEVELOPMENT PLAN</Link></div>
    {detail.depth>=7&&<div className="glass card data-note" style={{marginTop:18}}><div className="eyebrow">DATA RELIABILITY</div><p className="muted">Scoreboard-only matches create a foundation grade from KDA, CS and duration. Exact recall quality, spacing, target selection and fight timing require Riot timeline, live telemetry or reviewed video evidence.</p></div>}
  </AppShell>;
}
