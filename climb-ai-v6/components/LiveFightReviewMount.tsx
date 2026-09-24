'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useAccount} from './AccountContext';
import {useLearningPlan} from './LearningPlanContext';
import {FightDecisionReview,type FightReview} from './FightDecisionReview';
import {CompactFixLadder} from './CompactFixLadder';
import {VisualMapTempoReview} from './VisualMapTempoReview';
import {CompactMapTimerRoutine} from './CompactMapTimerRoutine';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';
import type {ProLearningProfile} from '@/lib/riot/proHistory';
import {coachingLevelFor} from '@/lib/coachingLevel';

type Review={sessionId:string;status:string;snapshotCount:number;summary?:{fightReviews?:FightReview[]};proAnalysis?:ProMatchAnalysis|null;historyProfile?:ProLearningProfile|null};
type Pick={championId:number;championName:string|null;role:string|null;lockedIn:boolean};
type Ban={championId:number;championName:string|null};
type Pregame={linkedSessionId:string|null;status:'CHAMP_SELECT'|'ENDED';context:{localChampionName:string|null;localRole:string|null;allies:Pick[];enemies:Pick[];bans:{allies:Ban[];enemies:Ban[]}}};
type Point={title:string;detail:string;time?:number};

export function LiveFightReviewMount(){
  const {active}=useAccount();
  const {tasks}=useLearningPlan();
  const detail=coachingLevelFor(active.rank);
  const [review,setReview]=useState<Review|null>(null);
  const [pregame,setPregame]=useState<Pregame|null>(null);
  const loadedDraftFor=useRef('');

  const refresh=useCallback(async()=>{
    try{
      const reviewResponse=await fetch(`/api/live/telemetry?accountId=${encodeURIComponent(active.id)}`,{cache:'no-store'});
      if(!reviewResponse.ok)return;
      const body=await reviewResponse.json();
      const nextReview=(body.review??null) as Review|null;
      setReview(nextReview);
      if(!nextReview||!['COMPLETE','ABORTED'].includes(nextReview.status)||loadedDraftFor.current===nextReview.sessionId)return;
      loadedDraftFor.current=nextReview.sessionId;
      const pregameResponse=await fetch(`/api/live/pregame?accountId=${encodeURIComponent(active.id)}`,{cache:'no-store'});
      if(pregameResponse.ok){const pregameBody=await pregameResponse.json();setPregame(pregameBody.pregame??null)}
    }catch{}
  },[active.id]);

  useEffect(()=>{
    loadedDraftFor.current='';setPregame(null);void refresh();
    const tick=()=>{if(document.visibilityState==='visible')void refresh()};
    const id=window.setInterval(tick,20_000);
    document.addEventListener('visibilitychange',tick);
    return()=>{window.clearInterval(id);document.removeEventListener('visibilitychange',tick)};
  },[refresh,active.id]);

  const fights=review?.summary?.fightReviews??[];
  const summary=useMemo(()=>buildSimpleReview(fights),[fights]);
  const currentMission=tasks.find(t=>t.status!=='MASTERED'&&t.status!=='PAUSED');

  if(!review||!['COMPLETE','ABORTED'].includes(review.status))return null;
  const matchDraft=pregame?.linkedSessionId===review.sessionId?pregame:null;
  const nextRule=summary.next?.detail||currentMission?.gameRule||'Keep the same learning-plan cue until repeated match evidence shows a clearer priority.';
  const nextTitle=summary.next?.title||currentMission?.title||'BUILD MORE EVIDENCE';
  const good=summary.good.slice(0,detail.reviewPoints);
  const critical=summary.critical.slice(0,detail.reviewPoints);

  return <section className="dash-section op-coaching-zone" style={{display:'grid',gap:14}}>
    <div className="op-section-title">
      <div><div className="eyebrow">POST-GAME · {detail.tier} REVIEW {detail.depth}/10</div><h2>{detail.depth<=2?'What mattered.':'The points that matter.'}</h2></div>
      <p>{review.status==='ABORTED'?'Partial capture — useful, but not enough for mastery.':detail.depth<=2?'One good point. One problem. One thing next game.':`${detail.reviewPoints} useful point${detail.reviewPoints===1?'':'s'} each side, then one focus for the next game.`}</p>
    </div>

    <div className="grid two">
      <PointCard title="GOOD" mark="✓" points={good} showDetail={detail.depth>=2}/>
      <PointCard title="FIX" mark="!" points={critical} showDetail={detail.depth>=2}/>
    </div>

    <div className="glass card" style={{padding:20,borderColor:'rgba(182,246,107,.34)'}}>
      <div className="eyebrow">ONE THING NEXT GAME</div>
      <h2 style={{margin:'6px 0 8px'}}>{nextTitle}</h2>
      <p style={{margin:0,fontSize:15,lineHeight:1.55}}>{nextRule}</p>
    </div>

    {detail.depth>=4&&<details className="glass card op-quiet-details">
      <summary>OPEN MORE MATCH ANALYSIS <span>{detail.depth>=7?'grade, fix ladder, map timing & fight evidence':'extra evidence behind the review'}</span></summary>
      <div style={{display:'grid',gap:16,marginTop:18}}>
        {detail.depth>=6&&matchDraft&&<DraftEvidence pregame={matchDraft}/>} 
        <CompactFixLadder fights={fights} historyProfile={review.historyProfile}/>
        {detail.depth>=5&&<CompactMapTimerRoutine analysis={review.proAnalysis}/>} 
        {detail.depth>=6&&<VisualMapTempoReview fights={fights} analysis={review.proAnalysis}/>} 
        {detail.depth>=7&&<div className="op-review-with-compact-ladder"><FightDecisionReview fights={fights} proAnalysis={review.proAnalysis} historyProfile={review.historyProfile}/></div>}
      </div>
    </details>}
    {detail.depth>=7&&<style jsx global>{`.op-review-with-compact-ladder > div > section:nth-of-type(4){display:none!important;}`}</style>}
  </section>;
}

