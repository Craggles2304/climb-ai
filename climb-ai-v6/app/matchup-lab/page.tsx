'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import type {ConfidenceLevel,ConfidenceReport} from '@/lib/combat/confidence';
import type {ComboResult,ComboStep,AbilitySlot} from '@/lib/combat/combos';
import type {KillCheck} from '@/lib/combat/damage';
import type {TradeReport} from '@/lib/combat/trades';
import {TradePanel} from '@/components/TradePanel';

interface AbilityView{
  slot:AbilitySlot;name:string;rank:number;maxRank:number;
  cooldownSeconds:number;cost:number;rangeUnits:number|null;
  damage:{label:string;raw:number|null;type:string}[];
  calculations:{name:string;value:number|null;unmodelled:string[];primary:boolean}[];
  confidence:ConfidenceReport;variantNote?:string;
}

interface ItemView{
  id:number;name:string;gold:number;image:string|null;tags:string[];
}

interface SideView{
  id:string;name:string;level:number;damageType:string;
  items:ItemView[];totalGold:number;
  stats:{attackDamage:number;abilityPower:number;armor:number;magicResist:number;health:number;healthNow:number;mana:number;manaNow:number;attackSpeed:number;attackRange:number;moveSpeed:number};
  abilities:AbilityView[];confidence:ConfidenceReport;
}

interface Simulation{
  ok:boolean;error?:string;patch?:string;
  dataSources?:{name:string;use:string;official:boolean}[];
  you?:SideView;them?:SideView;combo?:ComboResult;kill?:KillCheck;trades?:TradeReport;
  confidence?:ConfidenceReport;notes?:string[];
}

interface CatalogueItem{
  id:number;name:string;gold:number;image:string|null;kind:string;
  tags:string[];
  stats:{attackDamage:number;abilityPower:number;attackSpeedPercent:number;critPercent:number;health:number;armor:number;magicResist:number;mana:number;abilityHaste:number;lethality:number;moveSpeed:number};
}

interface SideForm{
  champion:string;level:number;itemIds:number[];healthPercent:number;resourcePercent:number;
}

const blankSide=(champion:string):SideForm=>({champion,level:6,itemIds:[],healthPercent:100,resourcePercent:100});
const STEPS:ComboStep[]=['Q','W','E','R','AA'];
const CONFIDENCE_CLASS:Record<ConfidenceLevel,string>={HIGH:'conf-high',MEDIUM:'conf-medium',LOW:'conf-low',PARTIAL:'conf-partial'};

