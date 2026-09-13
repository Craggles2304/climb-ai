'use client';
import Image from 'next/image';
import {useEffect,useMemo,useState} from 'react';
import {TftShell} from '@/components/TftShell';
import {compareTftBoards,type TftBoardSnapshot} from '@/lib/tft/boardCompare';
import type {TftBoardRole,TftBoardStar,TftBoardUnit,TftTraitDefinition} from '@/lib/tft/boardLab';

type StaticEntry={id:string;name:string;tier:number|string|null;image:string|null;traits?:string[];stats?:{hp?:number;armor?:number;magicResist?:number;attackDamage?:number;attackSpeed?:number;range?:number}|null;effects?:Array<{minUnits:number;maxUnits?:number;style?:number}>};
type StaticData={version:string;champions:StaticEntry[];items:StaticEntry[];traits:StaticEntry[]};
type LabDraft=Omit<TftBoardSnapshot,'name'|'capturedAt'>;

const LAB_KEY='op_tft_board_lab_v1';
const A_KEY='op_tft_board_compare_a_v1';
const B_KEY='op_tft_board_compare_b_v1';
const roles:TftBoardRole[]=['FRONTLINE','CARRY','SUPPORT','FLEX'];
const stages=['2-1','2-5','3-2','3-5','4-1','4-2','4-5','5-1','5-5','6-1'];

function snapshot(draft:LabDraft,name:string):TftBoardSnapshot{return{...draft,name,capturedAt:new Date().toISOString(),units:(draft.units||[]).map(u=>({...u,items:[...(u.items||[])],traits:[...(u.traits||[])]})),augments:[...(draft.augments||[])]};}
function empty():TftBoardSnapshot{return{name:'BOARD A',capturedAt:new Date().toISOString(),stage:'4-2',level:7,hp:50,gold:40,unusedComponents:0,completedItemsBench:0,augments:['','',''],units:[]};}
function firstOpen(units:TftBoardUnit[],preferredRow:number){const used=new Set(units.map(u=>`${u.row}-${u.col}`));for(const row of [preferredRow,...[0,1,2,3].filter(r=>r!==preferredRow)])for(let col=0;col<7;col++)if(!used.has(`${row}-${col}`))return{row,col};return{row:3,col:6};}
function delta(n:number){return`${n>0?'+':''}${n}`;}
function verdictClass(v:string){return v.includes('BOARD B')?'op-tier-plus':v.includes('BOARD A')?'op-tier-free':'op-tier-pro';}

function MiniBoard({board,data,title}:{board:TftBoardSnapshot;data:StaticData|null;title:string}){
  return <div className="glass card" style={{padding:14}}><div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'end'}}><div><div className="eyebrow">{title}</div><h3 style={{margin:'3px 0'}}>{board.name}</h3></div><span className="muted">LV {board.level} · {board.gold}g · {board.hp} HP</span></div><div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(34px,1fr))',gap:4,marginTop:10}}>{[0,1,2,3].flatMap(row=>[0,1,2,3,4,5,6].map(col=>{const unit=board.units.find(u=>u.row===row&&u.col===col);const champ=unit&&data?.champions.find(c=>c.id===unit.championId);return <div key={`${row}-${col}`} title={unit?`${unit.name} ${'★'.repeat(unit.star)}`:''} style={{height:48,border:'1px solid rgba(255,255,255,.08)',borderRadius:8,display:'grid',placeItems:'center',background:unit?'rgba(255,255,255,.07)':'rgba(255,255,255,.02)',overflow:'hidden'}}>{unit?<div style={{textAlign:'center'}}>{champ?.image?<Image src={champ.image} alt="" width={28} height={28} style={{borderRadius:6,objectFit:'cover'}}/>:<b style={{fontSize:9}}>{unit.name.slice(0,4)}</b>}<div style={{fontSize:7,lineHeight:1}}>{'★'.repeat(unit.star)}</div></div>:null}</div>}))}</div></div>;
}

