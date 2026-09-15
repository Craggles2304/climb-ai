import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {saveEvents} from '@/lib/server/telemetryRepository';
import {getCurrentUser} from '@/lib/supabase/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  anonId:z.string().min(8).max(64),
  sessionId:z.string().min(8).max(64),
  matchId:z.string().min(1).max(64),
  taskId:z.string().max(128).optional(),
  adherence:z.enum(['YES','PARTLY','NO']),
  clearedBar:z.boolean(),
  outcome:z.enum(['CONFIRMED','UNREWARDED','UNEARNED','NO_REP']),
});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'adherence'),30,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many submissions.'},{status:429});
  let input:z.infer<typeof schema>;
  try{input=schema.parse(await req.json())}catch{return NextResponse.json({ok:false,error:'Malformed adherence report.'},{status:400})}
  try{
    const user=await getCurrentUser();
    const result=await saveEvents(input.anonId,input.sessionId,[{
      event:'mission_adherence',
      occurredAt:new Date().toISOString(),
      props:{matchId:input.matchId,taskId:input.taskId??null,adherence:input.adherence,clearedBar:input.clearedBar,outcome:input.outcome},
    }],user?.id);
    return NextResponse.json({ok:true,...result});
  }catch(err){
    console.error('[adherence] analytics write failed',err);
    return NextResponse.json({ok:true,persisted:false,count:0,reason:'Mission state is stored in the ILP; analytics was unavailable.'});
  }
}
