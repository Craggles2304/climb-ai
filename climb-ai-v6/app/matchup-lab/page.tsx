'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import type {ConfidenceLevel,ConfidenceReport} from '@/lib/combat/confidence';
import type {ComboResult,ComboStep,AbilitySlot} from '@/lib/combat/combos';
import type {KillCheck} from '@/lib/combat/damage';
import type {TradeReport} from '@/lib/combat/trades';
import type {DuelResult} from '@/lib/combat/duel';
import {championEffectOptions} from '@/lib/combat/championEffects';
import {TradePanel} from '@/components/TradePanel';
import {DuelPanel} from '@/components/DuelPanel';

interface AbilityView{
  slot:AbilitySlot;name:string;rank:number;maxRank:number;
  cooldownSeconds:number;cost:number;rangeUnits:number|null;
  damage:{label:string;raw:number|null;type:string}[];
  calculations:{name:string;value:number|null;unmodelled:string[];primary:boolean}[];
  confidence:ConfidenceReport;variantNote?:string;
}

interface ItemView{id:number;name:string;gold:number;image:string|null;tags:string[]}
interface SideSetup{
  runeIds:number[];summonerIds:string[];activeSummonerIds:string[];
  activeChampionEffects:string[];shield:number;ranks:Partial<Record<AbilitySlot,number>>;
}
interface SideView{
  id:string;name:string;level:number;damageType:string;items:ItemView[];totalGold:number;
  setup?:SideSetup;
  stats:{attackDamage:number;abilityPower:number;armor:number;magicResist:number;health:number;healthNow:number;mana:number;manaNow:number;attackSpeed:number;attackRange:number;moveSpeed:number};
  abilities:AbilityView[];confidence:ConfidenceReport;
}
interface EffectSide{
  modelledRunes:number[];unmodelledRunes:number[];
  modelledSummoners:string[];unmodelledActiveSummoners:string[];
  modelledChampionEffects:string[];unmodelledChampionEffects:string[];
  itemOnHits:string[];notes:string[];
}
interface Simulation{
  ok:boolean;error?:string;patch?:string;
  dataSources?:{name:string;use:string;official:boolean}[];
  you?:SideView;them?:SideView;combo?:ComboResult;kill?:KillCheck;trades?:TradeReport;duel?:DuelResult;
  allIn?:{comboDamage:number;igniteDamage:number;totalDamageForKillCheck:number;targetCurrentHealth:number;targetShield:number;includesFiveSecondIgnite:boolean};
  effects?:{you:EffectSide;them:EffectSide};
  confidence?:ConfidenceReport;notes?:string[];
}
interface CatalogueItem{
  id:number;name:string;gold:number;image:string|null;kind:string;tags:string[];
  stats:{attackDamage:number;abilityPower:number;attackSpeedPercent:number;critPercent:number;health:number;armor:number;magicResist:number;mana:number;abilityHaste:number;lethality:number;moveSpeed:number};
}
interface SetupRune{id:number;name:string;icon:string;treeId:number;treeName:string;slot:number}
interface SetupSummoner{id:string;key:number;name:string;description:string;image:string|null;cooldown:number|null}
interface SideForm{
  champion:string;level:number;itemIds:number[];healthPercent:number;resourcePercent:number;
  shield:number;runeIds:number[];summonerIds:string[];activeSummonerIds:string[];
  activeChampionEffects:string[];ranks:Partial<Record<AbilitySlot,number>>;
}

const blankSide=(champion:string):SideForm=>({
  champion,level:6,itemIds:[],healthPercent:100,resourcePercent:100,shield:0,
  runeIds:[],summonerIds:['SummonerFlash'],activeSummonerIds:[],
  activeChampionEffects:[],ranks:{},
});
const STEPS:ComboStep[]=['Q','W','E','R','AA'];
const MODELLED_RUNES=new Set([8005,8008,8014,8017,8299]);
const ACTIVE_SUMMONERS=new Set(['SummonerBarrier','SummonerHeal','SummonerDot','SummonerExhaust']);
const CONFIDENCE_CLASS:Record<ConfidenceLevel,string>={HIGH:'conf-high',MEDIUM:'conf-medium',LOW:'conf-low',PARTIAL:'conf-partial'};

