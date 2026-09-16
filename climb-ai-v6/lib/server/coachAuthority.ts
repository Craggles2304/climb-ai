import type {IssueCategory} from '@/lib/types';

export type CoachAuthorityTask={title:string;category:IssueCategory;metric:string;progress:number;target:string;gameRule:string;priority:number};
export type CoachAuthority={accountId:string|null;tasks:CoachAuthorityTask[];primary:CoachAuthorityTask|null;latestPro:any|null;proMetric:any|null};

const ACTIVE=new Set(['ACTIVE','EVIDENCE_BUILDING']);

export async function loadCoachAuthority(db:any,userId:string,clientMission?:string):Promise<CoachAuthority>{
  const {data:rows,error}=await db.from('ilp_tasks').select('riot_account_id,payload,updated_at').eq('user_id',userId).order('updated_at',{ascending:false});
  if(error)throw new Error(error.message);
  const all=(rows??[]).map((row:any)=>({accountId:String(row.riot_account_id||''),payload:row.payload??{}}));
  const mission=String(clientMission||'').toLowerCase();
  const missionRow=mission?all.find((row:any)=>String(row.payload?.title||'').toLowerCase()===mission):null;
  let accountId=missionRow?.accountId||null;
  if(!accountId){
    const {data:primary,error:accountError}=await db.from('riot_accounts').select('id').eq('user_id',userId).eq('is_primary',true).maybeSingle();
    if(accountError)throw new Error(accountError.message);
    accountId=primary?.id?String(primary.id):all[0]?.accountId||null;
  }
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
  return{...(client??{}),activeTasks:authority.tasks.length?authority.tasks:client?.activeTasks??[],mission:authority.primary?.title??client?.mission,proAuthority:authority.latestPro?{primaryMission:authority.primary,primaryMetric:authority.proMetric,fingerprint:authority.latestPro?.fingerprint??null,leakSignals:authority.latestPro?.leakSignals??[]}:null};
}

export function enforceCoachSuggestion(input:any,authority:CoachAuthority){
  if(!input)return undefined;
  const primary=authority.primary;
  if(!primary)return input;
  const same=input.metric===primary.metric||input.category===primary.category;
  if(!same)return undefined;
  return{...input,metric:primary.metric,category:primary.category,title:primary.title,gameRule:primary.gameRule,target:primary.target,priority:Math.max(primary.priority,input.priority||0),source:'COACH'};
}
