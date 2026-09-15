'use client';
import {AppShell} from '@/components/AppShell';
import {MatchCard,PageHead} from '@/components/UI';
import Link from 'next/link';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {coachingLevelFor} from '@/lib/coachingLevel';

const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;

export default function Games(){
  const {active}=useAccount();
  const matches=matchesFor(active.id);
  const recent=matches.slice(0,5);
  const last=matches[0];
  const detail=coachingLevelFor(active.rank);
  const cs=avg(recent.map(m=>m.metrics.csPerMin));
  const deaths=avg(recent.map(m=>m.deaths));

  return <AppShell>
    <PageHead title="Games" subtitle={`${active.gameName}${active.tagline} · ${active.rank} · ${active.role}`} action={<Link href="/uploads" className="btn secondary">ADD A GAME</Link>}/>

    <section className="vf-analyse-hero">
      <div className="vf-analyse-primary">
        <div className="eyebrow">LAST GAME</div>
        <span>{last?.result||'NO GAME YET'}</span>
        <h2>{last?`${last.champion} · ${last.kills}/${last.deaths}/${last.assists}`:'Play or add a game to start'}</h2>
        <p className="muted">{last?'Open the review and we’ll show you the decision worth carrying into your next game.':'The useful part starts when OP CLIMB has one real game to work from.'}</p>
        <Link href={last?`/analyse/${encodeURIComponent(last.id)}`:'/live'}>{last?'OPEN LAST GAME →':'START COMPANION →'}</Link>
      </div>
      <div className="vf-analyse-stats">
        <div><span>GAMES</span><b>{matches.length}</b><small>tracked</small></div>
        {detail.depth>=3&&<div><span>AVG DEATHS</span><b>{recent.length?deaths.toFixed(1):'—'}</b><small>last 5</small></div>}
        {detail.depth>=5&&<div><span>AVG CS/MIN</span><b>{recent.length?cs.toFixed(1):'—'}</b><small>last 5</small></div>}
      </div>
    </section>

    <section className="vf-section-head"><div><div className="eyebrow">YOUR GAMES</div><h2>Pick a game. See what actually mattered.</h2></div><span>{matches.length} GAME{matches.length===1?'':'S'}</span></section>
    <div className="grid two vf-match-grid">{matches.map(m=><MatchCard key={m.id} match={m} detailDepth={detail.depth}/>)}</div>
  </AppShell>;
}
