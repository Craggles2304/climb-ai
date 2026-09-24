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
import {buildClimbInterventionValueProfile} from '@/lib/climbInterventionValue';
import {buildClimbCareerExperience} from '@/lib/climbCareerExperience';
import {buildDecisionCausalProfile,type DecisionCausalProfile} from '@/lib/decisionCausalProfile';
import {buildPlayerCoachingIdentity,type PlayerCoachingIdentity} from '@/lib/playerCoachingIdentity';
import {buildAdaptiveCoachingSession,type AdaptiveCoachingSession} from '@/lib/climbAdaptiveCoachingSession';
import {buildLearningVelocityProfile,type LearningVelocityProfile} from '@/lib/climbLearningVelocity';
import {buildSkillTransferGraph,type SkillTransferGraph} from '@/lib/climbSkillTransferGraph';
import {buildDecisionPrincipleEngine,type DecisionPrincipleEngine} from '@/lib/climbDecisionPrinciples';
import {buildLearningPatchContext} from '@/lib/patchIntelligence';
import {patchChangesForHistory} from './lolPatchIntelligenceRepository';
import {CURRENT_LEARNING_MODEL_VERSION,buildLearningModelHealth,learningModelNeedsRebuild,type LearningModelHealth} from '@/lib/learningModelVersion';

export interface PersistProAnalysisInput{userId:string;riotAccountId:string|null;sessionId:string|null;matchId:string|null;externalMatchId?:string|null;champion:string;role:string|null;analysis:ProMatchAnalysis;patch?:string|null;gameVersion?:string|null;patchContext?:Record<string,unknown>}

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
  const row={user_id:input.userId,riot_account_id:input.riotAccountId,session_id:input.sessionId,match_id:input.matchId,external_match_id:input.externalMatchId??null,champion:input.champion,role:input.role,evidence_sources:input.analysis.evidenceSources,analysis:input.analysis,patch:input.patch??null,game_version:input.gameVersion??null,patch_context:input.patchContext??{},updated_at:new Date().toISOString()};
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
    db.from('op_match_analysis').select('champion,role,created_at,patch,game_version,analysis').eq('user_id',userId).eq('riot_account_id',riotAccountId).order('created_at',{ascending:true}).limit(50),
    db.from('op_player_learning_profiles').select('recent_change').eq('user_id',userId).eq('riot_account_id',riotAccountId).maybeSingle(),
  ]);
  if(historyResult.error)throw new Error(historyResult.error.message);
  if(learningResult.error)throw new Error(learningResult.error.message);
  const rows:HistoryAnalysisRow[]=(historyResult.data??[]).map(row=>({champion:String(row.champion||'Unknown'),role:row.role?String(row.role):null,createdAt:String(row.created_at),patch:row.patch?String(row.patch):null,gameVersion:row.game_version?String(row.game_version):null,analysis:row.analysis as ProMatchAnalysis})).filter(row=>row.analysis?.version===1);
  const previousCurriculum=((learningResult.data?.recent_change as any)?.curriculum??null);
  const previousPlayerCoachingIdentity=((learningResult.data?.recent_change as any)?.playerCoachingIdentity??null) as PlayerCoachingIdentity|null;
  const previousAdaptiveCoachingSession=((learningResult.data?.recent_change as any)?.adaptiveCoachingSession??null) as AdaptiveCoachingSession|null;
  const previousLearningVelocity=((learningResult.data?.recent_change as any)?.learningVelocity??null) as LearningVelocityProfile|null;
  const profile=buildProLearningProfile(rows),now=new Date().toISOString();
  const patchChanges=await patchChangesForHistory(rows).catch(err=>{console.warn('[patch-intelligence] learning change lookup failed',err);return[]});
  const patchContext=buildLearningPatchContext(rows,patchChanges);
  const decisionTwin=buildDecisionTwin(rows,now);
  const decisionTwinV2=buildDecisionTwinV2(rows,now,patchContext);
  const scenarioMemory=buildScenarioMemory(rows,now);
  const decisionTransfer=buildDecisionTransfer(rows,scenarioMemory,now);
  const skillTransferGraph=buildSkillTransferGraph({rows,twin:decisionTwinV2,memory:scenarioMemory,transfer:decisionTransfer,generatedAt:now});
  const decisionPrincipleEngine=buildDecisionPrincipleEngine({rows,skillGraph:skillTransferGraph,generatedAt:now});
  const curriculum=buildClimbCurriculum(decisionTwinV2,scenarioMemory,decisionTransfer,now,previousCurriculum,skillTransferGraph);
  const coachTwin=buildClimbCoachTwin(rows,now);
  const autonomyProfile=buildClimbAutonomyProfile(rows,now);
  const interventionValue=buildClimbInterventionValueProfile(rows,now);
  const causalProfile=buildDecisionCausalProfile(rows,now);
  const playerCoachingIdentity=buildPlayerCoachingIdentity({rows,twin:decisionTwinV2,curriculum,coachTwin,causalProfile,autonomyProfile,interventionValue,previous:previousPlayerCoachingIdentity,generatedAt:now});
  const learningVelocity=buildLearningVelocityProfile({rows,coachTwin,interventionValue,identity:playerCoachingIdentity,curriculum,previous:previousLearningVelocity,generatedAt:now});
  const adaptiveCoachingSession=buildAdaptiveCoachingSession({rows,identity:playerCoachingIdentity,curriculum,previous:previousAdaptiveCoachingSession,learningPolicy:learningVelocity.policy,generatedAt:now});
  const improving=decisionTwin.behaviours.filter(item=>item.trend==='IMPROVING'&&item.applicableGames>=3).sort((a,b)=>(b.recentScore??0)-(a.recentScore??0))[0]??null;
  const worsening=decisionTwin.behaviours.filter(item=>item.trend==='WORSENING'&&item.applicableGames>=3).sort((a,b)=>(a.recentScore??100)-(b.recentScore??100))[0]??null;
  const situationImproving=decisionTwin.situationPatterns.find(item=>item.state==='IMPROVING')??null;
  const situationMastered=decisionTwin.situationPatterns.find(item=>item.state==='MASTERED')??null;
  const situationRegressing=decisionTwin.situationPatterns.find(item=>item.state==='REGRESSING')??null;
  const strongestCoachingResponse=decisionTwin.situationPatterns
    .filter(item=>item.coachedDecisions>0)
    .sort((a,b)=>b.coachedDecisions-a.coachedDecisions||(b.coachedExecutionRate??0)-(a.coachedExecutionRate??0))[0]??null;
  const learningJourney=buildLearningJourney(rows,now);
  const careerExperience=buildClimbCareerExperience(curriculum,learningJourney,now);
  const recentChange={improving,worsening,situationImproving,situationMastered,situationRegressing,strongestCoachingResponse,learningJourney,decisionTwinV2,scenarioMemory,decisionTransfer,skillTransferGraph,decisionPrincipleEngine,curriculum,patchContext,generatedAt:now,coachTwin,autonomyProfile,interventionValue,careerExperience,causalProfile,playerCoachingIdentity,learningVelocity,adaptiveCoachingSession};
  const learningModelHealth=buildLearningModelHealth(recentChange,now);
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
    patch_context:patchContext,
    learning_model_version:CURRENT_LEARNING_MODEL_VERSION,
    learning_model_health:learningModelHealth,
    latest_analysis_at:profile.latestAnalysisAt,
    updated_at:now,
  },{onConflict:'user_id,riot_account_id'});if(saveError)throw new Error(saveError.message);
  return{profile,rows,decisionTwin};
}

