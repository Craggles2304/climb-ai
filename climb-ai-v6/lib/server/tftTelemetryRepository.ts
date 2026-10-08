import 'server-only';
import {getSupabaseAdmin} from './supabaseAdmin';
import {analyzeTftTimeline,type TftTelemetryPoint,type TftTimeline} from '@/lib/tft/timeline';
import type {TrackerDevice} from './liveTrackerRepository';
import {riotEnabled} from '@/lib/riot/client';
import {riotService} from '@/lib/services/riotService';
import {getRecentTftMatchIds,getTftMatch,getTftRank} from '@/lib/tft/service';
import {saveTftMatches} from './tftRepository';

export type TftTelemetryEventKind='MATCH_START'|'ROUND_START'|'ROUND_END'|'MATCH_END'|'CHECKPOINT';
export interface TftRecorderPoint extends TftTelemetryPoint{
  clientPointId:string;
  eventKind:TftTelemetryEventKind;
  board?:unknown[];
  bench?:unknown[];
  shop?:unknown[];
}
export interface TftRecorderSessionInput{
  pseudoMatchId:string;
  startedAt?:string;
  metadata?:Record<string,unknown>;
}

function dbOrThrow(){
  const db=getSupabaseAdmin();
  if(!db)throw new Error('Supabase is not configured.');
  return db;
}

export async function startTftTelemetrySession(device:TrackerDevice,input:TftRecorderSessionInput){
  const db=dbOrThrow();
  const now=new Date().toISOString();
  const {data:existing,error:existingError}=await db.from('tft_telemetry_sessions')
    .select('id,pseudo_match_id,status,started_at,riot_account_id')
    .eq('device_id',device.id).eq('user_id',device.userId).eq('pseudo_match_id',input.pseudoMatchId).maybeSingle();
  if(existingError)throw new Error(existingError.message);
  if(existing)return existing;
  const payload={
    user_id:device.userId,
    riot_account_id:device.riotAccountId,
    device_id:device.id,
    pseudo_match_id:input.pseudoMatchId,
    status:'RECORDING',
    source:'OP_CLIMB_NATIVE',
    started_at:input.startedAt??now,
    last_seen_at:now,
    updated_at:now,
    metadata:{deviceName:device.deviceName,...(input.metadata??{})},
  };
  const {data,error}=await db.from('tft_telemetry_sessions')
    .upsert(payload,{onConflict:'device_id,pseudo_match_id'})
    .select('id,pseudo_match_id,status,started_at,riot_account_id')
    .single();
  if(error)throw new Error(error.message);
  return data;
}

export async function recordTftTelemetryPoint(device:TrackerDevice,pseudoMatchId:string,point:TftRecorderPoint){
  const db=dbOrThrow();
  const {data:session,error:sessionError}=await db.from('tft_telemetry_sessions')
    .select('id,status')
    .eq('device_id',device.id)
    .eq('user_id',device.userId)
    .eq('pseudo_match_id',pseudoMatchId)
    .maybeSingle();
  if(sessionError)throw new Error(sessionError.message);
  if(!session)throw new Error('TFT telemetry session is not active.');
  if(session.status!=='RECORDING')throw new Error('TFT telemetry session has already ended.');
  const row={
    session_id:session.id,
    client_point_id:point.clientPointId,
    observed_at:point.at,
    round:point.round,
    event_kind:point.eventKind,
    gold:point.gold??null,
    level:point.level??null,
    xp:point.xp??null,
    hp:point.hp??null,
    placement:point.placement??null,
    shop_refreshes:point.shopRefreshes??null,
    purchases:point.purchases??null,
    board_power:point.boardPower??null,
    board_units:point.boardUnits??null,
    bench_units:point.benchUnits??null,
    completed_items:point.completedItems??null,
    board:Array.isArray(point.board)?point.board:[],
    bench:Array.isArray(point.bench)?point.bench:[],
    shop:Array.isArray(point.shop)?point.shop:[],
  };
  const {error}=await db.from('tft_telemetry_points')
    .upsert(row,{onConflict:'session_id,client_point_id'});
  if(error)throw new Error(error.message);
  const {error:touchError}=await db.from('tft_telemetry_sessions')
    .update({last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()})
    .eq('id',session.id);
  if(touchError)throw new Error(touchError.message);
  return{sessionId:session.id};
}

async function readTimeline(sessionId:string,pseudoMatchId:string):Promise<TftTimeline>{
  const db=dbOrThrow();
  const {data,error}=await db.from('tft_telemetry_points')
    .select('observed_at,round,gold,level,xp,hp,placement,shop_refreshes,purchases,board_power,board_units,bench_units,completed_items')
    .eq('session_id',sessionId)
    .order('observed_at',{ascending:true});
  if(error)throw new Error(error.message);
  const points=(data??[]).map((row:any)=>({
    at:row.observed_at,
    round:String(row.round||'0-0'),
    gold:row.gold??undefined,
    level:row.level??undefined,
    xp:row.xp??undefined,
    hp:row.hp??undefined,
    placement:row.placement??undefined,
    shopRefreshes:row.shop_refreshes??undefined,
    purchases:row.purchases??undefined,
    boardPower:row.board_power??undefined,
    boardUnits:row.board_units??undefined,
    benchUnits:row.bench_units??undefined,
    completedItems:row.completed_items??undefined,
  }));
  return{version:1,source:'local-player',matchId:pseudoMatchId,points};
}

