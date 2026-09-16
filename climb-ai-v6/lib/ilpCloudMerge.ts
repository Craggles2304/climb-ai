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

/**
 * Reconcile a possibly stale browser plan with the server-owned ILP snapshot.
 *
 * Rules:
 * - server-only rows are never deleted just because a tab has not seen them yet;
 * - a newer server row wins over stale local state;
 * - an explicit local action that happened after the server write may update the row;
 * - server adaptive metadata survives a later local pause/complete/Coach edit.
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
    if(localAt>remoteAt){const combined=localOverRemote(remoteTask,localTask);mergedById.set(local.id,combined);writes.push(combined)}
  }

  return{tasks:[...mergedById.values()],writes};
}
