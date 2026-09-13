'use client';

import {useMemo,useState} from 'react';
import type {FightReview} from './FightDecisionReview';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';

type MomentKind='OBJECTIVE'|'RESET'|'POWER'|'FARM';
type Moment={kind:MomentKind;atSeconds:number;label:string;detail:string};
type TempoStatus='COSTLY'|'RESET'|'GOOD'|'NEUTRAL';
type TempoRow={fight:FightReview;moment:Moment|null;status:TempoStatus;tag:string;delta:string};

const METRICS=[
  ['objective_readiness','OBJECTIVE'],
  ['reset_quality','RESET'],
  ['power_spike_conversion','POWER'],
  ['farm_fight_tradeoff','FARM'],
] as const;

export function VisualMapTempoReview({fights,analysis}:{fights:FightReview[];analysis?:ProMatchAnalysis|null}){
  const [selected,setSelected]=useState(0);
  const role=(analysis?.role||'').toUpperCase();
  const moments=useMemo(()=>collectMoments(analysis),[analysis]);
  const compact=useMemo(()=>dedupeFights(fights),[fights]);
  const rows=useMemo(()=>compact.slice(0,12).map(f=>buildRow(f,moments)),[compact,moments]);
  const active=rows[selected]??rows[0];
  if(!rows.length)return null;

  const objective=rows.filter(r=>r.moment?.kind==='OBJECTIVE').length;
  const costly=rows.filter(r=>r.status==='COSTLY'||r.status==='RESET').length;
  const good=rows.filter(r=>r.status==='GOOD').length;

  return <section className="tempo-visual glass card">
    <div className="tempo-head">
      <div><div className="eyebrow">MAP & TEMPO</div><h2>Fight timing at a glance</h2></div>
      <span className="tempo-proxy">TIMING PROXY</span>
    </div>

    <div className="tempo-scoreboard">
      <TempoScore icon="◎" value={objective} label="OBJECTIVE"/>
      <TempoScore icon="!" value={costly} label="COSTLY" tone="bad"/>
      <TempoScore icon="↗" value={good} label="GOOD TEMPO" tone="good"/>
    </div>

    <div className="tempo-rail" role="list" aria-label="Map and tempo moments">
      {rows.map((row,i)=><button key={`${row.fight.atSeconds}-${i}`} type="button" role="listitem" className={`tempo-node ${row.status.toLowerCase()} ${i===selected?'selected':''}`} onClick={()=>setSelected(i)}>
        <span className="tempo-dot"/>
        <strong>{clock(row.fight.atSeconds)}</strong>
        <b>{row.tag}</b>
        <small>{row.delta}</small>
      </button>)}
    </div>

    {active&&<div className={`tempo-focus ${active.status.toLowerCase()}`}>
      <div className="tempo-focus-time"><span>{clock(active.fight.atSeconds)}</span><small>{active.fight.outcome}</small></div>
      <TempoFact label="STATE" value={stateLabel(active)}/>
      <TempoFact label="MAP WINDOW" value={windowLabel(active)}/>
      <TempoFact label="NEXT RULE" value={roleRule(role,active)}/>
    </div>}

    <div className="tempo-legend"><span><i className="good"/>GOOD</span><span><i className="reset"/>RESET</span><span><i className="costly"/>COSTLY</span><span><i/>CHECK</span><em>Click a timestamp for coaching</em></div>
  </section>;
}

function TempoScore({icon,value,label,tone=''}:{icon:string;value:number;label:string;tone?:string}){return <div className={`tempo-score ${tone}`}><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>}
function TempoFact({label,value}:{label:string;value:string}){return <div className="tempo-fact"><span>{label}</span><b>{value}</b></div>}

function collectMoments(analysis?:ProMatchAnalysis|null):Moment[]{
  if(!analysis)return[];
  const out:Moment[]=[];
  for(const [key,kind] of METRICS){
    const metric=analysis.metrics?.[key];
    for(const e of metric?.evidence??[]){
      if(typeof e.atSeconds==='number')out.push({kind,atSeconds:e.atSeconds,label:e.label,detail:e.detail});
    }
  }
  return out.sort((a,b)=>a.atSeconds-b.atSeconds);
}