export default function MatchupLab(){
  const [you,setYou]=useState<SideForm>(blankSide('Kog\'Maw'));
  const [them,setThem]=useState<SideForm>(blankSide('Caitlyn'));
  const [sequence,setSequence]=useState<ComboStep[]>(['Q','AA','W','AA','E','R']);
  const [data,setData]=useState<Simulation|null>(null);
  const [loading,setLoading]=useState(false);
  const [names,setNames]=useState<string[]>([]);
  const [items,setItems]=useState<CatalogueItem[]>([]);
  const [itemPatch,setItemPatch]=useState<string>('');
  const [showMath,setShowMath]=useState(false);
  const request=useRef(0);

  useEffect(()=>{
    fetch('/api/champions?champion=Darius').then(r=>r.json()).then(d=>{if(Array.isArray(d?.names))setNames(d.names)}).catch(()=>{});
    fetch('/api/matchup/items').then(r=>r.json()).then(d=>{
      if(Array.isArray(d?.items))setItems(d.items);
      if(typeof d?.patch==='string')setItemPatch(d.patch);
    }).catch(()=>{});
  },[]);

  const simulate=useCallback(()=>{
    const id=++request.current;
    setLoading(true);
    fetch('/api/matchup/simulate',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({you,them,sequence}),
    }).then(r=>r.json()).then(d=>{if(id===request.current)setData(d)})
      .catch(()=>{if(id===request.current)setData({ok:false,error:'Could not reach the simulator.'})})
      .finally(()=>{if(id===request.current)setLoading(false)});
  },[you,them,sequence]);

  useEffect(()=>{const timer=setTimeout(simulate,350);return()=>clearTimeout(timer)},[simulate]);

  const verdict=useMemo(()=>{
    if(!data?.ok||!data.kill||!data.combo)return null;
    if(data.kill.kills)return {label:'THIS COMBO KILLS',tone:'edge-you'};
    const share=data.combo.totalMitigatedDamage/Math.max(1,data.them?.stats.healthNow??1);
    if(share>=0.6)return {label:'CLOSE TO LETHAL',tone:'edge-even'};
    return {label:'NOT LETHAL',tone:'edge-them'};
  },[data]);

  return <AppShell>
    <PageHead title="Matchup Lab" subtitle="Build the actual lane state. Pick champions, levels and items — CLIMB derives the combat stats for you."/>

    <div className="glass card" style={{marginBottom:16,padding:16}}>
      <div className="section-row" style={{gap:12,flexWrap:'wrap'}}>
        <div>
          <div className="eyebrow">HOW TO USE IT</div>
          <b style={{fontSize:15}}>Champion → level → items → HP/mana → combo.</b>
          <p className="muted" style={{margin:'5px 0 0',fontSize:12}}>No manual AD/AP/armour entry. Those values are calculated from the selected build.</p>
        </div>
        <div className="tag-chip">DATA PATCH {itemPatch||data?.patch||'…'}</div>
      </div>
    </div>

    <div className="lab-grid">
      <SideEditor title="YOUR CHAMPION" side="you" form={you} onChange={setYou} names={names} items={items} patch={itemPatch}/>
      <SideEditor title="ENEMY CHAMPION" side="them" form={them} onChange={setThem} names={names} items={items} patch={itemPatch}/>
    </div>

    <div className="glass card" style={{marginTop:16}}>
      <div className="section-row">
        <div><div className="eyebrow">YOUR COMBO</div><h2 style={{margin:'6px 0 0'}}>{sequence.join(' → ')||'Nothing selected'}</h2></div>
        <button className="btn secondary" style={{minHeight:38,fontSize:11}} onClick={()=>setSequence([])}>CLEAR</button>
      </div>
      <div className="tag-row" style={{marginTop:14}}>
        {STEPS.map(step=><button key={step} type="button" className="tag-chip" onClick={()=>setSequence(s=>s.length<24?[...s,step]:s)}>+ {step}</button>)}
        {sequence.length>0&&<button type="button" className="tag-chip clear" onClick={()=>setSequence(s=>s.slice(0,-1))}>Undo</button>}
      </div>
    </div>

    {loading&&!data?.ok&&<div className="glass card" style={{marginTop:16}}><p className="muted">Recalculating from your build…</p></div>}
    {data&&!data.ok&&!loading&&<div className="glass card" style={{marginTop:16}}><h2>Could not simulate that.</h2><p className="muted">{data.error}</p><button className="btn secondary" style={{marginTop:12}} onClick={simulate}>TRY AGAIN</button></div>}

    {data?.ok&&data.you&&data.them&&data.combo&&data.kill&&data.confidence&&<>
      <div className="glass card lab-verdict" style={{marginTop:16}}>
        <div>
          <div className="eyebrow">{data.you.name.toUpperCase()} VS {data.them.name.toUpperCase()} · LEVEL {data.you.level}</div>
          <h2>{verdict?.label}</h2>
          <p className="muted">{data.kill.note}</p>
          <div className="tag-row" style={{marginTop:10}}>
            <span className="tag-chip">YOUR BUILD {data.you.totalGold.toLocaleString()}g</span>
            <span className="tag-chip">THEIR BUILD {data.them.totalGold.toLocaleString()}g</span>
          </div>
        </div>
        <div className={`lab-damage ${verdict?.tone??''}`}><strong>{data.combo.totalMitigatedDamage}</strong><span>DAMAGE AFTER RESISTANCES</span><small>{data.combo.totalRawDamage} raw</small></div>
      </div>

      <ConfidenceBanner report={data.confidence} floorNote={!data.combo.damageComplete}/>

      <div className="lab-grid" style={{marginTop:16}}>
        <DerivedStats side={data.you} label="YOUR DERIVED STATS" patch={data.patch||itemPatch}/>
        <DerivedStats side={data.them} label="THEIR DERIVED STATS" patch={data.patch||itemPatch}/>
      </div>

      {data.trades&&<TradePanel report={data.trades} you={data.you.name} them={data.them.name}/>} 

      <div className="glass card" style={{marginTop:16}}>
        <div className="eyebrow">COMBAT TIMELINE</div>
        <div style={{overflowX:'auto',marginTop:14}}><table className="table">
          <thead><tr><th>At</th><th>Step</th><th>Status</th><th>Damage</th><th>Target HP</th><th>Mana</th></tr></thead>
          <tbody>{data.combo.events.map(e=><tr key={`${e.index}-${e.step}`} className={e.status==='CAST'?'':'row-blocked'}><td>{e.atSeconds}s</td><td>{e.step} · {e.label}</td><td>{e.status==='CAST'?'cast':statusLabel(e.status)}</td><td>{e.mitigatedDamage>0?e.mitigatedDamage:'—'}</td><td>{e.targetHealthRemaining}</td><td>{e.manaRemaining}</td></tr>)}</tbody>
        </table></div>
        <div className="build-summary"><span>At least <b>{data.combo.minimumDurationSeconds}s</b></span><span>{data.combo.completable?'Every step is possible':'Some steps cannot happen'}</span></div>
        <p className="muted" style={{marginTop:10,fontSize:12}}>{data.combo.resourceNote}</p>
      </div>

      <div className="lab-grid" style={{marginTop:16}}>
        <AbilityPanel side={data.you} label="YOUR ABILITIES" showMath={showMath}/>
        <AbilityPanel side={data.them} label="THEIR ABILITIES" showMath={showMath}/>
      </div>

      <div className="glass card" style={{marginTop:16}}>
        <div className="section-row"><div className="eyebrow">AUDIT TRAIL</div><button className="btn secondary" style={{minHeight:34,fontSize:11}} onClick={()=>setShowMath(v=>!v)}>{showMath?'HIDE MATH':'SHOW MATH'}</button></div>
        <div className="league-row"><span>Patch</span><b>{data.patch}</b></div>
        {(data.dataSources??[]).map(s=><div className="league-row" key={s.name}><span>{s.name}{s.official?'':' (unofficial mirror)'}</span><b>{s.use}</b></div>)}
        {(data.notes??[]).map(note=><p className="muted" key={note} style={{marginTop:10,fontSize:12}}>{note}</p>)}
      </div>
    </>}
  </AppShell>;
}

