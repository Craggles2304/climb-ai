import 'server-only';
import {getSupabaseAdmin} from './supabaseAdmin';
import {RELEASE_MANIFEST} from '@/lib/releaseManifest';
import type {BetaMetricKey,BetaExperimentRecommendation} from '@/lib/betaOperationsModel';
import type {FoundingBetaValidation} from '@/lib/foundingBetaModel';

export type BetaExperimentStatus='RUNNING'|'COMPLETE'|'CANCELLED';

export interface BetaExperiment{
  id:string;
  name:string;
  hypothesis:string;
  metricKey:BetaMetricKey;
  baselineValue:number;
  targetValue:number;
  latestValue:number|null;
  startCommit:string|null;
  startVersion:string|null;
  status:BetaExperimentStatus;
  outcome:string|null;
  result:Record<string,unknown>;
  startedAt:string;
  endedAt:string|null;
}

const map=(row:any):BetaExperiment=>({
  id:String(row.id),
  name:String(row.name),
  hypothesis:String(row.hypothesis),
  metricKey:row.metric_key as BetaMetricKey,
  baselineValue:Number(row.baseline_value),
  targetValue:Number(row.target_value),
  latestValue:row.latest_value===null||row.latest_value===undefined?null:Number(row.latest_value),
  startCommit:row.start_commit??null,
  startVersion:row.start_version??null,
  status:row.status as BetaExperimentStatus,
  outcome:row.outcome??null,
  result:(row.result&&typeof row.result==='object'?row.result:{}) as Record<string,unknown>,
  startedAt:String(row.started_at),
  endedAt:row.ended_at??null,
});

export function betaMetricValue(report:FoundingBetaValidation,key:BetaMetricKey):number{
  switch(key){
    case'activationToGradePct':return report.activationToGradePct;
    case'companionAdoptionPct':return report.companionAdoptionPct;
    case'trackedGameAfterCompanionPct':return report.trackedGameAfterCompanionPct;
    case'sessionCompletionPct':return report.sessionCompletionPct;
    case'careerAdoptionPct':return report.careerAdoptionPct;
    case'usefulFeedbackPct':return report.usefulFeedback.rate??0;
    case'day1ReturnPct':return report.day1.rate??0;
    case'day7ReturnPct':return report.day7.rate??0;
  }
}

export async function getBetaExperiments(limit=10):Promise<{active:BetaExperiment|null;history:BetaExperiment[];error?:string}>{
  const db=getSupabaseAdmin();
  if(!db)return{active:null,history:[],error:'Supabase admin storage is not configured.'};
  const {data,error}=await db.from('beta_experiments')
    .select('*')
    .order('started_at',{ascending:false})
    .limit(limit);
  if(error)return{active:null,history:[],error:error.message};
  const rows=(data??[]).map(map);
  return{active:rows.find(row=>row.status==='RUNNING')??null,history:rows.filter(row=>row.status!=='RUNNING')};
}

export async function startBetaExperiment(input:{
  recommendation:BetaExperimentRecommendation;
  baselineValue:number;
  createdBy:string;
}):Promise<BetaExperiment>{
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase admin storage is not configured.');
  const targetValue=Math.min(100,Math.max(0,input.baselineValue+input.recommendation.targetDelta));
  const {data,error}=await db.from('beta_experiments').insert({
    name:input.recommendation.title,
    hypothesis:input.recommendation.hypothesis,
    metric_key:input.recommendation.metricKey,
    baseline_value:input.baselineValue,
    target_value:targetValue,
    latest_value:input.baselineValue,
    start_commit:(process.env.VERCEL_GIT_COMMIT_SHA||'local').slice(0,12),
    start_version:RELEASE_MANIFEST.webVersion,
    status:'RUNNING',
    created_by:input.createdBy,
    result:{
      blocker:input.recommendation.blocker,
      affectedPlayers:input.recommendation.affectedPlayers,
      reason:input.recommendation.reason,
      targetDelta:input.recommendation.targetDelta,
    },
  }).select('*').single();
  if(error)throw new Error(error.message);
  return map(data);
}

export async function finishBetaExperiment(input:{
  id:string;
  currentValue:number;
  actorId:string;
  action:'COMPLETE'|'CANCELLED';
}):Promise<BetaExperiment>{
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase admin storage is not configured.');
  const {data:existing,error:readError}=await db.from('beta_experiments').select('*').eq('id',input.id).single();
  if(readError||!existing)throw new Error(readError?.message||'Experiment not found.');
  const current=map(existing);
  if(current.status!=='RUNNING')return current;
  const delta=Math.round((input.currentValue-current.baselineValue)*10)/10;
  const hitTarget=input.currentValue>=current.targetValue;
  const outcome=input.action==='CANCELLED'?'CANCELLED':hitTarget?'TARGET_MET':delta>0?'IMPROVED_NOT_ENOUGH':'NO_IMPROVEMENT';
  const {data,error}=await db.from('beta_experiments').update({
    latest_value:input.currentValue,
    status:input.action,
    outcome,
    ended_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),
    result:{...current.result,delta,hitTarget,closedBy:input.actorId},
  }).eq('id',input.id).select('*').single();
  if(error)throw new Error(error.message);
  return map(data);
}