export default function MatchupLab(){
  const [you,setYou]=useState<SideForm>(blankSide("Kog'Maw"));
  const [them,setThem]=useState<SideForm>(blankSide('Caitlyn'));
  const [sequence,setSequence]=useState<ComboStep[]>(['Q','AA','W','AA','E','R']);
  const [enemySequence,setEnemySequence]=useState<ComboStep[]>(['Q','AA','W','AA','E','R']);
  const [duelDuration,setDuelDuration]=useState(10);
  const [data,setData]=useState<Simulation|null>(null);
  const [loading,setLoading]=useState(false);
  const [names,setNames]=useState<string[]>([]);
  const [items,setItems]=useState<CatalogueItem[]>([]);
  const [runes,setRunes]=useState<SetupRune[]>([]);
  const [summoners,setSummoners]=useState<SetupSummoner[]>([]);
  const [itemPatch,setItemPatch]=useState('');
  const [showMath,setShowMath]=useState(false);
  const request=useRef(0);

  useEffect(()=>{
    fetch('/api/champions?champion=Darius').then(r=>r.json()).then(d=>{if(Array.isArray(d?.names))setNames(d.names)}).catch(()=>{});
    fetch('/api/matchup/items').then(r=>r.json()).then(d=>{
      if(Array.isArray(d?.items))setItems(d.items);
      if(typeof d?.patch==='string')setItemPatch(d.patch);
    }).catch(()=>{});
    fetch('/api/matchup/setup').then(r=>r.json()).then(d=>{
      if(Array.isArray(d?.runes))setRunes(d.runes);
      if(Array.isArray(d?.summoners))setSummoners(d.summoners);
      if(typeof d?.patch==='string')setItemPatch(p=>p||d.patch);
    }).catch(()=>{});
  },[]);

  const simulate=useCallback(()=>{
    const id=++request.current;
    setLoading(true);
    fetch('/api/matchup/simulate',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({you,them,sequence,enemySequence,duelDurationSeconds:duelDuration}),
    }).then(r=>r.json()).then(d=>{if(id===request.current)setData(d)})
      .catch(()=>{if(id===request.current)setData({ok:false,error:'Could not reach the simulator.'})})
      .finally(()=>{if(id===request.current)setLoading(false)});
  },[you,them,sequence,enemySequence,duelDuration]);

  useEffect(()=>{const timer=setTimeout(simulate,350);return()=>clearTimeout(timer)},[simulate]);

  const verdict=useMemo(()=>{
    if(!data?.ok||!data.kill||!data.combo)return null;
    if(data.kill.kills)
      return {label:data.allIn?.includesFiveSecondIgnite?'LETHAL WITH ACTIVE IGNITE':'THIS COMBO KILLS',tone:'edge-you'};
    const damage=data.allIn?.totalDamageForKillCheck??data.combo.totalMitigatedDamage;
    const pool=Math.max(1,(data.them?.stats.healthNow??1)+(data.them?.setup?.shield??0));
    const share=damage/pool;
    if(share>=0.6)return {label:'CLOSE TO LETHAL',tone:'edge-even'};
    return {label:'NOT LETHAL',tone:'edge-them'};
  },[data]);

  return <AppShell>
    <PageHead title="Matchup Lab" subtitle="Build both sides of the fight. Items, runes, champion states, action scripts and a shared duel clock now feed the deterministic combat engine."/>

    <div className="glass card" style={{marginBottom:16,padding:16}}>
      <div className="section-row" style={{gap:12,flexWrap:'wrap'}}>
        <div>
          <div className="eyebrow">BUILD THE FIGHT, NOT A SPREADSHEET</div>
          <b style={{fontSize:15}}>Champion → level → items → ranks → runes → active fight tools → both action scripts.</b>
          <p className="muted" style={{margin:'5px 0 0',fontSize:12}}>The one-sided combo still answers “how much can I do?”; the new shared duel answers “what happens while they hit back?”</p>
        </div>
        <div className="tag-chip">DATA PATCH {itemPatch||data?.patch||'…'}</div>
      </div>
    </div>

    {/* Backdrop-filter creates stacking contexts, so the entire setup layer must
        sit above the combo/results cards for item search menus to escape. */}
    <div className="lab-grid" style={{position:'relative',zIndex:100,overflow:'visible'}}>
      <SideEditor title="YOUR CHAMPION" side="you" form={you} onChange={setYou} names={names} items={items} runes={runes} summoners={summoners} patch={itemPatch} resolved={data?.you}/>
      <SideEditor title="ENEMY CHAMPION" side="them" form={them} onChange={setThem} names={names} items={items} runes={runes} summoners={summoners} patch={itemPatch} resolved={data?.them}/>
    </div>

    <div className="lab-grid" style={{marginTop:16,position:'relative',zIndex:1}}>
      <SequenceEditor title="YOUR ACTION SCRIPT" sequence={sequence} onChange={setSequence} detail="Used by your one-sided combo and the shared duel."/>
      <SequenceEditor title="ENEMY RESPONSE SCRIPT" sequence={enemySequence} onChange={setEnemySequence} detail="What the enemy does while your script is happening."/>
    </div>

    <div className="glass card" style={{marginTop:16,position:'relative',zIndex:1,padding:14}}>
      <div className="section-row" style={{gap:12,flexWrap:'wrap'}}>
        <div><div className="eyebrow">SHARED DUEL WINDOW</div><p className="muted" style={{fontSize:11,margin:'4px 0 0'}}>Stop after this many seconds unless somebody dies or both scripts finish first.</p></div>
        <div className="tag-row">{[3,5,10,15,20].map(seconds=><button key={seconds} type="button" className={`tag-chip ${duelDuration===seconds?'live-pill':''}`} onClick={()=>setDuelDuration(seconds)}>{seconds}s</button>)}</div>
      </div>
    </div>

    {loading&&!data?.ok&&<div className="glass card" style={{marginTop:16}}><p className="muted">Recalculating the matchup…</p></div>}
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
            {data.them.setup?.shield?<span className="tag-chip">TARGET SHIELD {data.them.setup.shield}</span>:null}
            {data.allIn?.igniteDamage?<span className="tag-chip">IGNITE +{data.allIn.igniteDamage}</span>:null}
            {data.duel&&<span className="tag-chip live-pill">DUEL · {duelLabel(data.duel.verdict)}</span>}
          </div>
        </div>
        <div className={`lab-damage ${verdict?.tone??''}`}>
          <strong>{data.allIn?.totalDamageForKillCheck??data.combo.totalMitigatedDamage}</strong>
          <span>{data.allIn?.igniteDamage?'ALL-IN DAMAGE':'DAMAGE AFTER RESISTANCES'}</span>
          <small>{data.combo.totalMitigatedDamage} combo{data.allIn?.igniteDamage?` + ${data.allIn.igniteDamage} Ignite over 5s`:''}</small>
        </div>
      </div>

      <ConfidenceBanner report={data.confidence} floorNote={!data.combo.damageComplete}/>

      {data.duel&&<DuelPanel result={data.duel} you={data.you.name} them={data.them.name}/>} 

      {data.effects&&<EffectsPanel effects={data.effects} runes={runes} summoners={summoners}/>} 

      <div className="lab-grid" style={{marginTop:16}}>
        <DerivedStats side={data.you} label="YOUR DERIVED STATS" patch={data.patch||itemPatch} runes={runes} summoners={summoners}/>
        <DerivedStats side={data.them} label="THEIR DERIVED STATS" patch={data.patch||itemPatch} runes={runes} summoners={summoners}/>
      </div>

      {data.trades&&<TradePanel report={data.trades} you={data.you.name} them={data.them.name}/>} 

      <div className="glass card" style={{marginTop:16}}>
        <div className="eyebrow">YOUR ONE-SIDED COMBO TIMELINE</div>
        <div style={{overflowX:'auto',marginTop:14}}><table className="table">
          <thead><tr><th>At</th><th>Step</th><th>Status</th><th>Damage</th><th>Target HP</th><th>Resource</th></tr></thead>
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
        {(data.notes??[]).map((note,i)=><p className="muted" key={`${note}-${i}`} style={{marginTop:10,fontSize:12}}>{note}</p>)}
      </div>
    </>}
  </AppShell>;
}

