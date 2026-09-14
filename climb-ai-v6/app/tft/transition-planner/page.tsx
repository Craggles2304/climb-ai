'use client';
import Image from 'next/image';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {TftShell} from '@/components/TftShell';
import {TFT_CARRY_PROFILES,TFT_META_PATCH,TFT_META_SET,type TftCarryProfile,type TftStaticChampion} from '@/lib/tft/carryBuilder';
import {type TftBoardContext,type TftBoardUnit,type TftTraitDefinition} from '@/lib/tft/boardLab';
import {analyseTftTransition,type TftTransitionRead} from '@/lib/tft/transitionPlanner';

type StaticEntry={
  id:string;
  name:string;
  tier:number|string|null;
  description:string;
  image:string|null;
  traits?:string[];
  stats?:{hp?:number;armor?:number;magicResist?:number;attackDamage?:number;attackSpeed?:number;range?:number}|null;
  effects?:Array<{minUnits:number;maxUnits?:number;style?:number}>;
};
type StaticData={version:string;source:string;champions:StaticEntry[];items:StaticEntry[];augments:StaticEntry[];traits:StaticEntry[]};
type SavedDraft={units:TftBoardUnit[];stage:string;level:number;hp:number;gold:number;unusedComponents:number;completedItemsBench:number;augments:string[]};

const BOARD_KEY='op_tft_board_lab_v1';
const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const riskClass=(risk:TftTransitionRead['risk'])=>risk==='LOW'?'op-tier-pro':risk==='MEDIUM'?'op-tier-plus':'op-tier-free';
const deltaText=(n:number)=>`${n>0?'+':''}${n}`;

