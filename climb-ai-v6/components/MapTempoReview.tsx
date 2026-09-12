'use client';

import {useMemo,useState} from 'react';
import type {FightReview} from './FightDecisionReview';
import type {ProMatchAnalysis,ProMetric} from '@/lib/riot/proAnalysis';

type MomentKind='OBJECTIVE'|'RESET'|'POWER'|'FARM';
type Moment={kind:MomentKind;atSeconds:number;label:string;detail:string};
type TimingRow={fight:FightReview;nearestObjective:Moment|null;nearestReset:Moment|null;nearestPower:Moment|null;status:'COSTLY'|'GOOD'|'RESET'|'NEUTRAL';headline:string;detail:string};

export function MapTempoReview({fights,analysis}:{fights:FightReview[];analysis?:ProMatchAnalysis|null}){
  const [open,setOpen]=useState<string|null>(null);
  const moments=useMemo(()=>collectMoments(analysis),[analysis]);
  const rows=useMemo(()=>buildTimingRows(fights,moments),[fights,moments]);
  const costly=rows.filter(r=>r.status==='COSTLY'||r.status==='RESET').length;
  const good=rows.filter(r=>r.status==='GOOD').length;
  const objectiveRows=rows.filter(r=>r.nearestObjective).length;
  const role=(analysis?.role||'').toUpperCase();

  if(!fights.length)return null;

  return <section className="glass card" style={{display:'grid',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'start',flexWrap:'wrap'}}>
      <div>
        <div className="eyebrow">MAP & TEMPO REVIEW</div>
        <h2 style={{margin:'5px 0 4px'}}>Were you moving at the right time?</h2>
        <p className="muted" style={{margin:0,maxWidth:760}}>OP CLIMB links your fight timestamps to nearby objective, reset and power-spike evidence. Exact pathing is not visible from the local tracker, so roaming is graded as timing context rather than invented map position.</p>
      </div>
      <span style={proxyPill}>ROTATION-TIMING PROXY</span>
    </div>

    <div style={summaryGrid}>
      <Mini label="OBJECTIVE-LINKED FIGHTS" value={String(objectiveRows)} sub="within 2 minutes of recorded objective evidence"/>
      <Mini label="COSTLY TIMING WINDOWS" value={String(costly)} sub="death/reset mistakes around tempo windows"/>
      <Mini label="GOOD TEMPO CONVERSIONS" value={String(good)} sub="positive fight outcomes around map windows"/>
    </div>

    <details style={protocolShell}>
      <summary style={summaryStyle}>OPEN THE OP MAP-TIMER ROUTINE</summary>
      <div style={{display:'grid',gap:10,marginTop:12}}>
        <div style={countdownGrid}>
          <TimerStep time="60s" title="PREP" text="Finish the current safe resource, decide whether you need to reset, and stop starting long side actions."/>
          <TimerStep time="45s" title="SPEND" text="If you have a meaningful buy, convert gold now. A late reset is often worse than arriving with slightly less farm."/>
          <TimerStep time="30s" title="MOVE" text="Start the rotation through the safest route available with your team rather than arriving alone from a blind angle."/>
          <TimerStep time="15s" title="ARRIVE" text="Be close enough to influence the setup. Do not begin another long roam, camp cycle or side-wave commitment unless the objective is being conceded."/>
        </div>
        <RoleRoamRule role={role}/>
      </div>
    </details>

    <div style={{display:'grid',gap:8}}>
      <div className="eyebrow">TIMING REVIEW BY FIGHT</div>
      {rows.slice(0,12).map((row,index)=>{
        const key=`${row.fight.atSeconds}-${index}`;const isOpen=open===key;
        return <div key={key} style={rowShell}>
          <button type="button" onClick={()=>setOpen(isOpen?null:key)} style={rowButton}>
            <strong style={{fontSize:18}}>{clock(row.fight.atSeconds)}</strong>
            <div style={{minWidth:0}}><div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}><b>{row.headline}</b><StatusPill status={row.status}/></div><div className="muted" style={{fontSize:11,marginTop:3}}>{row.detail}</div></div>
            <span>{isOpen?'−':'+'}</span>
          </button>
          {isOpen&&<TimingDetail row={row} role={role}/>} 
        </div>;
      })}
    </div>
  </section>;
}

