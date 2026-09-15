'use client';
import {useParams} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {MetricCard,PageHead} from '@/components/UI';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {championPlans} from '@/data/learning';
import {ChampionDataPanel} from '@/components/ChampionDataPanel';
import {coachingLevelFor} from '@/lib/coachingLevel';
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
function List({title,items,limit}:{title:string;items:string[];limit:number}){return <div className="glass card champ-plan"><div className="eyebrow">{title}</div><ol>{items.slice(0,limit).map((x,i)=><li key={x}><span>0{i+1}</span><p>{x}</p></li>)}</ol></div>}
export default function Champion(){
  const params=useParams<{champion:string}>();
  const name=decodeURIComponent(params.champion);
  const {active}=useAccount();
  const detail=coachingLevelFor(active.rank);
  const ms=matchesFor(active.id).filter(m=>m.champion.toLowerCase()===name.toLowerCase());
  const plan=championPlans[name];
  const wins=ms.filter(m=>m.result==='WIN').length;
  const a=(f:(m:any)=>number)=>avg(ms.map(f));
  const limit=detail.visiblePoints;
  return <AppShell>
    <PageHead title={name.toUpperCase()} subtitle={`${active.rank} · ${active.role} · ${detail.tier} CHAMPION VIEW ${detail.depth}/10`}/>
    <div className="champ-hero glass"><div><div className="eyebrow">CHAMPION IDENTITY · {detail.tier}</div><h2>{plan?.identity||'Build a champion-specific plan from tracked matches and current patch data.'}</h2>{detail.depth>=3&&<p className="muted">{detail.summary}</p>}</div><div className="champ-badge">{detail.tier}<small>{detail.depth}/10</small></div></div>

    {ms.length>0&&<div className="grid five" style={{marginTop:16}}>
      <MetricCard label="GAMES" value={ms.length}/>
      {detail.depth>=2&&<MetricCard label="DEATHS" value={a(m=>m.deaths).toFixed(1)}/>} 
      {detail.depth>=3&&<MetricCard label="CS/MIN" value={a(m=>m.metrics.csPerMin).toFixed(1)}/>} 
      {detail.depth>=4&&<MetricCard label="WIN RATE" value={`${Math.round(wins/ms.length*100)}%`}/>} 
      {detail.depth>=5&&<MetricCard label="POST-15" value={a(m=>m.metrics.post15CsPerMin||m.metrics.csPerMin).toFixed(1)}/>} 
    </div>}

    {plan?<>
      <div className="grid three" style={{marginTop:16}}>
        <List title="LANE PLAN" items={plan.lanePlan} limit={limit}/>
        {detail.depth>=2&&<List title="TEAMFIGHT JOB" items={plan.teamfightPlan} limit={limit}/>} 
        {detail.depth>=3&&<List title="FARM / ECONOMY" items={plan.farmPlan} limit={limit}/>} 
      </div>
      {detail.depth>=4&&<div className="grid three" style={{marginTop:16}}>
        {detail.depth>=4&&<List title="POWER SPIKES" items={plan.powerSpikes} limit={limit}/>} 
        {detail.depth>=5&&<List title="COMMON LEAKS" items={plan.commonLeaks} limit={limit}/>} 
        {detail.depth>=6&&<List title="SIDE-LANE RULES" items={plan.sideLanePlan} limit={limit}/>} 
      </div>}
      {detail.depth>=3&&<div className="glass build-panel"><div><div className="eyebrow">RANK BUILD · {plan.rankBand}</div><h2>{plan.build.label}</h2>{detail.depth>=5&&<p className="muted">{plan.build.note}</p>}</div><div className="build-items">{plan.build.items.slice(0,detail.depth<=4?3:plan.build.items.length).map(x=><span key={x}>{x}</span>)}</div>{detail.depth>=7&&<div className="meta-source"><b>{plan.build.sourceLabel}</b><span>Patch, rank filter, sample and freshness matter. OP CLIMB should not silently present stale build data.</span><div className="meta-links"><a target="_blank" rel="noreferrer" href={`https://u.gg/lol/champions/${name.toLowerCase().replaceAll("'",'').replaceAll(' ','')}/build`}>U.GG ↗</a><a target="_blank" rel="noreferrer" href={`https://lolalytics.com/lol/${name.toLowerCase().replaceAll("'",'').replaceAll(' ','')}/build/`}>LOLALYTICS ↗</a><a target="_blank" rel="noreferrer" href={`https://www.op.gg/champions/${name.toLowerCase().replaceAll("'",'').replaceAll(' ','')}/build`}>OP.GG ↗</a></div></div>}</div>}
      <div className="glass card" style={{marginTop:16}}><div className="eyebrow">WHAT TO MASTER AT {active.rank.split(' · ')[0].toUpperCase()}</div><div className="rank-focus">{plan.rankFocus.slice(0,limit).map((x,i)=><div key={x}><strong>0{i+1}</strong><p>{x}</p></div>)}</div></div>
    </>:<div className="glass card"><h2>Champion plan not generated yet.</h2><p className="muted">The measured champion data below still gives you a rank-sized plan.</p></div>}

    <ChampionDataPanel champion={name} depth={detail.depth}/>
  </AppShell>;
}
