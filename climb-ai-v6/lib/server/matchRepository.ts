import 'server-only';
import {Match} from '../types';
import type {ProMatchAnalysis} from '../riot/proAnalysis';
import {getSupabaseAdmin} from './supabaseAdmin';
import {isUnreachable} from '../auth/config';
import {persistProMatchAnalysis,rebuildProLearningProfile} from './proLearningRepository';

export interface SaveResult{persisted:boolean;inserted:number;skipped:number;reason?:string}
export interface SyncedMatch{
  match:Match;
  unavailable:string[];
  moments?:Match['moments'];
  proAnalysis?:ProMatchAnalysis;
}

export async function saveMatches(userId:string,synced:SyncedMatch[]):Promise<SaveResult>{
  try{return await persistMatches(userId,synced)}catch(err){return failed(synced.length,err)}
}

async function persistMatches(userId:string,synced:SyncedMatch[]):Promise<SaveResult>{
  const matches=synced.map(s=>s.match);
  const syncedById=new Map(synced.map(s=>[s.match.id,s]));
  const db=getSupabaseAdmin();
  if(!db)return{persisted:false,inserted:0,skipped:matches.length,reason:'Supabase is not configured.'};
  if(!matches.length)return{persisted:true,inserted:0,skipped:0};

  const {data:existing,error:readError}=await db.from('matches').select('external_match_id').eq('user_id',userId).in('external_match_id',matches.map(m=>m.id));
  if(readError)return failed(matches.length,readError);
  const seen=new Set((existing||[]).map(r=>r.external_match_id as string));
  const fresh=matches.filter(m=>!seen.has(m.id));
  if(!fresh.length)return{persisted:true,inserted:0,skipped:matches.length};

  const {data:rows,error:insertError}=await db.from('matches').insert(fresh.map(m=>({
    user_id:userId,external_match_id:m.id,riot_account_id:m.riotAccountId||null,
    champion:m.champion,role:m.role,result:m.result,kills:m.kills,deaths:m.deaths,assists:m.assists,
    duration_seconds:m.durationSeconds,rank:m.rank,source:m.source,occurred_at:m.createdAt,
  }))).select('id,external_match_id');
  if(insertError)return failed(matches.length,insertError);

  const idByExternal=new Map((rows||[]).map(r=>[r.external_match_id as string,r.id as string]));
  const metricRows=fresh.filter(m=>idByExternal.has(m.id)).map(m=>{
    const detail=syncedById.get(m.id);
    return{
      match_id:idByExternal.get(m.id)!,user_id:userId,
      cs:m.metrics.cs,cs_per_min:m.metrics.csPerMin,gold_per_min:m.metrics.goldPerMin??null,
      damage_per_min:m.metrics.damagePerMin??null,kill_participation:m.metrics.killParticipation??null,
      vision_score:m.metrics.visionScore??null,farm_after_15:m.metrics.post15CsPerMin??null,
      objective_participation:m.metrics.objectiveParticipation??null,lane_cs_per_min:m.metrics.laneCsPerMin??null,
      post15_cs_per_min:m.metrics.post15CsPerMin??null,cs_at_10:m.metrics.csAt10??null,cs_at_15:m.metrics.csAt15??null,
      gold_diff_at_15:m.metrics.goldDiffAt15??null,xp_diff_at_15:m.metrics.xpDiffAt15??null,
      deaths_pre_10:m.metrics.deathsPre10??null,deaths_10_to_20:m.metrics.deaths10to20??null,deaths_post_20:m.metrics.deathsPost20??null,
      solo_deaths:m.metrics.soloDeaths??null,teamfight_deaths:m.metrics.teamfightDeaths??null,
      first_item_minute:m.metrics.firstItemMinute??null,second_item_minute:m.metrics.secondItemMinute??null,third_item_minute:m.metrics.thirdItemMinute??null,
      damage_share:m.metrics.damageShare??null,unavailable_metrics:detail?.unavailable||[],
      raw:{metrics:m.metrics,proAnalysis:detail?.proAnalysis??null,moments:detail?.moments??[],unavailableMetrics:detail?.unavailable??[]},
    };
  });
  const {error:metricsError}=await db.from('match_metrics').insert(metricRows);
  if(metricsError)return{persisted:false,inserted:fresh.length,skipped:0,reason:`Matches saved but metrics failed: ${metricsError.message}`};

  const touchedAccounts=new Set<string>();
  for(const m of fresh){
    const detail=syncedById.get(m.id);
    const matchId=idByExternal.get(m.id);
    if(detail?.proAnalysis&&matchId){
      try{
        await persistProMatchAnalysis({userId,riotAccountId:m.riotAccountId||null,sessionId:null,matchId,externalMatchId:m.id,champion:m.champion,role:m.role,analysis:detail.proAnalysis});
        if(m.riotAccountId)touchedAccounts.add(m.riotAccountId);
      }catch(err){console.warn('[match-sync] PRO analysis persistence failed',err)}
    }
  }
  for(const accountId of touchedAccounts){
    try{await rebuildProLearningProfile(userId,accountId)}catch(err){console.warn('[match-sync] PRO history rebuild failed',err)}
  }

  return{persisted:true,inserted:fresh.length,skipped:matches.length-fresh.length};
}

function failed(count:number,error:unknown):SaveResult{
  const message=(error as {message?:string})?.message??'Unknown error';
  return{persisted:false,inserted:0,skipped:count,reason:isUnreachable(error)?'Could not reach the database, so nothing was saved. Free Supabase projects pause after a week of inactivity — restoring it in the Supabase dashboard will fix this. Your matches are still shown below.':message};
}
