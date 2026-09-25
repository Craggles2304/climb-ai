'use client';

import {useEffect,useMemo,useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {ChampionBuilder} from '@/components/ChampionBuilder';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {getBrowserClient} from '@/lib/supabase/client';
import {getMainChampion,setMainChampion,MAIN_CHAMPION_EVENT} from '@/lib/mainChampion';
import {buildStats,type BestBuild,type BuildItem} from '@/lib/champions/build';
import type {RawDamageBuild} from '@/lib/champions/rawDamageBuild';
import {
  abilityDamageRows,
  buildAbilityContext,
  type ChampionAbilityDataset,
  type AbilityDamageCell,
} from '@/lib/champions/abilityDamage';
import type {ChampionStatBlock} from '@/lib/champions/ddragon';
import {
  abilityRanksFromSequence,
  comboSnapshot,
  currentAbilityDamage,
  mitigate,
  type TargetStats,
} from '@/lib/champions/damageLab';

const CHAMPION_ASSET_IDS:Record<string,string>={
  Wukong:'MonkeyKing','Nunu & Willump':'Nunu','Renata Glasc':'Renata',"K'Sante":'KSante',"Cho'Gath":'Chogath',"Kai'Sa":'Kaisa',"Vel'Koz":'Velkoz',LeBlanc:'Leblanc',"Bel'Veth":'Belveth',"Rek'Sai":'RekSai',"Kog'Maw":'KogMaw','Dr. Mundo':'DrMundo','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Jarvan IV':'JarvanIV','Lee Sin':'LeeSin','Aurelion Sol':'AurelionSol','Twisted Fate':'TwistedFate','Tahm Kench':'TahmKench','Xin Zhao':'XinZhao'
};
const championAsset=(name:string)=>CHAMPION_ASSET_IDS[name]||name.replace(/[^A-Za-z0-9]/g,'');
const championSplash=(name?:string)=>name?`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championAsset(name)}_0.jpg`:'';
const plain=(value?:string)=>String(value||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const canonicalChampion=(value:string,names:string[])=>names.find(name=>name.toLowerCase()===value.trim().toLowerCase())||'';

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

type ChampionTab='OVERVIEW'|'BUILDS'|'DAMAGE'|'MATCHUPS'|'COMBOS'|'MASTERY';

type SkillOrderPayload={
  shorthand:string;
  basis:string;
  sequence:Array<{level:number;slot:'Q'|'W'|'E'|'R';name:string;rankAfter:number}>;
};

type ProfilePayload={
  resource:string;
  difficulty:number;
  rangeClass:string;
  damageType:string;
  spikes:Array<{level:number;kind:string;title:string;fact:string;inference?:string}>;
  percentiles:Array<{stat:string;value:number;percentile:number}>;
  scaling:Array<{stat:string;earlyPercentile:number;latePercentile:number;shift:number;verdict:string;fact:string}>;
};

type MetaPayload={
  ok:boolean;
  error?:string;
  source?:'OP.GG';
  patch?:string;
  role?:string;
  runePage?:{pickRate:number|null;winRate:number|null;perks:Array<{id:number;name:string;icon:string}>}|null;
  summoners?:Array<{id:number;name:string;icon:string}>;
  starters?:Array<{id:number;name:string;icon?:string}>;
  skillPriority?:string[];
  skillSequence?:string[];
  summary?:{winRate:number|null;pickRate:number|null;banRate:number|null;games:number|null};
};

type TargetPayload={
  ok:boolean;
  error?:string;
  target?:{id:string;name:string;level:number;hp:number;armor:number;magicResist:number};
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
  profile?:ProfilePayload;
  skillOrder?:SkillOrderPayload;
  build?:{catalogue:BuildItem[];maxDps:BestBuild;maxRawDamage?:RawDamageBuild;bySize:BestBuild[];budget:number|null};
};

type DraftBuildItem=BuildItem&{label:string;why:string};
type PopularBuildPayload={
  ok:boolean;
  error?:string;
  source?:'U.GG'|'LOLALYTICS'|'RIOT';
  sourceUrl?:string;
  patch?:string;
  region?:string;
  tier?:string;
  lane?:string;
  confidence?:'HIGH'|'MEDIUM';
  items?:BuildItem[];
  note?:string;
};

type CounterRow={
  opponentId:number;
  opponent:string;
  championId:string;
  games:number;
  yourWinRate:number;
  edge:number;
  difficulty:'VERY HARD'|'HARD'|'EVEN'|'FAVOURED'|'VERY FAVOURED';
};
type CounterPayload={
  ok:boolean;
  error?:string;
  source?:'LOLALYTICS';
  sourceUrl?:string;
  patch?:string;
  region?:string;
  tier?:string;
  lane?:string;
  confidence?:'HIGH'|'MEDIUM';
  analysed?:number;
  rows?:CounterRow[];
  note?:string;
};

type DraftPayload={
  ok:boolean;
  error?:string;
  patch?:string;
  level?:number;
  champion?:string;
  confidence?:'HIGH'|'MEDIUM';
  read?:string;
  enemies?:Array<{id:string;name:string;tags:string[];damageType:string;attackRange:number}>;
  recommended?:DraftBuildItem[];
  swaps?:DraftBuildItem[];
  damage?:{autoDps:number;comboDamage:number;threeSecondDamage:number;score:number};
  rule?:string;
  boundary?:string;
};

export default function MainChampionPage(){
  const {active,authenticated,refresh}=useAccount();
  const matches=matchesFor(active.id);
  const [main,setMain]=useState('');
  const [draft,setDraft]=useState('');
  const [level,setLevel]=useState(11);
  const [activeTab,setActiveTab]=useState<ChampionTab>('OVERVIEW');
  const [data,setData]=useState<Payload|null>(null);
  const [meta,setMeta]=useState<MetaPayload|null>(null);
  const [metaLoading,setMetaLoading]=useState(false);
  const [names,setNames]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);
  const [buildItems,setBuildItems]=useState<BuildItem[]>([]);
  const [buildSource,setBuildSource]=useState('CUSTOM');
  const [enemyDraft,setEnemyDraft]=useState<string[]>(['','','','','']);
  const [draftData,setDraftData]=useState<DraftPayload|null>(null);
  const [draftLoading,setDraftLoading]=useState(false);
  const [popularBuild,setPopularBuild]=useState<PopularBuildPayload|null>(null);
  const [popularLoading,setPopularLoading]=useState(false);
  const [counterData,setCounterData]=useState<CounterPayload|null>(null);
  const [counterLoading,setCounterLoading]=useState(false);
  const [counterView,setCounterView]=useState<'HARD'|'ALL'|'FAVOURED'>('HARD');
  const [targetDraft,setTargetDraft]=useState('');
  const [targetName,setTargetName]=useState('');
  const [targetLoading,setTargetLoading]=useState(false);
  const [targetStats,setTargetStats]=useState<TargetStats|null>(null);
  const [combo,setCombo]=useState<string[]>([]);
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
    setDraftData(null);
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

  useEffect(()=>{
    if(!main)return;
    let live=true;
    setMetaLoading(true);
    setMeta(null);
    const params=new URLSearchParams({
      champion:main,
      role:active.role||'MID',
    });
    fetch('/api/champions/main/meta?'+params)
      .then(response=>response.json())
      .then((body:MetaPayload)=>{if(live)setMeta(body)})
      .catch(()=>{if(live)setMeta({ok:false,error:'Champion setup data is unavailable right now.'})})
      .finally(()=>{if(live)setMetaLoading(false)});
    return()=>{live=false};
  },[main,active.role]);

  useEffect(()=>{
    if(!main)return;
    let live=true;
    setPopularLoading(true);
    setPopularBuild(null);
    const params=new URLSearchParams({
      champion:main,
      role:active.role||'MID',
      rank:active.rank||'',
      region:active.region||'EUW',
    });
    fetch('/api/champions/main/popular?'+params)
      .then(response=>response.json())
      .then((body:PopularBuildPayload)=>{if(live)setPopularBuild(body)})
      .catch(()=>{if(live)setPopularBuild({ok:false,error:'Popularity data is unavailable right now.'})})
      .finally(()=>{if(live)setPopularLoading(false)});
    return()=>{live=false};
  },[main,active.role,active.rank,active.region]);

  useEffect(()=>{
    if(!main)return;
    let live=true;
    setCounterLoading(true);
    setCounterData(null);
    setCounterView('HARD');
    const params=new URLSearchParams({
      champion:main,
      role:active.role||'MID',
      rank:active.rank||'',
      region:active.region||'EUW',
    });
    fetch('/api/champions/main/counters?'+params)
      .then(response=>response.json())
      .then((body:CounterPayload)=>{if(live)setCounterData(body)})
      .catch(()=>{if(live)setCounterData({ok:false,error:'Counter data is unavailable right now.'})})
      .finally(()=>{if(live)setCounterLoading(false)});
    return()=>{live=false};
  },[main,active.role,active.rank,active.region]);

  useEffect(()=>{
    setBuildItems([]);
    setBuildSource('CUSTOM');
    setDraftData(null);
    setActiveTab('OVERVIEW');
    setTargetDraft('');
    setTargetName('');
    setTargetStats(null);
    setCombo([]);
  },[main]);

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

  const importableRecentBuilds=useMemo(()=>{
    const catalogue=data?.build?.catalogue??[];
    const byName=new Map(catalogue.map(item=>[item.name.toLowerCase(),item]));
    return recentBuilds.map(names=>({
      names,
      items:names.map(name=>byName.get(name.toLowerCase())).filter((item):item is BuildItem=>Boolean(item)).slice(0,6),
    }));
  },[recentBuilds,data?.build?.catalogue]);

  const abilityRows=useMemo(()=>{
    if(!data?.champion||!data.abilityData)return[];
    const bonuses=buildStats(buildItems);
    const context=buildAbilityContext(data.champion.stats,level,bonuses);
    return abilityDamageRows(data.abilityData,context);
  },[data,buildItems,level]);

  const skillSequence=useMemo(
    ()=>meta?.skillSequence?.length
      ?meta.skillSequence
      :(data?.skillOrder?.sequence??[]).map(step=>step.slot),
    [meta?.skillSequence,data?.skillOrder?.sequence],
  );
  const currentRanks=useMemo(()=>abilityRanksFromSequence(skillSequence,level),[skillSequence,level]);
  const currentDamage=useMemo(()=>currentAbilityDamage(abilityRows,currentRanks),[abilityRows,currentRanks]);
  const targetAbilityRows=useMemo(()=>{
    if(!targetStats)return[];
    return ['Q','W','E','R'].map(slot=>{
      const ability=currentDamage[slot];
      if(!ability)return null;
      return{
        slot,
        raw:ability.raw,
        post:mitigate(ability.raw,ability.damageType,targetStats),
        exact:ability.exact,
      };
    }).filter(Boolean) as Array<{slot:string;raw:number;post:number;exact:boolean}>;
  },[currentDamage,targetStats]);
  const comboResult=useMemo(
    ()=>targetStats?comboSnapshot(combo,currentDamage,targetStats):null,
    [combo,currentDamage,targetStats],
  );

  const personalTrend=useMemo(()=>{
    const sample=(games:typeof championMatches)=>{
      if(!games.length)return{games:0,winRate:0,cs:0,deaths:0,earlyDeaths:0};
      return{
        games:games.length,
        winRate:Math.round(games.filter(game=>game.result==='WIN').length/games.length*100),
        cs:Math.round(games.reduce((sum,game)=>sum+(game.metrics.csPerMin||0),0)/games.length*10)/10,
        deaths:Math.round(games.reduce((sum,game)=>sum+game.deaths,0)/games.length*10)/10,
        earlyDeaths:games.filter(game=>(game.metrics.deathsPre10||0)>0).length,
      };
    };
    return{recent:sample(championMatches.slice(0,5)),previous:sample(championMatches.slice(5,10))};
  },[championMatches]);

  const personalMatchups=useMemo(()=>{
    const map=new Map<string,{opponent:string;games:number;wins:number;deaths:number}>();
    for(const game of championMatches){
      if(!game.opponent)continue;
      const hit=map.get(game.opponent)||{opponent:game.opponent,games:0,wins:0,deaths:0};
      hit.games+=1;
      hit.wins+=game.result==='WIN'?1:0;
      hit.deaths+=game.deaths;
      map.set(game.opponent,hit);
    }
    return [...map.values()].sort((a,b)=>b.games-a.games||b.wins-a.wins).slice(0,8);
  },[championMatches]);

  const loadBuild=(items:BuildItem[],source:string)=>{
    setBuildItems(items.slice(0,6));
    setBuildSource(source);
    setActiveTab('DAMAGE');
    window.setTimeout(()=>{
      document.getElementById('build-simulator')?.scrollIntoView({behavior:'smooth',block:'start'});
    },40);
  };

  const loadTarget=async()=>{
    const canonical=canonicalChampion(targetDraft,names);
    if(!canonical)return;
    setTargetLoading(true);
    try{
      const params=new URLSearchParams({champion:canonical,level:String(level)});
      const response=await fetch('/api/champions/main/target?'+params);
      const body=await response.json() as TargetPayload;
      if(body.ok&&body.target){
        setTargetName(body.target.name);
        setTargetDraft(body.target.name);
        setTargetStats({
          hp:body.target.hp,
          armor:body.target.armor,
          magicResist:body.target.magicResist,
        });
      }
    }finally{
      setTargetLoading(false);
    }
  };

  const editBuild=(items:BuildItem[])=>{
    setBuildItems(items);
    setBuildSource('CUSTOM');
  };

  const calculateDraft=async()=>{
    const enemies=enemyDraft.map(value=>value.trim()).filter(Boolean);
    if(!main||!enemies.length)return;
    setDraftLoading(true);
    setDraftData(null);
    try{
      const params=new URLSearchParams({
        champion:main,
        enemies:enemies.join(','),
        role:active.role||'UNKNOWN',
        level:String(level),
      });
      const response=await fetch('/api/champions/main/draft?'+params);
      const body=await response.json() as DraftPayload;
      setDraftData(body);
    }catch{
      setDraftData({ok:false,error:'Could not calculate a build for that draft.'});
    }finally{
      setDraftLoading(false);
    }
  };

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

  const counterRows=useMemo(()=>{
    const rows=counterData?.rows??[];
    if(counterView==='HARD')return rows.slice(0,10);
    if(counterView==='FAVOURED')return [...rows].reverse().slice(0,10);
    return rows;
  },[counterData?.rows,counterView]);

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

      <nav className="mc-hq-tabs" aria-label="Champion HQ sections">
        {([
          ['OVERVIEW','OVERVIEW','Identity · setup · abilities'],
          ['BUILDS','BUILDS','Popular · max · vs draft'],
          ['DAMAGE','DAMAGE LAB','Items · targets · spell damage'],
          ['MATCHUPS','MATCHUPS','Counters · favourable lanes'],
          ['COMBOS','COMBOS','Build a combo · see damage'],
          ['MASTERY','MY MASTERY','Your trends · your matchups'],
        ] as Array<[ChampionTab,string,string]>).map(([key,label,sub])=><button
          key={key}
          type="button"
          className={activeTab===key?'active':''}
          onClick={()=>setActiveTab(key)}
        ><b>{label}</b><small>{sub}</small></button>)}
      </nav>

      {activeTab==='OVERVIEW'&&<div className="mc-tab-panel">
        <section className="mc-overview-grid">
          <article className="mc-overview-card identity">
            <div className="eyebrow">CHAMPION IDENTITY</div>
            <h3>{champion.tags.join(' / ')}</h3>
            <div className="mc-identity-chips">
              <span>{data.profile?.damageType||'—'} DAMAGE</span>
              <span>{data.profile?.rangeClass||'—'} RANGE</span>
              <span>{data.profile?.resource||'NO RESOURCE DATA'}</span>
              <span>DIFFICULTY {data.profile?.difficulty??champion.info.difficulty}/10</span>
            </div>
          </article>

          <article className="mc-overview-card setup">
            <div className="eyebrow">QUICK SETUP</div>
            {metaLoading?<p className="muted">Loading current setup…</p>:meta?.ok?<>
              <div className="mc-setup-row"><span>RUNES</span><div className="mc-icon-row">{meta.runePage?.perks.slice(0,6).map(perk=><span key={perk.id} title={perk.name}><img src={perk.icon} alt=""/><small>{perk.name}</small></span>)}</div></div>
              <div className="mc-setup-row"><span>SUMMONERS</span><div className="mc-icon-row">{meta.summoners?.map(spell=><span key={spell.id} title={spell.name}><img src={spell.icon} alt=""/><small>{spell.name}</small></span>)}</div></div>
              <div className="mc-setup-row"><span>START</span><div className="mc-icon-row">{meta.starters?.slice(0,3).map(item=><span key={item.id} title={item.name}>{item.icon?<img src={item.icon} alt=""/>:null}<small>{item.name}</small></span>)}</div></div>
              <div className="mc-skill-priority"><span>SKILL PRIORITY</span><b>{meta.skillPriority?.length?meta.skillPriority.join(' → '):(data.skillOrder?.shorthand||'—')}</b></div>
            </>:<p className="muted">Current setup data is unavailable. Riot ability data is still shown below.</p>}
          </article>

          <article className="mc-overview-card spikes">
            <div className="eyebrow">POWER SPIKES</div>
            <div className="mc-spike-list">{(data.profile?.spikes??[]).slice(0,4).map(spike=><div key={spike.level+'-'+spike.title}><b>LV {spike.level}</b><span>{spike.title.replace(/^Level \d+ — /,'')}</span></div>)}</div>
          </article>

          <article className="mc-overview-card meta">
            <div className="eyebrow">META SNAPSHOT</div>
            <div className="mc-meta-mini">
              <div><span>WIN RATE</span><b>{meta?.summary?.winRate!=null?meta.summary.winRate+'%':'—'}</b></div>
              <div><span>PICK RATE</span><b>{meta?.summary?.pickRate!=null?meta.summary.pickRate+'%':'—'}</b></div>
              <div><span>BAN RATE</span><b>{meta?.summary?.banRate!=null?meta.summary.banRate+'%':'—'}</b></div>
              <div><span>PATCH</span><b>{patch}</b></div>
            </div>
          </article>
        </section>

        <section className="mc-section">
          <div className="mc-section-head"><div><div className="eyebrow">YOUR KIT</div><h2>Abilities — details only when you want them.</h2></div><span className="mc-patch-chip">CURRENT DATA · {patch}</span></div>
        <div className="mc-ability-grid">
          <AbilityCard slot="P" name={champion.passive.name} icon={passiveIcon} text={champion.passive.description}/>
          {champion.spells.map(spell=><AbilityCard key={spell.id} slot={spell.slot} name={spell.name} icon={spellIcon(spell)}
            text={spell.description||spell.tooltip} cooldown={spell.cooldown} cost={spell.cost}/>)}
        </div>
      </section>
      </div>}

      {activeTab==='BUILDS'&&<div className="mc-tab-panel">
      <section className="mc-section">
        <div className="mc-section-head"><div><div className="eyebrow">BUILDS</div><h2>Pick the build question you want answered.</h2></div></div>
        <div className="mc-build-presets">
          {importableRecentBuilds.length>0?importableRecentBuilds.map((build,index)=><div className="mc-preset" key={build.names.join('|')+index}>
            <span>{index===0?'YOUR LATEST BUILD':'RECENT BUILD '+(index+1)}</span>
            <div>{build.names.map((item,itemIndex)=><b key={item+'-'+itemIndex}>{item}</b>)}</div>
            {build.items.length>0&&<button className="btn secondary" type="button" onClick={()=>loadBuild(build.items,index===0?'LATEST GAME BUILD':'RECENT GAME BUILD')}>IMPORT TO SIMULATOR ↓</button>}
          </div>):<div className="mc-preset empty"><span>YOUR BUILDS</span><p>Play tracked games on {champion.name} and your actual completed builds will appear here.</p></div>}
          {popularLoading?<div className="mc-preset popular loading"><span>MOST POPULAR BUILD</span><p>Loading current build data…</p></div>:popularBuild?.ok&&popularBuild.items?.length?<div className="mc-preset popular mc-popular-build">
            <span>MOST POPULAR BUILD</span>
            <div className="mc-popular-meta">
              <b>{popularBuild.source}</b>
              <small>PATCH {popularBuild.patch} · {popularBuild.region} · {popularBuild.tier} · {popularBuild.lane}</small>
            </div>
            <div>{popularBuild.items.map(item=><b key={item.id}>{item.name}</b>)}</div>
            <button className="btn primary" type="button" onClick={()=>loadBuild(popularBuild.items as BuildItem[],'MOST POPULAR')}>IMPORT TO SIMULATOR ↓</button>
            <small>{popularBuild.note}</small>
          </div>:null}
          {data.build?.maxRawDamage?.items?.length?<div className="mc-preset damage mc-max-damage">
            <span>MAX DAMAGE BUILD · LEVEL {level}</span>
            <div>{data.build.maxRawDamage.items.map(item=><b key={item.id}>{item.name}</b>)}</div>
            <div className="mc-build-damage-metrics">
              <em><small>3 SEC RAW</small><strong>{Math.round(data.build.maxRawDamage.threeSecondDamage)}</strong></em>
              <em><small>COMBO</small><strong>{Math.round(data.build.maxRawDamage.comboDamage)}</strong></em>
              <em><small>AUTO DPS</small><strong>{Math.round(data.build.maxRawDamage.autoDps)}</strong></em>
            </div>
            <button className="btn primary" type="button" onClick={()=>loadBuild(data.build!.maxRawDamage!.items,'MAX DAMAGE')}>IMPORT TO SIMULATOR ↓</button>
            <small>{data.build.maxRawDamage.note}</small>
          </div>:null}
        </div>
      </section>

      <section className="mc-draft-builder">
        <div className="mc-section-head">
          <div><div className="eyebrow">BUILD VS THEIR TEAM</div><h2>Draft the enemy. Optimus changes the build.</h2><p>Pick the enemy champions you can see. Add all five for the strongest read; the build reacts to tanks, dive, CC, healing, shields and damage profile.</p></div>
          <span className="mc-patch-chip">{draftData?.confidence?draftData.confidence+' CONFIDENCE':'0 / 5 ENEMIES'}</span>
        </div>

        <div className="mc-enemy-draft">
          {enemyDraft.map((value,index)=><label key={index} className={'mc-enemy-slot'+(value?' filled':'')}>
            <span>ENEMY {index+1}</span>
            {canonicalChampion(value,names)&&patch?<img src={`https://ddragon.leagueoflegends.com/cdn/${patch}/img/champion/${championAsset(canonicalChampion(value,names))}.png`} alt="" aria-hidden="true"/>:<i>{index+1}</i>}
            <input list="enemy-champion-list" value={value} placeholder="Select champion"
              onChange={event=>{
                const next=[...enemyDraft];
                next[index]=event.target.value;
                setEnemyDraft(next);
                setDraftData(null);
              }}/>
          </label>)}
          <datalist id="enemy-champion-list">{names.filter(name=>name!==main).map(name=><option key={name} value={name}/>)}</datalist>
        </div>
        <div className="mc-draft-actions">
          <button className="btn primary" type="button" disabled={draftLoading||!enemyDraft.some(Boolean)} onClick={()=>void calculateDraft()}>
            {draftLoading?'CALCULATING…':'BUILD VS THIS TEAM'}
          </button>
          {enemyDraft.some(Boolean)&&<button className="btn secondary" type="button" onClick={()=>{setEnemyDraft(['','','','','']);setDraftData(null)}}>CLEAR DRAFT</button>}
        </div>

        {draftData&&!draftData.ok&&<div className="mc-draft-error">{draftData.error}</div>}

        {draftData?.ok&&draftData.recommended?.length?<div className="mc-draft-result">
          <div className="mc-draft-read"><span>OPTIMUS READ</span><strong>{draftData.read}</strong></div>
          <div className="mc-draft-build-row">
            {draftData.recommended.map((item,index)=><article key={item.id}>
              <span>{item.label||('SLOT '+(index+1))}</span>
              {item.icon?<img src={item.icon} alt="" aria-hidden="true"/>:<b>{item.name.slice(0,2)}</b>}
              <h3>{item.name}</h3>
              <small>{item.why}</small>
            </article>)}
          </div>
          {draftData.damage&&<div className="mc-draft-damage">
            <div><span>3 SEC RAW</span><b>{Math.round(draftData.damage.threeSecondDamage)}</b></div>
            <div><span>COMBO</span><b>{Math.round(draftData.damage.comboDamage)}</b></div>
            <div><span>AUTO DPS</span><b>{Math.round(draftData.damage.autoDps)}</b></div>
          </div>}
          <div className="mc-draft-result-actions">
            <button className="btn primary" type="button" onClick={()=>loadBuild(draftData.recommended as BuildItem[],'VS ENEMY DRAFT')}>IMPORT TO SIMULATOR ↓</button>
            <small>{draftData.rule}</small>
          </div>
          {draftData.swaps?.length?<div className="mc-draft-swaps"><span>IF THE GAME CHANGES</span>{draftData.swaps.slice(0,3).map(item=><div key={item.id}><b>{item.name}</b><small>{item.why}</small></div>)}</div>:null}
        </div>:null}
      </section>
      </div>}

      {activeTab==='DAMAGE'&&<div className="mc-tab-panel">
        <section className="mc-target-lab">
          <div className="mc-section-head">
            <div><div className="eyebrow">TARGET LAB</div><h2>See what the build actually does to a champion.</h2><p>Load a target, then adjust HP, armour or MR if you want to model their items.</p></div>
          </div>
          <div className="mc-target-controls">
            <div className="field"><label>Target champion</label><input className="input" list="damage-target-list" value={targetDraft} placeholder="e.g. Yone" onChange={event=>setTargetDraft(event.target.value)}/><datalist id="damage-target-list">{names.filter(name=>name!==main).map(name=><option key={name} value={name}/>)}</datalist></div>
            <button className="btn secondary" type="button" disabled={!canonicalChampion(targetDraft,names)||targetLoading} onClick={()=>void loadTarget()}>{targetLoading?'LOADING…':'LOAD TARGET'}</button>
            {targetStats&&<div className="mc-target-stat"><span>HP</span><input type="number" value={Math.round(targetStats.hp)} onChange={event=>setTargetStats({...targetStats,hp:Number(event.target.value)||0})}/></div>}
            {targetStats&&<div className="mc-target-stat"><span>ARMOR</span><input type="number" value={Math.round(targetStats.armor)} onChange={event=>setTargetStats({...targetStats,armor:Number(event.target.value)||0})}/></div>}
            {targetStats&&<div className="mc-target-stat"><span>MR</span><input type="number" value={Math.round(targetStats.magicResist)} onChange={event=>setTargetStats({...targetStats,magicResist:Number(event.target.value)||0})}/></div>}
          </div>
          {targetName&&targetStats&&<div className="mc-target-loaded"><b>{targetName.toUpperCase()} · LEVEL {level}</b><span>Editable stats let you model defensive items without another screen.</span></div>}
        </section>

      {data.build&&<ChampionBuilder
        champion={champion.name}
        stats={champion.stats}
        level={level}
        catalogue={data.build.catalogue}
        maxDps={data.build.maxDps}
        maxRawDamage={data.build.maxRawDamage}
        bySize={data.build.bySize}
        budget={data.build.budget}
        selectedItems={buildItems}
        onBuildChange={editBuild}
        onImportMaxDamage={data.build.maxRawDamage?.items.length?()=>loadBuild(data.build!.maxRawDamage!.items,'MAX DAMAGE'):undefined}
        buildSource={buildSource}
      />}

      <section className="mc-damage-section">
        <div className="mc-section-head">
          <div><div className="eyebrow">ABILITY DAMAGE · {buildSource}</div><h2>What your abilities hit for with this exact build.</h2><p>Raw damage before the target&apos;s armour or magic resistance. Add, remove or import an item above and every supported ability recalculates immediately.</p></div>
          <div className="mc-formula-source"><span>FORMULAS</span><b>{data.abilityData?'STRUCTURED DATA':'UNAVAILABLE'}</b>{data.abilityData?.patchLastChanged&&<small>Last formula change: {data.abilityData.patchLastChanged}</small>}</div>
        </div>

        {buildItems.length>0&&<div className="mc-active-build">{buildItems.map((item,index)=><span key={item.id}><b>{index+1}</b>{item.icon?<img src={item.icon} alt="" aria-hidden="true"/>:null}{item.name}</span>)}</div>}

        {targetStats&&targetAbilityRows.length>0&&<div className="mc-target-damage-grid">
          {targetAbilityRows.map(row=><div key={row.slot}><span>{row.slot} · RANK {currentRanks[row.slot]||0}</span><b>{Math.round(row.post)}</b><small>{Math.round(row.raw)} raw{row.exact?'':' · variable*'}</small></div>)}
        </div>}

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
      </div>}

      {activeTab==='MATCHUPS'&&<div className="mc-tab-panel">
      <section className="mc-counter-section">
        <div className="mc-section-head">
          <div>
            <div className="eyebrow">COUNTER TABLE</div>
            <h2>Who actually gives {champion.name} the hardest lane?</h2>
            <p>Current ranked matchup data for your role, rank and region. Lower win rate means a harder matchup for your main.</p>
          </div>
          {counterData?.ok&&<div className="mc-counter-scope">
            <span>{counterData.source}</span>
            <b>PATCH {counterData.patch}</b>
            <small>{counterData.region} · {counterData.tier} · {counterData.lane}</small>
          </div>}
        </div>

        <div className="mc-counter-tabs">
          <button className={counterView==='HARD'?'active':''} onClick={()=>setCounterView('HARD')} type="button">HARDEST 10</button>
          <button className={counterView==='ALL'?'active':''} onClick={()=>setCounterView('ALL')} type="button">ALL MATCHUPS</button>
          <button className={counterView==='FAVOURED'?'active':''} onClick={()=>setCounterView('FAVOURED')} type="button">BEST 10</button>
        </div>

        {counterLoading?<div className="mc-counter-loading">LOADING CURRENT MATCHUPS…</div>:
        counterData?.ok&&counterRows.length?<div className="mc-counter-table-wrap"><table className="mc-counter-table">
          <thead><tr><th>#</th><th>OPPONENT</th><th>YOUR WIN RATE</th><th>EDGE</th><th>SAMPLE</th><th>DIFFICULTY</th></tr></thead>
          <tbody>{counterRows.map((row,index)=><tr key={row.opponentId}>
            <td>{String(index+1).padStart(2,'0')}</td>
            <td><div className="mc-counter-champ">
              {patch&&<img src={`https://ddragon.leagueoflegends.com/cdn/${patch}/img/champion/${row.championId}.png`} alt="" aria-hidden="true"/>}
              <div><b>{row.opponent}</b><small>{champion.name} vs {row.opponent}</small></div>
            </div></td>
            <td><strong className={row.yourWinRate<49?'bad':row.yourWinRate>51?'good':'even'}>{row.yourWinRate.toFixed(1)}%</strong></td>
            <td><span className={row.edge<0?'mc-counter-edge bad':row.edge>0?'mc-counter-edge good':'mc-counter-edge'}>{row.edge>0?'+':''}{row.edge.toFixed(1)}%</span></td>
            <td><span className="mc-counter-games">{row.games.toLocaleString()} games</span></td>
            <td><span className={'mc-counter-difficulty '+row.difficulty.toLowerCase().replaceAll(' ','-')}>{row.difficulty}</span></td>
          </tr>)}</tbody>
        </table></div>:<div className="mc-no-formulas"><b>Counter data is unavailable right now.</b><p>{counterData?.error||'There is not enough current matchup data for this champion and role.'}</p></div>}

        {counterData?.ok&&<div className="mc-counter-foot">
          <span>{counterData.confidence} CONFIDENCE</span>
          <p>{counterData.note}</p>
        </div>}
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