export default function TftBoardCompare(){
  const [data,setData]=useState<StaticData|null>(null);
  const [boardA,setBoardA]=useState<TftBoardSnapshot>(empty());
  const [boardB,setBoardB]=useState<TftBoardSnapshot>({...empty(),name:'BOARD B'});
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  const [hydrated,setHydrated]=useState(false);

  useEffect(()=>{
    try{
      const savedA=localStorage.getItem(A_KEY);const savedB=localStorage.getItem(B_KEY);const lab=localStorage.getItem(LAB_KEY);
      if(savedA)setBoardA(JSON.parse(savedA));else if(lab)setBoardA(snapshot(JSON.parse(lab),'CURRENT BOARD'));
      if(savedB)setBoardB(JSON.parse(savedB));else if(savedA)setBoardB({...JSON.parse(savedA),name:'BOARD B',capturedAt:new Date().toISOString()});else if(lab)setBoardB(snapshot(JSON.parse(lab),'PLANNED BOARD'));
    }catch{}
    setHydrated(true);
    void fetch('/api/tft/static').then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||'Static data failed.');setData(body)}).catch(err=>setMessage(err instanceof Error?err.message:'Static data failed.'));
  },[]);
  useEffect(()=>{if(!hydrated)return;try{localStorage.setItem(A_KEY,JSON.stringify(boardA));localStorage.setItem(B_KEY,JSON.stringify(boardB))}catch{}},[boardA,boardB,hydrated]);

  const traitDefinitions=useMemo<TftTraitDefinition[]>(()=>(data?.traits||[]).map(t=>({name:t.name,effects:(t.effects||[]).filter(e=>e.minUnits>0)})),[data]);
  const comparison=useMemo(()=>compareTftBoards(boardA,boardB,traitDefinitions),[boardA,boardB,traitDefinitions]);
  const items=useMemo(()=>(data?.items||[]).filter(x=>x.name&&x.name.length<60).sort((a,b)=>a.name.localeCompare(b.name)),[data]);
  const champions=useMemo(()=>{const q=query.toLowerCase().trim();return(data?.champions||[]).filter(c=>Number(c.tier)>=1&&Number(c.tier)<=5&&(!q||`${c.name} ${(c.traits||[]).join(' ')}`.toLowerCase().includes(q))).sort((a,b)=>Number(a.tier||9)-Number(b.tier||9)||a.name.localeCompare(b.name)).slice(0,50)},[data,query]);
  const active=boardB.units.find(u=>u.id===selected)||null;

  const importCurrent=()=>{try{const raw=localStorage.getItem(LAB_KEY);if(!raw){setMessage('Build a board in Board Lab first.');return;}const next=snapshot(JSON.parse(raw),'CURRENT BOARD');setBoardA(next);setBoardB({...next,name:'PLANNED BOARD',capturedAt:new Date().toISOString(),units:next.units.map(u=>({...u,id:`${u.id}-b`,items:[...u.items],traits:[...u.traits]}))});setMessage('Current Board Lab imported as A and cloned to B.');}catch{setMessage('Could not read the current Board Lab draft.')}};
  const cloneA=()=>{setBoardB({...boardA,name:'PLANNED BOARD',capturedAt:new Date().toISOString(),units:boardA.units.map(u=>({...u,id:`${u.championId}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,items:[...u.items],traits:[...u.traits]})),augments:[...boardA.augments]});setSelected(null)};
  const promoteB=()=>{setBoardA({...boardB,name:'CURRENT BOARD',capturedAt:new Date().toISOString(),units:boardB.units.map(u=>({...u,items:[...u.items],traits:[...u.traits]}))});setMessage('Board B is now the new comparison baseline.');};
  const editBInLab=()=>{try{const {name:_,capturedAt:__,...draft}=boardB;localStorage.setItem(LAB_KEY,JSON.stringify(draft));window.location.href='/tft/board-lab';}catch{setMessage('Could not send Board B to Board Lab.')}};
  const updateB=(patch:Partial<TftBoardSnapshot>)=>setBoardB(p=>({...p,...patch}));
  const updateUnit=(id:string,patch:Partial<TftBoardUnit>)=>setBoardB(p=>({...p,units:p.units.map(u=>u.id===id?{...u,...patch}:u)}));
  const removeUnit=(id:string)=>{setBoardB(p=>({...p,units:p.units.filter(u=>u.id!==id)}));if(selected===id)setSelected(null)};
  const addChampion=(entry:StaticEntry)=>{if(boardB.units.length>=Math.min(10,boardB.level)){setMessage(`Board B already fills level ${boardB.level}.`);return;}const role:TftBoardRole=(entry.stats?.range||1)>=3?'CARRY':'FRONTLINE';const pos=firstOpen(boardB.units,role==='CARRY'?3:0);const unit:TftBoardUnit={id:`${entry.id}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,championId:entry.id,name:entry.name,cost:Number(entry.tier)||1,star:1,role,items:[],traits:entry.traits||[],stats:entry.stats||undefined,row:pos.row,col:pos.col};setBoardB(p=>({...p,units:[...p.units,unit]}));setSelected(unit.id);setMessage('')};
  const setItem=(slot:number,name:string)=>{if(!active)return;const next=[...active.items];while(next.length<=slot)next.push('');next[slot]=name;updateUnit(active.id,{items:next.filter(Boolean).slice(0,3)})};

  return <TftShell><main className="container section">
    <div className="eyebrow">DECISION COMPARATOR · POST-GAME / PRACTICE</div><h1>BOARD A vs BOARD B</h1><p className="muted" style={{maxWidth:900}}>Test whether a level-up, pivot, upgrade, item move or positioning change actually improves the board. The comparison uses the same transparent Board Strength model on both states—it is <b>not</b> an exact combat simulator.</p>

    <section className="glass card" style={{marginTop:18,display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><div><div className="eyebrow">FAST WORKFLOW</div><b>Import the board you already built, clone it, then change only the proposed decision.</b></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn primary" onClick={importCurrent}>IMPORT CURRENT BOARD AS A</button><button className="btn secondary" onClick={cloneA}>CLONE A → B</button><button className="btn secondary" onClick={promoteB}>MAKE B NEW BASELINE</button></div></section>
    {message&&<div className="glass card" style={{marginTop:10,padding:12}}><b>{message}</b></div>}

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:14,marginTop:16}}><MiniBoard board={boardA} data={data} title="BOARD A · BASELINE"/><MiniBoard board={boardB} data={data} title="BOARD B · PROPOSED"/></section>

    <section style={{display:'grid',gridTemplateColumns:'minmax(250px,.55fr) minmax(0,1.45fr)',gap:16,marginTop:16}}>
      <div className="glass card"><div className="eyebrow">STRUCTURAL VERDICT</div><h2>{comparison.verdict}</h2><div style={{display:'flex',alignItems:'baseline',gap:8}}><h1 style={{fontSize:52,margin:'6px 0'}}>{delta(comparison.strengthDelta)}</h1><b>BOARD STRENGTH</b></div><div className="cue-row"><span>COMPARE CONFIDENCE</span><b>{comparison.confidence}%</b></div><span className={`op-tier ${verdictClass(comparison.verdict)}`} style={{marginTop:10,display:'inline-block'}}>{comparison.readA.boardStrength} A → {comparison.readB.boardStrength} B</span></div>
      <div className="glass card"><div className="eyebrow">WHY IT CHANGED</div><h2>THE DELTA, NOT JUST THE SCORE</h2><div style={{display:'grid',gap:8}}>{comparison.explanations.map((x,i)=><div key={x} style={{padding:'10px 12px',border:'1px solid rgba(255,255,255,.08)',borderRadius:10}}><b>{i+1}.</b> {x}</div>)}</div><div style={{marginTop:12,padding:12,border:'1px solid rgba(255,255,255,.12)',borderRadius:10}}><div className="eyebrow">COACH QUESTION</div><b>{comparison.question}</b></div></div>
    </section>

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginTop:14}}>{comparison.metrics.map(m=><div className="glass card" key={m.key} style={{padding:14}}><div className="eyebrow">{m.label.toUpperCase()}</div><h2 style={{margin:'7px 0'}}>{delta(m.delta)}</h2><div className="cue-row"><span>A</span><b>{m.a}</b></div><div className="cue-row"><span>B</span><b>{m.b}</b></div><p className="muted" style={{fontSize:10,marginBottom:0}}>{m.winner==='EVEN'?'No meaningful structural change.':`Board ${m.winner} wins this axis.`}</p></div>)}</section>

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:14,marginTop:16}}>
      <div className="glass card"><div className="eyebrow">TRADE-OFF READ</div><h2>WHAT BOARD B BUYS — AND WHAT IT COSTS</h2><div style={{display:'grid',gap:8}}>{comparison.tradeoffs.map((x,i)=><div key={x} style={{padding:'10px 12px',border:'1px solid rgba(255,255,255,.08)',borderRadius:10}}><b>{i+1}.</b> {x}</div>)}</div></div>
      <div className="glass card"><div className="eyebrow">UNIT + TRAIT CHANGES</div><h2>WHAT ACTUALLY MOVED</h2><div className="cue-row"><span>ADDED</span><b>{comparison.gainedUnits.join(', ')||'—'}</b></div><div className="cue-row"><span>REMOVED</span><b>{comparison.lostUnits.join(', ')||'—'}</b></div><div className="cue-row"><span>UPGRADES</span><b>{comparison.upgradedUnits.join(', ')||'—'}</b></div><div className="cue-row"><span>DOWNGRADES</span><b>{comparison.downgradedUnits.join(', ')||'—'}</b></div><div className="cue-row"><span>TRAITS GAINED</span><b>{comparison.gainedTraits.join(', ')||'—'}</b></div><div className="cue-row"><span>TRAITS LOST</span><b>{comparison.lostTraits.join(', ')||'—'}</b></div></div>
    </section>

    <section className="glass card" style={{marginTop:16}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'end',gap:12,flexWrap:'wrap'}}><div><div className="eyebrow">EDIT BOARD B</div><h2>CHANGE ONE DECISION AT A TIME</h2><p className="muted" style={{margin:0}}>For a clean replay, clone A and change only the level, swap, star, item or position you are testing.</p></div><button className="btn secondary" onClick={editBInLab}>EDIT B IN FULL BOARD LAB</button></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10,marginTop:14}}><label><span className="eyebrow">STAGE</span><select value={boardB.stage} onChange={e=>updateB({stage:e.target.value})}>{stages.map(s=><option key={s}>{s}</option>)}</select></label><label><span className="eyebrow">LEVEL</span><input type="number" min={3} max={10} value={boardB.level} onChange={e=>updateB({level:Math.max(3,Math.min(10,Number(e.target.value)||3))})}/></label><label><span className="eyebrow">HP</span><input type="number" min={1} max={100} value={boardB.hp} onChange={e=>updateB({hp:Math.max(1,Math.min(100,Number(e.target.value)||1))})}/></label><label><span className="eyebrow">GOLD</span><input type="number" min={0} value={boardB.gold} onChange={e=>updateB({gold:Math.max(0,Number(e.target.value)||0)})}/></label><label><span className="eyebrow">COMPONENTS HELD</span><input type="number" min={0} value={boardB.unusedComponents} onChange={e=>updateB({unusedComponents:Math.max(0,Number(e.target.value)||0)})}/></label><label><span className="eyebrow">BENCHED ITEMS</span><input type="number" min={0} value={boardB.completedItemsBench} onChange={e=>updateB({completedItemsBench:Math.max(0,Number(e.target.value)||0)})}/></label></div>
    </section>

    <section style={{display:'grid',gridTemplateColumns:'minmax(0,1.25fr) minmax(280px,.75fr)',gap:14,marginTop:14}}>
      <div className="glass card"><div className="eyebrow">BOARD B UNITS</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8,marginTop:10}}>{boardB.units.map(u=><button key={u.id} onClick={()=>setSelected(u.id)} style={{padding:9,borderRadius:10,border:selected===u.id?'2px solid currentColor':'1px solid rgba(255,255,255,.09)',background:'rgba(255,255,255,.04)',textAlign:'left',cursor:'pointer'}}><b>{u.name}</b><div className="muted" style={{fontSize:10}}>{'★'.repeat(u.star)} · {u.role} · row {u.row+1}</div></button>)}</div>{!boardB.units.length&&<p className="muted">Clone Board A or add champions below.</p>}</div>
      <div className="glass card"><div className="eyebrow">SELECTED UNIT</div>{active?<><h3>{active.name}</h3><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>{([1,2,3] as TftBoardStar[]).map(star=><button key={star} className={`btn ${active.star===star?'primary':'secondary'}`} onClick={()=>updateUnit(active.id,{star})}>{'★'.repeat(star)}</button>)}</div><select style={{marginTop:8}} value={active.role} onChange={e=>updateUnit(active.id,{role:e.target.value as TftBoardRole})}>{roles.map(r=><option key={r}>{r}</option>)}</select><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginTop:8}}><label><span className="eyebrow">ROW</span><select value={active.row} onChange={e=>updateUnit(active.id,{row:Number(e.target.value)})}>{[0,1,2,3].map(x=><option key={x} value={x}>{x+1}</option>)}</select></label><label><span className="eyebrow">COL</span><select value={active.col} onChange={e=>updateUnit(active.id,{col:Number(e.target.value)})}>{[0,1,2,3,4,5,6].map(x=><option key={x} value={x}>{x+1}</option>)}</select></label></div><div style={{display:'grid',gap:6,marginTop:8}}>{[0,1,2].map(slot=><select key={slot} value={active.items[slot]||''} onChange={e=>setItem(slot,e.target.value)}><option value="">Item slot {slot+1}</option>{items.slice(0,350).map(item=><option key={`${slot}-${item.id}`} value={item.name}>{item.name}</option>)}</select>)}</div><button className="btn secondary" style={{width:'100%',marginTop:8}} onClick={()=>removeUnit(active.id)}>REMOVE FROM B</button></>:<p className="muted">Select a Board B unit to change its upgrade, role, position or items.</p>}</div>
    </section>

    <section className="glass card" style={{marginTop:14}}><div className="eyebrow">ADD / SWAP CHAMPION IN BOARD B</div><input style={{marginTop:8}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search champion or trait…"/><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))',gap:8,marginTop:10,maxHeight:260,overflowY:'auto'}}>{champions.map(c=><button key={c.id} onClick={()=>addChampion(c)} style={{display:'grid',gridTemplateColumns:'34px 1fr',gap:7,alignItems:'center',padding:7,border:'1px solid rgba(255,255,255,.08)',borderRadius:9,background:'rgba(255,255,255,.04)',textAlign:'left',cursor:'pointer'}}>{c.image?<Image src={c.image} alt="" width={34} height={34} style={{borderRadius:7}}/>:<span/>}<span><b style={{fontSize:10}}>{c.name}</b><div className="muted" style={{fontSize:8}}>{Number(c.tier)||'?'}C · {(c.traits||[]).slice(0,2).join(' · ')}</div></span></button>)}</div></section>
  </main></TftShell>;
}