export default function TftTransitionPlanner(){
  const router=useRouter();
  const [data,setData]=useState<StaticData|null>(null);
  const [draft,setDraft]=useState<SavedDraft|null>(null);
  const [selectedName,setSelectedName]=useState('Ashe');
  const [buildId,setBuildId]=useState('ashe-cast');
  const [targetSize,setTargetSize]=useState(8);
  const [status,setStatus]=useState('');

  useEffect(()=>{
    try{
      const raw=localStorage.getItem(BOARD_KEY);
      if(raw){
        const saved=JSON.parse(raw) as SavedDraft;
        if(Array.isArray(saved.units)){
          setDraft(saved);
          setTargetSize(Math.max(3,Math.min(10,Number(saved.level)||8)));
        }
      }
    }catch{}
    void fetch('/api/tft/static').then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||'Static data failed.');setData(body)}).catch(err=>setStatus(err instanceof Error?err.message:'Static data failed.'));
  },[]);

  const profile=TFT_CARRY_PROFILES.find(p=>p.champion===selectedName)||TFT_CARRY_PROFILES[0];
  const build=profile.builds.find(b=>b.id===buildId)||profile.builds[0];
  const champions=(data?.champions||[]) as TftStaticChampion[];
  const traitDefinitions=useMemo<TftTraitDefinition[]>(()=>(data?.traits||[]).map(t=>({name:t.name,effects:(t.effects||[]).filter(e=>e.minUnits>0)})),[data]);
  const current=useMemo<TftBoardContext|null>(()=>draft?{...draft,traitDefinitions}:null,[draft,traitDefinitions]);
  const read=useMemo(()=>current&&champions.length?analyseTftTransition({current,profile,build,champions,targetSize}):null,[current,profile,build,champions,targetSize]);
  const championByName=useMemo(()=>new Map((data?.champions||[]).map(c=>[norm(c.name),c])),[data]);

  const chooseProfile=(next:TftCarryProfile)=>{
    setSelectedName(next.champion);
    setBuildId(next.builds[0].id);
  };

  const refreshBoard=()=>{
    try{
      const raw=localStorage.getItem(BOARD_KEY);
      if(!raw){setDraft(null);setStatus('No saved Board Lab state found. Build your current board first.');return;}
      const saved=JSON.parse(raw) as SavedDraft;
      setDraft(saved);setTargetSize(Math.max(3,Math.min(10,Number(saved.level)||8)));setStatus('Current Board Lab state imported.');
    }catch{setStatus('Could not read the saved Board Lab state in this browser.');}
  };

  const loadTargetToBoardLab=()=>{
    if(!read){setStatus('Import a current Board Lab state first.');return;}
    const next={
      units:read.targetContext.units,
      stage:read.targetContext.stage,
      level:read.targetContext.level,
      hp:read.targetContext.hp,
      gold:read.targetContext.gold,
      unusedComponents:read.targetContext.unusedComponents,
      completedItemsBench:read.targetContext.completedItemsBench,
      augments:read.targetContext.augments,
    };
    try{localStorage.setItem(BOARD_KEY,JSON.stringify(next));router.push('/tft/board-lab');}catch{setStatus('Could not save the target board in this browser.');}
  };

  const openCarryBuilder=()=>{
    try{localStorage.setItem('op_tft_carry_builder_pick',JSON.stringify({champion:profile.champion,buildId:build.id}))}catch{}
    router.push('/tft/carry-builder');
  };

  return <TftShell><main className="container section">
    <div className="eyebrow">SET {TFT_META_SET} · PATCH {TFT_META_PATCH} · STATIC PREP / POST-GAME RECONSTRUCTION</div>
    <h1>COMP PIVOT + TRANSITION PLANNER</h1>
    <p className="muted" style={{maxWidth:980}}>Start with the board you actually had, choose the carry/core you wanted to reach, then measure the transition itself. OP CLIMB separates <b>how much stronger the target looks</b> from <b>how dangerous it is to get there</b>.</p>

    <section className="glass card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        <div><div className="eyebrow">CURRENT STATE SOURCE</div><h2 style={{margin:'3px 0'}}>{draft?`${draft.units.length} UNITS · LEVEL ${draft.level} · ${draft.gold}G · ${draft.hp} HP`:'NO BOARD LAB STATE FOUND'}</h2><p className="muted" style={{margin:0}}>Current board comes from your saved Board Lab reconstruction. Riot static feed {data?.version||'loading…'}.</p></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn secondary" onClick={refreshBoard}>IMPORT SAVED BOARD LAB</button><button className="btn primary" onClick={()=>router.push('/tft/board-lab')}>EDIT CURRENT BOARD</button></div>
      </div>
    </section>

    {status&&<div className="glass card" style={{marginTop:12,padding:12}}><b>{status}</b></div>}

    <section className="glass card" style={{marginTop:16}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'end',flexWrap:'wrap'}}><div><div className="eyebrow">TARGET CORE</div><h2>WHAT ARE YOU TRYING TO TURN THIS BOARD INTO?</h2></div><label style={{minWidth:150}}><span className="eyebrow">TARGET BOARD SIZE</span><select value={targetSize} onChange={e=>setTargetSize(Number(e.target.value))}>{[6,7,8,9,10].map(n=><option key={n} value={n}>{n} units</option>)}</select></label></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:9,marginTop:12}}>{TFT_CARRY_PROFILES.map(p=>{
        const active=p.champion===profile.champion;const champ=championByName.get(norm(p.champion));
        return <button key={p.champion} type="button" onClick={()=>chooseProfile(p)} style={{textAlign:'left',padding:12,borderRadius:14,border:active?'2px solid currentColor':'1px solid rgba(255,255,255,.09)',background:active?'rgba(255,255,255,.08)':'rgba(255,255,255,.03)',cursor:'pointer'}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>{champ?.image?<Image src={champ.image} alt="" width={40} height={40} style={{borderRadius:9,objectFit:'cover'}}/>:null}<div><div className="eyebrow">{p.tier} TIER</div><b>{p.champion}</b></div></div><p className="muted" style={{fontSize:10,marginBottom:0}}>{p.headline}</p>
        </button>;
      })}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:9,marginTop:12}}>{profile.builds.map(option=><button key={option.id} type="button" onClick={()=>setBuildId(option.id)} style={{textAlign:'left',padding:11,borderRadius:12,border:option.id===build.id?'2px solid currentColor':'1px solid rgba(255,255,255,.08)',background:'rgba(255,255,255,.025)',cursor:'pointer'}}><div className="eyebrow">{option.kind}</div><b>{option.label}</b><div className="muted" style={{fontSize:10,marginTop:4}}>{option.items.join(' · ')}</div></button>)}</div>
    </section>

    {!draft?<section className="glass card" style={{marginTop:16,textAlign:'center',padding:28}}><div className="eyebrow">CURRENT BOARD REQUIRED</div><h2>BUILD THE BOARD YOU ACTUALLY HAD</h2><p className="muted">The transition engine refuses to invent a starting board. Reconstruct it in Board Lab, then return here and import it.</p><button className="btn primary" onClick={()=>router.push('/tft/board-lab')}>OPEN BOARD LAB</button></section>:!read?<section className="glass card" style={{marginTop:16}}><b>Loading current Riot static data and target shell…</b></section>:<>
      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10,marginTop:16}}>
        <div className="glass card"><div className="eyebrow">TRANSITION CALL</div><h2>{read.call}</h2><span className={`op-tier ${riskClass(read.risk)}`}>{read.risk} RISK</span></div>
        <div className="glass card"><div className="eyebrow">MODEL CONFIDENCE</div><h2>{read.confidence}%</h2><span className="muted">evidence-aware</span></div>
        <div className="glass card"><div className="eyebrow">CURRENT BOARD</div><h2>{read.currentRead.boardStrength}/100</h2><span className="muted">{read.currentRead.call}</span></div>
        <div className="glass card"><div className="eyebrow">TARGET PROXY</div><h2>{read.targetRead.boardStrength}/100</h2><span className="muted">{deltaText(read.strengthDelta)} strength</span></div>
        <div className="glass card"><div className="eyebrow">MISSING UNITS</div><h2>{read.enter.length}</h2><span className="muted">{read.exit.length} current exits</span></div>
        <div className="glass card"><div className="eyebrow">PURCHASE FLOOR</div><h2>{read.purchaseFloor}G</h2><span className="muted">before search/roll cost</span></div>
      </section>

      <section style={{display:'grid',gridTemplateColumns:'minmax(0,.8fr) minmax(0,1.2fr)',gap:16,marginTop:16}}>
        <div className="glass card"><div className="eyebrow">WHY THIS CALL</div><h2>{read.call}</h2><div style={{display:'grid',gap:8}}>{read.reasons.map((reason,i)=><div key={i} className="cue-row"><span>{String(i+1).padStart(2,'0')}</span><b>{reason}</b></div>)}</div></div>
        <div className="glass card"><div className="eyebrow">ITEM HOLDER → FINAL CARRY</div><h2>{read.itemHolder.holder||'NO CLEAN HOLDER'} → {read.itemHolder.targetCarry}</h2><p className="muted">{read.itemHolder.note}</p><div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{read.itemHolder.targetItems.map(item=><span key={item} className="op-tier op-tier-plus">{item}</span>)}</div>{read.itemHolder.matchingItems.length>0&&<p style={{fontSize:11,marginBottom:0}}><b>Already matching:</b> {read.itemHolder.matchingItems.join(' · ')}</p>}</div>
      </section>

      <section style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:12,marginTop:16}}>
        <div className="glass card"><div className="eyebrow">KEEP</div><h2>{read.keep.length} UNITS</h2><div style={{display:'grid',gap:7}}>{read.keep.map(u=><div key={u.name} className="cue-row"><span>{u.cost}C</span><b>{u.name}</b></div>)}</div></div>
        <div className="glass card"><div className="eyebrow">ADD</div><h2>{read.enter.length} UNITS</h2><div style={{display:'grid',gap:7}}>{read.enter.map(u=><div key={u.name} className="cue-row"><span>{u.cost}C · {u.role}</span><b>{u.name}</b></div>)}</div></div>
        <div className="glass card"><div className="eyebrow">EXIT</div><h2>{read.exit.length} UNITS</h2><div style={{display:'grid',gap:7}}>{read.exit.map(u=><div key={u.name} className="cue-row"><span>{u.cost}C</span><b>{u.name}</b></div>)}</div></div>
      </section>

      <section className="glass card" style={{marginTop:16}}><div className="eyebrow">TRAIT CONVERSION</div><h2>WHAT THE SWAPS ACTUALLY CHANGE</h2>{read.traitChanges.length===0?<p className="muted">No active trait breakpoint change is detected between the two structural states.</p>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:8}}>{read.traitChanges.slice(0,12).map(t=><div key={t.name} style={{padding:10,borderRadius:12,border:'1px solid rgba(255,255,255,.08)',background:'rgba(255,255,255,.025)'}}><div className="eyebrow">{t.direction}</div><b>{t.name}</b><div className="muted" style={{fontSize:10,marginTop:4}}>{t.currentCount} units / {t.currentBreakpoint||0} BP → {t.targetCount} units / {t.targetBreakpoint||0} BP</div></div>)}</div>}</section>

      <section className="glass card" style={{marginTop:16}}><div className="eyebrow">TRANSITION ORDER</div><h2>DO NOT SELL THE BOARD BEFORE THE REPLACEMENT EXISTS</h2><div style={{display:'grid',gap:9}}>{read.sequence.map((step,i)=><div key={i} className="cue-row"><span>STEP {i+1}</span><b>{step}</b></div>)}</div><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16}}><button className="btn primary" onClick={loadTargetToBoardLab}>LOAD TARGET INTO BOARD LAB</button><button className="btn secondary" onClick={openCarryBuilder}>OPEN TARGET IN CARRY BUILDER</button><button className="btn secondary" onClick={()=>router.push('/tft/roll-lab')}>OPEN ROLL LAB</button></div></section>

      <section className="glass card" style={{marginTop:16}}><div className="eyebrow">MODEL BOUNDARY</div>{read.assumptions.map((a,i)=><p className="muted" key={i} style={{margin:i===0?'8px 0':'5px 0'}}>{a}</p>)}</section>
    </>}
  </main></TftShell>;
}
