'use client';

import {useEffect,useMemo,useState} from 'react';
import type {LearningJourney,LearningTimelineEvent} from '@/lib/learningJourney';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_META:Record<LearningTimelineEvent['type'],{label:string;symbol:string;className:string}>={
  PATTERN_DISCOVERED:{label:'DISCOVERED',symbol:'01',className:'discovered'},
  COACHING_STARTED:{label:'COACHED',symbol:'02',className:'coached'},
  FIRST_EXECUTION:{label:'EXECUTED',symbol:'03',className:'executed'},
  IMPROVING:{label:'IMPROVING',symbol:'↗',className:'improving'},
  MASTERED:{label:'MASTERED',symbol:'✓',className:'mastered'},
  REGRESSED:{label:'REGRESSION',symbol:'↘',className:'regressed'},
  FOCUS_SELECTED:{label:'FOCUS',symbol:'◎',className:'focus'},
  FOCUS_CHANGED:{label:'NEXT FOCUS',symbol:'→',className:'focus'},
};

function dateLabel(value:string){
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'':date.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
}
function titleCase(value:string){return value.replaceAll('_',' ').toLowerCase().replace(/(^|\s)\S/g,s=>s.toUpperCase())}

function EventCard({event}:{event:LearningTimelineEvent}){
  const meta=EVENT_META[event.type];
  const tag=event.situationTag?titleCase(event.situationTag):null;
  const e=event.evidence;
  return <article className={`vf-journey-event ${meta.className}`}>
    <div className="vf-journey-marker"><i>{meta.symbol}</i><span/></div>
    <div className="vf-journey-event-body">
      <div className="vf-journey-event-top">
        <div><span>{meta.label}</span><small>GAME {event.gameNumber} · {dateLabel(event.at)}</small></div>
        {tag&&<em>{tag}</em>}
      </div>
      <h3>{event.title}</h3>
      <p>{event.detail}</p>
      {(typeof e.recentFailureRate==='number'||typeof e.coachedExecutionRate==='number')&&<div className="vf-journey-evidence">
        {typeof e.priorFailureRate==='number'&&<div><span>PRIOR FAIL</span><b>{e.priorFailureRate}%</b></div>}
        {typeof e.recentFailureRate==='number'&&<div><span>RECENT FAIL</span><b>{e.recentFailureRate}%</b></div>}
        {typeof e.coachedExecutionRate==='number'&&<div><span>AFTER CUE</span><b>{e.coachedExecutionRate}% CLEAN</b></div>}
      </div>}
    </div>
  </article>;
}

export function LearningJourneyTimeline({accountId}:{accountId:string}){
  const [journey,setJourney]=useState<LearningJourney|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const valid=UUID.test(accountId);

  useEffect(()=>{
    let cancelled=false;
    if(!valid){setJourney(null);setError('');return}
    setLoading(true);setError('');
    fetch(`/api/learning-journey?accountId=${encodeURIComponent(accountId)}`,{cache:'no-store'})
      .then(async response=>{
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body?.error||'Could not load Learning Journey.');
        return body;
      })
      .then(body=>{if(!cancelled)setJourney(body?.journey??null)})
      .catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'Could not load Learning Journey.')})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[accountId,valid]);

  const events=useMemo(()=>journey?.events?.slice(0,14)??[],[journey]);

  if(!valid)return null;
  return <section className="vf-journey">
    <div className="vf-section-head vf-journey-head">
      <div>
        <div className="eyebrow">DECISION TWIN · LEARNING JOURNEY</div>
        <h2>What OP CLIMB discovered, taught and measured.</h2>
        <p className="muted">This timeline only promotes events backed by repeated Decision Graph evidence. It separates pattern discovery, coaching, execution and mastery instead of treating every game as a new opinion.</p>
      </div>
      {journey&&<div className={`vf-journey-stage ${journey.stage.toLowerCase()}`}><span>STAGE</span><b>{journey.stage}</b></div>}
    </div>

    {loading&&<div className="glass card vf-journey-empty">BUILDING YOUR LEARNING HISTORY…</div>}
    {!loading&&error&&<div className="glass card vf-journey-empty">{error}</div>}

    {!loading&&!error&&journey&&<>
      <div className="vf-journey-summary">
        <div><span>GAMES MODELLED</span><b>{journey.gamesAnalyzed}</b></div>
        <div><span>VERIFIED PATTERNS</span><b>{journey.summary.verifiedPatterns}</b></div>
        <div><span>AFTER-CUE EXECUTION</span><b>{journey.summary.coachingExecutionRate===null?'BUILDING':`${journey.summary.coachingExecutionRate}%`}</b></div>
        <div><span>MASTERED</span><b>{journey.summary.masteredPatterns}</b></div>
      </div>

      <div className="vf-journey-now glass">
        <div><span>WHERE YOUR MODEL IS NOW</span><h3>{journey.headline}</h3></div>
        <div className="vf-journey-now-focus"><span>CURRENT LIMITER</span><b>{journey.currentFocus?.label||'BUILDING EVIDENCE'}</b><small>{journey.currentFocus?.recentScore!==null&&journey.currentFocus?`${journey.currentFocus.recentScore}/100 · ${journey.currentFocus.state}`:'No behaviour promoted yet'}</small></div>
      </div>

      {events.length>0?<div className="vf-journey-list">{events.map(event=><EventCard key={event.id} event={event}/>)}</div>:<div className="glass card vf-journey-empty">
        <b>NO VERIFIED LEARNING MILESTONE YET</b>
        <span>Keep playing fully tracked games. OP CLIMB will not create a “journey” from noise.</span>
      </div>}

      <div className="vf-journey-policy">DISCOVER → COACH → EXECUTE → IMPROVE → MASTER → MOVE ON. Regression remains monitored after mastery.</div>
    </>}
  </section>;
}
