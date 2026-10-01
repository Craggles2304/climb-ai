import {NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {resolveLeagueEntitlement} from '@/lib/server/subscriptionAccess';
import {historyCutoffIso,requiredTierForHistoryDate} from '@/lib/subscription';
import {proAnalysisForTier} from '@/lib/tieredProAnalysis';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';

export async function GET(_req:Request,{params}:{params:Promise<{match:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({analysis:null,source:'legacy-fallback'},{status:401});
  const db=getSupabaseAdmin();
  if(!db)return NextResponse.json({analysis:null,source:'legacy-fallback'},{status:503});
  const tier=(await resolveLeagueEntitlement(user.id)).tier;
  const {match}=await params;
  const {data,error}=await db.from('op_match_analysis')
    .select('analysis,evidence_sources,created_at')
    .eq('user_id',user.id)
    .eq('match_id',match)
    .maybeSingle();
  if(error){
    console.error('[analyse-pro] evidence load failed',error);
    return NextResponse.json({analysis:null,source:'legacy-fallback'},{status:500});
  }
  if(!data?.analysis)return NextResponse.json({analysis:null,source:'legacy-fallback'});
  const cutoff=historyCutoffIso(tier);
  const createdAt=String(data.created_at||'');
  if(cutoff&&Date.parse(createdAt)<Date.parse(cutoff)){
    return NextResponse.json({analysis:null,error:'This match is outside your current history window.',upgradeRequired:true,requiredTier:requiredTierForHistoryDate(createdAt),currentTier:tier},{status:403});
  }
  const analysis=proAnalysisForTier(data.analysis as ProMatchAnalysis,tier);
  return NextResponse.json({analysis,source:'tiered-pro',evidenceSources:data.evidence_sources??[],tier});
}
