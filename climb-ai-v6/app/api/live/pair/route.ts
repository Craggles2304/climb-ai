import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {createTrackerDevice,listTrackerDevices,revokeTrackerDevice} from '@/lib/server/liveTrackerRepository';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const createSchema=z.object({
  accountId:z.string().min(1).max(128),
  deviceName:z.string().trim().min(1).max(80).default('Windows PC'),
});
const revokeSchema=z.object({deviceId:z.string().uuid()});

export async function GET(req:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:false,error:'Sign in to manage your live tracker.'},{status:401});
  try{
    const devices=await listTrackerDevices(user.id);
    return NextResponse.json({ok:true,devices});
  }catch(err){
    console.error('[live-pair] list failed',err);
    return NextResponse.json({ok:false,error:'Could not load paired devices.'},{status:503});
  }
}

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'live-pair'),10,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many pairing requests.'},{status:429});
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:false,error:'Sign in before pairing a PC.'},{status:401});
  let input:z.infer<typeof createSchema>;
  try{input=createSchema.parse(await req.json())}
  catch{return NextResponse.json({ok:false,error:'Choose an account and device name.'},{status:400})}
  try{
    const result=await createTrackerDevice(user.id,input.accountId,input.deviceName);
    return NextResponse.json({
      ok:true,
      token:result.token,
      device:result.device,
      warning:'This token is shown once. Store it on the paired PC and do not share it.',
    });
  }catch(err){
    console.error('[live-pair] create failed',err);
    return NextResponse.json({ok:false,error:'Secure tracker pairing is unavailable until Supabase is configured and migration 007 is applied.'},{status:503});
  }
}

export async function DELETE(req:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:false,error:'Sign in to revoke a tracker.'},{status:401});
  let input:z.infer<typeof revokeSchema>;
  try{input=revokeSchema.parse(await req.json())}
  catch{return NextResponse.json({ok:false,error:'Invalid device.'},{status:400})}
  try{
    await revokeTrackerDevice(user.id,input.deviceId);
    return NextResponse.json({ok:true});
  }catch(err){
    console.error('[live-pair] revoke failed',err);
    return NextResponse.json({ok:false,error:'Could not revoke this device.'},{status:503});
  }
}
