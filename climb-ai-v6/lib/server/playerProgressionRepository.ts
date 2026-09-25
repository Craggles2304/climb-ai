import 'server-only';

import {XP_PER_MISSION_MASTERY,XP_PER_PROVEN_REP,progressFromXp} from '@/lib/accountXp';
import type {ILPTask,ILPMissionAttempt} from '@/lib/types';

export interface ProgressionTransaction{
  id:number;
  accountId:string|null;
  missionId:string|null;
  matchId:string|null;
  kind:'MISSION_REP'|'MISSION_MASTERED';
  xp:number;
  title:string;
  role:string|null;
  createdAt:string;
}

export interface ProgressionSnapshot{
  progress:ReturnType<typeof progressFromXp>;
  recent:ProgressionTransaction[];
  sync:{
    accountId:string|null;
    status:string;
    lastSyncedAt:string|null;
    latestMatchAt:string|null;
    latestMatchId:string|null;
    latestMatchChampion:string|null;
    latestMatchRole:string|null;
  };
}

type TaskRow={riot_account_id:string;id:string;payload:ILPTask};

export async function syncAndLoadProgression(db:any,userId:string,accountId?:string|null):Promise<ProgressionSnapshot>{
  const tasksResult=await db.from('ilp_tasks')
    .select('riot_account_id,id,payload')
    .eq('user_id',userId);
  if(tasksResult.error)throw new Error(tasksResult.error.message);
  const taskRows=(tasksResult.data??[]) as TaskRow[];
  const ledgerRows=buildLedgerRows(userId,taskRows);
  if(ledgerRows.length){
    const {error}=await db.from('player_xp_ledger')
      .upsert(ledgerRows,{onConflict:'user_id,transaction_key',ignoreDuplicates:true});
    if(error)throw new Error(error.message);
  }

  const ledgerResult=await db.from('player_xp_ledger')
    .select('id,riot_account_id,mission_id,match_id,kind,xp,metadata,created_at')
    .eq('user_id',userId)
    .order('created_at',{ascending:false})
    .limit(5000);
  if(ledgerResult.error)throw new Error(ledgerResult.error.message);

  const ledger=ledgerResult.data??[];
  const xp=ledger.reduce((sum:number,row:any)=>sum+Math.max(0,Number(row.xp)||0),0);
  const provenReps=ledger.filter((row:any)=>row.kind==='MISSION_REP').length;
  const masteredMissions=ledger.filter((row:any)=>row.kind==='MISSION_MASTERED').length;
  const progress=progressFromXp(xp,{provenReps,masteredMissions});
  const recent:ProgressionTransaction[]=ledger.slice(0,12).map((row:any)=>({
    id:Number(row.id),
    accountId:row.riot_account_id?String(row.riot_account_id):null,
    missionId:row.mission_id?String(row.mission_id):null,
    matchId:row.match_id?String(row.match_id):null,
    kind:row.kind==='MISSION_MASTERED'?'MISSION_MASTERED':'MISSION_REP',
    xp:Number(row.xp)||0,
    title:String(row.metadata?.title||'Mission progress'),
    role:row.metadata?.role?String(row.metadata.role):null,
    createdAt:String(row.created_at),
  }));

  const sync=await loadSyncHealth(db,userId,accountId??null);
  return{progress,recent,sync};
}

function buildLedgerRows(userId:string,rows:TaskRow[]){
  const ledger:any[]=[];
  for(const row of rows){
    const task=(row.payload&&typeof row.payload==='object'?row.payload:{} as ILPTask) as ILPTask;
    const accountId=String(row.riot_account_id||task.accountId||'');
    const title=String(task.title||'Mission');
    const role=task.roleScope&&task.roleScope!=='GLOBAL'?task.roleScope:null;

    for(const attempt of task.missionHistory??[]){
      if(!attempt?.banksPass||!attempt.matchId)continue;
      if(attempt.source!=='TRACKED'&&attempt.adherence!=='TRACKED')continue;
      ledger.push({
        user_id:userId,
        riot_account_id:accountId||null,
        transaction_key:`rep:${accountId}:${task.id}:${attempt.matchId}`,
        mission_id:task.id,
        match_id:attempt.matchId,
        kind:'MISSION_REP',
        xp:XP_PER_PROVEN_REP,
        metadata:{title,role,source:attempt.source??'TRACKED',outcome:attempt.outcome},
        created_at:validIso(attempt.at),
      });
    }

    if(task.status==='MASTERED'){
      const masteredAt=masteryTime(task);
      ledger.push({
        user_id:userId,
        riot_account_id:accountId||null,
        transaction_key:`mastery:${accountId}:${task.id}`,
        mission_id:task.id,
        match_id:latestAttemptMatch(task.missionHistory),
        kind:'MISSION_MASTERED',
        xp:XP_PER_MISSION_MASTERY,
        metadata:{title,role},
        created_at:masteredAt,
      });
    }
  }
  return ledger;
}

async function loadSyncHealth(db:any,userId:string,accountId:string|null){
  if(!accountId)return{
    accountId:null,status:'NO_ACCOUNT',lastSyncedAt:null,latestMatchAt:null,latestMatchId:null,latestMatchChampion:null,latestMatchRole:null,
  };

  const [accountResult,matchResult]=await Promise.all([
    db.from('riot_accounts')
      .select('id,sync_status,last_synced_at')
      .eq('user_id',userId).eq('id',accountId).maybeSingle(),
    db.from('matches')
      .select('id,champion,role,occurred_at,created_at')
      .eq('user_id',userId).eq('riot_account_id',accountId)
      .in('result',['WIN','LOSS'])
      .order('occurred_at',{ascending:false})
      .limit(1).maybeSingle(),
  ]);
  if(accountResult.error)throw new Error(accountResult.error.message);
  if(matchResult.error)throw new Error(matchResult.error.message);
  const account=accountResult.data;
  const match=matchResult.data;
  return{
    accountId,
    status:String(account?.sync_status||'unknown'),
    lastSyncedAt:account?.last_synced_at?String(account.last_synced_at):null,
    latestMatchAt:match?(String(match.occurred_at||match.created_at)):null,
    latestMatchId:match?.id?String(match.id):null,
    latestMatchChampion:match?.champion?String(match.champion):null,
    latestMatchRole:match?.role?String(match.role):null,
  };
}

function masteryTime(task:ILPTask){
  const event=[...(task.history??[])].reverse().find(item=>item.type==='MASTERED');
  return validIso(event?.at??task.missionHistory?.at(-1)?.at);
}

function latestAttemptMatch(history:ILPMissionAttempt[]|undefined){
  return history?.length?String(history[history.length-1].matchId||'')||null:null;
}

function validIso(value:unknown){
  const parsed=Date.parse(String(value||''));
  return Number.isFinite(parsed)?new Date(parsed).toISOString():new Date().toISOString();
}
