'use client';
import Image from 'next/image';
import {useEffect,useMemo,useState} from 'react';
import {TftShell} from '@/components/TftShell';
import {analyseTftBoard,type TftBoardRole,type TftBoardStar,type TftBoardUnit,type TftTraitDefinition} from '@/lib/tft/boardLab';

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

type Draft={
  units:TftBoardUnit[];
  stage:string;
  level:number;
  hp:number;
  gold:number;
  unusedComponents:number;
  completedItemsBench:number;
  augments:string[];
};

const KEY='op_tft_board_lab_v1';
const stages=['2-1','2-5','3-2','3-5','4-1','4-2','4-5','5-1','5-5','6-1'];
const roles:TftBoardRole[]=['FRONTLINE','CARRY','SUPPORT','FLEX'];
const defaults:Draft={units:[],stage:'4-2',level:7,hp:52,gold:40,unusedComponents:2,completedItemsBench:0,augments:['','','']};

function firstOpen(units:TftBoardUnit[],preferredRow:number){
  const used=new Set(units.map(u=>`${u.row}-${u.col}`));
  const rows=[preferredRow,...[0,1,2,3].filter(r=>r!==preferredRow)];
  for(const row of rows)for(let col=0;col<7;col++)if(!used.has(`${row}-${col}`))return{row,col};
  return{row:3,col:6};
}

function scoreLabel(score:number){if(score>=82)return'ELITE';if(score>=70)return'STRONG';if(score>=58)return'STABLE';if(score>=45)return'LEAK';return'CRITICAL';}

