'use client';
import {useEffect,useMemo,useState} from 'react';
import dynamic from 'next/dynamic';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {getMainChampion,setMainChampion,MAIN_CHAMPION_EVENT} from '@/lib/mainChampion';
import {addStats,emptyStats,dpsCurve,type ItemValue,type DpsPoint,type CombatProfile} from '@/lib/champions/dps';
import type {MatchupRanking,MatchupScore} from '@/lib/champions/ranking';
import type {ChampionStatBlock} from '@/lib/champions/ddragon';
import type {BestBuild,BuildItem} from '@/lib/champions/build';
import type {SkillOrder} from '@/lib/champions/skillOrder';
import {ChampionBuilder} from '@/components/ChampionBuilder';
import {MaxDpsTable,SkillOrderTable} from '@/components/MaxDpsTables';

/** Recharts is heavy, so it stays out of the shared bundle. */
const DpsCurve=dynamic(()=>import('@/components/DpsCurve').then(m=>m.DpsCurve),{
  ssr:false,
  loading:()=><div className="glass card" style={{marginTop:16}}><p className="muted">Drawing the damage curve…</p></div>,
});

/**
 * The main-champion page: damage curve, what every item is worth, and every
 * matchup ranked with the reasoning behind each score.
 *
 * It is gated behind picking a main on purpose. All of this is one champion's
 * stat line in depth, which is useful to someone who plays that champion and
 * noise to everyone else.
 */

type Payload={
  ok:boolean;error?:string;patch?:string;level?:number;
  champion?:{id:string;name:string;title:string;tags:string[];attackRange:number;
    info:{attack:number;defense:number;magic:number;difficulty:number};autoAttackReliant:boolean;
    stats:ChampionStatBlock};
  dps?:{curve:DpsPoint[];atLevel:CombatProfile};
  items?:{best:ItemValue[];worst:ItemValue[];all:ItemValue[];damageItemCount:number;totalCount:number};
  build?:{catalogue:BuildItem[];maxDps:BestBuild;bySize:BestBuild[];budget:number|null};
  skillOrder?:SkillOrder;
  ranking?:MatchupRanking|null;
  names?:string[];
};

const LANE_TAGS=['Marksman','Mage','Fighter','Tank','Assassin','Support'];

