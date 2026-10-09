'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import type {Match,RiotAccount} from '@/lib/types';
import {championSplash} from '@/lib/championArt';
import {ArenaIcon} from '@/components/ArenaIcon';

type ChampionRecord={name:string;games:number;wins:number;kills:number;deaths:number;assists:number;lastPlayed:string|null};

const shorten=(name:string)=>name.length>19?name.slice(0,18)+'…':name;
const winRate=(wins:number,count:number)=>count?Math.round(100*wins/count)+'%':'—';
const kda=(r:ChampionRecord)=>r.games?(r.deaths?((r.kills+r.assists)/r.deaths).toFixed(2):'Perfect'):'—';

export function ArenaChampionsPanel({account,matches,isDemo}:{account:RiotAccount;matches:Match[];isDemo:boolean}){
  const gallery=useMemo(()=>{
    const map=new Map<string,ChampionRecord>();
    for(const match of matches.slice(0,50)){
      if(!match.champion||match.champion==='Unknown')continue;
      const item=map.get(match.champion)||{name:match.champion,games:0,wins:0,kills:0,deaths:0,assists:0,lastPlayed:null};
      item.games+=1;
      item.wins+=match.result==='WIN'?1:0;
      item.kills+=match.kills;item.deaths+=match.deaths;item.assists+=match.assists;
      if(!item.lastPlayed||Date.parse(match.createdAt)>Date.parse(item.lastPlayed))item.lastPlayed=match.createdAt;
      map.set(item.name,item);
    }
    for(const name of account.champions||[]){
      if(name&&!map.has(name))map.set(name,{name,games:0,wins:0,kills:0,deaths:0,assists:0,lastPlayed:null});
    }
    return [...map.values()].sort((a,b)=>b.games-a.games||Date.parse(b.lastPlayed||'1970-01-01')-Date.parse(a.lastPlayed||'1970-01-01')).slice(0,5);
  },[account.champions,matches]);
  const [selection,setSelection]=useState('');
  const chosen=gallery.find(item=>item.name===selection)||gallery[0];
  if(!chosen)return <section className="arena-pro-champion-card arena-pro-champ-empty" aria-labelledby="arena-pro-champs-heading"><div className="arena-pro-head"><span className="arena-pro-system-tag">CHAMPION INTELLIGENCE / 03</span><h2 id="arena-pro-champs-heading">YOUR <em>CHAMPION POOL</em></h2></div><div className="arena-pro-champ-await"><ArenaIcon name="sword" size={32}/><p>Play a tracked game to start building your personal champion dossier.</p><Link href="/live">START TRACKING ↗</Link></div></section>;

  return <section className="arena-pro-champion-card" aria-labelledby="arena-pro-champs-heading">
    <header className="arena-pro-champ-header">
      <div><span className="arena-pro-system-tag">CHAMPION INTELLIGENCE / YOUR ROLE · {account.role}</span><h2 id="arena-pro-champs-heading">THE <em>CHAMPION POOL</em></h2><p>Explore the champions in your recorded matches. No guessed mastery or performance.</p></div>
      <Link href="/champions" className="arena-pro-champ-link">OPEN CHAMPIONS <ArenaIcon name="external" size={14}/></Link>
    </header>
    <div className="arena-pro-champ-main">
      <div className="arena-pro-champ-showcase">
        <img key={chosen.name} className="arena-pro-champ-portrait" src={championSplash(chosen.name)} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true}}/>
        <div className="arena-pro-champ-vignette"/>
        <div className="arena-pro-champ-showcase-copy">
          <span className="arena-pro-champ-hero-caption"><i/> {chosen.games?'MATCH DATA AVAILABLE':'PLAYER POOL · NO RECORDED GAMES'}</span>
          <h3>{chosen.name}</h3>
          <span className="arena-pro-champ-showcase-ribbon">{chosen.games?'THE RECORD / LAST 50 GAMES':'NEXT GAME STARTS THE RECORD'}</span>
          <div className="arena-pro-champ-statline">
            <div><small>GAMES</small><strong>{chosen.games||'—'}</strong></div>
            <div><small>WIN RATE</small><strong>{winRate(chosen.wins,chosen.games)}</strong></div>
            <div><small>COMBINED KDA</small><strong>{kda(chosen)}</strong></div>
          </div>
          {isDemo&&<small className="arena-pro-champ-demo">DEMONSTRATION DATA</small>}
        </div>
      </div>
      <div className="arena-pro-champ-roster" role="group" aria-label="Select a champion to inspect">
        <div className="arena-pro-champ-roster-title"><span>CHAMPION DOSSIERS</span><small>{gallery.length} SHOWN</small></div>
        {gallery.map((item,index)=><button type="button" key={item.name} onClick={()=>setSelection(item.name)} aria-pressed={chosen.name===item.name} className={'arena-pro-champ-pick '+(chosen.name===item.name?'is-selected':'')}>
          <span className="arena-pro-champ-order">{String(index+1).padStart(2,'0')}</span>
          <span className="arena-pro-champ-tile"><img src={championSplash(item.name)} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true}}/></span>
          <span className="arena-pro-champ-pick-name"><strong>{shorten(item.name)}</strong><small>{item.games?item.games+' RECORDED GAMES':'NOT YET RECORDED'}</small></span>
          <span className="arena-pro-champ-pick-performance">{item.games?winRate(item.wins,item.games):'—'}<small>WIN RATE</small></span>
          <span className="arena-pro-champ-pick-arrow" aria-hidden="true">↗</span>
        </button>)}
        <div className="arena-pro-champ-scout"><ArenaIcon name="eye" size={19}/><p>Champions are only ranked here by recorded match count. OP CLIMB does not invent mastery scores.</p></div>
      </div>
    </div>
  </section>;
}
