import 'server-only';
import {getSupabaseAdmin} from './supabaseAdmin';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';
import {buildProLearningProfile,type ProLearningProfile,type HistoryAnalysisRow} from '@/lib/riot/proHistory';
import {adaptActiveFiveFromPostGameEvidence} from '@/lib/adaptiveIlpEvidence';
import type {ILPTask} from '@/lib/types';
import {buildDecisionTwin} from '@/lib/decisionTwin';
import {buildDecisionTwinV2} from '@/lib/decisionTwinV2';
import {buildLearningJourney} from '@/lib/learningJourney';
import {buildScenarioMemory} from '@/lib/scenarioMemory';
import {buildDecisionTransfer} from '@/lib/decisionTransfer';
import {buildClimbCurriculum} from '@/lib/climbCurriculum';
import {buildClimbCoachTwin} from '@/lib/climbCoachTwin';
import {buildClimbAutonomyProfile} from '@/lib/climbAutonomy';

export interface PersistProAnalysisInput{userId:string;riotAccountId:string|null;sessionId:string|null;matchId:string|null;externalMatchId?:string|null;champion:string;role:string|null;analysis:ProMatchAnalysis}

export interface PostGameIlpMission{
  id:string;
  title:string;
  status:string;
  progress:number;
  category:string;
  gameRule:string;
  priority:number;
  source:string;
  adaptiveAction:string|null;
}
export interface PostGameIlpSyncResult{
  status:'COMPLETE';
  source:'POST_GAME_EVIDENCE';
  syncedAt:string;
  processedAnalysisAt:string|null;
  changed:boolean;
  changes:string[];
  activeCount:number;
  activeFive:PostGameIlpMission[];
  primary:PostGameIlpMission|null;
  gamesAnalyzed:number;
  reused:boolean;
}

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

async function buildAndSaveProLearningProfile(userId:string,riotAccountId:string){
  const db=getSupabaseAdmin();if(!db)return null;
  const [historyResult,learningResult]=await Promise.all([
    db.from('op_match_analysis').select('champion,role,created_at,analysis').eq('user_id',userId).eq('riot_account_id',riotAccountId).order('created_at',{ascending:true}).limit(50),
    db.from('op_player_learning_profiles').select('recent_change').eq('user_id',userId).eq('riot_account_id',riotAccountId).maybeSingle(),
  ]);
  if(historyResult.error)throw new Error(historyResult.error.message);
  if(learningResult.error)throw new Error(learningResult.error.message);
  const rows:HistoryAnalysisRow[]=(historyResult.data??[]).map(row=>({champion:String(row.champion||'Unknown'),role:row.role?String(row.role):null,createdAt:String(row.created_at),analysis:row.analysis as ProMatchAnalysis})).filter(row=>row.analysis?.version===1);
  const previousCurriculum=((learningResult.data?.recent_change as any)?.curriculum??null);
  const profile=buildProLearningProfile(rows),now=new Date().toISOString();
  const decisionTwin=buildDecisionTwin(rows,now);
  const decisionTwinV2=buildDecisionTwinV2(rows,now);
  const scenarioMemory=buildScenarioMemory(rows,now);
  const decisionTransfer=buildDecisionTransfer(rows,scenarioMemory,now);
  const curriculum=buildClimbCurriculum(decisionTwinV2,scenarioMemory,decisionTransfer,now,previousCurriculum);
  const coachTwin=buildClimbCoachTwin(rows,now);
  const autonomyProfile=buildClimbAutonomyProfile(rows,now);
  const improving=decisionTwin.behaviours.filter(item=>item.trend==='IMPROVING'&&item.applicableGames>=3).sort((a,b)=>(b.recentScore??0)-(a.recentScore??0))[0]??null;
  const worsening=decisionTwin.behaviours.filter(item=>item.trend==='WORSENING'&&item.applicableGames>=3).sort((a,b)=>(a.recentScore??100)-(b.recentScore??100))[0]??null;
  const situationImproving=decisionTwin.situationPatterns.find(item=>item.state==='IMPROVING')??null;
  const situationMastered=decisionTwin.situationPatterns.find(item=>item.state==='MASTERED')??null;
  const situationRegressing=decisionTwin.situationPatterns.find(item=>item.state==='REGRESSING')??null;
  const strongestCoachingResponse=decisionTwin.situationPatterns
    .filter(item=>item.coachedDecisions>0)
    .sort((a,b)=>b.coachedDecisions-a.coachedDecisions||(b.coachedExecutionRate??0)-(a.coachedExecutionRate??0))[0]??null;
  const learningJourney=buildLearningJourney(rows,now);
  const recentChange={improving,worsening,situationImproving,situationMastered,situationRegressing,strongestCoachingResponse,learningJourney,decisionTwinV2,scenarioMemory,decisionTransfer,curriculum,generatedAt:now,coachTwin,autonomyProfile};
  const {error:saveError}=await db.from('op_player_learning_profiles').upsert({
    user_id:userId,
    riot_account_id:riotAccountId,
    games_analyzed:profile.gamesAnalyzed,
    fingerprint:profile.fingerprint,
    metric_rollups:profile.metricRollups,
    fix_ladder:profile.fixLadder,
    champion_profiles:profile.championProfiles,
    learning_identity:decisionTwin,
    mastered_behaviours:decisionTwin.mastered,
    current_focus:decisionTwin.currentLimiter??{},
    recent_change:recentChange,
    latest_analysis_at:profile.latestAnalysisAt,
    updated_at:now,
  },{onConflict:'user_id,riot_account_id'});if(saveError)throw new Error(saveError.message);
  return{profile,rows,decisionTwin};
}

