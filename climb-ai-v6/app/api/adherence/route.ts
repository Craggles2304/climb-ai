import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {saveAdherence} from '@/lib/server/telemetryRepository';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Behaviour adherence ingest.
 *
 * The single most valuable row in the whole database: it records whether the
 * player actually attempted the behaviour, next to whether the metric cleared.
 * Everything about separating cause from symptom depends on having both.
 */

const schema=z.object({
  anonId:z.string().min(8).max(64),
  sessionId:z.string().min(8).max(64),
  matchId:z.string().min(1).max(64),
  taskId:z.string().max(64).optional(),
  adherence:z.enum(['YES','PARTLY','NO']),
  clearedBar:z.boolean(),
  outcome:z.enum(['CONFIRMED','UNREWARDED','UNEARNED','NO_REP']),
});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'adherence'),30,60_000);
  if(!limit.ok){
    return NextResponse.json({ok:false,error:'Too many submissions.'},{status:429});
  }

  let input:z.infer<typeof schema>;
  try{
    input=schema.parse(await req.json());
  }catch{
    return NextResponse.json({ok:false,error:'Malformed adherence report.'},{status:400});
  }

  try{
    const result=await saveAdherence(input.anonId,input.sessionId,input);
    return NextResponse.json({ok:true,...result});
  }catch(err){
    console.error('[adherence] write failed',err);
    return NextResponse.json({ok:false,error:'Store unavailable.'},{status:503});
  }
}
