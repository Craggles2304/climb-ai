'use client';
import {useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {MatchCard,PageHead} from '@/components/UI';
import Link from 'next/link';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {coachingLevelFor} from '@/lib/coachingLevel';

const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;

export default function Games(){
  const {active}=useAccount();
  const matches=matchesFor(active.id);
  const [roleFilter,setRoleFilter]=useState('ALL');
  const [championFilter,setChampionFilter]=useState('ALL');
  const roles=['ALL',...Array.from(new Set(matches.map(m=>m.role)))];
  const champions=['ALL',...Array.from(new Set(matches.map(m=>m.champion)))];
  const filtered=matches.filter(m=>(roleFilter==='ALL'||m.role===roleFilter)&&(championFilter==='ALL'||m.champion===championFilter));
  const recent=filtered.slice(0,5);
  const last=filtered[0];
  const detail=coachingLevelFor(active.rank);
  const cs=avg(recent.map(m=>m.metrics.csPerMin));
  const deaths=avg(recent.map(m=>m.deaths));

  return <AppShell>
    <PageHead title="My Games" subtitle={active.gameName+active.tagline+' · '+active.rank+' · '+active.role} action={<Link href="/uploads" className="btn secondary">ADD A GAME</Link>}/>

    <section className="game-context-filters">
      <div><span>ROLE</span><div>{roles.map(role=><button key={role} type="button" className={roleFilter===role?'active':''} onClick={()=>setRoleFilter(role)}>{role}</button>)}</div></div>
      <label><span>CHAMPION</span><select value={championFilter} onChange={event=>setChampionFilter(event.target.value)}>{champions.map(champion=><option key={champion}>{champion}</option>)}</select></label>
      <small>Keep role and champion evidence separate when you want a cleaner read.</small>
    </section>

    <section className="vf-analyse-hero">
      <div className="vf-analyse-primary">
        <div className="eyebrow">LAST GAME IN THIS VIEW</div>
        <span>{last?.result||'NO GAME YET'}</span>
        <h2>{last?(last.champion+' · '+last.kills+'/'+last.deaths+'/'+last.assists):'No games match this filter'}</h2>
        <p className="muted">{last?'Open the review and we’ll show you the decision worth carrying into your next game.':'Switch the role or champion filter to bring games back into view.'}</p>
        {last&&<Link href={'/analyse/'+encodeURIComponent(last.id)}>OPEN LAST GAME →</Link>}
      </div>
      <div className="vf-analyse-stats">
        <div><span>GAMES</span><b>{filtered.length}</b><small>in this view</small></div>
        {detail.depth>=3&&<div><span>AVG DEATHS</span><b>{recent.length?deaths.toFixed(1):'—'}</b><small>last 5 here</small></div>}
        {detail.depth>=5&&<div><span>AVG CS/MIN</span><b>{recent.length?cs.toFixed(1):'—'}</b><small>last 5 here</small></div>}
      </div>
    </section>

    <section className="vf-section-head"><div><div className="eyebrow">YOUR GAMES</div><h2>Pick a game. See what actually mattered.</h2></div><span>{filtered.length} GAME{filtered.length===1?'':'S'}</span></section>
    <div className="grid two vf-match-grid">{filtered.map(m=><MatchCard key={m.id} match={m} detailDepth={detail.depth}/>)}</div>
  </AppShell>;
}
