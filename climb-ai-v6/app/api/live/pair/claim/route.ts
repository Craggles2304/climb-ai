import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {claimDesktopPairCode} from '@/lib/server/liveTrackerPairingRepository';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({code:z.string().trim().min(12).max(20)});

export async function POST(req:NextRequest){
  const limit=rateLimit(clientKey(req,'live-pair-claim'),20,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many pairing attempts. Try again shortly.'},{status:429});
  let input:z.infer<typeof schema>;
  try{input=schema.parse(await req.json())}
  catch{return NextResponse.json({ok:false,error:'Enter the pairing code shown on OP CLIMB.'},{status:400})}
  try{
    const result=await claimDesktopPairCode(input.code);
    if(!result)return NextResponse.json({ok:false,error:'That pairing code is invalid, expired, or already used.'},{status:400});
    return NextResponse.json({ok:true,token:result.token,device:result.device});
  }catch(err){
    console.error('[live-pair-claim] failed',err);
    return NextResponse.json({ok:false,error:'Pairing is temporarily unavailable.'},{status:503});
  }
}
