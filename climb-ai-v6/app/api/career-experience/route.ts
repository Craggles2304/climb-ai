import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {buildDecisionTwinV2} from '@/lib/decisionTwinV2';
import {buildScenarioMemory} from '@/lib/scenarioMemory';
import {buildDecisionTransfer} from '@/lib/decisionTransfer';
import {buildClimbCurriculum} from '@/lib/climbCurriculum';
import {buildLearningJourney} from '@/lib/learningJourney';
import {buildClimbCareerExperience} from '@/lib/climbCareerExperience';
import type {HistoryAnalysisRow} from '@/lib/riot/proHistory';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';

const querySchema=z.object({accountId:z.string().uuid()});

export async function GET(req:Request){
  try{
    const input=querySchema.parse({accountId:new URL(req.url).searchParams.get('accountId')});
    const user=await getCurrentUser();
    if(!user)return NextResponse.json({error:'Sign in to view your Development Career.'},{status:401});
    const db=getSupabaseAdmin();
    if(!db)return NextResponse.json({error:'Development Career is unavailable.'},{status:503});

    const [{data:account,error:accountError},historyResult,learningResult]=await Promise.all([
      db.from('riot_accounts').select('id').eq('id',input.accountId).eq('user_id',user.id).maybeSingle(),
      db.from('op_match_analysis').select('champion,role,created_at,analysis').eq('user_id',user.id).eq('riot_account_id',input.accountId).order('created_at',{ascending:true}).limit(50),
      db.from('op_player_learning_profiles').select('recent_change').eq('user_id',user.id).eq('riot_account_id',input.accountId).maybeSingle(),
    ]);
    if(accountError)throw new Error(accountError.message);
    if(!account)return NextResponse.json({error:'That Riot account is not linked to this user.'},{status:403});
    if(historyResult.error)throw new Error(historyResult.error.message);
    if(learningResult.error)throw new Error(learningResult.error.message);

    const rows:HistoryAnalysisRow[]=(historyResult.data??[]).map((row:any)=>({
      champion:String(row.champion||'Unknown'),
      role:row.role?String(row.role):null,
      createdAt:String(row.created_at),
      analysis:row.analysis as ProMatchAnalysis,
    })).filter(row=>row.analysis?.version===1);

    const generatedAt=new Date().toISOString();
    const twin=buildDecisionTwinV2(rows,generatedAt);
    const memory=buildScenarioMemory(rows,generatedAt);
    const transfer=buildDecisionTransfer(rows,memory,generatedAt);
    const previousCurriculum=((learningResult.data?.recent_change as any)?.curriculum??null);
    const curriculum=buildClimbCurriculum(twin,memory,transfer,generatedAt,previousCurriculum);
    const journey=buildLearningJourney(rows,generatedAt);
    const career=buildClimbCareerExperience(curriculum,journey,generatedAt);

    return NextResponse.json({
      career,
      grounding:'verified-curriculum+autonomous-learning-contract+learning-journey',
      factsUsed:['climb_curriculum','career_matrix','autonomous_curriculum','scenario_memory','decision_transfer','learning_journey','decision_graph'],
    });
  }catch(error){
    console.error('[career-experience] request failed',error);
    return NextResponse.json({error:'The Development Career could not be built.'},{status:400});
  }
}
