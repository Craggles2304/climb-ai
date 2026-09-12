import 'server-only';
import {getSupabaseAdmin} from './supabaseAdmin';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';
import {buildProLearningProfile,type ProLearningProfile,type HistoryAnalysisRow,type ProHistoryFix} from '@/lib/riot/proHistory';

export interface PersistProAnalysisInput{userId:string;riotAccountId:string|null;sessionId:string|null;matchId:string|null;externalMatchId?:string|null;champion:string;role:string|null;analysis:ProMatchAnalysis}

export async function persistProMatchAnalysis(input:PersistProAnalysisInput){
  const db=getSupabaseAdmin();if(!db)return null;
  const row={user_id:input.userId,riot_account_id:input.riotAccountId,session_id:input.sessionId,match_id:input.matchId,external_match_id:input.externalMatchId??null,champion:input.champion,role:input.role,evidence_sources:input.analysis.evidenceSources,analysis:input.analysis,updated_at:new Date().toISOString()};
  let query:any;
  if(input.sessionId)query=db.from('op_match_analysis').upsert(row,{onConflict:'session_id'});
  else if(input.matchId)query=db.from('op_match_analysis').upsert(row,{onConflict:'match_id'});
  else query=db.from('op_match_analysis').insert(row);
  const {data,error}=await query.select('id').maybeSingle();if(error)throw new Error(error.message);return data?.id??null;
}

export async function getProMatchAnalysisBySession(sessionId:string):Promise<ProMatchAnalysis|null>{const db=getSupabaseAdmin();if(!db)return null;const {data,error}=await db.from('op_match_analysis').select('analysis').eq('session_id',sessionId).maybeSingle();if(error)throw new Error(error.message);return(data?.analysis as ProMatchAnalysis|undefined)??null}

export async function rebuildProLearningProfile(userId:string,riotAccountId:string|null):Promise<ProLearningProfile|null>{
  const db=getSupabaseAdmin();if(!db||!riotAccountId)return null;
  const {data,error}=await db.from('op_match_analysis').select('champion,role,created_at,analysis').eq('user_id',userId).eq('riot_account_id',riotAccountId).order('created_at',{ascending:true}).limit(50);if(error)throw new Error(error.message);
  const rows:HistoryAnalysisRow[]=(data??[]).map(row=>({champion:String(row.champion||'Unknown'),role:row.role?String(row.role):null,createdAt:String(row.created_at),analysis:row.analysis as ProMatchAnalysis})).filter(row=>row.analysis?.version===1);
  const profile=buildProLearningProfile(rows),now=new Date().toISOString();
  const {error:saveError}=await db.from('op_player_learning_profiles').upsert({user_id:userId,riot_account_id:riotAccountId,games_analyzed:profile.gamesAnalyzed,fingerprint:profile.fingerprint,metric_rollups:profile.metricRollups,fix_ladder:profile.fixLadder,champion_profiles:profile.championProfiles,latest_analysis_at:profile.latestAnalysisAt,updated_at:now},{onConflict:'user_id,riot_account_id'});if(saveError)throw new Error(saveError.message);
  await syncProPriorityToIlp(userId,riotAccountId,profile).catch(err=>console.warn('[pro-ilp] adaptive priority sync failed',err));
  return profile;
}

export async function getProLearningProfile(userId:string,riotAccountId:string|null):Promise<ProLearningProfile|null>{
  const db=getSupabaseAdmin();if(!db||!riotAccountId)return null;
  const {data,error}=await db.from('op_player_learning_profiles').select('games_analyzed,fingerprint,metric_rollups,fix_ladder,champion_profiles,latest_analysis_at').eq('user_id',userId).eq('riot_account_id',riotAccountId).maybeSingle();if(error)throw new Error(error.message);if(!data)return null;
  const leak=(data.metric_rollups as any)?.historical_leak_rate,recovery=(data.metric_rollups as any)?.historical_recovery;
  return{version:1,gamesAnalyzed:Number(data.games_analyzed||0),fingerprint:data.fingerprint as any,metricRollups:data.metric_rollups as any,fixLadder:data.fix_ladder as any,championProfiles:data.champion_profiles as any,opLeakRate:{occurrencesPerGame:extractLeakRate(leak?.recentValue),cleanScore:Number(leak?.averageScore??0),trend:leak?.trend??'BUILDING'},recovery:{score:typeof recovery?.averageScore==='number'?recovery.averageScore:null,trend:recovery?.trend??'BUILDING',availableGames:Number(recovery?.availableGames||0)},latestAnalysisAt:data.latest_analysis_at??null};
}