export default function TftBoardLab(){
  const [data,setData]=useState<StaticData|null>(null);
  const [draft,setDraft]=useState<Draft>(defaults);
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [hydrated,setHydrated]=useState(false);

  useEffect(()=>{
    try{
      const saved=localStorage.getItem(KEY);
      if(saved)setDraft({...defaults,...JSON.parse(saved)});
    }catch{}
    setHydrated(true);
    void fetch('/api/tft/static').then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||'Static data failed.');setData(body)}).catch(err=>setError(err instanceof Error?err.message:'Static data failed.'));
  },[]);
  useEffect(()=>{if(!hydrated)return;try{localStorage.setItem(KEY,JSON.stringify(draft))}catch{}},[draft,hydrated]);

  const champions=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return (data?.champions||[]).filter(c=>Number(c.tier)>=1&&Number(c.tier)<=5&&(!q||`${c.name} ${(c.traits||[]).join(' ')}`.toLowerCase().includes(q))).sort((a,b)=>Number(a.tier||9)-Number(b.tier||9)||a.name.localeCompare(b.name)).slice(0,60);
  },[data,query]);
  const items=useMemo(()=>(data?.items||[]).filter(x=>x.name&&x.name.length<60).sort((a,b)=>a.name.localeCompare(b.name)),[data]);
  const augments=useMemo(()=>(data?.augments||[]).filter(x=>x.name).sort((a,b)=>a.name.localeCompare(b.name)),[data]);
  const traitDefinitions=useMemo<TftTraitDefinition[]>(()=>(data?.traits||[]).map(t=>({name:t.name,effects:(t.effects||[]).filter(e=>e.minUnits>0)})),[data]);
  const activeUnit=draft.units.find(u=>u.id===selected)||null;
  const read=useMemo(()=>analyseTftBoard({...draft,traitDefinitions}),[draft,traitDefinitions]);

  const addChampion=(entry:StaticEntry)=>{
    if(draft.units.length>=Math.min(10,draft.level)){setError(`Board is full for level ${draft.level}. Remove a unit or increase level.`);return;}
    const range=entry.stats?.range||1;
    const role:TftBoardRole=range>=3?'CARRY':'FRONTLINE';
    const preferredRow=role==='CARRY'?3:0;
    const pos=firstOpen(draft.units,preferredRow);
    const unit:TftBoardUnit={id:`${entry.id}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,championId:entry.id,name:entry.name,cost:Number(entry.tier)||1,star:1,role,items:[],traits:entry.traits||[],stats:entry.stats||undefined,row:pos.row,col:pos.col};
    setDraft(prev=>({...prev,units:[...prev.units,unit]}));setSelected(unit.id);setError('');
  };
  const updateUnit=(id:string,patch:Partial<TftBoardUnit>)=>setDraft(prev=>({...prev,units:prev.units.map(u=>u.id===id?{...u,...patch}:u)}));
  const removeUnit=(id:string)=>{setDraft(prev=>({...prev,units:prev.units.filter(u=>u.id!==id)}));if(selected===id)setSelected(null)};
  const clickCell=(row:number,col:number)=>{
    const occupant=draft.units.find(u=>u.row===row&&u.col===col);
    if(occupant){setSelected(occupant.id);return;}
    if(selected)updateUnit(selected,{row,col});
  };
  const setItem=(slot:number,name:string)=>{
    if(!activeUnit)return;
    const next=[...activeUnit.items];
    while(next.length<=slot)next.push('');
    next[slot]=name;
    updateUnit(activeUnit.id,{items:next.filter(Boolean).slice(0,3)});
  };

  return <TftShell><main className="container section">
    <div className="eyebrow">PATCH-AWARE PRACTICE TOOL · NO LIVE BOARD READING</div>
    <h1>TFT BOARD LAB</h1>
    <p className="muted" style={{maxWidth:900}}>Build a board from current Riot static data, place every unit, assign stars/roles/items and reconstruct the decision state. OP CLIMB scores structural strength and explains the weakest axis; it does <b>not</b> claim an exact fight win percentage.</p>

    <section className="glass card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        <div><div className="eyebrow">DECISION STATE</div><h3 style={{margin:0}}>{data?`RIOT STATIC DATA ${data.version}`:'LOADING CURRENT SET DATA…'}</h3></div>
        <button className="btn secondary" onClick={()=>{setDraft(defaults);setSelected(null);try{localStorage.removeItem(KEY)}catch{}}}>RESET LAB</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10,marginTop:14}}>
        <label><span className="eyebrow">STAGE</span><select value={draft.stage} onChange={e=>setDraft(p=>({...p,stage:e.target.value}))}>{stages.map(s=><option key={s}>{s}</option>)}</select></label>
        <label><span className="eyebrow">LEVEL</span><input type="number" min={3} max={10} value={draft.level} onChange={e=>setDraft(p=>({...p,level:Math.max(3,Math.min(10,Number(e.target.value)||3))}))}/></label>
        <label><span className="eyebrow">HP</span><input type="number" min={1} max={100} value={draft.hp} onChange={e=>setDraft(p=>({...p,hp:Math.max(1,Math.min(100,Number(e.target.value)||1))}))}/></label>
        <label><span className="eyebrow">GOLD</span><input type="number" min={0} max={200} value={draft.gold} onChange={e=>setDraft(p=>({...p,gold:Math.max(0,Number(e.target.value)||0)}))}/></label>
        <label><span className="eyebrow">UNUSED COMPONENTS</span><input type="number" min={0} max={12} value={draft.unusedComponents} onChange={e=>setDraft(p=>({...p,unusedComponents:Math.max(0,Number(e.target.value)||0)}))}/></label>
        <label><span className="eyebrow">BENCHED COMPLETED ITEMS</span><input type="number" min={0} max={6} value={draft.completedItemsBench} onChange={e=>setDraft(p=>({...p,completedItemsBench:Math.max(0,Number(e.target.value)||0)}))}/></label>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginTop:10}}>{[0,1,2].map(i=><label key={i}><span className="eyebrow">AUGMENT {i+1}</span><select value={draft.augments[i]||''} onChange={e=>setDraft(p=>({...p,augments:p.augments.map((a,j)=>j===i?e.target.value:a)}))}><option value="">Unknown / none</option>{augments.slice(0,300).map(a=><option key={`${i}-${a.id}`} value={a.name}>{a.name}</option>)}</select></label>)}</div>
    </section>

    {error&&<div className="glass card" style={{marginTop:12,padding:12}}><b>{error}</b></div>}

    <section style={{display:'grid',gridTemplateColumns:'minmax(0,1.45fr) minmax(300px,.55fr)',gap:16,marginTop:16}}>
      <div className="glass card">
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'end',flexWrap:'wrap'}}><div><div className="eyebrow">4 × 7 RECONSTRUCTION BOARD</div><h2>PLACE THE BOARD AS IT ACTUALLY STOOD</h2></div><span className="muted">{draft.units.length}/{draft.level} FIELD SLOTS</span></div>
        <div style={{overflowX:'auto',paddingBottom:6}}><div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(76px,1fr))',gap:7,minWidth:590,marginTop:14}}>
          {[0,1,2,3].flatMap(row=>[0,1,2,3,4,5,6].map(col=>{
            const unit=draft.units.find(u=>u.row===row&&u.col===col);const chosen=unit?.id===selected;
            return <button key={`${row}-${col}`} type="button" onClick={()=>clickCell(row,col)} style={{minHeight:92,borderRadius:14,border:chosen?'2px solid currentColor':'1px solid rgba(255,255,255,.10)',background:unit?'rgba(255,255,255,.075)':'rgba(255,255,255,.025)',padding:7,cursor:'pointer',overflow:'hidden'}}>
              {unit?<><div style={{display:'flex',justifyContent:'center'}}>{data?.champions.find(c=>c.id===unit.championId)?.image?<Image src={data.champions.find(c=>c.id===unit.championId)!.image!} alt="" width={42} height={42} style={{borderRadius:10,objectFit:'cover'}}/>:<div style={{height:42}}/>}</div><b style={{display:'block',fontSize:10,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginTop:4}}>{unit.name}</b><span style={{fontSize:10}}>{'★'.repeat(unit.star)} · {unit.role==='FRONTLINE'?'FRONT':unit.role}</span></>:<span className="muted" style={{fontSize:10}}>{selected?'MOVE HERE':row<2?'FRONT':'BACK'}</span>}
            </button>;
          }))}
        </div></div>
        <p className="muted" style={{fontSize:11,marginBottom:0}}>Click a unit to select it, then click an empty hex-slot to move it. Top two rows are treated as frontline space; bottom two as protected/backline space.</p>
      </div>

      <div className="glass card">
        <div className="eyebrow">UNIT INSPECTOR</div>
        {activeUnit?<><h2>{activeUnit.name}</h2><div className="cue-row"><span>COST</span><b>{activeUnit.cost}</b></div><div className="eyebrow" style={{marginTop:14}}>STAR LEVEL</div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginTop:7}}>{([1,2,3] as TftBoardStar[]).map(star=><button key={star} className={`btn ${activeUnit.star===star?'primary':'secondary'}`} onClick={()=>updateUnit(activeUnit.id,{star})}>{'★'.repeat(star)}</button>)}</div><div className="eyebrow" style={{marginTop:14}}>COACHING ROLE</div><div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:7,marginTop:7}}>{roles.map(role=><button key={role} className={`btn ${activeUnit.role===role?'primary':'secondary'}`} style={{padding:'8px 5px',fontSize:10}} onClick={()=>updateUnit(activeUnit.id,{role})}>{role}</button>)}</div><div className="eyebrow" style={{marginTop:14}}>ITEMS</div><div style={{display:'grid',gap:7,marginTop:7}}>{[0,1,2].map(slot=><select key={slot} value={activeUnit.items[slot]||''} onChange={e=>setItem(slot,e.target.value)}><option value="">Item slot {slot+1}</option>{items.slice(0,350).map(item=><option key={`${slot}-${item.id}`} value={item.name}>{item.name}</option>)}</select>)}</div>{activeUnit.traits.length>0&&<><div className="eyebrow" style={{marginTop:14}}>TRAITS</div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:7}}>{activeUnit.traits.map(t=><span key={t} className="op-tier op-tier-free">{t}</span>)}</div></>}<button className="btn secondary" style={{width:'100%',marginTop:16}} onClick={()=>removeUnit(activeUnit.id)}>REMOVE UNIT</button></>:<p className="muted">Select a unit on the board to edit its star level, coaching role and item package.</p>}
      </div>
    </section>

    <section className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">CHAMPION PALETTE</div><div style={{display:'flex',gap:10,alignItems:'center',marginTop:8}}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search champion or trait…"/><span className="muted" style={{whiteSpace:'nowrap'}}>Click to field</span></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))',gap:8,marginTop:12,maxHeight:360,overflowY:'auto',paddingRight:4}}>{champions.map(champ=><button key={champ.id} type="button" onClick={()=>addChampion(champ)} style={{display:'grid',gridTemplateColumns:'38px 1fr',gap:8,alignItems:'center',textAlign:'left',border:'1px solid rgba(255,255,255,.09)',background:'rgba(255,255,255,.04)',borderRadius:11,padding:8,cursor:'pointer'}}>{champ.image?<Image src={champ.image} alt="" width={38} height={38} style={{borderRadius:9,objectFit:'cover'}}/>:<span/>}<span><b style={{display:'block',fontSize:11}}>{champ.name}</b><span className="muted" style={{fontSize:9}}>{Number(champ.tier)||'?'} COST · {(champ.traits||[]).slice(0,2).join(' · ')||'traits unavailable'}</span></span></button>)}</div>
    </section>

    <section style={{display:'grid',gridTemplateColumns:'minmax(230px,.55fr) minmax(0,1.45fr)',gap:16,marginTop:16}}>
      <div className="glass card"><div className="eyebrow">BOARD STRENGTH READ</div><div style={{display:'flex',alignItems:'baseline',gap:8}}><h1 style={{fontSize:56,margin:'8px 0'}}>{draft.units.length?read.boardStrength:'—'}</h1><b>/100</b></div><div className="cue-row"><span>MODEL CONFIDENCE</span><b>{read.confidence}%</b></div><p className="muted" style={{fontSize:11}}>A transparent coaching index from entered board structure and Riot static data. It is not a simulated fight win rate.</p></div>
      <div className="glass card"><div className="eyebrow">DECISION CALL</div><h1 style={{fontSize:34,marginBottom:8}}>{draft.units.length?read.call:'BUILD THE BOARD'}</h1><div className="cue-row"><span>URGENCY</span><b>{draft.units.length?read.urgency:'—'}</b></div><div style={{display:'grid',gap:8,marginTop:12}}>{draft.units.length?read.reasons.map((reason,i)=><div key={reason} style={{padding:'10px 12px',border:'1px solid rgba(255,255,255,.08)',borderRadius:10}}><b>{i+1}.</b> {reason}</div>):<p className="muted">Field units to create a decision read.</p>}</div>{draft.units.length>0&&<div style={{marginTop:12,padding:12,border:'1px solid rgba(255,255,255,.12)',borderRadius:10}}><div className="eyebrow">NEXT CHECKPOINT</div><b>{read.nextCheckpoint}</b></div>}</div>
    </section>

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))',gap:10,marginTop:14}}>{read.metrics.map(metric=><div className="glass card" key={metric.key} style={{padding:14}}><div className="eyebrow">{metric.label.toUpperCase()}</div><div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}><h2 style={{margin:'7px 0'}}>{draft.units.length?metric.score:'—'}</h2><span className="op-tier op-tier-free">{draft.units.length?scoreLabel(metric.score):'UNKNOWN'}</span></div><div style={{height:6,borderRadius:99,background:'rgba(255,255,255,.08)',overflow:'hidden'}}><div style={{width:`${draft.units.length?metric.score:0}%`,height:'100%',background:'currentColor'}}/></div><p className="muted" style={{fontSize:10,minHeight:44}}>{draft.units.length?metric.evidence:'Add board evidence.'}</p></div>)}</section>

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:16,marginTop:16}}>
      <div className="glass card"><div className="eyebrow">ACTIVE TRAIT BREAKPOINTS</div><h2>WHAT THE BOARD ACTUALLY TURNS ON</h2>{read.activeTraits.length?<div style={{display:'grid',gap:8}}>{read.activeTraits.map(t=><div className="cue-row" key={t.name}><span>{t.name} · {t.count} units</span><b>{t.breakpoint} ACTIVE{t.next?` → ${t.next} NEXT`:''}</b></div>)}</div>:<p className="muted">No active trait breakpoint detected from the current static trait data.</p>}</div>
      <div className="glass card"><div className="eyebrow">STRUCTURAL VULNERABILITIES</div><h2>WHY THIS BOARD CAN FAIL</h2><div style={{display:'grid',gap:8}}>{read.vulnerabilities.map((v,i)=><div key={v} style={{padding:'10px 12px',border:'1px solid rgba(255,255,255,.08)',borderRadius:10}}><b>{i+1}.</b> {v}</div>)}</div></div>
    </section>
  </main></TftShell>;
}
