'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import type {ILPTask} from '@/lib/types';

type MissionHistoryRow={
  id:number|string;
  mission_id:string;
  product:'LOL'|'TFT';
  event_type:'STATE'|'ATTEMPT'|'NOTE'|'CLIMB_SESSION';
  payload:Record<string,unknown>;
  occurred_at:string;
  recorded_at:string;
};
type MissionHistoryResponse={
  ok:boolean;
  rows?:MissionHistoryRow[];
  nextCursor?:string|null;
  error?:string;
};

const shownDate=(row:MissionHistoryRow)=>{
  const claimed=row.event_type==='STATE'?null:row.payload?.at;
  const stamp=(typeof claimed==='string'&&!Number.isNaN(Date.parse(claimed)))?claimed:row.occurred_at;
  const date=new Date(stamp);
  return Number.isNaN(date.getTime())?'Date unavailable':date.toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
};
const sentence=(row:MissionHistoryRow)=>{
  const p=row.payload??{};
  if(row.event_type==='STATE'){
    const status=typeof p.status==='string'?p.status.replaceAll('_',' '):'Updated';
    const completed=typeof p.successfulGames==='number'?p.successfulGames:null;
    return completed===null?`Mission saved · ${status}`:`Mission saved · ${status} · ${completed} proven games`;
  }
  if(row.event_type==='ATTEMPT'){
    const outcome=typeof p.outcome==='string'?p.outcome.replaceAll('_',' '):'Recorded';
    const state=p.evidenceV2&&typeof p.evidenceV2==='object'&&'state' in p.evidenceV2
      ?String(p.evidenceV2.state).replaceAll('_',' '):null;
    return `Game evidence · ${outcome}${state?` · ${state}`:''}`;
  }
  if(row.event_type==='NOTE'){
    const note=typeof p.note==='string'?p.note:'Progress recorded';
    return note.slice(0,220);
  }
  const status=typeof p.status==='string'?p.status:'Updated';
  return `Climb Session · ${status.toLowerCase()}`;
};

export function MissionHistoryTimeline({accountId,missions}:{accountId:string;missions:ILPTask[]}){
  const [rows,setRows]=useState<MissionHistoryRow[]>([]);
  const [cursor,setCursor]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [moreLoading,setMoreLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const titles=useMemo(()=>new Map(missions.map(mission=>[mission.id,mission.title])),[missions]);

  const load=useCallback(async(before:string|null,signal?:AbortSignal)=>{
    if(accountId.startsWith('acct-')||!accountId)return;
    const url=new URL('/api/mission-history',window.location.origin);
    url.searchParams.set('accountId',accountId);
    url.searchParams.set('limit','30');
    if(before)url.searchParams.set('before',before);
    const response=await fetch(url.toString(),{cache:'no-store',signal});
    const body=(await response.json().catch(()=>({ok:false,error:'History response unavailable.'}))) as MissionHistoryResponse;
    if(!response.ok||!body.ok)throw new Error(body.error||'Could not load saved mission history.');
    return body;
  },[accountId]);

  useEffect(()=>{
    const controller=new AbortController();
    setRows([]);
    setCursor(null);
    setError(null);
    setLoading(true);
    void load(null,controller.signal).then(body=>{
      if(controller.signal.aborted)return;
      setRows(body?.rows??[]);
      setCursor(body?.nextCursor??null);
    }).catch(err=>{
      if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Could not load mission history.');
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[load]);

  const loadMore=async()=>{
    if(!cursor||moreLoading)return;
    setMoreLoading(true);
    setError(null);
    try{
      const body=await load(cursor);
      if(!body)return;
      setRows(prev=>{
        const ids=new Set(prev.map(row=>String(row.id)));
        return [...prev,...(body.rows??[]).filter(row=>!ids.has(String(row.id)))];
      });
      setCursor(body.nextCursor??null);
    }catch(err){
      setError(err instanceof Error?err.message:'Could not load older history.');
    }finally{setMoreLoading(false)}
  };

  return <section className="panel" aria-label="Saved mission timeline">
    <div className="eyebrow">CLOUD SAVED · ALL MISSIONS</div>
    <h2>YOUR MISSION TIMELINE</h2>
    <p className="muted">Your mission changes, coaching notes and game evidence are saved to your account. Open this history on another device to pick up where you left off.</p>
    {loading&&<p role="status">Loading saved mission history…</p>}
    {error&&<p role="alert">{error}</p>}
    {!loading&&!error&&!rows.length&&<p>No saved mission events yet. They will appear after your first synced mission.</p>}
    {!!rows.length&&<ol style={{listStyle:'none',margin:'1rem 0',padding:0,display:'grid',gap:'0.65rem'}}>
      {rows.map(row=>{
        const p=row.payload??{};
        const title=typeof p.title==='string'?p.title:(
          p.missionSnapshot&&typeof p.missionSnapshot==='object'&&'title' in p.missionSnapshot
            ?String(p.missionSnapshot.title)
            :titles.get(row.mission_id)??'Previous mission'
        );
        return <li key={String(row.id)} style={{padding:'0.85rem 1rem',border:'1px solid rgba(150,150,150,.25)',borderRadius:'0.75rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
            <strong>{title}</strong>
            <time style={{opacity:0.75,fontSize:'0.85rem'}} dateTime={row.occurred_at}>{shownDate(row)}</time>
          </div>
          <p style={{margin:'0.35rem 0 0'}}>{sentence(row)}</p>
        </li>;
      })}
    </ol>}
    {cursor&&<button type="button" className="btn" disabled={moreLoading} onClick={()=>void loadMore()}>
      {moreLoading?'Loading…':'LOAD OLDER MISSION HISTORY'}
    </button>}
  </section>;
}
