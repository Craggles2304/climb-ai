'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {TftShell} from '@/components/TftShell';
import type {TftGamePlan} from '@/lib/tft/types';

const PLAN_KEY='op_tft_game_plan';
const empty={economyRule:'',stabilizeRule:'',flexRule:'',positioningCue:''};

export default function TftGamePlanPage(){
  const [draft,setDraft]=useState(empty);
  const [locked,setLocked]=useState<TftGamePlan|null>(null);
  const [message,setMessage]=useState('');

  useEffect(()=>{
    try{const raw=localStorage.getItem(PLAN_KEY);if(raw){const plan=JSON.parse(raw) as TftGamePlan;setLocked(plan);setDraft({economyRule:plan.economyRule,stabilizeRule:plan.stabilizeRule,flexRule:plan.flexRule,positioningCue:plan.positioningCue});}}catch{/* ignore malformed local state */}
  },[]);

  const set=(key:keyof typeof empty,value:string)=>setDraft(d=>({...d,[key]:value}));
  const ready=Object.values(draft).some(v=>v.trim().length>0);
  const lock=()=>{
    if(!ready)return;
    const plan:TftGamePlan={economyRule:draft.economyRule.trim(),stabilizeRule:draft.stabilizeRule.trim(),flexRule:draft.flexRule.trim(),positioningCue:draft.positioningCue.trim(),lockedAt:new Date().toISOString()};
    localStorage.setItem(PLAN_KEY,JSON.stringify(plan));setLocked(plan);setMessage('Plan locked. It will be snapshotted into your next manual TFT review.');
  };
  const clear=()=>{localStorage.removeItem(PLAN_KEY);setLocked(null);setDraft(empty);setMessage('Plan cleared.');};

  return <TftShell><main className="container section">
    <div className="eyebrow">STATIC PRE-GAME PREPARATION</div><h1>LOCK THE RULES BEFORE THE RESULT.</h1><p className="muted" style={{maxWidth:820}}>Choose the decision rules you want to execute before queueing. After the game, your review records whether you actually followed them. OP CLIMB can then separate planning quality from execution quality without reading the live game.</p>

    {locked&&<section className="glass card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><div className="eyebrow">CURRENT LOCKED PLAN</div><h2 style={{marginBottom:4}}>READY FOR NEXT GAME</h2><p className="muted" style={{margin:0}}>Locked {new Date(locked.lockedAt).toLocaleString()}</p></div><span className="op-tier op-tier-plus">PLAN LOCKED</span></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:10,marginTop:16}}>
        <PlanCard label="ECONOMY" value={locked.economyRule}/><PlanCard label="STABILISE" value={locked.stabilizeRule}/><PlanCard label="FLEX" value={locked.flexRule}/><PlanCard label="POSITION" value={locked.positioningCue}/>
      </div>
      <div style={{display:'flex',gap:10,marginTop:16,flexWrap:'wrap'}}><Link className="btn primary" href="/tft">PLAY → THEN LOG RESULT</Link><button className="btn secondary" type="button" onClick={clear}>CLEAR PLAN</button></div>
    </section>}

    <section className="glass card" style={{marginTop:18}}>
      <div className="eyebrow">4 NON-NEGOTIABLE CUES</div><h2>SHORT ENOUGH TO EXECUTE. SPECIFIC ENOUGH TO REVIEW.</h2>
      <div style={{display:'grid',gap:12,marginTop:14}}>
        <Rule label="ECONOMY RULE" value={draft.economyRule} set={v=>set('economyRule',v)} placeholder="e.g. Below 50 HP on stage 4, convert gold instead of protecting interest."/>
        <Rule label="STABILISE RULE" value={draft.stabilizeRule} set={v=>set('stabilizeRule',v)} placeholder="e.g. If I lose two fights badly, improve board strength before the next level push."/>
        <Rule label="FLEX RULE" value={draft.flexRule} set={v=>set('flexRule',v)} placeholder="e.g. If two players contest the same carry before stage 4, pivot to the best item-compatible line."/>
        <Rule label="POSITIONING CUE" value={draft.positioningCue} set={v=>set('positioningCue',v)} placeholder="e.g. Late game: identify the biggest enemy threat before every meaningful fight."/>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginTop:16,flexWrap:'wrap'}}><p className="muted" style={{fontSize:11,margin:0}}>The plan is stored locally until you log the finished game; the match then keeps a snapshot with the review.</p><button className="btn primary" type="button" disabled={!ready} onClick={lock}>LOCK NEXT-GAME PLAN</button></div>
    </section>
    {message&&<div className="glass card" style={{marginTop:14,padding:14}}><b>{message}</b></div>}
  </main></TftShell>;
}

function Rule({label,value,set,placeholder}:{label:string;value:string;set:(value:string)=>void;placeholder:string}){
  return <label><span className="eyebrow">{label}</span><textarea rows={2} maxLength={240} value={value} onChange={e=>set(e.target.value)} placeholder={placeholder}/></label>;
}
function PlanCard({label,value}:{label:string;value:string}){
  return <div style={{padding:12,border:'1px solid rgba(255,255,255,.08)',borderRadius:14}}><small className="muted">{label}</small><b style={{display:'block',marginTop:5}}>{value||'No rule set'}</b></div>;
}
