import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {saveEvents} from '@/lib/server/telemetryRepository';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/**
 * Analytics ingest.
 *
 * Two rules that matter more than throughput:
 *  1. This route must never break a page. Every failure path returns 200-with-a
 *     -reason or a soft error the client ignores; the client already keeps its
 *     buffer, so a rejected batch is retried rather than lost.
 *  2. `props` is closed to a small, typed shape. An open bag from the browser is
 *     how PII ends up in an analytics table by accident.
 */

const propValue=z.union([z.string().max(200),z.number(),z.boolean(),z.null()]);

const schema=z.object({
  anonId:z.string().min(8).max(64),
  sessionId:z.string().min(8).max(64),
  events:z.array(z.object({
    event:z.string().min(1).max(64),
    props:z.record(z.string().max(40),propValue).default({}),
    occurredAt:z.string().datetime(),
  })).min(1).max(50),
});

export async function POST(req:NextRequest){
  // Generous: a normal session sends a handful of batches, a loop sends hundreds.
  const limit=rateLimit(clientKey(req,'events'),60,60_000);
  if(!limit.ok){
    return NextResponse.json({ok:false,error:'Too many events.'},{status:429});
  }

  let input:z.infer<typeof schema>;
  try{
    input=schema.parse(await req.json());
  }catch{
    // Do not retry a malformed batch — 400 tells the client to drop it.
    return NextResponse.json({ok:false,error:'Malformed event batch.'},{status:400});
  }

  try{
    const result=await saveEvents(input.anonId,input.sessionId,input.events);
    return NextResponse.json({ok:true,...result});
  }catch(err){
    console.error('[analytics] write failed',err);
    // 503 so the client keeps the batch and tries again.
    return NextResponse.json({ok:false,error:'Event store unavailable.'},{status:503});
  }
}
