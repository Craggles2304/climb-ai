'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import type {BotLaneKey,BotLaneResult} from '@/lib/combat/botlane';
import type {ComboStep} from '@/lib/combat/combos';

interface CatalogueItem{id:number;name:string;gold:number;image:string|null;kind:string;tags:string[];stats:Record<string,number>}
interface LaneForm{champion:string;level:number;itemIds:number[];healthPercent:number;resourcePercent:number;sequence:ComboStep[]}
interface ParticipantReport{key:BotLaneKey;team:'YOU'|'THEM';role:'ADC'|'SUPPORT';champion:string;level:number;items:{id:number;name:string;gold:number;image:string|null}[];totalGold:number;stats:{attackDamage:number;abilityPower:number;armor:number;magicResist:number;health:number;healthNow:number;mana:number;attackSpeed:number;attackRange:number};sequence:ComboStep[]}
interface BotLaneResponse{ok:boolean;error?:string;patch?:string;confidence?:string;participants?:Record<BotLaneKey,ParticipantReport>;result?:BotLaneResult;focusComparison?:{recommendedTarget:BotLaneKey;recommendedRole:'ADC'|'SUPPORT';reason:string;adcFocus:any;supportFocus:any};coverage?:{partial:string[];notes:string[]}}

const steps:ComboStep[]=['Q','W','E','R','AA'];
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
  const [data,setData]=useState<BotLaneResponse|null>(null);
  const [loading,setLoading]=useState(false);
  const request=useRef(0);

  useEffect(()=>{
    fetch('/api/champions?champion=Darius').then(r=>r.json()).then(d=>{if(Array.isArray(d?.names))setNames(d.names)}).catch(()=>{});
    fetch('/api/matchup/items').then(r=>r.json()).then(d=>{if(Array.isArray(d?.items))setItems(d.items);if(typeof d?.patch==='string')setPatch(d.patch)}).catch(()=>{});
  },[]);

  const simulate=useCallback(()=>{
    const id=++request.current;setLoading(true);
    fetch('/api/matchup/botlane',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({yourAdc,yourSupport,enemyAdc,enemySupport,yourFocus,enemyFocus,durationSeconds:duration})})
      .then(r=>r.json()).then(d=>{if(id===request.current){setData(d);if(typeof d?.patch==='string')setPatch(d.patch)}})
      .catch(()=>{if(id===request.current)setData({ok:false,error:'Could not reach the bot-lane simulator.'})})
      .finally(()=>{if(id===request.current)setLoading(false)});
  },[yourAdc,yourSupport,enemyAdc,enemySupport,yourFocus,enemyFocus,duration]);
  useEffect(()=>{const timer=setTimeout(simulate,400);return()=>clearTimeout(timer)},[simulate]);

  const result=data?.result;
  return <AppShell>
    <PageHead title="Bot Duo Lab" subtitle="Four champions. One shared clock. Build the lane, choose the focus target, and see who actually wins the 2v2."/>

    <div className="glass card" style={{padding:16,marginBottom:16}}>
      <div className="section-row" style={{gap:12,flexWrap:'wrap'}}>
        <div><div className="eyebrow">BOT DUO · DETERMINISTIC 2V2</div><b style={{fontSize:15}}>ADC + Support vs ADC + Support</b><p className="muted" style={{fontSize:11,margin:'5px 0 0'}}>Damage, support shields/heals, supported CC, deaths and automatic retargeting all share the same fight timeline.</p></div>
        <div className="tag-row"><span className="tag-chip">PATCH {patch||'…'}</span><Link className="tag-chip" href="/matchup-lab">SOLO LAB →</Link></div>
      </div>
    </div>

    <div className="lab-grid" style={{position:'relative',zIndex:100,overflow:'visible'}}>
      <TeamCard title="YOUR BOT LANE" accent="YOU">
        <DuoEditor label="ADC" side="your-adc" form={yourAdc} onChange={setYourAdc} names={names} items={items} patch={patch}/>
        <DuoEditor label="SUPPORT" side="your-support" form={yourSupport} onChange={setYourSupport} names={names} items={items} patch={patch}/>
      </TeamCard>
      <TeamCard title="ENEMY BOT LANE" accent="THEM">
        <DuoEditor label="ADC" side="enemy-adc" form={enemyAdc} onChange={setEnemyAdc} names={names} items={items} patch={patch}/>
        <DuoEditor label="SUPPORT" side="enemy-support" form={enemySupport} onChange={setEnemySupport} names={names} items={items} patch={patch}/>
      </TeamCard>
    </div>

    <div className="glass card" style={{marginTop:16,padding:16}}>
      <div className="section-row" style={{gap:14,flexWrap:'wrap'}}><div><div className="eyebrow">TARGET PLAN</div><h2 style={{margin:'5px 0 0'}}>Who gets focused first?</h2></div><div className="tag-chip">{data?.confidence??'CALCULATING'}</div></div>
      <div className="lab-grid" style={{marginTop:14}}>
        <FocusPicker label="YOUR TEAM FOCUSES" value={yourFocus} options={[['THEM_ADC','ENEMY ADC'],['THEM_SUPPORT','ENEMY SUPPORT']]} onChange={v=>setYourFocus(v as 'THEM_ADC'|'THEM_SUPPORT')}/>
        <FocusPicker label="ENEMY TEAM FOCUSES" value={enemyFocus} options={[['YOU_ADC','YOUR ADC'],['YOU_SUPPORT','YOUR SUPPORT']]} onChange={v=>setEnemyFocus(v as 'YOU_ADC'|'YOU_SUPPORT')}/>
      </div>
      <div className="section-row" style={{marginTop:14,gap:10,flexWrap:'wrap'}}><span className="muted" style={{fontSize:11}}>Fight window</span><div className="tag-row">{[3,5,10,15,20].map(x=><button key={x} className={`tag-chip ${duration===x?'live-pill':''}`} onClick={()=>setDuration(x)}>{x}s</button>)}</div></div>
    </div>

    {loading&&!data?.ok&&<div className="glass card" style={{marginTop:16}}><p className="muted">Running four-champion timeline…</p></div>}
    {data&&!data.ok&&!loading&&<div className="glass card" style={{marginTop:16}}><h2>Could not simulate this lane.</h2><p className="muted">{data.error}</p></div>}

    {data?.ok&&result&&<>
      <div className="glass card lab-verdict" style={{marginTop:16}}>
        <div><div className="eyebrow">2V2 RESULT</div><h2>{verdictCopy(result.verdict)}</h2><p className="muted">{result.firstKill?`First kill: ${result.firstKill.champion} at ${result.firstKill.atSeconds}s.`:'No kill inside the selected window.'}</p></div>
        <div className="lab-damage"><strong>{result.teamDamage.YOU}</strong><span>YOUR TEAM DAMAGE</span><small>Enemy team: {result.teamDamage.THEM}</small></div>
      </div>

      {data.focusComparison&&<div className="glass card" style={{marginTop:16,padding:16,border:'1px solid rgba(var(--accent-rgb),.3)'}}>
        <div className="section-row" style={{gap:12,flexWrap:'wrap'}}><div><div className="eyebrow">WHO SHOULD YOU HIT?</div><h2 style={{margin:'5px 0'}}>FOCUS THE {data.focusComparison.recommendedRole}</h2><p className="muted" style={{margin:0,fontSize:12}}>{data.focusComparison.reason}</p></div><span className="tag-chip live-pill">SIMULATED BOTH PLANS</span></div>
      </div>}

      <div className="lab-grid" style={{marginTop:16}}>
        <LaneResult title="YOUR BOT LANE" adc={result.participants.YOU_ADC} support={result.participants.YOU_SUPPORT}/>
        <LaneResult title="ENEMY BOT LANE" adc={result.participants.THEM_ADC} support={result.participants.THEM_SUPPORT}/>
      </div>

      <div className="glass card" style={{marginTop:16}}>
        <div className="section-row"><div><div className="eyebrow">FOUR-CHAMPION TIMELINE</div><h2 style={{margin:'5px 0 0'}}>What happens while everyone acts</h2></div><span className="tag-chip">{result.durationSeconds}s</span></div>
        <div style={{overflowX:'auto',marginTop:14}}><table className="table"><thead><tr><th>At</th><th>Actor</th><th>Action</th><th>Target</th><th>Damage</th><th>Utility</th></tr></thead><tbody>{result.timeline.flatMap((frame,fi)=>frame.actions.map((a,ai)=><tr key={`${fi}-${ai}-${a.actor}`}><td>{frame.atSeconds}s</td><td>{shortKey(a.actor)} · {a.champion}</td><td>{a.step} · {a.status.replaceAll('_',' ')}</td><td>{a.targetChampion??'—'}</td><td>{a.damageApplied||'—'}</td><td>{[a.shieldGranted?`+${a.shieldGranted} shield`:'',a.healApplied?`+${a.healApplied} heal`:'',a.controlSeconds?`${a.controlSeconds}s CC`:''].filter(Boolean).join(' · ')||'—'}</td></tr>)))}</tbody></table></div>
      </div>

      {data.coverage?.partial?.length?<div className="glass card" style={{marginTop:16}}><div className="eyebrow">SIMULATION CONFIDENCE · PARTIAL</div><p className="muted" style={{fontSize:11}}>These mechanics are understood but not yet converted into guessed numbers:</p><div className="tag-row">{data.coverage.partial.slice(0,16).map((x,i)=><span className="tag-chip" key={`${x}-${i}`}>{clean(x)}</span>)}</div></div>:null}
    </>}
  </AppShell>;
}

