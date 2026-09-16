import type {IssueCategory} from '@/lib/types';

export type CoachAuthorityTask={title:string;category:IssueCategory;metric:string;progress:number;target:string;gameRule:string;priority:number};
export type CoachAuthority={accountId:string|null;tasks:CoachAuthorityTask[];primary:CoachAuthorityTask|null;latestPro:any|null;proMetric:any|null};

const ACTIVE=new Set(['ACTIVE','EVIDENCE_BUILDING']);

export async function resolveOwnedCoachAccount(db:any,userId:string,requestedAccountId?:string,clientMission?:string):Promise<string|null>{
  if(requestedAccountId){
    const {data:owned,error}=await db.from('riot_accounts').select('id').eq('user_id',userId).eq('id',requestedAccountId).maybeSingle();
    if(error)throw new Error(error.message);
    if(!owned?.id)throw new Error('The selected Riot account is not available for this user.');
    return String(owned.id);
  }
  const {data:rows,error}=await db.from('ilp_tasks').select('riot_account_id,payload,updated_at').eq('user_id',userId).order('updated_at',{ascending:false});
  if(error)throw new Error(error.message);
  const all=(rows??[]).map((row:any)=>({accountId:String(row.riot_account_id||''),payload:row.payload??{}}));
  const mission=String(clientMission||'').toLowerCase();
  const missionRow=mission?all.find((row:any)=>String(row.payload?.title||'').toLowerCase()===mission):null;
  if(missionRow?.accountId)return missionRow.accountId;
  const {data:primary,error:accountError}=await db.from('riot_accounts').select('id').eq('user_id',userId).eq('is_primary',true).maybeSingle();
  if(accountError)throw new Error(accountError.message);
  return primary?.id?String(primary.id):all[0]?.accountId||null;
}

export async function loadCoachAuthority(db:any,userId:string,requestedAccountId?:string,clientMission?:string):Promise<CoachAuthority>{
  const accountId=await resolveOwnedCoachAccount(db,userId,requestedAccountId,clientMission);
  const {data:rows,error}=await db.from('ilp_tasks').select('riot_account_id,payload,updated_at').eq('user_id',userId).order('updated_at',{ascending:false});
  if(error)throw new Error(error.message);
  const all=(rows??[]).map((row:any)=>({accountId:String(row.riot_account_id||''),payload:row.payload??{}}));
  const tasks=all.filter((row:any)=>row.accountId===accountId&&ACTIVE.has(String(row.payload?.status||'ACTIVE')))
    .map((row:any)=>toTask(row.payload)).filter(Boolean).sort((a:any,b:any)=>b.priority-a.priority).slice(0,5) as CoachAuthorityTask[];
  let latestPro:any=null;
  if(accountId){
    const {data,error:proError}=await db.from('op_match_analysis').select('analysis,created_at').eq('user_id',userId).eq('riot_account_id',accountId).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(proError)throw new Error(proError.message);
    latestPro=data?.analysis??null;
  }
  const primary=tasks[0]??null;
  const proMetric=primary?.metric&&latestPro?.metrics?.[primary.metric]?latestPro.metrics[primary.metric]:weakestActionable(latestPro);
  return{accountId,tasks,primary,latestPro,proMetric};
}

function toTask(payload:any):CoachAuthorityTask|null{
  if(!payload?.title||!payload?.metric)return null;
  return{title:String(payload.title),category:String(payload.category||'CONSISTENCY') as IssueCategory,metric:String(payload.metric),progress:Number(payload.progress||0),target:String(payload.target||''),gameRule:String(payload.gameRule||''),priority:Number(payload.priority||50)};
}
function weakestActionable(analysis:any){
  const blocked=new Set(['op_score','decision_fingerprint','champion_identity','historical_leak_rate']);
  return Object.values(analysis?.metrics??{}).filter((metric:any)=>metric&&typeof metric.score==='number'&&!blocked.has(metric.key)&&!['UNAVAILABLE','BUILDING'].includes(metric.status)).sort((a:any,b:any)=>a.score-b.score)[0]??null;
}

export function authoritativeContext(client:any,authority:CoachAuthority){
  return{...(client??{}),accountId:authority.accountId,activeTasks:authority.tasks.length?authority.tasks:[],mission:authority.primary?.title??undefined,proAuthority:authority.latestPro?{primaryMission:authority.primary,primaryMetric:authority.proMetric,fingerprint:authority.latestPro?.fingerprint??null,leakSignals:authority.latestPro?.leakSignals??[]}:null};
}

function matchingActiveTask(input:any,authority:CoachAuthority){
  if(!input)return null;
  const metricMatch=authority.tasks.find(task=>input.metric===task.metric);
  if(metricMatch)return metricMatch;
  const categoryMatches=authority.tasks.filter(task=>input.category===task.category);
  return categoryMatches.length===1?categoryMatches[0]:null;
}

export function enforceCoachSuggestion(input:any,authority:CoachAuthority){
  if(!input)return undefined;
  if(!authority.primary)return undefined;
  const task=matchingActiveTask(input,authority);
  if(!task)return undefined;
  return{...input,metric:task.metric,category:task.category,title:task.title,gameRule:task.gameRule,target:task.target,priority:Math.max(task.priority,input.priority||0),source:'COACH'};
}

export function primaryAuthorityInstruction(authority:CoachAuthority){
  if(!authority.primary)return 'No persisted primary mission is available. Do not invent one.';
  return `The only current primary limiter is “${authority.primary.title}” (${authority.primary.metric}). Never call another issue the main, primary, biggest, #1 or highest-priority problem. Secondary Active Five issues may be discussed only as secondary.`;
}
