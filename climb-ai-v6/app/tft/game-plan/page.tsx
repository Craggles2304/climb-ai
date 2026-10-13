'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {TftShell} from '@/components/TftShell';
import type {TftGamePlan} from '@/lib/tft/types';
import {useAccount} from '@/components/AccountContext';
import type {TftAccountMission} from '@/lib/tft/currentMission';

const PLAN_KEY='op_tft_game_plan';
const empty={economyRule:'',stabilizeRule:'',flexRule:'',positioningCue:''};

export default function TftGamePlanPage(){
  const {active}=useAccount();
  const [mission,setMission]=useState<TftAccountMission|null>(null);
  const [draft,setDraft]=useState(empty);
  const [locked,setLocked]=useState<TftGamePlan|null>(null);
  const [message,setMessage]=useState('');

  useEffect(()=>{
    try{const raw=localStorage.getItem(PLAN_KEY);if(raw){const plan=JSON.parse(raw) as TftGamePlan;setLocked(plan);setDraft({economyRule:plan.economyRule,stabilizeRule:plan.stabilizeRule,flexRule:plan.flexRule,positioningCue:plan.positioningCue});}}catch{/* ignore malformed local state */}
  },[]);

  useEffect(()=>{
    let cancelled=false;
    setMission(null);
    void fetch('/api/tft/current-mission?riotAccountId='+encodeURIComponent(active.id),{cache:'no-store'})
      .then(async r=>r.ok?r.json():null)
      .then(payload=>{if(!cancelled)setMission(payload?.mission||null)})
      .catch(()=>{if(!cancelled)setMission(null)});
    return()=>{cancelled=true};
  },[active.id]);
  const set=(key:keyof typeof empty,value:string)=>setDraft(d=>({...d,[key]:value}));
  const ready=Object.values(draft).some(v=>v.trim().length>0);
  const lock=()=>{
    if(!ready)return;
    const plan:TftGamePlan={economyRule:draft.economyRule.trim(),stabilizeRule:draft.stabilizeRule.trim(),flexRule:draft.flexRule.trim(),positioningCue:draft.positioningCue.trim(),lockedAt:new Date().toISOString()};
    localStorage.setItem(PLAN_KEY,JSON.stringify(plan));setLocked(plan);setMessage('Plan locked. It will be snapshotted into your next manual TFT review.');
  };
  const clear=()=>{localStorage.removeItem(PLAN_KEY);setLocked(null);setDraft(empty);setMessage('Plan cleared.');};

  return <TftShell><main className="container section tft-lab-page">
    <div className="eyebrow">YOUR ACCOUNT-LINKED TFT GAME PLAN</div><h1>ONE MISSION. EVERY SCREEN.</h1>
    <section className="glass card" style={{marginTop:18}}>
      <div className="eyebrow">YOUR CURRENT TFT DNA MISSION</div>
      <h2>{mission?.title||'BUILD YOUR TFT DNA'}</h2>
      <p className="muted">{mission?.why||'Your account mission appears here after synchronisation.'}</p>
      <div className="tft-focus-rule"><small>YOUR NEXT GAME</small><b>{mission?.nextGame||'Play normally and collect decision evidence.'}</b></div>
      <p className="muted" style={{marginTop:12,marginBottom:0}}>This mission syncs to your Companion and is frozen in the in-game overlay before play. Personal notes below stay in this browser and do not replace your TFT DNA mission.</p>
    </section>

    {locked&&<section className="glass card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><div className="eyebrow">CURRENT LOCKED PLAN</div><h2 style={{marginBottom:4}}>READY FOR NEXT GAME</h2><p className="muted" style={{margin:0}}>Locked {new Date(locked.lockedAt).toLocaleString()}</p></div><span className="op-tier op-tier-plus">PLAN LOCKED</span></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:10,marginTop:16}}>
        <PlanCard label="ECONOMY" value={locked.economyRule}/><PlanCard label="STABILISE" value={locked.stabilizeRule}/><PlanCard label="FLEX" value={locked.flexRule}/><PlanCard label="POSITION" value={locked.positioningCue}/>
      </div>
      <div style={{display:'flex',gap:10,marginTop:16,flexWrap:'wrap'}}><Link className="btn primary" href="/tft">PLAY → THEN LOG RESULT</Link><button className="btn secondary" type="button" onClick={clear}>CLEAR PLAN</button></div>
    </section>}

    <section className="glass card" style={{marginTop:18}}>
      <div className="eyebrow">OPTIONAL PERSONAL NOTES · THIS BROWSER ONLY</div><h2>WRITE ADDITIONAL CUES WITHOUT CHANGING YOUR MAIN MISSION.</h2>
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