function SideEditor({title,side,form,onChange,names,items,patch}:{title:string;side:string;form:SideForm;onChange:(f:SideForm)=>void;names:string[];items:CatalogueItem[];patch:string}){
  const set=<K extends keyof SideForm>(key:K,value:SideForm[K])=>onChange({...form,[key]:value});
  const listId=`champions-${side}`;
  return <div className="glass card">
    <div className="eyebrow">{title}</div>
    <div className="field" style={{marginTop:12}}><label>Champion</label><input className="input" list={listId} value={form.champion} onChange={e=>set('champion',e.target.value)}/><datalist id={listId}>{names.map(n=><option key={n} value={n}/>)}</datalist></div>
    <div style={{display:'grid',gridTemplateColumns:'minmax(120px,160px) 1fr',gap:12,marginTop:12}}>
      <Num label="Level" value={form.level} min={1} max={18} onChange={v=>set('level',v)}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Num label="HP %" value={form.healthPercent} min={1} max={100} onChange={v=>set('healthPercent',v)}/>
        <Num label="Mana / resource %" value={form.resourcePercent} min={0} max={100} onChange={v=>set('resourcePercent',v)}/>
      </div>
    </div>
    <ItemPicker selected={form.itemIds} onChange={ids=>set('itemIds',ids)} items={items} patch={patch}/>
  </div>;
}

