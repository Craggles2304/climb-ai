import {NextResponse} from 'next/server';
import {z} from 'zod';
import {analyseMatch} from '@/lib/engine';
import type {Match,Role} from '@/lib/types';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {canonicalLeagueRole} from '@/lib/roleAwareLearning';

const schema=z.object({matchId:z.string().min(1)});

function roleOf(value:unknown):Role{return canonicalLeagueRole(value)??'ADC'}

function firstNumber(...values:unknown[]){
  for(const value of values){
    if(value===null||value===undefined||value==='')continue;
    const number=Number(value);
    if(Number.isFinite(number))return number;
  }
  return undefined;
}

function toMatch(row:any,metric:any,proAnalysis?:ProMatchAnalysis):Match{
  const raw=metric?.raw&&typeof metric.raw==='object'?metric.raw:{};
  const rawMetrics=raw.metrics&&typeof raw.metrics==='object'?raw.metrics:{};
  const n=(value:unknown,fallback=0)=>{const number=Number(value);return Number.isFinite(number)?number:fallback};
  return {
    id:row.id,
    riotAccountId:row.riot_account_id||'',
    champion:row.champion||'Unknown',
    opponent:typeof raw.opponent==='string'?raw.opponent:undefined,
    role:roleOf(row.role),
    result:row.result as Match['result'],
    kills:n(row.kills),deaths:n(row.deaths),assists:n(row.assists),
    durationSeconds:n(row.duration_seconds,1),rank:row.rank||'',
    source:String(row.source||'manual').toLowerCase() as Match['source'],
    createdAt:row.occurred_at||row.created_at||new Date().toISOString(),
    metrics:{
      cs:n(metric?.cs??rawMetrics.cs),
      csPerMin:firstNumber(metric?.cs_per_min,rawMetrics.csPerMin)??0,
      deaths:n(row.deaths),
      goldPerMin:firstNumber(metric?.gold_per_min,rawMetrics.goldPerMin),
      damagePerMin:firstNumber(metric?.damage_per_min,rawMetrics.damagePerMin),
      damageShare:firstNumber(metric?.damage_share,rawMetrics.damageShare),
      killParticipation:firstNumber(metric?.kill_participation,rawMetrics.killParticipation),
      visionScore:firstNumber(metric?.vision_score,rawMetrics.visionScore),
      objectiveParticipation:firstNumber(metric?.objective_participation,rawMetrics.objectiveParticipation),
      laneCsPerMin:firstNumber(metric?.lane_cs_per_min,rawMetrics.laneCsPerMin),
      post15CsPerMin:firstNumber(metric?.post15_cs_per_min,metric?.farm_after_15,rawMetrics.post15CsPerMin),
      csAt10:firstNumber(metric?.cs_at_10,rawMetrics.csAt10),csAt15:firstNumber(metric?.cs_at_15,rawMetrics.csAt15),
      goldDiffAt15:firstNumber(metric?.gold_diff_at_15,rawMetrics.goldDiffAt15),xpDiffAt15:firstNumber(metric?.xp_diff_at_15,rawMetrics.xpDiffAt15),
      deathsPre10:firstNumber(metric?.deaths_pre_10,rawMetrics.deathsPre10),deaths10to20:firstNumber(metric?.deaths_10_to_20,rawMetrics.deaths10to20),deathsPost20:firstNumber(metric?.deaths_post_20,rawMetrics.deathsPost20),
      soloDeaths:firstNumber(metric?.solo_deaths,rawMetrics.soloDeaths),teamfightDeaths:firstNumber(metric?.teamfight_deaths,rawMetrics.teamfightDeaths),
      firstItemMinute:firstNumber(metric?.first_item_minute,rawMetrics.firstItemMinute),secondItemMinute:firstNumber(metric?.second_item_minute,rawMetrics.secondItemMinute),thirdItemMinute:firstNumber(metric?.third_item_minute,rawMetrics.thirdItemMinute),
    },
    proAnalysis,
  };
}

export async function POST(req:Request){
  try{
    const {matchId}=schema.parse(await req.json());
    const user=await getCurrentUser();
    if(!user)return NextResponse.json({error:'Sign in to analyse your match.'},{status:401});
    const db=getSupabaseAdmin();
    if(!db)return NextResponse.json({error:'Match analysis is unavailable right now.'},{status:503});

    const {data:row,error:matchError}=await db.from('matches')
      .select('id,riot_account_id,champion,role,result,kills,deaths,assists,duration_seconds,rank,source,occurred_at,created_at')
      .eq('user_id',user.id).eq('id',matchId).maybeSingle();
    if(matchError){console.error('[analyse] match load failed',matchError);return NextResponse.json({error:'We could not load this match.'},{status:500})}
    if(!row)return NextResponse.json({error:'Match not found.'},{status:404});

    const {data:metric,error:metricError}=await db.from('match_metrics').select('*').eq('user_id',user.id).eq('match_id',row.id).maybeSingle();
    if(metricError){console.error('[analyse] metrics load failed',metricError);return NextResponse.json({error:'We could not load this match evidence.'},{status:500})}

    const {data:proRow,error:proError}=await db.from('op_match_analysis').select('analysis,evidence_sources').eq('user_id',user.id).eq('match_id',row.id).maybeSingle();
    if(proError){console.error('[analyse] PRO evidence load failed',proError);return NextResponse.json({error:'We could not load the coaching evidence.'},{status:500})}
    const proAnalysis=proRow?.analysis&&typeof proRow.analysis==='object'?proRow.analysis as ProMatchAnalysis:undefined;
    const match=toMatch(row,metric,proAnalysis);

    const {data:recentRows,error:recentError}=await db.from('matches')
      .select('id,riot_account_id,champion,role,result,kills,deaths,assists,duration_seconds,rank,source,occurred_at,created_at')
      .eq('user_id',user.id).eq('riot_account_id',row.riot_account_id).neq('id',row.id)
      .in('result',['WIN','LOSS']).order('occurred_at',{ascending:false}).limit(5);
    if(recentError)console.error('[analyse] recent match load failed',recentError);
    const recentIds=(recentRows||[]).map((recent:any)=>recent.id);
    let recentMetrics:any[]=[];
    if(recentIds.length){
      const result=await db.from('match_metrics').select('*').eq('user_id',user.id).in('match_id',recentIds);
      if(!result.error)recentMetrics=result.data||[];
    }
    const metricMap=new Map(recentMetrics.map((item:any)=>[item.match_id,item]));
    const recent=(recentRows||[]).map((recent:any)=>toMatch(recent,metricMap.get(recent.id)));
    const report=analyseMatch(match,recent);

    return NextResponse.json({
      match,
      proAnalysis:proAnalysis??null,
      report,
      evidence:{source:proAnalysis?'pro':'scoreboard-fallback',sources:proRow?.evidence_sources??[]},
    });
  }catch(error){
    if(error instanceof z.ZodError)return NextResponse.json({error:'A valid match ID is required.'},{status:400});
    console.error('[analyse] analysis failed',error);
    return NextResponse.json({error:'We could not analyse this match. Try again.'},{status:500});
  }
}
