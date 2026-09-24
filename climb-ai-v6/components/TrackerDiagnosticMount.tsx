'use client';
import {useCallback,useEffect,useState} from 'react';
import {useAccount} from './AccountContext';

type TrackerState={
  id:string;device_name:string;last_seen_at:string|null;tracker_status_updated_at:string|null;
  tracker_status?:{state?:string;runtimeVersion?:string;lcuDetected?:boolean;champSelectDetected?:boolean;detail?:string|null}|null;
};

export function TrackerDiagnosticMount(){
  const {active}=useAccount();
  const [status,setStatus]=useState<TrackerState|null>(null);
  const refresh=useCallback(async()=>{
    try{
      const response=await fetch(`/api/live/status?accountId=${encodeURIComponent(active.id)}`,{cache:'no-store'});
      if(!response.ok)return;
      const body=await response.json();setStatus(body.status??null);
    }catch{}
  },[active.id]);
  useEffect(()=>{
    void refresh();
    const tick=()=>{if(document.visibilityState==='visible')void refresh()};
    const id=window.setInterval(tick,8_000);
    document.addEventListener('visibilitychange',tick);
    return()=>{window.clearInterval(id);document.removeEventListener('visibilitychange',tick)};
  },[refresh]);
  if(!status)return null;
  const stamp=status.tracker_status_updated_at||status.last_seen_at;
  const age=stamp?Date.now()-new Date(stamp).getTime():Number.POSITIVE_INFINITY;
  const connected=Number.isFinite(age)&&age<30_000;
  const t=status.tracker_status||{};
  const headline=!connected?'TRACKER OFFLINE':t.state==='RECORDING'?'MATCH RECORDING':t.champSelectDetected?'CHAMP SELECT FOUND':t.lcuDetected?'LEAGUE CLIENT FOUND':'TRACKER CONNECTED · LCU NOT FOUND';
  const detail=!connected
    ?`No tracker heartbeat in the last 30 seconds${stamp?` · last contact ${new Date(stamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`:''}.`
    :(t.detail||'Tracker heartbeat received.');
  return <section className="dash-section" style={{marginBottom:12}}><div className="glass card" style={{padding:16,borderColor:connected?'rgba(182,246,107,.32)':'rgba(255,110,90,.4)'}}><div className="eyebrow">LOCAL COMPANION DIAGNOSTICS</div><div style={{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}><div><h3 style={{margin:'6px 0 4px'}}>{headline}</h3><p className="muted" style={{margin:0}}>{detail}</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Badge on={connected} label="TRACKER"/><Badge on={Boolean(connected&&t.lcuDetected)} label="LCU"/><Badge on={Boolean(connected&&t.champSelectDetected)} label="CHAMP SELECT"/></div></div>{connected&&t.runtimeVersion&&<p className="muted" style={{fontSize:12,margin:'10px 0 0'}}>Runtime {t.runtimeVersion}</p>}</div></section>;
}
function Badge({on,label}:{on:boolean;label:string}){return <span style={{padding:'6px 9px',borderRadius:999,border:'1px solid rgba(255,255,255,.14)',fontSize:11,fontWeight:800,opacity:on?1:.5}}>{on?'✓':'×'} {label}</span>}