function ItemPicker({selected,onChange,items,patch}:{selected:number[];onChange:(ids:number[])=>void;items:CatalogueItem[];patch:string}){
  const [query,setQuery]=useState('');
  const choices=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return [];
    return items.filter(i=>i.name.toLowerCase().includes(q)).slice(0,10);
  },[items,query]);
  const byId=useMemo(()=>new Map(items.map(i=>[i.id,i])),[items]);
  const add=(id:number)=>{if(selected.length>=6)return;onChange([...selected,id]);setQuery('')};
  const remove=(index:number)=>onChange(selected.filter((_,i)=>i!==index));
  const imageUrl=(item:CatalogueItem)=>item.image&&patch?`https://ddragon.leagueoflegends.com/cdn/${patch}/img/item/${item.image}`:null;

  return <div style={{marginTop:16}}>
    <div className="section-row"><div><div className="eyebrow">ITEM BUILD</div><p className="muted" style={{fontSize:11,margin:'4px 0 0'}}>Add components, boots or completed items. Stats recalculate automatically.</p></div><span className="tag-chip">{selected.length}/6</span></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(0,1fr))',gap:8,marginTop:10}}>
      {Array.from({length:6}).map((_,index)=>{
        const item=byId.get(selected[index]);
        return <button key={index} type="button" onClick={()=>item&&remove(index)} title={item?`Remove ${item.name}`:'Empty item slot'} style={{minHeight:70,border:'1px solid var(--line)',borderRadius:12,background:'rgba(255,255,255,.025)',padding:7,color:'inherit',cursor:item?'pointer':'default',overflow:'hidden'}}>
          {item?<>{imageUrl(item)?<img src={imageUrl(item)!} alt="" width={38} height={38} style={{borderRadius:8,display:'block',margin:'0 auto 4px'}}/>:<div style={{fontSize:24}}>◆</div>}<div style={{fontSize:9,lineHeight:1.15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.name}</div></>:<span className="muted" style={{fontSize:22}}>+</span>}
        </button>;
      })}
    </div>
    <div style={{position:'relative',marginTop:10}}>
      <input className="input" value={query} placeholder={selected.length>=6?'Build full — remove an item to change it':'Search item… e.g. Recurve Bow, B.F. Sword, Berserker\'s Greaves'} disabled={selected.length>=6} onChange={e=>setQuery(e.target.value)}/>
      {choices.length>0&&<div style={{position:'absolute',zIndex:20,top:'calc(100% + 6px)',left:0,right:0,maxHeight:330,overflowY:'auto',border:'1px solid var(--line)',borderRadius:12,background:'#11151c',boxShadow:'0 18px 50px rgba(0,0,0,.45)'}}>
        {choices.map(item=><button type="button" key={item.id} onClick={()=>add(item.id)} style={{display:'grid',gridTemplateColumns:'42px 1fr auto',gap:10,alignItems:'center',width:'100%',padding:'9px 11px',border:0,borderBottom:'1px solid var(--line)',background:'transparent',color:'inherit',textAlign:'left',cursor:'pointer'}}>
          {imageUrl(item)?<img src={imageUrl(item)!} alt="" width={40} height={40} style={{borderRadius:8}}/>:<div/>}
          <div><b style={{fontSize:12}}>{item.name}</b><div className="muted" style={{fontSize:10,marginTop:3}}>{statLine(item)} · {item.kind}</div></div>
          <b style={{fontSize:11}}>{item.gold}g</b>
        </button>)}
      </div>}
    </div>
  </div>;
}

function statLine(item:CatalogueItem){
  const s=item.stats;const out:string[]=[];
  if(s.attackDamage)out.push(`+${s.attackDamage} AD`);if(s.abilityPower)out.push(`+${s.abilityPower} AP`);if(s.attackSpeedPercent)out.push(`+${s.attackSpeedPercent}% AS`);if(s.critPercent)out.push(`+${s.critPercent}% crit`);if(s.health)out.push(`+${s.health} HP`);if(s.armor)out.push(`+${s.armor} armour`);if(s.magicResist)out.push(`+${s.magicResist} MR`);if(s.mana)out.push(`+${s.mana} mana`);if(s.abilityHaste)out.push(`+${s.abilityHaste} haste`);if(s.lethality)out.push(`+${s.lethality} lethality`);if(s.moveSpeed)out.push(`+${s.moveSpeed} MS`);
  return out.slice(0,4).join(' · ')||'Combat passive / utility item';
}