function TimingDetail({row,role}:{row:TimingRow;role:string}){
  const fight=row.fight;
  return <div style={detailBody}>
    <div style={detailGrid}>
      <Block label="TIMER CONTEXT" text={timerContext(row)}/>
      <Block label="BETTER MAP DECISION" text={betterMapDecision(row,role)}/>
      <Block label="ROAM / ROTATION RULE" text={roamRule(row,role)}/>
      <Block label="RETURN TIMER" text={returnRule(role)}/>
    </div>
    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>
      <span style={evidencePill}>{clock(fight.atSeconds)} · {fight.outcome}</span>
      {row.nearestObjective&&<span style={evidencePill}>{relativeLabel(fight.atSeconds,row.nearestObjective)} · {row.nearestObjective.label}</span>}
      {row.nearestReset&&<span style={evidencePill}>{relativeLabel(fight.atSeconds,row.nearestReset)} · RESET</span>}
      {row.nearestPower&&<span style={evidencePill}>{relativeLabel(fight.atSeconds,row.nearestPower)} · POWER</span>}
    </div>
    <p className="muted" style={{fontSize:10,lineHeight:1.45,margin:'10px 0 0'}}>Position coordinates and exact travel route are not exposed by the local Live Client Data feed. This review scores timing around recorded map events; Riot Match Timeline can later upgrade it with minute-by-minute position frames.</p>
  </div>;
}

function collectMoments(analysis?:ProMatchAnalysis|null):Moment[]{
  if(!analysis)return[];
  const out:Moment[]=[];
  addMetric(out,analysis.metrics.objective_readiness,'OBJECTIVE');
  addMetric(out,analysis.metrics.reset_quality,'RESET');
  addMetric(out,analysis.metrics.power_spike_conversion,'POWER');
  addMetric(out,analysis.metrics.farm_fight_tradeoff,'FARM');
  return dedupe(out).sort((a,b)=>a.atSeconds-b.atSeconds);
}
function addMetric(out:Moment[],metric:ProMetric|undefined,kind:MomentKind){
  if(!metric)return;
  for(const e of metric.evidence||[]){if(typeof e.atSeconds==='number')out.push({kind,atSeconds:e.atSeconds,label:e.label,detail:e.detail})}
}
function dedupe(rows:Moment[]){const seen=new Set<string>();return rows.filter(r=>{const key=`${r.kind}:${Math.round(r.atSeconds)}:${r.label}`;if(seen.has(key))return false;seen.add(key);return true})}

function buildTimingRows(fights:FightReview[],moments:Moment[]):TimingRow[]{
  return [...fights].sort((a,b)=>a.atSeconds-b.atSeconds).map(fight=>{
    const objective=nearest(fight.atSeconds,moments.filter(m=>m.kind==='OBJECTIVE'),120);
    const reset=nearest(fight.atSeconds,moments.filter(m=>m.kind==='RESET'),90);
    const power=nearest(fight.atSeconds,moments.filter(m=>m.kind==='POWER'),120);
    let status:TimingRow['status']='NEUTRAL';
    if(fight.outcome==='DEATH'&&objective&&objective.atSeconds>=fight.atSeconds&&objective.atSeconds-fight.atSeconds<=75)status='COSTLY';
    else if(fight.outcome==='DEATH'&&fight.evidence.currentGold>=900)status='RESET';
    else if(fight.outcome!=='DEATH'&&objective&&Math.abs(objective.atSeconds-fight.atSeconds)<=75)status='GOOD';
    const headline=status==='COSTLY'?'Death inside an objective setup window':status==='RESET'?'Fight taken before converting your bank':status==='GOOD'?'Positive conversion around a map window':'Review the rotation timing';
    const detail=objective?`${relationSentence(fight.atSeconds,objective)} ${objective.label}.`:reset?`${relationSentence(fight.atSeconds,reset)} a detected reset/purchase window.`:power?`${relationSentence(fight.atSeconds,power)} a recorded power-spike window.`:'No major objective/reset evidence landed within the local timing window.';
    return{fight,nearestObjective:objective,nearestReset:reset,nearestPower:power,status,headline,detail};
  });
}
function nearest(at:number,rows:Moment[],window:number){let best:Moment|null=null,dist=Infinity;for(const r of rows){const d=Math.abs(r.atSeconds-at);if(d<=window&&d<dist){best=r;dist=d}}return best}

