'use client';
import {useMemo,useState} from 'react';
import {track} from '@/lib/analytics';

type Props={riotAccountId:string;disabled?:boolean;onSaved:()=>Promise<void>|void};

const placements=[1,2,3,4,5,6,7,8];

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
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const valid=useMemo(()=>comp.trim().length>0&&!saving&&!disabled,[comp,saving,disabled]);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!valid)return;
    setSaving(true);setMessage('');
    try{
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
      };
      const res=await fetch('/api/tft/manual',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Could not save TFT game.');
      track('tft_manual_game_added',{placement,hasAdvanced:advanced,hasAugments:body.augments.length>0,hasUnits:body.units.length>0});
      setMessage('Game saved. Your TFT coaching model has been updated.');
      setComp('');setGold('');setRound('');setDamage('');setElims('');setAugments('');setUnits('');setNote('');
      await onSaved();
    }catch(err){setMessage(err instanceof Error?err.message:'Could not save TFT game.')}finally{setSaving(false)}
  };

  return <form className="glass card" onSubmit={submit} style={{marginTop:18}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><div className="eyebrow">NO-API MODE · QUICK LOG</div><h2 style={{marginBottom:6}}>LOG A FINISHED TFT GAME</h2><p className="muted" style={{margin:0,maxWidth:700}}>This feeds the exact same history and coaching engine as Riot-imported matches. Placement + final comp is enough; add more evidence when you have it.</p></div>
      <span className="op-tier op-tier-free">~20 SEC</span>
    </div>

    <div style={{marginTop:18}}><label className="eyebrow">PLACEMENT</label><div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(38px,1fr))',gap:7,marginTop:8}}>{placements.map(p=><button type="button" key={p} onClick={()=>setPlacement(p)} className={`btn ${placement===p?'primary':'secondary'}`} style={{padding:'9px 4px'}}>#{p}</button>)}</div></div>

    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.6fr) minmax(120px,.4fr)',gap:12,marginTop:14}}>
      <label><span className="eyebrow">FINAL COMP / LINE</span><input value={comp} onChange={e=>setComp(e.target.value)} placeholder="e.g. 6 Bruiser · carry + frontline" maxLength={120}/></label>
      <label><span className="eyebrow">FINAL LEVEL</span><input type="number" min={1} max={10} value={level} onChange={e=>setLevel(e.target.value)} placeholder="8"/></label>
    </div>

    <button type="button" className="text-link" onClick={()=>setAdvanced(v=>!v)} style={{marginTop:14}}>{advanced?'HIDE EXTRA EVIDENCE ↑':'ADD EXTRA EVIDENCE ↓'}</button>
    {advanced&&<div style={{display:'grid',gap:12,marginTop:12}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
        <label><span className="eyebrow">GOLD LEFT</span><input type="number" min={0} max={200} value={gold} onChange={e=>setGold(e.target.value)} placeholder="4"/></label>
        <label><span className="eyebrow">LAST ROUND</span><input type="number" min={1} max={50} value={round} onChange={e=>setRound(e.target.value)} placeholder="32"/></label>
        <label><span className="eyebrow">PLAYER DAMAGE</span><input type="number" min={0} max={1000} value={damage} onChange={e=>setDamage(e.target.value)} placeholder="74"/></label>
        <label><span className="eyebrow">ELIMS</span><input type="number" min={0} max={7} value={elims} onChange={e=>setElims(e.target.value)} placeholder="2"/></label>
      </div>
      <label><span className="eyebrow">AUGMENTS</span><input value={augments} onChange={e=>setAugments(e.target.value)} placeholder="Augment 1, Augment 2, Augment 3"/></label>
      <label><span className="eyebrow">FINAL UNITS</span><input value={units} onChange={e=>setUnits(e.target.value)} placeholder="Unit, Unit, Unit…"/></label>
      <label><span className="eyebrow">WHAT WENT WRONG / RIGHT?</span><textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} rows={3} placeholder="Rolled too late on 4-2; board was weak through stage 4…"/></label>
    </div>}

    {message&&<p style={{marginTop:12}}><b>{message}</b></p>}
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginTop:16,flexWrap:'wrap'}}><p className="muted" style={{fontSize:11,margin:0}}>You can backfill games later. Missing fields stay explicitly unknown rather than being guessed.</p><button className="btn primary" disabled={!valid}>{saving?'SAVING…':'SAVE GAME + UPDATE COACH'}</button></div>
  </form>;
}
