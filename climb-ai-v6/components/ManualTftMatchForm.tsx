'use client';
import {useMemo,useState} from 'react';
import {track} from '@/lib/analytics';
import type {TftGamePlan,TftLossReason,TftPlanFollowed} from '@/lib/tft/types';

type Props={riotAccountId:string;disabled?:boolean;onSaved:()=>Promise<void>|void};
const placements=[1,2,3,4,5,6,7,8];
const PLAN_KEY='op_tft_game_plan';
const reasons:{value:TftLossReason;label:string}[]=[
  {value:'economy',label:'Economy'},{value:'tempo',label:'Tempo'},{value:'items',label:'Items'},
  {value:'positioning',label:'Positioning'},{value:'contested',label:'Contested'},
  {value:'pivot',label:'Pivot'},{value:'variance',label:'Variance'},{value:'execution',label:'Execution'},
  {value:'other',label:'Other'},
];

function currentPlan():TftGamePlan|undefined{
  try{
    const raw=localStorage.getItem(PLAN_KEY);if(!raw)return undefined;
    const parsed=JSON.parse(raw) as TftGamePlan;
    return parsed?.lockedAt?parsed:undefined;
  }catch{return undefined}
}

export function ManualTftMatchForm({riotAccountId,disabled,onSaved}:Props){
  const [placement,setPlacement]=useState(4);
  const [comp,setComp]=useState('');
  const [level,setLevel]=useState('8');
  const [gold,setGold]=useState('');
  const [round,setRound]=useState('');
  const [damage,setDamage]=useState('');
  const [elims,setElims]=useState('');
  const [augments,setAugments]=useState('');
  const [units,setUnits]=useState('');
  const [note,setNote]=useState('');
  const [advanced,setAdvanced]=useState(false);
  const [reviewOpen,setReviewOpen]=useState(true);
  const [lossReason,setLossReason]=useState<TftLossReason|''>('');
  const [firstUnstableStage,setFirstUnstableStage]=useState('');
  const [rolledLate,setRolledLate]=useState<'yes'|'no'|'unknown'>('unknown');
  const [planFollowed,setPlanFollowed]=useState<TftPlanFollowed>('unknown');
  const [keyDecision,setKeyDecision]=useState('');
  const [wouldRepeat,setWouldRepeat]=useState('');
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const valid=useMemo(()=>comp.trim().length>0&&!saving&&!disabled,[comp,saving,disabled]);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!valid)return;
    setSaving(true);setMessage('');
    try{
      const planSnapshot=currentPlan();
      const body={
        riotAccountId,
        placement,
        compSignature:comp.trim(),
        level:level?Number(level):undefined,
        goldLeft:gold?Number(gold):undefined,
        lastRound:round?Number(round):undefined,
        totalDamageToPlayers:damage?Number(damage):undefined,
        playersEliminated:elims?Number(elims):undefined,
        augments:augments.split(',').map(x=>x.trim()).filter(Boolean).slice(0,3),
        units:units.split(',').map(x=>x.trim()).filter(Boolean).slice(0,12).map(name=>({name,itemNames:[]})),
        note:note.trim()||undefined,
        lossReason:lossReason||undefined,
        firstUnstableStage:firstUnstableStage||undefined,
        rolledTooLate:rolledLate==='unknown'?undefined:rolledLate==='yes',
        planFollowed,
        keyDecision:keyDecision.trim()||undefined,
        wouldRepeat:wouldRepeat.trim()||undefined,
        planSnapshot,
      };
      const res=await fetch('/api/tft/manual',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Could not save TFT game.');
      track('tft_manual_game_added',{placement,hasAdvanced:advanced,hasReview:Boolean(lossReason||keyDecision||firstUnstableStage),planFollowed,hadLockedPlan:Boolean(planSnapshot)});
      setMessage('Game saved. Your TFT coaching model has been updated.');
      setComp('');setGold('');setRound('');setDamage('');setElims('');setAugments('');setUnits('');setNote('');
      setLossReason('');setFirstUnstableStage('');setRolledLate('unknown');setPlanFollowed('unknown');setKeyDecision('');setWouldRepeat('');
      await onSaved();
    }catch(err){setMessage(err instanceof Error?err.message:'Could not save TFT game.')}finally{setSaving(false)}
  };

  return <form className="glass card" onSubmit={submit} style={{marginTop:18}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><div className="eyebrow">NO-API MODE · QUICK LOG</div><h2 style={{marginBottom:6}}>LOG A FINISHED TFT GAME</h2><p className="muted" style={{margin:0,maxWidth:700}}>Placement + final comp is enough to save the game. The decision review is what turns a manual log into coaching evidence.</p></div>
      <span className="op-tier op-tier-free">~30 SEC</span>
    </div>

    <div style={{marginTop:18}}><label className="eyebrow">PLACEMENT</label><div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(38px,1fr))',gap:7,marginTop:8}}>{placements.map(p=><button type="button" key={p} onClick={()=>setPlacement(p)} className={`btn ${placement===p?'primary':'secondary'}`} style={{padding:'9px 4px'}}>#{p}</button>)}</div></div>

    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.6fr) minmax(120px,.4fr)',gap:12,marginTop:14}}>
      <label><span className="eyebrow">FINAL COMP / LINE</span><input value={comp} onChange={e=>setComp(e.target.value)} placeholder="e.g. 6 Bruiser · carry + frontline" maxLength={120}/></label>
      <label><span className="eyebrow">FINAL LEVEL</span><input type="number" min={1} max={10} value={level} onChange={e=>setLevel(e.target.value)} placeholder="8"/></label>
    </div>

    <button type="button" className="text-link" onClick={()=>setAdvanced(v=>!v)} style={{marginTop:14}}>{advanced?'HIDE BOARD EVIDENCE ↑':'ADD BOARD EVIDENCE ↓'}</button>
    {advanced&&<div style={{display:'grid',gap:12,marginTop:12}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
        <label><span className="eyebrow">GOLD LEFT</span><input type="number" min={0} max={200} value={gold} onChange={e=>setGold(e.target.value)} placeholder="4"/></label>
        <label><span className="eyebrow">LAST ROUND</span><input type="number" min={1} max={50} value={round} onChange={e=>setRound(e.target.value)} placeholder="32"/></label>
        <label><span className="eyebrow">PLAYER DAMAGE</span><input type="number" min={0} max={1000} value={damage} onChange={e=>setDamage(e.target.value)} placeholder="74"/></label>
        <label><span className="eyebrow">ELIMS</span><input type="number" min={0} max={7} value={elims} onChange={e=>setElims(e.target.value)} placeholder="2"/></label>
      </div>
      <label><span className="eyebrow">AUGMENTS</span><input value={augments} onChange={e=>setAugments(e.target.value)} placeholder="Augment 1, Augment 2, Augment 3"/></label>
      <label><span className="eyebrow">FINAL UNITS</span><input value={units} onChange={e=>setUnits(e.target.value)} placeholder="Unit, Unit, Unit…"/></label>
      <label><span className="eyebrow">GENERAL NOTE</span><textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} rows={2} placeholder="Anything else worth remembering…"/></label>
    </div>}

    <section style={{marginTop:18,paddingTop:18,borderTop:'1px solid rgba(255,255,255,.08)'}}>
      <button type="button" className="text-link" onClick={()=>setReviewOpen(v=>!v)}>{reviewOpen?'HIDE DECISION REVIEW ↑':'ADD DECISION REVIEW ↓'}</button>
      {reviewOpen&&<div style={{display:'grid',gap:12,marginTop:12}}>
        <div><div className="eyebrow">WHAT MOST DECIDED THIS GAME?</div><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:8}}>{reasons.map(r=><button type="button" key={r.value} className={`btn ${lossReason===r.value?'primary':'secondary'}`} style={{padding:'8px 10px'}} onClick={()=>setLossReason(lossReason===r.value?'':r.value)}>{r.label}</button>)}</div></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
          <label><span className="eyebrow">FIRST UNSTABLE STAGE</span><select value={firstUnstableStage} onChange={e=>setFirstUnstableStage(e.target.value)}><option value="">Unknown / stable</option>{['2','3','4','5','6'].map(x=><option value={x} key={x}>Stage {x}</option>)}</select></label>
          <label><span className="eyebrow">DECISIVE ROLL TOO LATE?</span><select value={rolledLate} onChange={e=>setRolledLate(e.target.value as 'yes'|'no'|'unknown')}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></label>
          <label><span className="eyebrow">FOLLOWED LOCKED PLAN?</span><select value={planFollowed} onChange={e=>setPlanFollowed(e.target.value as TftPlanFollowed)}><option value="unknown">No plan / unknown</option><option value="yes">Yes</option><option value="partly">Partly</option><option value="no">No</option></select></label>
        </div>
        <label><span className="eyebrow">KEY DECISION</span><textarea value={keyDecision} onChange={e=>setKeyDecision(e.target.value)} maxLength={300} rows={2} placeholder="e.g. Stayed on the contested line after 3-2 instead of pivoting…"/></label>
        <label><span className="eyebrow">WHAT WOULD YOU REPEAT / CHANGE?</span><textarea value={wouldRepeat} onChange={e=>setWouldRepeat(e.target.value)} maxLength={300} rows={2} placeholder="One sentence you want the coach to remember…"/></label>
        <p className="muted" style={{fontSize:11,margin:0}}>If you locked a Game Plan before queueing, OP CLIMB snapshots it into this match automatically so later reviews can compare intention with execution.</p>
      </div>}
    </section>

    {message&&<p style={{marginTop:12}}><b>{message}</b></p>}
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginTop:16,flexWrap:'wrap'}}><p className="muted" style={{fontSize:11,margin:0}}>Missing fields remain unknown. OP CLIMB only promotes a decision into your active leak after it repeats.</p><button className="btn primary" disabled={!valid}>{saving?'SAVING…':'SAVE GAME + UPDATE COACH'}</button></div>
  </form>;
}
