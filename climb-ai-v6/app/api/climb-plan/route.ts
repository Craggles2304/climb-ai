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
import {nextRankTier} from '@/lib/liveMissionCoach';
import {DNA_DOMAINS,DNA_DOMAIN_LABELS} from '@/lib/dnaDomain';
import {canonicalLeagueRole,rowsForRole} from '@/lib/roleAwareLearning';
import type {DnaDomain,Role} from '@/lib/types';
import type {HistoryAnalysisRow} from '@/lib/riot/proHistory';
import type {ProMatchAnalysis,ProMetric} from '@/lib/riot/proAnalysis';

const querySchema=z.object({accountId:z.string().uuid()});

const METRIC_DOMAIN:Record<string,DnaDomain>={
  laneCsPerMin:'LANING',
  fight_selection:'TEAMFIGHTS',
  death_control:'TEAMFIGHTS',
  cs_curve:'WAVES_CS',
  unspent_gold:'WAVES_CS',
  red_state_fights:'LANING',
  chain_deaths:'CONSISTENCY',
  thrown_advantage:'CONSISTENCY',
  underdog_conversion:'TEAMFIGHTS',
  fight_conversion:'TEAMFIGHTS',
  resource_conversion:'WAVES_CS',
  lead_protection:'CONSISTENCY',
  power_spike_conversion:'WAVES_CS',
  reset_quality:'WAVES_CS',
  objective_readiness:'OBJECTIVES',
  farm_fight_tradeoff:'OBJECTIVES',
  repeat_threat:'VISION_MAP',
  opponent_adaptation:'VISION_MAP',
  item_timing_diff:'WAVES_CS',
  build_response:'CONSISTENCY',
  damage_efficiency:'TEAMFIGHTS',
  survival_value:'TEAMFIGHTS',
  carry_preservation:'TEAMFIGHTS',
  historical_recovery:'CONSISTENCY',
  objectiveParticipation:'OBJECTIVES',
  visionScore:'VISION_MAP',
  killParticipation:'TEAMFIGHTS',
  damageShare:'TEAMFIGHTS',
  csPerMin:'WAVES_CS',
  post15CsPerMin:'WAVES_CS',
};

const LEAK_DOMAIN:Record<string,DnaDomain>={
  BANKING_LEAK:'WAVES_CS',
  RED_STATE:'LANING',
  CHAIN_DEATH:'CONSISTENCY',
  LEAD_THROW:'CONSISTENCY',
  CARRY_DEATH:'TEAMFIGHTS',
};

