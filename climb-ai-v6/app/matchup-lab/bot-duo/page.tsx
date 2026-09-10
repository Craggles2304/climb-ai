'use client';
import {useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';

type Step='AA'|'Q'|'W'|'E'|'R';
type SideKey='YOU_ADC'|'YOU_SUPPORT'|'THEM_ADC'|'THEM_SUPPORT';
interface CatalogueItem{id:number;name:string;gold:number;image:string|null;kind:string}
interface LaneForm{champion:string;level:number;itemIds:number[];healthPercent:number;resourcePercent:number;sequence:Step[]}
interface ParticipantSnapshot{key:SideKey;champion:string;team:'YOU'|'THEM';role:'ADC'|'SUPPORT';health:number;maxHealth:number;shield:number;mana:number;alive:boolean;damageDealt:number;damageTaken:number;healingDone:number;shieldingDone:number;controlledUntil:number}
interface ActionEvent{actor:SideKey;champion:string;step:Step;target:SideKey|null;targetChampion:string|null;status:string;damageApplied:number;healApplied:number;shieldGranted:number;controlSeconds:number}
interface Frame{atSeconds:number;actions:ActionEvent[];participants:Record<SideKey,ParticipantSnapshot>}
interface Kill{atSeconds:number;victim:SideKey;champion:string;team:'YOU'|'THEM';by:SideKey[]}
interface BotResult{verdict:string;winner:'YOU'|'THEM'|null;durationSeconds:number;timeline:Frame[];kills:Kill[];participants:Record<SideKey,ParticipantSnapshot>;teamDamage:{YOU:number;THEM:number};firstKill:Kill|null;incomplete:boolean;modelNote:string}
interface FocusComparison{recommendedTarget:SideKey;recommendedRole:'ADC'|'SUPPORT';reason:string}
interface ApiResponse{ok:boolean;error?:string;patch?:string;confidence?:string;result?:BotResult;focusComparison?:FocusComparison;coverage?:{partial:string[];notes:string[]}}

const STEPS:Step[]=['Q','W','E','R','AA'];
const blank=(champion:string):LaneForm=>({champion,level:6,itemIds:[],healthPercent:100,resourcePercent:100,sequence:['Q','AA','W','AA','E','R']});

export default function BotDuoLab(){
  const [yourAdc,setYourAdc]=useState<LaneForm>(blank("Kog'Maw"));
  const [yourSupport,setYourSupport]=useState<LaneForm>(blank('Lulu'));
  const [enemyAdc,setEnemyAdc]=useState<LaneForm>(blank('Caitlyn'));
  const [enemySupport,setEnemySupport]=useState<LaneForm>(blank('Lux'));
  const [yourFocus,setYourFocus]=useState<'THEM_ADC'|'THEM_SUPPORT'>('THEM_ADC');
  const [enemyFocus,setEnemyFocus]=useState<'YOU_ADC'|'YOU_SUPPORT'>('YOU_ADC');
  const [duration,setDuration]=useState(10);
  const [names,setNames]=useState<string[]>([]);
  const [items,setItems]=useState<CatalogueItem[]>([]);
  const [patch,setPatch]=useState('');
  const [data,setData]=useState<ApiResponse|null>(null);
  const [loading,setLoading]=useState(false);
  const request=useRef(0);

  useEffect(()=>{
    fetch('/api/champions?champion=Darius').then(r=>r.json()).then((d:unknown)=>{
      const value=d as {names?:unknown};
      if(Array.isArray(value?.names))setNames(value.names.filter((x):x is string=>typeof x==='string'));
    }).catch(()=>{});
    fetch('/api/matchup/items').then(r=>r.json()).then((d:unknown)=>{
      const value=d as {items?:unknown;patch?:unknown};
      if(Array.isArray(value.items))setItems(value.items as CatalogueItem[]);
      if(typeof value.patch==='string')setPatch(value.patch);
    }).catch(()=>{});
  },[]);

  const simulate=useCallback(()=>{
    const id=++request.current;setLoading(true);
    fetch('/api/matchup/botlane',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({yourAdc,yourSupport,enemyAdc,enemySupport,yourFocus,enemyFocus,durationSeconds:duration}),
    }).then(r=>r.json()).then((d:ApiResponse)=>{
      if(id!==request.current)return;
      setData(d);if(typeof d.patch==='string')setPatch(d.patch);
    }).catch(()=>{if(id===request.current)setData({ok:false,error:'Could not reach the bot-lane simulator.'})})
      .finally(()=>{if(id===request.current)setLoading(false)});
  },[yourAdc,yourSupport,enemyAdc,enemySupport,yourFocus,enemyFocus,duration]);

  useEffect(()=>{const timer=setTimeout(simulate,400);return()=>clearTimeout(timer)},[simulate]);
  const result=data?.result;

  return <AppShell>
    <PageHead title="Bot Duo Lab" subtitle="Four champions. One shared clock. Build the lane, choose the focus target, and see who actually wins the 2v2."/>

    <div className="glass card" style={{padding:16,marginBottom:16}}>
      <div className="section-row" style={{gap:12,flexWrap:'wrap'}}>
        <div>
          <div className="eyebrow">BOT DUO · DETERMINISTIC 2V2</div>
          <b style={{fontSize:15}}>ADC + Support vs ADC + Support</b>
          <p className="muted" style={{fontSize:11,margin:'5px 0 0'}}>All four champions share one fight clock. Supported support shields, heals and crowd control change the same timeline as ADC damage.</p>
        </div>
        <div className="tag-row"><span className="tag-chip">PATCH {patch||'…'}</span><Link className="tag-chip" href="/matchup-lab">SOLO LAB →</Link></div>
      </div>
    </div>

    <div className="lab-grid" style={{position:'relative',zIndex:100,overflow:'visible'}}>
      <TeamCard title="YOUR BOT LANE">
        <DuoEditor label="ADC" sideId="your-adc" form={yourAdc} onChange={setYourAdc} names={names} items={items} patch={patch}/>
        <DuoEditor label="SUPPORT" sideId="your-support" form={yourSupport} onChange={setYourSupport} names={names} items={items} patch={patch}/>
      </TeamCard>
      <TeamCard title="ENEMY BOT LANE">
        <DuoEditor label="ADC" sideId="enemy-adc" form={enemyAdc} onChange={setEnemyAdc} names={names} items={items} patch={patch}/>
        <DuoEditor label="SUPPORT" sideId="enemy-support" form={enemySupport} onChange={setEnemySupport} names={names} items={items} patch={patch}/>
      </TeamCard>
    </div>

    <div className="glass card" style={{marginTop:16,padding:16}}>
      <div className="section-row" style={{gap:14,flexWrap:'wrap'}}>
        <div><div className="eyebrow">TARGET PLAN</div><h2 style={{margin:'5px 0 0'}}>Who gets focused first?</h2></div>
        <span className="tag-chip">{data?.confidence??'CALCULATING'}</span>
      </div>
      <div className="lab-grid" style={{marginTop:14}}>
        <FocusPicker label="YOUR TEAM FOCUSES" value={yourFocus} options={[{id:'THEM_ADC',label:'ENEMY ADC'},{id:'THEM_SUPPORT',label:'ENEMY SUPPORT'}]} onChange={v=>setYourFocus(v as 'THEM_ADC'|'THEM_SUPPORT')}/>
        <FocusPicker label="ENEMY TEAM FOCUSES" value={enemyFocus} options={[{id:'YOU_ADC',label:'YOUR ADC'},{id:'YOU_SUPPORT',label:'YOUR SUPPORT'}]} onChange={v=>setEnemyFocus(v as 'YOU_ADC'|'YOU_SUPPORT')}/>
      </div>
      <div className="section-row" style={{marginTop:14,gap:10,flexWrap:'wrap'}}>
        <span className="muted" style={{fontSize:11}}>Fight window</span>
        <div className="tag-row">{[3,5,10,15,20].map(seconds=><button type="button" key={seconds} className={`tag-chip ${duration===seconds?'live-pill':''}`} onClick={()=>setDuration(seconds)}>{seconds}s</button>)}</div>
      </div>
    </div>

    {loading&&!data?.ok&&<div className="glass card" style={{marginTop:16}}><p className="muted">Running four-champion timeline…</p></div>}
    {data&&!data.ok&&!loading&&<div className="glass card" style={{marginTop:16}}><h2>Could not simulate this lane.</h2><p className="muted">{data.error}</p></div>}

    {data?.ok&&result&&<>
      <div className="glass card lab-verdict" style={{marginTop:16}}>
        <div><div className="eyebrow">2V2 RESULT</div><h2>{verdictCopy(result.verdict)}</h2><p className="muted">{result.firstKill?`First kill: ${result.firstKill.champion} at ${result.firstKill.atSeconds}s.`:'No kill inside the selected window.'}</p></div>
        <div className="lab-damage"><strong>{result.teamDamage.YOU}</strong><span>YOUR TEAM DAMAGE</span><small>Enemy team: {result.teamDamage.THEM}</small></div>
      </div>

      {data.focusComparison&&<div className="glass card" style={{marginTop:16,padding:16,border:'1px solid rgba(var(--accent-rgb),.3)'}}>
        <div className="section-row" style={{gap:12,flexWrap:'wrap'}}>
          <div><div className="eyebrow">WHO SHOULD YOU HIT?</div><h2 style={{margin:'5px 0'}}>FOCUS THE {data.focusComparison.recommendedRole}</h2><p className="muted" style={{margin:0,fontSize:12}}>{data.focusComparison.reason}</p></div>
          <span className="tag-chip live-pill">SIMULATED BOTH PLANS</span>
        </div>
      </div>}

      <div className="lab-grid" style={{marginTop:16}}>
        <LaneResult title="YOUR BOT LANE" adc={result.participants.YOU_ADC} support={result.participants.YOU_SUPPORT}/>
        <LaneResult title="ENEMY BOT LANE" adc={result.participants.THEM_ADC} support={result.participants.THEM_SUPPORT}/>
      </div>

      <div className="glass card" style={{marginTop:16}}>
        <div className="section-row"><div><div className="eyebrow">FOUR-CHAMPION TIMELINE</div><h2 style={{margin:'5px 0 0'}}>What happens while everyone acts</h2></div><span className="tag-chip">{result.durationSeconds}s</span></div>
        <div style={{overflowX:'auto',marginTop:14}}><table className="table">
          <thead><tr><th>At</th><th>Actor</th><th>Action</th><th>Target</th><th>Damage</th><th>Utility</th></tr></thead>
          <tbody>{result.timeline.flatMap((frame,frameIndex)=>frame.actions.map((action,actionIndex)=><tr key={`${frameIndex}-${actionIndex}-${action.actor}`}>
            <td>{frame.atSeconds}s</td><td>{shortKey(action.actor)} · {action.champion}</td><td>{action.step} · {action.status.replaceAll('_',' ')}</td><td>{action.targetChampion??'—'}</td><td>{action.damageApplied||'—'}</td><td>{utilityCopy(action)}</td>
          </tr>))}</tbody>
        </table></div>
      </div>

      {data.coverage?.partial?.length?<div className="glass card" style={{marginTop:16}}>
        <div className="eyebrow">SIMULATION CONFIDENCE · PARTIAL</div>
        <p className="muted" style={{fontSize:11}}>These mechanics are understood but are not being turned into guessed numbers:</p>
        <div className="tag-row">{data.coverage.partial.slice(0,16).map((reason,index)=><span className="tag-chip" key={`${reason}-${index}`}>{clean(reason)}</span>)}</div>
      </div>:null}
    </>}
  </AppShell>;
}

