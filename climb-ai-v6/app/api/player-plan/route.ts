import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {requireLeagueTier} from '@/lib/server/subscriptionAccess';
import {buildDecisionTwinV2} from '@/lib/decisionTwinV2';
import {buildScenarioMemory} from '@/lib/scenarioMemory';
import {buildDecisionTransfer} from '@/lib/decisionTransfer';
import {buildClimbCurriculum} from '@/lib/climbCurriculum';
import {buildSkillTransferGraph} from '@/lib/climbSkillTransferGraph';
import {rowsForRole} from '@/lib/roleAwareLearning';
import type {DnaDomain,Role} from '@/lib/types';
import type {DecisionBehaviourKey} from '@/lib/decisionTwin';
import type {HistoryAnalysisRow} from '@/lib/riot/proHistory';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';

const querySchema=z.object({
  accountId:z.string().uuid(),
  role:z.enum(['TOP','JUNGLE','MID','ADC','SUPPORT']),
});

const DEFAULT_DOMAIN:Record<DecisionBehaviourKey,DnaDomain>={
  FIGHT_SELECTION:'TEAMFIGHTS',
  DEATH_RECOVERY:'CONSISTENCY',
  LEAD_PROTECTION:'CONSISTENCY',
  RESET_DISCIPLINE:'WAVES_CS',
  OBJECTIVE_READINESS:'OBJECTIVES',
  FARM_VS_SETUP:'OBJECTIVES',
  THREAT_ADAPTATION:'VISION_MAP',
  CARRY_PRESERVATION:'TEAMFIGHTS',
  POWER_SPIKE_CONVERSION:'WAVES_CS',
  SURVIVAL_VALUE:'TEAMFIGHTS',
};

const METRICS:Record<DecisionBehaviourKey,string[]>={
  FIGHT_SELECTION:['fight_selection','red_state_fights'],
  DEATH_RECOVERY:['historical_recovery','chain_deaths','death_control'],
  LEAD_PROTECTION:['lead_protection','thrown_advantage'],
  RESET_DISCIPLINE:['reset_quality','unspent_gold','resource_conversion'],
  OBJECTIVE_READINESS:['objective_readiness'],
  FARM_VS_SETUP:['farm_fight_tradeoff'],
  THREAT_ADAPTATION:['opponent_adaptation','repeat_threat'],
  CARRY_PRESERVATION:['carry_preservation'],
  POWER_SPIKE_CONVERSION:['power_spike_conversion'],
  SURVIVAL_VALUE:['survival_value'],
};

function liveTask(payload:any,role:Role){
  const status=String(payload?.status||'ACTIVE').toUpperCase();
  const scope=String(payload?.roleScope||role).toUpperCase();
  return status!=='MASTERED'&&status!=='PAUSED'&&(scope===role||scope==='GLOBAL');
}

function domainFor(key:DecisionBehaviourKey,tasks:any[]):DnaDomain{
  const metrics=new Set(METRICS[key]);
  const matching=tasks
    .filter(task=>liveTask(task,task?.roleScope as Role))
    .find(task=>metrics.has(String(task?.metric||''))&&task?.dnaDomain);
  return (matching?.dnaDomain as DnaDomain)||DEFAULT_DOMAIN[key];
}

