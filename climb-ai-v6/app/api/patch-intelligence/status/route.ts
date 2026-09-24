import {NextRequest,NextResponse} from 'next/server';
import {clientKey,rateLimit} from '@/lib/server/rateLimit';
import {ensureCurrentPatchIntelligence} from '@/lib/server/lolPatchIntelligenceRepository';

export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  const limited=rateLimit(clientKey(req,'patch-intelligence'),8,60_000);
  if(!limited.ok)return NextResponse.json({ok:false,error:'Too many patch checks.'},{status:429,headers:{'retry-after':String(limited.retryAfterSeconds)}});
  try{
    const status=await ensureCurrentPatchIntelligence();
    return NextResponse.json({ok:true,status},{headers:{'cache-control':'no-store'}});
  }catch(err){
    return NextResponse.json({ok:false,error:(err as Error)?.message||'Patch intelligence sync failed.'},{status:503,headers:{'cache-control':'no-store'}});
  }
}