function SequenceEditor({title,sequence,onChange,detail}:{title:string;sequence:ComboStep[];onChange:(steps:ComboStep[])=>void;detail:string}){
  return <div className="glass card">
    <div className="section-row">
      <div><div className="eyebrow">{title}</div><h2 style={{margin:'6px 0 0'}}>{sequence.join(' → ')||'Nothing selected'}</h2></div>
      <button className="btn secondary" style={{minHeight:38,fontSize:11}} onClick={()=>onChange([])}>CLEAR</button>
    </div>
    <div className="tag-row" style={{marginTop:14}}>
      {STEPS.map(step=><button key={step} type="button" className="tag-chip" onClick={()=>onChange(sequence.length<24?[...sequence,step]:sequence)}>+ {step}</button>)}
      {sequence.length>0&&<button type="button" className="tag-chip clear" onClick={()=>onChange(sequence.slice(0,-1))}>Undo</button>}
    </div>
    <p className="muted" style={{fontSize:11,margin:'12px 0 0'}}>{detail} Cooldowns, resources and supported champion state are enforced event-by-event.</p>
  </div>;
}

function SideEditor({title,side,form,onChange,names,items,runes,summoners,patch,resolved}:{
  title:string;side:string;form:SideForm;onChange:(f:SideForm)=>void;names:string[];items:CatalogueItem[];
  runes:SetupRune[];summoners:SetupSummoner[];patch:string;resolved?:SideView;
}){
  const set=<K extends keyof SideForm>(key:K,value:SideForm[K])=>onChange({...form,[key]:value});
  const listId=`champions-${side}`;
  return <div className="glass card" style={{position:'relative',overflow:'visible'}}>
    <div className="eyebrow">{title}</div>
    <div className="field" style={{marginTop:12}}><label>Champion</label><input className="input" list={listId} value={form.champion} onChange={e=>set('champion',e.target.value)}/><datalist id={listId}>{names.map(n=><option key={n} value={n}/>)}</datalist></div>

    <div style={{display:'grid',gridTemplateColumns:'minmax(100px,.7fr) 1fr 1fr 1fr',gap:10,marginTop:12}}>
      <Num label="Level" value={form.level} min={1} max={18} onChange={v=>set('level',v)}/>
      <Num label="HP %" value={form.healthPercent} min={1} max={100} onChange={v=>set('healthPercent',v)}/>
      <Num label="Resource %" value={form.resourcePercent} min={0} max={100} onChange={v=>set('resourcePercent',v)}/>
      <Num label="Shield now" value={form.shield} min={0} max={10000} onChange={v=>set('shield',v)}/>
    </div>

    <ItemPicker selected={form.itemIds} onChange={ids=>set('itemIds',ids)} items={items} patch={patch}/>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:16}}>
      <SummonerPicker
        selected={form.summonerIds}
        active={form.activeSummonerIds}
        onChange={ids=>{
          set('summonerIds',ids);
          set('activeSummonerIds',form.activeSummonerIds.filter(id=>ids.includes(id)));
        }}
        onActiveChange={ids=>set('activeSummonerIds',ids)}
        summoners={summoners}
      />
      <RunePicker selected={form.runeIds} onChange={v=>set('runeIds',v)} runes={runes}/>
    </div>

    <RankEditor abilities={resolved?.abilities??[]} ranks={form.ranks} onChange={r=>set('ranks',r)}/>
    <ChampionStatePicker champion={form.champion} active={form.activeChampionEffects} onChange={v=>set('activeChampionEffects',v)}/>
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

  return <div style={{marginTop:16,position:'relative',zIndex:20}}>
    <div className="section-row"><div><div className="eyebrow">ITEM BUILD</div><p className="muted" style={{fontSize:11,margin:'4px 0 0'}}>Components, boots and completed items modify stats; supported on-hit passives also enter the damage timeline.</p></div><span className="tag-chip">{selected.length}/6</span></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(0,1fr))',gap:8,marginTop:10}}>
      {Array.from({length:6}).map((_,index)=>{
        const item=byId.get(selected[index]);
        return <button key={index} type="button" onClick={()=>item&&remove(index)} title={item?`Remove ${item.name}`:'Empty item slot'} style={{minHeight:70,border:'1px solid var(--border)',borderRadius:12,background:'rgba(255,255,255,.025)',padding:7,color:'inherit',cursor:item?'pointer':'default',overflow:'hidden'}}>
          {item?<>{imageUrl(item)?<img src={imageUrl(item)!} alt="" width={38} height={38} style={{borderRadius:8,display:'block',margin:'0 auto 4px'}}/>:<div style={{fontSize:24}}>◆</div>}<div style={{fontSize:9,lineHeight:1.15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.name}</div></>:<span className="muted" style={{fontSize:22}}>+</span>}
        </button>;
      })}
    </div>
    <div style={{position:'relative',marginTop:10,zIndex:999}}>
      <input className="input" value={query} placeholder={selected.length>=6?'Build full — remove an item to change it':'Search item… e.g. Recurve Bow, B.F. Sword, Berserker\'s Greaves'} disabled={selected.length>=6} onChange={e=>setQuery(e.target.value)}/>
      {choices.length>0&&<div style={{position:'absolute',zIndex:9999,top:'calc(100% + 6px)',left:0,right:0,maxHeight:330,overflowY:'auto',border:'1px solid var(--border)',borderRadius:12,background:'#11151c',boxShadow:'0 24px 70px rgba(0,0,0,.72)'}}>
        {choices.map(item=><button type="button" key={item.id} onClick={()=>add(item.id)} style={{display:'grid',gridTemplateColumns:'42px 1fr auto',gap:10,alignItems:'center',width:'100%',padding:'9px 11px',border:0,borderBottom:'1px solid var(--border)',background:'transparent',color:'inherit',textAlign:'left',cursor:'pointer'}}>
          {imageUrl(item)?<img src={imageUrl(item)!} alt="" width={40} height={40} style={{borderRadius:8}}/>:<div/>}
          <div><b style={{fontSize:12}}>{item.name}</b><div className="muted" style={{fontSize:10,marginTop:3}}>{statLine(item)} · {item.kind}</div></div>
          <b style={{fontSize:11}}>{item.gold}g</b>
        </button>)}
      </div>}
    </div>
  </div>;
}

