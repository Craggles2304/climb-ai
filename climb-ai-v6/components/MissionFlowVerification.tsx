'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useAccount} from '@/components/AccountContext';
import {gameDnaFocusSource,gameMissionFocusPair} from '@/lib/gameDnaSnapshot';
import {taskAppliesToRole} from '@/lib/roleAwareLearning';
import {verifiedMissionRep} from '@/lib/verifiedMissionProof';
import type {ILPTask} from '@/lib/types';

type PairedDevice={account_key?:string;last_seen_at?:string|null};
type LiveReview={status?:string;lastSeenAt?:string|null;snapshotCount?:number;matchId?:string|null;summary?:{processing?:{status?:string|null}|null}|null}|null;
type CloudRow={id:string;payload:Partial<ILPTask>};
type Health={
  linked:boolean;online:boolean;deviceCount:number;
  review:LiveReview;focusSource:string;chosen:number;
  proof:{outcome:'PROVEN'|'MISSED'|'NOT OBSERVED';when:string;reason:string;sameMatch:boolean|null}|null;
  checkedAt:string;
};
const within=(at:string|undefined|null,ms:number)=>{
  const n=Date.parse(at||'');return Number.isFinite(n)&&Date.now()-n>=-60000&&Date.now()-n<ms;
};

/** Account-scoped, read-only validation of the actual Companion -> server -> mission chain.
 * A website request cannot simulate or confirm a real Windows match.
 */
