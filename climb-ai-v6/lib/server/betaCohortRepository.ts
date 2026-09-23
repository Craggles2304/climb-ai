import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {getSupabaseAdmin} from './supabaseAdmin';
import {RELEASE_MANIFEST} from '@/lib/releaseManifest';

export const FOUNDING_BETA_CAP=25;

export type BetaInviteStatus='PENDING'|'CLAIMED'|'REVOKED'|'EXPIRED';
export type BetaTesterStatus='ACTIVE'|'PAUSED'|'COMPLETED'|'REMOVED';
export type BetaReportStatus='OPEN'|'REVIEWING'|'RESOLVED'|'WONT_FIX';

export interface BetaInviteAdmin{
  id:string;
  email:string|null;
  cohort:number;
  status:BetaInviteStatus;
  expiresAt:string;
  claimedBy:string|null;
  claimedAt:string|null;
  createdAt:string;
}
export interface BetaTesterAdmin{
  userId:string;
  gameName:string|null;
  tagline:string|null;
  email:string|null;
  cohort:number;
  status:BetaTesterStatus;
  joinedAt:string;
  lastActivityAt:string|null;
}
export interface BetaReportAdmin{
  id:string;
  userId:string;
  player:string;
  kind:'BUG'|'FRICTION'|'COACHING';
  severity:'BLOCKER'|'HIGH'|'MEDIUM'|'LOW';
  surface:string;
  summary:string;
  details:string|null;
  buildCommit:string|null;
  webVersion:string|null;
  status:BetaReportStatus;
  createdAt:string;
}

const hash=(token:string)=>createHash('sha256').update(token).digest('hex');

function normalizeEmail(value?:string|null){
  const email=(value||'').trim().toLowerCase();
  return email||null;
}

export async function createBetaInvite(input:{email?:string|null;cohort:number;expiresDays:number;createdBy:string;siteUrl:string}){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase admin storage is not configured.');
  const [{count:activeCount,error:activeError},{count:pendingCount,error:pendingError}]=await Promise.all([
    db.from('beta_testers').select('*',{count:'exact',head:true}).eq('status','ACTIVE'),
    db.from('beta_invites').select('*',{count:'exact',head:true}).eq('status','PENDING').gt('expires_at',new Date().toISOString()),
  ]);
  if(activeError||pendingError)throw new Error(activeError?.message||pendingError?.message||'Could not count beta slots.');
  if((activeCount??0)+(pendingCount??0)>=FOUNDING_BETA_CAP)throw new Error('Founding Beta is at the 25-slot cap.');

  const token=randomBytes(24).toString('base64url');
  const expiresAt=new Date(Date.now()+Math.max(1,Math.min(30,input.expiresDays))*86_400_000).toISOString();
  const {data,error}=await db.from('beta_invites').insert({
    token_hash:hash(token),
    email_normalized:normalizeEmail(input.email),
    cohort:Math.max(1,Math.min(999,Math.floor(input.cohort))),
    status:'PENDING',
    expires_at:expiresAt,
    created_by:input.createdBy,
  }).select('id,email_normalized,cohort,status,expires_at,created_at').single();
  if(error)throw new Error(error.message);
  return{
    invite:{
      id:String(data.id),
      email:data.email_normalized??null,
      cohort:Number(data.cohort),
      status:data.status as BetaInviteStatus,
      expiresAt:String(data.expires_at),
      createdAt:String(data.created_at),
    },
    token,
    url:`${input.siteUrl.replace(/\/$/,'')}/beta/join?token=${encodeURIComponent(token)}`,
  };
}

export async function revokeBetaInvite(id:string){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase admin storage is not configured.');
  const {data,error}=await db.from('beta_invites')
    .update({status:'REVOKED'})
    .eq('id',id)
    .eq('status','PENDING')
    .select('id,status')
    .maybeSingle();
  if(error)throw new Error(error.message);
  if(!data)throw new Error('Pending invite not found.');
  return data;
}

export async function claimBetaInvite(input:{token:string;userId:string;email:string|null}){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase admin storage is not configured.');
  const {data,error}=await db.rpc('claim_beta_invite',{
    p_token_hash:hash(input.token),
    p_user_id:input.userId,
    p_email:normalizeEmail(input.email)||'',
  });
  if(error){
    const message=error.message||'Invite claim failed.';
    if(message.includes('INVITE_NOT_FOUND'))throw new Error('That beta invite is invalid.');
    if(message.includes('INVITE_NOT_AVAILABLE'))throw new Error('That beta invite has already been used or revoked.');
    if(message.includes('INVITE_EXPIRED'))throw new Error('That beta invite has expired.');
    if(message.includes('INVITE_EMAIL_MISMATCH'))throw new Error('This beta invite is locked to a different email address.');
    throw new Error(message);
  }
  const row=Array.isArray(data)?data[0]:data;
  if(!row)throw new Error('Invite claim did not return a cohort.');
  return{inviteId:String(row.invite_id),cohort:Number(row.cohort)};
}

export async function getBetaTesterStatus(userId:string){
  const db=getSupabaseAdmin();
  if(!db)return null;
  const {data,error}=await db.from('beta_testers')
    .select('cohort,status,joined_at')
    .eq('user_id',userId)
    .maybeSingle();
  if(error)throw new Error(error.message);
  return data?{cohort:Number(data.cohort),status:data.status as BetaTesterStatus,joinedAt:String(data.joined_at)}:null;
}

