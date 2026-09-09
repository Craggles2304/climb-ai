import 'server-only';
import {getSupabaseAdmin} from './supabaseAdmin';

/**
 * Persistence for analytics events and feedback.
 *
 * Same tolerance as the match repository: without Supabase configured these
 * report `persisted: false` and log to the server console instead of throwing.
 * That keeps local development and a Riot-key-only deployment fully usable,
 * and means an analytics outage can never break a page for a user.
 */

export interface WriteResult{persisted:boolean;count:number;reason?:string}

export interface IncomingEvent{
  event:string;
  props:Record<string,unknown>;
  occurredAt:string;
}

export async function saveEvents(
  anonId:string,sessionId:string,events:IncomingEvent[],userId?:string,
):Promise<WriteResult>{
  if(!events.length)return {persisted:true,count:0};
  const db=getSupabaseAdmin();
  if(!db){
    // Visible in dev so the funnel can still be eyeballed before Supabase exists.
    console.info(`[analytics] ${events.length} event(s) from ${anonId.slice(0,8)}: ${events.map(e=>e.event).join(', ')}`);
    return {persisted:false,count:events.length,reason:'Supabase is not configured.'};
  }
  const {error}=await db.from('analytics_events').insert(events.map(e=>({
    user_id:userId??null,
    anon_id:anonId,
    session_id:sessionId,
    event:e.event,
    props:e.props,
    occurred_at:e.occurredAt,
  })));
  if(error)return {persisted:false,count:0,reason:error.message};
  return {persisted:true,count:events.length};
}

export interface IncomingFeedback{
  useful:boolean;
  surface:string;
  subject?:string;
  reason?:string;
  details?:string;
  rankBand?:string;
  role?:string;
}

export async function saveFeedback(
  anonId:string,sessionId:string,f:IncomingFeedback,userId?:string,
):Promise<WriteResult>{
  const db=getSupabaseAdmin();
  if(!db){
    console.info(`[feedback] ${f.useful?'USEFUL':'NOT USEFUL'} on ${f.surface}${f.subject?` (${f.subject})`:''}${f.reason?` — ${f.reason}`:''}`);
    return {persisted:false,count:1,reason:'Supabase is not configured.'};
  }
  const {error}=await db.from('feedback').insert({
    user_id:userId??null,
    anon_id:anonId,
    session_id:sessionId,
    useful:f.useful,
    surface:f.surface,
    subject:f.subject??null,
    reason:f.reason??null,
    details:f.details??null,
    rank_band:f.rankBand??null,
    role:f.role??null,
  });
  if(error)return {persisted:false,count:0,reason:error.message};
  return {persisted:true,count:1};
}

export interface IncomingAdherence{
  matchId:string;
  taskId?:string;
  adherence:'YES'|'PARTLY'|'NO';
  clearedBar:boolean;
  outcome:'CONFIRMED'|'UNREWARDED'|'UNEARNED'|'NO_REP';
}

export async function saveAdherence(
  anonId:string,sessionId:string,a:IncomingAdherence,userId?:string,
):Promise<WriteResult>{
  const db=getSupabaseAdmin();
  if(!db){
    console.info(`[adherence] ${a.outcome} — did:${a.adherence} cleared:${a.clearedBar} match:${a.matchId}`);
    return {persisted:false,count:1,reason:'Supabase is not configured.'};
  }
  // One report per player per match; a corrected answer replaces the old one.
  const {error}=await db.from('behaviour_checks').upsert({
    user_id:userId??null,
    anon_id:anonId,
    session_id:sessionId,
    match_id:a.matchId,
    task_id:a.taskId??null,
    adherence:a.adherence,
    cleared_bar:a.clearedBar,
    outcome:a.outcome,
  },{onConflict:'anon_id,match_id'});
  if(error)return {persisted:false,count:0,reason:error.message};
  return {persisted:true,count:1};
}
