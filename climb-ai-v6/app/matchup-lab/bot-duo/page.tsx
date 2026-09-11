'use client';
import {useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {BotLaneLevelMap} from '@/components/BotLaneLevelMap';
import {championEffectOptions} from '@/lib/combat/championEffects';
import {maxRankAtLevel} from '@/lib/combat/skillRanks';

type Step='AA'|'Q'|'W'|'E'|'R';
type AbilitySlot='Q'|'W'|'E'|'R';
type SideKey='YOU_ADC'|'YOU_SUPPORT'|'THEM_ADC'|'THEM_SUPPORT';
type AccessMode='FULL'|'NO_AUTOS';
interface CatalogueItem{id:number;name:string;gold:number;image:string|null;kind:string}
interface SetupRune{id:number;name:string;icon:string;treeId:number;treeName:string;slot:number}
interface SetupSummoner{id:string;key:number;name:string;description:string;image:string|null;cooldown:number|null}
interface LaneForm{
  champion:string;level:number;itemIds:number[];healthPercent:number;resourcePercent:number;sequence:Step[];
  runeIds:number[];summonerIds:string[];activeSummonerIds:string[];activeChampionEffects:string[];
  ranks:Partial<Record<AbilitySlot,number>>;shield:number;accessMode:AccessMode;targetDistance?:number;missedAbilities:AbilitySlot[];
}
interface ParticipantSnapshot{key:SideKey;champion:string;team:'YOU'|'THEM';role:'ADC'|'SUPPORT';health:number;maxHealth:number;shield:number;mana:number;alive:boolean;damageDealt:number;damageTaken:number;healingDone:number;shieldingDone:number;controlledUntil:number}
interface ActionEvent{actor:SideKey;champion:string;step:Step;target:SideKey|null;targetChampion:string|null;status:string;damageApplied:number;healApplied:number;shieldGranted:number;controlSeconds:number;note?:string}
interface Frame{atSeconds:number;actions:ActionEvent[];participants:Record<SideKey,ParticipantSnapshot>}
interface Kill{atSeconds:number;victim:SideKey;champion:string;team:'YOU'|'THEM';by:SideKey[]}
interface BotResult{verdict:string;winner:'YOU'|'THEM'|null;durationSeconds:number;timeline:Frame[];kills:Kill[];participants:Record<SideKey,ParticipantSnapshot>;teamDamage:{YOU:number;THEM:number};firstKill:Kill|null;incomplete:boolean;modelNote:string}
interface FocusComparison{recommendedTarget:SideKey;recommendedRole:'ADC'|'SUPPORT';reason:string}
interface LanePlan{call:'SAFE'|'FARM'|'POKE'|'SHORT_TRADE'|'EXTENDED_TRADE'|'ALL_IN';headline:string;reason:string;target:'ADC'|'SUPPORT';targetChampion:string;rangeDelta:number;rangeLabel:'YOU'|'THEM'|'EVEN';rules:string[];rerunTriggers:string[]}
interface ApiResponse{ok:boolean;error?:string;patch?:string;confidence?:string;result?:BotResult;focusComparison?:FocusComparison;lanePlan?:LanePlan;coverage?:{partial:string[];notes:string[]}}

const STEPS:Step[]=['Q','W','E','R','AA'];
const SPELLS:AbilitySlot[]=['Q','W','E','R'];
const MODELLED_RUNES=new Set([8005,8008,8014,8017,8299]);
const ACTIVE_SUMMONERS=new Set(['SummonerBarrier','SummonerHeal','SummonerDot','SummonerExhaust']);
const blank=(champion:string):LaneForm=>({
  champion,level:6,itemIds:[],healthPercent:100,resourcePercent:100,sequence:['Q','AA','W','AA','E','R'],
  runeIds:[],summonerIds:['SummonerFlash'],activeSummonerIds:[],activeChampionEffects:[],ranks:{},
  shield:0,accessMode:'FULL',missedAbilities:[],
});

export default function BotDuoLab(){
  const [yourAdc,setYourAdc]=useState<LaneForm>(blank("Kog'Maw"));
  const [yourSupport,setYourSupport]=useState<LaneForm>(blank('Lulu'));
  const [enemyAdc,setEnemyAdc]=useState<LaneForm>(blank('Caitlyn'));
  const [enemySupport,setEnemySupport]=useState<LaneForm>(blank('Lux'));
  const [yourFocus,setYourFocus]=useState<'THEM_ADC'|'THEM_SUPPORT'>('THEM_ADC');
  const [enemyFocus,setEnemyFocus]=useState<'YOU_ADC'|'YOU_SUPPORT'>('YOU_ADC');
  const [yourProtect,setYourProtect]=useState<'YOU_ADC'|'YOU_SUPPORT'>('YOU_ADC');
  const [enemyProtect,setEnemyProtect]=useState<'THEM_ADC'|'THEM_SUPPORT'>('THEM_ADC');
  const [duration,setDuration]=useState(10);
  const [names,setNames]=useState<string[]>([]);
  const [items,setItems]=useState<CatalogueItem[]>([]);
  const [runes,setRunes]=useState<SetupRune[]>([]);
  const [summoners,setSummoners]=useState<SetupSummoner[]>([]);
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
    fetch('/api/matchup/setup').then(r=>r.json()).then((d:unknown)=>{
      const value=d as {runes?:unknown;summoners?:unknown;patch?:unknown};
      if(Array.isArray(value.runes))setRunes(value.runes as SetupRune[]);
      if(Array.isArray(value.summoners))setSummoners(value.summoners as SetupSummoner[]);
      if(typeof value.patch==='string')setPatch(current=>current||value.patch as string);
    }).catch(()=>{});
  },[]);

  const simulate=useCallback(()=>{
    const id=++request.current;setLoading(true);
    fetch('/api/matchup/botlane',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({yourAdc,yourSupport,enemyAdc,enemySupport,yourFocus,enemyFocus,yourProtect,enemyProtect,durationSeconds:duration}),
    }).then(r=>r.json()).then((d:ApiResponse)=>{
      if(id!==request.current)return;
      setData(d);if(typeof d.patch==='string')setPatch(d.patch);
    }).catch(()=>{if(id===request.current)setData({ok:false,error:'Could not reach the bot-lane simulator.'})})
      .finally(()=>{if(id===request.current)setLoading(false)});
  },[yourAdc,yourSupport,enemyAdc,enemySupport,yourFocus,enemyFocus,yourProtect,enemyProtect,duration]);

  useEffect(()=>{const timer=setTimeout(simulate,400);return()=>clearTimeout(timer)},[simulate]);
  const result=data?.result;
  const accessNotes=(data?.coverage?.notes??[]).filter(note=>
    /target distance|basic attack:|outside the published|inside the published|held static/i.test(note),
  ).slice(0,12);

  return <AppShell>
    <PageHead title="Bot Duo Lab" subtitle="Four champions. One shared clock. Configure the real lane state, choose what lands, then see who wins and how to play it."/>

    <div className="glass card" style={{padding:16,marginBottom:16}}>
      <div className="section-row" style={{gap:12,flexWrap:'wrap'}}>
        <div>
          <div className="eyebrow">BOT DUO · DETERMINISTIC 2V2</div>
          <b style={{fontSize:15}}>ADC + Support vs ADC + Support</b>
          <p className="muted" style={{fontSize:11,margin:'5px 0 0'}}>Items, ranks, runes, summoners, champion states, support targeting, explicit distance and HIT/MISS assumptions feed the same four-champion timeline.</p>
        </div>
        <div className="tag-row"><span className="tag-chip">PATCH {patch||'…'}</span><Link className="tag-chip" href="/matchup-lab">SOLO LAB →</Link></div>
      </div>
    </div>

    <div className="lab-grid" style={{position:'relative',zIndex:100,overflow:'visible'}}>
      <TeamCard title="YOUR BOT LANE">
        <DuoEditor label="ADC" sideId="your-adc" form={yourAdc} onChange={setYourAdc} names={names} items={items} runes={runes} summoners={summoners} patch={patch}/>
        <DuoEditor label="SUPPORT" sideId="your-support" form={yourSupport} onChange={setYourSupport} names={names} items={items} runes={runes} summoners={summoners} patch={patch}/>
      </TeamCard>
      <TeamCard title="ENEMY BOT LANE">
        <DuoEditor label="ADC" sideId="enemy-adc" form={enemyAdc} onChange={setEnemyAdc} names={names} items={items} runes={runes} summoners={summoners} patch={patch}/>
        <DuoEditor label="SUPPORT" sideId="enemy-support" form={enemySupport} onChange={setEnemySupport} names={names} items={items} runes={runes} summoners={summoners} patch={patch}/>
      </TeamCard>
    </div>

    <div className="glass card" style={{marginTop:16,padding:16,position:'relative',zIndex:1}}>
      <div className="section-row" style={{gap:14,flexWrap:'wrap'}}>
        <div><div className="eyebrow">TARGET + PEEL PLAN</div><h2 style={{margin:'5px 0 0'}}>Who gets hit — and who gets protected?</h2></div>
        <span className="tag-chip">{data?.confidence??'CALCULATING'}</span>
      </div>
      <div className="lab-grid" style={{marginTop:14}}>
        <FocusPicker label="YOUR TEAM FOCUSES" value={yourFocus} options={[{id:'THEM_ADC',label:'ENEMY ADC'},{id:'THEM_SUPPORT',label:'ENEMY SUPPORT'}]} onChange={v=>setYourFocus(v as 'THEM_ADC'|'THEM_SUPPORT')}/>
        <FocusPicker label="ENEMY TEAM FOCUSES" value={enemyFocus} options={[{id:'YOU_ADC',label:'YOUR ADC'},{id:'YOU_SUPPORT',label:'YOUR SUPPORT'}]} onChange={v=>setEnemyFocus(v as 'YOU_ADC'|'YOU_SUPPORT')}/>
        <FocusPicker label="YOUR SUPPORT PROTECTS" value={yourProtect} options={[{id:'YOU_ADC',label:'YOUR ADC'},{id:'YOU_SUPPORT',label:'THEMSELF'}]} onChange={v=>setYourProtect(v as 'YOU_ADC'|'YOU_SUPPORT')}/>
        <FocusPicker label="ENEMY SUPPORT PROTECTS" value={enemyProtect} options={[{id:'THEM_ADC',label:'ENEMY ADC'},{id:'THEM_SUPPORT',label:'THEMSELF'}]} onChange={v=>setEnemyProtect(v as 'THEM_ADC'|'THEM_SUPPORT')}/>
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

      {data.lanePlan&&<LaneCoachCard plan={data.lanePlan}/>} 

      {accessNotes.length>0&&<div className="glass card" style={{marginTop:16,padding:16}}>
        <div className="section-row"><div><div className="eyebrow">STATIC ACCESS MODEL</div><h2 style={{margin:'5px 0'}}>What can actually reach from this distance?</h2></div><span className="tag-chip">NO MOVEMENT GUESSED</span></div>
        <div className="tag-row" style={{marginTop:10}}>{accessNotes.map((note,index)=><span className="tag-chip" key={`${note}-${index}`}>{note}</span>)}</div>
      </div>}

      <BotLaneLevelMap
        yourAdc={yourAdc} yourSupport={yourSupport} enemyAdc={enemyAdc} enemySupport={enemySupport}
        yourFocus={yourFocus} enemyFocus={enemyFocus} yourProtect={yourProtect} enemyProtect={enemyProtect}
        durationSeconds={duration}
      />

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

