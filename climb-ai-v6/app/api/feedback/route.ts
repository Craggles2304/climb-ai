import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {saveFeedback} from '@/lib/server/telemetryRepository';
import {FEEDBACK_REASONS,FEEDBACK_SURFACES} from '@/lib/feedback';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Feedback ingest — "was this useful?" on a specific claim.
 *
 * `surface` and `subject` are the whole point. Knowing that 40% of people said
 * a diagnosis was wrong is noise; knowing that the post-15 farm diagnosis is
 * rejected by junglers specifically is a fix.
 */

const schema=z.object({
  anonId:z.string().min(8).max(64),
  sessionId:z.string().min(8).max(64),
  useful:z.boolean(),
  surface:z.enum(FEEDBACK_SURFACES),
  subject:z.string().max(120).optional(),
  reason:z.enum(FEEDBACK_REASONS).optional(),
  // Free text is the one field a person could put anything in, so it is capped
  // and never echoed back anywhere.
  details:z.string().max(500).optional(),
  rankBand:z.string().max(40).optional(),
  role:z.string().max(20).optional(),
});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'feedback'),20,60_000);
  if(!limit.ok){
    return NextResponse.json({ok:false,error:'Too many submissions.'},{status:429});
  }

  let input:z.infer<typeof schema>;
  try{
    input=schema.parse(await req.json());
  }catch{
    return NextResponse.json({ok:false,error:'Malformed feedback.'},{status:400});
  }

  try{
    const result=await saveFeedback(input.anonId,input.sessionId,{
      useful:input.useful,surface:input.surface,subject:input.subject,
      reason:input.reason,details:input.details,
      rankBand:input.rankBand,role:input.role,
    });
    return NextResponse.json({ok:true,...result});
  }catch(err){
    console.error('[feedback] write failed',err);
    return NextResponse.json({ok:false,error:'Feedback store unavailable.'},{status:503});
  }
}
