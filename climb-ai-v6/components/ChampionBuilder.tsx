'use client';
import {useMemo,useState} from 'react';
import {combatProfile,type CombatProfile} from '@/lib/champions/dps';
import {buildStats,MAX_BUILD_SIZE,orderForBuying,type BestBuild,type BuildItem} from '@/lib/champions/build';
import type {ChampionStatBlock} from '@/lib/champions/ddragon';

/**
 * Pick items, see the DPS.
 *
 * Everything recomputes in the browser from the champion's base stats and the
 * item stats, so adding an item is instant — the same arithmetic the server
 * uses, not an approximation of it.
 */

export function ChampionBuilder({
  champion,stats,level,catalogue,maxDps,bySize,budget,onBuildChange,
}:{
  champion:string;
  stats:ChampionStatBlock;
  level:number;
  catalogue:BuildItem[];
  maxDps:BestBuild;
  /** Best build at each size, so a partial build is judged against its own size. */
  bySize:BestBuild[];
  budget:number|null;
  onBuildChange?:(items:BuildItem[])=>void;
}){
  const [picked,setPicked]=useState<BuildItem[]>([]);
  const [query,setQuery]=useState('');

  const bare=useMemo(()=>combatProfile(stats,level),[stats,level]);
  const current=useMemo(
    ()=>combatProfile(stats,level,buildStats(picked)),
    [stats,level,picked]);
  const steps=useMemo(
    ()=>picked.length?orderForBuying(stats,level,picked):[],
    [stats,level,picked]);

  const gold=picked.reduce((g,i)=>g+i.gold,0);
  const full=picked.length>=MAX_BUILD_SIZE;

  const update=(next:BuildItem[])=>{setPicked(next);onBuildChange?.(next)};
  const add=(item:BuildItem)=>{
    if(full||picked.some(p=>p.id===item.id))return;
    update([...picked,item]);
  };
  const remove=(id:number)=>update(picked.filter(p=>p.id!==id));

  const matches=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return catalogue
      .filter(i=>!picked.some(p=>p.id===i.id))
      .filter(i=>!q||i.name.toLowerCase().includes(q))
      .sort((a,b)=>a.name.localeCompare(b.name))
      .slice(0,q?40:0);
  },[catalogue,picked,query]);

  // Compared against the best build of the SAME size. Comparing a one-item
  // build against the six-item maximum reported a 1,095 DPS shortfall for what
  // was in fact the best single item in the game.
  const sameSizeBest=picked.length?bySize[picked.length-1]:undefined;
  const gapToSameSize=sameSizeBest
    ?Math.round((sameSizeBest.dps-current.dps)*10)/10
    :null;
  const gapToMax=Math.round((maxDps.dps-current.dps)*10)/10;

  return <div className="glass card" style={{marginTop:16}}>
    <div className="eyebrow">BUILD {champion.toUpperCase()} · LEVEL {level}</div>
    <h2>Pick items and watch the damage</h2>

    <div className="build-slots">
      {Array.from({length:MAX_BUILD_SIZE},(_,i)=>{
        const item=picked[i];
        return <div key={i} className={`build-slot${item?' filled':''}`}>
          {item
            ?<button type="button" onClick={()=>remove(item.id)} title="Remove">
              <b>{item.name}</b><small>{item.gold}g · remove</small>
            </button>
            :<span className="build-slot-empty">Empty</span>}
        </div>;
      })}
    </div>

    <div className="field" style={{marginTop:14}}>
      <label>Add an item{full?' — all six slots full':''}</label>
      <input className="input" value={query} disabled={full}
        placeholder={full?'Remove one to add another':'Search the 112 completed items…'}
        onChange={e=>setQuery(e.target.value)}/>
    </div>

    {matches.length>0&&
      <div className="item-picker">
        {matches.map(i=>
          <button key={i.id} type="button" className="item-pick" onClick={()=>{add(i);setQuery('')}}>
            <b>{i.name}</b><small>{i.gold}g</small>
          </button>)}
      </div>}

    <div className="grid four" style={{marginTop:18}}>
      <Stat label="DPS" value={current.dps} delta={current.dps-bare.dps}/>
      <Stat label="ATTACK DAMAGE" value={current.attackDamage} delta={current.attackDamage-bare.attackDamage}/>
      <Stat label="ATTACK SPEED" value={current.attackSpeed.toFixed(2)}
        delta={current.attackSpeed-bare.attackSpeed} precision={2}/>
      <Stat label="CRIT" value={`${Math.round(current.critChance*100)}%`}/>
    </div>

    <div className="build-summary">
      <span>Spent <b>{gold}g</b>{budget!==null&&<> of <b>{budget}g</b></>}</span>
      <span>
        {picked.length===0
          ?'No items yet.'
          :gapToSameSize!==null&&gapToSameSize<=0.05
            ?`Best ${picked.length}-item build found${gapToMax>0.05?` — ${gapToMax} DPS below a full six items.`:'.'}`
            :`${gapToSameSize} DPS below the best ${picked.length}-item build found.`}
      </span>
    </div>

    {current.attackSpeedCapped&&
      <p className="build-warning">
        Attack speed is at the game cap of 2.5. More attack speed adds nothing from here.
      </p>}

    {steps.length>0&&
      <div style={{overflowX:'auto',marginTop:16}}>
        <table className="table">
          <thead><tr><th>Buy order</th><th>DPS added</th><th>DPS after</th><th>Spent</th></tr></thead>
          <tbody>{steps.map((s,i)=>
            <tr key={s.name}>
              <td>{i+1}. {s.name}</td>
              <td>{s.gain>0?`+${s.gain}`:'—'}</td>
              <td>{s.dpsAfter}</td>
              <td>{s.goldAfter}g</td>
            </tr>)}
          </tbody>
        </table>
        <p className="muted" style={{marginTop:10,fontSize:12}}>
          Ordered by which item pays off soonest on its own — not a recommended build path,
          which depends on what the enemy is doing.
        </p>
      </div>}
  </div>;
}

function Stat({label,value,delta,precision=1}:{
  label:string;value:string|number;delta?:number;precision?:number;
}){
  const shown=delta!==undefined&&Math.abs(delta)>=(precision===2?0.01:0.05)
    ?`${delta>0?'+':''}${delta.toFixed(precision)}`
    :null;
  return <div className="glass card">
    <div className="label">{label}</div>
    <div className="metric">{value}</div>
    {shown&&<div className="stat-delta">{shown}</div>}
  </div>;
}

export type {CombatProfile};
