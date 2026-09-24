import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticateTrackerToken} from '@/lib/server/liveTrackerRepository';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {getCurrentUser} from '@/lib/supabase/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const heartbeatSchema=z.object({
  state:z.enum(['WAITING','CHAMP_SELECT','RECORDING','LCU_UNAVAILABLE','ERROR']),
  runtimeVersion:z.string().max(40),
  lcuDetected:z.boolean(),
  champSelectDetected:z.boolean(),
  detail:z.string().max(220).nullable().optional(),
});

export async function POST(req:NextRequest){
  const token=bearerToken(req);
  if(!token)return NextResponse.json({ok:false,error:'Tracker token required.'},{status:401});
  const device=await authenticateTrackerToken(token);
  if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});
  let input:z.infer<typeof heartbeatSchema>;
  try{input=heartbeatSchema.parse(await req.json())}
  catch{return NextResponse.json({ok:false,error:'Invalid tracker heartbeat.'},{status:400})}
  const db=getSupabaseAdmin();
  if(!db)return NextResponse.json({ok:false,error:'Tracker status storage unavailable.'},{status:503});
  const now=new Date().toISOString();
  const {error}=await db.from('live_tracker_devices').update({tracker_status:input,tracker_status_updated_at:now,last_seen_at:now}).eq('id',device.id);
  if(error){console.error('[live-status] write failed',error);return NextResponse.json({ok:false,error:'Could not store tracker status.'},{status:503})}
  return NextResponse.json({ok:true,acceptedAt:now});
}

export async function GET(req:NextRequest){
  const db=getSupabaseAdmin();
  if(!db)return NextResponse.json({ok:false,error:'Tracker status storage unavailable.'},{status:503});

  const token=bearerToken(req);
  if(token){
    const device=await authenticateTrackerToken(token);
    if(!device)return NextResponse.json({ok:false,error:'Tracker token is invalid or revoked.'},{status:401});
    const {data,error}=await db.from('live_tracker_devices')
      .select('id,device_name,last_seen_at,tracker_status,tracker_status_updated_at')
      .eq('id',device.id)
      .is('revoked_at',null)
      .maybeSingle();
    if(error){console.error('[live-status] tracker read failed',error);return NextResponse.json({ok:false,error:'Could not load tracker status.'},{status:503})}
    return NextResponse.json({ok:true,status:data??null});
  }

  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:false,error:'Sign in to view tracker status.'},{status:401});
  const accountId=req.nextUrl.searchParams.get('accountId')?.trim();
  if(!accountId)return NextResponse.json({ok:false,error:'accountId is required.'},{status:400});
  const {data,error}=await db.from('live_tracker_devices').select('id,device_name,last_seen_at,tracker_status,tracker_status_updated_at').eq('user_id',user.id).eq('account_key',accountId).is('revoked_at',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error){console.error('[live-status] read failed',error);return NextResponse.json({ok:false,error:'Could not load tracker status.'},{status:503})}
  return NextResponse.json({ok:true,status:data??null});
}

function bearerToken(req:NextRequest){
  const value=req.headers.get('authorization')??'';
  const match=/^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim()||null;
}
