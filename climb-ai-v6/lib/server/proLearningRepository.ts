import 'server-only';
import {getSupabaseAdmin} from './supabaseAdmin';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';
import {buildProLearningProfile,type ProLearningProfile,type HistoryAnalysisRow} from '@/lib/riot/proHistory';

export interface PersistProAnalysisInput{
  userId:string;
  riotAccountId:string|null;
  sessionId:string|null;
  matchId:string|null;
  externalMatchId?:string|null;
  champion:string;
  role:string|null;
  analysis:ProMatchAnalysis;
}

export async function persistProMatchAnalysis(input:PersistProAnalysisInput){
  const db=getSupabaseAdmin();
  if(!db)return null;
  const row={
    user_id:input.userId,
    riot_account_id:input.riotAccountId,
    session_id:input.sessionId,
    match_id:input.matchId,
    external_match_id:input.externalMatchId??null,
    champion:input.champion,
    role:input.role,
    evidence_sources:input.analysis.evidenceSources,
    analysis:input.analysis,
    updated_at:new Date().toISOString(),
  };

  let query;
  if(input.sessionId)query=db.from('op_match_analysis').upsert(row,{onConflict:'session_id'});
  else if(input.matchId)query=db.from('op_match_analysis').upsert(row,{onConflict:'match_id'});
  else query=db.from('op_match_analysis').insert(row);
  const {data,error}=await query.select('id').maybeSingle();
  if(error)throw new Error(error.message);
  return data?.id??null;
}

export async function getProMatchAnalysisBySession(sessionId:string):Promise<ProMatchAnalysis|null>{
  const db=getSupabaseAdmin();
  if(!db)return null;
  const {data,error}=await db.from('op_match_analysis').select('analysis').eq('session_id',sessionId).maybeSingle();
  if(error)throw new Error(error.message);
  return (data?.analysis as ProMatchAnalysis|undefined)??null;
}

export async function rebuildProLearningProfile(userId:string,riotAccountId:string|null):Promise<ProLearningProfile|null>{
  const db=getSupabaseAdmin();
  if(!db||!riotAccountId)return null;
  const {data,error}=await db.from('op_match_analysis')
    .select('champion,role,created_at,analysis')
    .eq('user_id',userId).eq('riot_account_id',riotAccountId)
    .order('created_at',{ascending:true}).limit(50);
  if(error)throw new Error(error.message);
  const rows:HistoryAnalysisRow[]=(data??[]).map(row=>({
    champion:String(row.champion||'Unknown'),
    role:row.role?String(row.role):null,
    createdAt:String(row.created_at),
    analysis:row.analysis as ProMatchAnalysis,
  })).filter(row=>row.analysis?.version===1);
  const profile=buildProLearningProfile(rows);
  const now=new Date().toISOString();
  const {error:saveError}=await db.from('op_player_learning_profiles').upsert({
    user_id:userId,riot_account_id:riotAccountId,games_analyzed:profile.gamesAnalyzed,
    fingerprint:profile.fingerprint,metric_rollups:profile.metricRollups,
    fix_ladder:profile.fixLadder,champion_profiles:profile.championProfiles,
    latest_analysis_at:profile.latestAnalysisAt,updated_at:now,
  },{onConflict:'user_id,riot_account_id'});
  if(saveError)throw new Error(saveError.message);
  return profile;
}

export async function getProLearningProfile(userId:string,riotAccountId:string|null):Promise<ProLearningProfile|null>{
  const db=getSupabaseAdmin();
  if(!db||!riotAccountId)return null;
  const {data,error}=await db.from('op_player_learning_profiles')
    .select('games_analyzed,fingerprint,metric_rollups,fix_ladder,champion_profiles,latest_analysis_at')
    .eq('user_id',userId).eq('riot_account_id',riotAccountId).maybeSingle();
  if(error)throw new Error(error.message);
  if(!data)return null;
  const leak=(data.metric_rollups as any)?.historical_leak_rate;
  const recovery=(data.metric_rollups as any)?.historical_recovery;
  return {
    version:1,
    gamesAnalyzed:Number(data.games_analyzed||0),
    fingerprint:data.fingerprint as any,
    metricRollups:data.metric_rollups as any,
    fixLadder:data.fix_ladder as any,
    championProfiles:data.champion_profiles as any,
    opLeakRate:{occurrencesPerGame:extractLeakRate(leak?.recentValue),cleanScore:Number(leak?.averageScore??0),trend:leak?.trend??'BUILDING'},
    recovery:{score:typeof recovery?.averageScore==='number'?recovery.averageScore:null,trend:recovery?.trend??'BUILDING',availableGames:Number(recovery?.availableGames||0)},
    latestAnalysisAt:data.latest_analysis_at??null,
  };
}

function extractLeakRate(value:unknown){
  const match=String(value||'').match(/([\d.]+)/);
  return match?Number(match[1]):0;
}
