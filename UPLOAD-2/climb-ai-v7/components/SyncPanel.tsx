'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';

/**
 * Surfaces the real state of the RIOT_API_ENABLED flag by asking the server,
 * rather than hard-coding "coming soon" into the UI. When the flag is on this
 * becomes the sync control; when it is off it is an honest, finished-looking
 * fallback that points at manual upload.
 */

interface SyncStatus{enabled:boolean;regions:string[];message:string}

export function SyncPanel(){
  const [status,setStatus]=useState<SyncStatus|null>(null);
  const [failed,setFailed]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    fetch('/api/riot/sync')
      .then(r=>r.ok?r.json():Promise.reject(new Error(String(r.status))))
      .then(d=>{if(!cancelled)setStatus(d)})
      .catch(()=>{if(!cancelled)setFailed(true)});
    return ()=>{cancelled=true};
  },[]);

  if(failed){
    return <div className="glass sync-panel">
      <span className="sync-dot warn" aria-hidden="true"/>
      <div>
        <div className="eyebrow">MATCH SYNC</div>
        <b>We could not check sync status.</b>
        <small>Your account is safe. Upload a match in the meantime.</small>
      </div>
      <Link className="btn secondary" href="/uploads">UPLOAD MATCH</Link>
    </div>;
  }

  if(!status){
    return <div className="glass sync-panel is-loading" aria-busy="true">
      <span className="sync-dot" aria-hidden="true"/>
      <div>
        <div className="skeleton skeleton-sm"/>
        <div className="skeleton skeleton-lg"/>
      </div>
    </div>;
  }

  return <div className="glass sync-panel">
    <span className={`sync-dot ${status.enabled?'live':''}`} aria-hidden="true"/>
    <div>
      <div className="eyebrow">MATCH SYNC</div>
      <b>{status.enabled?'Riot sync is live.':'Automatic match sync is coming shortly.'}</b>
      <small>
        {status.enabled
          ?`Ranked solo games import automatically across ${status.regions.length} regions.`
          :'Your Hunt runs on uploaded matches until Riot production access is approved.'}
      </small>
    </div>
    <Link className="btn secondary" href={status.enabled?'/analyse':'/uploads'}>
      {status.enabled?'SYNC NOW':'UPLOAD MATCH'}
    </Link>
  </div>;
}
