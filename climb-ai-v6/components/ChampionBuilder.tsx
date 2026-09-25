'use client';
import {useEffect,useMemo,useState} from 'react';
import {combatProfile} from '@/lib/champions/dps';
import {buildStats,MAX_BUILD_SIZE,type BestBuild,type BuildItem} from '@/lib/champions/build';
import type {RawDamageBuild} from '@/lib/champions/rawDamageBuild';
import {statsAtLevel,type ChampionStatBlock} from '@/lib/champions/ddragon';

export function ChampionBuilder({
  champion,stats,level,catalogue,maxDps,maxRawDamage,budget,onBuildChange,presetBuild,presetKey,
}:{
  champion:string;
  stats:ChampionStatBlock;
  level:number;
  catalogue:BuildItem[];
  maxDps:BestBuild;
  maxRawDamage?:RawDamageBuild;
  bySize:BestBuild[];
  budget:number|null;
  onBuildChange?:(items:BuildItem[])=>void;
  presetBuild?:BuildItem[];
  presetKey?:number;
}){
  const [picked,setPicked]=useState<BuildItem[]>([]);
  const [query,setQuery]=useState('');
  const bonuses=useMemo(()=>buildStats(picked),[picked]);
  const current=useMemo(()=>combatProfile(stats,level,bonuses),[stats,level,bonuses]);
  const levelStats=useMemo(()=>statsAtLevel(stats,level),[stats,level]);
  const gold=picked.reduce((sum,item)=>sum+item.gold,0);
  const full=picked.length>=MAX_BUILD_SIZE;

  useEffect(()=>{
    if(presetKey===undefined)return;
    const next=presetBuild??[];
    setPicked(next);
    onBuildChange?.(next);
  },[presetKey,presetBuild,onBuildChange]);

  const update=(next:BuildItem[])=>{
    setPicked(next);
    onBuildChange?.(next);
  };
  const add=(item:BuildItem)=>{
    if(full||picked.some(p=>p.id===item.id))return;
    update([...picked,item]);
    setQuery('');
  };
  const remove=(id:number)=>update(picked.filter(p=>p.id!==id));

  const matches=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return[];
    return catalogue
      .filter(item=>!picked.some(p=>p.id===item.id))
      .filter(item=>item.name.toLowerCase().includes(q))
      .sort((a,b)=>a.name.localeCompare(b.name))
      .slice(0,36);
  },[catalogue,picked,query]);

  return <section className="mc-simulator">
    <div className="mc-section-head">
      <div><div className="eyebrow">BUILD SIMULATOR</div><h2>Change the build. Watch the numbers move.</h2></div>
      <div className="mc-sim-actions">
        {maxRawDamage?.items.length?<button className="btn secondary" type="button" onClick={()=>update(maxRawDamage.items)}>LOAD MAX DAMAGE</button>
          :maxDps.items.length>0&&<button className="btn secondary" type="button" onClick={()=>update(maxDps.items)}>LOAD AUTO DPS BUILD</button>}
        {picked.length>0&&<button className="btn secondary" type="button" onClick={()=>update([])}>CLEAR</button>}
      </div>
    </div>

    <div className="mc-build-slots">
      {Array.from({length:MAX_BUILD_SIZE},(_,index)=>{
        const item=picked[index];
        return <div className={'mc-build-slot'+(item?' filled':'')} key={index}>
          {item?<button type="button" onClick={()=>remove(item.id)} title={'Remove '+item.name}>
            {item.icon?<img src={item.icon} alt="" aria-hidden="true"/>:<span className="mc-item-fallback">{item.name.slice(0,2)}</span>}
            <span><b>{item.name}</b><small>{item.gold}g · remove</small></span>
          </button>:<div className="mc-empty-slot"><b>+</b><span>ITEM {index+1}</span></div>}
        </div>;
      })}
    </div>

    <div className="mc-item-search">
      <div className="field">
        <label>Add an item</label>
        <input className="input" value={query} disabled={full}
          placeholder={full?'Remove an item first':'Search completed items…'}
          onChange={event=>setQuery(event.target.value)}/>
      </div>
      <div className="mc-spend"><span>BUILD COST</span><b>{gold.toLocaleString()}g</b>{budget!==null&&<small>Budget set: {budget.toLocaleString()}g</small>}</div>
    </div>

    {matches.length>0&&<div className="mc-item-results">
      {matches.map(item=><button key={item.id} type="button" onClick={()=>add(item)}>
        {item.icon?<img src={item.icon} alt="" aria-hidden="true"/>:<span className="mc-item-fallback">{item.name.slice(0,2)}</span>}
        <span><b>{item.name}</b><small>{item.gold}g</small></span>
      </button>)}
    </div>}

    <div className="mc-build-stats">
      <Stat label="AP" value={current.abilityPower}/>
      <Stat label="AD" value={current.attackDamage}/>
      <Stat label="ATTACK SPEED" value={current.attackSpeed.toFixed(2)}/>
      <Stat label="CRIT" value={Math.round(current.critChance*100)+'%'}/>
      <Stat label="HEALTH" value={Math.round(levelStats.hp+bonuses.health)}/>
      <Stat label="MANA" value={Math.round(levelStats.mana+bonuses.mana)}/>
      <Stat label="AUTO DPS" value={current.dps}/>
    </div>
    <p className="mc-sim-note">These stats use {champion}&apos;s level {level} base stats plus the items above. The ability table below uses the same build instantly.</p>
  </section>;
}

function Stat({label,value}:{label:string;value:string|number}){
  return <div><span>{label}</span><b>{value}</b></div>;
}