function timerContext(row:TimingRow){
  if(row.nearestObjective){const delta=Math.round(row.nearestObjective.atSeconds-row.fight.atSeconds);if(delta>0)return`This fight happened ${delta}s before ${row.nearestObjective.label}. Treat the final 60 seconds before an important map event as setup time, not free time.`;if(delta<0)return`This fight happened ${Math.abs(delta)}s after ${row.nearestObjective.label}. Ask whether the objective should have ended the play and triggered a reset/return to resources.`;return`This fight landed on the same recorded timing as ${row.nearestObjective.label}.`}
  if(row.nearestReset)return`A reset/purchase signal was close to this fight. The key question is whether you fought before converting enough gold into usable combat power.`;
  if(row.nearestPower)return`A power-spike signal was close to this fight. Good tempo means using that spike deliberately, not drifting around the map waiting for a random fight.`;
  return`No major recorded objective, reset or spike was close enough to blame the timer alone. Judge the fight mainly on state, numbers and purpose.`;
}
function betterMapDecision(row:TimingRow,role:string){
  if(row.status==='COSTLY')return`The better sequence is: finish the nearest safe resource → reset if needed → move early → arrive with HP, items and numbers. Dying inside the last 75 seconds before an objective often costs more than the death itself.`;
  if(row.status==='RESET')return`Bank first when the purchase meaningfully changes your combat state. Roaming with a large pocket bank gives up both lane resources and the stats that gold was supposed to buy.`;
  if(row.status==='GOOD')return`Keep the same principle: convert pressure near meaningful map windows. Repeat the timing, but do not assume every similar fight is good unless the visible state is also favourable.`;
  return role.includes('BOTTOM')||role.includes('ADC')?`As ADC, prefer rotations that preserve farm and put you near the next team objective. Random cross-map movement has a high opportunity cost because missed waves delay your next item.`:`Move for a reason: objective setup, numbers advantage, a pushed wave or a clear punish. If none exists, return to the highest-value safe resource.`;
}
function roamRule(row:TimingRow,role:string){
  if(role.includes('BOTTOM')||role.includes('ADC'))return`ADC roam rule: secure the wave or ensure someone can catch it, then rotate to the nearest high-value play. Do not cross the map for a low-probability chase while two waves are about to die.`;
  if(role.includes('MIDDLE')||role.includes('MID'))return`Mid roam rule: create the window first. Push or neutralise the wave, move on the hidden timing, and turn back if the play does not become clear quickly.`;
  if(role.includes('SUPPORT')||role.includes('UTILITY'))return`Support roam rule: leave when your ADC can safely collect the next wave or is resetting. Your roam should end before your lane partner is forced to contest alone without a reason.`;
  if(role.includes('JUNGLE'))return`Jungle rotation rule: path so your final camp/resource lines up with the next contest. Avoid starting a long opposite-side cycle when the next meaningful map event is already entering its setup window.`;
  if(role.includes('TOP'))return`Top rotation rule: move when the wave state pays for the roam. A map play that costs multiple uncontested waves/tower pressure needs a correspondingly high-value return.`;
  return`Roam only from a created window: safe wave/resource state, a clear numbers edge, or objective setup. Wandering without a return condition is lost tempo.`;
}
function returnRule(role:string){
  if(role.includes('BOTTOM')||role.includes('ADC'))return`Before leaving, choose the resource you are returning to. If the roam has not produced a clear play before that farm is threatened, turn back.`;
  if(role.includes('SUPPORT')||role.includes('UTILITY'))return`Return before your ADC is forced to take an unsafe wave alone, unless the cross-map play is clearly more valuable.`;
  return`Set the return point before moving: next safe wave/camp, purchase timing, or objective reset. If the play is still uncertain when that deadline arrives, stop extending the roam.`;
}

function relationSentence(a:number,m:Moment){const d=Math.round(m.atSeconds-a);return d>=0?`${Math.abs(d)}s before`:`${Math.abs(d)}s after`}
function relativeLabel(a:number,m:Moment){const d=Math.round(m.atSeconds-a);return d>=0?`+${d}s`:`${d}s`}
function clock(seconds:number){const s=Math.max(0,Math.floor(seconds));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}

