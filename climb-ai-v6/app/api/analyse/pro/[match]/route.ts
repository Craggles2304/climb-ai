import {NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';

export async function GET(_req:Request,{params}:{params:Promise<{match:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({analysis:null,source:'legacy-fallback'},{status:401});
  const db=getSupabaseAdmin();
  if(!db)return NextResponse.json({analysis:null,source:'legacy-fallback'},{status:503});
  const {match}=await params;
  const {data,error}=await db.from('op_match_analysis')
    .select('analysis,evidence_sources')
    .eq('user_id',user.id)
    .eq('match_id',match)
    .maybeSingle();
  if(error){
    console.error('[analyse-pro] evidence load failed',error);
    return NextResponse.json({analysis:null,source:'legacy-fallback'},{status:500});
  }
  if(!data?.analysis)return NextResponse.json({analysis:null,source:'legacy-fallback'});
  return NextResponse.json({analysis:data.analysis,source:'pro',evidenceSources:data.evidence_sources??[]});
}
