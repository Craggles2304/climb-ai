import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {getSupabaseAdmin} from './supabaseAdmin';
import {buildStrengthTimeline} from '@/lib/riot/liveStrength';
import type {LiveTelemetrySnapshot} from '@/lib/riot/liveTelemetry';

export interface TrackerDevice{
  id:string;
  userId:string;
  accountKey:string;
  deviceName:string;
}

export interface LiveEnvelope{
  type:'SNAPSHOT'|'END';
  clientSessionId:string;
  startedAt?:string;
  endedAt?:string;
  snapshot?:LiveTelemetrySnapshot;
}

export async function createTrackerDevice(userId:string,accountKey:string,deviceName:string){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase is required for secure tracker pairing.');
  const token=`climb_live_${randomBytes(32).toString('base64url')}`;
  const tokenHash=hashTrackerToken(token);
  const {data,error}=await db.from('live_tracker_devices').insert({
    user_id:userId,account_key:accountKey,device_name:deviceName,token_hash:tokenHash,
  }).select('id,account_key,device_name,created_at,last_seen_at').single();
  if(error)throw new Error(error.message);
  return {token,device:data};
}

export async function listTrackerDevices(userId:string){
  const db=getSupabaseAdmin();
  if(!db)return [];
  const {data,error}=await db.from('live_tracker_devices')
    .select('id,account_key,device_name,created_at,last_seen_at,revoked_at')
    .eq('user_id',userId).is('revoked_at',null).order('created_at',{ascending:false});
  if(error)throw new Error(error.message);
  return data??[];
}

export async function revokeTrackerDevice(userId:string,deviceId:string){
  const db=getSupabaseAdmin();
  if(!db)return false;
  const {error}=await db.from('live_tracker_devices').update({revoked_at:new Date().toISOString()})
    .eq('id',deviceId).eq('user_id',userId);
  if(error)throw new Error(error.message);
  return true;
}

export async function authenticateTrackerToken(token:string):Promise<TrackerDevice|null>{
  const db=getSupabaseAdmin();
  if(!db)return null;
  const tokenHash=hashTrackerToken(token);
  const {data,error}=await db.from('live_tracker_devices')
    .select('id,user_id,account_key,device_name,revoked_at')
    .eq('token_hash',tokenHash).is('revoked_at',null).maybeSingle();
  if(error||!data)return null;
  await db.from('live_tracker_devices').update({last_seen_at:new Date().toISOString()}).eq('id',data.id);
  return {id:data.id,userId:data.user_id,accountKey:data.account_key,deviceName:data.device_name};
}

export async function saveLiveEnvelope(device:TrackerDevice,envelope:LiveEnvelope){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase is not configured.');
  const now=new Date().toISOString();
  const existing=await db.from('live_telemetry_sessions').select('id,started_at')
    .eq('device_id',device.id).eq('client_session_id',envelope.clientSessionId).maybeSingle();
  if(existing.error)throw new Error(existing.error.message);

  let sessionId=existing.data?.id as string|undefined;
  if(!sessionId){
    const {data,error}=await db.from('live_telemetry_sessions').insert({
      user_id:device.userId,device_id:device.id,account_key:device.accountKey,
      client_session_id:envelope.clientSessionId,started_at:envelope.startedAt??now,
      last_seen_at:now,status:envelope.type==='END'?'COMPLETE':'ACTIVE',
      ended_at:envelope.type==='END'?(envelope.endedAt??now):null,
      metadata:{deviceName:device.deviceName},
    }).select('id').single();
    if(error)throw new Error(error.message);
    sessionId=data?.id as string|undefined;
  }else{
    const patch:Record<string,unknown>={last_seen_at:now};
    if(envelope.type==='END'){
      patch.status='COMPLETE';patch.ended_at=envelope.endedAt??now;
    }
    const {error}=await db.from('live_telemetry_sessions').update(patch).eq('id',sessionId);
    if(error)throw new Error(error.message);
  }

  if(!sessionId)throw new Error('Live session could not be created.');
  const confirmedSessionId=sessionId;

  if(envelope.type==='SNAPSHOT'&&envelope.snapshot){
    const {error}=await db.from('live_telemetry_snapshots').insert({
      session_id:confirmedSessionId,game_time:envelope.snapshot.gameTime,payload:envelope.snapshot,
    });
    if(error)throw new Error(error.message);
  }

  if(envelope.type==='END')await finalizeSession(confirmedSessionId);
  return {sessionId:confirmedSessionId};
}

export async function latestLiveReview(userId:string,accountKey:string){
  const db=getSupabaseAdmin();
  if(!db)return null;
  const {data:session,error}=await db.from('live_telemetry_sessions')
    .select('id,status,started_at,ended_at,last_seen_at,summary,metadata')
    .eq('user_id',userId).eq('account_key',accountKey)
    .order('started_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw new Error(error.message);
  if(!session)return null;
  const {data:snapshots,error:snapshotError}=await db.from('live_telemetry_snapshots')
    .select('game_time,payload').eq('session_id',session.id).order('game_time',{ascending:true});
  if(snapshotError)throw new Error(snapshotError.message);
  const normalized=(snapshots??[]).map(row=>row.payload as LiveTelemetrySnapshot);
  const summary=normalized.length?buildStrengthTimeline(normalized):session.summary;
  return {
    sessionId:session.id,status:session.status,startedAt:session.started_at,endedAt:session.ended_at,
    lastSeenAt:session.last_seen_at,snapshotCount:normalized.length,
    latestSnapshot:normalized[normalized.length-1]??null,summary,
  };
}

async function finalizeSession(sessionId:string){
  const db=getSupabaseAdmin();
  if(!db)return;
  const {data,error}=await db.from('live_telemetry_snapshots').select('payload')
    .eq('session_id',sessionId).order('game_time',{ascending:true});
  if(error)throw new Error(error.message);
  const snapshots=(data??[]).map(row=>row.payload as LiveTelemetrySnapshot);
  const summary=buildStrengthTimeline(snapshots);
  const {error:updateError}=await db.from('live_telemetry_sessions').update({summary}).eq('id',sessionId);
  if(updateError)throw new Error(updateError.message);
}

export function hashTrackerToken(token:string){
  return createHash('sha256').update(token).digest('hex');
}
