import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {syncAndLoadProgression} from '@/lib/server/playerProgressionRepository';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'progression'),60,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many progression requests.'},{status:429});

  const user=await getCurrentUser();
  const db=getSupabaseAdmin();
  if(!user||!db)return NextResponse.json({ok:false,error:'Authentication required.'},{status:401});

  const accountId=req.nextUrl.searchParams.get('accountId');
  try{
    const snapshot=await syncAndLoadProgression(db,user.id,accountId);
    return NextResponse.json({ok:true,...snapshot});
  }catch(error){
    console.error('[progression] failed',error);
    return NextResponse.json({ok:false,error:'Progression is temporarily unavailable.'},{status:503});
  }
}