function TeamCard({title,children}:{title:string;children:ReactNode}){
  return <div className="glass card" style={{overflow:'visible'}}><div className="eyebrow">{title}</div><div style={{display:'grid',gap:14,marginTop:12}}>{children}</div></div>;
}

function DuoEditor({label,sideId,form,onChange,names,items,patch}:{label:string;sideId:string;form:LaneForm;onChange:(value:LaneForm)=>void;names:string[];items:CatalogueItem[];patch:string}){
  const set=<K extends keyof LaneForm>(key:K,value:LaneForm[K])=>onChange({...form,[key]:value});
  return <div style={{padding:12,border:'1px solid var(--border)',borderRadius:14,background:'rgba(255,255,255,.02)',overflow:'visible'}}>
    <div className="section-row"><b>{label}</b><span className="tag-chip">LV {form.level}</span></div>
    <div style={{display:'grid',gridTemplateColumns:'1.4fr .55fr .65fr .75fr',gap:8,marginTop:9}}>
      <label className="lab-input"><span>Champion</span><input className="input" list={`names-${sideId}`} value={form.champion} onChange={e=>set('champion',e.target.value)}/><datalist id={`names-${sideId}`}>{names.map(name=><option key={name} value={name}/>)}</datalist></label>
      <Num label="Level" value={form.level} min={1} max={18} onChange={value=>set('level',value)}/>
      <Num label="HP %" value={form.healthPercent} min={1} max={100} onChange={value=>set('healthPercent',value)}/>
      <Num label="Resource %" value={form.resourcePercent} min={0} max={100} onChange={value=>set('resourcePercent',value)}/>
    </div>
    <MiniItemPicker selected={form.itemIds} onChange={value=>set('itemIds',value)} items={items} patch={patch}/>
    <MiniSequence sequence={form.sequence} onChange={value=>set('sequence',value)}/>
  </div>;
}

