import 'server-only';

import type {ILPTask,Match,Role} from '@/lib/types';
import {gradeMissionGame,missionMeasurementLabel,missionMeasurementSource} from '@/lib/missionGrading';
import {missionRankBand} from '@/lib/rankMissionBenchmarks';

type Status='PASS'|'WARN'|'FAIL'|'NA';

export interface ValidationStage{key:string;label:string;status:Status;detail:string}
export interface ValidationMissionResult{
  missionId:string;title:string;metric:string;source:string;expectedPass:boolean|null;
  recordedPass:boolean;banked:boolean;xp:number;consistent:boolean;
}
export interface ValidationGame{
  matchId:string;externalMatchId:string|null;champion:string;role:string;result:string;rank:string;source:string;
  occurredAt:string;liveSessionId:string|null;snapshotCount:number;maxGameTime:number|null;
  enrichmentStatus:string;learningPlanStatus:string;stages:ValidationStage[];
  missionResults:ValidationMissionResult[];sourceCoverage:string[];overall:Status;
}
export interface ValidationLabReport{
  account:{id:string;gameName:string;tagline:string;rank:string;rankBand:string;verificationStatus:string};
  summary:{games:number;liveGames:number;passed:number;warnings:number;failed:number;coverage:{live:number;riot:number;decision:number}};
  games:ValidationGame[];
}

