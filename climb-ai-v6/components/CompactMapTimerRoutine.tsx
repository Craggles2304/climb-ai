'use client';

import {useState} from 'react';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';

type Stage='PREP'|'SPEND'|'MOVE'|'ARRIVE';
type Guide={time:string;summary:string;check:string;action:string;cue:string;why:string;avoid:string;example:string};

export function CompactMapTimerRoutine({analysis}:{analysis?:ProMatchAnalysis|null}){
  const [open,setOpen]=useState<Stage|null>(null);
  const role=(analysis?.role||'').toUpperCase();
  const stages:Stage[]=['PREP','SPEND','MOVE','ARRIVE'];
  return <section className="glass card" style={{display:'grid',gap:12}}>
    <div>
      <div className="eyebrow">OP MAP-TIMER ROUTINE</div>
      <h3 style={{margin:'5px 0 3px'}}>60 → 45 → 30 → 15</h3>
      <p className="muted" style={{margin:0,fontSize:12}}>One rule at a time. Open only the stage you need.</p>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:8}}>
      {stages.map(stage=>{
        const g=guide(stage,role); const active=open===stage;
        return <div key={stage} style={{border:'1px solid rgba(255,255,255,.08)',borderRadius:12,overflow:'hidden',background:active?'rgba(67,156,255,.045)':'rgba(255,255,255,.018)'}}>
          <button type="button" onClick={()=>setOpen(active?null:stage)} style={{width:'100%',border:0,background:'transparent',color:'inherit',textAlign:'left',padding:12,cursor:'pointer'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><strong style={{fontSize:22}}>{g.time}</strong><span>{active?'−':'+'}</span></div>
            <div className="eyebrow" style={{marginTop:3}}>{stage}</div>
            <div style={{fontSize:11,lineHeight:1.4,marginTop:5}}>{g.summary}</div>
          </button>
          {active&&<div style={{padding:'0 12px 12px',display:'grid',gap:7}}>
            <Point label="CHECK" text={g.check}/>
            <Point label="DO" text={g.action}/>
            <Point label="CUE" text={g.cue}/>
            <details style={{borderTop:'1px solid rgba(255,255,255,.07)',paddingTop:8}}>
              <summary style={{cursor:'pointer',fontSize:10,fontWeight:900,letterSpacing:'.06em'}}>MORE COACHING</summary>
              <div style={{display:'grid',gap:7,marginTop:8}}><Point label="WHY" text={g.why}/><Point label="AVOID" text={g.avoid}/><Point label="ROLE EXAMPLE" text={g.example}/></div>
            </details>
          </div>}
        </div>;
      })}
    </div>
  </section>;
}

function Point({label,text}:{label:string;text:string}){return <div style={{padding:9,border:'1px solid rgba(255,255,255,.07)',borderRadius:9}}><div className="eyebrow" style={{fontSize:9}}>{label}</div><div style={{fontSize:11,lineHeight:1.45,marginTop:3}}>{text}</div></div>}

function guide(stage:Stage,role:string):Guide{
  const adc=role.includes('BOTTOM')||role.includes('ADC');
  if(stage==='PREP')return{time:'60s',summary:'Finish the safe resource. Decide reset or stay.',check:'Wave/camp safe? Enough HP? Meaningful gold? Which side is next?',action:'Take only the resource you can finish safely, then commit to RESET or STAY.',cue:'At 45s, the decision is already made.',why:'Late rotations usually start with one extra wave, camp or chase.',avoid:'Do not start a long side action just because the objective has not spawned.',example:adc?'ADC: catch the nearest safe wave, check your buy, then stop farming if the next wave makes your reset late.':'Finish the nearest safe resource and create a clean exit toward the objective.'};
  if(stage==='SPEND')return{time:'45s',summary:'Turn pocket gold into combat stats.',check:'Does your gold buy a real spike or major component?',action:'If yes, recall now, buy fast and leave base toward the objective side.',cue:'At 30s, be moving — not shopping.',why:'Unspent gold gives no combat stats.',avoid:'Do not stay for one more wave if it delays a meaningful purchase.',example:adc?'ADC: losing a few minions is often cheaper than arriving to Dragon with 1,300g unspent.':'Spend when the buy changes the next fight more than the extra farm would.'};
  if(stage==='MOVE')return{time:'30s',summary:'Rotate before the fight forces your route.',check:'Where is your team? Which route is safe? Are enemies missing?',action:'Move with teammates and stop detouring for low-value farm.',cue:'At 15s, be near setup with safe access.',why:'Early movement gives route choices; late movement forces bad entries.',avoid:'Do not face-check the shortest route just because you are late.',example:adc?'ADC: follow the teammate who can enter fog first. Your job is to arrive with damage, not check brush.':'Move while you still have a safe route.'};
  return{time:'15s',summary:'Arrive useful. Stop farming and choose your position.',check:'Numbers? Main enemy threats? Safest damage/engage angle?',action:'Take your starting position and let vision/team reveal the fight before committing.',cue:'When contact starts, already be in position.',why:'The final 15 seconds are about position, not income.',avoid:'Do not start another wave, camp, recall or deep ward.',example:adc?'ADC: stay behind frontline/peel and hit the closest safe target.':'Be present before contact and ready to perform your role.'};
}
