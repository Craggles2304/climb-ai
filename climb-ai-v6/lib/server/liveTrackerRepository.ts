import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {getSupabaseAdmin} from './supabaseAdmin';
import {buildStrengthTimeline,type StrengthTimeline} from '@/lib/riot/liveStrength';
import type {LiveTelemetryPlayer,LiveTelemetrySnapshot} from '@/lib/riot/liveTelemetry';

export interface TrackerDevice{
  id:string;
  userId:string;
  accountKey:string;
  riotAccountId:string|null;
  deviceName:string;
}

export interface RiotProfileInput{
  gameName:string;
  tagline:string;
  region:string;
  role?:string;
  rank?:string;
  champions?:string[];
  frustration?:string;
}

export interface LiveEnvelope{
  type:'SNAPSHOT'|'END';
  clientSessionId:string;
  startedAt?:string;
  endedAt?:string;
  snapshot?:LiveTelemetrySnapshot;
}

export async function createTrackerDevice(userId:string,accountKey:string,deviceName:string,riotProfile:RiotProfileInput){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase is required for secure tracker pairing.');
  const now=new Date().toISOString();
  const tagline=riotProfile.tagline.replace(/^#/,'').trim().toUpperCase();
  const region=riotProfile.region.trim().toUpperCase();
  const gameName=riotProfile.gameName.trim();

  const {error:profileError}=await db.from('profiles').upsert({
    id:userId,game_name:gameName,tagline,region,
    role:riotProfile.role?.toUpperCase()||null,rank:riotProfile.rank||null,
    champions:riotProfile.champions??[],frustration:riotProfile.frustration||null,updated_at:now,
  },{onConflict:'id'});
  if(profileError)throw new Error(profileError.message);

  const {error:clearError}=await db.from('riot_accounts').update({is_primary:false,updated_at:now})
    .eq('user_id',userId).eq('is_primary',true);
  if(clearError)throw new Error(clearError.message);

  const {data:riotAccount,error:riotError}=await db.from('riot_accounts').upsert({
    user_id:userId,game_name:gameName,tagline,region,label:'PRIMARY',is_primary:true,
    sync_status:'paired',updated_at:now,
  },{onConflict:'user_id,game_name,tagline,region'}).select(
    'id,game_name,tagline,region,verification_status,observed_riot_id,verified_at'
  ).single();
  if(riotError||!riotAccount)throw new Error(riotError?.message||'Riot account could not be saved.');

  const token=`climb_live_${randomBytes(32).toString('base64url')}`;
  const tokenHash=hashTrackerToken(token);
  const {data,error}=await db.from('live_tracker_devices').insert({
    user_id:userId,account_key:accountKey,riot_account_id:riotAccount.id,
    device_name:deviceName,token_hash:tokenHash,
  }).select('id,account_key,riot_account_id,device_name,created_at,last_seen_at').single();
  if(error)throw new Error(error.message);
  return {token,device:data,riotAccount};
}

export async function listTrackerDevices(userId:string){
  const db=getSupabaseAdmin();
  if(!db)return [];
  const {data,error}=await db.from('live_tracker_devices')
    .select('id,account_key,riot_account_id,device_name,created_at,last_seen_at,revoked_at')
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
    .select('id,user_id,account_key,riot_account_id,device_name,revoked_at')
    .eq('token_hash',tokenHash).is('revoked_at',null).maybeSingle();
  if(error||!data)return null;
  await db.from('live_tracker_devices').update({last_seen_at:new Date().toISOString()}).eq('id',data.id);
  return {id:data.id,userId:data.user_id,accountKey:data.account_key,riotAccountId:data.riot_account_id??null,deviceName:data.device_name};
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
      user_id:device.userId,riot_account_id:device.riotAccountId,device_id:device.id,account_key:device.accountKey,
      client_session_id:envelope.clientSessionId,started_at:envelope.startedAt??now,
      last_seen_at:now,status:envelope.type==='END'?'COMPLETE':'ACTIVE',
      ended_at:envelope.type==='END'?(envelope.endedAt??now):null,
      metadata:{deviceName:device.deviceName},
    }).select('id').single();
    if(error)throw new Error(error.message);
    sessionId=data?.id as string|undefined;
  }else{
    const patch:Record<string,unknown>={last_seen_at:now};
    if(envelope.type==='END'){patch.status='COMPLETE';patch.ended_at=envelope.endedAt??now}
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
  const [{data:session,error:sessionError},{data,error}]=await Promise.all([
    db.from('live_telemetry_sessions').select('id,user_id,riot_account_id,account_key,started_at,ended_at').eq('id',sessionId).single(),
    db.from('live_telemetry_snapshots').select('payload').eq('session_id',sessionId).order('game_time',{ascending:true}),
  ]);
  if(sessionError)throw new Error(sessionError.message);
  if(error)throw new Error(error.message);
  const snapshots=(data??[]).map(row=>row.payload as LiveTelemetrySnapshot);
  const summary=buildStrengthTimeline(snapshots);
  const {error:updateError}=await db.from('live_telemetry_sessions').update({summary}).eq('id',sessionId);
  if(updateError)throw new Error(updateError.message);
  if(!snapshots.length)return;

  const jobs=[
    persistReviewEvents(session,summary),
    persistLiveMatch(session,snapshots,summary),
    verifyObservedRiotIdentity(session.riot_account_id,snapshots[snapshots.length-1]),
  ];
  const results=await Promise.allSettled(jobs);
  for(const result of results)if(result.status==='rejected')console.warn('[live-finalize] secondary persistence failed',result.reason);
}

