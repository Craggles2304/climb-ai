'use client';
import {useEffect,useState} from 'react';
import type {ChampionProfile,StatPercentile} from '@/lib/champions/profile';
import {ordinal,type LevelStats} from '@/lib/champions/ddragon';

type WireProfile=Omit<ChampionProfile,'atLevel'>&{statsByLevel:Record<string,LevelStats>};
type Payload={ok:boolean;error?:string;patch?:string;profile?:WireProfile};

const PCT_LABEL:Record<StatPercentile['stat'],string>={
  HP:'Health',ARMOR:'Armour',MAGIC_RESIST:'Magic resist',ATTACK_DAMAGE:'Attack damage',
  ATTACK_SPEED:'Attack speed',ATTACK_RANGE:'Attack range',MOVE_SPEED:'Move speed',
};
const SHOWN:StatPercentile['stat'][]=['HP','ARMOR','ATTACK_DAMAGE','ATTACK_RANGE'];

function collapseWindows(windows:ChampionProfile['allInWindows']){
  const groups:{label:string;fact:string;inference:string}[]=[];
  for(const w of windows){
    const previous=groups[groups.length-1];
    const sameAsPrevious=previous&&previous.fact.includes(`${w.cooldownSeconds}s after use`);
    if(sameAsPrevious){previous.label=`${previous.label.split('–')[0]}–R${w.rank}`;previous.fact=`${w.ability} is unavailable for ${w.cooldownSeconds}s after use.`;continue}
    groups.push({label:`R${w.rank}`,fact:w.fact,inference:w.inference});
  }
  return groups;
}

export function ChampionDataPanel({champion,depth=10}:{champion:string;depth?:number}){
  const [data,setData]=useState<Payload|null>(null);
  const limit=depth<=1?1:depth<=3?2:depth<=5?3:4;

  useEffect(()=>{
    let live=true;
    fetch(`/api/champions?champion=${encodeURIComponent(champion)}`)
      .then(r=>r.json()).then(d=>{if(live)setData(d)})
      .catch(()=>{if(live)setData({ok:false,error:'Could not reach champion data.'})});
    return ()=>{live=false};
  },[champion]);

  if(!data)return <div className="glass card" style={{marginTop:16}}><p className="muted">Reading champion data…</p></div>;
  if(!data.ok||!data.profile)return <div className="glass card" style={{marginTop:16}}><div className="eyebrow">CHAMPION DATA</div><p className="muted">{data.error??'Champion data is unavailable right now.'}</p></div>;

  const p=data.profile;
  const percentiles=p.percentiles.filter(x=>SHOWN.includes(x.stat)).slice(0,limit);

  return <>
    {p.spikes.length>0&&<div className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">POWER SPIKES{depth>=4?` · PATCH ${data.patch}`:''}</div>
      <h2>{depth<=2?`When ${p.name} gets strong`:`When ${p.name} gets stronger`}</h2>
      <div className="spike-list">{p.spikes.slice(0,limit).map(s=><div className="spike" key={`${s.level}-${s.kind}`}><div className="spike-level">L{s.level}</div><div><b>{s.title}</b><p className="spike-fact">{s.fact}</p>{depth>=3&&s.inference&&<p>{s.inference}</p>}</div></div>)}</div>
    </div>}

    {depth>=4&&p.allInWindows.length>0&&<div className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">ALL-IN WINDOWS</div><h2>{p.allInWindows[0].ability}</h2>
      <div className="spike-list">{collapseWindows(p.allInWindows).slice(0,limit).map(w=><div className="spike" key={w.label}><div className="spike-level">{w.label}</div><div><p className="spike-fact">{w.fact}</p>{depth>=6&&<p>{w.inference}</p>}</div></div>)}</div>
    </div>}

    {depth>=5&&percentiles.length>0&&<div className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">AGAINST THE ROSTER · LEVEL 11</div><h2>Where {p.name} sits</h2>
      <div className="pct-grid">{percentiles.map(x=><div key={x.stat}><span>{PCT_LABEL[x.stat].toUpperCase()}</span><strong>{x.value}</strong><small>{ordinal(x.percentile)} percentile</small></div>)}</div>
      {depth>=7&&p.scaling.slice(0,limit).map(s=><p className="muted" key={s.stat} style={{marginTop:12}}>{s.fact}</p>)}
    </div>}

    <div className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">{depth<=2?'YOUR SIMPLE LANE PLAN':'LANE PLAN FROM THE NUMBERS'}</div>
      <ol className="matchup-plan">{p.lanePlan.slice(0,limit).map((x,i)=><li key={x}><span>0{i+1}</span><p>{x}</p></li>)}</ol>
    </div>

    {depth>=6&&p.riotAllyTips.length>0&&<div className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">RIOT&rsquo;S OWN TIPS FOR PLAYING {p.name.toUpperCase()}</div>
      <ul className="riot-tips">{p.riotAllyTips.slice(0,limit).map(t=><li key={t}>{t}</li>)}</ul>
      {depth>=8&&<p className="muted">Published by Riot Games in {p.name}&rsquo;s champion data, quoted unchanged.</p>}
    </div>}

    {depth>=8&&p.unavailable.length>0&&<div className="glass card data-note" style={{marginTop:16}}>
      <div className="eyebrow">DATA LIMITS</div><ul className="riot-tips">{p.unavailable.slice(0,limit).map(u=><li key={u}>{u}</li>)}</ul>
    </div>}
  </>;
}
