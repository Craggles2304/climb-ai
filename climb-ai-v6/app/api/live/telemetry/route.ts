import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {authenticateTrackerToken,claimLiveTelemetryIngest,saveCompletedMatchBundle,saveLiveEnvelope} from '@/lib/server/liveTrackerRepository';
import {latestLiveRead} from '@/lib/server/liveReadRepository';
import {completeTftTelemetrySession,recordTftTelemetryPoint,startTftTelemetrySession} from '@/lib/server/tftTelemetryRepository';
import {recordCompletedClimbSessionGame} from '@/lib/server/playerLearningRepository';
import {tftEnvelopeSchema} from '@/lib/tft/ingestSchema';
export const runtime='nodejs';export const dynamic='force-dynamic';
const itemSchema=z.object({itemId:z.number().int().nonnegative(),displayName:z.string().max(120),count:z.number().int().positive().max(20),price:z.number().nonnegative()});const scoresSchema=z.object({kills:z.number().int().nonnegative(),deaths:z.number().int().nonnegative(),assists:z.number().int().nonnegative(),creepScore:z.number().int().nonnegative(),wardScore:z.number().nonnegative()});const playerSchema=z.object({summonerName:z.string().max(128),riotId:z.string().max(128).nullable(),championName:z.string().max(80),team:z.enum(['ORDER','CHAOS','UNKNOWN']),level:z.number().int().min(0).max(30),position:z.string().max(40).nullable(),isDead:z.boolean(),respawnTimer:z.number().nonnegative(),itemGold:z.number().nonnegative(),items:z.array(itemSchema).max(10),scores:scoresSchema});const nullableNumber=z.number().finite().nullable();const snapshotSchema=z.object({version:z.literal(1),gameTime:z.number().nonnegative(),gameMode:z.string().max(80).nullable(),mapName:z.string().max(120).nullable(),receivedAt:z.string().datetime(),active:z.object({summonerName:z.string().max(128),riotId:z.string().max(128).nullable(),championName:z.string().max(80),team:z.enum(['ORDER','CHAOS','UNKNOWN']),level:z.number().int().min(0).max(30),position:z.string().max(40).nullable(),currentGold:z.number().nonnegative(),stats:z.object({currentHealth:nullableNumber,maxHealth:nullableNumber,currentMana:nullableNumber,maxMana:nullableNumber,attackDamage:nullableNumber,attackSpeed:nullableNumber,abilityPower:nullableNumber,armor:nullableNumber,magicResist:nullableNumber,moveSpeed:nullableNumber})}),players:z.array(playerSchema).max(20),events:z.array(z.object({id:z.number().nullable(),name:z.string().max(120),time:z.number().nonnegative(),actor:z.string().max(128).nullable(),target:z.string().max(128).nullable(),raw:z.record(z.unknown())})).max(40)});const readCheckpointSchema=z.object({checkpointMinute:z.union([z.literal(5),z.literal(10),z.literal(15)]),gameSeconds:z.number().finite().min(0).max(60*120),stateRead:z.enum(['AHEAD','EVEN','BEHIND']),confidenceRead:z.enum(['HIGH','MEDIUM','LOW']).nullable().optional(),threatRead:z.string().trim().max(80).nullable().optional(),priorityRead:z.string().trim().max(80).nullable().optional()});
const markedMomentSchema=z.object({at:z.string().datetime(),clientSessionId:z.string().max(100).optional(),gameSeconds:z.number().finite().min(0).max(60*120),source:z.literal('PLAYER_HOTKEY')});
const envelopeSchema=z.object({type:z.enum(['SNAPSHOT','END','FINAL']),clientSessionId:z.string().min(8).max(100),startedAt:z.string().datetime().optional(),endedAt:z.string().datetime().optional(),snapshot:snapshotSchema.optional(),snapshots:z.array(snapshotSchema).min(1).max(12).optional(),readCheckpoints:z.array(readCheckpointSchema).max(3).optional(),markedMoments:z.array(markedMomentSchema).max(12).optional()}).superRefine((value,ctx)=>{if(value.type==='SNAPSHOT'&&!value.snapshot)ctx.addIssue({code:z.ZodIssueCode.custom,path:['snapshot'],message:'Snapshot required.'});if(value.type==='FINAL'&&!value.snapshots?.length)ctx.addIssue({code:z.ZodIssueCode.custom,path:['snapshots'],message:'Final keyframes required.'})});
export async function POST(req:NextRequest){
  const token=bearerToken(req);
  if(!token)return NextResponse.json({ok:false,error:'Tracker token required.'},{status:401});
  const rawBody=await req.json().catch(()=>null);
  const device=await authenticateTrackerToken(token);
  if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});

  if(rawBody&&typeof rawBody==='object'&&(rawBody as any).game==='TFT'){
    let tft:z.infer<typeof tftEnvelopeSchema>;
    try{tft=tftEnvelopeSchema.parse(rawBody)}catch(error){console.warn('[tft-telemetry] rejected invalid TFT payload',error);return NextResponse.json({ok:false,error:'Invalid TFT telemetry payload.'},{status:400})}
    try{
      if(tft.action==='START'){
        const session=await startTftTelemetrySession(device,{pseudoMatchId:tft.pseudoMatchId,startedAt:tft.startedAt,metadata:tft.metadata});
        return NextResponse.json({ok:true,mode:'TFT_POST_GAME_RECORDER_V1',session});
      }
      if(tft.action==='POINT'){
        const saved=await recordTftTelemetryPoint(device,tft.pseudoMatchId,tft.point);
        return NextResponse.json({ok:true,mode:'TFT_POST_GAME_RECORDER_V1',...saved},{status:202});
      }
      if(tft.point)await recordTftTelemetryPoint(device,tft.pseudoMatchId,tft.point);
      const result=await completeTftTelemetrySession(device,tft.pseudoMatchId,tft.endedAt);
      return NextResponse.json({ok:true,mode:'TFT_POST_GAME_RECORDER_V1',...result},{status:202});
    }catch(err){
      console.error('[tft-telemetry] write failed',err);
      return NextResponse.json({ok:false,error:'Could not store TFT telemetry.'},{status:503});
    }
  }

  let envelope:z.infer<typeof envelopeSchema>;
  try{envelope=envelopeSchema.parse(rawBody)}
  catch{return NextResponse.json({ok:false,error:'Invalid live telemetry payload.'},{status:400})}

  try{
    const gate=await claimLiveTelemetryIngest(device,envelope.clientSessionId,envelope.type==='SNAPSHOT');
    if(!gate.allowed)return NextResponse.json({ok:false,error:'Telemetry is arriving too quickly.',retryAfterSeconds:2},{status:429});
    if(envelope.type==='SNAPSHOT'&&!gate.sampleAccepted){
      return NextResponse.json({ok:true,sampled:true,acceptedAt:new Date().toISOString()});
    }
    if(envelope.type==='FINAL'){
      const saved=await saveCompletedMatchBundle(device,envelope);
      return NextResponse.json({ok:true,mode:'LOCAL_FIRST_QUEUE_V1',acceptedAt:new Date().toISOString(),...saved},{status:202});
    }

    const saved=await saveLiveEnvelope(device,envelope);
    if(envelope.type==='END'&&device.riotAccountId){
      const db=getSupabaseAdmin();
      if(db)await recordCompletedClimbSessionGame(db,{userId:device.userId,accountId:device.riotAccountId,telemetrySessionId:saved.sessionId})
        .catch(error=>console.warn('[climb-session] automatic game attachment failed',error));
    }
    return NextResponse.json({ok:true,acceptedAt:new Date().toISOString(),...saved});
  }catch(err){
    console.error('[live-telemetry] write failed',err);
    return NextResponse.json({ok:false,error:'Could not store live telemetry.'},{status:503});
  }
}
export async function GET(req:NextRequest){const user=await getCurrentUser();if(!user)return NextResponse.json({ok:false,error:'Sign in to view live tracker data.'},{status:401});const accountId=req.nextUrl.searchParams.get('accountId')?.trim();if(!accountId)return NextResponse.json({ok:false,error:'accountId is required.'},{status:400});try{const review=await latestLiveRead(user.id,accountId);return NextResponse.json({ok:true,review})}catch(err){console.error('[live-telemetry] read failed',err);return NextResponse.json({ok:false,error:'Could not load live tracker data.'},{status:503})}}
function bearerToken(req:NextRequest){const value=req.headers.get('authorization')??'';const match=/^Bearer\s+(.+)$/i.exec(value.trim());return match?.[1]?.trim()||null}