function TeamCard({title,children}:{title:string;accent:string;children:React.ReactNode}){return <div className="glass card" style={{overflow:'visible'}}><div className="eyebrow">{title}</div><div style={{display:'grid',gap:14,marginTop:12}}>{children}</div></div>}

function DuoEditor({label,side,form,onChange,names,items,patch}:{label:string;side:string;form:LaneForm;onChange:(v:LaneForm)=>void;names:string[];items:CatalogueItem[];patch:string}){
  const set=<K extends keyof LaneForm>(k:K,v:LaneForm[K])=>onChange({...form,[k]:v});
  return <div style={{padding:12,border:'1px solid var(--border)',borderRadius:14,background:'rgba(255,255,255,.02)',overflow:'visible'}}>
    <div className="section-row"><b>{label}</b><span className="tag-chip">LV {form.level}</span></div>
    <div style={{display:'grid',gridTemplateColumns:'1.4fr .55fr .65fr .75fr',gap:8,marginTop:9}}>
      <label className="lab-input"><span>Champion</span><input className="input" list={`names-${side}`} value={form.champion} onChange={e=>set('champion',e.target.value)}/><datalist id={`names-${side}`}>{names.map(n=><option key={n} value={n}/>)}</datalist></label>
      <Num label="Level" value={form.level} min={1} max={18} onChange={v=>set('level',v)}/>
      <Num label="HP %" value={form.healthPercent} min={1} max={100} onChange={v=>set('healthPercent',v)}/>
      <Num label="Resource %" value={form.resourcePercent} min={0} max={100} onChange={v=>set('resourcePercent',v)}/>
    </div>
    <MiniItemPicker selected={form.itemIds} onChange={v=>set('itemIds',v)} items={items} patch={patch}/>
    <MiniSequence sequence={form.sequence} onChange={v=>set('sequence',v)}/>
  </div>;
}

