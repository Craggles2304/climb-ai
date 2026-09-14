'use client';
import Image from 'next/image';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {TftShell} from '@/components/TftShell';
import {TFT_CARRY_PROFILES,TFT_META_AS_OF,TFT_META_PATCH,TFT_META_SET,buildCarryShell,metaStrengthScore,type TftCarryItemBuild,type TftCarryProfile,type TftStaticChampion} from '@/lib/tft/carryBuilder';

type StaticEntry={id:string;name:string;tier:number|string|null;description:string;image:string|null;traits?:string[];stats?:{hp?:number;armor?:number;magicResist?:number;attackDamage?:number;attackSpeed?:number;range?:number}|null};
type StaticData={version:string;source:string;champions:StaticEntry[];items:StaticEntry[];augments:StaticEntry[];traits:StaticEntry[]};

const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const buildKindLabel=(kind:TftCarryItemBuild['kind'])=>kind==='META'?'META BEST':kind==='ALTERNATIVE'?'STRONG ALT':'FUN / HIGH-ROLL';
const buildKindClass=(kind:TftCarryItemBuild['kind'])=>kind==='META'?'op-tier-pro':kind==='ALTERNATIVE'?'op-tier-plus':'op-tier-free';

function scoreLabel(profile:TftCarryProfile){const score=metaStrengthScore(profile);return score>=105?'ELITE':score>=95?'STRONG':score>=85?'PLAYABLE':'SPECIALIST';}

