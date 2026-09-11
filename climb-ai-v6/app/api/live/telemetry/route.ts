import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {
  authenticateTrackerToken,latestLiveReview,saveLiveEnvelope,
} from '@/lib/server/liveTrackerRepository';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const itemSchema=z.object({
  itemId:z.number().int().nonnegative(),displayName:z.string().max(120),
  count:z.number().int().positive().max(20),price:z.number().nonnegative(),
});
const scoresSchema=z.object({
  kills:z.number().int().nonnegative(),deaths:z.number().int().nonnegative(),
  assists:z.number().int().nonnegative(),creepScore:z.number().int().nonnegative(),
  wardScore:z.number().nonnegative(),
});
const playerSchema=z.object({
  summonerName:z.string().max(128),riotId:z.string().max(128).nullable(),
  championName:z.string().max(80),team:z.enum(['ORDER','CHAOS','UNKNOWN']),
  level:z.number().int().min(0).max(30),position:z.string().max(40).nullable(),
  isDead:z.boolean(),respawnTimer:z.number().nonnegative(),itemGold:z.number().nonnegative(),
  items:z.array(itemSchema).max(10),scores:scoresSchema,
});
const nullableNumber=z.number().finite().nullable();
const snapshotSchema=z.object({
  version:z.literal(1),gameTime:z.number().nonnegative(),
  gameMode:z.string().max(80).nullable(),mapName:z.string().max(120).nullable(),
  receivedAt:z.string().datetime(),
  active:z.object({
    summonerName:z.string().max(128),riotId:z.string().max(128).nullable(),
    championName:z.string().max(80),team:z.enum(['ORDER','CHAOS','UNKNOWN']),
    level:z.number().int().min(0).max(30),position:z.string().max(40).nullable(),
    currentGold:z.number().nonnegative(),
    stats:z.object({
      currentHealth:nullableNumber,maxHealth:nullableNumber,currentMana:nullableNumber,maxMana:nullableNumber,
      attackDamage:nullableNumber,attackSpeed:nullableNumber,abilityPower:nullableNumber,
      armor:nullableNumber,magicResist:nullableNumber,moveSpeed:nullableNumber,
    }),
  }),
  players:z.array(playerSchema).max(20),
  events:z.array(z.object({
    id:z.number().nullable(),name:z.string().max(120),time:z.number().nonnegative(),
    actor:z.string().max(128).nullable(),target:z.string().max(128).nullable(),
    raw:z.record(z.unknown()),
  })).max(40),
});
const envelopeSchema=z.object({
  type:z.enum(['SNAPSHOT','END']),clientSessionId:z.string().min(8).max(100),
  startedAt:z.string().datetime().optional(),endedAt:z.string().datetime().optional(),
  snapshot:snapshotSchema.optional(),
}).superRefine((value,ctx)=>{
  if(value.type==='SNAPSHOT'&&!value.snapshot)
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['snapshot'],message:'Snapshot required.'});
});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'live-telemetry'),30,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Telemetry is arriving too quickly.'},{status:429});
  const token=bearerToken(req);
  if(!token)return NextResponse.json({ok:false,error:'Tracker token required.'},{status:401});
  const device=await authenticateTrackerToken(token);
  if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});
  let envelope:z.infer<typeof envelopeSchema>;
  try{envelope=envelopeSchema.parse(await req.json())}
  catch{return NextResponse.json({ok:false,error:'Invalid live telemetry payload.'},{status:400})}
  try{
    const saved=await saveLiveEnvelope(device,envelope);
    return NextResponse.json({ok:true,acceptedAt:new Date().toISOString(),...saved});
  }catch(err){
    console.error('[live-telemetry] write failed',err);
    return NextResponse.json({ok:false,error:'Could not store live telemetry.'},{status:503});
  }
}

export async function GET(req:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:false,error:'Sign in to view live tracker data.'},{status:401});
  const accountId=req.nextUrl.searchParams.get('accountId')?.trim();
  if(!accountId)return NextResponse.json({ok:false,error:'accountId is required.'},{status:400});
  try{
    const review=await latestLiveReview(user.id,accountId);
    return NextResponse.json({ok:true,review});
  }catch(err){
    console.error('[live-telemetry] read failed',err);
    return NextResponse.json({ok:false,error:'Could not load live tracker data.'},{status:503});
  }
}

function bearerToken(req:NextRequest){
  const value=req.headers.get('authorization')??'';
  const match=/^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim()||null;
}
