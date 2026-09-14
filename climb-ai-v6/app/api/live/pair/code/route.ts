import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {createDesktopPairCode} from '@/lib/server/liveTrackerPairingRepository';
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
const schema=z.object({
  accountId:z.string().min(1).max(128),
  deviceName:z.string().trim().min(1).max(80).default('My Windows PC'),
  riotProfile:riotProfileSchema,
});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'live-pair-code'),8,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many pairing attempts. Try again shortly.'},{status:429});
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:false,error:'Sign in before pairing a PC.'},{status:401});
  let input:z.infer<typeof schema>;
  try{input=schema.parse(await req.json())}
  catch{return NextResponse.json({ok:false,error:'Complete your Riot profile and choose a device name.'},{status:400})}
  try{
    const result=await createDesktopPairCode(user.id,input.accountId,input.deviceName,input.riotProfile);
    return NextResponse.json({ok:true,code:result.code,expiresAt:result.expiresAt});
  }catch(err){
    console.error('[live-pair-code] create failed',err);
    return NextResponse.json({ok:false,error:'Could not create a secure pairing code.'},{status:503});
  }
}