const currentRebuilds=new Map<string,Promise<void>>();

export async function ensureLearningModelCurrent(userId:string,riotAccountId:string|null):Promise<LearningModelHealth|null>{
  const db=getSupabaseAdmin();
  if(!db||!riotAccountId)return null;
  const key=userId+'|'+riotAccountId;
  const {data,error}=await db.from('op_player_learning_profiles')
    .select('learning_model_version,learning_model_health,recent_change')
    .eq('user_id',userId).eq('riot_account_id',riotAccountId).maybeSingle();
  if(error)throw new Error(error.message);
  if(!data)return null;

  const liveHealth=buildLearningModelHealth((data.recent_change as Record<string,unknown>|null)??null);
  if(!learningModelNeedsRebuild({storedVersion:data.learning_model_version,recentChange:(data.recent_change as Record<string,unknown>|null)??null,health:data.learning_model_health})){
    return (data.learning_model_health as LearningModelHealth|undefined)??liveHealth;
  }

  let running=currentRebuilds.get(key);
  if(!running){
    running=(async()=>{
      const built=await buildAndSaveProLearningProfile(userId,riotAccountId);
      if(built)await syncRepeatedEvidenceToIlp(userId,riotAccountId,built.profile,built.rows).catch(err=>console.warn('[learning-model] ILP sync after self-heal failed',err));
    })().finally(()=>currentRebuilds.delete(key));
    currentRebuilds.set(key,running);
  }
  await running;

  const {data:refreshed,error:refreshError}=await db.from('op_player_learning_profiles')
    .select('learning_model_health').eq('user_id',userId).eq('riot_account_id',riotAccountId).maybeSingle();
  if(refreshError)throw new Error(refreshError.message);
  return (refreshed?.learning_model_health as LearningModelHealth|undefined)??null;
}

