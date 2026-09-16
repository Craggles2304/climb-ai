import type {ILPTask} from './types';

export type CloudIlpRow={id:string;payload:any;updated_at:string|null};
export type CloudIlpMerge={tasks:ILPTask[];writes:ILPTask[]};

function stamp(value:unknown){const n=Date.parse(String(value??''));return Number.isFinite(n)?n:0}
export function taskFreshness(task:ILPTask){
  const history=Math.max(0,...(task.history??[]).map(entry=>stamp(entry.at)),...(task.missionHistory??[]).map(entry=>stamp(entry.at)));
  const idStamp=Number(String(task.id||'').match(/(\d{12,})$/)?.[1]||0);
  return Math.max(history,idStamp);
}
function mergeStrings(a:unknown,b:unknown){return [...new Set([...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])].map(String).filter(Boolean))]}
function mergeHistory(a:unknown,b:unknown){
  const rows=[...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])];
  const seen=new Set<string>();
  return rows.filter((row:any)=>{const key=`${row?.at||''}|${row?.type||''}|${row?.note||''}`;if(seen.has(key))return false;seen.add(key);return true}).sort((x:any,y:any)=>stamp(x?.at)-stamp(y?.at)).slice(-12);
}
function mergeMissionHistory(a:unknown,b:unknown){
  const rows=[...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])];
  const map=new Map<string,any>();
  for(const row of rows){const key=String(row?.matchId||row?.at||JSON.stringify(row));const existing=map.get(key);if(!existing||stamp(row?.at)>=stamp(existing?.at))map.set(key,row)}
  return [...map.values()].sort((x:any,y:any)=>stamp(x?.at)-stamp(y?.at)).slice(-20);
}
function localOverRemote(remote:ILPTask,local:ILPTask){
  const remoteAny=remote as any,localAny=local as any;
  return{
    ...remote,
    ...local,
    evidence:mergeStrings(remote.evidence,local.evidence),
    history:mergeHistory(remote.history,local.history),
    missionHistory:mergeMissionHistory(remote.missionHistory,local.missionHistory),
    ...(remoteAny.adaptive?{adaptive:remoteAny.adaptive}:localAny.adaptive?{adaptive:localAny.adaptive}:{}),
  } as ILPTask;
}
function serverEvidenceManaged(task:ILPTask){
  const anyTask=task as any;
  if(anyTask.adaptive?.managedBy==='POST_GAME_EVIDENCE')return true;
  if(String(task.id).startsWith('op-pro-')||String(task.id).includes('adaptive-fill'))return true;
  const text=`${task.lastUpdatedReason??''} ${(task.history??[]).map(entry=>entry.note).join(' ')}`.toLowerCase();
  return /repeated evidence|active five vacancy|active five cap|role-safe baseline|post-game evidence/.test(text);
}
function explicitLocalActionAfter(task:ILPTask,remoteAt:number){
  const recent=[...(task.history??[])].filter(entry=>stamp(entry.at)>remoteAt);
  if(recent.some(entry=>{
    const type=String(entry.type||'').toUpperCase(),note=String(entry.note||'');
    return type==='COACH_EDIT'||/paused by player|marked mastered after reviewed evidence|replaced by coach|coach mission/i.test(note);
  }))return true;
  return (task.missionHistory??[]).some(entry=>stamp(entry.at)>remoteAt);
}

/**
 * Reconcile a possibly stale browser plan with the server-owned ILP snapshot.
 *
 * Rules:
 * - server-only rows are never deleted just because a tab has not seen them yet;
 * - a newer server row wins over stale local state;
 * - post-game evidence decisions stay server-authoritative even if a stale tab
 *   runs a later automatic client calculation;
 * - an explicit player/Coach action after the server write may still update it;
 * - server adaptive metadata survives that later local action.
 */
export function mergeIlpCloudSnapshot(localTasks:ILPTask[],remoteRows:CloudIlpRow[],accountId:string):CloudIlpMerge{
  const remoteById=new Map(remoteRows.map(row=>[String(row.id),row]));
  const mergedById=new Map<string,ILPTask>();
  const writes:ILPTask[]=[];

  for(const row of remoteRows){
    const payload=(row.payload&&typeof row.payload==='object')?row.payload:{};
    mergedById.set(String(row.id),{...payload,id:String(row.id),accountId} as ILPTask);
  }

  for(const local of localTasks){
    const localTask={...local,accountId};
    const remoteRow=remoteById.get(String(local.id));
    if(!remoteRow){mergedById.set(local.id,localTask);writes.push(localTask);continue}
    const remotePayload=(remoteRow.payload&&typeof remoteRow.payload==='object')?remoteRow.payload:{};
    const remoteTask={...remotePayload,id:String(remoteRow.id),accountId} as ILPTask;
    const remoteAt=stamp(remoteRow.updated_at);
    const localAt=taskFreshness(localTask);
    const mayOverride=serverEvidenceManaged(remoteTask)?explicitLocalActionAfter(localTask,remoteAt):localAt>remoteAt;
    if(mayOverride){const combined=localOverRemote(remoteTask,localTask);mergedById.set(local.id,combined);writes.push(combined)}
  }

  return{tasks:[...mergedById.values()],writes};
}