async function tryLinkRiotTftMatch(device:TrackerDevice,session:{id:string;started_at:string;ended_at:string|null}){
  if(!device.riotAccountId||!riotEnabled())return null;
  const db=dbOrThrow();
  const {data:account,error}=await db.from('riot_accounts')
    .select('id,puuid,game_name,tagline,region')
    .eq('id',device.riotAccountId)
    .eq('user_id',device.userId)
    .maybeSingle();
  if(error||!account)return null;
  try{
    let puuid=account.puuid as string|null;
    if(!puuid){
      const resolved=await riotService.getAccountByRiotId(account.game_name,account.tagline,account.region);
      puuid=resolved.puuid;
      await db.from('riot_accounts').update({puuid,updated_at:new Date().toISOString()}).eq('id',account.id);
    }
    const [ids,rank]=await Promise.all([
      getRecentTftMatchIds(puuid!,account.region,5),
      getTftRank(puuid!,account.region),
    ]);
    const settled=await Promise.allSettled(ids.map(id=>getTftMatch(id,account.region,puuid!,account.id)));
    const matches=settled.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
    await saveTftMatches(device.userId,account.id,matches,{puuid:puuid!,rank});

    const startMs=Date.parse(session.started_at);
    const lower=new Date(startMs-15*60_000).toISOString();
    const upper=new Date((Date.parse(session.ended_at||new Date().toISOString())||Date.now())+10*60_000).toISOString();
    const {data:candidates}=await db.from('tft_matches')
      .select('id,external_match_id,game_datetime,placement,level,last_round,comp_signature')
      .eq('user_id',device.userId)
      .eq('riot_account_id',account.id)
      .gte('game_datetime',lower)
      .lte('game_datetime',upper)
      .order('game_datetime',{ascending:false})
      .limit(5);
    if(!candidates?.length)return null;
    const closest=[...candidates].sort((a:any,b:any)=>
      Math.abs(Date.parse(a.game_datetime)-startMs)-Math.abs(Date.parse(b.game_datetime)-startMs)
    )[0];
    if(!closest)return null;
    await db.from('tft_telemetry_sessions')
      .update({linked_tft_match_id:closest.id,updated_at:new Date().toISOString()})
      .eq('id',session.id);
    return closest;
  }catch(error){
    console.warn('[tft-telemetry] Riot link deferred',error);
    return null;
  }
}

export async function completeTftTelemetrySession(device:TrackerDevice,pseudoMatchId:string,endedAt?:string){
  const db=dbOrThrow();
  const now=new Date().toISOString();
  const {data:session,error:sessionError}=await db.from('tft_telemetry_sessions')
    .select('id,pseudo_match_id,started_at,ended_at')
    .eq('device_id',device.id)
    .eq('user_id',device.userId)
    .eq('pseudo_match_id',pseudoMatchId)
    .maybeSingle();
  if(sessionError)throw new Error(sessionError.message);
  if(!session)throw new Error('TFT telemetry session was not found.');
  const timeline=await readTimeline(session.id,pseudoMatchId);
  const findings=analyzeTftTimeline(timeline);
  const summary={
    mode:'OP_CLIMB_NATIVE_WINDOW_OCR_V1',
    pointCount:timeline.points.length,
    quality:timeline.points.length?'RECORDED':'NO_EVIDENCE',
    observedFindings:findings.filter(f=>f.status==='OBSERVED').map(f=>f.key),
    completedAt:endedAt??now,
    evidenceBoundary:'Own-player visible HUD/shop evidence only during play; no opponent scouting and no live prescriptions. Full game-window frames are not stored or uploaded.',
  };
  const {error:updateError}=await db.from('tft_telemetry_sessions').update({
    status:timeline.points.length?'COMPLETE':'ABORTED',
    ended_at:endedAt??now,
    last_seen_at:now,
    findings,
    summary,
    updated_at:now,
  }).eq('id',session.id);
  if(updateError)throw new Error(updateError.message);
  const linked=timeline.points.length?await tryLinkRiotTftMatch(device,{...session,ended_at:endedAt??now}):null;
  return{sessionId:session.id,timeline,findings,linkedMatch:linked,pointCount:timeline.points.length,evidenceReady:timeline.points.length>0};
}

export async function latestTftTelemetryForUser(userId:string,riotAccountId?:string|null){
  const db=dbOrThrow();
  let query=db.from('tft_telemetry_sessions')
    .select('id,pseudo_match_id,status,started_at,ended_at,last_seen_at,summary,findings,linked_tft_match_id')
    .eq('user_id',userId)
    .in('status',['COMPLETE','ABORTED'])
    .order('started_at',{ascending:false})
    .limit(1);
  if(riotAccountId)query=query.eq('riot_account_id',riotAccountId);
  const {data:session,error}=await query.maybeSingle();
  if(error)throw new Error(error.message);
  if(!session)return null;
  const timeline=await readTimeline(session.id,session.pseudo_match_id);
  let linkedMatch=null;
  if(session.linked_tft_match_id){
    const {data}=await db.from('tft_matches')
      .select('id,external_match_id,game_datetime,placement,level,last_round,comp_signature,gold_left')
      .eq('id',session.linked_tft_match_id)
      .eq('user_id',userId)
      .maybeSingle();
    linkedMatch=data??null;
  }
  return{session,timeline,findings:Array.isArray(session.findings)?session.findings:analyzeTftTimeline(timeline),linkedMatch};
}
