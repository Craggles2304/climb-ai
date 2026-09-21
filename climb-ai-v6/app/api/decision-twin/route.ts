import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {buildDecisionTwinV2} from '@/lib/decisionTwinV2';
import type {HistoryAnalysisRow} from '@/lib/riot/proHistory';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';

const querySchema=z.object({accountId:z.string().uuid()});

export async function GET(req:Request){
  try{
    const input=querySchema.parse({accountId:new URL(req.url).searchParams.get('accountId')});
    const user=await getCurrentUser();
    if(!user)return NextResponse.json({error:'Sign in to view your Decision Twin.'},{status:401});
    const db=getSupabaseAdmin();
    if(!db)return NextResponse.json({error:'Decision Twin is unavailable.'},{status:503});

    const {data:account,error:accountError}=await db
      .from('riot_accounts')
      .select('id')
      .eq('id',input.accountId)
      .eq('user_id',user.id)
      .maybeSingle();
    if(accountError)throw new Error(accountError.message);
    if(!account)return NextResponse.json({error:'That Riot account is not linked to this user.'},{status:403});

    const {data,error}=await db
      .from('op_match_analysis')
      .select('champion,role,created_at,analysis')
      .eq('user_id',user.id)
      .eq('riot_account_id',input.accountId)
      .order('created_at',{ascending:true})
      .limit(50);
    if(error)throw new Error(error.message);

    const rows:HistoryAnalysisRow[]=(data??[]).map((row:any)=>({
      champion:String(row.champion||'Unknown'),
      role:row.role?String(row.role):null,
      createdAt:String(row.created_at),
      analysis:row.analysis as ProMatchAnalysis,
    })).filter(row=>row.analysis?.version===1);

    const twin=buildDecisionTwinV2(rows);
    return NextResponse.json({
      twin,
      grounding:'decision-twin-v2+historical-pro-analysis+decision-graph+premortem-review',
      factsUsed:['historical_pro_analysis','decision_graph','situation_patterns','premortem_review','coaching_response'],
    });
  }catch(error){
    console.error('[decision-twin-v2] request failed',error);
    return NextResponse.json({error:'The Decision Twin could not be built.'},{status:400});
  }
}
