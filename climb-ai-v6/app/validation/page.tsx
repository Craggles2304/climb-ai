'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {useAccount} from '@/components/AccountContext';

type Status='PASS'|'WARN'|'FAIL'|'NA';
type Stage={key:string;label:string;status:Status;detail:string};
type MissionResult={missionId:string;title:string;metric:string;source:string;expectedPass:boolean|null;recordedPass:boolean;banked:boolean;xp:number;consistent:boolean};
type Game={
  matchId:string;externalMatchId:string|null;champion:string;role:string;result:string;rank:string;source:string;occurredAt:string;
  liveSessionId:string|null;snapshotCount:number;maxGameTime:number|null;enrichmentStatus:string;learningPlanStatus:string;
  stages:Stage[];missionResults:MissionResult[];sourceCoverage:string[];overall:Status;
};
type Report={
  ok:boolean;
  account:{id:string;gameName:string;tagline:string;rank:string;rankBand:string;verificationStatus:string};
  summary:{games:number;liveGames:number;passed:number;warnings:number;failed:number;coverage:{live:number;riot:number;decision:number}};
  games:Game[];
  error?:string;
};

const TARGET=20;

export default function ValidationLab(){
  const {active}=useAccount();
  const [report,setReport]=useState<Report|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const response=await fetch('/api/validation-lab?accountId='+encodeURIComponent(active.id),{cache:'no-store'});
      const body=await response.json() as Report;
      if(!response.ok||!body.ok)throw new Error(body.error||'Validation audit unavailable.');
      setReport(body);
    }catch(err){setError(err instanceof Error?err.message:'Validation audit unavailable.')}
    finally{setLoading(false)}
  },[active.id]);

  useEffect(()=>{void load()},[load]);
  useEffect(()=>{
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load()},30_000);
    return()=>window.clearInterval(timer);
  },[load]);

  const liveProgress=Math.min(TARGET,report?.summary.liveGames??0);
  const stages=useMemo(()=>['detected','identity','telemetry','closed','riot','mission','rank','xp','plan','surfaces'],[]);
  const stageLabels:Record<string,string>={
    detected:'DETECTED',identity:'PLAYER / ROLE',telemetry:'TELEMETRY',closed:'CLOSED',riot:'RIOT',mission:'MISSION',
    rank:'RANK BAR',xp:'XP ONCE',plan:'ILP SYNC',surfaces:'SHARED STATE',
  };

  return <AppShell>
    <section className="vl-head">
      <div>
        <div className="eyebrow">REAL-GAME QA</div>
        <h1>Validation Lab</h1>
        <p>Play genuine Ranked games normally. OP CLIMB audits the full pipeline automatically after each one.</p>
      </div>
      <button className="btn secondary" type="button" onClick={()=>void load()} disabled={loading}>{loading?'CHECKING…':'REFRESH AUDIT'}</button>
    </section>

    {error&&<section className="vl-error">{error}</section>}

    <section className="vl-progress">
      <div className="vl-progress-main">
        <span>LIVE TEST RUN</span>
        <b>{liveProgress}/{TARGET}</b>
        <small>{TARGET-liveProgress>0?(TARGET-liveProgress)+' genuine Companion games still wanted':'20-game validation target reached'}</small>
        <i><em style={{width:Math.round(liveProgress/TARGET*100)+'%'}}/></i>
      </div>
      <Metric label="FULL PASS" value={String(report?.summary.passed??0)} sub="no pipeline warnings"/>
      <Metric label="WARNINGS" value={String(report?.summary.warnings??0)} sub="needs inspection"/>
      <Metric label="FAILURES" value={String(report?.summary.failed??0)} sub="must be fixed"/>
    </section>

    <section className="vl-coverage">
      <div><span>LIVE MEASURABLE</span><b>{report?.summary.coverage.live??0}</b><small>games covering a live-derived mission</small></div>
      <div><span>RIOT POST-GAME</span><b>{report?.summary.coverage.riot??0}</b><small>games covering a Riot-enriched mission</small></div>
      <div><span>DECISION EVIDENCE</span><b>{report?.summary.coverage.decision??0}</b><small>games covering a decision-score mission</small></div>
    </section>

    <section className="vl-guide">
      <div>
        <span>WHAT COUNTS AS DONE?</span>
        <p>Get several games through each evidence source, include wins and losses, and deliberately cover more than one role/mission type. A green row means every applicable stored check agrees.</p>
      </div>
      <Link className="btn primary" href="/live">OPEN COMPANION →</Link>
    </section>

    <section className="vl-matrix">
      <header>
        <div>GAME</div>
        {stages.map(key=><div key={key}>{stageLabels[key]}</div>)}
      </header>
      {report?.games.length?report.games.map((game,index)=><GameRow key={game.matchId} game={game} index={index} stageKeys={stages}/>):<div className="vl-empty">
        <div className="eyebrow">NO TEST GAMES YET</div>
        <h2>Start with one genuine Ranked game.</h2>
        <p>Pair the Companion, play normally and come back here after the game closes.</p>
      </div>}
    </section>

    <section className="vl-legend">
      <span><i className="pass"/>PASS</span>
      <span><i className="warn"/>WARN</span>
      <span><i className="fail"/>FAIL</span>
      <span><i className="na"/>N/A</span>
      <p>Warnings are allowed while validating. Failures identify a broken pipeline stage that should be fixed before launch.</p>
    </section>
  </AppShell>;
}

