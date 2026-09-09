'use client';
import {useState,useEffect} from 'react';
import {Adherence,judgeRep,RepVerdict} from '@/lib/adherence';
import {anonId,sessionId,track} from '@/lib/analytics';

/**
 * "Did you actually do it?" — three taps after a game.
 *
 * This is the variable the product is otherwise missing. The plan asks for a
 * behaviour but scores a metric, and without knowing whether the behaviour was
 * attempted there is no way to tell a leak from a coincidence.
 *
 * Asked once per match, remembered locally, and never blocking.
 */

const OPTIONS:[Adherence,string,string][]=[
  ['YES','Yes','Ran it every time it came up'],
  ['PARTLY','Mostly','Remembered it some of the time'],
  ['NO','No','Forgot, or the game never allowed it'],
];

const key=(matchId:string)=>`op_rep_${matchId}`;

export function BehaviourCheck({matchId,behaviour,clearedBar,taskId}:{
  matchId:string;behaviour:string;clearedBar:boolean;taskId?:string;
}){
  const [verdict,setVerdict]=useState<RepVerdict|null>(null);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    try{
      const saved=window.localStorage.getItem(key(matchId)) as Adherence|null;
      if(saved)setVerdict(judgeRep(saved,clearedBar));
    }catch{/* private mode */}
    setReady(true);
  },[matchId,clearedBar]);

  const answer=async(adherence:Adherence)=>{
    const v=judgeRep(adherence,clearedBar);
    setVerdict(v);
    try{window.localStorage.setItem(key(matchId),adherence)}catch{/* ignore */}
    track('mission_completed',{matchId,taskId:taskId??null,adherence,clearedBar,outcome:v.outcome});
    try{
      await fetch('/api/adherence',{
        method:'POST',headers:{'content-type':'application/json'},keepalive:true,
        body:JSON.stringify({
          anonId:anonId(),sessionId:sessionId(),matchId,taskId,
          adherence,clearedBar,outcome:v.outcome,
        }),
      });
    }catch{/* answer is banked locally; never surface this */}
  };

  if(!ready)return null;

  if(verdict){
    return <div className={`rep rep-${verdict.outcome.toLowerCase()}`}>
      <div className="eyebrow">LAST GAME</div>
      <b className="rep-headline">{verdict.headline}</b>
      <p className="rep-detail">{verdict.detail}</p>
      <span className={`v7-badge ${verdict.banksPass?'mastered':''}`}>
        {verdict.banksPass?'PASS BANKED':'NO PASS BANKED'}
      </span>
    </div>;
  }

  return <div className="rep">
    <div className="eyebrow">LAST GAME</div>
    <b className="rep-headline">Did you actually do it?</b>
    <p className="rep-detail">{behaviour}</p>
    <div className="rep-options">
      {OPTIONS.map(([value,label,hint])=>(
        <button key={value} className="rep-btn" onClick={()=>void answer(value)} title={hint}>
          <span>{label}</span>
          <small>{hint}</small>
        </button>
      ))}
    </div>
    <p className="rep-note">
      Answer honestly — a game where you ran the behaviour and still missed the number
      tells the plan more than a game where you got lucky.
    </p>
  </div>;
}
