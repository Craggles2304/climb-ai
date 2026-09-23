import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticateTrackerToken,recordLiveReadCheckpoint} from '@/lib/server/liveTrackerRepository';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  checkpointMinute:z.union([z.literal(5),z.literal(10),z.literal(15)]),
  gameSeconds:z.number().finite().min(0).max(60*120),
  stateRead:z.enum(['AHEAD','EVEN','BEHIND']),
  confidenceRead:z.enum(['HIGH','MEDIUM','LOW']).nullable().optional(),
  threatRead:z.string().trim().max(80).nullable().optional(),
  priorityRead:z.string().trim().max(80).nullable().optional(),
});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'live-read-checkpoint'),12,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many checkpoint submissions.'},{status:429,headers:{'Retry-After':String(limit.retryAfterSeconds)}});
  const auth=req.headers.get('authorization')??'';
  const token=/^Bearer\s+(.+)$/i.exec(auth.trim())?.[1]?.trim();
  if(!token)return NextResponse.json({ok:false,error:'Tracker token required.'},{status:401});
  const device=await authenticateTrackerToken(token);
  if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});
  try{
    const input=schema.parse(await req.json());
    const saved=await recordLiveReadCheckpoint(device,input);
    if(!saved)return NextResponse.json({ok:false,error:'No active match session was found for this checkpoint.'},{status:409});
    return NextResponse.json({ok:true,checkpoint:saved});
  }catch(error){
    console.error('[live-read-checkpoint]',error);
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Checkpoint could not be saved.'},{status:400});
  }
}