function RoleRoamRule({role}:{role:string}){return <div style={roleRule}><div className="eyebrow">YOUR ROTATION RULE{role?` · ${roleLabel(role)}`:''}</div><div style={{fontSize:13,lineHeight:1.5,marginTop:5}}>{roamRule({} as TimingRow,role)}</div></div>}
function roleLabel(role:string){if(role.includes('BOTTOM')||role.includes('ADC'))return'ADC';if(role.includes('MIDDLE')||role.includes('MID'))return'MID';if(role.includes('UTILITY')||role.includes('SUPPORT'))return'SUPPORT';return role||'ROLE'}
function StatusPill({status}:{status:TimingRow['status']}){const text=status==='COSTLY'?'OBJECTIVE RISK':status==='RESET'?'RESET LEAK':status==='GOOD'?'GOOD TEMPO':'NEUTRAL';return <span style={{...statusPill,borderColor:status==='GOOD'?'rgba(214,255,47,.28)':status==='NEUTRAL'?'rgba(255,255,255,.12)':'rgba(255,105,105,.3)'}}>{text}</span>}
function Mini({label,value,sub}:{label:string;value:string;sub:string}){return <div style={mini}><div className="eyebrow">{label}</div><strong style={{fontSize:25,display:'block',marginTop:4}}>{value}</strong><div className="muted" style={{fontSize:10,marginTop:3}}>{sub}</div></div>}
function TimerStep({time,title,text}:{time:string;title:string;text:string}){return <div style={timerStep}><strong style={{fontSize:20}}>{time}</strong><div className="eyebrow" style={{marginTop:5}}>{title}</div><div style={{fontSize:11,lineHeight:1.45,marginTop:5}}>{text}</div></div>}
function Block({label,text}:{label:string;text:string}){return <div style={block}><div className="eyebrow">{label}</div><div style={{fontSize:12,lineHeight:1.5,marginTop:5}}>{text}</div></div>}

const proxyPill:React.CSSProperties={padding:'7px 10px',borderRadius:999,border:'1px solid rgba(67,156,255,.28)',fontSize:9,fontWeight:900,letterSpacing:'.08em'};
const summaryGrid:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:8};
const mini:React.CSSProperties={padding:12,border:'1px solid rgba(255,255,255,.08)',borderRadius:12,background:'rgba(255,255,255,.018)'};
const protocolShell:React.CSSProperties={padding:'12px 13px',border:'1px solid rgba(67,156,255,.18)',borderRadius:13,background:'rgba(67,156,255,.025)'};
const summaryStyle:React.CSSProperties={cursor:'pointer',fontSize:11,fontWeight:900,letterSpacing:'.06em'};
const countdownGrid:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8};
const timerStep:React.CSSProperties={padding:11,border:'1px solid rgba(255,255,255,.08)',borderRadius:11};
const roleRule:React.CSSProperties={padding:12,border:'1px solid rgba(214,255,47,.14)',borderRadius:11,background:'rgba(214,255,47,.025)'};
const rowShell:React.CSSProperties={border:'1px solid rgba(255,255,255,.08)',borderRadius:13,overflow:'hidden',background:'rgba(255,255,255,.018)'};
const rowButton:React.CSSProperties={width:'100%',display:'grid',gridTemplateColumns:'72px minmax(0,1fr) auto',gap:12,alignItems:'center',padding:'11px 13px',border:0,background:'transparent',color:'inherit',textAlign:'left',cursor:'pointer'};
const statusPill:React.CSSProperties={padding:'3px 6px',borderRadius:999,border:'1px solid rgba(255,255,255,.1)',fontSize:8,fontWeight:900,letterSpacing:'.06em'};
const detailBody:React.CSSProperties={padding:'12px 14px 14px',borderTop:'1px solid rgba(255,255,255,.07)'};
const detailGrid:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:8};
const block:React.CSSProperties={padding:10,border:'1px solid rgba(255,255,255,.07)',borderRadius:11};
const evidencePill:React.CSSProperties={padding:'5px 7px',borderRadius:999,border:'1px solid rgba(255,255,255,.09)',fontSize:9};