function DuoEditor({label,sideId,form,onChange,names,items,runes,summoners,patch}:{
  label:string;sideId:string;form:LaneForm;onChange:(value:LaneForm)=>void;names:string[];items:CatalogueItem[];
  runes:SetupRune[];summoners:SetupSummoner[];patch:string;
}){
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

    <details style={{marginTop:10}}>
      <summary style={{cursor:'pointer',fontSize:11,fontWeight:800,letterSpacing:'.06em'}}>FULL FIGHT SETUP</summary>
      <div style={{display:'grid',gap:10,marginTop:10}}>
        <RankMini level={form.level} ranks={form.ranks} onChange={value=>set('ranks',value)}/>
        <RuneMini selected={form.runeIds} onChange={value=>set('runeIds',value)} runes={runes}/>
        <SummonerMini selected={form.summonerIds} active={form.activeSummonerIds} onChange={value=>set('summonerIds',value)} onActive={value=>set('activeSummonerIds',value)} summoners={summoners}/>
        <ChampionStateMini champion={form.champion} active={form.activeChampionEffects} onChange={value=>set('activeChampionEffects',value)}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <AccessPicker value={form.accessMode} distance={form.targetDistance} onChange={value=>set('accessMode',value)} onDistance={value=>set('targetDistance',value)}/>
          <Num label="Shield now" value={form.shield} min={0} max={10000} onChange={value=>set('shield',value)}/>
        </div>
        <HitPicker missed={form.missedAbilities} onChange={value=>set('missedAbilities',value)}/>
      </div>
    </details>
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

function RankMini({level,ranks,onChange}:{level:number;ranks:Partial<Record<AbilitySlot,number>>;onChange:(value:Partial<Record<AbilitySlot,number>>)=>void}){
  return <div style={{padding:10,border:'1px solid var(--border)',borderRadius:12}}><div className="eyebrow">ABILITY RANKS</div><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginTop:7}}>{SPELLS.map(slot=>{
    const cap=maxRankAtLevel(slot,level);
    return <label className="lab-input" key={slot}><span>{slot}</span><select className="input" value={ranks[slot]??''} onChange={e=>{const value=e.target.value;const next={...ranks};if(value==='')delete next[slot];else next[slot]=Number(value);onChange(next)}}><option value="">AUTO</option>{Array.from({length:cap+1},(_,i)=>i).map(rank=><option key={rank} value={rank}>{rank}</option>)}</select></label>;
  })}</div></div>;
}

