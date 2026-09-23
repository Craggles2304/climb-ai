import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {buildDecisionTwinV2} from '@/lib/decisionTwinV2';
import {buildScenarioMemory} from '@/lib/scenarioMemory';
import {buildDecisionTransfer} from '@/lib/decisionTransfer';
import {buildClimbCurriculum} from '@/lib/climbCurriculum';
import {buildClimbCoachTwin} from '@/lib/climbCoachTwin';
import {buildClimbAutonomyProfile} from '@/lib/climbAutonomy';
import {buildClimbInterventionValueProfile} from '@/lib/climbInterventionValue';
import {buildDecisionCausalProfile} from '@/lib/decisionCausalProfile';
import {buildPlayerCoachingIdentity,type PlayerCoachingIdentity} from '@/lib/playerCoachingIdentity';
import {buildAdaptiveCoachingSession,type AdaptiveCoachingSession} from '@/lib/climbAdaptiveCoachingSession';
import {buildLearningVelocityProfile,type LearningVelocityProfile} from '@/lib/climbLearningVelocity';
import {buildSkillTransferGraph} from '@/lib/climbSkillTransferGraph';
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

    const [historyResult,learningResult]=await Promise.all([
      db
        .from('op_match_analysis')
        .select('champion,role,created_at,analysis')
        .eq('user_id',user.id)
        .eq('riot_account_id',input.accountId)
        .order('created_at',{ascending:true})
        .limit(50),
      db
        .from('op_player_learning_profiles')
        .select('recent_change')
        .eq('user_id',user.id)
        .eq('riot_account_id',input.accountId)
        .maybeSingle(),
    ]);
    if(historyResult.error)throw new Error(historyResult.error.message);
    if(learningResult.error)throw new Error(learningResult.error.message);
    const previousCurriculum=((learningResult.data?.recent_change as any)?.curriculum??null);
    const previousPlayerCoachingIdentity=((learningResult.data?.recent_change as any)?.playerCoachingIdentity??null) as PlayerCoachingIdentity|null;
    const previousAdaptiveCoachingSession=((learningResult.data?.recent_change as any)?.adaptiveCoachingSession??null) as AdaptiveCoachingSession|null;
    const previousLearningVelocity=((learningResult.data?.recent_change as any)?.learningVelocity??null) as LearningVelocityProfile|null;

    const rows:HistoryAnalysisRow[]=(historyResult.data??[]).map((row:any)=>({
      champion:String(row.champion||'Unknown'),
      role:row.role?String(row.role):null,
      createdAt:String(row.created_at),
      analysis:row.analysis as ProMatchAnalysis,
    })).filter(row=>row.analysis?.version===1);

    const twin=buildDecisionTwinV2(rows);
    const scenarioMemory=buildScenarioMemory(rows);
    const decisionTransfer=buildDecisionTransfer(rows,scenarioMemory);
    const skillTransferGraph=buildSkillTransferGraph({rows,twin,memory:scenarioMemory,transfer:decisionTransfer});
    const curriculum=buildClimbCurriculum(twin,scenarioMemory,decisionTransfer,undefined,previousCurriculum,skillTransferGraph);
    const coachTwin=buildClimbCoachTwin(rows);
    const autonomyProfile=buildClimbAutonomyProfile(rows);
    const interventionValue=buildClimbInterventionValueProfile(rows);
    const causalProfile=buildDecisionCausalProfile(rows);
    const playerCoachingIdentity=buildPlayerCoachingIdentity({rows,twin,curriculum,coachTwin,causalProfile,autonomyProfile,interventionValue,previous:previousPlayerCoachingIdentity});
    const learningVelocity=buildLearningVelocityProfile({rows,coachTwin,interventionValue,identity:playerCoachingIdentity,curriculum,previous:previousLearningVelocity});
    const adaptiveCoachingSession=buildAdaptiveCoachingSession({rows,identity:playerCoachingIdentity,curriculum,previous:previousAdaptiveCoachingSession,learningPolicy:learningVelocity.policy});
    return NextResponse.json({
      twin,
      scenarioMemory,
      decisionTransfer,
      skillTransferGraph,
      curriculum,
      coachTwin,
      autonomyProfile,
      interventionValue,
      causalProfile,
      playerCoachingIdentity,
      learningVelocity,
      adaptiveCoachingSession,
      grounding:'climb-profile+curriculum+transfer-learning+scenario-memory+historical-pro-analysis+decision-graph+premortem-review',
      factsUsed:['historical_pro_analysis','decision_graph','situation_patterns','scenario_memory','decision_transfer','skill_transfer_graph','climb_curriculum','coach_twin','climb_autonomy','intervention_value','intent_gap','coaching_strategy','causal_profile','player_coaching_identity','learning_velocity','adaptive_coaching_session','premortem_review','coaching_response'],
    });
  }catch(error){
    console.error('[decision-twin-v2] request failed',error);
    return NextResponse.json({error:'The Decision Twin could not be built.'},{status:400});
  }
}
