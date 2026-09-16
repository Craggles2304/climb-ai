'use client';
import type {ILPTask} from '@/lib/types';
import {explainIlpTask} from '@/lib/ilpExplainability';

function tone(action:string){
  if(action==='MASTERED')return'good';
  if(action==='PROMOTED'||action==='STRENGTHENED'||action==='REVISED'||action==='REOPENED')return'active';
  return'watch';
}

export function IlpExplainability({task,compact=false}:{task:ILPTask;compact?:boolean}){
  const x=explainIlpTask(task);
  return <div className={`ilp-x ${compact?'is-compact':''}`} data-tone={tone(x.action)}>
    <div className="ilp-x-head">
      <span className="ilp-x-badge">{x.label}</span>
      <strong>{x.headline}</strong>
    </div>
    <div className="ilp-x-grid">
      <div><span>RECENT EVIDENCE</span><b>{x.recentSupportGames===null?'BUILDING':`${x.recentSupportGames}/${x.recentWindow||0} GAMES`}</b>{x.recentOccurrences!==null&&<small>{x.recentOccurrences} occurrence{x.recentOccurrences===1?'':'s'}</small>}</div>
      <div><span>CONFIDENCE</span><b>{x.confidence===null?'—':`${x.confidence}%`}</b><small>{x.confidenceLabel}</small></div>
      <div><span>CLEAN STREAK</span><b>{x.cleanStreak}/{x.masteryRequired}</b><small>{x.cleanStreak>=x.masteryRequired?'proved':'toward mastery'}</small></div>
    </div>
    {!compact&&<>
      <p className="ilp-x-reason">{x.reason}</p>
      {x.oneOffGuard&&<div className="ilp-x-guard">ONE GAME INFORMS. REPEATED GAMES CHANGE THE PLAN.</div>}
    </>}
  </div>;
}
