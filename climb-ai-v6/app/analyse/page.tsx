'use client';
import {AppShell} from '@/components/AppShell';
import {MatchCard,PageHead} from '@/components/UI';
import Link from 'next/link';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {coachingLevelFor} from '@/lib/coachingLevel';

const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;

export default function Analyse(){
  const {active}=useAccount();
  const matches=matchesFor(active.id);
  const recent=matches.slice(0,5);
  const last=matches[0];
  const detail=coachingLevelFor(active.rank);
  const cs=avg(recent.map(m=>m.metrics.csPerMin));
  const deaths=avg(recent.map(m=>m.deaths));
  return <AppShell>
    <PageHead title="Analyse" subtitle={`${active.gameName}${active.tagline} · ${active.rank} · ${detail.tier} VIEW ${detail.depth}/10`} action={<Link href="/uploads" className="btn primary">UPLOAD MATCH</Link>}/>

    <section className="vf-analyse-hero">
      <div className="vf-analyse-primary">
        <div className="eyebrow">LATEST EVIDENCE · {detail.tier} DETAIL</div>
        <span>{last?.result||'NO GAME'}</span>
        <h2>{last?`${last.champion} · ${last.kills}/${last.deaths}/${last.assists}`:'Track or upload your first match'}</h2>
        {detail.depth>=3&&<p className="muted">{detail.summary}</p>}
        <Link href={last?`/analyse/${encodeURIComponent(last.id)}`:'/live'}>{last?'OPEN REVIEW →':'START LIVE COMPANION →'}</Link>
      </div>
      <div className="vf-analyse-stats">
        <div><span>TRACKED</span><b>{matches.length}</b><small>games</small></div>
        {detail.depth>=2&&<div><span>DEATHS</span><b>{recent.length?deaths.toFixed(1):'—'}</b><small>last 5</small></div>}
        {detail.depth>=3&&<div><span>CS / MIN</span><b>{recent.length?cs.toFixed(1):'—'}</b><small>last 5</small></div>}
      </div>
    </section>

    <section className="vf-section-head"><div><div className="eyebrow">MATCH LIBRARY · {detail.tier}</div><h2>{detail.depth<=2?'Open a game. See the one thing that mattered.':'Open a game. Find the decision that mattered.'}</h2></div><span>{matches.length} REVIEWS</span></section>
    <div className="grid two vf-match-grid">{matches.map(m=><MatchCard key={m.id} match={m} detailDepth={detail.depth}/>)}</div>
  </AppShell>;
}