function MiniItemPicker({selected,onChange,items,patch}:{selected:number[];onChange:(value:number[])=>void;items:CatalogueItem[];patch:string}){
  const [query,setQuery]=useState('');
  const byId=useMemo(()=>new Map(items.map(item=>[item.id,item])),[items]);
  const results=useMemo(()=>query.trim()?items.filter(item=>item.name.toLowerCase().includes(query.toLowerCase())).slice(0,7):[],[items,query]);
  const image=(item:CatalogueItem)=>item.image&&patch?`https://ddragon.leagueoflegends.com/cdn/${patch}/img/item/${item.image}`:'';
  return <div style={{marginTop:10,position:'relative',zIndex:40}}>
    <div className="tag-row">
      {selected.map((id,index)=>{const item=byId.get(id);return item?<button type="button" className="tag-chip" key={`${id}-${index}`} onClick={()=>onChange(selected.filter((_,itemIndex)=>itemIndex!==index))}>{image(item)?<img src={image(item)} alt="" width={18} height={18} style={{borderRadius:4,verticalAlign:'middle',marginRight:5}}/>:null}{item.name} ×</button>:null})}
      <span className="muted" style={{fontSize:10}}>{selected.length}/6 items</span>
    </div>
    <div style={{position:'relative',marginTop:7}}>
      <input className="input" placeholder="Add item…" value={query} disabled={selected.length>=6} onChange={e=>setQuery(e.target.value)}/>
      {results.length>0&&<div style={{position:'absolute',zIndex:9999,top:'calc(100% + 5px)',left:0,right:0,maxHeight:260,overflowY:'auto',background:'#11151c',border:'1px solid var(--border)',borderRadius:12,boxShadow:'0 20px 60px rgba(0,0,0,.7)'}}>
        {results.map(item=><button key={item.id} type="button" onClick={()=>{onChange([...selected,item.id]);setQuery('')}} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:8,border:0,borderBottom:'1px solid var(--border)',background:'transparent',color:'inherit',textAlign:'left',cursor:'pointer'}}>
          {image(item)?<img src={image(item)} alt="" width={32} height={32} style={{borderRadius:6}}/>:null}<div style={{flex:1}}><b style={{fontSize:11}}>{item.name}</b><div className="muted" style={{fontSize:9}}>{item.kind}</div></div><b style={{fontSize:10}}>{item.gold}g</b>
        </button>)}
      </div>}
    </div>
  </div>;
}