function MiniItemPicker({selected,onChange,items,patch}:{selected:number[];onChange:(v:number[])=>void;items:CatalogueItem[];patch:string}){
  const [q,setQ]=useState('');const byId=useMemo(()=>new Map(items.map(i=>[i.id,i])),[items]);
  const results=useMemo(()=>q.trim()?items.filter(i=>i.name.toLowerCase().includes(q.toLowerCase())).slice(0,7):[],[items,q]);
  const image=(i:CatalogueItem)=>i.image&&patch?`https://ddragon.leagueoflegends.com/cdn/${patch}/img/item/${i.image}`:'';
  return <div style={{marginTop:10,position:'relative',zIndex:40}}><div className="tag-row">{selected.map((id,index)=>{const i=byId.get(id);return i?<button type="button" className="tag-chip" key={`${id}-${index}`} onClick={()=>onChange(selected.filter((_,x)=>x!==index))}>{image(i)?<img src={image(i)} alt="" width={18} height={18} style={{borderRadius:4,verticalAlign:'middle',marginRight:5}}/>:null}{i.name} ×</button>:null})}<span className="muted" style={{fontSize:10}}>{selected.length}/6 items</span></div><div style={{position:'relative',marginTop:7}}><input className="input" placeholder="Add item…" value={q} disabled={selected.length>=6} onChange={e=>setQ(e.target.value)}/>{results.length>0&&<div style={{position:'absolute',zIndex:9999,top:'calc(100% + 5px)',left:0,right:0,maxHeight:260,overflowY:'auto',background:'#11151c',border:'1px solid var(--border)',borderRadius:12,boxShadow:'0 20px 60px rgba(0,0,0,.7)'}}>{results.map(i=><button key={i.id} type="button" onClick={()=>{onChange([...selected,i.id]);setQ('')}} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:8,border:0,borderBottom:'1px solid var(--border)',background:'transparent',color:'inherit',textAlign:'left',cursor:'pointer'}}>{image(i)?<img src={image(i)} alt="" width={32} height={32} style={{borderRadius:6}}/>:null}<div style={{flex:1}}><b style={{fontSize:11}}>{i.name}</b><div className="muted" style={{fontSize:9}}>{i.kind}</div></div><b style={{fontSize:10}}>{i.gold}g</b></button>)}</div>}</div></div>;
}

