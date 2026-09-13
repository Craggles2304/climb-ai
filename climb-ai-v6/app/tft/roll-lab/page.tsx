'use client';
import Image from 'next/image';
import {useEffect,useMemo,useState} from 'react';
import {TftShell} from '@/components/TftShell';
import {TFT_BAG_SIZE,TFT_ROLL_AS_OF,TFT_ROLL_PATCH,TFT_ROLL_SET,TFT_UNIQUE_BY_COST,compareRollVsLevel,estimateRoll,goldForChance,goalCopies,poolPressureLabel,practicalOddsRows,type TftCost,type TftStarGoal} from '@/lib/tft/rollOdds';

type StaticChampion={id:string;name:string;tier:number|string|null;image:string|null};
type StaticData={version:string;source:string;champions:StaticChampion[]};
const pct=(n:number)=>`${(n*100).toFixed(n<.1?1:0)}%`;
const clampInt=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.floor(Number(n)||0)));

export default function TftRollLab(){
  const [data,setData]=useState<StaticData|null>(null);
  const [targetId,setTargetId]=useState('');
  const [cost,setCost]=useState<TftCost>(4);
  const [level,setLevel]=useState(8);
  const [goal,setGoal]=useState<TftStarGoal>(2);
  const [own,setOwn]=useState(0);
  const [contested,setContested]=useState(0);
  const [otherTierOut,setOtherTierOut]=useState(0);
  const [gold,setGold]=useState(40);
  const [reserve,setReserve]=useState(0);
  const [xpToNext,setXpToNext]=useState(32);
  const [status,setStatus]=useState('');

  useEffect(()=>{void fetch('/api/tft/static').then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||'Static data failed.');setData(body)}).catch(err=>setStatus(err instanceof Error?err.message:'Static data failed.'));},[]);
  const champions=useMemo(()=>[...(data?.champions||[])].filter(c=>Number(c.tier)>=1&&Number(c.tier)<=5).sort((a,b)=>Number(a.tier)-Number(b.tier)||a.name.localeCompare(b.name)),[data]);
  const target=champions.find(c=>c.id===targetId)||null;

  const shared={level,cost,goal,ownCopies:own,contestedCopies:contested,otherSameCostCopiesOut:otherTierOut};
  const comparison=useMemo(()=>compareRollVsLevel({...shared,currentGold:gold,reserveGold:reserve,xpToNext}),[level,cost,goal,own,contested,otherTierOut,gold,reserve,xpToNext]);
  const rollNow=comparison.rollNow;
  const thresholds=useMemo(()=>({p50:goldForChance(shared,.5),p80:goldForChance(shared,.8),p95:goldForChance(shared,.95)}),[level,cost,goal,own,contested,otherTierOut]);
  const curve=useMemo(()=>[10,20,30,40,50,60].map(g=>({gold:g,current:estimateRoll({...shared,goldToRoll:g}),next:level<10?estimateRoll({...shared,level:level+1,goldToRoll:g}):null})),[level,cost,goal,own,contested,otherTierOut]);
  const pressure=poolPressureLabel(cost,own,contested);
  const wanted=goalCopies(goal);
  const impossible=own+Math.max(0,TFT_BAG_SIZE[cost]-own-contested)<wanted;

  const selectTarget=(id:string)=>{
    setTargetId(id);
    const champ=champions.find(c=>c.id===id);
    if(champ){setCost(clampInt(Number(champ.tier),1,5) as TftCost);setOwn(0);setContested(0);setOtherTierOut(0);}
  };

  const verdictLabel=comparison.verdict==='LEVEL_FIRST_EDGE'?'LEVEL FIRST HAS THE MATH EDGE':comparison.verdict==='ROLL_NOW_EDGE'?'ROLLING HERE HAS THE MATH EDGE':comparison.verdict==='NO_LEVEL_OPTION'?'ROLL / HOLD ONLY':'CLOSE TRADE-OFF';

  return <TftShell><main className="container section">
    <div className="eyebrow">SET {TFT_ROLL_SET} · PATCH {TFT_ROLL_PATCH} · PRACTICE / POST-GAME MODEL</div>
    <h1>ECONOMY + ROLL ODDS LAB</h1>
    <p className="muted" style={{maxWidth:980}}>Rebuild a shop decision and quantify it. OP CLIMB models your level, target cost, shared-pool pressure, copies needed, gold budget and XP cost to compare rolling now against leveling first. It is a planning/review tool, not live adaptive shotcalling.</p>

    <section className="glass card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'end',flexWrap:'wrap'}}><div><div className="eyebrow">CURRENT SYSTEM DATA</div><h2 style={{margin:'3px 0'}}>ENCHANTED WILDS · 18.2</h2><p className="muted" style={{margin:0}}>Model snapshot {TFT_ROLL_AS_OF} · Riot static champions {data?.version||'loading…'}</p></div><span className="op-tier op-tier-pro">POOL-AWARE</span></div>
      {status&&<p style={{marginBottom:0}}><b>{status}</b></p>}
    </section>

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginTop:14}}>
      <div className="glass card"><div className="eyebrow">TARGET</div><label>Champion<select value={targetId} onChange={e=>selectTarget(e.target.value)}><option value="">Manual cost only</option>{champions.map(c=><option key={c.id} value={c.id}>{c.name} · {c.tier}-cost</option>)}</select></label>{target&&<div style={{display:'flex',gap:9,alignItems:'center',marginTop:10}}>{target.image?<Image src={target.image} alt="" width={46} height={46} style={{borderRadius:10}}/>:null}<div><b>{target.name}</b><div className="muted">{cost}-cost target</div></div></div>}<label style={{marginTop:10,display:'block'}}>Cost<select value={cost} onChange={e=>{setTargetId('');setCost(Number(e.target.value) as TftCost)}}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}-cost</option>)}</select></label></div>
      <div className="glass card"><div className="eyebrow">STAR GOAL</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><button className={`btn ${goal===2?'primary':'secondary'}`} onClick={()=>setGoal(2)}>2★ · 3 COPIES</button><button className={`btn ${goal===3?'primary':'secondary'}`} onClick={()=>setGoal(3)}>3★ · 9 COPIES</button></div><label style={{marginTop:10,display:'block'}}>Copies you own<input type="number" min={0} max={TFT_BAG_SIZE[cost]} value={own} onChange={e=>setOwn(clampInt(Number(e.target.value),0,TFT_BAG_SIZE[cost]))}/></label><div className="cue-row"><span>NEED</span><b>{Math.max(0,wanted-own)} more</b></div></div>
      <div className="glass card"><div className="eyebrow">SHARED POOL</div><label>Target copies opponents hold<input type="number" min={0} max={TFT_BAG_SIZE[cost]} value={contested} onChange={e=>setContested(clampInt(Number(e.target.value),0,TFT_BAG_SIZE[cost]-own))}/></label><label style={{marginTop:8,display:'block'}}>Other {cost}-cost copies out of pool<input type="number" min={0} value={otherTierOut} onChange={e=>setOtherTierOut(clampInt(Number(e.target.value),0,999))}/></label><div className="cue-row"><span>CONTEST PRESSURE</span><b>{pressure}</b></div></div>
      <div className="glass card"><div className="eyebrow">ECON STATE</div><label>Current level<select value={level} onChange={e=>setLevel(Number(e.target.value))}>{[4,5,6,7,8,9,10].map(n=><option key={n} value={n}>Level {n}</option>)}</select></label><label style={{marginTop:8,display:'block'}}>Current gold<input type="number" min={0} value={gold} onChange={e=>setGold(clampInt(Number(e.target.value),0,200))}/></label><label style={{marginTop:8,display:'block'}}>Gold you refuse to spend<input type="number" min={0} value={reserve} onChange={e=>setReserve(clampInt(Number(e.target.value),0,gold))}/></label>{level<10&&<label style={{marginTop:8,display:'block'}}>XP remaining to next level<input type="number" min={0} value={xpToNext} onChange={e=>setXpToNext(clampInt(Number(e.target.value),0,100))}/></label>}</div>
    </section>

    {impossible&&<section className="glass card" style={{marginTop:14,border:'2px solid currentColor'}}><div className="eyebrow">POOL LIMIT</div><h2>THIS STAR GOAL IS NOT AVAILABLE FROM THE KNOWN POOL</h2><p className="muted">With the copies you own plus the target copies already held by opponents, fewer than {wanted} copies are available to assemble this unit. A duplicator or copies returning to the pool would change that.</p></section>}

    <section className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">DECISION COMPARISON</div><h2>{verdictLabel}</h2><p className="muted">{comparison.note}</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>
        <div style={{padding:14,borderRadius:16,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)'}}><div className="eyebrow">ROLL NOW · LEVEL {level}</div><h1 style={{margin:'5px 0'}}>{pct(rollNow.chanceFinish)}</h1><b>finish {goal}★ with {comparison.rollNowBudget}g of rolls</b><div className="cue-row"><span>AT LEAST ONE TARGET</span><b>{pct(rollNow.chanceAtLeastOne)}</b></div><div className="cue-row"><span>EXPECTED TARGETS</span><b>{rollNow.expectedHits.toFixed(2)}</b></div><div className="cue-row"><span>{cost}-COST ODDS / SLOT</span><b>{pct(rollNow.tierOdds)}</b></div></div>
        {comparison.levelFirst&&<div style={{padding:14,borderRadius:16,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)'}}><div className="eyebrow">LEVEL FIRST · LEVEL {level+1}</div><h1 style={{margin:'5px 0'}}>{pct(comparison.levelFirst.chanceFinish)}</h1><b>{comparison.levelCost}g XP · {comparison.levelFirstBudget}g left to roll</b><div className="cue-row"><span>AT LEAST ONE TARGET</span><b>{pct(comparison.levelFirst.chanceAtLeastOne)}</b></div><div className="cue-row"><span>EXPECTED TARGETS</span><b>{comparison.levelFirst.expectedHits.toFixed(2)}</b></div><div className="cue-row"><span>{cost}-COST ODDS / SLOT</span><b>{pct(comparison.levelFirst.tierOdds)}</b></div></div>}
        <div style={{padding:14,borderRadius:16,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)'}}><div className="eyebrow">HOLD / ECON</div><h1 style={{margin:'5px 0'}}>{gold}g</h1><b>keep resources instead of taking immediate shop variance</b><div className="cue-row"><span>RESERVE FLOOR</span><b>{reserve}g</b></div><div className="cue-row"><span>KNOWN TARGET LEFT</span><b>{rollNow.targetCopiesRemaining}/{TFT_BAG_SIZE[cost]}</b></div><div className="cue-row"><span>KNOWN {cost}-COST POOL LEFT</span><b>{rollNow.sameCostPoolRemaining}</b></div></div>
      </div>
    </section>

    <section style={{display:'grid',gridTemplateColumns:'minmax(0,1.2fr) minmax(250px,.8fr)',gap:14,marginTop:16}}>
      <div className="glass card"><div className="eyebrow">PROBABILITY CURVE</div><h2>HOW MUCH GOLD CHANGES THE HIT</h2><div style={{display:'grid',gap:9}}>{curve.map(row=><div key={row.gold}><div style={{display:'grid',gridTemplateColumns:'54px 1fr auto',gap:8,alignItems:'center'}}><b>{row.gold}g</b><div style={{height:9,borderRadius:99,background:'rgba(255,255,255,.07)',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.round(row.current.chanceFinish*100)}%`,background:'currentColor'}}/></div><b>{pct(row.current.chanceFinish)}</b></div>{row.next&&<div className="muted" style={{fontSize:10,marginLeft:62}}>Same {row.gold}g of rolls at level {level+1}: {pct(row.next.chanceFinish)}</div>}</div>)}</div></div>
      <div className="glass card"><div className="eyebrow">GOLD TARGETS · LEVEL {level}</div><h2>ROLLOUT THRESHOLDS</h2><div className="cue-row"><span>50% TO FINISH</span><b>{thresholds.p50===null?'120g+':`${thresholds.p50}g`}</b></div><div className="cue-row"><span>80% TO FINISH</span><b>{thresholds.p80===null?'120g+':`${thresholds.p80}g`}</b></div><div className="cue-row"><span>95% TO FINISH</span><b>{thresholds.p95===null?'120g+':`${thresholds.p95}g`}</b></div><p className="muted" style={{fontSize:11}}>These are pool-aware estimates using the known pool state you entered. They do not predict other players buying/selling units during your rolldown.</p></div>
    </section>

    <section className="glass card" style={{marginTop:16}}><div className="eyebrow">TARGET COST CURVE</div><h2>WHERE DOES A {cost}-COST LIVE?</h2><div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:7}}>{practicalOddsRows(cost).map(row=><div key={row.level} style={{padding:10,borderRadius:12,textAlign:'center',background:row.level===level?'rgba(255,255,255,.1)':'rgba(255,255,255,.03)',border:row.level===level?'2px solid currentColor':'1px solid rgba(255,255,255,.07)'}}><div className="eyebrow">LV {row.level}</div><b>{pct(row.odds)}</b></div>)}</div></section>

    <section className="glass card" style={{marginTop:16}}><div className="eyebrow">MODEL BOUNDARY</div><p className="muted" style={{margin:0}}>Set 18 / Patch 18.2 shop odds and bag sizes are treated as system inputs. Each 2g refresh gives five shop slots. The probability model updates the target pool as copies are hit and assumes entered contested/other same-cost copies remain out of the pool during the scenario. It does not model future opponent purchases, Wisps, special Augments, duplicators, Loaded Dice-style effects or non-standard shop modifiers.</p><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>{([1,2,3,4,5] as TftCost[]).map(c=><span key={c} className="op-tier op-tier-free">{c}-COST · {TFT_BAG_SIZE[c]} EACH · {TFT_UNIQUE_BY_COST[c]} UNITS</span>)}</div></section>
  </main></TftShell>;
}
