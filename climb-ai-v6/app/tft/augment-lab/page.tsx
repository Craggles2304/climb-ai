'use client';
import Image from 'next/image';
import {useEffect,useMemo,useState} from 'react';
import {TftShell} from '@/components/TftShell';
import {TFT_CARRY_PROFILES} from '@/lib/tft/carryBuilder';
import {analyseTftBoard,type TftBoardContext} from '@/lib/tft/boardLab';
import {TFT_AUGMENT_AS_OF,TFT_AUGMENT_PATCH,TFT_AUGMENT_SET,compareTftAugments,type TftAugmentEntry,type TftAugmentStage,type TftBoardPower,type TftPlanDirection} from '@/lib/tft/augmentDecision';

type StaticTrait={name:string;effects?:Array<{minUnits:number;maxUnits?:number;style?:number}>};
type StaticData={version:string;source:string;augments:TftAugmentEntry[];traits:StaticTrait[]};
type StoredBoard=Omit<TftBoardContext,'traitDefinitions'>;
const clampInt=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.floor(Number(n)||0)));
const metricRows=(read:ReturnType<typeof compareTftAugments>[number])=>[
  ['IMMEDIATE',read.immediatePower],['SCALING',read.scaling],['FLEXIBILITY',read.flexibility],['ECON / TEMPO',read.economyTempo],['SYNERGY',read.synergy],['COMMITMENT RISK',read.commitmentRisk]
] as const;