function MiniSequence({sequence,onChange}:{sequence:ComboStep[];onChange:(v:ComboStep[])=>void}){return <div style={{marginTop:9}}><div className="tag-row"><span className="muted" style={{fontSize:10}}>Script: {sequence.join(' → ')||'empty'}</span>{steps.map(s=><button key={s} className="tag-chip" onClick={()=>sequence.length<24&&onChange([...sequence,s])}>+{s}</button>)}{sequence.length>0&&<button className="tag-chip" onClick={()=>onChange(sequence.slice(0,-1))}>UNDO</button>}<button className="tag-chip" onClick={()=>onChange([])}>CLEAR</button></div></div>}

function FocusPicker({label,value,options,onChange}:{label:string;value:string;options:[string,string][];onChange:(v:string)=>void}){return <div style={{padding:12,border:'1px solid var(--border)',borderRadius:14}}><div className="eyebrow">{label}</div><div className="tag-row" style={{marginTop:8}}>{options.map(([id,name])=><button key={id} className={`tag-chip ${value===id?'live-pill':''}`} onClick={()=>onChange(id)}>{value===id?'✓ ':''}{name}</button>)}</div></div>}

function LaneResult({title,adc,support}:{title:string;adc:any;support:any}){return <div className="glass card"><div className="eyebrow">{title}</div>{[adc,support].map((p:any)=><div key={p.key} className="league-row"><span>{p.role} · {p.champion}<small style={{display:'block'}}>{p.damageDealt} damage · {p.healingDone} healing · {p.shieldingDone} shielding</small></span><b>{p.health} HP{p.shield?` + ${p.shield}`:''}</b></div>)}</div>}

function Num({label,value,min,max,onChange}:{label:string;value:number;min:number;max:number;onChange:(v:number)=>void}){return <label className="lab-input"><span>{label}</span><input className="input" type="number" min={min} max={max} value={value} onChange={e=>{const n=Number(e.target.value);onChange(Number.isFinite(n)?Math.max(min,Math.min(max,n)):min)}}/></label>}
const verdictCopy=(v:string)=>v==='YOU_WIN'?'YOUR BOT LANE WINS':v==='THEM_WIN'?'ENEMY BOT LANE WINS':v==='YOU_AHEAD'?'YOUR BOT LANE FINISHES AHEAD':v==='THEM_AHEAD'?'ENEMY BOT LANE FINISHES AHEAD':v==='DOUBLE_KO'?'BOTH LANES ARE WIPED':'THE 2V2 IS CLOSE';
const shortKey=(k:BotLaneKey)=>k==='YOU_ADC'?'YOU ADC':k==='YOU_SUPPORT'?'YOU SUP':k==='THEM_ADC'?'THEIR ADC':'THEIR SUP';
const clean=(x:string)=>x.replaceAll('_',' ');