function RuneMini({selected,onChange,runes}:{selected:number[];onChange:(value:number[])=>void;runes:SetupRune[]}){
  const keystones=useMemo(()=>runes.filter(r=>r.slot===0),[runes]);
  const minors=useMemo(()=>runes.filter(r=>r.slot>0),[runes]);
  const byId=useMemo(()=>new Map(runes.map(r=>[r.id,r])),[runes]);
  const key=selected.find(id=>byId.get(id)?.slot===0)??0;
  const rest=selected.filter(id=>byId.get(id)?.slot!==0).slice(0,5);
  const setKey=(id:number)=>onChange([...(id?[id]:[]),...rest]);
  const setMinor=(index:number,id:number)=>{const next=[...rest];if(id)next[index]=id;else next.splice(index,1);onChange([...(key?[key]:[]),...next.filter(Boolean).slice(0,5)])};
  return <div style={{padding:10,border:'1px solid var(--border)',borderRadius:12}}><div className="section-row"><div className="eyebrow">RUNES</div><span className="tag-chip">{selected.filter(id=>MODELLED_RUNES.has(id)).length} MODELED</span></div>
    <select className="input" value={key||''} onChange={e=>setKey(Number(e.target.value)||0)} style={{marginTop:7}}><option value="">Keystone</option>{keystones.map(r=><option key={r.id} value={r.id}>{MODELLED_RUNES.has(r.id)?'✓ ':''}{r.treeName} · {r.name}</option>)}</select>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginTop:6}}>{[0,1,2,3,4].map(i=><select key={i} className="input" value={rest[i]??''} onChange={e=>setMinor(i,Number(e.target.value)||0)}><option value="">Rune {i+2}</option>{minors.map(r=><option key={r.id} value={r.id}>{MODELLED_RUNES.has(r.id)?'✓ ':''}{r.name}</option>)}</select>)}</div>
  </div>;
}