function Metric({label,value,sub}:{label:string;value:string;sub:string}){
  return <div className="vl-metric"><span>{label}</span><b>{value}</b><small>{sub}</small></div>;
}

function GameRow({game,index,stageKeys}:{game:Game;index:number;stageKeys:string[]}){
  const [open,setOpen]=useState(false);
  const byKey=new Map<string,Stage>(game.stages.map(stage=>[stage.key,stage] as const));
  return <article className={'vl-row is-'+game.overall.toLowerCase()}>
    <button className="vl-row-main" type="button" onClick={()=>setOpen(value=>!value)}>
      <div className="vl-game">
        <span>#{String(index+1).padStart(2,'0')} · {game.result}</span>
        <b>{game.champion}</b>
        <small>{game.role} · {game.rank||'rank pending'} · {new Date(game.occurredAt).toLocaleDateString()}</small>
      </div>
      {stageKeys.map(key=>{
        const stage=byKey.get(key);
        return <div key={key} className="vl-stage" title={stage?.detail||''}>
          <i className={(stage?.status||'NA').toLowerCase()}/>
          <small>{stage?.status||'NA'}</small>
        </div>;
      })}
    </button>
    {open&&<div className="vl-detail">
      <div className="vl-detail-meta">
        <span>SOURCE <b>{game.source}</b></span>
        <span>SNAPSHOTS <b>{game.snapshotCount}</b></span>
        <span>RIOT <b>{game.enrichmentStatus}</b></span>
        <span>ILP <b>{game.learningPlanStatus}</b></span>
      </div>
      <div className="vl-detail-stages">
        {game.stages.map(stage=><div key={stage.key}><i className={stage.status.toLowerCase()}/><span>{stage.label}</span><p>{stage.detail}</p></div>)}
      </div>
      {game.missionResults.length>0&&<div className="vl-mission-results">
        <div className="eyebrow">MISSION RESULTS</div>
        {game.missionResults.map(result=><div key={result.missionId}>
          <span>{result.source}</span>
          <b>{result.title}</b>
          <strong className={result.consistent?'pass':'fail'}>{result.expectedPass===null?'NO GRADE':result.recordedPass?'PASS':'MISS'}</strong>
          <small>{result.banked?'REP BANKED':'NO REP'} · {result.xp} XP</small>
        </div>)}
      </div>}
    </div>}
  </article>;
}
