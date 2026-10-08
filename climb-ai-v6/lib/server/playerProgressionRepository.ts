import 'server-only';
import {XP_PER_MISSION_MASTERY,XP_PER_PROVEN_REP,progressFromXp} from '@/lib/accountXp';
import {verifiedMissionAttempts,verifiedMissionMastery} from '@/lib/verifiedMissionProof';
import type {ILPTask} from '@/lib/types';
export interface ProgressionTransaction{
  id:number;accountId:string|null;missionId:string|null;matchId:string|null;
  kind:'MISSION_REP'|'MISSION_MASTERED';xp:number;title:string;role:string|null;createdAt:string;
}
export interface ProgressionSnapshot{
  progress:ReturnType<typeof progressFromXp>;
  recent:ProgressionTransaction[];
  sync:{accountId:string|null;status:string;lastSyncedAt:string|null;latestMatchAt:string|null;latestMatchId:string|null;latestMatchChampion:string|null;latestMatchRole:string|null};
}
type TaskRow={riot_account_id:string;id:string;payload:ILPTask};
type XpLedgerRow={user_id:string;riot_account_id:string|null;transaction_key:string;mission_id:string;match_id:string|null;kind:'MISSION_REP'|'MISSION_MASTERED';xp:number;metadata:{title:string;role:string|null;source?:string;outcome?:string};created_at:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function verifiedXpRows(db:any,userId:string){
  const {data,error}=await db.from('ilp_tasks').select('riot_account_id,id,payload').eq('user_id',userId);
  if(error)throw new Error(error.message);
  const rows=(data??[]) as TaskRow[];
  const candidates=[...new Set(rows.flatMap(row=>verifiedMissionAttempts(row.payload??{} as ILPTask).map(a=>a.matchId).filter(id=>uuid.test(id))))];
  const validMatches=new Map<string,string>();
  for(let i=0;i<candidates.length;i+=100){
    const result=await db.from('matches').select('id,riot_account_id').eq('user_id',userId).in('id',candidates.slice(i,i+100));
    if(result.error)throw new Error(result.error.message);
    for(const match of result.data??[])validMatches.set(String(match.id),String(match.riot_account_id??''));
  }
  const earned:XpLedgerRow[]=[];const eligibleKeys=new Set<string>();
  for(const row of rows){
    const task=row.payload;
    if(!task||typeof task!=='object'||!task.metric)continue;
    const accountId=String(row.riot_account_id||task.accountId||'');
    if(!uuid.test(accountId))continue;
    const title=String(task.title||'Mission'),role=task.roleScope&&task.roleScope!=='GLOBAL'?task.roleScope:null;
    const matches=verifiedMissionAttempts(task).filter(a=>validMatches.get(a.matchId)===accountId);
    for(const attempt of matches){
      const key='rep:'+accountId+':'+row.id+':'+attempt.matchId;
      if(eligibleKeys.has(key))continue;eligibleKeys.add(key);
      earned.push({user_id:userId,riot_account_id:accountId,transaction_key:key,mission_id:row.id,match_id:attempt.matchId,
        kind:'MISSION_REP',xp:XP_PER_PROVEN_REP,metadata:{title,role,source:'TRACKED',outcome:'CONFIRMED'},created_at:validIso(attempt.at)});
    }
    if(verifiedMissionMastery(task)&&matches.length>=Math.max(1,Number(task.masteryRequired)||3)){
      const key='mastery:'+accountId+':'+row.id;
      if(eligibleKeys.has(key))continue;eligibleKeys.add(key);
      earned.push({user_id:userId,riot_account_id:accountId,transaction_key:key,mission_id:row.id,match_id:matches.at(-1)?.matchId??null,
        kind:'MISSION_MASTERED',xp:XP_PER_MISSION_MASTERY,metadata:{title,role},created_at:masteryTime(task)});
    }
  }
  return{earned,eligibleKeys};
}
/** Automatic after completed post-game evidence sync; idempotent across retries. */
export async function syncVerifiedXpForUser(db:any,userId:string){
  const proof=await verifiedXpRows(db,userId);
  for(let i=0;i<proof.earned.length;i+=100){
    const {error}=await db.from('player_xp_ledger').upsert(proof.earned.slice(i,i+100),{onConflict:'user_id,transaction_key',ignoreDuplicates:true});
    if(error)throw new Error(error.message);
  }
  return{eligibleKeys:proof.eligibleKeys,verifiedTransactions:proof.earned.length};
}
export async function syncAndLoadProgression(db:any,userId:string,accountId?:string|null):Promise<ProgressionSnapshot>{
  // Read-time reconciliation remains an idempotent fallback, not the award trigger.
  const proof=await syncVerifiedXpForUser(db,userId);
  const result=await db.from('player_xp_ledger').select('id,riot_account_id,mission_id,match_id,kind,xp,metadata,created_at,transaction_key')
    .eq('user_id',userId).order('created_at',{ascending:false}).limit(5000);
  if(result.error)throw new Error(result.error.message);
  // Old ledger rows whose evidence no longer qualifies cannot inflate displayed XP.
  const ledger=(result.data??[]).filter((row:any)=>proof.eligibleKeys.has(String(row.transaction_key)));
  const xp=ledger.reduce((sum:number,row:any)=>sum+Math.max(0,Number(row.xp)||0),0);
  const progress=progressFromXp(xp,{provenReps:ledger.filter((r:any)=>r.kind==='MISSION_REP').length,
    masteredMissions:ledger.filter((r:any)=>r.kind==='MISSION_MASTERED').length});
  const recent:ProgressionTransaction[]=ledger.slice(0,12).map((row:any)=>({
    id:Number(row.id),accountId:row.riot_account_id?String(row.riot_account_id):null,
    missionId:row.mission_id?String(row.mission_id):null,matchId:row.match_id?String(row.match_id):null,
    kind:row.kind==='MISSION_MASTERED'?'MISSION_MASTERED':'MISSION_REP',xp:Number(row.xp)||0,
    title:String(row.metadata?.title||'Mission progress'),role:row.metadata?.role?String(row.metadata.role):null,
    createdAt:String(row.created_at),
  }));
  const sync=await loadSyncHealth(db,userId,accountId??null);
  return{progress,recent,sync};
}
async function loadSyncHealth(db:any,userId:string,accountId:string|null){
  if(!accountId)return{accountId:null,status:'NO_ACCOUNT',lastSyncedAt:null,latestMatchAt:null,latestMatchId:null,latestMatchChampion:null,latestMatchRole:null};
  const [a,m]=await Promise.all([
    db.from('riot_accounts').select('id,sync_status,last_synced_at').eq('user_id',userId).eq('id',accountId).maybeSingle(),
    db.from('matches').select('id,champion,role,occurred_at,created_at').eq('user_id',userId).eq('riot_account_id',accountId)
      .in('result',['WIN','LOSS']).order('occurred_at',{ascending:false}).limit(1).maybeSingle(),
  ]);
  if(a.error)throw new Error(a.error.message);
  if(m.error)throw new Error(m.error.message);
  const account=a.data,match=m.data;
  return{accountId,status:String(account?.sync_status||'unknown'),lastSyncedAt:account?.last_synced_at?String(account.last_synced_at):null,
    latestMatchAt:match?String(match.occurred_at||match.created_at):null,latestMatchId:match?.id?String(match.id):null,
    latestMatchChampion:match?.champion?String(match.champion):null,latestMatchRole:match?.role?String(match.role):null};
}
function masteryTime(task:ILPTask){
  const e=[...(task.history??[])].reverse().find(item=>item.type==='MASTERED');
  return validIso(e?.at??task.missionHistory?.at(-1)?.at);
}
function validIso(value:unknown){
  const date=Date.parse(String(value||''));
  return Number.isFinite(date)?new Date(date).toISOString():new Date().toISOString();
}