function SummonerMini({selected,active,onChange,onActive,summoners}:{selected:string[];active:string[];onChange:(value:string[])=>void;onActive:(value:string[])=>void;summoners:SetupSummoner[]}){
  const value=(index:number)=>selected[index]??'';
  const change=(index:number,id:string)=>{const next=[...selected];if(id)next[index]=id;else next.splice(index,1);const clean=next.filter(Boolean).slice(0,2);onChange(clean);onActive(active.filter(x=>clean.includes(x)))};
  const byId=new Map(summoners.map(s=>[s.id,s]));
  return <div style={{padding:10,border:'1px solid var(--border)',borderRadius:12}}><div className="eyebrow">SUMMONERS</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:7}}>{[0,1].map(i=><select key={i} className="input" value={value(i)} onChange={e=>change(i,e.target.value)}><option value="">None</option>{summoners.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>)}</div>
    <div className="tag-row" style={{marginTop:7}}>{selected.filter(id=>ACTIVE_SUMMONERS.has(id)).map(id=>{const on=active.includes(id);return <button type="button" key={id} className={`tag-chip ${on?'live-pill':''}`} onClick={()=>onActive(on?active.filter(x=>x!==id):[...active,id].slice(0,2))}>{on?'✓ ACTIVE · ':'USE · '}{byId.get(id)?.name??id}</button>})}</div>
  </div>;
}

