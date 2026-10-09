'use client';

import Link from 'next/link';
import type {Match} from '@/lib/types';
import {championSplash} from '@/lib/championArt';
import {ArenaSparkline} from '@/components/ArenaSparkline';

const formDate=(iso:string)=>{
  const value=Date.parse(iso);
  return Number.isFinite(value)?new Date(value).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'Date unavailable';
};
const fixed=(value:number)=>Number.isFinite(value)&&value>0?value.toFixed(1):'—';

export function DashboardMatchInsights({matches,isDemo,mode}:{matches:Match[];isDemo:boolean;mode:'form'|'archive'}){
  const recent=matches.slice(0,10);
  const wins=recent.filter(match=>match.result==='WIN').length;
  const winRate=recent.length?Math.round(wins/recent.length*100):null;
  const csGames=recent.filter(match=>Number.isFinite(match.metrics.csPerMin)&&match.metrics.csPerMin>0);
  const averageCS=csGames.length?(csGames.reduce((sum,match)=>sum+match.metrics.csPerMin,0)/csGames.length).toFixed(1):'—';
  const kills=recent.reduce((sum,match)=>sum+match.kills,0);
  const assists=recent.reduce((sum,match)=>sum+match.assists,0);
  const deaths=recent.reduce((sum,match)=>sum+match.deaths,0);
  const kda=recent.length?(deaths?((kills+assists)/deaths).toFixed(2):'Perfect'):'—';
  const oldestFirst=recent.slice().reverse();
  const winSeries=oldestFirst.map((_,i)=>Math.round(oldestFirst.slice(0,i+1).filter(m=>m.result==='WIN').length/(i+1)*100));
  const kdaSeries=oldestFirst.filter(m=>m.deaths>0).map(m=>(m.kills+m.assists)/m.deaths);
  const csSeries=oldestFirst.filter(m=>m.metrics.csPerMin>0&&Number.isFinite(m.metrics.csPerMin)).map(m=>m.metrics.csPerMin);

  return <>
    {mode==='form'&&<section className="arena-original-insights" aria-labelledby="arena-original-insights-heading">
      <header className="arena-original-section-heading">
        <div><span className="eyebrow">MATCH EVIDENCE / LAST 10 GAMES</span><h2 id="arena-original-insights-heading">YOUR RECENT FORM</h2></div>
        {isDemo&&<span className="arena-original-demo-tag">DEMO MATCHES</span>}
        <Link className="arena-original-text-action" href="/analyse">FULL MATCH HISTORY ↗</Link>
      </header>
      <div className="arena-original-insights-grid">
        <div className="arena-original-stat"><small>WIN RATE</small><strong>{winRate===null?'—':winRate+'%'}</strong><ArenaSparkline points={winSeries} label="Cumulative win percentage by game" color="#b6ff2e"/><span>{recent.length?wins+' wins in '+recent.length+' matches':'Play your first tracked game'}</span></div>
        <div className="arena-original-stat"><small>COMBINED KDA</small><strong>{kda}</strong><ArenaSparkline points={kdaSeries} label="KDA over recent games with deaths" color="#5de6d6"/><span>{recent.length?'Kills + assists ÷ deaths':'No combat data yet'}</span></div>
        <div className="arena-original-stat"><small>AVERAGE CS/MIN</small><strong>{averageCS}</strong><ArenaSparkline points={csSeries} label="CS per minute across recorded games" color="#af9bff"/><span>{csGames.length?'From '+csGames.length+' recorded games':'Waiting for farm metrics'}</span></div>
        <div className="arena-original-form"><small>RESULTS / OLDEST → NEWEST</small><div role="img" aria-label={recent.length?recent.slice().reverse().map(m=>m.result==='WIN'?'Victory':'Defeat').join(', '):'No recorded results'}>{recent.length?recent.slice().reverse().map(match=><span key={match.id} className={match.result==='WIN'?'is-win':'is-loss'} title={match.champion+' · '+match.result}>{match.result==='WIN'?'W':'L'}</span>):<span className="arena-original-no-form">AWAITING MATCHES</span>}</div><p>{recent.length+' of 10 games recorded'}</p></div>
      </div>
    </section>}
    {mode==='archive'&&<section className="arena-original-match-archive" aria-labelledby="arena-original-archive-heading">
      <header className="arena-original-section-heading">
        <div><span className="eyebrow">MATCH ROOM / PERFORMANCE EVIDENCE</span><h2 id="arena-original-archive-heading">RECENT MATCHES</h2></div>
        <Link className="arena-original-text-action" href="/analyse">VIEW ALL MATCHES ↗</Link>
      </header>
      {matches.length?<div className="arena-original-match-list">
        <div className="arena-original-match-columns" aria-hidden="true"><span>CHAMPION / OUTCOME</span><span>K / D / A</span><span>CS / MIN</span><span>GAME TIME</span><span>PLAYED</span><span>REVIEW</span></div>
        {matches.slice(0,5).map(match=><Link key={match.id} className={'arena-original-match-row '+(match.result==='WIN'?'is-win':'is-loss')} href={'/analyse/'+encodeURIComponent(String(match.id))} aria-label={match.champion+' '+(match.result==='WIN'?'victory':'defeat')+' — review match'}>
          <span className="arena-original-match-champ">
            <span className="arena-original-champ-photo"><img src={championSplash(match.champion)} loading="lazy" alt="" onError={event=>{event.currentTarget.hidden=true}}/></span>
            <span><b>{match.champion}</b><small>{match.result==='WIN'?'VICTORY':'DEFEAT'} · {match.role}</small></span>
          </span>
          <span className="arena-original-match-stat">{match.kills} / {match.deaths} / {match.assists}</span>
          <span className="arena-original-match-stat">{fixed(match.metrics.csPerMin)}</span>
          <span className="arena-original-match-stat">{Math.floor(match.durationSeconds/60)} MIN</span>
          <span className="arena-original-match-date">{formDate(match.createdAt)}</span>
          <span className="arena-original-match-go" aria-hidden="true">↗</span>
        </Link>)}
      </div>:<div className="arena-original-empty"><b>YOUR MATCH HISTORY STARTS HERE</b><p>Track your first match to unlock genuine stats, champion portraits, match outcomes and review links.</p><Link href="/live">OPEN MATCH ROOM ↗</Link></div>}
    </section>}
  </>;
}