export default function TftCarryBuilder(){
  const router=useRouter();
  const [data,setData]=useState<StaticData|null>(null);
  const [selectedName,setSelectedName]=useState('Ashe');
  const [selectedBuildId,setSelectedBuildId]=useState('ashe-cast');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<'ALL'|'S'|'A'|'B'>('ALL');
  const [teamSize,setTeamSize]=useState(8);
  const [status,setStatus]=useState('');

  useEffect(()=>{
    void fetch('/api/tft/static').then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error||'Static data failed.');setData(body)}).catch(err=>setStatus(err instanceof Error?err.message:'Static data failed.'));
  },[]);

  useEffect(()=>{
    try{
      const raw=localStorage.getItem('op_tft_carry_builder_pick');
      if(!raw)return;
      const pick=JSON.parse(raw) as {champion?:string;buildId?:string};
      const next=TFT_CARRY_PROFILES.find(p=>p.champion===pick.champion);
      if(next){
        setSelectedName(next.champion);
        const build=next.builds.find(b=>b.id===pick.buildId)||next.builds[0];
        setSelectedBuildId(build.id);
        setFilter('ALL');
        setQuery('');
        setStatus(`${next.champion} · ${build.label} loaded from Item Finder.`);
      }
      localStorage.removeItem('op_tft_carry_builder_pick');
    }catch{}
  },[]);

  const profiles=useMemo(()=>TFT_CARRY_PROFILES.filter(p=>{
    const matchesFilter=filter==='ALL'||p.tier===filter;
    const q=query.trim().toLowerCase();
    return matchesFilter&&(!q||`${p.champion} ${p.headline} ${p.whyBuildAround}`.toLowerCase().includes(q));
  }).sort((a,b)=>metaStrengthScore(b)-metaStrengthScore(a)),[filter,query]);
  const profile=TFT_CARRY_PROFILES.find(p=>p.champion===selectedName)||TFT_CARRY_PROFILES[0];
  const selectedBuild=profile.builds.find(b=>b.id===selectedBuildId)||profile.builds[0];
  const champions=(data?.champions||[]) as TftStaticChampion[];
  const shell=useMemo(()=>buildCarryShell(profile,champions,teamSize),[profile,champions,teamSize]);
  const champByName=useMemo(()=>new Map((data?.champions||[]).map(c=>[norm(c.name),c])),[data]);
  const itemByName=useMemo(()=>new Map((data?.items||[]).map(i=>[norm(i.name),i])),[data]);

  const chooseProfile=(next:TftCarryProfile)=>{
    setSelectedName(next.champion);
    setSelectedBuildId(next.builds[0].id);
    setStatus('');
  };

  const saveToBoardLab=()=>{
    if(!shell.carry||shell.units.length<2){setStatus('Current Riot static data does not contain enough units to build this shell.');return;}
    const boardUnits=shell.units.map((entry,index)=>{
      const champ=entry.champion;
      const isCarry=norm(champ.name)===norm(profile.champion);
      const backline=isCarry&&(profile.style==='BACKLINE_CARRY');
      const row=backline?3:entry.role==='FRONTLINE'?0:entry.role==='SECONDARY DAMAGE'?3:index%2?2:1;
      const col=index%7;
      const role=entry.role==='FRONTLINE'?'FRONTLINE':isCarry?'CARRY':entry.role==='UTILITY'?'SUPPORT':'FLEX';
      return{
        id:`carry-builder-${champ.id}-${Date.now()}-${index}`,
        championId:champ.id,
        name:champ.name,
        cost:Number(champ.tier)||1,
        star:1,
        role,
        items:isCarry?[...selectedBuild.items]:[],
        traits:champ.traits||[],
        stats:champ.stats||undefined,
        row,col
      };
    });
    const payload={units:boardUnits,stage:'4-2',level:Math.max(teamSize,7),hp:50,gold:40,unusedComponents:0,completedItemsBench:0,augments:['','','']};
    try{localStorage.setItem('op_tft_board_lab_v1',JSON.stringify(payload));setStatus(`${profile.champion} shell loaded into Board Lab with ${selectedBuild.label}.`);router.push('/tft/board-lab');}catch{setStatus('Could not save the shell in this browser.');}
  };

  return <TftShell><main className="container section">
    <div className="eyebrow">PATCH-AWARE META STARTING POINTS · STATIC PREP</div>
    <h1>TFT CARRY BUILDER</h1>
    <p className="muted" style={{maxWidth:940}}>Start with the champion you want to play around. OP CLIMB separates current standard-item meta cores from strong alternatives and fun/high-roll lines, then builds a trait-aware support shell from the current Riot static set data.</p>

    <section className="glass card" style={{marginTop:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        <div><div className="eyebrow">CURRENT META SNAPSHOT</div><h2 style={{margin:'3px 0'}}>SET {TFT_META_SET} · PATCH {TFT_META_PATCH}</h2><p className="muted" style={{margin:0}}>Snapshot date {TFT_META_AS_OF} · current Riot static feed {data?.version||'loading…'}</p></div>
        <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{(['ALL','S','A','B'] as const).map(x=><button key={x} className={`btn ${filter===x?'primary':'secondary'}`} onClick={()=>setFilter(x)}>{x==='ALL'?'ALL CORES':`${x} TIER`}</button>)}</div>
      </div>
      <input style={{marginTop:12}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search champion, archetype or reason…"/>
    </section>

    {status&&<div className="glass card" style={{marginTop:12,padding:12}}><b>{status}</b></div>}

    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:10,marginTop:14}}>
      {profiles.map(p=>{
        const champ=champByName.get(norm(p.champion));const active=p.champion===profile.champion;
        return <button key={p.champion} type="button" onClick={()=>chooseProfile(p)} style={{textAlign:'left',padding:14,borderRadius:16,border:active?'2px solid currentColor':'1px solid rgba(255,255,255,.09)',background:active?'rgba(255,255,255,.085)':'rgba(255,255,255,.035)',cursor:'pointer'}}>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>{champ?.image?<Image src={champ.image} alt="" width={48} height={48} style={{borderRadius:11,objectFit:'cover'}}/>:<div style={{width:48,height:48,borderRadius:11,background:'rgba(255,255,255,.05)'}}/>}<div><div className="eyebrow">{p.tier} TIER · {scoreLabel(p)}</div><h3 style={{margin:'2px 0'}}>{p.champion}</h3></div></div>
          <p className="muted" style={{fontSize:11,minHeight:34}}>{p.headline}</p>
          <div className="cue-row"><span>AVG PLACE</span><b>{p.avgPlace.toFixed(2)}</b></div><div className="cue-row"><span>TOP 4</span><b>{p.top4}%</b></div><div className="cue-row"><span>WIN</span><b>{p.win}%</b></div>
        </button>;
      })}
    </section>

    <section style={{display:'grid',gridTemplateColumns:'minmax(280px,.72fr) minmax(0,1.28fr)',gap:16,marginTop:16}}>
      <div className="glass card">
        <div className="eyebrow">SELECTED CORE</div>
        <div style={{display:'flex',gap:12,alignItems:'center',marginTop:8}}>{champByName.get(norm(profile.champion))?.image?<Image src={champByName.get(norm(profile.champion))!.image!} alt="" width={72} height={72} style={{borderRadius:16,objectFit:'cover'}}/>:null}<div><span className={`op-tier ${profile.tier==='S'?'op-tier-pro':profile.tier==='A'?'op-tier-plus':'op-tier-free'}`}>{profile.tier} TIER</span><h1 style={{margin:'5px 0'}}>{profile.champion}</h1><b>{profile.headline}</b></div></div>
        <p className="muted">{profile.whyBuildAround}</p>
        <div className="cue-row"><span>SAMPLE</span><b>{profile.sampleLabel}</b></div><div className="cue-row"><span>AVG PLACE</span><b>{profile.avgPlace.toFixed(2)}</b></div><div className="cue-row"><span>TOP 4</span><b>{profile.top4}%</b></div><div className="cue-row"><span>WIN</span><b>{profile.win}%</b></div>
        <a href={profile.sourceUrl} target="_blank" rel="noreferrer" className="btn secondary" style={{display:'block',textAlign:'center',marginTop:14}}>VIEW SOURCE DATA</a>
      </div>

      <div className="glass card">
        <div className="eyebrow">ITEM PACKAGES</div><h2>WHAT DO YOU ACTUALLY PUT ON {profile.champion.toUpperCase()}?</h2>
        <div style={{display:'grid',gap:10}}>{profile.builds.map(build=>{
          const active=build.id===selectedBuild.id;
          return <button key={build.id} type="button" onClick={()=>setSelectedBuildId(build.id)} style={{textAlign:'left',padding:13,borderRadius:14,border:active?'2px solid currentColor':'1px solid rgba(255,255,255,.09)',background:active?'rgba(255,255,255,.08)':'rgba(255,255,255,.025)',cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',flexWrap:'wrap'}}><b>{build.label}</b><span className={`op-tier ${buildKindClass(build.kind)}`}>{buildKindLabel(build.kind)}</span></div>
            <div style={{display:'flex',gap:8,marginTop:9,flexWrap:'wrap'}}>{build.items.map((item,i)=>{const info=itemByName.get(norm(item));return <span key={`${build.id}-${item}-${i}`} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 9px',borderRadius:10,background:'rgba(255,255,255,.05)'}}>{info?.image?<Image src={info.image} alt="" width={28} height={28} style={{borderRadius:7}}/>:null}<b style={{fontSize:11}}>{item}</b></span>})}</div>
            <p className="muted" style={{fontSize:11,marginBottom:0}}>{build.note}</p>
            {build.avgPlace&&<div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:8,fontSize:10}}><span>Avg <b>{build.avgPlace.toFixed(2)}</b></span>{build.top4&&<span>Top 4 <b>{build.top4}%</b></span>}{build.win&&<span>Win <b>{build.win}%</b></span>}</div>}
          </button>;
        })}</div>
      </div>
    </section>

    <section className="glass card" style={{marginTop:16}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'end',flexWrap:'wrap'}}><div><div className="eyebrow">AUTO TEAM SHELL</div><h2>BUILD THE BOARD AROUND {profile.champion.toUpperCase()}</h2><p className="muted" style={{margin:0,maxWidth:760}}>Trait overlap matters, but the engine also forces structural support so a backline carry is not surrounded by seven fragile units. Treat this as a starting shell, then refine it in Board Lab and Board Compare.</p></div><label style={{minWidth:140}}><span className="eyebrow">TEAM SIZE</span><select value={teamSize} onChange={e=>setTeamSize(Number(e.target.value))}>{[6,7,8,9,10].map(n=><option key={n} value={n}>{n} units</option>)}</select></label></div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:9,marginTop:14}}>{shell.units.map((unit,index)=>{
        const champ=unit.champion;const carry=index===0;
        return <div key={champ.id} style={{padding:11,borderRadius:13,border:carry?'2px solid currentColor':'1px solid rgba(255,255,255,.08)',background:carry?'rgba(255,255,255,.08)':'rgba(255,255,255,.025)'}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>{champ.image?<Image src={champ.image} alt="" width={42} height={42} style={{borderRadius:10,objectFit:'cover'}}/>:null}<div><div className="eyebrow">{unit.role}</div><b>{champ.name}</b></div></div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8}}>{(champ.traits||[]).slice(0,4).map(t=><span key={t} className="op-tier op-tier-free" style={{fontSize:8}}>{t}</span>)}</div>
          <p className="muted" style={{fontSize:10,marginBottom:0}}>{unit.reason}</p>
        </div>;
      })}</div>

      {shell.activeTraitCounts.length>0&&<div style={{marginTop:14}}><div className="eyebrow">REPEATED TRAITS IN GENERATED SHELL</div><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:7}}>{shell.activeTraitCounts.slice(0,10).map(t=><span key={t.name} className="op-tier op-tier-plus">{t.name} {t.count}</span>)}</div></div>}

      <div style={{display:'flex',gap:9,flexWrap:'wrap',marginTop:16}}><button className="btn primary" onClick={saveToBoardLab}>LOAD THIS TEAM INTO BOARD LAB</button><button className="btn secondary" onClick={()=>router.push('/tft/board-compare')}>OPEN BOARD COMPARE</button></div>
    </section>

    {selectedBuild.kind==='FUN'&&<section className="glass card" style={{marginTop:16}}><div className="eyebrow">HIGH-ROLL LINE · LABELLED CORRECTLY</div><h2>FUN DOES NOT MEAN BIS</h2><p className="muted">This package is intentionally kept as a context-dependent or high-roll option. OP CLIMB will never promote a fun build above the better-supported META core just because it looks more exciting.</p></section>}

    <section className="glass card" style={{marginTop:16}}><div className="eyebrow">DATA BOUNDARY</div><p className="muted" style={{margin:0}}>Champion performance and item packages are a dated Patch {TFT_META_PATCH} snapshot from {TFT_CARRY_PROFILES[0].sourceLabel}; unit traits, costs, images and base stats come from the current Riot Data Dragon feed. Standard craftable packages are prioritised over emblem/artifact-dependent outliers. The generated team shell is OP CLIMB coaching logic, not a live-lobby recommendation and not an exact combat-win prediction.</p></section>
  </main></TftShell>;
}