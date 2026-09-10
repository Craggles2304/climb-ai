'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import type {ConfidenceLevel,ConfidenceReport} from '@/lib/combat/confidence';
import type {ComboResult,ComboStep,AbilitySlot} from '@/lib/combat/combos';
import type {KillCheck} from '@/lib/combat/damage';
import type {TradeReport} from '@/lib/combat/trades';
import {TradePanel} from '@/components/TradePanel';

/**
 * Matchup Lab.
 *
 * Every number on this page comes from the combat engine. Nothing is written as
 * prose and dressed up as a calculation, and nothing is shown without the
 * confidence rating that belongs to it — a PARTIAL figure is labelled PARTIAL
 * next to the number, not in a footnote.
 */

interface AbilityView{
  slot:AbilitySlot;
  name:string;
  rank:number;
  maxRank:number;
  cooldownSeconds:number;
  cost:number;
  rangeUnits:number|null;
  damage:{label:string;raw:number|null;type:string}[];
  calculations:{name:string;value:number|null;unmodelled:string[];primary:boolean}[];
  confidence:ConfidenceReport;
  variantNote?:string;
}

interface SideView{
  id:string;name:string;level:number;damageType:string;
  stats:{
    attackDamage:number;abilityPower:number;armor:number;magicResist:number;
    health:number;healthNow:number;mana:number;manaNow:number;
    attackSpeed:number;attackRange:number;moveSpeed:number;
  };
  abilities:AbilityView[];
  confidence:ConfidenceReport;
}

interface Simulation{
  ok:boolean;error?:string;patch?:string;
  dataSources?:{name:string;use:string;official:boolean}[];
  you?:SideView;them?:SideView;
  combo?:ComboResult;kill?:KillCheck;trades?:TradeReport;
  confidence?:ConfidenceReport;
  notes?:string[];
}

interface SideForm{
  champion:string;
  level:number;
  bonusAttackDamage:number;
  bonusAbilityPower:number;
  bonusArmor:number;
  bonusMagicResist:number;
  bonusHealth:number;
  lethality:number;
  abilityHaste:number;
  healthPercent:number;
  resourcePercent:number;
}

const blankSide=(champion:string):SideForm=>({
  champion,level:6,
  bonusAttackDamage:0,bonusAbilityPower:0,bonusArmor:0,bonusMagicResist:0,
  bonusHealth:0,lethality:0,abilityHaste:0,
  healthPercent:100,resourcePercent:100,
});

const STEPS:ComboStep[]=['Q','W','E','R','AA'];

const CONFIDENCE_CLASS:Record<ConfidenceLevel,string>={
  HIGH:'conf-high',MEDIUM:'conf-medium',LOW:'conf-low',PARTIAL:'conf-partial',
};

