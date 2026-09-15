import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/supabase/server';
import {getSupabaseAdmin} from '@/lib/server/supabaseAdmin';
import {clampCoachText} from '@/lib/coachingLevel';

const historyTurnSchema=z.object({role:z.enum(['user','assistant']),content:z.string().min(1).max(2200)});
const taskSchema=z.object({title:z.string(),category:z.string(),metric:z.string(),progress:z.number(),target:z.string(),gameRule:z.string()});
const schema=z.object({
  message:z.string().min(1).max(1500),
  history:z.array(historyTurnSchema).max(12).optional(),
  accountId:z.string().uuid(),
  requestedGames:z.number().int().min(2).max(5).default(3),
  activeTasks:z.array(taskSchema).max(5).optional(),
  rank:z.string().optional(),
});

type ProMetric={score?:number|null;value?:string;summary?:string};
type Analysis={metrics?:Record<string,ProMetric>;fingerprint?:{primary?:string};leakSignals?:Array<{key?:string;label?:string;count?:number;severity?:string}>};
type MatchRow={id:string;champion:string;role:string;result:string;kills:number;deaths:number;assists:number;duration_seconds:number;occurred_at:string|null;created_at:string};
type MetricRow={match_id:string;cs:number|null;cs_per_min:number|null;vision_score:number|null;kill_participation:number|null;objective_participation:number|null;raw:any};
type TrendGame={champion:string;result:string;kills:number;deaths:number;assists:number;duration:number;at:string;csPerMin:number|null;visionScore:number|null;analysis:Analysis};

const PRO_SPECS=[
  ['fight_selection','Fight selection'],
  ['objective_readiness','Objective readiness'],
  ['historical_recovery','Recovery discipline'],
  ['resource_conversion','Spend-before-fight conversion'],
  ['reset_quality','Reset quality'],
  ['carry_preservation','Carry preservation'],
  ['lead_protection','Lead protection'],
  ['fight_conversion','Power-window conversion'],
  ['power_spike_conversion','Power-spike conversion'],
] as const;

export async function POST(req:Request){
  try{
    const input=schema.parse(await req.json());
    const user=await getCurrentUser();
    if(!user)return NextResponse.json({error:'Sign in to compare your recent games.'},{status:401});
    const db=getSupabaseAdmin();
    if(!db)return NextResponse.json({error:'Trend analysis is unavailable.'},{status:503});

    const {data:account,error:accountError}=await db.from('riot_accounts').select('id').eq('id',input.accountId).eq('user_id',user.id).maybeSingle();
    if(accountError)throw new Error(accountError.message);
    if(!account)return NextResponse.json({error:'That Riot account is not linked to this user.'},{status:403});

    const {data:analysisRows,error:analysisError}=await db.from('op_match_analysis')
      .select('match_id,champion,role,created_at,analysis')
      .eq('user_id',user.id).eq('riot_account_id',input.accountId)
      .not('match_id','is',null).order('created_at',{ascending:false}).limit(15);
    if(analysisError)throw new Error(analysisError.message);
    const ids=(analysisRows??[]).map((row:any)=>String(row.match_id||'')).filter(Boolean);
    if(!ids.length)return NextResponse.json(noGames(input.requestedGames,input.rank));

    const [matchesResult,metricsResult]=await Promise.all([
      db.from('matches').select('id,champion,role,result,kills,deaths,assists,duration_seconds,occurred_at,created_at').eq('user_id',user.id).in('id',ids),
      db.from('match_metrics').select('match_id,cs,cs_per_min,vision_score,kill_participation,objective_participation,raw').eq('user_id',user.id).in('match_id',ids),
    ]);
    if(matchesResult.error)throw new Error(matchesResult.error.message);
    if(metricsResult.error)throw new Error(metricsResult.error.message);

    const matchMap=new Map((matchesResult.data??[]).map((row:any)=>[String(row.id),row as MatchRow]));
    const metricMap=new Map((metricsResult.data??[]).map((row:any)=>[String(row.match_id),row as MetricRow]));
    const games:TrendGame[]=[];
    let excluded=0;
    for(const row of analysisRows??[]){
      const match=matchMap.get(String((row as any).match_id));
      if(!match)continue;
      const metric=metricMap.get(match.id);
      if(!meaningful(match,metric)){excluded+=1;continue}
      games.push({
        champion:String(match.champion||row.champion||'Unknown'),result:String(match.result||'UNKNOWN'),
        kills:Number(match.kills||0),deaths:Number(match.deaths||0),assists:Number(match.assists||0),duration:Number(match.duration_seconds||0),
        at:String(match.occurred_at||match.created_at||row.created_at),csPerMin:num(metric?.cs_per_min),visionScore:num(metric?.vision_score),
        analysis:(row.analysis??{}) as Analysis,
      });
      if(games.length>=input.requestedGames)break;
    }
    if(!games.length)return NextResponse.json(noGames(input.requestedGames,input.rank));

    const answer=clampCoachText(buildAnswer(games,input.requestedGames,input.activeTasks??[],excluded),input.rank);
    return NextResponse.json({
      answer,
      grounding:'recent-match-trend+ilp',
      factsUsed:['recent_game_rows','historical_pro_analysis','active_ilp_tasks','rank',...(excluded?['invalid_sessions_excluded']:[])],
      gamesUsed:games.length,
      requestedGames:input.requestedGames,
      excludedSessions:excluded,
    });
  }catch(error){
    console.error('[coach-trend] request failed',error);
    return NextResponse.json({error:'The multi-game trend could not be calculated.'},{status:400});
  }
}