export async function rebuildAllLearningProfiles(){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase admin storage is not configured.');
  const {data,error}=await db.from('op_player_learning_profiles').select('user_id,riot_account_id').order('updated_at',{ascending:true}).limit(5000);
  if(error)throw new Error(error.message);
  const results:Array<{userId:string;riotAccountId:string;ok:boolean;complete:boolean;presentLayers:number;missing:string[];error?:string}>=[];
  for(const row of data??[]){
    const userId=String((row as any).user_id||''),riotAccountId=String((row as any).riot_account_id||'');
    if(!userId||!riotAccountId)continue;
    try{
      const built=await buildAndSaveProLearningProfile(userId,riotAccountId);
      if(built)await syncRepeatedEvidenceToIlp(userId,riotAccountId,built.profile,built.rows).catch(err=>console.warn('[learning-model] ILP sync during full rebuild failed',err));
      const {data:stored,error:storedError}=await db.from('op_player_learning_profiles')
        .select('learning_model_health').eq('user_id',userId).eq('riot_account_id',riotAccountId).single();
      if(storedError)throw new Error(storedError.message);
      const health=stored.learning_model_health as LearningModelHealth;
      results.push({userId,riotAccountId,ok:true,complete:Boolean(health?.complete),presentLayers:Number(health?.presentLayers||0),missing:Array.isArray(health?.missing)?health.missing.map(String):[]});
    }catch(error){
      results.push({userId,riotAccountId,ok:false,complete:false,presentLayers:0,missing:[],error:error instanceof Error?error.message:String(error)});
    }
  }
  return{modelVersion:CURRENT_LEARNING_MODEL_VERSION,total:results.length,complete:results.filter(r=>r.complete).length,failed:results.filter(r=>!r.ok).length,results};
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

export async function getDecisionCausalProfile(userId:string,riotAccountId:string|null):Promise<DecisionCausalProfile|null>{
  const db=getSupabaseAdmin();if(!db||!riotAccountId)return null;
  await ensureLearningModelCurrent(userId,riotAccountId);
  const {data,error}=await db.from('op_player_learning_profiles').select('recent_change').eq('user_id',userId).eq('riot_account_id',riotAccountId).maybeSingle();
  if(error)throw new Error(error.message);
  const profile=(data?.recent_change as any)?.causalProfile;
  return profile?.version===1?profile as DecisionCausalProfile:null;
}

export async function getPlayerCoachingIdentity(userId:string,riotAccountId:string|null):Promise<PlayerCoachingIdentity|null>{
  const db=getSupabaseAdmin();if(!db||!riotAccountId)return null;
  await ensureLearningModelCurrent(userId,riotAccountId);
  const {data,error}=await db.from('op_player_learning_profiles').select('recent_change').eq('user_id',userId).eq('riot_account_id',riotAccountId).maybeSingle();
  if(error)throw new Error(error.message);
  const identity=(data?.recent_change as any)?.playerCoachingIdentity;
  return identity?.version===1?identity as PlayerCoachingIdentity:null;
}

export async function getSkillTransferGraph(userId:string,riotAccountId:string|null):Promise<SkillTransferGraph|null>{
  const db=getSupabaseAdmin();if(!db||!riotAccountId)return null;
  await ensureLearningModelCurrent(userId,riotAccountId);
  const {data,error}=await db.from('op_player_learning_profiles').select('recent_change').eq('user_id',userId).eq('riot_account_id',riotAccountId).maybeSingle();
  if(error)throw new Error(error.message);
  const graph=(data?.recent_change as any)?.skillTransferGraph;
  return graph?.version===1?graph as SkillTransferGraph:null;
}

export async function getDecisionPrincipleEngine(userId:string,riotAccountId:string|null):Promise<DecisionPrincipleEngine|null>{
  const db=getSupabaseAdmin();if(!db||!riotAccountId)return null;
  await ensureLearningModelCurrent(userId,riotAccountId);
  const {data,error}=await db.from('op_player_learning_profiles').select('recent_change').eq('user_id',userId).eq('riot_account_id',riotAccountId).maybeSingle();
  if(error)throw new Error(error.message);
  const engine=(data?.recent_change as any)?.decisionPrincipleEngine;
  return engine?.version===1?engine as DecisionPrincipleEngine:null;
}

export async function getLearningVelocityProfile(userId:string,riotAccountId:string|null):Promise<LearningVelocityProfile|null>{
  const db=getSupabaseAdmin();if(!db||!riotAccountId)return null;
  await ensureLearningModelCurrent(userId,riotAccountId);
  const {data,error}=await db.from('op_player_learning_profiles').select('recent_change').eq('user_id',userId).eq('riot_account_id',riotAccountId).maybeSingle();
  if(error)throw new Error(error.message);
  const profile=(data?.recent_change as any)?.learningVelocity;
  return profile?.version===1?profile as LearningVelocityProfile:null;
}

export async function getAdaptiveCoachingSession(userId:string,riotAccountId:string|null):Promise<AdaptiveCoachingSession|null>{
  const db=getSupabaseAdmin();if(!db||!riotAccountId)return null;
  await ensureLearningModelCurrent(userId,riotAccountId);
  const {data,error}=await db.from('op_player_learning_profiles').select('recent_change').eq('user_id',userId).eq('riot_account_id',riotAccountId).maybeSingle();
  if(error)throw new Error(error.message);
  const session=(data?.recent_change as any)?.adaptiveCoachingSession;
  return session?.version===1?session as AdaptiveCoachingSession:null;
}

export async function getProLearningProfile(userId:string,riotAccountId:string|null):Promise<ProLearningProfile|null>{
  const db=getSupabaseAdmin();if(!db||!riotAccountId)return null;
  await ensureLearningModelCurrent(userId,riotAccountId);
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
