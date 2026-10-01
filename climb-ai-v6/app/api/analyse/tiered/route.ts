import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {resolveLeagueEntitlement} from '@/lib/server/subscriptionAccess';
import {historyCutoffIso} from '@/lib/subscription';
import {proAnalysisForTier} from '@/lib/tieredProAnalysis';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';

const schema=z.object({matchIds:z.array(z.string().min(1)).max(100)});

export async function POST(req:Request){
  try{
    const {matchIds}=schema.parse(await req.json());
    const user=await getCurrentUser();
    if(!user)return NextResponse.json({analyses:[]},{status:401});
    if(!matchIds.length)return NextResponse.json({analyses:[]});
    const db=getSupabaseAdmin();
    if(!db)return NextResponse.json({analyses:[]},{status:503});
    const tier=(await resolveLeagueEntitlement(user.id)).tier;
    const cutoff=historyCutoffIso(tier);

    const [matchesResult,analysisResult]=await Promise.all([
      db.from('matches').select('id,occurred_at,created_at').eq('user_id',user.id).in('id',matchIds),
      db.from('op_match_analysis').select('match_id,analysis').eq('user_id',user.id).in('match_id',matchIds),
    ]);
    if(matchesResult.error)throw new Error(matchesResult.error.message);
    if(analysisResult.error)throw new Error(analysisResult.error.message);

    const eligible=new Set((matchesResult.data??[]).filter((row:any)=>{
      if(!cutoff)return true;
      const at=Date.parse(String(row.occurred_at||row.created_at||''));
      return Number.isFinite(at)&&at>=Date.parse(cutoff);
    }).map((row:any)=>String(row.id)));

    const analyses=(analysisResult.data??[]).flatMap((row:any)=>{
      const id=String(row.match_id||'');
      if(!eligible.has(id)||!row.analysis||typeof row.analysis!=='object')return[];
      return[{matchId:id,analysis:proAnalysisForTier(row.analysis as ProMatchAnalysis,tier)??null}];
    });
    return NextResponse.json({analyses,tier});
  }catch(error){
    console.error('[tiered-analysis] load failed',error);
    return NextResponse.json({analyses:[]},{status:400});
  }
}