async function persistReviewEvents(session:any,summary:StrengthTimeline){
  const db=getSupabaseAdmin();
  if(!db||!summary.opportunities.length)return;
  await db.from('live_review_events').delete().eq('session_id',session.id);
  const {error}=await db.from('live_review_events').insert(summary.opportunities.map(window=>({
    user_id:session.user_id,riot_account_id:session.riot_account_id,session_id:session.id,
    game_time:window.atSeconds,event_type:window.type,opponent:window.opponent,
    confidence:window.confidence,headline:window.headline,detail:window.detail,
    evidence:{...window.evidence,score:window.score,limitation:window.limitation},
  })));
  if(error)throw new Error(error.message);
}

async function persistLiveMatch(session:any,snapshots:LiveTelemetrySnapshot[],summary:StrengthTimeline){
  const db=getSupabaseAdmin();
  if(!db)return;
  const final=snapshots[snapshots.length-1];
  const me=findMe(final);
  if(!me)return;
  const {data:existing,error:existingError}=await db.from('matches').select('id').eq('live_session_id',session.id).maybeSingle();
  if(existingError)throw new Error(existingError.message);
  if(existing)return;
  const {data:match,error}=await db.from('matches').insert({
    user_id:session.user_id,riot_account_id:session.riot_account_id,live_session_id:session.id,
    external_match_id:null,champion:me.championName||final.active.championName||'Unknown',
    role:final.active.position||me.position||'UNKNOWN',result:inferResult(snapshots),
    kills:me.scores.kills,deaths:me.scores.deaths,assists:me.scores.assists,
    duration_seconds:Math.max(1,Math.round(final.gameTime)),rank:null,source:'LIVE_TRACKER',
    occurred_at:session.started_at||new Date().toISOString(),
  }).select('id').single();
  if(error||!match)throw new Error(error?.message||'Live match could not be saved.');
  const minutes=Math.max(final.gameTime/60,1/60);
  const {error:metricError}=await db.from('match_metrics').insert({
    match_id:match.id,user_id:session.user_id,cs:me.scores.creepScore,
    cs_per_min:Math.round((me.scores.creepScore/minutes)*100)/100,
    vision_score:me.scores.wardScore,
    raw:{source:'LIVE_TRACKER',currentGold:final.active.currentGold,summary},
  });
  if(metricError)throw new Error(metricError.message);
}

async function verifyObservedRiotIdentity(riotAccountId:string|null,snapshot:LiveTelemetrySnapshot){
  const db=getSupabaseAdmin();
  if(!db||!riotAccountId||!snapshot.active.riotId)return;
  const {data:account,error}=await db.from('riot_accounts').select('game_name,tagline').eq('id',riotAccountId).maybeSingle();
  if(error||!account)return;
  const expected=`${account.game_name}#${String(account.tagline||'').replace(/^#/,'')}`.toLowerCase();
  const observed=snapshot.active.riotId.trim();
  const verified=expected===observed.toLowerCase();
  const now=new Date().toISOString();
  await db.from('riot_accounts').update({
    observed_riot_id:observed,verification_status:verified?'LIVE_VERIFIED':'LIVE_MISMATCH',
    verified_at:verified?now:null,sync_status:verified?'live_verified':'identity_mismatch',updated_at:now,
  }).eq('id',riotAccountId);
}

function findMe(snapshot:LiveTelemetrySnapshot):LiveTelemetryPlayer|null{
  const riotId=snapshot.active.riotId;
  const summoner=snapshot.active.summonerName;
  return snapshot.players.find(player=>Boolean(riotId&&player.riotId===riotId))
    ??snapshot.players.find(player=>Boolean(summoner&&player.summonerName===summoner))
    ??snapshot.players.find(player=>player.championName===snapshot.active.championName&&player.team===snapshot.active.team)
    ??null;
}

function inferResult(snapshots:LiveTelemetrySnapshot[]){
  for(let i=snapshots.length-1;i>=0;i--){
    for(let j=snapshots[i].events.length-1;j>=0;j--){
      const event=snapshots[i].events[j];
      if(event.name.toLowerCase()!=='gameend')continue;
      const value=String(event.raw.Result??event.raw.result??'').toLowerCase();
      if(value.includes('win'))return 'WIN';
      if(value.includes('lose')||value.includes('loss'))return 'LOSS';
    }
  }
  return 'UNKNOWN';
}

export function hashTrackerToken(token:string){
  return createHash('sha256').update(token).digest('hex');
}
