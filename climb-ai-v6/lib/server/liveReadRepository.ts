import 'server-only';
import {getSupabaseAdmin} from './supabaseAdmin';
import {getProLearningProfile,getProMatchAnalysisBySession} from './proLearningRepository';
import type {LiveTelemetrySnapshot} from '@/lib/riot/liveTelemetry';

const TRANSIENT=/gateway timeout|bad gateway|failed to get project config|failed to get api key info|fetch failed|timed out|timeout/i;

async function onceMore<T>(run:()=>PromiseLike<T>):Promise<T>{
  let first:T;
  try{first=await run()}catch(error){
    if(!TRANSIENT.test(error instanceof Error?error.message:String(error)))throw error;
    await new Promise(resolve=>setTimeout(resolve,120));
    return await run();
  }
  const maybeError=(first as {error?:{message?:string}|null})?.error;
  if(!maybeError||!TRANSIENT.test(maybeError.message??''))return first;
  await new Promise(resolve=>setTimeout(resolve,120));
  return await run();
}

/**
 * Fast read model for browser polling.
 *
 * The write/finalize path already stores the completed strength timeline and
 * PRO analysis in live_telemetry_sessions.summary. Polling must therefore not
 * reload every historical snapshot or run Riot enrichment every few seconds.
 */
export async function latestLiveRead(userId:string,accountKey:string){
  const db=getSupabaseAdmin();
  if(!db)return null;

  const sessionResult=await onceMore(()=>db
    .from('live_telemetry_sessions')
    .select('id,status,started_at,ended_at,last_seen_at,summary,riot_account_id')
    .eq('user_id',userId)
    .eq('account_key',accountKey)
    .order('started_at',{ascending:false})
    .limit(1)
    .maybeSingle());
  if(sessionResult.error)throw new Error(sessionResult.error.message);
  const session=sessionResult.data;
  if(!session)return null;

  const [latestResult,countResult]=await Promise.all([
    onceMore(()=>db
      .from('live_telemetry_snapshots')
      .select('game_time,payload')
      .eq('session_id',session.id)
      .order('game_time',{ascending:false})
      .limit(1)
      .maybeSingle()),
    onceMore(()=>db
      .from('live_telemetry_snapshots')
      .select('session_id',{count:'exact',head:true})
      .eq('session_id',session.id)),
  ]);
  if(latestResult.error)throw new Error(latestResult.error.message);
  if(countResult.error)throw new Error(countResult.error.message);

  const summary=(session.summary&&typeof session.summary==='object')?session.summary as Record<string,unknown>:null;
  const latestSnapshot=(latestResult.data?.payload??null) as LiveTelemetrySnapshot|null;
  const complete=['COMPLETE','ABORTED'].includes(String(session.status));

  let proAnalysis=(summary?.proAnalysis??null) as unknown;
  let historyProfile:unknown=null;
  let matchId:string|null=null;
  if(complete){
    const [storedAnalysis,profile,matchRow]=await Promise.all([
      proAnalysis?Promise.resolve(null):getProMatchAnalysisBySession(session.id).catch(()=>null),
      getProLearningProfile(userId,session.riot_account_id??null).catch(()=>null),
      onceMore(()=>db.from('matches').select('id').eq('live_session_id',session.id).maybeSingle()).catch(()=>null),
    ]);
    if(!proAnalysis&&storedAnalysis)proAnalysis=storedAnalysis;
    historyProfile=profile;
    matchId=(matchRow as any)?.data?.id??null;
  }

  return{
    sessionId:session.id,
    status:session.status,
    startedAt:session.started_at,
    endedAt:session.ended_at,
    lastSeenAt:session.last_seen_at,
    snapshotCount:countResult.count??0,
    latestSnapshot,
    summary,
    proAnalysis,
    historyProfile,
    matchId,
  };
}
