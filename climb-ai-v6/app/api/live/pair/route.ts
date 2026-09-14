import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {listTrackerDevices,revokeTrackerDevice} from '@/lib/server/liveTrackerRepository';

export const runtime='nodejs';
export const dynamic='force-dynamic';

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