function ChampionStateMini({champion,active,onChange}:{champion:string;active:string[];onChange:(value:string[])=>void}){
  const options=championEffectOptions(champion);
  if(!options.length)return null;
  const toggle=(id:string,group?:string)=>{
    if(active.includes(id)){onChange(active.filter(x=>x!==id));return}
    const blocked=group?new Set(options.filter(o=>o.group===group).map(o=>o.id)):new Set<string>();
    onChange([...active.filter(x=>!blocked.has(x)),id]);
  };
  return <div style={{padding:10,border:'1px solid rgba(var(--accent-rgb),.28)',borderRadius:12,background:'rgba(var(--accent-rgb),.04)'}}><div className="eyebrow">CHAMPION STATE</div><div className="tag-row" style={{marginTop:7}}>{options.map(option=><button type="button" key={option.id} title={option.detail} className={`tag-chip ${active.includes(option.id)?'live-pill':''}`} onClick={()=>toggle(option.id,option.group)}>{active.includes(option.id)?'✓ ':''}{option.label}</button>)}</div></div>;
}

function AccessPicker({value,distance,onChange,onDistance}:{value:AccessMode;distance?:number;onChange:(value:AccessMode)=>void;onDistance:(value:number|undefined)=>void}){
  const setDistance=(raw:string)=>{
    if(raw.trim()===''){onDistance(undefined);return}
    const next=Number(raw);if(Number.isFinite(next))onDistance(Math.max(0,Math.min(5000,next)));
  };
  return <div style={{padding:10,border:'1px solid var(--border)',borderRadius:12}}>
    <div className="eyebrow">RANGE / ACCESS</div>
    <div className="tag-row" style={{marginTop:7}}><button type="button" className={`tag-chip ${value==='FULL'?'live-pill':''}`} onClick={()=>onChange('FULL')}>FULL ACCESS</button><button type="button" className={`tag-chip ${value==='NO_AUTOS'?'live-pill':''}`} onClick={()=>onChange('NO_AUTOS')}>NO AUTO ACCESS</button></div>
    <label className="lab-input" style={{display:'block',marginTop:8}}><span>Target distance (units)</span><input className="input" type="number" min={0} max={5000} placeholder="Not set" value={distance??''} onChange={e=>setDistance(e.target.value)}/></label>
    <div className="tag-row" style={{marginTop:6}}>{[150,300,425,550,650].map(value=><button type="button" key={value} className={`tag-chip ${distance===value?'live-pill':''}`} onClick={()=>onDistance(value)}>{value}u</button>)}{distance!==undefined&&<button type="button" className="tag-chip" onClick={()=>onDistance(undefined)}>CLEAR</button>}</div>
    <p className="muted" style={{fontSize:9,margin:'6px 0 0'}}>When distance is set, CLIMB checks current attack range and published spell ranges. It does not walk champions forward, add hitbox padding or invent hit probability.</p>
  </div>;
}