function SummonerPicker({selected,active,onChange,onActiveChange,summoners}:{
  selected:string[];active:string[];onChange:(ids:string[])=>void;
  onActiveChange:(ids:string[])=>void;summoners:SetupSummoner[];
}){
  const value=(index:number)=>selected[index]??'';
  const change=(index:number,id:string)=>{
    const next=[...selected];
    if(id)next[index]=id;else next.splice(index,1);
    const clean=next.filter(Boolean).slice(0,2);
    onChange(clean);
    onActiveChange(active.filter(x=>clean.includes(x)));
  };
  const toggle=(id:string)=>onActiveChange(active.includes(id)?active.filter(x=>x!==id):[...active,id].slice(0,2));
  const byId=new Map(summoners.map(s=>[s.id,s]));
  return <div style={{padding:12,border:'1px solid var(--border)',borderRadius:14,background:'rgba(255,255,255,.02)'}}>
    <div className="section-row"><div className="eyebrow">SUMMONERS</div><span className="tag-chip">ACTIVE STATE</span></div>
    <p className="muted" style={{fontSize:10,margin:'4px 0 9px'}}>Choose what you have, then explicitly activate Barrier, Heal, Ignite or Exhaust for this fight.</p>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
      {[0,1].map(i=><select key={i} className="input" value={value(i)} onChange={e=>change(i,e.target.value)} style={{padding:'9px 8px',fontSize:11}}>
        <option value="">None</option>{summoners.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select>)}
    </div>
    <div className="tag-row" style={{marginTop:8}}>
      {selected.filter(id=>ACTIVE_SUMMONERS.has(id)).map(id=>{
        const on=active.includes(id);const spell=byId.get(id);
        return <button type="button" key={id} className={`tag-chip ${on?'live-pill':''}`} onClick={()=>toggle(id)}>{on?'✓ ACTIVE · ':'USE · '}{spell?.name??id}</button>;
      })}
      {selected.every(id=>!ACTIVE_SUMMONERS.has(id))&&<span className="muted" style={{fontSize:10}}>No selected spell has a direct deterministic combat toggle.</span>}
    </div>
  </div>;
}

function RunePicker({selected,onChange,runes}:{selected:number[];onChange:(ids:number[])=>void;runes:SetupRune[]}){
  const keystones=useMemo(()=>runes.filter(r=>r.slot===0),[runes]);
  const minor=useMemo(()=>runes.filter(r=>r.slot>0),[runes]);
  const byId=useMemo(()=>new Map(runes.map(r=>[r.id,r])),[runes]);
  const keystone=selected.find(id=>byId.get(id)?.slot===0)??0;
  const minorSelected=selected.filter(id=>byId.get(id)?.slot!==0).slice(0,5);
  const setKeystone=(id:number)=>onChange([...(id?[id]:[]),...minorSelected]);
  const setMinor=(index:number,id:number)=>{
    const next=[...minorSelected];
    if(id)next[index]=id;else next.splice(index,1);
    onChange([...(keystone?[keystone]:[]),...next.filter(Boolean).slice(0,5)]);
  };
  const supported=selected.filter(id=>MODELLED_RUNES.has(id));
  return <div style={{padding:12,border:'1px solid var(--border)',borderRadius:14,background:'rgba(255,255,255,.02)'}}>
    <div className="section-row"><div className="eyebrow">RUNES</div>{supported.length>0&&<span className="tag-chip live-pill">{supported.length} MODELED</span>}</div>
    <p className="muted" style={{fontSize:10,margin:'4px 0 9px'}}>PTA, Lethal Tempo, Cut Down, Coup de Grace and Last Stand currently alter the calculation.</p>
    <select className="input" value={keystone||''} onChange={e=>setKeystone(Number(e.target.value)||0)} style={{padding:'9px 8px',fontSize:11}}>
      <option value="">Keystone</option>{keystones.map(r=><option key={r.id} value={r.id}>{MODELLED_RUNES.has(r.id)?'✓ ':''}{r.treeName} · {r.name}</option>)}
    </select>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:7}}>
      {[0,1,2,3,4].map(i=><select key={i} className="input" value={minorSelected[i]??''} onChange={e=>setMinor(i,Number(e.target.value)||0)} style={{padding:'8px 7px',fontSize:10}}>
        <option value="">Rune {i+2}</option>{minor.map(r=><option key={r.id} value={r.id}>{MODELLED_RUNES.has(r.id)?'✓ ':''}{r.treeName} · {r.name}</option>)}
      </select>)}
    </div>
  </div>;
}

