'use client';

import {useState} from 'react';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';

type Stage='PREP'|'SPEND'|'MOVE'|'ARRIVE';
type Guide={time:string;summary:string;check:string;action:string;cue:string;why:string;avoid:string;example:string};

export function CompactMapTimerRoutine({analysis}:{analysis?:ProMatchAnalysis|null}){
  const [open,setOpen]=useState<Stage|null>(null);
  const role=(analysis?.role||'').toUpperCase();
  const stages:Stage[]=['PREP','SPEND','MOVE','ARRIVE'];
  return <section className="op-timer-shell">
    <div className="op-section-title">
      <div><div className="eyebrow">OP MAP-TIMER ROUTINE</div><h2>60 → 45 → 30 → 15</h2></div>
      <p>Four decisions. One minute. Arrive before the fight decides itself.</p>
    </div>
    <div className="op-timer-grid" style={{marginTop:12}}>
      {stages.map(stage=>{
        const g=guide(stage,role); const active=open===stage;
        return <div key={stage}>
          <button type="button" className={`op-timer-card ${active?'active':''}`} onClick={()=>setOpen(active?null:stage)}>
            <strong>{g.time}</strong><span>{stage}</span><small>{g.summary}</small>
          </button>
          {active&&<div className="op-timer-detail">
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:7}}>
              <Point label="CHECK" text={g.check}/><Point label="DO" text={g.action}/><Point label="CUE" text={g.cue}/>
            </div>
            <details style={{marginTop:9,paddingTop:9,borderTop:'1px solid rgba(255,255,255,.07)'}}>
              <summary style={{cursor:'pointer',fontSize:9,fontWeight:900,letterSpacing:'.09em',color:'#7f8b98'}}>MORE COACHING</summary>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:7,marginTop:8}}><Point label="WHY" text={g.why}/><Point label="AVOID" text={g.avoid}/><Point label="ROLE EXAMPLE" text={g.example}/></div>
            </details>
          </div>}
        </div>;
      })}
    </div>
  </section>;
}

function Point({label,text}:{label:string;text:string}){return <div style={{padding:10,border:'1px solid rgba(255,255,255,.06)',borderRadius:10,background:'rgba(255,255,255,.015)'}}><div className="eyebrow" style={{fontSize:8}}>{label}</div><div style={{fontSize:11,lineHeight:1.45,marginTop:4,color:'#c7ced6'}}>{text}</div></div>}

function guide(stage:Stage,role:string):Guide{
  const adc=role.includes('BOTTOM')||role.includes('ADC');
  if(stage==='PREP')return{time:'60s',summary:'Finish safe farm. Decide reset or stay.',check:'Wave/camp safe? Enough HP? Meaningful gold? Which side is next?',action:'Take only the resource you can finish safely, then commit to RESET or STAY.',cue:'At 45s, the decision is already made.',why:'Late rotations usually start with one extra wave, camp or chase.',avoid:'Do not start a long side action just because the objective has not spawned.',example:adc?'ADC: catch the nearest safe wave, check your buy, then stop farming if the next wave makes your reset late.':'Finish the nearest safe resource and create a clean exit toward the objective.'};
  if(stage==='SPEND')return{time:'45s',summary:'Turn pocket gold into real power.',check:'Does your gold buy a real spike or major component?',action:'If yes, recall now, buy fast and leave base toward the objective side.',cue:'At 30s, be moving — not shopping.',why:'Unspent gold gives no combat stats.',avoid:'Do not stay for one more wave if it delays a meaningful purchase.',example:adc?'ADC: losing a few minions is often cheaper than arriving to Dragon with 1,300g unspent.':'Spend when the buy changes the next fight more than the extra farm would.'};
  if(stage==='MOVE')return{time:'30s',summary:'Move while safe routes still exist.',check:'Where is your team? Which route is safe? Are enemies missing?',action:'Move with teammates and stop detouring for low-value farm.',cue:'At 15s, be near setup with safe access.',why:'Early movement gives route choices; late movement forces bad entries.',avoid:'Do not face-check the shortest route just because you are late.',example:adc?'ADC: follow the teammate who can enter fog first. Your job is to arrive with damage, not check brush.':'Move while you still have a safe route.'};
  return{time:'15s',summary:'Stop farming. Choose your fight position.',check:'Numbers? Main enemy threats? Safest damage/engage angle?',action:'Take your starting position and let vision/team reveal the fight before committing.',cue:'When contact starts, already be useful.',why:'The final 15 seconds are about position, not income.',avoid:'Do not start another wave, camp, recall or deep ward.',example:adc?'ADC: stay behind frontline/peel and hit the closest safe target.':'Be present before contact and ready to perform your role.'};
}
