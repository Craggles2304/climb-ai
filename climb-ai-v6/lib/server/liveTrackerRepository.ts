import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {getSupabaseAdmin} from './supabaseAdmin';
import {buildStrengthTimeline,type StrengthTimeline} from '@/lib/riot/liveStrength';
import {buildLiveProAnalysis,mergeProAnalyses,type ProMatchAnalysis} from '@/lib/riot/proAnalysis';
import type {LiveTelemetryPlayer,LiveTelemetrySnapshot} from '@/lib/riot/liveTelemetry';
import {riotService} from '@/lib/services/riotService';
import {riotEnabled} from '@/lib/riot/client';
import {persistProMatchAnalysis,getProMatchAnalysisBySession,rebuildProLearningProfile,rebuildProLearningProfileWithIlp,getProLearningProfile,type PostGameIlpSyncResult} from './proLearningRepository';
import {buildDecisionGraph,lockedPlanFromPregameContext,type LockedDecisionPlan} from '@/lib/decisionGraph';

export interface TrackerDevice{id:string;userId:string;accountKey:string;riotAccountId:string|null;deviceName:string}
export interface RiotProfileInput{gameName:string;tagline:string;region:string;role?:string;rank?:string;champions?:string[];frustration?:string}
export interface LiveEnvelope{type:'SNAPSHOT'|'END';clientSessionId:string;startedAt?:string;endedAt?:string;snapshot?:LiveTelemetrySnapshot}