function RankEditor({abilities,ranks,onChange}:{abilities:AbilityView[];ranks:Partial<Record<AbilitySlot,number>>;onChange:(r:Partial<Record<AbilitySlot,number>>)=>void}){
  return <div style={{marginTop:14,padding:12,border:'1px solid var(--border)',borderRadius:14,background:'rgba(255,255,255,.02)'}}>
    <div className="section-row"><div><div className="eyebrow">ABILITY RANKS</div><p className="muted" style={{fontSize:10,margin:'4px 0 0'}}>These ranks directly change damage, cost, cooldown and supported champion passives.</p></div><span className="tag-chip live-pill">MODELED</span></div>
    {abilities.length?<div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8,marginTop:10}}>
      {abilities.map(a=><label key={a.slot} className="lab-input"><span>{a.slot} · {a.name}</span><select className="input" value={ranks[a.slot]??a.rank} onChange={e=>onChange({...ranks,[a.slot]:Number(e.target.value)})}>
        {Array.from({length:a.maxRank},(_,i)=>i+1).map(rank=><option key={rank} value={rank}>Rank {rank}</option>)}
      </select></label>)}
    </div>:<p className="muted" style={{fontSize:11,margin:'10px 0 0'}}>Ability ranks appear once the champion resolves.</p>}
  </div>;
}

