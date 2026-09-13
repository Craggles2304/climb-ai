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
  const [weakStage,setWeakStage]=useState('NEVER');
  const [rollTiming,setRollTiming]=useState('UNKNOWN');
  const [economyChoice,setEconomyChoice]=useState('UNKNOWN');
  const [pivotQuality,setPivotQuality]=useState('UNKNOWN');
  const [itemChoice,setItemChoice]=useState('UNKNOWN');
  const [positioningResult,setPositioningResult]=useState('UNKNOWN');
  const [planFollowed,setPlanFollowed]=useState('UNKNOWN');
  const [contested,setContested]=useState('UNKNOWN');
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const valid=useMemo(()=>comp.trim().length>0&&!saving&&!disabled,[comp,saving,disabled]);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();if(!valid)return;setSaving(true);setMessage('');
    try{
      const body={
        riotAccountId,placement,compSignature:comp.trim(),
        level:level?Number(level):undefined,goldLeft:gold?Number(gold):undefined,lastRound:round?Number(round):undefined,
        totalDamageToPlayers:damage?Number(damage):undefined,playersEliminated:elims?Number(elims):undefined,
        augments:augments.split(',').map(x=>x.trim()).filter(Boolean).slice(0,3),
        units:units.split(',').map(x=>x.trim()).filter(Boolean).slice(0,12).map(name=>({name,itemNames:[]})),
        note:note.trim()||undefined,
        review:advanced?{weakStage,rollTiming,economyChoice,pivotQuality,itemChoice,positioningResult,planFollowed,contested}:undefined,
      };
      const res=await fetch('/api/tft/manual',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not save TFT game.');
      track('tft_manual_game_added',{placement,hasAdvanced:advanced,hasAugments:body.augments.length>0,hasUnits:body.units.length>0});
      setMessage(advanced?'Game + decision review saved. Your Tactician Profile and ILP have been recalculated.':'Game saved. Add Decision Review next time for deeper coaching.');
      setComp('');setGold('');setRound('');setDamage('');setElims('');setAugments('');setUnits('');setNote('');
      await onSaved();
    }catch(err){setMessage(err instanceof Error?err.message:'Could not save TFT game.')}finally{setSaving(false)}
  };

  return <form className="glass card" onSubmit={submit} style={{marginTop:18}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><div className="eyebrow">NO-API MODE · EVIDENCE LOG</div><h2 style={{marginBottom:6}}>LOG + REVIEW A FINISHED TFT GAME</h2><p className="muted" style={{margin:0,maxWidth:760}}>Placement gives outcome data. Decision Review tells OP CLIMB why it happened, so Economy, Tempo, Flexibility, Positioning and Conversion can be scored separately.</p></div>
      <span className="op-tier op-tier-plus">TACTICIAN DATA</span>
    </div>

    <div style={{marginTop:18}}><label className="eyebrow">PLACEMENT</label><div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(38px,1fr))',gap:7,marginTop:8}}>{placements.map(p=><button type="button" key={p} onClick={()=>setPlacement(p)} className={`btn ${placement===p?'primary':'secondary'}`} style={{padding:'9px 4px'}}>#{p}</button>)}</div></div>

    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.6fr) minmax(120px,.4fr)',gap:12,marginTop:14}}>
      <label><span className="eyebrow">FINAL COMP / LINE</span><input value={comp} onChange={e=>setComp(e.target.value)} placeholder="e.g. 6 Bruiser · carry + frontline" maxLength={120}/></label>
      <label><span className="eyebrow">FINAL LEVEL</span><input type="number" min={1} max={10} value={level} onChange={e=>setLevel(e.target.value)} placeholder="8"/></label>
    </div>

    <button type="button" className="text-link" onClick={()=>setAdvanced(v=>!v)} style={{marginTop:14}}>{advanced?'HIDE DECISION REVIEW ↑':'OPEN ADVANCED DECISION REVIEW ↓'}</button>
    {advanced&&<div style={{display:'grid',gap:16,marginTop:14}}>
      <div className="glass" style={{padding:14,border:'1px solid rgba(255,255,255,.08)'}}>
        <div className="eyebrow">DECISION REVIEW · THIS IS THE IMPORTANT PART</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10,marginTop:10}}>
          <label><span className="eyebrow">WHEN DID BOARD FEEL WEAK?</span><select value={weakStage} onChange={e=>setWeakStage(e.target.value)}><option value="NEVER">Never / stayed stable</option><option value="STAGE_2">Stage 2</option><option value="STAGE_3">Stage 3</option><option value="STAGE_4">Stage 4</option><option value="STAGE_5_PLUS">Stage 5+</option></select></label>
          <label><span className="eyebrow">ROLL TIMING</span><select value={rollTiming} onChange={e=>setRollTiming(e.target.value)}><option value="UNKNOWN">Not sure</option><option value="EARLY">Too early</option><option value="ON_TIME">On time</option><option value="LATE">Too late</option><option value="DID_NOT_ROLL">Did not roll</option></select></label>
          <label><span className="eyebrow">ECONOMY DECISION</span><select value={economyChoice} onChange={e=>setEconomyChoice(e.target.value)}><option value="UNKNOWN">Not sure</option><option value="SPENT_TO_STABILISE">Spent to stabilise</option><option value="HELD_FOR_ECON">Held for econ</option><option value="FAST_LEVEL">Fast leveled</option><option value="PANIC_ROLL">Panic rolled</option></select></label>
          <label><span className="eyebrow">CONTEST PRESSURE</span><select value={contested} onChange={e=>setContested(e.target.value)}><option value="UNKNOWN">Not sure</option><option value="NONE">Uncontested</option><option value="LIGHT">1 player / light</option><option value="HEAVY">2+ players / heavy</option></select></label>
          <label><span className="eyebrow">PIVOT QUALITY</span><select value={pivotQuality} onChange={e=>setPivotQuality(e.target.value)}><option value="UNKNOWN">Not sure</option><option value="FLEXED_EARLY">Flexed early</option><option value="FLEXED_LATE">Flexed late</option><option value="FORCED_CONTESTED">Forced contested line</option><option value="STAYED_UNCONTESTED">Correctly stayed uncontested</option></select></label>
          <label><span className="eyebrow">ITEM TEMPO</span><select value={itemChoice} onChange={e=>setItemChoice(e.target.value)}><option value="UNKNOWN">Not sure</option><option value="SLAMMED_TEMPO">Slammed useful tempo</option><option value="BALANCED">Balanced</option><option value="GREEDY_COMPONENTS">Greeded components/BIS</option></select></label>
          <label><span className="eyebrow">POSITIONING IMPACT</span><select value={positioningResult} onChange={e=>setPositioningResult(e.target.value)}><option value="UNKNOWN">Not sure</option><option value="WON_FIGHTS">Won key fights</option><option value="NEUTRAL">Mostly neutral</option><option value="LOST_FIGHTS">Lost key fights</option></select></label>
          <label><span className="eyebrow">FOLLOWED YOUR PLAN?</span><select value={planFollowed} onChange={e=>setPlanFollowed(e.target.value)}><option value="UNKNOWN">No plan / not sure</option><option value="YES">Yes</option><option value="PARTIAL">Partly</option><option value="NO">No</option></select></label>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
        <label><span className="eyebrow">GOLD LEFT</span><input type="number" min={0} max={200} value={gold} onChange={e=>setGold(e.target.value)} placeholder="4"/></label>
        <label><span className="eyebrow">LAST ROUND</span><input type="number" min={1} max={50} value={round} onChange={e=>setRound(e.target.value)} placeholder="32"/></label>
        <label><span className="eyebrow">PLAYER DAMAGE</span><input type="number" min={0} max={1000} value={damage} onChange={e=>setDamage(e.target.value)} placeholder="74"/></label>
        <label><span className="eyebrow">ELIMS</span><input type="number" min={0} max={7} value={elims} onChange={e=>setElims(e.target.value)} placeholder="2"/></label>
      </div>
      <label><span className="eyebrow">AUGMENTS</span><input value={augments} onChange={e=>setAugments(e.target.value)} placeholder="Augment 1, Augment 2, Augment 3"/></label>
      <label><span className="eyebrow">FINAL UNITS</span><input value={units} onChange={e=>setUnits(e.target.value)} placeholder="Unit, Unit, Unit…"/></label>
      <label><span className="eyebrow">COACH NOTE</span><textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} rows={3} placeholder="What was the decisive mistake or best decision?"/></label>
    </div>}

    {message&&<p style={{marginTop:12}}><b>{message}</b></p>}
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginTop:16,flexWrap:'wrap'}}><p className="muted" style={{fontSize:11,margin:0}}>Unknown fields stay unknown. OP CLIMB does not invent positioning, economy or pivot evidence from placement alone.</p><button className="btn primary" disabled={!valid}>{saving?'SAVING…':'SAVE GAME + RECALCULATE PROFILE'}</button></div>
  </form>;
}
