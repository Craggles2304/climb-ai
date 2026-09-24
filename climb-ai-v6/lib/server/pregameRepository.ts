import 'server-only';
import {getSupabaseAdmin} from './supabaseAdmin';
import type {TrackerDevice} from './liveTrackerRepository';

export type PregamePick={cellId:number;championId:number;championName:string|null;role:string|null;lockedIn:boolean;selectionState?:'WAITING'|'HOVER'|'LOCKED'};
export type PregameBan={championId:number;championName:string|null};
export interface PregameContext{version:1;capturedAt:string;phase:string|null;localPlayerCellId:number;localChampionId:number;localChampionName:string|null;localRole:string|null;localLockedIn:boolean;localSelectionState?:'WAITING'|'HOVER'|'LOCKED';allies:PregamePick[];enemies:PregamePick[];bans:{allies:PregameBan[];enemies:PregameBan[]}};
export interface PregameEnvelope{type:'PREGAME'|'PREGAME_END';clientPregameId:string;startedAt:string;endedAt?:string;context?:PregameContext}

export async function savePregameEnvelope(device:TrackerDevice,envelope:PregameEnvelope){
  const db=getSupabaseAdmin();if(!db)throw new Error('Supabase is not configured.');
  const now=new Date().toISOString();
  if(envelope.type==='PREGAME'){
    if(!envelope.context)throw new Error('Pregame context is required.');
    const {error}=await db.from('live_pregame_contexts').upsert({user_id:device.userId,riot_account_id:device.riotAccountId,account_key:device.accountKey,device_id:device.id,client_pregame_id:envelope.clientPregameId,started_at:envelope.startedAt,last_seen_at:now,ended_at:null,context:envelope.context},{onConflict:'device_id,client_pregame_id'});
    if(error)throw new Error(error.message);
    await db.from('live_tracker_devices').update({pregame_context:{clientPregameId:envelope.clientPregameId,...envelope.context},pregame_updated_at:now}).eq('id',device.id);
    return{clientPregameId:envelope.clientPregameId,status:'CHAMP_SELECT' as const};
  }
  const endedAt=envelope.endedAt??now;
  const {error}=await db.from('live_pregame_contexts').update({ended_at:endedAt,last_seen_at:now}).eq('device_id',device.id).eq('client_pregame_id',envelope.clientPregameId);
  if(error)throw new Error(error.message);
  await db.from('live_tracker_devices').update({pregame_context:null,pregame_updated_at:now}).eq('id',device.id);
  return{clientPregameId:envelope.clientPregameId,status:'ENDED' as const};
}

export async function latestPregame(userId:string,accountKey:string){
  const db=getSupabaseAdmin();if(!db)return null;
  const {data,error}=await db.from('live_pregame_contexts').select('id,client_pregame_id,started_at,last_seen_at,ended_at,linked_session_id,context').eq('user_id',userId).eq('account_key',accountKey).order('started_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw new Error(error.message);if(!data)return null;
  const age=Date.now()-new Date(data.last_seen_at).getTime();
  const active=!data.ended_at&&Number.isFinite(age)&&age<30_000;
  return{id:data.id,clientPregameId:data.client_pregame_id,startedAt:data.started_at,lastSeenAt:data.last_seen_at,endedAt:data.ended_at,linkedSessionId:data.linked_session_id??null,status:active?'CHAMP_SELECT':'ENDED',context:data.context as PregameContext};
}
