import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/supabase/server';
import {authenticateTrackerToken} from '@/lib/server/liveTrackerRepository';
import {loadTftDevelopment} from '@/lib/server/tftDevelopmentRepository';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){
  const authorization=req.headers.get('authorization');
  let userId:string,accountId:string|null;
  if(authorization){
    const token=/^Bearer\s+(.+)$/i.exec(authorization.trim())?.[1]?.trim();
    const device=token?await authenticateTrackerToken(token):null;
    if(!device)return NextResponse.json({ok:false,error:'Companion pairing is invalid or revoked.'},{status:401,headers});
    userId=device.userId;accountId=device.riotAccountId;
    const requested=req.nextUrl.searchParams.get('accountId');
    if(requested&&requested!==accountId)return NextResponse.json({ok:false,error:'The Companion is paired to a different account.'},{status:403,headers});
  }else{
    const user=await getCurrentUser();
    if(!user)return NextResponse.json({ok:false,error:'Sign in to load your TFT mission.'},{status:401,headers});
    userId=user.id;accountId=req.nextUrl.searchParams.get('accountId');
  }
  if(!accountId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId))return NextResponse.json({ok:false,error:'A linked Riot account is required.'},{status:400,headers});
  try{return NextResponse.json({ok:true,...await loadTftDevelopment(userId,accountId)},{headers})}
  catch(error){
    const denied=error instanceof Error&&error.message==='TFT_ACCOUNT_NOT_OWNED';
    console.warn('[tft-development] load failed',denied?'Account ownership denied':error);
    return NextResponse.json({ok:false,error:denied?'That Riot account is not linked to you.':'TFT development is temporarily unavailable.'},{status:denied?403:503,headers});
  }
}