function meaningful(match:MatchRow,metric?:MetricRow){
  const duration=Number(match.duration_seconds||0);
  const role=String(match.role||'').toUpperCase();
  const activity=Number(match.kills||0)+Number(match.deaths||0)+Number(match.assists||0)+Number(metric?.cs||0);
  if(duration<300)return false;
  if(role==='NONE'||role==='UNKNOWN')return false;
  if(activity<=0)return false;
  return true;
}

function buildAnswer(newestFirst:TrendGame[],requested:number,tasks:z.infer<typeof taskSchema>[],excluded:number){
  const chronological=[...newestFirst].reverse();
  const latest=chronological[chronological.length-1];
  const previous=chronological.length>1?chronological[chronological.length-2]:null;
  const oldest=chronological[0];
  const improvements:{label:string;delta:number;detail:string}[]=[];
  const regressions:{label:string;delta:number;detail:string}[]=[];

  for(const [key,label] of PRO_SPECS){
    const series=chronological.map(game=>score(game.analysis,key)).filter((v):v is number=>v!==null);
    if(series.length<2)continue;
    const last=series[series.length-1],prev=series[series.length-2],first=series[0];
    const recentDelta=last-prev,overallDelta=last-first;
    const detail=series.length>=3?`${Math.round(first)} → ${Math.round(prev)} → ${Math.round(last)}`:`${Math.round(prev)} → ${Math.round(last)}`;
    if(recentDelta>=4)improvements.push({label,delta:recentDelta,detail});
    else if(recentDelta<=-7)regressions.push({label,delta:recentDelta,detail});
    else if(overallDelta>=8)improvements.push({label,delta:overallDelta,detail});
    else if(overallDelta<=-10)regressions.push({label,delta:overallDelta,detail});
  }

  if(previous&&latest.deaths<=previous.deaths-2)improvements.push({label:'Death control',delta:previous.deaths-latest.deaths,detail:`${previous.deaths} → ${latest.deaths} deaths`});
  if(previous&&latest.deaths>=previous.deaths+2)regressions.push({label:'Death control',delta:previous.deaths-latest.deaths,detail:`${previous.deaths} → ${latest.deaths} deaths`});
  if(previous&&latest.csPerMin!==null&&previous.csPerMin!==null){
    const d=latest.csPerMin-previous.csPerMin;
    if(d>=.3)improvements.push({label:'Farm rate',delta:d,detail:`${previous.csPerMin.toFixed(1)} → ${latest.csPerMin.toFixed(1)} CS/min`});
    else if(d<=-.3)regressions.push({label:'Farm rate',delta:d,detail:`${previous.csPerMin.toFixed(1)} → ${latest.csPerMin.toFixed(1)} CS/min`});
  }
  if(previous&&latest.visionScore!==null&&previous.visionScore!==null){
    const d=latest.visionScore-previous.visionScore;
    if(d>=4)improvements.push({label:'Vision score',delta:d,detail:`${Math.round(previous.visionScore)} → ${Math.round(latest.visionScore)}`});
    else if(d<=-4)regressions.push({label:'Vision score',delta:d,detail:`${Math.round(previous.visionScore)} → ${Math.round(latest.visionScore)}`});
  }

  improvements.sort((a,b)=>b.delta-a.delta);
  regressions.sort((a,b)=>a.delta-b.delta);
  const sample=chronological.map(game=>`${game.champion} ${game.result} ${game.kills}/${game.deaths}/${game.assists}`).join(' → ');
  const countLine=newestFirst.length<requested
    ?`I only have ${newestFirst.length} meaningful tracked game${newestFirst.length===1?'':'s'} available for a valid comparison, so I excluded incomplete captures rather than pretending there were ${requested}.`
    :`I compared your last ${newestFirst.length} meaningful tracked games: ${sample}.`;
  const improved=improvements.length
    ?`IMPROVED: ${improvements.slice(0,3).map(x=>`${x.label} (${x.detail})`).join('; ')}.`
    :`IMPROVED: there is not a strong enough positive trend yet to claim a clear improvement from this sample.`;
  const regressed=regressions.length
    ?`STILL COSTING YOU: ${regressions.slice(0,3).map(x=>`${x.label} (${x.detail})`).join('; ')}.`
    :`STILL COSTING YOU: no major measured regression stands out across the usable sample.`;
  const primary=tasks[0];
  const priority=primary
    ?`CURRENT FOCUS: “${primary.title}”. Next-game rule: ${primary.gameRule}`
    :`CURRENT FOCUS: keep collecting full-game evidence so OP CLIMB can promote the next repeated behaviour.`;
  const context=oldest===latest?'':` The latest game was ${latest.champion} ${latest.result} (${latest.kills}/${latest.deaths}/${latest.assists}).`;
  const excludedLine=excluded?` I ignored ${excluded} incomplete/invalid tracker capture${excluded===1?'':'s'} in the search window.`:'';
  return `${countLine}${context}${excludedLine}\n\n${improved}\n\n${regressed}\n\n${priority}`;
}

function score(analysis:Analysis,key:string){return num(analysis?.metrics?.[key]?.score)}
function num(value:unknown){const n=Number(value);return Number.isFinite(n)?n:null}
function noGames(requested:number,rank?:string){return{answer:clampCoachText(`I do not have enough meaningful completed match evidence to compare the last ${requested} games yet. Short or empty tracker captures are excluded from trends.`,rank),grounding:'recent-match-trend+ilp',factsUsed:['invalid_sessions_excluded','rank'],gamesUsed:0,requestedGames:requested,excludedSessions:0}}