export async function GET(req:Request){
  try{
    const input=querySchema.parse({
      accountId:new URL(req.url).searchParams.get('accountId'),
      role:new URL(req.url).searchParams.get('role'),
    });
    const user=await getCurrentUser();
    if(!user)return NextResponse.json({error:'Sign in to view Your Next Climb.'},{status:401});

    const access=await requireLeagueTier(user.id,'PLUS');
    if(!access.allowed){
      return NextResponse.json({
        error:'PLUS unlocks the DNA Player Plan.',
        upgradeRequired:true,
        requiredTier:'PLUS',
        currentTier:access.entitlement.tier,
      },{status:403});
    }

    const db=getSupabaseAdmin();
    if(!db)return NextResponse.json({error:'Your Next Climb is unavailable.'},{status:503});

    const {data:account,error:accountError}=await db
      .from('riot_accounts')
      .select('id')
      .eq('id',input.accountId)
      .eq('user_id',user.id)
      .maybeSingle();
    if(accountError)throw new Error(accountError.message);
    if(!account)return NextResponse.json({error:'That Riot account is not linked to this user.'},{status:403});

    const [historyResult,learningResult,taskResult]=await Promise.all([
      db.from('op_match_analysis')
        .select('match_id,champion,role,created_at,analysis')
        .eq('user_id',user.id)
        .eq('riot_account_id',input.accountId)
        .order('created_at',{ascending:true})
        .limit(90),
      db.from('op_player_learning_profiles')
        .select('recent_change,role_profiles')
        .eq('user_id',user.id)
        .eq('riot_account_id',input.accountId)
        .maybeSingle(),
      db.from('ilp_tasks')
        .select('payload')
        .eq('user_id',user.id)
        .eq('riot_account_id',input.accountId)
        .limit(120),
    ]);
    if(historyResult.error)throw new Error(historyResult.error.message);
    if(learningResult.error)throw new Error(learningResult.error.message);
    if(taskResult.error)throw new Error(taskResult.error.message);

    const allRows:HistoryAnalysisRow[]=(historyResult.data??[]).map((row:any)=>({
      matchId:row.match_id?String(row.match_id):undefined,
      champion:String(row.champion||'Unknown'),
      role:row.role?String(row.role):null,
      createdAt:String(row.created_at),
      analysis:row.analysis as ProMatchAnalysis,
    })).filter(row=>row.analysis?.version===1);
    const rows=rowsForRole(allRows,input.role);
    const roleProfiles=((learningResult.data?.role_profiles&&typeof learningResult.data.role_profiles==='object')
      ?learningResult.data.role_profiles:{} as Record<string,any>);
    const previous=(roleProfiles as Record<string,any>)?.[input.role]?.recentChange?.curriculum
      ??(learningResult.data?.recent_change as any)?.curriculum
      ??null;

    const twin=buildDecisionTwinV2(rows);
    const memory=buildScenarioMemory(rows);
    const transfer=buildDecisionTransfer(rows,memory);
    const skillGraph=buildSkillTransferGraph({rows,twin,memory,transfer});
    const curriculum=buildClimbCurriculum(twin,memory,transfer,undefined,previous,skillGraph);
    const lesson=curriculum.currentLesson;
    const contract=curriculum.autonomous?.activeContract??null;
    const tasks=(taskResult.data??[]).map((row:any)=>row?.payload??{}).filter((task:any)=>liveTask(task,input.role));

    if(!lesson){
      return NextResponse.json({
        ok:true,
        tier:access.entitlement.tier,
        role:input.role,
        status:curriculum.status,
        gamesAnalyzed:rows.length,
        plan:null,
        message:rows.length<3
          ?'Keep playing tracked '+input.role+' games. OP CLIMB is building enough evidence to choose Your Next Climb.'
          :'OP CLIMB is waiting for enough repeated evidence to choose the next skill honestly.',
      });
    }

    const dnaDomain=domainFor(lesson.behaviourKey,tasks);
    const completedGates=(contract?.gates??[]).filter((gate:any)=>gate.status==='PASSED'||gate.status==='COMPLETE').length;
    const totalGates=Math.max(1,(contract?.gates??[]).length);
    return NextResponse.json({
      ok:true,
      tier:access.entitlement.tier,
      role:input.role,
      status:curriculum.status,
      gamesAnalyzed:rows.length,
      plan:{
        dnaDomain,
        behaviourKey:lesson.behaviourKey,
        skill:lesson.label,
        phase:lesson.phase,
        state:contract?.state??lesson.phase,
        action:curriculum.autonomous?.action??curriculum.decision.action,
        whyNow:lesson.whyNow,
        teachingPoint:lesson.gameRule,
        evidence:lesson.evidence,
        graduationRule:lesson.graduationRule,
        completion:contract?.completion??Math.round(completedGates/totalGates*100),
        gates:(contract?.gates??[]).map((gate:any)=>({
          id:gate.id,
          label:gate.label,
          status:gate.status,
          detail:gate.detail,
        })),
        transferTest:contract?.testDirective?.mode==='TRANSFER_TEST'
          ?{
              active:true,
              needsNovelChampionOrContext:Boolean(contract.testDirective.needsNovelChampionOrContext),
              behaviourKey:contract.testDirective.behaviourKey,
            }
          :{active:false,needsNovelChampionOrContext:true,behaviourKey:lesson.behaviourKey},
        retireWhen:contract?.graduateWhen??lesson.graduationRule,
        nextSkill:curriculum.nextLesson?.label??null,
        decisionReason:curriculum.decision.reason,
      },
      boundary:'Your Next Climb advances only from verified evidence. NOT OBSERVED is neutral, local mastery is not transfer, and a skill is not retired until its graduation gate is genuinely met.',
    });
  }catch(error){
    console.error('[player-plan] request failed',error);
    return NextResponse.json({error:'Your Next Climb could not be built.'},{status:400});
  }
}