export async function createTrackerDevice(userId:string,accountKey:string,deviceName:string,riotProfile:RiotProfileInput){
  const db=getSupabaseAdmin();if(!db)throw new Error('Supabase is required for secure tracker pairing.');
  const now=new Date().toISOString(),tagline=riotProfile.tagline.replace(/^#/,'').trim().toUpperCase(),region=riotProfile.region.trim().toUpperCase(),gameName=riotProfile.gameName.trim();
  const {error:profileError}=await db.from('profiles').upsert({id:userId,game_name:gameName,tagline,region,role:riotProfile.role?.toUpperCase()||null,rank:riotProfile.rank||null,champions:riotProfile.champions??[],frustration:riotProfile.frustration||null,updated_at:now},{onConflict:'id'});if(profileError)throw new Error(profileError.message);
  const {error:clearError}=await db.from('riot_accounts').update({is_primary:false,updated_at:now}).eq('user_id',userId).eq('is_primary',true);if(clearError)throw new Error(clearError.message);
  const {data:riotAccount,error:riotError}=await db.from('riot_accounts').upsert({user_id:userId,game_name:gameName,tagline,region,label:'PRIMARY',is_primary:true,sync_status:'paired',updated_at:now},{onConflict:'user_id,game_name,tagline,region'}).select('id,game_name,tagline,region,verification_status,observed_riot_id,verified_at').single();
  if(riotError||!riotAccount)throw new Error(riotError?.message||'Riot account could not be saved.');
  const token=`climb_live_${randomBytes(32).toString('base64url')}`;
  const {data,error}=await db.from('live_tracker_devices').insert({user_id:userId,account_key:accountKey,riot_account_id:riotAccount.id,device_name:deviceName,token_hash:hashTrackerToken(token)}).select('id,account_key,riot_account_id,device_name,created_at,last_seen_at').single();
  if(error)throw new Error(error.message);return{token,device:data,riotAccount};
}

export async function listTrackerDevices(userId:string){const db=getSupabaseAdmin();if(!db)return[];const {data,error}=await db.from('live_tracker_devices').select('id,account_key,riot_account_id,device_name,created_at,last_seen_at,revoked_at').eq('user_id',userId).is('revoked_at',null).order('created_at',{ascending:false});if(error)throw new Error(error.message);return data??[]}
export async function revokeTrackerDevice(userId:string,deviceId:string){const db=getSupabaseAdmin();if(!db)return false;const {error}=await db.from('live_tracker_devices').update({revoked_at:new Date().toISOString()}).eq('id',deviceId).eq('user_id',userId);if(error)throw new Error(error.message);return true}
export async function authenticateTrackerToken(token:string):Promise<TrackerDevice|null>{const db=getSupabaseAdmin();if(!db)return null;const {data,error}=await db.from('live_tracker_devices').select('id,user_id,account_key,riot_account_id,device_name,revoked_at').eq('token_hash',hashTrackerToken(token)).is('revoked_at',null).maybeSingle();if(error||!data)return null;await db.from('live_tracker_devices').update({last_seen_at:new Date().toISOString()}).eq('id',data.id);return{id:data.id,userId:data.user_id,accountKey:data.account_key,riotAccountId:data.riot_account_id??null,deviceName:data.device_name}}

export async function saveLiveEnvelope(device:TrackerDevice,envelope:LiveEnvelope){
  const db=getSupabaseAdmin();if(!db)throw new Error('Supabase is not configured.');const now=new Date().toISOString();
  const existing=await db.from('live_telemetry_sessions').select('id,started_at').eq('device_id',device.id).eq('client_session_id',envelope.clientSessionId).maybeSingle();if(existing.error)throw new Error(existing.error.message);
  let sessionId=existing.data?.id as string|undefined;
  if(!sessionId){const {data,error}=await db.from('live_telemetry_sessions').insert({user_id:device.userId,riot_account_id:device.riotAccountId,device_id:device.id,account_key:device.accountKey,client_session_id:envelope.clientSessionId,started_at:envelope.startedAt??now,last_seen_at:now,status:envelope.type==='END'?'COMPLETE':'ACTIVE',ended_at:envelope.type==='END'?(envelope.endedAt??now):null,metadata:{deviceName:device.deviceName}}).select('id').single();if(error)throw new Error(error.message);sessionId=data?.id as string|undefined}
  else{const patch:Record<string,unknown>={last_seen_at:now};if(envelope.type==='END'){patch.status='COMPLETE';patch.ended_at=envelope.endedAt??now}const {error}=await db.from('live_telemetry_sessions').update(patch).eq('id',sessionId);if(error)throw new Error(error.message)}
  if(!sessionId)throw new Error('Live session could not be created.');
  if(envelope.type==='SNAPSHOT'&&envelope.snapshot){const {error}=await db.from('live_telemetry_snapshots').insert({session_id:sessionId,game_time:envelope.snapshot.gameTime,payload:envelope.snapshot});if(error)throw new Error(error.message)}
  if(envelope.type==='END')await finalizeSession(sessionId);
  return{sessionId};
}

export async function latestLiveReview(userId:string,accountKey:string){
  const db=getSupabaseAdmin();if(!db)return null;
  const {data:session,error}=await db.from('live_telemetry_sessions').select('id,status,started_at,ended_at,last_seen_at,summary,metadata,riot_account_id').eq('user_id',userId).eq('account_key',accountKey).order('started_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw new Error(error.message);if(!session)return null;
  const {data:snapshots,error:snapshotError}=await db.from('live_telemetry_snapshots').select('game_time,payload').eq('session_id',session.id).order('game_time',{ascending:true});if(snapshotError)throw new Error(snapshotError.message);
  const normalized=(snapshots??[]).map(row=>row.payload as LiveTelemetrySnapshot);
  const strength=normalized.length?buildStrengthTimeline(normalized):((session.summary as any)?.points?(session.summary as StrengthTimeline):null);
  const lockedPlan=await linkedDecisionPlan(session.id);
  let proAnalysis:ProMatchAnalysis|null=await getProMatchAnalysisBySession(session.id).catch(()=>null);
  if(normalized.length&&strength&&!proAnalysis&&['COMPLETE','ABORTED'].includes(String(session.status))){
    const base=buildLiveProAnalysis(normalized,strength);
    proAnalysis={...base,decisionGraph:buildDecisionGraph({analysis:base,summary:strength,lockedPlan})};
    if(session.status==='COMPLETE'){
      const matchId=await findMatchIdForSession(session.id);
      const persisted=await persistProMatchAnalysis({userId,riotAccountId:session.riot_account_id??null,sessionId:session.id,matchId,externalMatchId:null,champion:proAnalysis.champion,role:proAnalysis.role,analysis:proAnalysis}).catch(err=>{console.warn('[pro-backfill] match analysis failed',err);return null});
      if(persisted)await syncLearningPlanForSession(session.id,userId,session.riot_account_id??null,'BACKFILL',proAnalysis);
    }
  }else if(proAnalysis&&strength&&!proAnalysis.decisionGraph){
    proAnalysis={...proAnalysis,decisionGraph:buildDecisionGraph({analysis:proAnalysis,summary:strength,lockedPlan})};
    if(session.status==='COMPLETE'){
      const matchId=await findMatchIdForSession(session.id);
      await persistProMatchAnalysis({userId,riotAccountId:session.riot_account_id??null,sessionId:session.id,matchId,externalMatchId:null,champion:proAnalysis.champion,role:proAnalysis.role,analysis:proAnalysis}).catch(err=>console.warn('[decision-graph] backfill persist failed',err));
    }
  }

  const enrichment=(session.summary as any)?.riotEnrichment;
  if(session.status==='COMPLETE'&&normalized.length&&strength&&riotEnabled()&&enrichment?.status!=='COMPLETE'&&enrichment?.status!=='NO_MATCH'){
    try{
      const enriched=await enrichLiveSessionFromRiot(session,normalized,strength,proAnalysis??buildLiveProAnalysis(normalized,strength));
      if(enriched)proAnalysis=enriched;
    }catch(err){console.warn('[riot-enrich] lazy enrichment failed',err)}
  }
  let learningPlanSync=(session.summary as any)?.learningPlanSync??null;
  if(session.status==='COMPLETE'&&proAnalysis&&session.riot_account_id&&learningPlanSync?.status!=='COMPLETE'){
    await syncLearningPlanForSession(session.id,userId,session.riot_account_id,'REVIEW_ENSURE',proAnalysis);
    learningPlanSync=await sessionLearningPlanStatus(session.id);
  }else if(!learningPlanSync){
    learningPlanSync=await sessionLearningPlanStatus(session.id);
  }
  const historyProfile=await getProLearningProfile(userId,session.riot_account_id??null).catch(()=>null);
  const decisionGraph=proAnalysis?.decisionGraph??(session.summary as any)?.decisionGraph??null;
  const finalSummary=strength?{...strength,proAnalysis,decisionGraph,riotEnrichment:(await sessionEnrichmentStatus(session.id))??enrichment,learningPlanSync}:session.summary;
  return{sessionId:session.id,status:session.status,startedAt:session.started_at,endedAt:session.ended_at,lastSeenAt:session.last_seen_at,snapshotCount:normalized.length,latestSnapshot:normalized[normalized.length-1]??null,summary:finalSummary,proAnalysis,historyProfile};
}

async function finalizeSession(sessionId:string){
  const db=getSupabaseAdmin();if(!db)return;
  const [{data:session,error:sessionError},{data,error}]=await Promise.all([
    db.from('live_telemetry_sessions').select('id,user_id,riot_account_id,account_key,started_at,ended_at').eq('id',sessionId).single(),
    db.from('live_telemetry_snapshots').select('payload').eq('session_id',sessionId).order('game_time',{ascending:true}),
  ]);
  if(sessionError)throw new Error(sessionError.message);if(error)throw new Error(error.message);
  const snapshots=(data??[]).map(row=>row.payload as LiveTelemetrySnapshot),summary=buildStrengthTimeline(snapshots);
  const lockedPlan=await linkedDecisionPlan(sessionId);
  const baseAnalysis=snapshots.length?buildLiveProAnalysis(snapshots,summary):null;
  const proAnalysis=baseAnalysis?{...baseAnalysis,decisionGraph:buildDecisionGraph({analysis:baseAnalysis,summary,lockedPlan})}:null;
  const storedSummary={...summary,proAnalysis,decisionGraph:proAnalysis?.decisionGraph??null,lockedPlanAvailable:Boolean(lockedPlan),riotEnrichment:{status:riotEnabled()?'PENDING':'DISABLED'}};
  const {error:updateError}=await db.from('live_telemetry_sessions').update({summary:storedSummary}).eq('id',sessionId);if(updateError)throw new Error(updateError.message);if(!snapshots.length)return;

  const reviewResult=await Promise.allSettled([persistReviewEvents(session,summary),persistLiveMatch(session,snapshots,summary,proAnalysis),verifyObservedRiotIdentity(session.riot_account_id,snapshots[snapshots.length-1])]);
  for(const result of reviewResult)if(result.status==='rejected')console.warn('[live-finalize] secondary persistence failed',result.reason);
  const matchResult=reviewResult[1];
  const matchId=matchResult.status==='fulfilled'?matchResult.value:null;
  if(proAnalysis){
    const persisted=await persistProMatchAnalysis({userId:session.user_id,riotAccountId:session.riot_account_id,sessionId:session.id,matchId,externalMatchId:null,champion:proAnalysis.champion,role:proAnalysis.role,analysis:proAnalysis}).catch(err=>{console.warn('[live-finalize] PRO analysis failed',err);return null});
    if(persisted)await syncLearningPlanForSession(session.id,session.user_id,session.riot_account_id,'FINALIZE',proAnalysis);
  }
}

async function persistReviewEvents(session:any,summary:StrengthTimeline){const db=getSupabaseAdmin();if(!db||!summary.opportunities.length)return;await db.from('live_review_events').delete().eq('session_id',session.id);const {error}=await db.from('live_review_events').insert(summary.opportunities.map(window=>({user_id:session.user_id,riot_account_id:session.riot_account_id,session_id:session.id,game_time:window.atSeconds,event_type:window.type,opponent:window.opponent,confidence:window.confidence,headline:window.headline,detail:window.detail,evidence:{...window.evidence,score:window.score,limitation:window.limitation}})));if(error)throw new Error(error.message)}

async function persistLiveMatch(session:any,snapshots:LiveTelemetrySnapshot[],summary:StrengthTimeline,proAnalysis:ProMatchAnalysis|null):Promise<string|null>{
  const db=getSupabaseAdmin();if(!db)return null;const final=snapshots[snapshots.length-1],me=findMe(final);if(!me)return null;
  const {data:existing,error:existingError}=await db.from('matches').select('id').eq('live_session_id',session.id).maybeSingle();if(existingError)throw new Error(existingError.message);
  let matchId=existing?.id as string|undefined;
  if(!matchId){const {data:match,error}=await db.from('matches').insert({user_id:session.user_id,riot_account_id:session.riot_account_id,live_session_id:session.id,external_match_id:null,champion:me.championName||final.active.championName||'Unknown',role:final.active.position||me.position||'UNKNOWN',result:inferResult(snapshots),kills:me.scores.kills,deaths:me.scores.deaths,assists:me.scores.assists,duration_seconds:Math.max(1,Math.round(final.gameTime)),rank:null,source:'LIVE_TRACKER',occurred_at:session.started_at||new Date().toISOString()}).select('id').single();if(error||!match)throw new Error(error?.message||'Live match could not be saved.');matchId=match.id}
  const minutes=Math.max(final.gameTime/60,1/60);
  const {error:metricError}=await db.from('match_metrics').upsert({match_id:matchId,user_id:session.user_id,cs:me.scores.creepScore,cs_per_min:Math.round((me.scores.creepScore/minutes)*100)/100,vision_score:me.scores.wardScore,raw:{source:'LIVE_TRACKER',currentGold:final.active.currentGold,summary,proAnalysis}},{onConflict:'match_id'});if(metricError)throw new Error(metricError.message);
  return matchId??null;
}

async function enrichLiveSessionFromRiot(session:any,snapshots:LiveTelemetrySnapshot[],strength:StrengthTimeline,livePro:ProMatchAnalysis):Promise<ProMatchAnalysis|null>{
  const db=getSupabaseAdmin();if(!db||!session.riot_account_id||!riotEnabled())return null;
  const {data:account,error}=await db.from('riot_accounts').select('id,game_name,tagline,region,puuid,rank_tier,rank_division,league_points').eq('id',session.riot_account_id).maybeSingle();
  if(error||!account)return null;
  let puuid=account.puuid as string|null;
  if(!puuid){const resolved=await riotService.getAccountByRiotId(account.game_name,account.tagline,account.region);puuid=resolved.puuid;await db.from('riot_accounts').update({puuid,updated_at:new Date().toISOString()}).eq('id',account.id)}
  if(!puuid)return null;
  const ids=await riotService.getRecentMatches(puuid,account.region,{count:3});
  const rank=account.rank_tier?`${account.rank_tier}${account.rank_division?` ${account.rank_division}`:''}`:undefined;
  let best:any=null,bestScore=-1;
  for(const id of ids){
    try{
      const detail=await riotService.getMatchDetails(id,account.region,{riotAccountId:account.id,puuid,rank});
      const score=matchCandidateScore(detail.match,session,snapshots);
      if(score>bestScore){best={id,detail};bestScore=score}
      if(score>=13)break;
    }catch(err){console.warn('[riot-enrich] candidate fetch failed',id,err)}
  }
  if(!best||bestScore<7){await markEnrichment(session.id,{status:'NO_MATCH',checkedAt:new Date().toISOString()});return null}
  const mapped=best.detail,mergedBase=mergeProAnalyses(livePro,mapped.proAnalysis);
  const merged:ProMatchAnalysis={...mergedBase,decisionGraph:livePro.decisionGraph??mergedBase.decisionGraph};
  const liveMatchId=await findMatchIdForSession(session.id);
  if(!liveMatchId)return null;
  const m=mapped.match;
  const {error:matchError}=await db.from('matches').update({external_match_id:m.id,champion:m.champion,role:m.role,result:m.result,kills:m.kills,deaths:m.deaths,assists:m.assists,duration_seconds:m.durationSeconds,rank:m.rank,source:'riot',occurred_at:m.createdAt}).eq('id',liveMatchId);if(matchError)throw new Error(matchError.message);
  const mm=m.metrics;
  const {error:metricError}=await db.from('match_metrics').upsert({
    match_id:liveMatchId,user_id:session.user_id,cs:mm.cs,cs_per_min:mm.csPerMin,gold_per_min:mm.goldPerMin??null,damage_per_min:mm.damagePerMin??null,kill_participation:mm.killParticipation??null,vision_score:mm.visionScore??null,farm_after_15:mm.post15CsPerMin??null,objective_participation:mm.objectiveParticipation??null,lane_cs_per_min:mm.laneCsPerMin??null,post15_cs_per_min:mm.post15CsPerMin??null,cs_at_10:mm.csAt10??null,cs_at_15:mm.csAt15??null,gold_diff_at_15:mm.goldDiffAt15??null,xp_diff_at_15:mm.xpDiffAt15??null,deaths_pre_10:mm.deathsPre10??null,deaths_10_to_20:mm.deaths10to20??null,deaths_post_20:mm.deathsPost20??null,solo_deaths:mm.soloDeaths??null,teamfight_deaths:mm.teamfightDeaths??null,first_item_minute:mm.firstItemMinute??null,second_item_minute:mm.secondItemMinute??null,third_item_minute:mm.thirdItemMinute??null,damage_share:mm.damageShare??null,unavailable_metrics:mapped.unavailable??[],raw:{source:'RIOT_ENRICHED',metrics:mm,proAnalysis:merged,moments:mapped.moments??[],unavailableMetrics:mapped.unavailable??[],liveSummary:strength}
  },{onConflict:'match_id'});if(metricError)throw new Error(metricError.message);
  await persistProMatchAnalysis({userId:session.user_id,riotAccountId:session.riot_account_id,sessionId:session.id,matchId:liveMatchId,externalMatchId:m.id,champion:m.champion,role:m.role,analysis:merged});
  await syncLearningPlanForSession(session.id,session.user_id,session.riot_account_id,'RIOT_ENRICHED',merged);
  await db.from('riot_accounts').update({puuid,last_synced_at:new Date().toISOString(),sync_status:'live_enriched',updated_at:new Date().toISOString()}).eq('id',account.id);
  await markEnrichment(session.id,{status:'COMPLETE',externalMatchId:m.id,score:bestScore,enrichedAt:new Date().toISOString()});
  return merged;
}

async function linkedDecisionPlan(sessionId:string):Promise<LockedDecisionPlan|null>{
  const db=getSupabaseAdmin();if(!db)return null;
  const {data,error}=await db.from('live_pregame_contexts').select('context').eq('linked_session_id',sessionId).order('started_at',{ascending:false}).limit(1).maybeSingle();
  if(error){console.warn('[decision-graph] linked pregame lookup failed',error.message);return null}
  return lockedPlanFromPregameContext(data?.context??null);
}

function matchCandidateScore(match:any,session:any,snapshots:LiveTelemetrySnapshot[]){const final=snapshots[snapshots.length-1],me=findMe(final);if(!me)return 0;let score=0;if(String(match.champion).toLowerCase()===String(me.championName).toLowerCase())score+=5;if(match.kills===me.scores.kills&&match.deaths===me.scores.deaths&&match.assists===me.scores.assists)score+=4;const durationDelta=Math.abs(Number(match.durationSeconds)-Number(final.gameTime));if(durationDelta<=120)score+=3;else if(durationDelta<=300)score+=1;const ended=session.ended_at?new Date(session.ended_at).getTime():Date.now(),occurred=match.createdAt?new Date(match.createdAt).getTime():0,delta=Math.abs(ended-occurred);if(delta<=5*60_000)score+=4;else if(delta<=15*60_000)score+=2;return score}
async function syncLearningPlanForSession(sessionId:string,userId:string,riotAccountId:string|null,trigger:string,analysis:ProMatchAnalysis|null):Promise<PostGameIlpSyncResult|null>{
  const signature=analysis?analysisSignature(analysis):'';
  const existing=await sessionLearningPlanStatus(sessionId);
  if(existing?.status==='COMPLETE'&&signature&&existing.analysisSignature===signature)return{...existing,reused:true} as PostGameIlpSyncResult;
  if(!riotAccountId){await markLearningPlanSync(sessionId,{status:'SKIPPED',reason:'NO_RIOT_ACCOUNT',trigger,analysisSignature:signature,syncedAt:new Date().toISOString()});return null}
  try{
    const rebuilt=await rebuildProLearningProfileWithIlp(userId,riotAccountId);
    if(!rebuilt){await markLearningPlanSync(sessionId,{status:'SKIPPED',reason:'NO_PROFILE',trigger,analysisSignature:signature,syncedAt:new Date().toISOString()});return null}
    const result={...rebuilt.ilp,trigger,analysisSignature:signature};
    await markLearningPlanSync(sessionId,result);
    return rebuilt.ilp;
  }catch(err){
    console.warn('[post-game-ilp] closed-loop sync failed',err);
    await markLearningPlanSync(sessionId,{status:'FAILED',trigger,analysisSignature:signature,syncedAt:new Date().toISOString(),error:err instanceof Error?err.message:'Unknown post-game ILP sync failure.'}).catch(()=>{});
    return null;
  }
}
function analysisSignature(analysis:ProMatchAnalysis){return createHash('sha256').update(JSON.stringify(analysis)).digest('hex').slice(0,24)}
async function markLearningPlanSync(sessionId:string,learningPlanSync:any){const db=getSupabaseAdmin();if(!db)return;const {data,error}=await db.from('live_telemetry_sessions').select('summary').eq('id',sessionId).maybeSingle();if(error)throw new Error(error.message);const {error:updateError}=await db.from('live_telemetry_sessions').update({summary:{...((data?.summary as any)||{}),learningPlanSync}}).eq('id',sessionId);if(updateError)throw new Error(updateError.message)}
async function sessionLearningPlanStatus(sessionId:string){const db=getSupabaseAdmin();if(!db)return null;const {data}=await db.from('live_telemetry_sessions').select('summary').eq('id',sessionId).maybeSingle();return(data?.summary as any)?.learningPlanSync??null}
async function markEnrichment(sessionId:string,enrichment:any){const db=getSupabaseAdmin();if(!db)return;const {data}=await db.from('live_telemetry_sessions').select('summary').eq('id',sessionId).maybeSingle();await db.from('live_telemetry_sessions').update({summary:{...((data?.summary as any)||{}),riotEnrichment:enrichment}}).eq('id',sessionId)}
async function sessionEnrichmentStatus(sessionId:string){const db=getSupabaseAdmin();if(!db)return null;const {data}=await db.from('live_telemetry_sessions').select('summary').eq('id',sessionId).maybeSingle();return(data?.summary as any)?.riotEnrichment??null}
async function findMatchIdForSession(sessionId:string){const db=getSupabaseAdmin();if(!db)return null;const {data}=await db.from('matches').select('id').eq('live_session_id',sessionId).maybeSingle();return(data?.id as string|undefined)??null}

async function verifyObservedRiotIdentity(riotAccountId:string|null,snapshot:LiveTelemetrySnapshot){const db=getSupabaseAdmin();if(!db||!riotAccountId||!snapshot.active.riotId)return;const {data:account,error}=await db.from('riot_accounts').select('game_name,tagline').eq('id',riotAccountId).maybeSingle();if(error||!account)return;const expected=`${account.game_name}#${String(account.tagline||'').replace(/^#/,'')}`.toLowerCase(),observed=snapshot.active.riotId.trim(),verified=expected===observed.toLowerCase(),now=new Date().toISOString();await db.from('riot_accounts').update({observed_riot_id:observed,verification_status:verified?'LIVE_VERIFIED':'LIVE_MISMATCH',verified_at:verified?now:null,sync_status:verified?'live_verified':'identity_mismatch',updated_at:now}).eq('id',riotAccountId)}
function findMe(snapshot:LiveTelemetrySnapshot):LiveTelemetryPlayer|null{const riotId=snapshot.active.riotId,summoner=snapshot.active.summonerName;return snapshot.players.find(player=>Boolean(riotId&&player.riotId===riotId))??snapshot.players.find(player=>Boolean(summoner&&player.summonerName===summoner))??snapshot.players.find(player=>player.championName===snapshot.active.championName&&player.team===snapshot.active.team)??null}
function inferResult(snapshots:LiveTelemetrySnapshot[]){for(let i=snapshots.length-1;i>=0;i--)for(let j=snapshots[i].events.length-1;j>=0;j--){const event=snapshots[i].events[j];if(event.name.toLowerCase()!=='gameend')continue;const value=String(event.raw.Result??event.raw.result??'').toLowerCase();if(value.includes('win'))return'WIN';if(value.includes('lose')||value.includes('loss'))return'LOSS'}return'UNKNOWN'}
export function hashTrackerToken(token:string){return createHash('sha256').update(token).digest('hex')}