export async function buildValidationLab(db:any,userId:string,accountId:string,limit=20):Promise<ValidationLabReport>{
  const accountResult=await db.from('riot_accounts')
    .select('id,game_name,tagline,rank_tier,rank_division,verification_status,observed_riot_id,sync_status')
    .eq('user_id',userId).eq('id',accountId).maybeSingle();
  if(accountResult.error)throw new Error(accountResult.error.message);
  if(!accountResult.data)throw new Error('Riot account unavailable.');
  const account=accountResult.data;
  const currentRank=account.rank_tier
    ?String(account.rank_tier)+(account.rank_division?' '+String(account.rank_division):'')
    :'UNRANKED';

  const matchResult=await db.from('matches')
    .select('id,external_match_id,riot_account_id,live_session_id,champion,role,result,kills,deaths,assists,duration_seconds,rank,source,occurred_at,created_at')
    .eq('user_id',userId).eq('riot_account_id',accountId)
    .in('result',['WIN','LOSS'])
    .order('occurred_at',{ascending:false})
    .limit(Math.max(1,Math.min(30,limit)));
  if(matchResult.error)throw new Error(matchResult.error.message);
  const matches=matchResult.data??[];
  const ids=matches.map((row:any)=>String(row.id));
  const sessionIds=matches.map((row:any)=>row.live_session_id?String(row.live_session_id):null).filter(Boolean) as string[];

  const [metricsResult,analysisResult,tasksResult,xpResult,sessionsResult,snapshotsResult]=await Promise.all([
    ids.length?db.from('match_metrics')
      .select('match_id,cs,cs_per_min,gold_per_min,damage_per_min,damage_share,kill_participation,vision_score,farm_after_15,objective_participation,lane_cs_per_min,post15_cs_per_min,cs_at_10,cs_at_15,gold_diff_at_15,xp_diff_at_15,deaths_pre_10,deaths_10_to_20,deaths_post_20,solo_deaths,teamfight_deaths,first_item_minute,second_item_minute,third_item_minute,raw,unavailable_metrics')
      .eq('user_id',userId).in('match_id',ids):Promise.resolve({data:[],error:null}),
    ids.length?db.from('op_match_analysis')
      .select('match_id,session_id,evidence_sources,analysis,created_at')
      .eq('user_id',userId).in('match_id',ids):Promise.resolve({data:[],error:null}),
    db.from('ilp_tasks').select('id,payload').eq('user_id',userId).eq('riot_account_id',accountId),
    ids.length?db.from('player_xp_ledger')
      .select('transaction_key,mission_id,match_id,kind,xp,created_at')
      .eq('user_id',userId).eq('riot_account_id',accountId).in('match_id',ids):Promise.resolve({data:[],error:null}),
    sessionIds.length?db.from('live_telemetry_sessions')
      .select('id,status,started_at,ended_at,last_seen_at,summary,riot_account_id')
      .eq('user_id',userId).in('id',sessionIds):Promise.resolve({data:[],error:null}),
    sessionIds.length?db.from('live_telemetry_snapshots')
      .select('session_id,game_time').in('session_id',sessionIds):Promise.resolve({data:[],error:null}),
  ]);
  for(const result of [metricsResult,analysisResult,tasksResult,xpResult,sessionsResult,snapshotsResult]){
    if(result.error)throw new Error(result.error.message);
  }

  const metricMap=new Map((metricsResult.data??[]).map((row:any)=>[String(row.match_id),row]));
  const analysisMap=new Map((analysisResult.data??[]).map((row:any)=>[String(row.match_id),row]));
  const sessionMap=new Map((sessionsResult.data??[]).map((row:any)=>[String(row.id),row]));
  const tasks=(tasksResult.data??[]).map((row:any)=>row.payload as ILPTask);
  const xpRows=xpResult.data??[];
  const snapshots=new Map<string,{count:number;max:number}>();
  for(const row of snapshotsResult.data??[]){
    const id=String((row as any).session_id),time=Number((row as any).game_time)||0;
    const current=snapshots.get(id)??{count:0,max:0};
    current.count+=1;current.max=Math.max(current.max,time);snapshots.set(id,current);
  }

  const games:ValidationGame[]=matches.map((row:any)=>{
    const id=String(row.id),metric=metricMap.get(id),analysisRow=analysisMap.get(id);
    const liveSessionId=row.live_session_id?String(row.live_session_id):null;
    const session=liveSessionId?sessionMap.get(liveSessionId):null;
    const snap=liveSessionId?snapshots.get(liveSessionId):null;
    const mapped=toMatch(row,metric,analysisRow?.analysis);
    const relevantAttempts=tasks.flatMap(task=>{
      const attempt=(task.missionHistory??[]).find(rep=>rep.matchId===id);
      return attempt?[{task,attempt}]:[];
    });
    const missionResults:ValidationMissionResult[]=relevantAttempts.map(({task,attempt})=>{
      const grade=gradeMissionGame(task,mapped,currentRank);
      const xpForMission=xpRows
        .filter((tx:any)=>String(tx.match_id)===id&&String(tx.mission_id||'')===task.id)
        .reduce((sum:number,tx:any)=>sum+(Number(tx.xp)||0),0);
      return{
        missionId:task.id,title:task.title,metric:task.metric,
        source:missionMeasurementLabel(missionMeasurementSource(task.metric)),
        expectedPass:grade.available?grade.passed:null,recordedPass:Boolean(attempt.clearedBar),
        banked:Boolean(attempt.banksPass),xp:xpForMission,
        consistent:grade.available?grade.passed===Boolean(attempt.clearedBar):!attempt.banksPass,
      };
    });
    const sourceCoverage=Array.from(new Set(missionResults.map(result=>result.source)));
    const enrichment=String((session?.summary as any)?.riotEnrichment?.status||(row.external_match_id?'COMPLETE':'MISSING'));
    const planSync=String((session?.summary as any)?.learningPlanSync?.status||(missionResults.length?'COMPLETE':'MISSING'));
    const isLive=Boolean(liveSessionId)||String(row.source).toLowerCase().includes('live');
    const duration=Math.max(1,Number(row.duration_seconds)||1);
    const stages:ValidationStage[]=[
      stage('detected','Game detected',true,'Completed match exists in OP CLIMB.'),
      accountRoleStage(row,account),
      isLive
        ?stage('telemetry','Telemetry healthy',Boolean(snap&&snap.count>=10&&snap.max>=duration*.75),snap?(String(snap.count)+' snapshots · final '+String(Math.round(snap.max/60))+'m'):'No live snapshots found.')
        :na('telemetry','Telemetry healthy','Not a Companion/live-tracked match.'),
      isLive
        ?stage('closed','Game closed',Boolean(session&&String(session.status)==='COMPLETE'&&session.ended_at),session?(String(session.status)+' · '+(session.ended_at?'ended cleanly':'missing ended_at')):'Live session missing.')
        :na('closed','Game closed','Not a Companion/live-tracked match.'),
      isLive
        ?stage('riot','Riot enrichment',enrichment==='COMPLETE','Riot enrichment: '+enrichment+(row.external_match_id?' · Match V5 linked':''),enrichment==='DISABLED'||enrichment==='NO_MATCH'?'WARN':'FAIL')
        :stage('riot','Riot enrichment',Boolean(row.external_match_id),row.external_match_id?'Riot Match V5 ID attached.':'No Riot Match V5 ID attached.','WARN'),
      stage('mission','Mission evidence',missionResults.length>0&&missionResults.every(item=>item.consistent),missionResults.length?(String(missionResults.length)+' mission result'+(missionResults.length===1?'':'s')+' agree with the central grader.'):'No mission rep linked to this match.','WARN'),
      rankStage(missionResults,currentRank),
      xpStage(missionResults,xpRows,id),
      isLive
        ?stage('plan','ILP sync',planSync==='COMPLETE','Learning-plan sync: '+planSync+'.',planSync==='SKIPPED'?'WARN':'FAIL')
        :stage('plan','ILP sync',missionResults.length>0,missionResults.length?'Mission state exists for this imported match.':'No mission state linked yet.','WARN'),
      stage('surfaces','Shared UI state',missionResults.length>0&&missionResults.every(item=>item.consistent),'Home, Progress, Analyse and Companion read the same persisted match/ILP evidence.','WARN'),
    ];
    return{
      matchId:id,externalMatchId:row.external_match_id?String(row.external_match_id):null,
      champion:String(row.champion||'Unknown'),role:String(row.role||'UNKNOWN'),result:String(row.result||'UNKNOWN'),
      rank:String(row.rank||currentRank),source:String(row.source||'unknown'),
      occurredAt:String(row.occurred_at||row.created_at),liveSessionId,
      snapshotCount:snap?.count??0,maxGameTime:snap?.max??null,enrichmentStatus:enrichment,
      learningPlanStatus:planSync,stages,missionResults,sourceCoverage,overall:overallStatus(stages),
    };
  });

  const coverage={live:0,riot:0,decision:0};
  for(const game of games){
    if(game.sourceCoverage.includes('LIVE MEASURABLE'))coverage.live+=1;
    if(game.sourceCoverage.includes('RIOT POST-GAME'))coverage.riot+=1;
    if(game.sourceCoverage.includes('DECISION EVIDENCE'))coverage.decision+=1;
  }
  return{
    account:{
      id:accountId,gameName:String(account.game_name||'Player'),
      tagline:'#'+String(account.tagline||'').replace(/^#/,''),
      rank:currentRank,rankBand:missionRankBand(currentRank),
      verificationStatus:String(account.verification_status||'UNKNOWN'),
    },
    summary:{
      games:games.length,
      liveGames:games.filter(game=>Boolean(game.liveSessionId)||game.source.toLowerCase().includes('live')).length,
      passed:games.filter(game=>game.overall==='PASS').length,
      warnings:games.filter(game=>game.overall==='WARN').length,
      failed:games.filter(game=>game.overall==='FAIL').length,
      coverage,
    },
    games,
  };
}

function toMatch(row:any,metric:any,proAnalysis:any):Match{
  const raw=metric?.raw&&typeof metric.raw==='object'?metric.raw:{};
  const rawMetrics=raw.metrics&&typeof raw.metrics==='object'?raw.metrics:{};
  const num=(...values:any[])=>{for(const value of values){const n=Number(value);if(value!==null&&value!==undefined&&Number.isFinite(n))return n}return undefined};
  return{
    id:String(row.id),riotAccountId:String(row.riot_account_id||''),champion:String(row.champion||'Unknown'),
    role:(['TOP','JUNGLE','MID','ADC','SUPPORT'].includes(String(row.role).toUpperCase())?String(row.role).toUpperCase():'ADC') as Role,
    result:row.result==='WIN'?'WIN':'LOSS',kills:Number(row.kills)||0,deaths:Number(row.deaths)||0,assists:Number(row.assists)||0,
    durationSeconds:Number(row.duration_seconds)||1,rank:String(row.rank||''),
    source:String(row.source||'manual').toLowerCase() as Match['source'],
    createdAt:String(row.occurred_at||row.created_at||new Date().toISOString()),
    metrics:{
      cs:num(metric?.cs,rawMetrics.cs)??0,csPerMin:num(metric?.cs_per_min,rawMetrics.csPerMin)??0,deaths:Number(row.deaths)||0,
      goldPerMin:num(metric?.gold_per_min,rawMetrics.goldPerMin),damagePerMin:num(metric?.damage_per_min,rawMetrics.damagePerMin),
      damageShare:num(metric?.damage_share,rawMetrics.damageShare),killParticipation:num(metric?.kill_participation,rawMetrics.killParticipation),
      visionScore:num(metric?.vision_score,rawMetrics.visionScore),objectiveParticipation:num(metric?.objective_participation,rawMetrics.objectiveParticipation),
      laneCsPerMin:num(metric?.lane_cs_per_min,rawMetrics.laneCsPerMin),post15CsPerMin:num(metric?.post15_cs_per_min,metric?.farm_after_15,rawMetrics.post15CsPerMin),
      csAt10:num(metric?.cs_at_10,rawMetrics.csAt10),csAt15:num(metric?.cs_at_15,rawMetrics.csAt15),
      goldDiffAt15:num(metric?.gold_diff_at_15,rawMetrics.goldDiffAt15),xpDiffAt15:num(metric?.xp_diff_at_15,rawMetrics.xpDiffAt15),
      deathsPre10:num(metric?.deaths_pre_10,rawMetrics.deathsPre10),deaths10to20:num(metric?.deaths_10_to_20,rawMetrics.deaths10to20),
      deathsPost20:num(metric?.deaths_post_20,rawMetrics.deathsPost20),soloDeaths:num(metric?.solo_deaths,rawMetrics.soloDeaths),
      teamfightDeaths:num(metric?.teamfight_deaths,rawMetrics.teamfightDeaths),firstItemMinute:num(metric?.first_item_minute,rawMetrics.firstItemMinute),
      secondItemMinute:num(metric?.second_item_minute,rawMetrics.secondItemMinute),thirdItemMinute:num(metric?.third_item_minute,rawMetrics.thirdItemMinute),
    },
    proAnalysis:proAnalysis&&typeof proAnalysis==='object'?proAnalysis:undefined,
  };
}

function accountRoleStage(row:any,account:any):ValidationStage{
  const roleOk=['TOP','JUNGLE','MID','ADC','SUPPORT'].includes(String(row.role||'').toUpperCase());
  const verification=String(account.verification_status||'UNKNOWN').toUpperCase();
  if(verification.includes('MISMATCH'))return{key:'identity',label:'Correct player / role',status:'FAIL',detail:'Live Riot identity mismatch was recorded for this linked account.'};
  if(!roleOk)return{key:'identity',label:'Correct player / role',status:'FAIL',detail:'Invalid or unknown role: '+String(row.role||'UNKNOWN')+'.'};
  return{key:'identity',label:'Correct player / role',status:verification.includes('VERIFIED')?'PASS':'WARN',detail:'Linked account · '+String(row.role)+' · identity '+verification+'.'};
}
function rankStage(results:ValidationMissionResult[],rank:string):ValidationStage{
  if(!results.length)return{key:'rank',label:'Correct rank bar',status:'WARN',detail:missionRankBand(rank)+' benchmark available, but no mission result is linked to this game.'};
  return{key:'rank',label:'Correct rank bar',status:results.every(item=>item.consistent)?'PASS':'FAIL',detail:'Central '+missionRankBand(rank)+' grader agrees with '+String(results.filter(item=>item.consistent).length)+'/'+String(results.length)+' recorded mission results.'};
}
function xpStage(results:ValidationMissionResult[],rows:any[],matchId:string):ValidationStage{
  const actual=rows.filter((row:any)=>String(row.match_id)===matchId&&row.kind==='MISSION_REP');
  const keys=actual.map((row:any)=>String(row.transaction_key));
  if(new Set(keys).size!==keys.length)return{key:'xp',label:'XP banks once',status:'FAIL',detail:'Duplicate XP transaction keys detected.'};
  const expected=results.filter(item=>item.banked).length;
  if(expected===0&&actual.length===0)return{key:'xp',label:'XP banks once',status:'PASS',detail:'No proven rep, so no rep XP was awarded.'};
  if(actual.length!==expected)return{key:'xp',label:'XP banks once',status:'FAIL',detail:'Expected '+String(expected)+' rep XP transaction'+(expected===1?'':'s')+', found '+String(actual.length)+'.'};
  return{key:'xp',label:'XP banks once',status:'PASS',detail:String(actual.length)+' proven rep'+(actual.length===1?'':'s')+' · one unique XP transaction each.'};
}
function stage(key:string,label:string,pass:boolean,detail:string,miss:Status='FAIL'):ValidationStage{return{key,label,status:pass?'PASS':miss,detail}}
function na(key:string,label:string,detail:string):ValidationStage{return{key,label,status:'NA',detail}}
function overallStatus(stages:ValidationStage[]):Status{
  if(stages.some(stage=>stage.status==='FAIL'))return'FAIL';
  if(stages.some(stage=>stage.status==='WARN'))return'WARN';
  return'PASS';
}