function MiniSequence({sequence,onChange}:{sequence:Step[];onChange:(value:Step[])=>void}){
  return <div style={{marginTop:9}}><div className="tag-row">
    <span className="muted" style={{fontSize:10}}>Script: {sequence.join(' → ')||'empty'}</span>
    {STEPS.map(step=><button type="button" key={step} className="tag-chip" onClick={()=>{if(sequence.length<24)onChange([...sequence,step])}}>+{step}</button>)}
    {sequence.length>0&&<button type="button" className="tag-chip" onClick={()=>onChange(sequence.slice(0,-1))}>UNDO</button>}
    <button type="button" className="tag-chip" onClick={()=>onChange([])}>CLEAR</button>
  </div></div>;
}

function FocusPicker({label,value,options,onChange}:{label:string;value:string;options:{id:string;label:string}[];onChange:(value:string)=>void}){
  return <div style={{padding:12,border:'1px solid var(--border)',borderRadius:14}}><div className="eyebrow">{label}</div><div className="tag-row" style={{marginTop:8}}>{options.map(option=><button type="button" key={option.id} className={`tag-chip ${value===option.id?'live-pill':''}`} onClick={()=>onChange(option.id)}>{value===option.id?'✓ ':''}{option.label}</button>)}</div></div>;
}

