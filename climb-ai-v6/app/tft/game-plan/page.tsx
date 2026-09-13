'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {TftShell} from '@/components/TftShell';
import {track} from '@/lib/analytics';
import type {TftGamePlan} from '@/lib/tft/types';

const PLAN_KEY='op_tft_game_plan';
const SET_PLAN_KEY='op_tft_static_plan';

const empty={economyRule:'',stabilizeRule:'',flexRule:'',positioningCue:''};

export default function TftGamePlanPage(){
  const [draft,setDraft]=useState(empty);
  const [references,setReferences]=useState<string[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [locked,setLocked]=useState<TftGamePlan|null>(null);
  const [message,setMessage]=useState('');

  useEffect(()=>{
    track('tft_game_plan_viewed');
    try{
      const savedPlan=localStorage.getItem(PLAN_KEY);
      if(savedPlan){const parsed=JSON.parse(savedPlan) as TftGamePlan;setLocked(parsed);setDraft({economyRule:parsed.economyRule,stabilizeRule:parsed.stabilizeRule,flexRule:parsed.flexRule,positioningCue:parsed.positioningCue});setSelected(parsed.selectedReferences||[])}
      const savedRefs=JSON.parse(localStorage.getItem(SET_PLAN_KEY)||'[]') as string[];
      setReferences(Array.isArray(savedRefs)?savedRefs.slice(0,20):[]);
    }catch{/* malformed local state is ignored */}
  },[]);

  const ready=useMemo(()=>Object.values(draft).some(v=>v.trim().length>0),[draft]);
  const set=(key:keyof typeof empty,value:string)=>setDraft(d=>({...d,[key]:value}));
  const toggleRef=(name:string)=>setSelected(prev=>prev.includes(name)?prev.filter(x=>x!==name):[...prev,name].slice(-12));
  const lock=()=>{
    if(!ready)return;
    const plan:TftGamePlan={
      economyRule:draft.economyRule.trim(),
      stabilizeRule:draft.stabilizeRule.trim(),
      flexRule:draft.flexRule.trim(),
      positioningCue:draft.positioningCue.trim(),
      selectedReferences:selected,
      lockedAt:new Date().toISOString(),
    };
    localStorage.setItem(PLAN_KEY,JSON.stringify(plan));
    setLocked(plan);setMessage('Plan locked. OP CLIMB will snapshot it into your next manual game review.');
    track('tft_game_plan_locked',{rules:Object.values(draft).filter(Boolean).length,references:selected.length});
  };
  const clear=()=>{localStorage.removeItem(PLAN_KEY);setLocked(null);setDraft(empty);setSelected([]);setMessage('Plan cleared.')};

  return <TftShell><main className="container section">
    <div className="eyebrow">NO-API COACHING LOOP · BEFORE QUEUE</div>
    <h1>LOCK YOUR NEXT-GAME PLAN.</h1>
    <p className="muted" style={{maxWidth:820}}>Choose the rules you want to execute before the game starts. After the game, OP CLIMB compares what you intended with what you say actually happened. The plan is static preparation — it does not react to live board state.</p>

    {locked&&<section className="glass card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><div className="eyebrow">CURRENT LOCKED PLAN</div><h2 style={{marginBottom:4}}>READY FOR NEXT GAME</h2><p className="muted" style={{margin:0}}>Locked {new Date(locked.lockedAt).toLocaleString()}</p></div><span className="op-tier op-tier-plus">PLAN LOCKED</span></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:10,marginTop:16}}>
        <PlanCard label="ECONOMY" value={locked.economyRule}/><PlanCard label="STABILISE" value={locked.stabilizeRule}/><PlanCard label="FLEX" value={locked.flexRule}/><PlanCard label="POSITION" value={locked.positioningCue}/>
      </div>
      {locked.selectedReferences.length>0&&<div style={{marginTop:14}}><div className="eyebrow">SET LAB REFERENCES</div><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:8}}>{locked.selectedReferences.map(x=><span className="btn secondary" style={{padding:'6px 9px',pointerEvents:'none'}} key={x}>{x}</span>)}</div></div>}
      <div style={{display:'flex',gap:10,marginTop:16,flexWrap:'wrap'}}><Link className="btn primary" href="/tft#log-game">PLAY → THEN LOG RESULT</Link><button className="btn secondary" type="button" onClick={clear}>CLEAR PLAN</button></div>
    </section>}

    <section className="glass card" style={{marginTop:18}}>
      <div className="eyebrow">YOUR FOUR CUES</div><h2>KEEP THEM SHORT ENOUGH TO EXECUTE.</h2>
      <div style={{display:'grid',gap:12,marginTop:14}}>
        <Rule label="ECONOMY RULE" value={draft.economyRule} set={v=>set('economyRule',v)} placeholder="e.g. If I am below 55 HP on 4-1, convert gold instead of greeding interest."/>
        <Rule label="STABILISE RULE" value={draft.stabilizeRule} set={v=>set('stabilizeRule',v)} placeholder="e.g. If I lose two fights badly in a row, improve the board before levelling again."/>
        <Rule label="FLEX RULE" value={draft.flexRule} set={v=>set('flexRule',v)} placeholder="e.g. Pivot if two players contest my carry and I have no upgraded core by 3-5."/>
        <Rule label="POSITIONING CUE" value={draft.positioningCue} set={v=>set('positioningCue',v)} placeholder="e.g. Scout the main carry before every late-game fight and move my tank/disruptor accordingly."/>
      </div>
    </section>

    <section className="glass card" style={{marginTop:16}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><div><div className="eyebrow">SET LAB REFERENCES</div><h3 style={{marginBottom:0}}>OPTIONAL PREP, NOT A FORCED COMP</h3></div><Link className="text-link" href="/tft/set-lab">OPEN SET LAB →</Link></div>
      {references.length===0?<p className="muted">Save champions, traits, augments or items in Set Lab and they will appear here as reference points.</p>:<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>{references.map(name=><button type="button" key={name} onClick={()=>toggleRef(name)} className={`btn ${selected.includes(name)?'primary':'secondary'}`} style={{padding:'8px 10px'}}>{name}</button>)}</div>}
    </section>

    {message&&<div className="glass card" style={{marginTop:14,padding:14}}><b>{message}</b></div>}
    <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}><button className="btn primary" onClick={lock} disabled={!ready}>LOCK NEXT-GAME PLAN</button></div>
  </main></TftShell>;
}

function Rule({label,value,set,placeholder}:{label:string;value:string;set:(value:string)=>void;placeholder:string}){
  return <label><span className="eyebrow">{label}</span><textarea rows={2} maxLength={240} value={value} onChange={e=>set(e.target.value)} placeholder={placeholder}/></label>;
}
function PlanCard({label,value}:{label:string;value:string}){
  return <div style={{padding:12,border:'1px solid rgba(255,255,255,.08)',borderRadius:14}}><small className="muted">{label}</small><b style={{display:'block',marginTop:5}}>{value||'No rule set'}</b></div>;
}