export async function submitBetaReport(input:{
  userId:string;
  kind:'BUG'|'FRICTION'|'COACHING';
  severity:'BLOCKER'|'HIGH'|'MEDIUM'|'LOW';
  surface:string;
  summary:string;
  details?:string|null;
}){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase admin storage is not configured.');
  const tester=await getBetaTesterStatus(input.userId);
  if(!tester||tester.status!=='ACTIVE')throw new Error('Active Founding Beta access is required.');
  const {data,error}=await db.from('beta_reports').insert({
    user_id:input.userId,
    kind:input.kind,
    severity:input.severity,
    surface:input.surface.slice(0,80),
    summary:input.summary.trim().slice(0,240),
    details:(input.details||'').trim().slice(0,4000)||null,
    build_commit:(process.env.VERCEL_GIT_COMMIT_SHA||'local').slice(0,12),
    web_version:RELEASE_MANIFEST.webVersion,
    status:'OPEN',
  }).select('id').single();
  if(error)throw new Error(error.message);
  return{reportId:String(data.id)};
}

export async function updateBetaReport(input:{id:string;status:BetaReportStatus;resolutionNote?:string|null;actorId:string}){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase admin storage is not configured.');
  const closed=input.status==='RESOLVED'||input.status==='WONT_FIX';
  const {data,error}=await db.from('beta_reports').update({
    status:input.status,
    resolution_note:(input.resolutionNote||'').trim().slice(0,2000)||null,
    resolved_at:closed?new Date().toISOString():null,
    resolved_by:closed?input.actorId:null,
    updated_at:new Date().toISOString(),
  }).eq('id',input.id).select('id,status').single();
  if(error)throw new Error(error.message);
  return data;
}

export async function getBetaCohortAdminSnapshot(){
  const db=getSupabaseAdmin();
  if(!db)return{invites:[] as BetaInviteAdmin[],testers:[] as BetaTesterAdmin[],reports:[] as BetaReportAdmin[],activeSlots:0,pendingSlots:0,cap:FOUNDING_BETA_CAP,error:'Supabase admin storage is not configured.'};
  const [invitesResult,testersResult,reportsResult]=await Promise.all([
    db.from('beta_invites').select('id,email_normalized,cohort,status,expires_at,claimed_by,claimed_at,created_at').order('created_at',{ascending:false}).limit(100),
    db.from('beta_testers').select('user_id,cohort,status,joined_at').order('joined_at',{ascending:false}).limit(100),
    db.from('beta_reports').select('id,user_id,kind,severity,surface,summary,details,build_commit,web_version,status,created_at').order('created_at',{ascending:false}).limit(100),
  ]);
  const error=invitesResult.error?.message||testersResult.error?.message||reportsResult.error?.message;
  const testerIds=(testersResult.data??[]).map((r:any)=>String(r.user_id));
  const {data:profiles}=testerIds.length?await db.from('profiles').select('id,game_name,tagline').in('id',testerIds):{data:[] as any[]};
  const profileMap=new Map((profiles??[]).map((p:any)=>[String(p.id),p]));
  const {data:users}=await db.auth.admin.listUsers({page:1,perPage:1000});
  const emailMap=new Map((users?.users??[]).map((u:any)=>[String(u.id),u.email??null]));
  const lastActivity=new Map<string,string>();
  if(testerIds.length){
    const {data:events}=await db.from('analytics_events').select('user_id,occurred_at').in('user_id',testerIds).order('occurred_at',{ascending:false}).limit(5000);
    for(const event of events??[]){
      const id=String((event as any).user_id||'');
      if(id&&!lastActivity.has(id))lastActivity.set(id,String((event as any).occurred_at));
    }
  }
  const testers:BetaTesterAdmin[]=(testersResult.data??[]).map((r:any)=>{
    const id=String(r.user_id),p=profileMap.get(id);
    return{userId:id,gameName:p?.game_name??null,tagline:p?.tagline??null,email:emailMap.get(id)??null,cohort:Number(r.cohort),status:r.status as BetaTesterStatus,joinedAt:String(r.joined_at),lastActivityAt:lastActivity.get(id)??null};
  });
  const label=(id:string)=>{const t=testers.find(x=>x.userId===id);return t?.gameName?(t.gameName+(t.tagline?`#${t.tagline}`:'')):(t?.email||'Beta tester')};
  return{
    invites:(invitesResult.data??[]).map((r:any):BetaInviteAdmin=>({id:String(r.id),email:r.email_normalized??null,cohort:Number(r.cohort),status:r.status as BetaInviteStatus,expiresAt:String(r.expires_at),claimedBy:r.claimed_by??null,claimedAt:r.claimed_at??null,createdAt:String(r.created_at)})),
    testers,
    reports:(reportsResult.data??[]).map((r:any):BetaReportAdmin=>({id:String(r.id),userId:String(r.user_id),player:label(String(r.user_id)),kind:r.kind,severity:r.severity,surface:String(r.surface),summary:String(r.summary),details:r.details??null,buildCommit:r.build_commit??null,webVersion:r.web_version??null,status:r.status as BetaReportStatus,createdAt:String(r.created_at)})),
    activeSlots:testers.filter(t=>t.status==='ACTIVE').length,
    pendingSlots:(invitesResult.data??[]).filter((r:any)=>r.status==='PENDING'&&Date.parse(r.expires_at)>Date.now()).length,
    cap:FOUNDING_BETA_CAP,
    ...(error?{error}:{}),
  };
}