async function syncProPriorityToIlp(userId:string,riotAccountId:string,profile:ProLearningProfile){
  const top=profile.fixLadder[0];if(!top)return;
  const db=getSupabaseAdmin();if(!db)return;
  const taskId='op-pro-priority';
  const {data:rows,error}=await db.from('ilp_tasks').select('id,payload').eq('user_id',userId).eq('riot_account_id',riotAccountId);if(error)throw new Error(error.message);
  const current=(rows??[]) as {id:string;payload:any}[];
  const existing=current.find(row=>row.id===taskId);
  const active=current.filter(row=>row.id!==taskId&&!['MASTERED','PAUSED'].includes(String(row.payload?.status||'ACTIVE')));
  if(!existing&&active.length>=5){
    const lowest=[...active].sort((a,b)=>Number(a.payload?.priority??50)-Number(b.payload?.priority??50))[0];
    if(lowest){const paused={...(lowest.payload||{}),status:'PAUSED',lastUpdatedReason:`Paused automatically to make room for OP CLIMB priority: ${top.title}`,history:[...((lowest.payload?.history)||[]),{at:new Date().toISOString(),type:'PAUSED',note:`Paused for OP CLIMB priority: ${top.title}`}].slice(-8)};await db.from('ilp_tasks').update({payload:paused,updated_at:new Date().toISOString()}).eq('user_id',userId).eq('riot_account_id',riotAccountId).eq('id',lowest.id)}
  }
  const payload={id:taskId,accountId:riotAccountId,title:`OP Priority: ${top.title}`,category:categoryForFix(top),why:top.why,gameRule:top.rule,metric:'OP PRO Fix Ladder',target:top.mastery,progress:priorityProgress(top,profile),status:'EVIDENCE_BUILDING',source:'SYSTEM',evidence:[`AUTO: ${top.occurrences} occurrence${top.occurrences===1?'':'s'} across ${top.gamesSeen} analysed game${top.gamesSeen===1?'':'s'}.`,`AUTO: Severity ${top.severity}.`],priority:100,successfulGames:0,gamesObserved:profile.gamesAnalyzed,masteryRequired:3,lastUpdatedReason:`Adaptive PRO priority selected from ${profile.gamesAnalyzed} tracked game${profile.gamesAnalyzed===1?'':'s'}.`,history:[...((existing?.payload?.history)||[]),{at:new Date().toISOString(),type:'PROGRESS',note:`OP CLIMB selected ${top.title} as the current highest-priority repeated leak.`}].slice(-8)};
  const {error:upsertError}=await db.from('ilp_tasks').upsert({user_id:userId,riot_account_id:riotAccountId,id:taskId,payload,updated_at:new Date().toISOString()},{onConflict:'user_id,riot_account_id,id'});if(upsertError)throw new Error(upsertError.message);
}

function categoryForFix(fix:ProHistoryFix){const map:Record<string,string>={BANKING_LEAK:'TEMPO',RED_STATE:'TRADING',CHAIN_DEATH:'DEATHS',LEAD_THROW:'CONSISTENCY',CARRY_DEATH:'POSITIONING'};return map[fix.key]||'CONSISTENCY'}
function priorityProgress(fix:ProHistoryFix,profile:ProLearningProfile){if(profile.gamesAnalyzed<3)return 15;if(fix.severity==='POLISH')return 70;if(fix.severity==='ACTIVE')return 45;if(fix.severity==='MAJOR')return 30;return 20}
function extractLeakRate(value:unknown){const match=String(value||'').match(/([\d.]+)/);return match?Number(match[1]):0}