export default function MatchupLab(){
  const [you,setYou]=useState<SideForm>(blankSide('Darius'));
  const [them,setThem]=useState<SideForm>(blankSide('Caitlyn'));
  const [sequence,setSequence]=useState<ComboStep[]>(['Q','AA','W','AA','E','R']);
  const [data,setData]=useState<Simulation|null>(null);
  const [loading,setLoading]=useState(false);
  const [names,setNames]=useState<string[]>([]);
  const [showMath,setShowMath]=useState(false);
  const request=useRef(0);

  // The champion list is only needed for the search boxes, so it comes from the
  // existing champion endpoint rather than being bundled.
  useEffect(()=>{
    fetch('/api/champions?champion=Darius')
      .then(r=>r.json())
      .then(d=>{if(Array.isArray(d?.names))setNames(d.names)})
      .catch(()=>{/* the inputs still work as free text */});
  },[]);

  const simulate=useCallback(()=>{
    const id=++request.current;
    setLoading(true);
    fetch('/api/matchup/simulate',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({you,them,sequence}),
    })
      .then(r=>r.json())
      // Out-of-order responses would otherwise overwrite a newer simulation.
      .then(d=>{if(id===request.current)setData(d)})
      .catch(()=>{if(id===request.current)setData({ok:false,error:'Could not reach the simulator.'})})
      .finally(()=>{if(id===request.current)setLoading(false)});
  },[you,them,sequence]);

  useEffect(()=>{
    const timer=setTimeout(simulate,400);
    return ()=>clearTimeout(timer);
  },[simulate]);

  const verdict=useMemo(()=>{
    if(!data?.ok||!data.kill||!data.combo)return null;
    if(data.kill.kills)return {label:'THIS COMBO KILLS',tone:'edge-you'};
    const share=data.combo.totalMitigatedDamage/Math.max(1,data.them?.stats.healthNow??1);
    if(share>=0.6)return {label:'CLOSE TO LETHAL',tone:'edge-even'};
    return {label:'NOT LETHAL',tone:'edge-them'};
  },[data]);

  return <AppShell>
    <PageHead
      title="Matchup Lab"
      subtitle="Ability damage, combos and mana, calculated from Riot's own game files."/>

    <div className="lab-grid">
      <SideEditor title="YOUR CHAMPION" form={you} onChange={setYou} names={names}/>
      <SideEditor title="ENEMY CHAMPION" form={them} onChange={setThem} names={names}/>
    </div>

    <div className="glass card" style={{marginTop:16}}>
      <div className="section-row">
        <div>
          <div className="eyebrow">COMBO</div>
          <h2 style={{margin:'6px 0 0'}}>{sequence.join(' → ')||'Nothing selected'}</h2>
        </div>
        <button className="btn secondary" style={{minHeight:38,fontSize:11}}
          onClick={()=>setSequence([])}>CLEAR</button>
      </div>
      <div className="tag-row" style={{marginTop:14}}>
        {STEPS.map(step=>
          <button key={step} type="button" className="tag-chip"
            onClick={()=>setSequence(s=>s.length<24?[...s,step]:s)}>+ {step}</button>)}
        {sequence.length>0&&
          <button type="button" className="tag-chip clear"
            onClick={()=>setSequence(s=>s.slice(0,-1))}>Undo</button>}
      </div>
    </div>

    {loading&&!data?.ok&&
      <div className="glass card" style={{marginTop:16}}><p className="muted">Simulating…</p></div>}

    {data&&!data.ok&&!loading&&
      <div className="glass card" style={{marginTop:16}}>
        <h2>Could not simulate that.</h2>
        <p className="muted">{data.error}</p>
        {/*
          A transient failure — the server still compiling on a cold start, a
          dropped connection — otherwise left this page stuck on an error with
          no way out, because nothing re-fires until an input changes.
        */}
        <button className="btn secondary" style={{marginTop:12}} onClick={simulate}>
          TRY AGAIN
        </button>
      </div>}

    {data?.ok&&data.you&&data.them&&data.combo&&data.kill&&data.confidence&&<>
      <div className="glass card lab-verdict" style={{marginTop:16}}>
        <div>
          <div className="eyebrow">
            {data.you.name.toUpperCase()} VS {data.them.name.toUpperCase()} · LEVEL {data.you.level}
          </div>
          <h2>{verdict?.label}</h2>
          <p className="muted">{data.kill.note}</p>
        </div>
        <div className={`lab-damage ${verdict?.tone??''}`}>
          <strong>{data.combo.totalMitigatedDamage}</strong>
          <span>DAMAGE AFTER RESISTANCES</span>
          <small>{data.combo.totalRawDamage} before</small>
        </div>
      </div>

      <ConfidenceBanner report={data.confidence} floorNote={!data.combo.damageComplete}/>

      <div className="glass card" style={{marginTop:16}}>
        <div className="eyebrow">EVENT TIMELINE</div>
        <div style={{overflowX:'auto',marginTop:14}}>
          <table className="table">
            <thead><tr>
              <th>At</th><th>Step</th><th>Status</th>
              <th>Damage</th><th>Target HP</th><th>Mana</th>
            </tr></thead>
            <tbody>{data.combo.events.map(e=>
              <tr key={`${e.index}-${e.step}`} className={e.status==='CAST'?'':'row-blocked'}>
                <td>{e.atSeconds}s</td>
                <td>{e.step} · {e.label}</td>
                <td>{e.status==='CAST'?'cast':statusLabel(e.status)}</td>
                <td>{e.mitigatedDamage>0?e.mitigatedDamage:'—'}</td>
                <td>{e.targetHealthRemaining}</td>
                <td>{e.manaRemaining}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="build-summary">
          <span>At least <b>{data.combo.minimumDurationSeconds}s</b></span>
          <span>{data.combo.completable?'Every step is possible':'Some steps cannot happen'}</span>
        </div>
        <p className="muted" style={{marginTop:10,fontSize:12}}>{data.combo.resourceNote}</p>
        {data.combo.blocked.length>0&&
          <ul className="riot-tips">{data.combo.blocked.map(b=>
            <li key={b.step+b.reason}>{b.reason}</li>)}</ul>}
        <p className="muted" style={{marginTop:10,fontSize:12}}>{data.combo.timingNote}</p>
      </div>

      {data.trades&&
        <TradePanel report={data.trades} you={data.you.name} them={data.them.name}/>}

      <div className="lab-grid" style={{marginTop:16}}>
        <AbilityPanel side={data.you} label="YOUR ABILITIES" showMath={showMath}/>
        <AbilityPanel side={data.them} label="THEIR ABILITIES" showMath={showMath}/>
      </div>

      <div className="glass card" style={{marginTop:16}}>
        <div className="section-row">
          <div className="eyebrow">PROVENANCE</div>
          <button className="btn secondary" style={{minHeight:34,fontSize:11}}
            onClick={()=>setShowMath(v=>!v)}>{showMath?'HIDE MATH':'SHOW MATH'}</button>
        </div>
        <div className="league-row"><span>Patch</span><b>{data.patch}</b></div>
        {(data.dataSources??[]).map(s=>
          <div className="league-row" key={s.name}>
            <span>{s.name}{s.official?'':' (unofficial mirror)'}</span><b>{s.use}</b>
          </div>)}
        {(data.notes??[]).map(note=>
          <p className="muted" key={note} style={{marginTop:10,fontSize:12}}>{note}</p>)}
      </div>
    </>}
  </AppShell>;
}

/* ----------------------------------------------------------- components -- */

function SideEditor({title,form,onChange,names}:{
  title:string;form:SideForm;onChange:(f:SideForm)=>void;names:string[];
}){
  const set=<K extends keyof SideForm>(key:K,value:SideForm[K])=>
    onChange({...form,[key]:value});
  const listId=`champions-${title.replace(/\s+/g,'-').toLowerCase()}`;

  return <div className="glass card">
    <div className="eyebrow">{title}</div>
    <div className="field" style={{marginTop:12}}>
      <label>Champion</label>
      <input className="input" list={listId} value={form.champion}
        onChange={e=>set('champion',e.target.value)}/>
      <datalist id={listId}>{names.map(n=><option key={n} value={n}/>)}</datalist>
    </div>
    <div className="lab-inputs">
      <Num label="Level" value={form.level} min={1} max={18}
        onChange={v=>set('level',v)}/>
      <Num label="Bonus AD" value={form.bonusAttackDamage} min={0} max={1000}
        onChange={v=>set('bonusAttackDamage',v)}/>
      <Num label="Bonus AP" value={form.bonusAbilityPower} min={0} max={2000}
        onChange={v=>set('bonusAbilityPower',v)}/>
      <Num label="Bonus armour" value={form.bonusArmor} min={0} max={1000}
        onChange={v=>set('bonusArmor',v)}/>
      <Num label="Bonus MR" value={form.bonusMagicResist} min={0} max={1000}
        onChange={v=>set('bonusMagicResist',v)}/>
      <Num label="Bonus HP" value={form.bonusHealth} min={0} max={5000}
        onChange={v=>set('bonusHealth',v)}/>
      <Num label="Lethality" value={form.lethality} min={0} max={100}
        onChange={v=>set('lethality',v)}/>
      <Num label="Ability haste" value={form.abilityHaste} min={0} max={500}
        onChange={v=>set('abilityHaste',v)}/>
      <Num label="HP %" value={form.healthPercent} min={1} max={100}
        onChange={v=>set('healthPercent',v)}/>
      <Num label="Mana %" value={form.resourcePercent} min={0} max={100}
        onChange={v=>set('resourcePercent',v)}/>
    </div>
  </div>;
}

function Num({label,value,min,max,onChange}:{
  label:string;value:number;min:number;max:number;onChange:(v:number)=>void;
}){
  return <label className="lab-input">
    <span>{label}</span>
    <input className="input" type="number" value={value} min={min} max={max}
      onChange={e=>{
        const next=Number(e.target.value);
        onChange(Number.isFinite(next)?Math.min(max,Math.max(min,next)):min);
      }}/>
  </label>;
}

function ConfidenceBanner({report,floorNote}:{report:ConfidenceReport;floorNote:boolean}){
  return <div className={`glass card lab-confidence ${CONFIDENCE_CLASS[report.level]}`}
    style={{marginTop:16}}>
    <div className="section-row">
      <div className="eyebrow">SIMULATION CONFIDENCE</div>
      <span className={`conf-tag ${CONFIDENCE_CLASS[report.level]}`}>{report.level}</span>
    </div>
    <p style={{margin:'10px 0 0',fontSize:13,lineHeight:1.5}}>{report.summary}</p>
    {floorNote&&
      <p className="lab-floor">
        A damage component could not be calculated, so the totals above are a
        lower bound rather than the full amount.
      </p>}
    {report.causes.length>0&&
      <ul className="riot-tips">{report.causes.map(c=>
        <li key={c.reason}>{c.reason}</li>)}</ul>}
  </div>;
}

function AbilityPanel({side,label,showMath}:{
  side:SideView;label:string;showMath:boolean;
}){
  return <div className="glass card">
    <div className="section-row">
      <div>
        <div className="eyebrow">{label}</div>
        <h2 style={{margin:'6px 0 0'}}>{side.name}</h2>
      </div>
      <span className={`conf-tag ${CONFIDENCE_CLASS[side.confidence.level]}`}>
        {side.confidence.level}
      </span>
    </div>

    <div className="pct-grid" style={{marginTop:14}}>
      <div><span>AD</span><strong>{side.stats.attackDamage}</strong></div>
      <div><span>AP</span><strong>{side.stats.abilityPower}</strong></div>
      <div><span>ARMOUR</span><strong>{side.stats.armor}</strong></div>
      <div><span>MR</span><strong>{side.stats.magicResist}</strong></div>
    </div>
    <div className="build-summary">
      <span>HP <b>{side.stats.healthNow}</b> of {side.stats.health}</span>
      <span>Mana <b>{side.stats.manaNow}</b> of {side.stats.mana}</span>
    </div>

    <div className="spike-list" style={{marginTop:14}}>
      {side.abilities.map(a=>
        <div className="spike" key={a.slot}>
          <div className="spike-level">{a.slot}</div>
          <div>
            <b>{a.name} <span className="muted">rank {a.rank}/{a.maxRank}</span></b>
            <p className="spike-fact">
              {a.damage[0]?.raw!==null&&a.damage[0]?.raw!==undefined
                ?`${a.damage[0].raw} ${a.damage[0].type.toLowerCase()} damage`
                :'No damage figure'}
              {' · '}{a.cooldownSeconds}s{' · '}{a.cost>0?`${a.cost} mana`:'no cost'}
              {a.rangeUnits?` · ${a.rangeUnits} range`:''}
            </p>
            {a.confidence.level!=='HIGH'&&
              <p className={`conf-inline ${CONFIDENCE_CLASS[a.confidence.level]}`}>
                {a.confidence.level}: {a.confidence.causes[0]?.reason}
              </p>}
            {a.variantNote&&<p className="muted" style={{fontSize:11}}>{a.variantNote}</p>}
            {showMath&&a.calculations.length>0&&
              <table className="table skill-grid" style={{marginTop:8}}>
                <tbody>{a.calculations.map(c=>
                  <tr key={c.name}>
                    <td style={{textAlign:'left'}}>{c.primary?'▸ ':''}{c.name}</td>
                    <td>{c.value??'—'}</td>
                    <td style={{textAlign:'left',color:'var(--muted)',fontSize:10}}>
                      {c.unmodelled[0]??''}
                    </td>
                  </tr>)}
                </tbody>
              </table>}
          </div>
        </div>)}
    </div>
  </div>;
}

const statusLabel=(status:string)=>
  status==='NO_RESOURCE'?'no mana'
    :status==='ON_COOLDOWN'?'on cooldown'
      :status==='NOT_LEARNED'?'no rank'
        :status.toLowerCase();
