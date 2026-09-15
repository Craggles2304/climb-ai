'use client';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import Link from 'next/link';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {championPlans} from '@/data/learning';
import {coachingLevelFor} from '@/lib/coachingLevel';
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
export default function Champions(){
  const {active}=useAccount();
  const matches=matchesFor(active.id);
  const detail=coachingLevelFor(active.rank);
  const count=detail.depth<=2?1:detail.depth<=4?2:3;
  return <AppShell>
    <PageHead title="Your Champions" subtitle={`${active.gameName}${active.tagline} · ${active.rank} · ${detail.tier} CHAMPION VIEW ${detail.depth}/10`}/>
    <div className="grid three">{active.champions.slice(0,count).map((ch,i)=>{
      const ms=matches.filter(m=>m.champion===ch);const plan=championPlans[ch];const cs=ms.length?avg(ms.map(m=>m.metrics.csPerMin)).toFixed(1):'—';
      return <Link href={`/champions/${encodeURIComponent(ch)}`} className="glass champion-tile" key={ch}>
        <span className="champ-rank">0{i+1}</span><div className="eyebrow">{detail.tier} · {active.role}</div><h2>{ch}</h2>
        {detail.depth>=2&&<p className="muted">{plan?.identity||'Your champion development plan.'}</p>}
        <div className="league-row"><span>Tracked games</span><b>{ms.length}</b></div>
        {detail.depth>=3&&<div className="league-row"><span>CS/min</span><b>{cs}</b></div>}
        {detail.depth>=5&&<div className="league-row"><span>Plan grows into</span><b>Lane · Farm · Fight · Side lane · Build</b></div>}
      </Link>})}</div>
    {detail.depth>=7&&<div className="glass card data-note" style={{marginTop:18}}><div className="eyebrow">DATA NOTE</div><p className="muted">Build recommendations need current-patch evidence filtered by champion, role and rank. OP CLIMB keeps source/freshness detail for advanced views instead of cluttering lower-rank coaching.</p></div>}
  </AppShell>;
}