function avg(values:number[]){
  return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
}
function round(value:number|null,digits=0){
  return value===null?null:Number(value.toFixed(digits));
}
function labelMetric(metric:string){
  return metric.replaceAll('_',' ').replace(/\b\w/g,char=>char.toUpperCase());
}
function metricDomain(metric:string):DnaDomain{
  return METRIC_DOMAIN[metric]??(metric.includes('objective')?'OBJECTIVES':metric.includes('vision')||metric.includes('threat')?'VISION_MAP':metric.includes('farm')||metric.includes('cs')||metric.includes('reset')||metric.includes('gold')?'WAVES_CS':metric.includes('fight')||metric.includes('damage')||metric.includes('survival')||metric.includes('carry')?'TEAMFIGHTS':'CONSISTENCY');
}
function trend(delta:number|null){
  if(delta===null)return'BUILDING';
  if(delta>=5)return'IMPROVING';
  if(delta<=-5)return'SLIPPING';
  return'STABLE';
}
function safeStories(analysis:ProMatchAnalysis){
  return analysis.reconstruction?.stories??[];
}
function metricRows(analysis:ProMatchAnalysis){
  return Object.values(analysis.metrics??{}).filter((metric):metric is ProMetric=>Boolean(metric&&typeof metric.score==='number'&&metric.status!=='UNAVAILABLE'&&metric.status!=='BUILDING'));
}
function rankLabel(account:any){
  const tier=String(account?.rank_tier||'').trim().toUpperCase();
  const division=String(account?.rank_division||'').trim().toUpperCase();
  const lp=Number(account?.league_points);
  if(!tier)return'UNRANKED';
  return [tier,division,Number.isFinite(lp)?String(lp)+' LP':''].filter(Boolean).join(' ');
}
function domainSummary(rows:HistoryAnalysisRow[],domain:DnaDomain){
  const byGame=rows.map(row=>{
    const scores=metricRows(row.analysis).filter(metric=>metricDomain(metric.key)===domain).map(metric=>Number(metric.score));
    const stories=safeStories(row.analysis).filter(story=>story.dnaDomain===domain);
    return{
      createdAt:row.createdAt,
      score:avg(scores),
      good:stories.filter(story=>story.side==='GOOD').length,
      critical:stories.filter(story=>story.side==='CRITICAL').length,
    };
  });
  const scored=byGame.filter(game=>game.score!==null);
  const recent=scored.slice(-5).map(game=>game.score as number);
  const previous=scored.slice(-10,-5).map(game=>game.score as number);
  const recentAverage=avg(recent);
  const lifetimeAverage=avg(scored.map(game=>game.score as number));
  const previousAverage=avg(previous);
  const delta=recentAverage!==null&&previousAverage!==null?recentAverage-previousAverage:null;
  return{
    domain,
    label:DNA_DOMAIN_LABELS[domain],
    score:round(recentAverage??lifetimeAverage),
    lifetime:round(lifetimeAverage),
    delta:round(delta,1),
    trend:trend(delta),
    games:scored.length,
    good:byGame.reduce((sum,game)=>sum+game.good,0),
    critical:byGame.reduce((sum,game)=>sum+game.critical,0),
  };
}