function LaneResult({title,adc,support}:{title:string;adc:ParticipantSnapshot;support:ParticipantSnapshot}){
  return <div className="glass card"><div className="eyebrow">{title}</div>{[adc,support].map(participant=><div key={participant.key} className="league-row"><span>{participant.role} · {participant.champion}<small style={{display:'block'}}>{participant.damageDealt} damage · {participant.healingDone} healing · {participant.shieldingDone} shielding</small></span><b>{participant.health} HP{participant.shield?` + ${participant.shield}`:''}</b></div>)}</div>;
}

function Num({label,value,min,max,onChange}:{label:string;value:number;min:number;max:number;onChange:(value:number)=>void}){
  return <label className="lab-input"><span>{label}</span><input className="input" type="number" min={min} max={max} value={value} onChange={e=>{const next=Number(e.target.value);onChange(Number.isFinite(next)?Math.max(min,Math.min(max,next)):min)}}/></label>;
}

function utilityCopy(action:ActionEvent){const parts:string[]=[];if(action.shieldGranted)parts.push(`+${action.shieldGranted} shield`);if(action.healApplied)parts.push(`+${action.healApplied} heal`);if(action.controlSeconds)parts.push(`${action.controlSeconds}s CC`);return parts.join(' · ')||'—'}
const verdictCopy=(value:string)=>value==='YOU_WIN'?'YOUR BOT LANE WINS':value==='THEM_WIN'?'ENEMY BOT LANE WINS':value==='YOU_AHEAD'?'YOUR BOT LANE FINISHES AHEAD':value==='THEM_AHEAD'?'ENEMY BOT LANE FINISHES AHEAD':value==='DOUBLE_KO'?'BOTH LANES ARE WIPED':'THE 2V2 IS CLOSE';
const shortKey=(key:SideKey)=>key==='YOU_ADC'?'YOU ADC':key==='YOU_SUPPORT'?'YOU SUP':key==='THEM_ADC'?'THEIR ADC':'THEIR SUP';
const clean=(value:string)=>value.replaceAll('_',' ');
