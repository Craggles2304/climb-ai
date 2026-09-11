import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {createTrackerDevice,listTrackerDevices,revokeTrackerDevice} from '@/lib/server/liveTrackerRepository';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const riotProfileSchema=z.object({
  gameName:z.string().trim().min(1).max(64),
  tagline:z.string().trim().min(1).max(16),
  region:z.string().trim().min(2).max(12),
  role:z.string().trim().max(24).optional(),
  rank:z.string().trim().max(40).optional(),
  champions:z.array(z.string().trim().min(1).max(80)).max(5).optional(),
  frustration:z.string().trim().max(180).optional(),
});
const createSchema=z.object({
  accountId:z.string().min(1).max(128),
  deviceName:z.string().trim().min(1).max(80).default('Windows PC'),
  riotProfile:riotProfileSchema,
});
const revokeSchema=z.object({deviceId:z.string().uuid()});

export async function GET(){
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
  catch{return NextResponse.json({ok:false,error:'Complete your Riot profile and choose a device name.'},{status:400})}
  try{
    const result=await createTrackerDevice(user.id,input.accountId,input.deviceName,input.riotProfile);
    return NextResponse.json({
      ok:true,
      token:result.token,
      device:result.device,
      riotAccount:result.riotAccount,
      warning:'This token is shown once. Store it on the paired PC and do not share it.',
    });
  }catch(err){
    console.error('[live-pair] create failed',err);
    return NextResponse.json({ok:false,error:'Secure tracker pairing is unavailable.'},{status:503});
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
