'use client';
import Image from 'next/image';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {TftShell} from '@/components/TftShell';
import {TFT_CARRY_PROFILES,TFT_META_AS_OF,TFT_META_PATCH} from '@/lib/tft/carryBuilder';
import {TFT_COMPONENTS,componentCount,slamCandidates,topCarryDirections,type ComponentBag,type TftComponent} from '@/lib/tft/itemFinder';

type StaticEntry={id:string;name:string;image:string|null};
type StaticData={version:string;source:string;champions:StaticEntry[];items:StaticEntry[]};
const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const kindLabel=(kind:string)=>kind==='META'?'META BEST':kind==='ALTERNATIVE'?'STRONG ALT':'FUN / HIGH-ROLL';

export default function TftItemFinder(){
  const router=useRouter();
  const [data,setData]=useState<StaticData|null>(null);
  const [components,setComponents]=useState<ComponentBag>({});
  const [completed,setCompleted]=useState<string[]>([]);
  const [itemPick,setItemPick]=useState('');
  const [status,setStatus]=useState('');

  useEffect(()=>{void fetch('/api/tft/static').then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||'Static data failed.');setData(body)}).catch(err=>setStatus(err instanceof Error?err.message:'Static data failed.'));},[]);

  const itemByName=useMemo(()=>new Map((data?.items||[]).map(i=>[norm(i.name),i])),[data]);
  const champByName=useMemo(()=>new Map((data?.champions||[]).map(i=>[norm(i.name),i])),[data]);
  const targetItems=useMemo(()=>[...new Set(TFT_CARRY_PROFILES.flatMap(p=>p.builds.flatMap(b=>b.items)))].sort(),[]);
  const directions=useMemo(()=>topCarryDirections(components,completed),[components,completed]);
  const slams=useMemo(()=>slamCandidates(components),[components]);
  const totalComponents=componentCount(components);

  const changeComponent=(component:TftComponent,delta:number)=>setComponents(prev=>({...prev,[component]:Math.max(0,Number(prev[component]||0)+delta)}));
  const addCompleted=()=>{if(!itemPick)return;setCompleted(prev=>[...prev,itemPick]);setItemPick('');};
  const openCarry=(champion:string,buildId:string)=>{
    try{localStorage.setItem('op_tft_carry_builder_pick',JSON.stringify({champion,buildId}));}catch{}
    router.push('/tft/carry-builder');
  };

  return <TftShell><main className="container section">
    <div className="eyebrow">ITEM-FIRST FLEX ENGINE · STATIC PREP</div>
    <h1>COMPONENT → CARRY FINDER</h1>
    <p className="muted" style={{maxWidth:930}}>Tell OP CLIMB what components and completed items you actually have. It ranks the strongest carry directions your bag naturally supports, shows what can be slammed now, and keeps three viable paths open instead of forcing one comp from Stage 2.</p>

    <section className="glass card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'end',flexWrap:'wrap'}}><div><div className="eyebrow">YOUR COMPONENT BAG</div><h2>WHAT DID THE GAME GIVE YOU?</h2><p className="muted" style={{margin:0}}>Set {TFT_META_PATCH} carry snapshot · {TFT_META_AS_OF} · Riot static feed {data?.version||'loading…'}</p></div><button className="btn secondary" onClick={()=>{setComponents({});setCompleted([]);}}>RESET BAG</button></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:9,marginTop:14}}>{TFT_COMPONENTS.map(component=>{const info=itemByName.get(norm(component));const count=Number(components[component]||0);return <div key={component} style={{padding:11,borderRadius:14,border:count?'2px solid currentColor':'1px solid rgba(255,255,255,.08)',background:count?'rgba(255,255,255,.07)':'rgba(255,255,255,.025)'}}><div style={{display:'flex',gap:9,alignItems:'center'}}>{info?.image?<Image src={info.image} alt="" width={38} height={38} style={{borderRadius:9}}/>:null}<div style={{minWidth:0}}><b style={{fontSize:12}}>{component}</b><div className="muted" style={{fontSize:10}}>Owned: {count}</div></div></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:9}}><button className="btn secondary" onClick={()=>changeComponent(component,-1)} disabled={!count}>−</button><button className="btn primary" onClick={()=>changeComponent(component,1)}>+</button></div></div>})}</div>
      <div className="cue-row" style={{marginTop:12}}><span>TOTAL COMPONENTS</span><b>{totalComponents}</b></div>
    </section>

    <section className="glass card" style={{marginTop:14}}>
      <div className="eyebrow">ALREADY COMPLETED</div><h3>ADD ITEMS YOU HAVE ALREADY SLAMMED</h3>
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:8}}><select value={itemPick} onChange={e=>setItemPick(e.target.value)}><option value="">Choose completed item…</option>{targetItems.map(item=><option key={item} value={item}>{item}</option>)}</select><button className="btn secondary" onClick={addCompleted} disabled={!itemPick}>ADD ITEM</button></div>
      {completed.length>0&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>{completed.map((item,index)=>{const info=itemByName.get(norm(item));return <button key={`${item}-${index}`} onClick={()=>setCompleted(prev=>prev.filter((_,i)=>i!==index))} style={{display:'inline-flex',alignItems:'center',gap:7,padding:'7px 10px',borderRadius:10,border:'1px solid rgba(255,255,255,.1)',background:'rgba(255,255,255,.04)',cursor:'pointer'}}>{info?.image?<Image src={info.image} alt="" width={28} height={28} style={{borderRadius:6}}/>:null}<b style={{fontSize:11}}>{item}</b><span className="muted">×</span></button>})}</div>}
    </section>

    {status&&<div className="glass card" style={{marginTop:12,padding:12}}><b>{status}</b></div>}

    <section style={{marginTop:18}}>
      <div className="eyebrow">TOP THREE DIRECTIONS</div><h2>WHAT DOES THIS BAG WANT TO BECOME?</h2>
      {totalComponents===0&&completed.length===0?<div className="glass card"><p className="muted" style={{margin:0}}>Add components or completed items to create a real item-fit ranking. OP CLIMB will not invent a preferred carry from an empty bag.</p></div>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>{directions.map((result,index)=>{const champ=champByName.get(norm(result.profile.champion));return <div key={`${result.profile.champion}-${result.build.id}`} className="glass card" style={{border:index===0?'2px solid currentColor':undefined}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><div style={{display:'flex',gap:10,alignItems:'center'}}>{champ?.image?<Image src={champ.image} alt="" width={54} height={54} style={{borderRadius:12}}/>:null}<div><div className="eyebrow">#{index+1} ITEM FIT · {result.profile.tier} TIER CORE</div><h2 style={{margin:'2px 0'}}>{result.profile.champion}</h2></div></div><strong>{result.score}</strong></div>
        <p className="muted" style={{fontSize:11}}>{result.reason}</p>
        <div className="cue-row"><span>PACKAGE</span><b>{result.build.label}</b></div><div className="cue-row"><span>TYPE</span><b>{kindLabel(result.build.kind)}</b></div>
        <div style={{display:'grid',gap:7,marginTop:10}}>{result.build.items.map((item,i)=>{const info=itemByName.get(norm(item));const state=result.itemStates[i]?.state||'MISSING';return <div key={`${item}-${i}`} style={{display:'grid',gridTemplateColumns:'34px 1fr auto',gap:8,alignItems:'center',padding:7,borderRadius:10,background:'rgba(255,255,255,.035)'}}>{info?.image?<Image src={info.image} alt="" width={32} height={32} style={{borderRadius:7}}/>:<span/>}<b style={{fontSize:11}}>{item}</b><span className={`op-tier ${state==='OWNED'||state==='CRAFT NOW'?'op-tier-pro':state==='PARTIAL'?'op-tier-plus':'op-tier-free'}`} style={{fontSize:8}}>{state}</span></div>})}</div>
        <button className="btn primary" style={{width:'100%',marginTop:12}} onClick={()=>openCarry(result.profile.champion,result.build.id)}>BUILD A TEAM AROUND {result.profile.champion.toUpperCase()}</button>
      </div>})}</div>}
    </section>

    <section className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">SLAM VALUE</div><h2>WHAT CAN I MAKE NOW WITHOUT KILLING FLEX?</h2>
      {slams.length===0?<p className="muted">No target carry item is immediately craftable from the current component bag.</p>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:9}}>{slams.map(slam=>{const info=itemByName.get(norm(slam.item));return <div key={slam.item} style={{padding:11,borderRadius:13,border:'1px solid rgba(255,255,255,.08)',background:'rgba(255,255,255,.025)'}}><div style={{display:'flex',gap:8,alignItems:'center'}}>{info?.image?<Image src={info.image} alt="" width={38} height={38} style={{borderRadius:8}}/>:null}<div><b>{slam.item}</b><div className="muted" style={{fontSize:10}}>Flex score {slam.flexScore}</div></div></div><p className="muted" style={{fontSize:10,marginBottom:0}}>Supports {slam.profiles.join(' · ')}</p></div>})}</div>}
      <p className="muted" style={{fontSize:11,marginBottom:0,marginTop:12}}>Higher flex means the item appears across more viable carry directions in the current OP CLIMB carry snapshot. This is a preparation aid, not an instruction to slam an item during a live round.</p>
    </section>

    <section className="glass card" style={{marginTop:16}}><div className="eyebrow">HOW TO USE IT</div><p className="muted" style={{margin:0}}>Example: if you have Bow + Rod + Sword, the engine recognises the immediate Rageblade line while also checking what the remaining Sword can become across Jhin, Twisted Fate, Graves and Jax packages. It ranks the complete bag, not one isolated recipe. Choose a direction, then Carry Builder creates the team shell and Board Lab tests the finished structure.</p></section>
  </main></TftShell>;
}
