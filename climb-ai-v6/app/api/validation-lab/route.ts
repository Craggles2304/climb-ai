import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {buildValidationLab} from '@/lib/server/validationLab';
import {rateLimit,clientKey} from '@/lib/server/rateLimit';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  const limit=rateLimit(clientKey(req,'validation-lab'),30,60_000);
  if(!limit.ok)return NextResponse.json({ok:false,error:'Too many validation requests.'},{status:429});
  const user=await getCurrentUser();
  const db=getSupabaseAdmin();
  if(!user||!db)return NextResponse.json({ok:false,error:'Authentication required.'},{status:401});
  const accountId=req.nextUrl.searchParams.get('accountId')||'';
  if(!accountId)return NextResponse.json({ok:false,error:'Choose a Riot account.'},{status:400});
  try{
    const report=await buildValidationLab(db,user.id,accountId,20);
    return NextResponse.json({ok:true,...report});
  }catch(error){
    console.error('[validation-lab]',error);
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Validation audit unavailable.'},{status:503});
  }
}