function ChampionStatePicker({champion,active,onChange}:{champion:string;active:string[];onChange:(ids:string[])=>void}){
  const options=championEffectOptions(champion);
  if(!options.length)return null;
  return <div style={{marginTop:14,padding:12,border:'1px solid rgba(var(--accent-rgb),.28)',borderRadius:14,background:'rgba(var(--accent-rgb),.05)'}}>
    <div className="section-row"><div><div className="eyebrow">CHAMPION STATE</div><p className="muted" style={{fontSize:10,margin:'4px 0 0'}}>Toggle temporary champion effects that are already active when the simulation starts.</p></div><span className="tag-chip live-pill">CHAMPION-SPECIFIC</span></div>
    <div className="tag-row" style={{marginTop:9}}>{options.map(option=>{
      const on=active.includes(option.id);
      return <button key={option.id} type="button" className={`tag-chip ${on?'live-pill':''}`} title={option.detail} onClick={()=>onChange(on?active.filter(x=>x!==option.id):[...active,option.id])}>{on?'✓ ':''}{option.label}</button>;
    })}</div>
    {options.map(o=><p key={o.id} className="muted" style={{fontSize:10,margin:'6px 0 0'}}><b>{o.label}:</b> {o.detail}</p>)}
  </div>;
}

function EffectsPanel({effects,runes,summoners}:{effects:{you:EffectSide;them:EffectSide};runes:SetupRune[];summoners:SetupSummoner[]}){
  const runeMap=new Map(runes.map(r=>[r.id,r.name]));
  const summonerMap=new Map(summoners.map(s=>[s.id,s.name]));
  return <div className="lab-grid" style={{marginTop:16}}>
    <EffectSideCard title="YOUR MODELED EFFECTS" effect={effects.you} runeMap={runeMap} summonerMap={summonerMap}/>
    <EffectSideCard title="ENEMY MODELED EFFECTS" effect={effects.them} runeMap={runeMap} summonerMap={summonerMap}/>
  </div>;
}