function dedupeFights(fights:FightReview[]){
  const sorted=[...fights].sort((a,b)=>a.atSeconds-b.atSeconds);
  return sorted.filter((fight,i)=>{
    const prev=sorted[i-1];
    if(!prev)return true;
    const sameMoment=Math.abs(fight.atSeconds-prev.atSeconds)<=3;
    const sameOutcome=fight.outcome===prev.outcome;
    const sameOpponent=(fight.opponentChampion||fight.opponent)===(prev.opponentChampion||prev.opponent);
    return !(sameMoment&&sameOutcome&&sameOpponent);
  });
}

function buildRow(fight:FightReview,moments:Moment[]):TempoRow{
  const moment=nearest(fight.atSeconds,moments,120);
  let status:TempoStatus='NEUTRAL';
  if(fight.outcome==='DEATH'&&moment?.kind==='OBJECTIVE'&&moment.atSeconds>=fight.atSeconds&&moment.atSeconds-fight.atSeconds<=75)status='COSTLY';
  else if(fight.outcome==='DEATH'&&fight.evidence.currentGold>=900)status='RESET';
  else if(fight.outcome!=='DEATH'&&moment&&(moment.kind==='OBJECTIVE'||moment.kind==='POWER'))status='GOOD';
  const tag=status==='COSTLY'?'LATE SETUP':status==='RESET'?'RESET':status==='GOOD'?'GOOD TEMPO':'CHECK';
  const delta=moment?`${shortKind(moment.kind)} ${relative(fight.atSeconds,moment.atSeconds)}`:'NO MAP SIGNAL';
  return{fight,moment,status,tag,delta};
}

function nearest(at:number,moments:Moment[],window:number){let best:Moment|null=null,bestGap=Infinity;for(const m of moments){const gap=Math.abs(m.atSeconds-at);if(gap<=window&&gap<bestGap){best=m;bestGap=gap}}return best}
function shortKind(kind:MomentKind){return kind==='OBJECTIVE'?'OBJ':kind}
function relative(from:number,to:number){const d=Math.round(to-from);return d===0?'NOW':d>0?`IN ${d}s`:`${Math.abs(d)}s AGO`}
function clock(s:number){const n=Math.max(0,Math.round(s));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}
function stateLabel(row:TempoRow){
  if(row.status==='COSTLY')return 'You died inside the setup window.';
  if(row.status==='RESET')return `${Math.round(row.fight.evidence.currentGold)}g was still unspent.`;
  if(row.status==='GOOD')return 'You converted around a useful timing window.';
  return row.fight.verdict==='THEM_STRONGER'?'Enemy visible state was stronger.':row.fight.verdict==='YOU_STRONGER'?'Your visible state was stronger.':'Visible power was close.';
}
function windowLabel(row:TempoRow){if(!row.moment)return 'No strong objective/reset/spike signal nearby.';return `${row.moment.label} · ${relative(row.fight.atSeconds,row.moment.atSeconds)}`}
function roleRule(role:string,row:TempoRow){
  if(row.status==='RESET')return 'Spend first. Re-enter with purchased power.';
  if(row.status==='COSTLY')return 'Start setup 45–60s earlier; stop taking side actions.';
  if(role.includes('BOTTOM')||role.includes('ADC'))return 'Secure the nearest safe wave, then move behind your frontline.';
  if(role.includes('JUNGLE'))return 'Finish pathing toward the objective side; arrive healthy with Smite.';
  if(role.includes('MIDDLE')||role.includes('MID'))return 'Push or neutralise mid, then move with jungle/support.';
  if(role.includes('SUPPORT')||role.includes('UTILITY'))return 'Move with jungle, establish the first safe vision line.';
  if(role.includes('TOP'))return 'Fix the side wave early; do not force your team to stall 4v5.';
  return 'Finish the nearest safe resource, then move before contact starts.';
}