export default function MainChampion(){
  const [main,setMain]=useState<string|null>(null);
  const [ready,setReady]=useState(false);
  const [draft,setDraft]=useState('');
  const [level,setLevel]=useState(11);
  const [tags,setTags]=useState<string[]>([]);
  const [budget,setBudget]=useState<number|''>('');
  const [data,setData]=useState<Payload|null>(null);
  const [loading,setLoading]=useState(false);
  const [compare,setCompare]=useState<ItemValue|null>(null);
  const [tab,setTab]=useState<'strong'|'weak'|'all'>('strong');
  const [open,setOpen]=useState<string|null>(null);

  // localStorage is only readable on the client, so the picker must not flash
  // before we know whether a main is already set.
  useEffect(()=>{
    setMain(getMainChampion());
    setReady(true);
    const onChange=()=>setMain(getMainChampion());
    window.addEventListener(MAIN_CHAMPION_EVENT,onChange);
    return ()=>window.removeEventListener(MAIN_CHAMPION_EVENT,onChange);
  },[]);

  useEffect(()=>{
    if(!main)return;
    let live=true;
    setLoading(true);
    const params=new URLSearchParams({champion:main,level:String(level)});
    if(tags.length)params.set('tags',tags.join(','));
    if(budget!=='')params.set('budget',String(budget));
    fetch(`/api/champions/main?${params}`)
      .then(r=>r.json())
      .then(d=>{if(live){setData(d);setCompare(null)}})
      .catch(()=>{if(live)setData({ok:false,error:'Could not reach champion data.'})})
      .finally(()=>{if(live)setLoading(false)});
    return ()=>{live=false};
  },[main,level,tags,budget]);

  // Recomputed client-side so picking a different item to compare is instant
  // rather than a round trip.
  const withItemCurve=useMemo(()=>{
    if(!compare||!data?.champion?.stats)return undefined;
    return dpsCurve(data.champion.stats,addStats(emptyStats(),compare.stats));
  },[compare,data]);

  if(!ready)return <AppShell><PageHead title="Main champion" subtitle="Loading."/></AppShell>;

  if(!main)
    return <AppShell>
      <PageHead title="Pick your main"
        subtitle="This page goes deep on one champion: damage, items and every matchup."/>
      <div className="glass card form">
        <div className="field">
          <label>Which champion do you main?</label>
          <input className="input" value={draft} placeholder="e.g. Caitlyn"
            onChange={e=>setDraft(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&draft.trim())setMainChampion(draft.trim())}}/>
        </div>
        <button className="btn primary" disabled={!draft.trim()}
          onClick={()=>setMainChampion(draft.trim())}>SET AS MY MAIN</button>
        <p className="muted" style={{marginTop:14,fontSize:13}}>
          You can change this any time. It is stored in this browser only.
        </p>
      </div>
    </AppShell>;

  const c=data?.champion;
  const ranking=data?.ranking;
  const shown=tab==='strong'?ranking?.strongest:tab==='weak'?ranking?.weakest:ranking?.all;

  return <AppShell>
    <PageHead
      title={c?c.name.toUpperCase():main.toUpperCase()}
      subtitle={c?`${c.title} · ${c.tags.join(' / ')} · your main`:'Loading champion data…'}
      action={<button className="btn secondary" onClick={()=>setMainChampion('')}>CHANGE MAIN</button>}/>

    <div className="glass card form" style={{maxWidth:'none'}}>
      <div className="grid three">
        <div className="field"><label>Champion</label>
          <input className="input" list="all-champions" value={main}
            onChange={e=>setMainChampion(e.target.value)}/>
          <datalist id="all-champions">
            {(data?.names??[]).map(n=><option key={n} value={n}/>)}
          </datalist>
        </div>
        <div className="field"><label>Level</label>
          <select className="input" value={level} onChange={e=>setLevel(Number(e.target.value))}>
            {[1,2,3,6,9,11,13,16,18].map(l=><option key={l} value={l}>Level {l}</option>)}
          </select>
        </div>
        <div className="field"><label>Gold budget (optional)</label>
          <input className="input" type="number" min={0} step={500} value={budget}
            placeholder="No limit"
            onChange={e=>setBudget(e.target.value===''?'':Math.max(0,Number(e.target.value)))}/>
        </div>
        <div className="field" style={{gridColumn:'span 2'}}>
          <label>Only compare against</label>
          <div className="tag-row">
            {LANE_TAGS.map(t=>
              <button key={t} type="button"
                className={`tag-chip${tags.includes(t)?' active':''}`}
                onClick={()=>setTags(tags.includes(t)?tags.filter(x=>x!==t):[...tags,t])}>
                {t}
              </button>)}
            {tags.length>0&&
              <button type="button" className="tag-chip clear" onClick={()=>setTags([])}>Clear</button>}
          </div>
        </div>
      </div>
    </div>

    {loading&&!data?.ok&&
      <div className="glass card" style={{marginTop:16}}><p className="muted">Reading champion data…</p></div>}

    {data&&!data.ok&&
      <div className="glass card" style={{marginTop:16}}>
        <h2>Could not load {main}.</h2>
        <p className="muted">{data.error}</p>
        <button className="btn secondary" style={{marginTop:12}} onClick={()=>setMainChampion('')}>PICK A DIFFERENT CHAMPION</button>
      </div>}

    {data?.ok&&c&&data.dps&&<>
      {!c.autoAttackReliant&&
        <div className="glass card data-note" style={{marginTop:16}}>
          <div className="eyebrow">READ THIS FIRST</div>
          <p className="muted">
            Riot rates {c.name}&rsquo;s damage as mostly magic ({c.info.magic}/10 magic
            against {c.info.attack}/10 attack). The damage numbers below are auto-attacks
            only, so for {c.name} they describe a minority of what you actually do. An
            item showing no damage gain here is <b>not</b> a bad item on {c.name} —
            Riot stopped publishing ability coefficients, so ability damage cannot be
            calculated by anyone from this data.
          </p>
        </div>}

      <div className="grid four" style={{marginTop:16}}>
        <div className="glass card"><div className="label">DPS AT {level}</div><div className="metric">{data.dps.atLevel.dps}</div></div>
        <div className="glass card"><div className="label">ATTACK DAMAGE</div><div className="metric">{data.dps.atLevel.attackDamage}</div></div>
        <div className="glass card"><div className="label">ATTACK SPEED</div><div className="metric">{data.dps.atLevel.attackSpeed.toFixed(2)}</div></div>
        <div className="glass card"><div className="label">ATTACK RANGE</div><div className="metric">{c.attackRange}</div></div>
      </div>

      <DpsCurve base={data.dps.curve} withItem={withItemCurve} itemName={compare?.name}/>

      {data.build&&
        <ChampionBuilder
          champion={c.name} stats={c.stats} level={level}
          catalogue={data.build.catalogue} maxDps={data.build.maxDps} bySize={data.build.bySize}
          budget={data.build.budget}/>}

      {data.build&&
        <MaxDpsTable
          champion={c.name} level={level}
          maxDps={data.build.maxDps} bySize={data.build.bySize}
          budget={data.build.budget}/>}

      {data.skillOrder&&<SkillOrderTable order={data.skillOrder}/>}

      {data.items&&<>
        <div className="glass card" style={{marginTop:16}}>
          <div className="eyebrow">ITEMS · MOST AUTO-ATTACK DAMAGE PER 1000 GOLD</div>
          <h2>Best value damage on {c.name}</h2>
          <p className="muted">
            {data.items.damageItemCount} of {data.items.totalCount} completed items add
            auto-attack damage on {c.name}, measured at level {level} with nothing else built.
          </p>
          <div style={{overflowX:'auto',marginTop:14}}>
            <table className="table">
              <thead><tr><th>Item</th><th>Cost</th><th>DPS added</th><th>Per 1000g</th><th>Effective HP</th></tr></thead>
              <tbody>{data.items.best.map(v=>
                <tr key={v.id} className={`item-row${compare?.id===v.id?' active':''}`}
                  onClick={()=>setCompare(compare?.id===v.id?null:v)}>
                  <td>{v.name}</td><td>{v.gold}g</td><td>+{v.dpsGain}</td>
                  <td><b>{v.dpsPerThousandGold}</b></td><td>{v.ehpGain>0?`+${v.ehpGain}`:'—'}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass card" style={{marginTop:16}}>
          <div className="eyebrow">ITEMS · LEAST AUTO-ATTACK DAMAGE PER 1000 GOLD</div>
          <h2>Weakest value for damage</h2>
          <p className="muted">
            These still add damage, just least per gold. Items that add none at all are
            excluded from this ranking rather than placed last on a scale they do not belong to.
          </p>
          <div style={{overflowX:'auto',marginTop:14}}>
            <table className="table">
              <thead><tr><th>Item</th><th>Cost</th><th>DPS added</th><th>Per 1000g</th><th>Note</th></tr></thead>
              <tbody>{data.items.worst.map(v=>
                <tr key={v.id}>
                  <td>{v.name}</td><td>{v.gold}g</td><td>+{v.dpsGain}</td>
                  <td><b>{v.dpsPerThousandGold}</b></td>
                  <td className="muted" style={{fontSize:12}}>{v.note??'—'}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass card" style={{marginTop:16}}>
          <div className="eyebrow">EVERY COMPLETED ITEM · {data.items.totalCount} ON THE RIFT</div>
          <div style={{overflowX:'auto',marginTop:14,maxHeight:460}}>
            <table className="table">
              <thead><tr><th>Item</th><th>Cost</th><th>DPS</th><th>Effective HP</th><th>AP</th><th>Note</th></tr></thead>
              <tbody>{data.items.all.map(v=>
                <tr key={v.id}>
                  <td>{v.name}</td><td>{v.gold}g</td>
                  <td>{v.dpsGain>0?`+${v.dpsGain}`:'—'}</td>
                  <td>{v.ehpGain>0?`+${v.ehpGain}`:'—'}</td>
                  <td>{v.abilityPowerGain>0?`+${v.abilityPowerGain}`:'—'}</td>
                  <td className="muted" style={{fontSize:12}}>{v.note??''}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </>}

      {ranking&&<>
        <div className="glass card" style={{marginTop:16}}>
          <div className="section-row">
            <div>
              <div className="eyebrow">MATCHUPS · STAT LINE AT LEVEL {level}</div>
              <h2 style={{margin:'6px 0 0'}}>{ranking.all.length} matchups ranked</h2>
            </div>
            <div className="tag-row">
              {([['strong','Biggest edge'],['weak','Smallest edge'],['all','All']] as const).map(([k,label])=>
                <button key={k} type="button" className={`tag-chip${tab===k?' active':''}`}
                  onClick={()=>setTab(k)}>{label}</button>)}
            </div>
          </div>
          <p className="muted" style={{marginTop:10}}>{ranking.summary}</p>

          <div className="matchup-rank-list">
            {(shown??[]).map(m=>
              <MatchupRow key={m.opponentId} m={m}
                open={open===m.opponentId}
                onToggle={()=>setOpen(open===m.opponentId?null:m.opponentId)}/>)}
          </div>
        </div>

        <div className="glass card data-note" style={{marginTop:16}}>
          <div className="eyebrow">WHAT THIS RANKING CANNOT SEE</div>
          <ul className="riot-tips">{ranking.blindSpots.map(b=><li key={b}>{b}</li>)}</ul>
          <p className="muted">Champion and item data from patch {data.patch}.</p>
        </div>
      </>}
    </>}
  </AppShell>;
}

function MatchupRow({m,open,onToggle}:{m:MatchupScore;open:boolean;onToggle:()=>void}){
  const cls=m.edge==='YOU'?'edge-you':m.edge==='THEM'?'edge-them':'edge-even';
  return <div className="matchup-rank">
    <button type="button" className="matchup-rank-head" onClick={onToggle}>
      <span className={`rank-score ${cls}`}>{m.score>0?'+':''}{m.score}</span>
      <span className="rank-name">{m.opponentName}<small>{m.opponentTags.join(' / ')}</small></span>
      <span className="rank-toggle">{open?'HIDE':'WHY'}</span>
    </button>
    {open&&
      <div className="matchup-rank-body">
        {m.contributions.map(c=>
          <div className="rank-contribution" key={c.key}>
            <div className="rank-contribution-head">
              <span className="label">{c.label}</span>
              <span className={`edge-tag ${c.edge==='YOU'?'edge-you':c.edge==='THEM'?'edge-them':'edge-even'}`}>
                {c.points>0?'+':''}{c.points}
              </span>
            </div>
            <div className="matchup-fact-values">
              <span><b>You</b> {c.you}</span><span><b>Them</b> {c.them}</span>
            </div>
            <p className="muted">{c.note}</p>
          </div>)}
      </div>}
  </div>;
}