export default function TftAugmentLab(){
  const [data,setData]=useState<StaticData|null>(null);
  const [stage,setStage]=useState<TftAugmentStage>('3-2');
  const [hp,setHp]=useState(62);
  const [gold,setGold]=useState(36);
  const [level,setLevel]=useState(7);
  const [boardPower,setBoardPower]=useState<TftBoardPower>('EVEN');
  const [direction,setDirection]=useState<TftPlanDirection>('FLEX');
  const [carry,setCarry]=useState('');
  const [traitsText,setTraitsText]=useState('');
  const [itemsText,setItemsText]=useState('');
  const [choiceIds,setChoiceIds]=useState<string[]>(['','','']);
  const [status,setStatus]=useState('');

  useEffect(()=>{void fetch('/api/tft/static').then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||'Static data failed.');setData(body)}).catch(err=>setStatus(err instanceof Error?err.message:'Static data failed.'));},[]);
  const augments=useMemo(()=>[...(data?.augments||[])].filter(a=>a.name).sort((a,b)=>a.name.localeCompare(b.name)),[data]);
  const augmentMap=useMemo(()=>new Map(augments.map(a=>[a.id,a])),[augments]);
  const choices=choiceIds.map(id=>augmentMap.get(id)).filter(Boolean) as TftAugmentEntry[];
  const traits=useMemo(()=>traitsText.split(',').map(x=>x.trim()).filter(Boolean),[traitsText]);
  const items=useMemo(()=>itemsText.split(',').map(x=>x.trim()).filter(Boolean),[itemsText]);
  const reads=useMemo(()=>compareTftAugments(choices,{stage,hp,gold,level,boardPower,direction,carry:carry||undefined,traits,items}),[choices.map(x=>x.id).join('|'),stage,hp,gold,level,boardPower,direction,carry,traitsText,itemsText]);
  const duplicate=choiceIds.filter(Boolean).some((id,index,arr)=>arr.indexOf(id)!==index);

  const setChoice=(index:number,id:string)=>setChoiceIds(prev=>prev.map((value,i)=>i===index?id:value));
  const importBoard=()=>{
    try{
      const raw=localStorage.getItem('op_tft_board_lab_v1');
      if(!raw){setStatus('No saved Board Lab state was found in this browser.');return;}
      const board=JSON.parse(raw) as StoredBoard;
      const traitDefinitions=(data?.traits||[]).map(t=>({name:t.name,effects:Array.isArray(t.effects)?t.effects:[]}));
      const ctx:TftBoardContext={...board,traitDefinitions};
      const read=analyseTftBoard(ctx);
      const carryUnit=board.units.find(u=>u.role==='CARRY')||board.units.find(u=>u.items?.length>=2);
      const counts=new Map<string,number>();
      board.units.forEach(u=>(u.traits||[]).forEach(t=>counts.set(t,(counts.get(t)||0)+1)));
      const active=[...counts.entries()].filter(([,count])=>count>=2).sort((a,b)=>b[1]-a[1]).map(([name])=>name);
      const boardItems=board.units.flatMap(u=>u.items||[]);
      setHp(clampInt(board.hp,0,100));setGold(clampInt(board.gold,0,200));setLevel(clampInt(board.level,1,10));
      setStage((['2-1','3-2','4-2'].includes(board.stage)?board.stage:'3-2') as TftAugmentStage);
      setBoardPower(read.boardStrength<56?'WEAK':read.boardStrength>=72?'STRONG':'EVEN');
      setCarry(carryUnit?.name||'');setTraitsText(active.join(', '));setItemsText(boardItems.join(', '));
      setStatus(`Board Lab imported · ${read.boardStrength}/100 board strength · ${read.confidence}% board-read confidence.`);
    }catch{setStatus('The saved Board Lab state could not be read.');}
  };

  return <TftShell><main className="container section">
    <div className="eyebrow">SET {TFT_AUGMENT_SET} · PATCH {TFT_AUGMENT_PATCH} · PRACTICE / POST-GAME RECONSTRUCTION</div>
    <h1>AUGMENT DECISION LAB</h1>
    <p className="muted" style={{maxWidth:980}}>Rebuild an augment choice after the game or in a practice scenario. OP CLIMB scores the three options against your stage, HP, economy, board strength, carry direction, active traits and items—without pretending a global average-placement table knows your board better than the actual context.</p>

    <section className="glass card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'end',flexWrap:'wrap'}}><div><div className="eyebrow">CURRENT AUGMENT MODEL</div><h2 style={{margin:'3px 0'}}>ENCHANTED WILDS · 18.2</h2><p className="muted" style={{margin:0}}>Model snapshot {TFT_AUGMENT_AS_OF} · Riot static augment feed {data?.version||'loading…'}</p></div><span className="op-tier op-tier-pro">CONTEXT + COMMITMENT AWARE</span></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}><a className="btn secondary" target="_blank" rel="noreferrer" href="https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-18-2/">RIOT 18.2 AUGMENT CHANGES</a><a className="btn secondary" target="_blank" rel="noreferrer" href="https://tactics.tools/augments">CURRENT AUGMENT STATS</a><button className="btn primary" onClick={importBoard}>IMPORT SAVED BOARD LAB</button></div>
      {status&&<p style={{marginBottom:0}}><b>{status}</b></p>}
    </section>

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginTop:14}}>
      <div className="glass card"><div className="eyebrow">DECISION WINDOW</div><label>Augment stage<select value={stage} onChange={e=>setStage(e.target.value as TftAugmentStage)}><option value="2-1">2-1 · first augment</option><option value="3-2">3-2 · second augment</option><option value="4-2">4-2 · final augment</option></select></label><label style={{display:'block',marginTop:8}}>Level<input type="number" min={1} max={10} value={level} onChange={e=>setLevel(clampInt(Number(e.target.value),1,10))}/></label></div>
      <div className="glass card"><div className="eyebrow">SURVIVAL + ECON</div><label>HP<input type="number" min={0} max={100} value={hp} onChange={e=>setHp(clampInt(Number(e.target.value),0,100))}/></label><label style={{display:'block',marginTop:8}}>Gold<input type="number" min={0} max={200} value={gold} onChange={e=>setGold(clampInt(Number(e.target.value),0,200))}/></label></div>
      <div className="glass card"><div className="eyebrow">BOARD STATE</div><label>Board power<select value={boardPower} onChange={e=>setBoardPower(e.target.value as TftBoardPower)}><option value="WEAK">Weak · needs stabilising</option><option value="EVEN">Even · functional</option><option value="STRONG">Strong · can greed cap</option></select></label><p className="muted" style={{fontSize:10,marginBottom:0}}>Importing Board Lab converts its structural score into this state automatically.</p></div>
      <div className="glass card"><div className="eyebrow">GAME PLAN</div><label>Direction<select value={direction} onChange={e=>setDirection(e.target.value as TftPlanDirection)}><option value="FLEX">Flex / undecided</option><option value="AD">AD carry</option><option value="AP">AP carry</option><option value="REROLL">Reroll</option><option value="FAST_8">Fast 8</option><option value="FAST_9">Fast 9</option></select></label><label style={{display:'block',marginTop:8}}>Carry / anchor<select value={carry} onChange={e=>setCarry(e.target.value)}><option value="">None locked</option>{TFT_CARRY_PROFILES.map(p=><option key={p.champion} value={p.champion}>{p.champion}</option>)}</select></label></div>
    </section>

    <section className="glass card" style={{marginTop:14}}><div className="eyebrow">BOARD EVIDENCE</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><label>Active / important traits<input value={traitsText} onChange={e=>setTraitsText(e.target.value)} placeholder="e.g. Coven, Vanguard, Invoker"/></label><label>Important completed items<input value={itemsText} onChange={e=>setItemsText(e.target.value)} placeholder="e.g. Blue Buff, Last Whisper"/></label></div><p className="muted" style={{fontSize:10,marginBottom:0}}>Comma-separated. These fields are evidence, not requirements. Leaving them blank lowers confidence instead of inventing synergy.</p></section>

    <section style={{marginTop:18}}><div className="eyebrow">THE THREE OPTIONS</div><h2>REBUILD THE OFFER</h2><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:12}}>{[0,1,2].map(index=>{const selected=augmentMap.get(choiceIds[index]);return <div key={index} className="glass card"><div className="eyebrow">CHOICE {index+1}</div><select value={choiceIds[index]} onChange={e=>setChoice(index,e.target.value)}><option value="">Choose augment…</option>{augments.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>{selected&&<div style={{marginTop:12}}>{selected.image?<Image src={selected.image} alt="" width={46} height={46} style={{borderRadius:10}}/>:null}<h3 style={{margin:'8px 0 5px'}}>{selected.name}</h3><p className="muted" style={{fontSize:11}}>{selected.description||'No static description supplied.'}</p></div>}</div>})}</div>{duplicate&&<p style={{marginTop:10}}><b>Choose three different augments to compare them fairly.</b></p>}</section>

    {reads.length>0&&!duplicate&&<section style={{marginTop:18}}>
      <div className="eyebrow">CONTEXTUAL READ</div><h2>{reads.length===3?'WHICH OPTION FITS THIS RECONSTRUCTED STATE?':'ADD ALL THREE FOR THE FULL COMPARISON'}</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12}}>{reads.map((read,index)=><div key={read.augment.id} className="glass card" style={{border:index===0?'2px solid currentColor':undefined}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><div><div className="eyebrow">#{index+1} · {read.category}</div><h2 style={{margin:'3px 0'}}>{read.augment.name}</h2></div><div style={{textAlign:'right'}}><h1 style={{margin:0}}>{read.total}</h1><span className={`op-tier ${index===0?'op-tier-pro':read.verdict==='RISKY'?'op-tier-free':'op-tier-plus'}`}>{read.verdict}</span></div></div>
        <div className="cue-row"><span>MODEL CONFIDENCE</span><b>{read.confidence}%</b></div>
        <div style={{display:'grid',gap:7,marginTop:12}}>{metricRows(read).map(([label,value])=><div key={label}><div style={{display:'flex',justifyContent:'space-between',fontSize:10}}><span>{label}</span><b>{value}</b></div><div style={{height:7,borderRadius:99,background:'rgba(255,255,255,.07)',overflow:'hidden'}}><div style={{height:'100%',width:`${value}%`,background:'currentColor'}}/></div></div>)}</div>
        {read.patchNote&&<div style={{marginTop:12,padding:10,borderRadius:10,background:'rgba(255,255,255,.05)'}}><div className="eyebrow">18.2 PATCH ADJUSTMENT</div><b style={{fontSize:11}}>{read.patchNote}</b></div>}
        <div style={{marginTop:12}}><div className="eyebrow">WHY IT SCORES HERE</div>{read.reasons.map(reason=><p key={reason} className="muted" style={{fontSize:11,margin:'5px 0'}}>• {reason}</p>)}</div>
        {read.risks.length>0&&<div style={{marginTop:10}}><div className="eyebrow">TRADE-OFFS</div>{read.risks.map(risk=><p key={risk} className="muted" style={{fontSize:11,margin:'5px 0'}}>• {risk}</p>)}</div>}
      </div>)}</div>
    </section>}

    <section className="glass card" style={{marginTop:16}}><div className="eyebrow">DECISION MODEL BOUNDARY</div><p className="muted" style={{margin:0}}>This is a practice and post-game coaching model, not live shotcalling. It uses current Riot static augment text plus explicit Patch 18.2 adjustments for named changed augments. It does not embed a fake universal win-rate score: current aggregate stats are linked separately, while the OP CLIMB score measures contextual fit, timing and commitment risk from the state you enter.</p></section>
  </main></TftShell>;
}