function HitPicker({missed,onChange}:{missed:AbilitySlot[];onChange:(value:AbilitySlot[])=>void}){
  return <div style={{padding:10,border:'1px solid var(--border)',borderRadius:12}}><div className="section-row"><div><div className="eyebrow">ABILITY HIT ASSUMPTION</div><p className="muted" style={{fontSize:9,margin:'3px 0 0'}}>No hit percentage is invented. Tell CLIMB whether each spell connects in this scenario.</p></div><span className="tag-chip">EXPLICIT</span></div><div className="tag-row" style={{marginTop:7}}>{SPELLS.map(slot=>{const miss=missed.includes(slot);return <button type="button" key={slot} className={`tag-chip ${miss?'':'live-pill'}`} onClick={()=>onChange(miss?missed.filter(x=>x!==slot):[...missed,slot])}>{slot} · {miss?'MISS':'HIT'}</button>})}</div></div>;
}

function FocusPicker({label,value,options,onChange}:{label:string;value:string;options:{id:string;label:string}[];onChange:(value:string)=>void}){
  return <div style={{padding:12,border:'1px solid var(--border)',borderRadius:14}}><div className="eyebrow">{label}</div><div className="tag-row" style={{marginTop:8}}>{options.map(option=><button type="button" key={option.id} className={`tag-chip ${value===option.id?'live-pill':''}`} onClick={()=>onChange(option.id)}>{value===option.id?'✓ ':''}{option.label}</button>)}</div></div>;
}

function LaneCoachCard({plan}:{plan:LanePlan}){
  return <div className="glass card" style={{marginTop:16,padding:16,border:'1px solid rgba(var(--accent-rgb),.34)'}}>
    <div className="section-row" style={{gap:12,flexWrap:'wrap'}}><div><div className="eyebrow">HOW TO PLAY THIS SETUP</div><h2 style={{margin:'5px 0'}}>{plan.headline}</h2><p className="muted" style={{fontSize:12,margin:0,lineHeight:1.5}}>{plan.reason}</p></div><span className="tag-chip live-pill">{plan.call.replaceAll('_',' ')}</span></div>
    <div className="lab-grid" style={{marginTop:12}}><div style={{padding:12,border:'1px solid var(--border)',borderRadius:12}}><div className="eyebrow">PLAY RULES</div>{plan.rules.map((rule,index)=><p key={index} style={{fontSize:11,lineHeight:1.45,margin:'7px 0 0'}}><b>{index+1}.</b> {rule}</p>)}</div><div style={{padding:12,border:'1px solid var(--border)',borderRadius:12}}><div className="eyebrow">WHAT CAN FLIP IT?</div>{plan.rerunTriggers.map((rule,index)=><p key={index} className="muted" style={{fontSize:10,lineHeight:1.45,margin:'7px 0 0'}}>{rule}</p>)}</div></div>
    <div className="tag-row" style={{marginTop:10}}><span className="tag-chip">ADC RANGE {plan.rangeLabel==='YOU'?`YOU +${Math.abs(plan.rangeDelta)}`:plan.rangeLabel==='THEM'?`THEM +${Math.abs(plan.rangeDelta)}`:'EVEN'}</span><span className="tag-chip">PRIMARY TARGET · {plan.targetChampion}</span></div>
  </div>;
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