function DerivedStats({side,label,patch}:{side:SideView;label:string;patch:string}){
  return <div className="glass card"><div className="section-row"><div><div className="eyebrow">{label}</div><h2 style={{margin:'5px 0 0'}}>{side.name}</h2></div><b>{side.totalGold.toLocaleString()}g</b></div>
    <div className="pct-grid" style={{marginTop:14}}><div><span>AD</span><strong>{side.stats.attackDamage}</strong></div><div><span>AP</span><strong>{side.stats.abilityPower}</strong></div><div><span>ARMOUR</span><strong>{side.stats.armor}</strong></div><div><span>MR</span><strong>{side.stats.magicResist}</strong></div></div>
    <div className="build-summary"><span>HP <b>{side.stats.healthNow}</b> / {side.stats.health}</span><span>Resource <b>{side.stats.manaNow}</b> / {side.stats.mana}</span><span>AS <b>{side.stats.attackSpeed}</b></span><span>MS <b>{side.stats.moveSpeed}</b></span></div>
    {side.items.length>0&&<div className="tag-row" style={{marginTop:12}}>{side.items.map((item,index)=><span className="tag-chip" key={`${item.id}-${index}`}>{item.image&&patch?<img src={`https://ddragon.leagueoflegends.com/cdn/${patch}/img/item/${item.image}`} alt="" width={18} height={18} style={{borderRadius:4,verticalAlign:'middle',marginRight:5}}/>:null}{item.name}</span>)}</div>}
  </div>;
}

function Num({label,value,min,max,onChange}:{label:string;value:number;min:number;max:number;onChange:(v:number)=>void}){
  return <label className="lab-input"><span>{label}</span><input className="input" type="number" value={value} min={min} max={max} onChange={e=>{const next=Number(e.target.value);onChange(Number.isFinite(next)?Math.min(max,Math.max(min,next)):min)}}/></label>;
}

function ConfidenceBanner({report,floorNote}:{report:ConfidenceReport;floorNote:boolean}){
  return <div className={`glass card lab-confidence ${CONFIDENCE_CLASS[report.level]}`} style={{marginTop:16}}><div className="section-row"><div className="eyebrow">SIMULATION CONFIDENCE</div><span className={`conf-tag ${CONFIDENCE_CLASS[report.level]}`}>{report.level}</span></div><p style={{margin:'10px 0 0',fontSize:13,lineHeight:1.5}}>{report.summary}</p>{floorNote&&<p className="lab-floor">A damage component could not be calculated, so the displayed total is a lower bound.</p>}{report.causes.length>0&&<ul className="riot-tips">{report.causes.map(c=><li key={c.reason}>{c.reason}</li>)}</ul>}</div>;
}

function AbilityPanel({side,label,showMath}:{side:SideView;label:string;showMath:boolean}){
  return <div className="glass card"><div className="section-row"><div><div className="eyebrow">{label}</div><h2 style={{margin:'6px 0 0'}}>{side.name}</h2></div><span className={`conf-tag ${CONFIDENCE_CLASS[side.confidence.level]}`}>{side.confidence.level}</span></div>
    <div className="spike-list" style={{marginTop:14}}>{side.abilities.map(a=><div className="spike" key={a.slot}><div className="spike-level">{a.slot}</div><div><b>{a.name} <span className="muted">rank {a.rank}/{a.maxRank}</span></b><p className="spike-fact">{a.damage[0]?.raw!==null&&a.damage[0]?.raw!==undefined?`${a.damage[0].raw} ${a.damage[0].type.toLowerCase()} damage`:'No damage figure'} · {a.cooldownSeconds}s · {a.cost>0?`${a.cost} resource`:'no cost'}{a.rangeUnits?` · ${a.rangeUnits} range`:''}</p>{a.confidence.level!=='HIGH'&&<p className={`conf-inline ${CONFIDENCE_CLASS[a.confidence.level]}`}>{a.confidence.level}: {a.confidence.causes[0]?.reason}</p>}{showMath&&a.calculations.length>0&&<table className="table skill-grid" style={{marginTop:8}}><tbody>{a.calculations.map(c=><tr key={c.name}><td style={{textAlign:'left'}}>{c.primary?'▸ ':''}{c.name}</td><td>{c.value??'—'}</td><td style={{textAlign:'left',color:'var(--muted)',fontSize:10}}>{c.unmodelled[0]??''}</td></tr>)}</tbody></table>}</div></div>)}</div>
  </div>;
}

const statusLabel=(status:string)=>status==='NO_RESOURCE'?'no resource':status==='ON_COOLDOWN'?'on cooldown':status==='NOT_LEARNED'?'no rank':status.toLowerCase();