export async function rebuildProLearningProfile(userId:string,riotAccountId:string|null):Promise<ProLearningProfile|null>{
  if(!riotAccountId)return null;
  const built=await buildAndSaveProLearningProfile(userId,riotAccountId);if(!built)return null;
  await syncRepeatedEvidenceToIlp(userId,riotAccountId,built.profile,built.rows).catch(err=>console.warn('[pro-ilp] repeated-evidence Active Five sync failed',err));
  return built.profile;
}

export async function rebuildProLearningProfileWithIlp(userId:string,riotAccountId:string|null):Promise<{profile:ProLearningProfile;ilp:PostGameIlpSyncResult}|null>{
  if(!riotAccountId)return null;
  const built=await buildAndSaveProLearningProfile(userId,riotAccountId);if(!built)return null;
  const ilp=await syncRepeatedEvidenceToIlp(userId,riotAccountId,built.profile,built.rows);
  return{profile:built.profile,ilp};
}

export async function getProLearningProfile(userId:string,riotAccountId:string|null):Promise<ProLearningProfile|null>{
  const db=getSupabaseAdmin();if(!db||!riotAccountId)return null;
  const {data,error}=await db.from('op_player_learning_profiles').select('games_analyzed,fingerprint,metric_rollups,fix_ladder,champion_profiles,latest_analysis_at').eq('user_id',userId).eq('riot_account_id',riotAccountId).maybeSingle();if(error)throw new Error(error.message);if(!data)return null;
  const leak=(data.metric_rollups as any)?.historical_leak_rate,recovery=(data.metric_rollups as any)?.historical_recovery;
  return{version:1,gamesAnalyzed:Number(data.games_analyzed||0),fingerprint:data.fingerprint as any,metricRollups:data.metric_rollups as any,fixLadder:data.fix_ladder as any,championProfiles:data.champion_profiles as any,opLeakRate:{occurrencesPerGame:extractLeakRate(leak?.recentValue),cleanScore:Number(leak?.averageScore??0),trend:leak?.trend??'BUILDING'},recovery:{score:typeof recovery?.averageScore==='number'?recovery.averageScore:null,trend:recovery?.trend??'BUILDING',availableGames:Number(recovery?.availableGames||0)},latestAnalysisAt:data.latest_analysis_at??null};
}

export async function syncRepeatedEvidenceToIlp(userId:string,riotAccountId:string,profile:ProLearningProfile,history:HistoryAnalysisRow[]):Promise<PostGameIlpSyncResult>{
  const db=getSupabaseAdmin();if(!db)throw new Error('Supabase is required for post-game ILP sync.');
  const {data:stored,error}=await db.from('ilp_tasks').select('id,payload').eq('user_id',userId).eq('riot_account_id',riotAccountId);if(error)throw new Error(error.message);
  const tasks:ILPTask[]=(stored??[]).map((row:any)=>({...((row.payload&&typeof row.payload==='object')?row.payload:{}),id:String(row.id),accountId:riotAccountId}));

  const role=[...history].reverse().find(row=>row.role)?.role??null;
  const adapted=adaptActiveFiveFromPostGameEvidence({tasks,profile,history,accountId:riotAccountId,role});
  if(adapted.tasks.length){
    const now=new Date().toISOString();
    const rows=adapted.tasks.map(task=>({user_id:userId,riot_account_id:riotAccountId,id:task.id,payload:{...task,accountId:riotAccountId},updated_at:now}));
    const {error:upsertError}=await db.from('ilp_tasks').upsert(rows,{onConflict:'user_id,riot_account_id,id'});if(upsertError)throw new Error(upsertError.message);
  }
  if(adapted.changes.length)console.info('[pro-ilp] Active Five adapted',adapted.changes);
  return ilpSyncSnapshot(adapted.tasks,profile,adapted.changes,false);
}

function ilpSyncSnapshot(tasks:ILPTask[],profile:ProLearningProfile,changes:string[],reused:boolean):PostGameIlpSyncResult{
  const active=tasks.filter(task=>task.status!=='MASTERED'&&task.status!=='PAUSED').sort((a,b)=>Number(b.priority??50)-Number(a.priority??50));
  const activeFive=active.slice(0,5).map(toPostGameMission);
  return{
    status:'COMPLETE',
    source:'POST_GAME_EVIDENCE',
    syncedAt:new Date().toISOString(),
    processedAnalysisAt:profile.latestAnalysisAt??null,
    changed:changes.length>0,
    changes:[...changes],
    activeCount:active.length,
    activeFive,
    primary:activeFive[0]??null,
    gamesAnalyzed:Number(profile.gamesAnalyzed||0),
    reused,
  };
}
function toPostGameMission(task:ILPTask):PostGameIlpMission{
  const adaptive=(task as ILPTask&{adaptive?:{lastAction?:string}}).adaptive;
  return{id:task.id,title:task.title,status:String(task.status||'ACTIVE'),progress:Number(task.progress||0),category:String(task.category||'CONSISTENCY'),gameRule:task.gameRule,priority:Number(task.priority??50),source:String(task.source||'SYSTEM'),adaptiveAction:adaptive?.lastAction?String(adaptive.lastAction):null};
}

function extractLeakRate(value:unknown){const match=String(value||'').match(/([\d.]+)/);return match?Number(match[1]):0}
