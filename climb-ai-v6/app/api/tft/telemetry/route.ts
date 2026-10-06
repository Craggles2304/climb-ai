import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/supabase/server';
import {latestTftTelemetryForUser} from '@/lib/server/tftTelemetryRepository';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({ok:false,error:'Sign in to view TFT telemetry.'},{status:401});
  const accountId=req.nextUrl.searchParams.get('accountId')?.trim()||null;
  try{
    const latest=await latestTftTelemetryForUser(user.id,accountId);
    return NextResponse.json({ok:true,latest});
  }catch(error){
    console.error('[tft-telemetry] read failed',error);
    return NextResponse.json({ok:false,error:'Could not load TFT telemetry.'},{status:503});
  }
}
