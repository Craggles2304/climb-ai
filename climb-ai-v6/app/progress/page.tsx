'use client';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts';
import {climbScore} from '@/lib/engine';
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const delta=(a:number,b:number)=>a-b;
const signed=(n:number,digits=1)=>`${n>0?'+':''}${n.toFixed(digits)}`;

export default function Progress(){
  const {active}=useAccount();
  const matches=matchesFor(active.id);
  const ordered=[...matches].reverse();
  const data=ordered.map((m,i)=>({game:i+1,full:m.metrics.csPerMin,post:m.metrics.post15CsPerMin||m.metrics.csPerMin,deaths:m.deaths}));
  const recent=matches.slice(0,5),previous=matches.slice(5,10);
  const cs=avg(recent.map(m=>m.metrics.csPerMin));
  const post=avg(recent.map(m=>m.metrics.post15CsPerMin||m.metrics.csPerMin));
  const deaths=avg(recent.map(m=>m.deaths));
  const prevPost=avg(previous.map(m=>m.metrics.post15CsPerMin||m.metrics.csPerMin));
  const prevDeaths=avg(previous.map(m=>m.deaths));
  const score=climbScore(matches);
  const postDelta=previous.length?delta(post,prevPost):0;
  const deathDelta=previous.length?delta(prevDeaths,deaths):0;
  const trend=postDelta>0.2||deathDelta>0.4?'IMPROVING':postDelta<-0.2||deathDelta<-0.4?'SLIPPING':'STABLE';

  return <AppShell>
    <PageHead title="Progress" subtitle={`${active.gameName}${active.tagline} · ${active.rank} · last ${Math.min(10,matches.length)} tracked games`}/>

    <section className="vf-progress-hero">
      <div className="vf-op-score" style={{'--score':`${Math.max(0,Math.min(100,score))}%`} as React.CSSProperties}>
        <div><span>OP SCORE</span><strong>{score}</strong><small>{trend}</small></div>
      </div>
      <div className="vf-progress-signals">
        <div><span>POST-15 CS</span><strong>{post.toFixed(1)}</strong><small className={postDelta>=0?'success':'danger'}>{previous.length?signed(postDelta):'NEW'} vs previous 5</small></div>
        <div><span>DEATH CONTROL</span><strong>{deaths.toFixed(1)}</strong><small className={deathDelta>=0?'success':'danger'}>{previous.length?`${signed(deathDelta)} fewer`:'NEW'} vs previous 5</small></div>
        <div><span>FULL-GAME CS</span><strong>{cs.toFixed(1)}</strong><small>{active.role==='ADC'?'ECONOMY':'CONTEXT'}</small></div>
      </div>
    </section>

    <section className="vf-progress-chart">
      <div className="vf-chart-head"><div><div className="eyebrow">ECONOMY TREND</div><h2>Are you keeping your game together after lane?</h2></div><div className="vf-chart-legend"><span><i className="full"/>FULL</span><span><i className="post"/>POST-15</span></div></div>
      <div style={{height:330}}><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid stroke="rgba(255,255,255,.045)" vertical={false}/><XAxis dataKey="game" stroke="#66707b" tickLine={false}/><YAxis domain={[3,8]} stroke="#66707b" tickLine={false}/><Tooltip contentStyle={{background:'#0d1117',border:'1px solid rgba(255,255,255,.08)',borderRadius:12}}/><Line type="monotone" dataKey="full" stroke="#53a1ff" strokeWidth={3} dot={false}/><Line type="monotone" dataKey="post" stroke="#d6ff2f" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer></div>
    </section>

    <section className="vf-progress-verdict">
      <div><div className="eyebrow">COACH VERDICT</div><h2>{active.role==='ADC'?(postDelta>=0?'Your mid-game economy is moving the right way.':'Your farm is still leaking after lane.'):'Your trend needs role-specific weighting.'}</h2></div>
      <div className="vf-verdict-action"><span>NEXT SIGNAL</span><b>{active.role==='ADC'?'Protect the last wave before objective setup.':'Track objective timing and deaths around setup.'}</b></div>
    </section>
  </AppShell>;
}
