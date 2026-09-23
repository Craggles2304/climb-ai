import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';
import {saveEvents} from '@/lib/server/telemetryRepository';
import {getServerClient} from '@/lib/supabase/server';
import {RELEASE_MANIFEST} from '@/lib/releaseManifest';

export const runtime='nodejs';
export const dynamic='force-dynamic';

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
  const limit=rateLimit(clientKey(req,'events'),60,60_000);
  if(!limit.ok){
    return NextResponse.json({ok:false,error:'Too many events.'},{status:429});
  }

  let input:z.infer<typeof schema>;
  try{
    input=schema.parse(await req.json());
  }catch{
    return NextResponse.json({ok:false,error:'Malformed event batch.'},{status:400});
  }

  try{
    // Attach the verified Supabase user when one exists. The browser never gets
    // to choose a user id, and signed-out funnel events still retain anon_id.
    const supabase=await getServerClient();
    const {data:userData}=supabase?await supabase.auth.getUser():{data:{user:null}} as any;
    const release={buildCommit:(process.env.VERCEL_GIT_COMMIT_SHA||'local').slice(0,12),webVersion:RELEASE_MANIFEST.webVersion,environment:process.env.VERCEL_ENV||process.env.NODE_ENV||'local'};
    const events=input.events.map(event=>({...event,props:{...event.props,...release}}));
    const result=await saveEvents(input.anonId,input.sessionId,events,userData.user?.id);
    return NextResponse.json({ok:true,...result});
  }catch(err){
    console.error('[analytics] write failed',err);
    return NextResponse.json({ok:false,error:'Event store unavailable.'},{status:503});
  }
}
