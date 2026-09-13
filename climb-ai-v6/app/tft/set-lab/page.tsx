'use client';
import Image from 'next/image';
import {useEffect,useMemo,useState} from 'react';
import {TftShell} from '@/components/TftShell';
import {track} from '@/lib/analytics';

type Tab='champions'|'items'|'augments'|'traits';
type Entry={id:string;name:string;tier:number|string|null;description:string;image:string|null};
type StaticData={version:string;source:string;champions:Entry[];items:Entry[];augments:Entry[];traits:Entry[]};
const tabs:Tab[]=['champions','items','augments','traits'];
const PLAN_KEY='op_tft_static_plan';

export default function TftSetLab(){
  const [data,setData]=useState<StaticData|null>(null);
  const [tab,setTab]=useState<Tab>('champions');
  const [query,setQuery]=useState('');
  const [plan,setPlan]=useState<string[]>([]);
  const [error,setError]=useState('');

  useEffect(()=>{track('tft_set_lab_viewed');try{setPlan(JSON.parse(localStorage.getItem(PLAN_KEY)||'[]'))}catch{};void fetch('/api/tft/static').then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||'Static data failed.');setData(body)}).catch(err=>setError(err instanceof Error?err.message:'Static data failed.'))},[]);
  const entries=useMemo(()=>{const all=data?.[tab]||[];const q=query.trim().toLowerCase();return (q?all.filter(x=>`${x.name} ${x.description}`.toLowerCase().includes(q)):all).slice(0,160)},[data,tab,query]);
  const toggle=(name:string)=>setPlan(prev=>{const next=prev.includes(name)?prev.filter(x=>x!==name):[...prev,name].slice(-20);try{localStorage.setItem(PLAN_KEY,JSON.stringify(next))}catch{}return next});

  return <TftShell><main className="container section">
    <div className="eyebrow">NO API KEY REQUIRED · RIOT DATA DRAGON</div>
    <h1>TFT SET LAB</h1>
    <p className="muted" style={{maxWidth:820}}>Search the current static TFT library and build a preparation shortlist. This is patch data, not live-match scouting or adaptive in-game advice.</p>

    <section className="glass card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><div className="eyebrow">PATCH DATA</div><h3 style={{margin:0}}>{data?`DATA DRAGON ${data.version}`:'LOADING CURRENT TFT DATA…'}</h3></div><span className="op-tier op-tier-free">NO RIOT KEY</span></div>
      {error&&<p><b>{error}</b></p>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8,marginTop:16}}>{tabs.map(t=><button key={t} className={`btn ${tab===t?'primary':'secondary'}`} onClick={()=>{setTab(t);setQuery('')}}>{t.toUpperCase()}</button>)}</div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${tab}…`} style={{marginTop:12}}/>
    </section>

    {plan.length>0&&<section className="glass card" style={{marginTop:14}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><div><div className="eyebrow">PREP SHORTLIST</div><b>{plan.length} saved reference{plan.length===1?'':'s'}</b></div><button className="text-link" onClick={()=>{setPlan([]);localStorage.removeItem(PLAN_KEY)}}>CLEAR</button></div><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:12}}>{plan.map(x=><button key={x} className="btn secondary" style={{padding:'7px 9px'}} onClick={()=>toggle(x)}>{x} ×</button>)}</div></section>}

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:12,marginTop:16}}>
      {entries.map(entry=>{const saved=plan.includes(entry.name);return <article className="glass card" key={entry.id} style={{padding:14,display:'grid',gridTemplateRows:'auto auto 1fr auto',minHeight:190}}>
        <div style={{display:'flex',gap:11,alignItems:'center'}}>{entry.image?<Image src={entry.image} alt="" width={48} height={48} style={{borderRadius:10,objectFit:'cover'}}/>:<div style={{width:48,height:48,borderRadius:10,display:'grid',placeItems:'center',background:'rgba(255,255,255,.06)'}}>TFT</div>}<div><b>{entry.name}</b>{entry.tier!==null&&<div className="muted" style={{fontSize:11}}>Tier {String(entry.tier)}</div>}</div></div>
        <div style={{height:10}}/>
        <p className="muted" style={{fontSize:11,margin:0}}>{entry.description?entry.description.slice(0,190):`Current ${tab.slice(0,-1)} reference from Riot Data Dragon.`}</p>
        <button className={`btn ${saved?'primary':'secondary'}`} style={{marginTop:12}} onClick={()=>toggle(entry.name)}>{saved?'SAVED TO PREP':'ADD TO PREP'}</button>
      </article>})}
    </section>
    {data&&entries.length===0&&<div className="glass card" style={{marginTop:16}}><p className="muted">No matching {tab}.</p></div>}
  </main></TftShell>;
}