export async function GET(req:Request){
  try{
    const input=querySchema.parse({accountId:new URL(req.url).searchParams.get('accountId')});
    const user=await getCurrentUser();
    if(!user)return NextResponse.json({error:'Sign in to view your Climb Plan.'},{status:401});
    const access=await requireLeagueTier(user.id,'PRO');
    if(!access.allowed)return NextResponse.json({
      error:'PRO unlocks your full history-driven Climb Plan.',
      upgradeRequired:true,
      requiredTier:'PRO',
      currentTier:access.entitlement.tier,
    },{status:403});

    const db=getSupabaseAdmin();
    if(!db)return NextResponse.json({error:'Your Climb Plan is unavailable.'},{status:503});

    const [accountResult,historyResult,learningResult,taskResult,matchResult]=await Promise.all([
      db.from('riot_accounts')
        .select('id,game_name,tagline,role,rank_tier,rank_division,league_points')
        .eq('id',input.accountId).eq('user_id',user.id).maybeSingle(),
      db.from('op_match_analysis')
        .select('match_id,champion,role,created_at,analysis')
        .eq('user_id',user.id).eq('riot_account_id',input.accountId)
        .order('created_at',{ascending:true}).limit(100),
      db.from('op_player_learning_profiles')
        .select('recent_change,role_profiles')
        .eq('user_id',user.id).eq('riot_account_id',input.accountId).maybeSingle(),
      db.from('ilp_tasks')
        .select('payload,updated_at')
        .eq('user_id',user.id).eq('riot_account_id',input.accountId)
        .order('updated_at',{ascending:false}).limit(160),
      db.from('matches')
        .select('id,champion,role,result,kills,deaths,assists,duration_seconds,rank,occurred_at,created_at')
        .eq('user_id',user.id).eq('riot_account_id',input.accountId)
        .order('occurred_at',{ascending:false}).limit(100),
    ]);
    if(accountResult.error)throw new Error(accountResult.error.message);
    if(!accountResult.data)return NextResponse.json({error:'That Riot account is not linked to this user.'},{status:403});
    if(historyResult.error)throw new Error(historyResult.error.message);
    if(learningResult.error)throw new Error(learningResult.error.message);
    if(taskResult.error)throw new Error(taskResult.error.message);
    if(matchResult.error)throw new Error(matchResult.error.message);

    const allRows:HistoryAnalysisRow[]=(historyResult.data??[]).map((row:any)=>({
      matchId:row.match_id?String(row.match_id):undefined,
      champion:String(row.champion||'Unknown'),
      role:row.role?String(row.role):null,
      createdAt:String(row.created_at),
      analysis:row.analysis as ProMatchAnalysis,
    })).filter(row=>row.analysis?.version===1);

    const accountRole=canonicalLeagueRole(accountResult.data.role);
    const roleRows=accountRole?rowsForRole(allRows,accountRole):allRows;
    const rows=roleRows.length?roleRows:allRows;
    const previousRole=(learningResult.data?.role_profiles as any)?.[accountRole||'']?.recentChange?.curriculum??null;
    const previousGlobal=(learningResult.data?.recent_change as any)?.curriculum??null;
    const previousCurriculum=previousRole??previousGlobal;

    const twin=buildDecisionTwinV2(rows);
    const memory=buildScenarioMemory(rows);
    const transfer=buildDecisionTransfer(rows,memory);
    const skillGraph=buildSkillTransferGraph({rows,twin,memory,transfer});
    const curriculum=buildClimbCurriculum(twin,memory,transfer,undefined,previousCurriculum,skillGraph);
    const contract=curriculum.autonomous?.activeContract??null;

    const domainCards=DNA_DOMAINS.map(domain=>domainSummary(rows,domain)).sort((a,b)=>{
      if(a.score===null&&b.score===null)return 0;
      if(a.score===null)return 1;
      if(b.score===null)return-1;
      return a.score-b.score;
    });

    const patternMap=new Map<string,{key:string;label:string;domain:DnaDomain;count:number;games:Set<string>;recentGames:number;severity:number;lastSeen:string;detail:string;evidenceSeconds:number[]}>();
    const recentBoundary=Math.max(0,rows.length-5);
    rows.forEach((row,rowIndex)=>{
      for(const leak of row.analysis.leakSignals??[]){
        const current=patternMap.get(leak.key)??{
          key:leak.key,label:leak.label,domain:LEAK_DOMAIN[leak.key]??'CONSISTENCY',count:0,games:new Set<string>(),recentGames:0,severity:0,lastSeen:row.createdAt,detail:leak.detail,evidenceSeconds:[],
        };
        current.count+=Number(leak.count)||0;
        current.games.add(row.matchId||row.createdAt);
        if(rowIndex>=recentBoundary)current.recentGames+=1;
        current.severity=Math.max(current.severity,leak.severity==='CRITICAL'?4:leak.severity==='MAJOR'?3:leak.severity==='ACTIVE'?2:1);
        current.lastSeen=row.createdAt;
        current.detail=leak.detail;
        current.evidenceSeconds.push(...(leak.evidenceSeconds??[]));
        patternMap.set(leak.key,current);
      }
    });
    const patterns=[...patternMap.values()].map(item=>({
      key:item.key,
      label:item.label,
      dnaDomain:item.domain,
      count:item.count,
      games:item.games.size,
      recentGames:item.recentGames,
      severity:item.severity>=4?'CRITICAL':item.severity>=3?'MAJOR':item.severity>=2?'ACTIVE':'POLISH',
      lastSeen:item.lastSeen,
      detail:item.detail,
      repeated:item.games.size>=2,
    })).filter(item=>item.repeated).sort((a,b)=>b.recentGames-a.recentGames||b.games-a.games||b.count-a.count).slice(0,8);

    const metricMap=new Map<string,{key:string;label:string;domain:DnaDomain;scores:number[];recent:number[];evidence:string[];games:number}>();
    rows.forEach((row,rowIndex)=>{
      for(const metric of metricRows(row.analysis)){
        const current=metricMap.get(metric.key)??{key:metric.key,label:metric.label||labelMetric(metric.key),domain:metricDomain(metric.key),scores:[],recent:[],evidence:[],games:0};
        current.scores.push(Number(metric.score));
        if(rowIndex>=recentBoundary)current.recent.push(Number(metric.score));
        current.games+=1;
        if(metric.evidence?.[0]?.detail)current.evidence.push(metric.evidence[0].detail);
        metricMap.set(metric.key,current);
      }
    });
    const metricSummaries=[...metricMap.values()].map(item=>({
      key:item.key,label:item.label,dnaDomain:item.domain,games:item.games,
      score:round(avg(item.recent.length?item.recent:item.scores)),
      lifetime:round(avg(item.scores)),
      evidence:item.evidence.at(-1)??null,
    }));
    const strengths=metricSummaries.filter(item=>item.games>=2&&Number(item.score)>=72).sort((a,b)=>Number(b.score)-Number(a.score)||b.games-a.games).slice(0,8);
    const weakMetrics=metricSummaries.filter(item=>item.games>=2&&Number(item.score)<68).sort((a,b)=>Number(a.score)-Number(b.score)||b.games-a.games).slice(0,8);

    const matchMap=new Map((matchResult.data??[]).map((match:any)=>[String(match.id),match]));
    const recentGames=[...rows].reverse().slice(0,12).map(row=>{
      const match=matchMap.get(String(row.matchId||'')) as any;
      const stories=safeStories(row.analysis);
      const good=stories.filter(story=>story.side==='GOOD').sort((a,b)=>b.severity-a.severity).slice(0,3);
      const critical=stories.filter(story=>story.side==='CRITICAL').sort((a,b)=>b.severity-a.severity).slice(0,3);
      const metrics=metricRows(row.analysis).sort((a,b)=>Number(a.score)-Number(b.score));
      return{
        matchId:row.matchId??null,
        createdAt:row.createdAt,
        champion:row.champion,
        role:row.role,
        result:match?.result??null,
        kda:match?{kills:Number(match.kills||0),deaths:Number(match.deaths||0),assists:Number(match.assists||0)}:null,
        durationSeconds:match?.duration_seconds??null,
        fingerprint:row.analysis.fingerprint,
        good:good.map(story=>({clock:story.clock,title:story.title,dnaDomain:story.dnaDomain,coaching:story.coaching,severity:story.severity})),
        critical:critical.map(story=>({clock:story.clock,title:story.title,dnaDomain:story.dnaDomain,coaching:story.coaching,severity:story.severity})),
        strongestMetric:metrics.length?{label:metrics.at(-1)!.label,score:metrics.at(-1)!.score}:null,
        weakestMetric:metrics.length?{label:metrics[0]!.label,score:metrics[0]!.score}:null,
      };
    });

    const liveTasks=(taskResult.data??[]).map((row:any)=>row.payload??{}).filter((task:any)=>{
      const status=String(task.status||'ACTIVE').toUpperCase();
      const scope=canonicalLeagueRole(task.roleScope);
      return status!=='MASTERED'&&status!=='PAUSED'&&(!accountRole||!scope||scope===accountRole||String(task.roleScope).toUpperCase()==='GLOBAL');
    });

    const currentLesson=curriculum.currentLesson;
    const queue=[...(curriculum.queue??[])].filter(item=>item.behaviourKey!==currentLesson?.behaviourKey).slice(0,4);
    const activeTask=currentLesson
      ?liveTasks.find((task:any)=>String(task.metric||'').toLowerCase().includes(String(currentLesson.behaviourKey||'').toLowerCase().split('_')[0]))
        ??liveTasks.sort((a:any,b:any)=>Number(b.priority||0)-Number(a.priority||0))[0]
        ??null
      :liveTasks.sort((a:any,b:any)=>Number(b.priority||0)-Number(a.priority||0))[0]??null;

    const account=accountResult.data as any;
    const currentTier=String(account.rank_tier||'UNRANKED').toUpperCase();
    const nextTier=currentTier==='UNRANKED'?'RANKED':nextRankTier(currentTier);
    const oldest=rows[0]?.createdAt??null;
    const newest=rows.at(-1)?.createdAt??null;

    return NextResponse.json({
      ok:true,
      planVersion:1,
      account:{
        gameName:String(account.game_name||'Player'),
        tagline:String(account.tagline||''),
        role:accountRole,
        rank:rankLabel(account),
        currentTier,
        nextTier,
      },
      coverage:{
        gamesAnalyzed:rows.length,
        totalHistoryRows:allRows.length,
        from:oldest,
        to:newest,
        champions:[...new Set(rows.map(row=>row.champion))],
        measuredMetrics:metricSummaries.length,
        reconstructedMoments:rows.reduce((sum,row)=>sum+safeStories(row.analysis).length,0),
        goodMoments:rows.reduce((sum,row)=>sum+safeStories(row.analysis).filter(story=>story.side==='GOOD').length,0),
        criticalMoments:rows.reduce((sum,row)=>sum+safeStories(row.analysis).filter(story=>story.side==='CRITICAL').length,0),
      },
      now:currentLesson?{
        skill:currentLesson.label,
        phase:currentLesson.phase,
        rule:currentLesson.gameRule,
        whyNow:currentLesson.whyNow,
        evidence:currentLesson.evidence,
        completion:contract?.completion??null,
        state:contract?.state??currentLesson.phase,
        graduateWhen:contract?.graduateWhen??currentLesson.graduationRule,
        nextSkill:curriculum.nextLesson?.label??queue[0]?.label??null,
        task:activeTask?{title:activeTask.title,dnaDomain:activeTask.dnaDomain,metric:activeTask.metric,target:activeTask.target,progress:activeTask.progress}:null,
      }:null,
      route:[
        currentLesson?{step:'NOW',title:currentLesson.label,detail:currentLesson.gameRule,state:contract?.state??currentLesson.phase}:null,
        currentLesson?{step:'PROVE',title:contract?.testDirective?.mode==='TRANSFER_TEST'?'Transfer the principle':'Bank verified reps',detail:contract?.testDirective?.instruction??currentLesson.graduationRule,state:contract?.testDirective?.mode??'LOCAL_REP'}:null,
        currentLesson?{step:'MASTER',title:'Retire only when earned',detail:contract?.graduateWhen??currentLesson.graduationRule,state:'EVIDENCE_GATED'}:null,
        (curriculum.nextLesson??queue[0])?{step:'NEXT',title:(curriculum.nextLesson??queue[0])!.label,detail:(curriculum.nextLesson??queue[0])!.whyNow,state:(curriculum.nextLesson??queue[0])!.readiness}:null,
      ].filter(Boolean),
      dna:domainCards,
      patterns,
      strengths,
      weakMetrics,
      recentGames,
      curriculum:{
        status:curriculum.status,
        decision:curriculum.decision,
        graduated:(curriculum.graduated??[]).map(item=>({label:item.label,phase:item.phase,evidence:item.evidence})).slice(-8),
        queue:queue.map(item=>({label:item.label,phase:item.phase,readiness:item.readiness,whyNow:item.whyNow,gameRule:item.gameRule})),
      },
      boundary:'This plan uses only recorded Riot/Companion evidence and derived coaching models. NOT OBSERVED is neutral. A repeated pattern needs repeated evidence; a single good or bad game cannot define the player.',
    });
  }catch(error){
    console.error('[climb-plan] request failed',error);
    return NextResponse.json({error:'Your Climb Plan could not be built.'},{status:400});
  }
}
