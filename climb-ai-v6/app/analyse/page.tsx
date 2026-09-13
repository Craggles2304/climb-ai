'use client';
import {AppShell} from '@/components/AppShell';
import {MatchCard,PageHead} from '@/components/UI';
import Link from 'next/link';
import {useAccount,matchesFor} from '@/components/AccountContext';

const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;

export default function Analyse(){
  const {active}=useAccount();
  const matches=matchesFor(active.id);
  const recent=matches.slice(0,5);
  const last=matches[0];
  const cs=avg(recent.map(m=>m.metrics.csPerMin));
  const deaths=avg(recent.map(m=>m.deaths));
  return <AppShell>
    <PageHead title="Analyse" subtitle={`${active.gameName}${active.tagline} · ${active.rank} · ${active.role}`} action={<Link href="/uploads" className="btn primary">UPLOAD MATCH</Link>}/>

    <section className="vf-analyse-hero">
      <div className="vf-analyse-primary">
        <div className="eyebrow">LATEST EVIDENCE</div>
        <span>{last?.result||'NO GAME'}</span>
        <h2>{last?`${last.champion} · ${last.kills}/${last.deaths}/${last.assists}`:'Track or upload your first match'}</h2>
        <Link href={last?`/analyse/${encodeURIComponent(last.id)}`:'/live'}>{last?'OPEN REVIEW →':'START LIVE COMPANION →'}</Link>
      </div>
      <div className="vf-analyse-stats">
        <div><span>TRACKED</span><b>{matches.length}</b><small>games</small></div>
        <div><span>CS / MIN</span><b>{recent.length?cs.toFixed(1):'—'}</b><small>last 5</small></div>
        <div><span>DEATHS</span><b>{recent.length?deaths.toFixed(1):'—'}</b><small>last 5</small></div>
      </div>
    </section>

    <section className="vf-section-head"><div><div className="eyebrow">MATCH LIBRARY</div><h2>Open a game. Find the decision that mattered.</h2></div><span>{matches.length} REVIEWS</span></section>
    <div className="grid two vf-match-grid">{matches.map(m=><MatchCard key={m.id} match={m}/>)}</div>
  </AppShell>;
}
