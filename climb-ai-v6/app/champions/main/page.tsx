'use client';

import {useEffect,useMemo,useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {ChampionBuilder} from '@/components/ChampionBuilder';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {getBrowserClient} from '@/lib/supabase/client';
import {getMainChampion,setMainChampion,MAIN_CHAMPION_EVENT} from '@/lib/mainChampion';
import {buildStats,type BestBuild,type BuildItem} from '@/lib/champions/build';
import {
  abilityDamageRows,
  buildAbilityContext,
  type ChampionAbilityDataset,
  type AbilityDamageCell,
} from '@/lib/champions/abilityDamage';
import type {ChampionStatBlock} from '@/lib/champions/ddragon';

const CHAMPION_ASSET_IDS:Record<string,string>={
  Wukong:'MonkeyKing','Nunu & Willump':'Nunu','Renata Glasc':'Renata',"K'Sante":'KSante',"Cho'Gath":'Chogath',"Kai'Sa":'Kaisa',"Vel'Koz":'Velkoz',LeBlanc:'Leblanc',"Bel'Veth":'Belveth',"Rek'Sai":'RekSai',"Kog'Maw":'KogMaw','Dr. Mundo':'DrMundo','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Jarvan IV':'JarvanIV','Lee Sin':'LeeSin','Aurelion Sol':'AurelionSol','Twisted Fate':'TwistedFate','Tahm Kench':'TahmKench','Xin Zhao':'XinZhao'
};
const championAsset=(name:string)=>CHAMPION_ASSET_IDS[name]||name.replace(/[^A-Za-z0-9]/g,'');
const championSplash=(name?:string)=>name?`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championAsset(name)}_0.jpg`:'';
const plain=(value?:string)=>String(value||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();

type Spell={
  slot:'Q'|'W'|'E'|'R'|'?';
  id:string;
  name:string;
  maxrank:number;
  description:string;
  tooltip:string;
  cooldown:number[];
  cost:number[];
  range:number[];
  image?:{full?:string}|null;
};

type Payload={
  ok:boolean;
  error?:string;
  patch?:string;
  names?:string[];
  level?:number;
  champion?:{
    id:string;
    name:string;
    title:string;
    tags:string[];
    attackRange:number;
    info:{attack:number;defense:number;magic:number;difficulty:number};
    autoAttackReliant:boolean;
    stats:ChampionStatBlock;
    passive:{name:string;description:string;image?:{full?:string}};
    spells:Spell[];
  };
  abilityData?:ChampionAbilityDataset|null;
  build?:{catalogue:BuildItem[];maxDps:BestBuild;bySize:BestBuild[];budget:number|null};
};

export default function MainChampionPage(){
  const {active,authenticated,refresh}=useAccount();
  const matches=matchesFor(active.id);
  const [main,setMain]=useState('');
  const [draft,setDraft]=useState('');
  const [level,setLevel]=useState(11);
  const [data,setData]=useState<Payload|null>(null);
  const [names,setNames]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);
  const [buildItems,setBuildItems]=useState<BuildItem[]>([]);
  const [saveState,setSaveState]=useState<'idle'|'saving'|'saved'|'error'>('idle');

  useEffect(()=>{
    const initial=getMainChampion()||active.champions?.[0]||'';
    if(initial){
      setMain(initial);
      setDraft(initial);
      if(!getMainChampion())setMainChampion(initial);
    }
    const onChange=()=>{
      const next=getMainChampion()||'';
      setMain(next);
      setDraft(next);
      setBuildItems([]);
    };
    window.addEventListener(MAIN_CHAMPION_EVENT,onChange);
    return()=>window.removeEventListener(MAIN_CHAMPION_EVENT,onChange);
  },[active.id,active.champions]);

  useEffect(()=>{
    let live=true;
    fetch('/api/champions/main')
      .then(response=>response.json())
      .then((body:Payload)=>{if(live&&body.ok)setNames(body.names||[])})
      .catch(()=>{});
    return()=>{live=false};
  },[]);

  useEffect(()=>{
    if(!main){setData(null);return}
    let live=true;
    setLoading(true);
    setBuildItems([]);
    const params=new URLSearchParams({champion:main,level:String(level)});
    fetch('/api/champions/main?'+params)
      .then(response=>response.json())
      .then((body:Payload)=>{
        if(!live)return;
        setData(body);
        if(body.names?.length)setNames(body.names);
      })
      .catch(()=>{if(live)setData({ok:false,error:'Could not load champion data.'})})
      .finally(()=>{if(live)setLoading(false)});
    return()=>{live=false};
  },[main,level]);

  const championMatches=useMemo(
    ()=>main?matches.filter(match=>match.champion.toLowerCase()===main.toLowerCase()):[],
    [matches,main],
  );
  const personal=useMemo(()=>{
    if(!championMatches.length)return{games:0,winRate:0,kda:0,csPerMin:0};
    const wins=championMatches.filter(match=>match.result==='WIN').length;
    const kills=championMatches.reduce((sum,match)=>sum+match.kills,0);
    const deaths=championMatches.reduce((sum,match)=>sum+match.deaths,0);
    const assists=championMatches.reduce((sum,match)=>sum+match.assists,0);
    const csPerMin=championMatches.reduce((sum,match)=>sum+(match.metrics.csPerMin||0),0)/championMatches.length;
    return{
      games:championMatches.length,
      winRate:Math.round(wins/championMatches.length*100),
      kda:Math.round(((kills+assists)/Math.max(1,deaths))*10)/10,
      csPerMin:Math.round(csPerMin*10)/10,
    };
  },[championMatches]);

  const recentBuilds=useMemo(()=>{
    const seen=new Set<string>();
    const builds:string[][]=[];
    for(const match of championMatches){
      const items=(match.items||[]).filter(Boolean);
      if(!items.length)continue;
      const key=items.join('|');
      if(seen.has(key))continue;
      seen.add(key);
      builds.push(items);
      if(builds.length===3)break;
    }
    return builds;
  },[championMatches]);

  const abilityRows=useMemo(()=>{
    if(!data?.champion||!data.abilityData)return[];
    const bonuses=buildStats(buildItems);
    const context=buildAbilityContext(data.champion.stats,level,bonuses);
    return abilityDamageRows(data.abilityData,context);
  },[data,buildItems,level]);

  const chooseMain=async()=>{
    const value=draft.trim();
    if(!value)return;
    const canonical=names.find(name=>name.toLowerCase()===value.toLowerCase())||value;
    setSaveState('saving');
    setMainChampion(canonical);
    setMain(canonical);
    setDraft(canonical);
    try{
      if(authenticated){
        const client=await getBrowserClient();
        if(client){
          const {data:userData}=await client.auth.getUser();
          const user=userData.user;
          if(user){
            const champions=[canonical,...(active.champions||[]).filter(name=>name.toLowerCase()!==canonical.toLowerCase())].slice(0,8);
            await Promise.all([
              client.from('profiles').update({champions,updated_at:new Date().toISOString()}).eq('id',user.id),
              client.from('riot_accounts').update({champions,updated_at:new Date().toISOString()}).eq('id',active.id).eq('user_id',user.id),
            ]);
            await refresh();
          }
        }
      }
      setSaveState('saved');
      window.setTimeout(()=>setSaveState('idle'),1600);
    }catch{
      setSaveState('error');
    }
  };

  const champion=data?.champion;
  const patch=data?.patch||'';
  const spellIcon=(spell:Spell)=>patch&&spell.image?.full
    ?`https://ddragon.leagueoflegends.com/cdn/${patch}/img/spell/${spell.image.full}`
    :'';
  const passiveIcon=champion&&patch&&champion.passive.image?.full
    ?`https://ddragon.leagueoflegends.com/cdn/${patch}/img/passive/${champion.passive.image.full}`
    :'';

  return <AppShell>
    <section className="mc-picker-bar">
      <div>
        <span>MY MAIN CHAMPION</span>
        <strong>{main||'Not chosen yet'}</strong>
      </div>
      <div className="mc-picker-control">
        <input className="input" list="main-champion-list" value={draft} placeholder="Search a champion…"
          onChange={event=>setDraft(event.target.value)}
          onKeyDown={event=>{if(event.key==='Enter')void chooseMain()}}/>
        <datalist id="main-champion-list">{names.map(name=><option key={name} value={name}/>)}</datalist>
        <button className="btn primary" type="button" disabled={!draft.trim()||saveState==='saving'} onClick={()=>void chooseMain()}>
          {saveState==='saving'?'SAVING…':saveState==='saved'?'SAVED ✓':'SET MAIN'}
        </button>
      </div>
      {saveState==='error'&&<small className="danger">Saved on this device, but cloud sync failed.</small>}
    </section>

    {!main&&<section className="mc-empty">
      <div className="eyebrow">START HERE</div>
      <h1>Pick the champion you actually want to master.</h1>
      <p>Once selected, this page becomes your permanent champion workspace: your results, abilities, builds and damage simulator.</p>
    </section>}

    {main&&<>{loading&&!champion&&<section className="mc-loading"><span>LOADING {main.toUpperCase()}…</span></section>}

    {data&&!data.ok&&<section className="glass card"><h2>Champion data did not load.</h2><p className="muted">{data.error}</p></section>}

    {champion&&data?.ok&&<>
      <section className="mc-hero">
        <img className="mc-hero-art" src={championSplash(champion.name)} alt="" aria-hidden="true"/>
        <div className="mc-hero-shade"/>
        <div className="mc-hero-content">
          <div className="mc-hero-kicker"><span>YOUR MAIN</span><i/>RIOT PATCH {patch}</div>
          <div className="mc-hero-copy">
            <div><h1>{champion.name}</h1><p>{champion.title} · {champion.tags.join(' / ')}</p></div>
            <label className="mc-level"><span>SIMULATOR LEVEL</span><select value={level} onChange={event=>setLevel(Number(event.target.value))}>
              {[1,3,6,9,11,13,16,18].map(value=><option key={value} value={value}>LEVEL {value}</option>)}
            </select></label>
          </div>
          <div className="mc-player-stats">
            <div><span>YOUR GAMES</span><b>{personal.games||'—'}</b></div>
            <div><span>WIN RATE</span><b>{personal.games?personal.winRate+'%':'—'}</b></div>
            <div><span>KDA</span><b>{personal.games?personal.kda:'—'}</b></div>
            <div><span>CS / MIN</span><b>{personal.games?personal.csPerMin:'—'}</b></div>
          </div>
        </div>
      </section>

      <section className="mc-section">
        <div className="mc-section-head"><div><div className="eyebrow">YOUR KIT</div><h2>Know exactly what every button does.</h2></div><span className="mc-patch-chip">CURRENT DATA · {patch}</span></div>
        <div className="mc-ability-grid">
          <AbilityCard slot="P" name={champion.passive.name} icon={passiveIcon} text={champion.passive.description}/>
          {champion.spells.map(spell=><AbilityCard key={spell.id} slot={spell.slot} name={spell.name} icon={spellIcon(spell)}
            text={spell.description||spell.tooltip} cooldown={spell.cooldown} cost={spell.cost}/>)}
        </div>
      </section>

      <section className="mc-section">
        <div className="mc-section-head"><div><div className="eyebrow">BUILDS</div><h2>Your real games + a damage baseline.</h2></div></div>
        <div className="mc-build-presets">
          {recentBuilds.length>0?recentBuilds.map((items,index)=><div className="mc-preset" key={items.join('|')+index}>
            <span>{index===0?'YOUR LATEST BUILD':'RECENT BUILD '+(index+1)}</span>
            <div>{items.map((item,itemIndex)=><b key={item+'-'+itemIndex}>{item}</b>)}</div>
          </div>):<div className="mc-preset empty"><span>YOUR BUILDS</span><p>Play tracked games on {champion.name} and your actual completed builds will appear here.</p></div>}
          {data.build?.bySize?.[2]?.items?.length?<div className="mc-preset damage">
            <span>3-ITEM DAMAGE BASELINE</span>
            <div>{data.build.bySize[2].items.map(item=><b key={item.id}>{item.name}</b>)}</div>
            <small>Highest basic-attack DPS found at this level. Not a universal recommended build.</small>
          </div>:null}
        </div>
      </section>

      {data.build&&<ChampionBuilder
        champion={champion.name}
        stats={champion.stats}
        level={level}
        catalogue={data.build.catalogue}
        maxDps={data.build.maxDps}
        bySize={data.build.bySize}
        budget={data.build.budget}
        onBuildChange={setBuildItems}
      />}

      <section className="mc-damage-section">
        <div className="mc-section-head">
          <div><div className="eyebrow">ABILITY DAMAGE · CURRENT BUILD</div><h2>What your abilities hit for.</h2><p>Raw damage before the target&apos;s armour or magic resistance. Change an item above and this table recalculates.</p></div>
          <div className="mc-formula-source"><span>FORMULAS</span><b>{data.abilityData?'STRUCTURED DATA':'UNAVAILABLE'}</b>{data.abilityData?.patchLastChanged&&<small>Last formula change: {data.abilityData.patchLastChanged}</small>}</div>
        </div>

        {abilityRows.length?<div className="mc-damage-table-wrap"><table className="mc-damage-table">
          <thead><tr><th>ABILITY</th><th>DAMAGE</th>{Array.from({length:maxRanks(abilityRows)},(_,index)=><th key={index}>RANK {index+1}</th>)}</tr></thead>
          <tbody>{abilityRows.map(row=><tr key={row.id}>
            <td><span className="mc-slot">{row.slot}</span><div><b>{row.ability}</b><small>{row.damageType||'DAMAGE'}</small></div></td>
            <td><span>{row.attribute}</span></td>
            {Array.from({length:maxRanks(abilityRows)},(_,index)=>{
              const cell=row.ranks[index];
              return <td key={index}>{cell?<DamageValue cell={cell}/>:<span className="mc-na">—</span>}</td>;
            })}
          </tr>)}</tbody>
        </table></div>:<div className="mc-no-formulas">
          <b>Ability formula data is not available for this champion yet.</b>
          <p>The build simulator still uses current Riot item and champion stats. Optimus will not invent spell damage when the formula source cannot support it.</p>
        </div>}
        {abilityRows.length>0&&<p className="mc-damage-note"><b>* VARIABLE</b> means part of that damage depends on a target, stack, mark, distance or another live-game condition. Optimus shows the calculable portion and does not guess the rest.</p>}
      </section>
    </>}</>}
  </AppShell>;
}

function AbilityCard({slot,name,icon,text,cooldown,cost}:{slot:string;name:string;icon:string;text?:string;cooldown?:number[];cost?:number[]}){
  const cooldownText=(cooldown||[]).filter((value,index,array)=>Number.isFinite(value)&&array.indexOf(value)===index).join(' / ');
  const costText=(cost||[]).filter((value,index,array)=>Number.isFinite(value)&&array.indexOf(value)===index).join(' / ');
  return <article className="mc-ability-card">
    <div className="mc-ability-head">{icon?<img src={icon} alt="" aria-hidden="true"/>:<span className="mc-ability-fallback">{slot}</span>}<div><span>{slot}</span><h3>{name}</h3></div></div>
    <p>{plain(text)||'Ability details are not available in the current champion feed.'}</p>
    {(cooldownText||costText)&&<div className="mc-ability-meta">{cooldownText&&<span>CD <b>{cooldownText}s</b></span>}{costText&&<span>COST <b>{costText}</b></span>}</div>}
  </article>;
}

function DamageValue({cell}:{cell:AbilityDamageCell}){
  if(cell.value===null)return <span className="mc-variable">VAR*</span>;
  return <span className={cell.exact?'mc-damage-value':'mc-damage-value variable'}>{Math.round(cell.value*10)/10}{cell.exact?'':'*'}</span>;
}

function maxRanks(rows:Array<{ranks:AbilityDamageCell[]}>){
  return Math.max(1,...rows.map(row=>row.ranks.length));
}