function PointCard({title,mark,points,showDetail}:{title:string;mark:string;points:Point[];showDetail:boolean}){
  return <div className="glass card" style={{padding:20}}><div className="eyebrow">{title}</div><div style={{display:'grid',gap:12,marginTop:12}}>{points.map((point,index)=><div key={`${title}-${index}`} style={{display:'grid',gridTemplateColumns:'28px minmax(0,1fr)',gap:10,paddingBottom:index===points.length-1?0:11,borderBottom:index===points.length-1?'none':'1px solid rgba(255,255,255,.07)'}}><b style={{fontSize:18}}>{mark}</b><div><b>{point.title}</b>{showDetail&&<p className="muted" style={{margin:'4px 0 0',lineHeight:1.45}}>{point.detail}</p>}</div></div>)}</div></div>;
}

function buildSimpleReview(fights:FightReview[]){
  const strengths=fights.filter(f=>f.category==='STRENGTH').sort((a,b)=>strengthScore(b)-strengthScore(a));
  const weaknesses=fights.filter(f=>f.category==='WEAKNESS').sort((a,b)=>weaknessScore(b)-weaknessScore(a));
  const good=dedupe(strengths.map(f=>({title:f.verdict==='YOU_STRONGER'?`Converted your edge at ${formatClock(f.atSeconds)}`:f.verdict==='THEM_STRONGER'?`Won from a harder state at ${formatClock(f.atSeconds)}`:`Clean conversion at ${formatClock(f.atSeconds)}`,detail:short(f.summary),time:f.atSeconds}))).slice(0,3);
  const critical=dedupe(weaknesses.map(f=>({title:f.verdict==='YOU_STRONGER'?`Threw a favourable state at ${formatClock(f.atSeconds)}`:f.verdict==='THEM_STRONGER'?`Took an enemy-favoured fight at ${formatClock(f.atSeconds)}`:`Death from an even state at ${formatClock(f.atSeconds)}`,detail:short(f.betterDecision?.[0]||f.summary),time:f.atSeconds}))).slice(0,3);
  if(!good.length)good.push({title:'No clear positive signal',detail:'This match did not contain a strong positive decision signal OP CLIMB can verify from the captured evidence.'});
  if(!critical.length)critical.push({title:'No critical leak confirmed',detail:'No single critical decision leak was clear enough to promote from this match. Keep building evidence.'});
  const top=weaknesses[0];
  const next=top?{title:top.verdict==='YOU_STRONGER'?'PROTECT THE ADVANTAGE':top.verdict==='THEM_STRONGER'?'STOP TAKING THE BAD FIGHT':'CREATE AN EDGE BEFORE COMMITTING',detail:top.betterDecision?.[0]||top.summary}:null;
  return{good,critical,next};
}
function strengthScore(f:FightReview){return (f.verdict==='THEM_STRONGER'?34:f.verdict==='YOU_STRONGER'?30:24)+Math.min(20,Math.abs(f.score||0))}
function weaknessScore(f:FightReview){return (f.verdict==='YOU_STRONGER'?40:f.verdict==='EVEN'?30:24)+Math.min(20,Math.abs(f.score||0))+Math.min(15,Math.round((f.evidence.currentGold||0)/150))}
function dedupe(points:Point[]){const seen=new Set<string>();return points.filter(point=>{const key=point.title.replace(/\d+:\d+/g,'TIME').toLowerCase();if(seen.has(key))return false;seen.add(key);return true})}
function short(value:string){const text=String(value||'').replace(/\s+/g,' ').trim();return text.length>220?`${text.slice(0,217).replace(/\s+\S*$/,'')}…`:text}
function formatClock(seconds:number){const value=Math.max(0,Math.floor(seconds));return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`}

function DraftEvidence({pregame}:{pregame:Pregame}){const c=pregame.context;return <details className="glass card"><summary style={{cursor:'pointer',fontWeight:900}}>DRAFT CONTEXT · {c.localChampionName||'Your pick'}{c.localRole?` · ${roleLabel(c.localRole)}`:''}</summary><p className="muted">This champion-select snapshot is linked to this exact tracked match and remains part of the saved learning evidence.</p><div className="grid two" style={{marginTop:12}}><DraftList title="YOUR DRAFT" picks={c.allies}/><DraftList title="ENEMY DRAFT" picks={c.enemies}/></div><div style={{marginTop:12,fontSize:12}}><b>Ally bans:</b> {banText(c.bans.allies)}<br/><b>Enemy bans:</b> {banText(c.bans.enemies)}</div></details>}
function DraftList({title,picks}:{title:string;picks:Pick[]}){return <div><div className="eyebrow">{title}</div><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:7}}>{picks.filter(p=>p.championId>0).map((p,i)=><span key={`${p.championId}-${i}`} style={{padding:'6px 8px',border:'1px solid rgba(255,255,255,.09)',borderRadius:999,fontSize:11}}>{p.championName||`Champion ${p.championId}`}{p.role?` · ${roleLabel(p.role)}`:''}</span>)}</div></div>}
function roleLabel(role:string){const r=role.toUpperCase();if(r==='BOTTOM'||r==='ADC')return'ADC';if(r==='MIDDLE'||r==='MID')return'MID';if(r==='UTILITY'||r==='SUPPORT')return'SUPPORT';return r}
function banText(bans:Ban[]){const names=bans.filter(b=>b.championId>0).map(b=>b.championName||`Champion ${b.championId}`);return names.length?names.join(' · '):'None recorded'}