function EffectSideCard({title,effect,runeMap,summonerMap}:{title:string;effect:EffectSide;runeMap:Map<number,string>;summonerMap:Map<string,string>}){
  const chips=[
    ...effect.modelledRunes.map(id=>runeMap.get(id)??`Rune ${id}`),
    ...effect.modelledSummoners.map(id=>summonerMap.get(id)??id),
    ...effect.modelledChampionEffects.map(cleanEffectName),
    ...effect.itemOnHits,
  ];
  const unsupported=[
    ...effect.unmodelledRunes.map(id=>runeMap.get(id)??`Rune ${id}`),
    ...effect.unmodelledActiveSummoners.map(id=>summonerMap.get(id)??id),
    ...effect.unmodelledChampionEffects.map(cleanEffectName),
  ];
  return <div className="glass card">
    <div className="section-row"><div className="eyebrow">{title}</div><span className="tag-chip live-pill">{chips.length} APPLIED</span></div>
    <div className="tag-row" style={{marginTop:10}}>{chips.length?chips.map((x,i)=><span key={`${x}-${i}`} className="tag-chip live-pill">✓ {x}</span>):<span className="muted" style={{fontSize:11}}>Base champion + item stats only.</span>}</div>
    {unsupported.length>0&&<p className="lab-floor">Not yet deterministic: {unsupported.join(' · ')}</p>}
    {effect.notes.slice(0,4).map((note,i)=><p key={`${note}-${i}`} className="muted" style={{fontSize:10,lineHeight:1.45,margin:'8px 0 0'}}>{note}</p>)}
  </div>;
}

function cleanEffectName(id:string){
  if(id==='KOG_Q_PASSIVE_AS')return "Kog'Maw Q passive AS";
  if(id==='KOG_W')return "Kog'Maw W active";
  return id.replaceAll('_',' ');
}

function statLine(item:CatalogueItem){
  const s=item.stats;const out:string[]=[];
  if(s.attackDamage)out.push(`+${s.attackDamage} AD`);if(s.abilityPower)out.push(`+${s.abilityPower} AP`);if(s.attackSpeedPercent)out.push(`+${s.attackSpeedPercent}% AS`);if(s.critPercent)out.push(`+${s.critPercent}% crit`);if(s.health)out.push(`+${s.health} HP`);if(s.armor)out.push(`+${s.armor} armour`);if(s.magicResist)out.push(`+${s.magicResist} MR`);if(s.mana)out.push(`+${s.mana} mana`);if(s.abilityHaste)out.push(`+${s.abilityHaste} haste`);if(s.lethality)out.push(`+${s.lethality} lethality`);if(s.moveSpeed)out.push(`+${s.moveSpeed} MS`);
  return out.slice(0,4).join(' · ')||'Combat passive / utility item';
}

function DerivedStats({side,label,patch,runes,summoners}:{side:SideView;label:string;patch:string;runes:SetupRune[];summoners:SetupSummoner[]}){
  const runeMap=new Map(runes.map(r=>[r.id,r.name]));
  const summonerMap=new Map(summoners.map(s=>[s.id,s.name]));
  return <div className="glass card"><div className="section-row"><div><div className="eyebrow">{label}</div><h2 style={{margin:'5px 0 0'}}>{side.name}</h2></div><b>{side.totalGold.toLocaleString()}g</b></div>
    <div className="pct-grid" style={{marginTop:14}}><div><span>AD</span><strong>{side.stats.attackDamage}</strong></div><div><span>AP</span><strong>{side.stats.abilityPower}</strong></div><div><span>ARMOUR</span><strong>{side.stats.armor}</strong></div><div><span>MR</span><strong>{side.stats.magicResist}</strong></div></div>
    <div className="build-summary"><span>HP <b>{side.stats.healthNow}</b> / {side.stats.health}</span><span>Resource <b>{side.stats.manaNow}</b> / {side.stats.mana}</span><span>AS <b>{side.stats.attackSpeed}</b></span><span>Range <b>{side.stats.attackRange}</b></span><span>MS <b>{side.stats.moveSpeed}</b></span>{side.setup?.shield?<span>Shield <b>{side.setup.shield}</b></span>:null}</div>
    {side.items.length>0&&<div className="tag-row" style={{marginTop:12}}>{side.items.map((item,index)=><span className="tag-chip" key={`${item.id}-${index}`}>{item.image&&patch?<img src={`https://ddragon.leagueoflegends.com/cdn/${patch}/img/item/${item.image}`} alt="" width={18} height={18} style={{borderRadius:4,verticalAlign:'middle',marginRight:5}}/>:null}{item.name}</span>)}</div>}
    {side.setup&&<div className="tag-row" style={{marginTop:8}}>
      {side.setup.summonerIds.map(id=><span className={`tag-chip ${side.setup?.activeSummonerIds.includes(id)?'live-pill':''}`} key={id}>{side.setup?.activeSummonerIds.includes(id)?'✓ ':''}{summonerMap.get(id)??id}</span>)}
      {side.setup.runeIds.slice(0,3).map(id=><span className={`tag-chip ${MODELLED_RUNES.has(id)?'live-pill':''}`} key={id}>{runeMap.get(id)??`Rune ${id}`}</span>)}
    </div>}
  </div>;
}