export function MissionFlowVerification(){
  const {active,authenticated,hydrated}=useAccount();
  const [result,setResult]=useState<Health|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const inspect=useCallback(async()=>{
    if(!authenticated||!hydrated||!active.id)return;
    setLoading(true);setError('');
    try{
      const urls=['/api/live/pair','/api/live/telemetry?accountId='+encodeURIComponent(active.id),'/api/ilp/plan?accountId='+encodeURIComponent(active.id)];
      const responses=await Promise.all(urls.map(url=>fetch(url,{cache:'no-store',credentials:'same-origin'})));
      const data=await Promise.all(responses.map(res=>res.json().catch(()=>null)));
      const failure=responses.findIndex((res,i)=>!res.ok||data[i]?.ok!==true);
      if(failure!==-1)throw Error('An account-scoped tracking check failed ('+responses[failure].status+'). Retry when signed in.');
      const devices=(Array.isArray(data[0].devices)?data[0].devices:[]) as PairedDevice[];
      const owned=devices.filter(device=>device.account_key===active.id);
      const review=(data[1].review??null) as LiveReview;
      const rows=(Array.isArray(data[2].rows)?data[2].rows:[]) as CloudRow[];
      const tasks=rows.map(row=>({...row.payload,id:row.id,accountId:active.id} as ILPTask))
        .filter(task=>taskAppliesToRole(task,active.role));
      const focus=gameMissionFocusPair(tasks,active.role);
      const recent=focus.flatMap(({task})=>(task.missionHistory??[]).map(attempt=>({task,attempt})))
        .filter(item=>item.attempt.matchId&&Number.isFinite(Date.parse(item.attempt.at)))
        .sort((a,b)=>Date.parse(b.attempt.at)-Date.parse(a.attempt.at))[0];
      const state=recent?(verifiedMissionRep(recent.task,recent.attempt)?'PROVEN':recent.attempt.evidenceV2?.state==='MISSED'?'MISSED':'NOT OBSERVED'):null;
      const proof=recent&&state?{
        outcome:state,when:recent.attempt.at,
        reason:String(recent.attempt.evidenceV2?.reason||'No timestamped proof was available for this attempt.'),
        sameMatch:review?.matchId?String(review.matchId)===String(recent.attempt.matchId):null,
      }:null;
      setResult({
        linked:owned.length>0,online:owned.some(device=>within(device.last_seen_at,75_000)),deviceCount:owned.length,
        review,focusSource:gameDnaFocusSource(tasks,active.role),
        chosen:focus.length,proof,checkedAt:new Date().toISOString(),
      });
    }catch(caught){setError(caught instanceof Error?caught.message:'The live tracking check could not be completed.');}
    finally{setLoading(false)}
  },[active.id,active.role,authenticated,hydrated]);
  useEffect(()=>{if(!authenticated||!hydrated){setResult(null);return;}void inspect()},[inspect,authenticated,hydrated]);
  if(!hydrated)return null;
  if(!authenticated)return <section className="mission-health"><h3>LIVE MATCH-TO-MISSION CHECK</h3><p>Sign in and connect your Riot account to verify the real coaching data flow. Demo games cannot prove live tracking.</p><Link href="/login">SIGN IN ↗</Link></section>;
  const recording=result?.review?.status==='ACTIVE'&&within(result.review.lastSeenAt,90_000);
  const captured=Boolean(result?.review&&(Number(result.review.snapshotCount)||0)>0);
  const processed=String(result?.review?.summary?.processing?.status??'').toUpperCase();
  const recordedEvidence=result?.proof;
  return <section className="mission-health" aria-labelledby="mission-health-title">
    <header><div><span className="eyebrow">READ-ONLY · YOUR ACTUAL ACCOUNT</span><h3 id="mission-health-title">MATCH → MISSION VERIFICATION</h3><p>Check the real connection, match capture, cloud selection and decision-evidence receipt. This never creates fake matches or mission progress.</p></div>
      <button type="button" onClick={()=>void inspect()} disabled={loading}>{loading?'CHECKING…':'CHECK AGAIN ↻'}</button></header>
    {error&&<p className="mission-health-error" role="alert">{error}</p>}
    <div className="mission-health-steps">
      <div><small>01 / COMPANION</small><strong>{result?(result.online?'ONLINE':result.linked?'PAIRED · OFFLINE':'NOT CONNECTED'):'WAITING FOR CHECK'}</strong><span>{result?(result.deviceCount?result.deviceCount+' paired PC(s) · heartbeat required':'Connect your Windows Companion in Match Room'):'Account check pending'}</span></div>
      <div><small>02 / LIVE GAME</small><strong>{result?(recording?'RECORDING NOW':captured?'MATCH DATA RECEIVED':'NOT YET CAPTURED'):'WAITING FOR CHECK'}</strong><span>{recording?'Your Companion is sending live data.':captured?'Server has received live snapshots. This does not yet prove post-game analysis.':'Play a tracked League match to produce a server-side capture.'}</span></div>
      <div><small>03 / SELECTED DNA</small><strong>{result?(result.focusSource==='PLAYER'?'PLAYER CONFIRMED':result.chosen===2?'COACH RECOMMENDED':'NO SAVED PAIR'):'WAITING FOR CHECK'}</strong><span>{result?result.chosen+'/2 cloud mission trees · '+(result.focusSource==='PLAYER'?'chosen by you':'confirm the suggested pair above'):'Checking the server copy of your plan'}</span></div>
      <div><small>04 / POST-GAME PROOF</small><strong>{recordedEvidence?(recordedEvidence.outcome==='PROVEN'?'VERIFIED REP':recordedEvidence.outcome==='MISSED'?'REVIEWED · MISSED':'NOT OBSERVED'):'NO REVIEWED REP'}</strong><span>{recordedEvidence?(recordedEvidence.sameMatch===true?'Matches latest live session · ':'Latest saved mission receipt · ')+new Date(recordedEvidence.when).toLocaleDateString('en-GB'):'No scored mission receipt yet. Post-game analysis may still be pending.'}</span></div>
    </div>
    <footer>{result?.review&&<span>LIVE SESSION: {String(result.review.status||'UNKNOWN').toUpperCase()} · {Number(result.review.snapshotCount)||0} snapshots{processed?' · ANALYSIS: '+processed:''}</span>}
      {recordedEvidence&&<details><summary>Latest mission evidence explanation</summary><p>{recordedEvidence.reason}</p></details>}
      <span>{result?'Checked '+new Date(result.checkedAt).toLocaleTimeString('en-GB'):'No live account verification yet'}</span>
      <Link href="/live">OPEN MATCH ROOM ↗</Link>
    </footer>
  </section>;
}
