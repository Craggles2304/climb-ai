'use client';
import {useEffect,useState} from 'react';
import type {ChampionProfile,StatPercentile} from '@/lib/champions/profile';
import {ordinal,type LevelStats} from '@/lib/champions/ddragon';

/**
 * Power spikes, all-in windows and roster percentiles for one champion, read
 * from Riot's public champion data.
 *
 * This sits alongside the hand-written champion plans rather than replacing
 * them: the plans are opinion, this is measurement, and the page says which is
 * which. It works for all 170-odd champions, where the hand-written plans
 * cover three.
 */

/** atLevel is a function, so the API resolves the levels the UI shows. */
type WireProfile=Omit<ChampionProfile,'atLevel'>&{statsByLevel:Record<string,LevelStats>};
type Payload={ok:boolean;error?:string;patch?:string;profile?:WireProfile};

const PCT_LABEL:Record<StatPercentile['stat'],string>={
  HP:'Health',ARMOR:'Armour',MAGIC_RESIST:'Magic resist',ATTACK_DAMAGE:'Attack damage',
  ATTACK_SPEED:'Attack speed',ATTACK_RANGE:'Attack range',MOVE_SPEED:'Move speed',
};

const SHOWN:StatPercentile['stat'][]=['HP','ARMOR','ATTACK_DAMAGE','ATTACK_RANGE'];

/**
 * Ranks that share a cooldown become one row. Caitlyn's ultimate is 90s at
 * every rank, and printing the same sentence three times reads as padding
 * rather than as the fact that it never improves.
 */
function collapseWindows(windows:ChampionProfile['allInWindows']){
  const groups:{label:string;fact:string;inference:string}[]=[];
  for(const w of windows){
    const previous=groups[groups.length-1];
    const sameAsPrevious=previous&&previous.fact.includes(`${w.cooldownSeconds}s after use`);
    if(sameAsPrevious){
      previous.label=`${previous.label.split('–')[0]}–R${w.rank}`;
      // The label carries which ranks, so the sentence does not repeat it.
      previous.fact=`${w.ability} is unavailable for ${w.cooldownSeconds}s after use.`;
      continue;
    }
    groups.push({label:`R${w.rank}`,fact:w.fact,inference:w.inference});
  }
  return groups;
}

export function ChampionDataPanel({champion}:{champion:string}){
  const [data,setData]=useState<Payload|null>(null);

  useEffect(()=>{
    let live=true;
    fetch(`/api/champions?champion=${encodeURIComponent(champion)}`)
      .then(r=>r.json())
      .then(d=>{if(live)setData(d)})
      .catch(()=>{if(live)setData({ok:false,error:'Could not reach champion data.'})});
    return ()=>{live=false};
  },[champion]);

  if(!data)
    return <div className="glass card" style={{marginTop:16}}><p className="muted">Reading champion data…</p></div>;

  if(!data.ok||!data.profile)
    return <div className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">CHAMPION DATA</div>
      <p className="muted">{data.error??'Champion data is unavailable right now.'}</p>
    </div>;

  const p=data.profile;
  const percentiles=p.percentiles.filter(x=>SHOWN.includes(x.stat));

  return <>
    {p.spikes.length>0&&
      <div className="glass card" style={{marginTop:16}}>
        <div className="eyebrow">POWER SPIKES · PATCH {data.patch}</div>
        <h2>When {p.name} gets stronger</h2>
        <div className="spike-list">
          {p.spikes.map(s=>
            <div className="spike" key={`${s.level}-${s.kind}`}>
              <div className="spike-level">L{s.level}</div>
              <div>
                <b>{s.title}</b>
                <p className="spike-fact">{s.fact}</p>
                {s.inference&&<p>{s.inference}</p>}
              </div>
            </div>)}
        </div>
      </div>}

    {p.allInWindows.length>0&&
      <div className="glass card" style={{marginTop:16}}>
        <div className="eyebrow">ALL-IN WINDOWS</div>
        <h2>{p.allInWindows[0].ability}</h2>
        <div className="spike-list">
          {collapseWindows(p.allInWindows).map(w=>
            <div className="spike" key={w.label}>
              <div className="spike-level">{w.label}</div>
              <div><p className="spike-fact">{w.fact}</p><p>{w.inference}</p></div>
            </div>)}
        </div>
      </div>}

    {percentiles.length>0&&
      <div className="glass card" style={{marginTop:16}}>
        <div className="eyebrow">AGAINST THE ROSTER · LEVEL 11</div>
        <h2>Where {p.name} sits</h2>
        <div className="pct-grid">
          {percentiles.map(x=>
            <div key={x.stat}>
              <span>{PCT_LABEL[x.stat].toUpperCase()}</span>
              <strong>{x.value}</strong>
              <small>{ordinal(x.percentile)} percentile</small>
            </div>)}
        </div>
        {p.scaling.map(s=><p className="muted" key={s.stat} style={{marginTop:12}}>{s.fact}</p>)}
      </div>}

    <div className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">LANE PLAN FROM THE NUMBERS</div>
      <ol className="matchup-plan">
        {p.lanePlan.map((x,i)=><li key={x}><span>0{i+1}</span><p>{x}</p></li>)}
      </ol>
    </div>

    {p.riotAllyTips.length>0&&
      <div className="glass card" style={{marginTop:16}}>
        <div className="eyebrow">RIOT&rsquo;S OWN TIPS FOR PLAYING {p.name.toUpperCase()}</div>
        <ul className="riot-tips">{p.riotAllyTips.map(t=><li key={t}>{t}</li>)}</ul>
        <p className="muted">Published by Riot Games in {p.name}&rsquo;s champion data, quoted unchanged.</p>
      </div>}

    {p.unavailable.length>0&&
      <div className="glass card data-note" style={{marginTop:16}}>
        <div className="eyebrow">NOT DERIVABLE FROM CHAMPION DATA</div>
        <ul className="riot-tips">{p.unavailable.map(u=><li key={u}>{u}</li>)}</ul>
      </div>}
  </>;
}
