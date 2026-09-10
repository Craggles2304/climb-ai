import 'server-only';
import {Match} from '../types';
import {getSupabaseAdmin} from './supabaseAdmin';
import {isUnreachable} from '../auth/config';

/**
 * Persistence for synced matches.
 *
 * Deliberately tolerant: if Supabase is not configured the repository reports
 * `persisted: false` and the caller still gets its mapped matches back. That
 * means Riot sync can be developed and demonstrated with a Riot key alone.
 */

export interface SaveResult{
  persisted:boolean;
  inserted:number;
  skipped:number;
  reason?:string;
}

export interface SyncedMatch{
  match:Match;
  unavailable:string[];
  /** Turning points, present only when the match had a timeline. */
  moments?:Match['moments'];
}

/**
 * Never throws. A save failure is a reported outcome, not an exception: the
 * Riot sync that produced these matches already succeeded, and letting a
 * database throw propagate turned a failed write into a 502 that lost the
 * matches entirely.
 */
export async function saveMatches(userId:string,synced:SyncedMatch[]):Promise<SaveResult>{
  try{
    return await persistMatches(userId,synced);
  }catch(err){
    return failed(synced.length,err);
  }
}

async function persistMatches(userId:string,synced:SyncedMatch[]):Promise<SaveResult>{
  const matches=synced.map(s=>s.match);
  const unavailableById=new Map(synced.map(s=>[s.match.id,s.unavailable]));
  const db=getSupabaseAdmin();
  if(!db)return {persisted:false,inserted:0,skipped:matches.length,reason:'Supabase is not configured.'};
  if(!matches.length)return {persisted:true,inserted:0,skipped:0};

  // external_match_id is the Riot match id, so re-syncing is idempotent.
  const {data:existing,error:readError}=await db
    .from('matches')
    .select('external_match_id')
    .eq('user_id',userId)
    .in('external_match_id',matches.map(m=>m.id));
  if(readError)return failed(matches.length,readError);

  const seen=new Set((existing||[]).map(r=>r.external_match_id as string));
  const fresh=matches.filter(m=>!seen.has(m.id));
  if(!fresh.length)return {persisted:true,inserted:0,skipped:matches.length};

  const {data:rows,error:insertError}=await db
    .from('matches')
    .insert(fresh.map(m=>({
      user_id:userId,
      external_match_id:m.id,
      champion:m.champion,
      role:m.role,
      result:m.result,
      kills:m.kills,
      deaths:m.deaths,
      assists:m.assists,
      duration_seconds:m.durationSeconds,
      rank:m.rank,
      source:m.source,
      occurred_at:m.createdAt,
    })))
    .select('id,external_match_id');
  if(insertError)return failed(matches.length,insertError);

  const idByExternal=new Map((rows||[]).map(r=>[r.external_match_id as string,r.id as string]));
  const metricRows=fresh
    .filter(m=>idByExternal.has(m.id))
    .map(m=>({
      match_id:idByExternal.get(m.id)!,
      user_id:userId,
      cs:m.metrics.cs,
      cs_per_min:m.metrics.csPerMin,
      gold_per_min:m.metrics.goldPerMin??null,
      damage_per_min:m.metrics.damagePerMin??null,
      kill_participation:m.metrics.killParticipation??null,
      vision_score:m.metrics.visionScore??null,
      farm_after_15:m.metrics.post15CsPerMin??null,
      objective_participation:m.metrics.objectiveParticipation??null,
      lane_cs_per_min:m.metrics.laneCsPerMin??null,
      post15_cs_per_min:m.metrics.post15CsPerMin??null,
      cs_at_10:m.metrics.csAt10??null,
      cs_at_15:m.metrics.csAt15??null,
      gold_diff_at_15:m.metrics.goldDiffAt15??null,
      xp_diff_at_15:m.metrics.xpDiffAt15??null,
      deaths_pre_10:m.metrics.deathsPre10??null,
      deaths_10_to_20:m.metrics.deaths10to20??null,
      deaths_post_20:m.metrics.deathsPost20??null,
      solo_deaths:m.metrics.soloDeaths??null,
      teamfight_deaths:m.metrics.teamfightDeaths??null,
      first_item_minute:m.metrics.firstItemMinute??null,
      second_item_minute:m.metrics.secondItemMinute??null,
      third_item_minute:m.metrics.thirdItemMinute??null,
      damage_share:m.metrics.damageShare??null,
      unavailable_metrics:unavailableById.get(m.id)||[],
      raw:m.metrics,
    }));

  const {error:metricsError}=await db.from('match_metrics').insert(metricRows);
  if(metricsError){
    return {persisted:false,inserted:fresh.length,skipped:0,reason:`Matches saved but metrics failed: ${metricsError.message}`};
  }

  return {persisted:true,inserted:fresh.length,skipped:matches.length-fresh.length};
}

/**
 * A failed save is reported, never thrown. The Riot sync that produced these
 * matches already succeeded, so losing the write must not lose the data — the
 * route still returns the matches and the client still shows them.
 *
 * A paused free-tier project gets its own wording because it is the most
 * likely cause and the fix is a button in the Supabase dashboard, not a bug.
 */
function failed(count:number,error:unknown):SaveResult{
  const message=(error as {message?:string})?.message??'Unknown error';
  return {
    persisted:false,inserted:0,skipped:count,
    reason:isUnreachable(error)
      ?'Could not reach the database, so nothing was saved. Free Supabase projects pause after a week of inactivity — restoring it in the Supabase dashboard will fix this. Your matches are still shown below.'
      :message,
  };
}
