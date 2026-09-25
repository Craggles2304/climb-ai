'use client';
import {useState,useEffect} from 'react';
import {Adherence,judgeRep,RepVerdict} from '@/lib/adherence';
import {ILPMissionAttempt} from '@/lib/types';
import {anonId,sessionId,track} from '@/lib/analytics';

const OPTIONS:[Adherence,string,string][]=[
  ['YES','Yes','Ran it every time it came up'],
  ['PARTLY','Mostly','Remembered it some of the time'],
  ['NO','No','Forgot, or the game never allowed it'],
];

const key=(matchId:string,taskId?:string)=>`op_rep_${matchId}${taskId?`_${taskId}`:''}`;

export function BehaviourCheck({matchId,behaviour,clearedBar,taskId,onResult}:{
  matchId:string;behaviour:string;clearedBar:boolean;taskId?:string;
  onResult?:(attempt:ILPMissionAttempt)=>void;
}){
  const [verdict,setVerdict]=useState<RepVerdict|null>(null);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    try{
      const saved=window.localStorage.getItem(key(matchId,taskId)) as Adherence|null;
      if(saved)setVerdict(judgeRep(saved,clearedBar));
      else setVerdict(null);
    }catch{/* private mode */}
    setReady(true);
  },[matchId,taskId,clearedBar]);

  const answer=async(adherence:Adherence)=>{
    const v=judgeRep(adherence,clearedBar);
    const attempt:ILPMissionAttempt={matchId,at:new Date().toISOString(),adherence,clearedBar,outcome:v.outcome,banksPass:v.banksPass,source:'REVIEWED'};
    setVerdict(v);
    try{window.localStorage.setItem(key(matchId,taskId),adherence)}catch{/* ignore */}
    onResult?.(attempt);
    track('mission_completed',{matchId,taskId:taskId??null,adherence,clearedBar,outcome:v.outcome,banksPass:v.banksPass});
    try{
      await fetch('/api/adherence',{
        method:'POST',headers:{'content-type':'application/json'},keepalive:true,
        body:JSON.stringify({anonId:anonId(),sessionId:sessionId(),matchId,taskId,adherence,clearedBar,outcome:v.outcome}),
      });
    }catch{/* ILP mission state is already banked locally/cloud-side; analytics never blocks it */}
  };

  if(!ready)return null;

  if(verdict){
    return <div className={`rep rep-${verdict.outcome.toLowerCase()}`}>
      <div className="eyebrow">MISSION REVIEW</div>
      <b className="rep-headline">{verdict.headline}</b>
      <p className="rep-detail">{verdict.detail}</p>
      <span className={`v7-badge ${verdict.banksPass?'mastered':''}`}>{verdict.banksPass?'CONFIRMED REP BANKED':'NO CONFIRMED REP'}</span>
    </div>;
  }

  return <div className="rep">
    <div className="eyebrow">LAST GAME · BEHAVIOUR CHECK</div>
    <b className="rep-headline">Did you actually run this mission?</b>
    <p className="rep-detail">{behaviour}</p>
    <div className="rep-options">
      {OPTIONS.map(([value,label,hint])=>(
        <button key={value} className="rep-btn" onClick={()=>void answer(value)} title={hint}>
          <span>{label}</span><small>{hint}</small>
        </button>
      ))}
    </div>
    <p className="rep-note">The metric and your behaviour are judged separately. Only a confirmed behaviour rep banks mission mastery.</p>
  </div>;
}