function Num({label,value,min,max,onChange}:{label:string;value:number;min:number;max:number;onChange:(v:number)=>void}){
  return <label className="lab-input"><span>{label}</span><input className="input" type="number" value={value} min={min} max={max} onChange={e=>{const next=Number(e.target.value);onChange(Number.isFinite(next)?Math.min(max,Math.max(min,next)):min)}}/></label>;
}

function ConfidenceBanner({report,floorNote}:{report:ConfidenceReport;floorNote:boolean}){
  return <div className={`glass card lab-confidence ${CONFIDENCE_CLASS[report.level]}`} style={{marginTop:16}}><div className="section-row"><div className="eyebrow">SIMULATION CONFIDENCE</div><span className={`conf-tag ${CONFIDENCE_CLASS[report.level]}`}>{report.level}</span></div><p style={{margin:'10px 0 0',fontSize:13,lineHeight:1.5}}>{report.summary}</p>{floorNote&&<p className="lab-floor">A damage component could not be calculated, so the displayed total is a lower bound.</p>}{report.causes.length>0&&<ul className="riot-tips">{report.causes.map(c=><li key={`${c.category}-${c.reason}`}>{c.reason}</li>)}</ul>}</div>;
}

function AbilityPanel({side,label,showMath}:{side:SideView;label:string;showMath:boolean}){
  return <div className="glass card"><div className="section-row"><div><div className="eyebrow">{label}</div><h2 style={{margin:'6px 0 0'}}>{side.name}</h2></div><span className={`conf-tag ${CONFIDENCE_CLASS[side.confidence.level]}`}>{side.confidence.level}</span></div>
    <div className="spike-list" style={{marginTop:14}}>{side.abilities.map(a=><div className="spike" key={a.slot}><div className="spike-level">{a.slot}</div><div><b>{a.name} <span className="muted">rank {a.rank}/{a.maxRank}</span></b><p className="spike-fact">{a.damage[0]?.raw!==null&&a.damage[0]?.raw!==undefined?`${a.damage[0].raw} ${a.damage[0].type.toLowerCase()} damage`:'No direct damage figure'} · {a.cooldownSeconds}s · {a.cost>0?`${a.cost} resource`:'no cost'}{a.rangeUnits?` · ${a.rangeUnits} range`:''}</p>{a.confidence.level!=='HIGH'&&<p className={`conf-inline ${CONFIDENCE_CLASS[a.confidence.level]}`}>{a.confidence.level}: {a.confidence.causes[0]?.reason}</p>}{showMath&&a.calculations.length>0&&<table className="table skill-grid" style={{marginTop:8}}><tbody>{a.calculations.map(c=><tr key={c.name}><td style={{textAlign:'left'}}>{c.primary?'▸ ':''}{c.name}</td><td>{c.value??'—'}</td><td style={{textAlign:'left',color:'var(--muted)',fontSize:10}}>{c.unmodelled[0]??''}</td></tr>)}</tbody></table>}</div></div>)}</div>
  </div>;
}

function duelLabel(verdict:DuelResult['verdict']){
  if(verdict==='YOU_KILL')return 'YOU WIN';
  if(verdict==='THEM_KILL')return 'THEY WIN';
  if(verdict==='DOUBLE_KO')return 'DOUBLE KO';
  if(verdict==='YOU_AHEAD')return 'YOU AHEAD';
  if(verdict==='THEM_AHEAD')return 'THEY AHEAD';
  return 'EVEN';
}

const statusLabel=(status:string)=>status==='NO_RESOURCE'?'no resource':status==='ON_COOLDOWN'?'on cooldown':status==='NOT_LEARNED'?'no rank':status.toLowerCase();