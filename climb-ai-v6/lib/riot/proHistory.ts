import type {CoachingMetricKey} from '../subscription';
import type {ProMatchAnalysis,ProSeverity} from './proAnalysis';

export type ProTrend='IMPROVING'|'STABLE'|'WORSENING'|'BUILDING';
export type ProFixStage='QUICK WIN'|'CONTROL'|'DISCIPLINE'|'ADVANCED'|'MASTERY';

export interface ProMetricRollup{
  key:CoachingMetricKey;
  label:string;
  averageScore:number|null;
  availableGames:number;
  trend:ProTrend;
  recentValue:string;
}

export interface ProHistoryFix{
  key:string;
  stage:ProFixStage;
  severity:ProSeverity;
  title:string;
  gamesSeen:number;
  occurrences:number;
  why:string;
  rule:string;
  mastery:string;
}

export interface ProChampionProfile{
  champion:string;
  games:number;
  identityScore:number|null;
  topLeak:string|null;
  trend:ProTrend;
}

export interface ProHistoryFingerprint{
  primary:string;
  gamesSeen:number;
  patternRate:number;
  trend:ProTrend;
  sequence:string[];
  explanation:string;
}

export interface ProLearningProfile{
  version:1;
  gamesAnalyzed:number;
  fingerprint:ProHistoryFingerprint;
  metricRollups:Partial<Record<CoachingMetricKey,ProMetricRollup>>;
  fixLadder:ProHistoryFix[];
  championProfiles:Record<string,ProChampionProfile>;
  opLeakRate:{occurrencesPerGame:number;cleanScore:number;trend:ProTrend};
  recovery:{score:number|null;trend:ProTrend;availableGames:number};
  latestAnalysisAt:string|null;
}

export interface HistoryAnalysisRow{
  champion:string;
  role:string|null;
  createdAt:string;
  analysis:ProMatchAnalysis;
}

const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));

export function buildProLearningProfile(rows:HistoryAnalysisRow[]):ProLearningProfile{
  const ordered=[...rows].sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime());
  const games=ordered.length;
  const metricRollups:Partial<Record<CoachingMetricKey,ProMetricRollup>>={};
  const keys=new Set<CoachingMetricKey>();
  for(const row of ordered)for(const key of Object.keys(row.analysis.metrics) as CoachingMetricKey[])keys.add(key);
  for(const key of keys){
    const samples=ordered.map(r=>r.analysis.metrics[key]).filter(Boolean);
    const scored=samples.filter(m=>typeof m!.score==='number');
    const scores=scored.map(m=>m!.score as number);
    const label=samples[samples.length-1]?.label??key.toUpperCase();
    metricRollups[key]={
      key,label,
      averageScore:scores.length?clamp(scores.reduce((a,b)=>a+b,0)/scores.length):null,
      availableGames:scores.length,
      trend:scoreTrend(scores),
      recentValue:samples[samples.length-1]?.value??'Building history',
    };
  }

  const leakMap=new Map<string,{label:string;games:Set<number>;count:number;sequence:string[]}>();
  ordered.forEach((row,index)=>{
    for(const leak of row.analysis.leakSignals){
      const current=leakMap.get(leak.key)??{label:leak.label,games:new Set<number>(),count:0,sequence:row.analysis.fingerprint.sequence};
      current.games.add(index);current.count+=leak.count;if(!current.sequence.length)current.sequence=row.analysis.fingerprint.sequence;
      leakMap.set(leak.key,current);
    }
  });
  const fixLadder=[...leakMap.entries()]
    .map(([key,value])=>historyFix(key,value.label,value.games.size,value.count,games))
    .sort((a,b)=>stageRank(a.stage)-stageRank(b.stage)||severityRank(b.severity)-severityRank(a.severity)||b.gamesSeen-a.gamesSeen)
    .slice(0,5);

  const primaryCounts=new Map<string,{count:number;sequence:string[]}>();
  for(const row of ordered){
    const key=row.analysis.fingerprint.primary;
    const current=primaryCounts.get(key)??{count:0,sequence:row.analysis.fingerprint.sequence};
    current.count++;primaryCounts.set(key,current);
  }
  const primary=[...primaryCounts.entries()].sort((a,b)=>b[1].count-a[1].count)[0];
  const fingerprintTrend=primary?patternTrend(ordered,primary[0]):'BUILDING';
  const fingerprint:ProHistoryFingerprint=primary?{
    primary:primary[0],gamesSeen:primary[1].count,patternRate:games?Math.round(primary[1].count/games*100):0,trend:fingerprintTrend,
    sequence:primary[1].sequence,
    explanation:`${primary[0]} was the most common decision fingerprint in ${primary[1].count} of ${games} analysed game${games===1?'':'s'}. ${trendSentence(fingerprintTrend)}`,
  }:{primary:'BUILDING PROFILE',gamesSeen:0,patternRate:0,trend:'BUILDING',sequence:[],explanation:'Complete more tracked games to establish a repeated decision fingerprint.'};

  const championGroups=new Map<string,HistoryAnalysisRow[]>();
  for(const row of ordered)championGroups.set(row.champion,[...(championGroups.get(row.champion)||[]),row]);
  const championProfiles:Record<string,ProChampionProfile>={};
  for(const [champion,group] of championGroups){
    const identityScores=group.map(r=>r.analysis.metrics.champion_identity?.score).filter((n):n is number=>typeof n==='number');
    const leakCounts=new Map<string,number>();
    for(const row of group)for(const leak of row.analysis.leakSignals)leakCounts.set(leak.label,(leakCounts.get(leak.label)||0)+leak.count);
    const topLeak=[...leakCounts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]??null;
    championProfiles[champion]={champion,games:group.length,identityScore:identityScores.length?clamp(identityScores.reduce((a,b)=>a+b,0)/identityScores.length):null,topLeak,trend:scoreTrend(identityScores)};
  }

  const totalLeaks=ordered.reduce((sum,row)=>sum+row.analysis.leakSignals.reduce((s,l)=>s+l.count,0),0);
  const leakPerGame=games?Number((totalLeaks/games).toFixed(2)):0;
  const leakSeries=ordered.map(row=>row.analysis.leakSignals.reduce((s,l)=>s+l.count,0));
  const leakTrend=inverseTrend(leakSeries);
  const recoveryScores=ordered.map(r=>r.analysis.metrics.historical_recovery?.score).filter((n):n is number=>typeof n==='number');

  // Add history-only rollups into the same metric catalogue the subscription UI already understands.
  metricRollups.historical_leak_rate={key:'historical_leak_rate',label:'OP LEAK RATE',averageScore:clamp(100-leakPerGame*14),availableGames:games,trend:leakTrend,recentValue:`${leakPerGame} leaks/game`};
  metricRollups.historical_recovery={key:'historical_recovery',label:'RECOVERY SCORE',averageScore:recoveryScores.length?clamp(recoveryScores.reduce((a,b)=>a+b,0)/recoveryScores.length):null,availableGames:recoveryScores.length,trend:scoreTrend(recoveryScores),recentValue:recoveryScores.length?`${clamp(recoveryScores[recoveryScores.length-1])}/100`:'Building history'};
  metricRollups.decision_fingerprint={key:'decision_fingerprint',label:'DECISION FINGERPRINT',averageScore:null,availableGames:games,trend:fingerprintTrend,recentValue:fingerprint.primary};

  return {
    version:1,gamesAnalyzed:games,fingerprint,metricRollups,fixLadder,championProfiles,
    opLeakRate:{occurrencesPerGame:leakPerGame,cleanScore:clamp(100-leakPerGame*14),trend:leakTrend},
    recovery:{score:recoveryScores.length?clamp(recoveryScores.reduce((a,b)=>a+b,0)/recoveryScores.length):null,trend:scoreTrend(recoveryScores),availableGames:recoveryScores.length},
    latestAnalysisAt:ordered[ordered.length-1]?.createdAt??null,
  };
}

function historyFix(key:string,label:string,gamesSeen:number,occurrences:number,totalGames:number):ProHistoryFix{
  const frequency=totalGames?gamesSeen/totalGames:0;
  const severity:ProSeverity=frequency>=.6||occurrences>=6?'CRITICAL':frequency>=.4||occurrences>=4?'MAJOR':frequency>=.2||occurrences>=2?'ACTIVE':'POLISH';
  const map:Record<string,{stage:ProFixStage;title:string;why:string;rule:string;mastery:string}>={
    BANKING_LEAK:{stage:'QUICK WIN',title:'Spend before voluntary fights',why:'Repeated deaths with a large bank mean earned gold never became combat power.',rule:'Before a voluntary fight, check whether you can complete a meaningful purchase and reset first.',mastery:'3 completed games with no reviewed death while carrying 1200g+.'},
    RED_STATE:{stage:'CONTROL',title:'Stop accepting red-state fights',why:'You repeatedly entered fights after the visible state had already turned against you.',rule:'If level/item state is red, add numbers, setup or first damage before committing.',mastery:'3 games with zero deaths from clearly enemy-favoured visible states.'},
    CHAIN_DEATH:{stage:'CONTROL',title:'Break the second death',why:'The recovery window after a death is being lost to another immediate contest.',rule:'After dying: collect safe resources, rebuild information, then re-enter.',mastery:'3 games with no second death inside 90 seconds.'},
    LEAD_THROW:{stage:'DISCIPLINE',title:'Protect the advantage',why:'You create winning states but sometimes expose them before they are converted.',rule:'When ahead, force the enemy to enter your threat rather than turning the lead into an uncontrolled chase.',mastery:'3 games with zero reviewed deaths from a clearly stronger state.'},
    CARRY_DEATH:{stage:'ADVANCED',title:'Preserve carry uptime',why:'Deaths while holding top team economy remove disproportionate damage and objective pressure.',rule:'If you are one of the top two team carries, survival takes priority over reaching a lower-value target.',mastery:'3 games with no high-value death before a major objective or decisive fight.'},
  };
  const copy=map[key]??{stage:'MASTERY' as ProFixStage,title:label,why:'This pattern has repeated across tracked games.',rule:'Open the evidence timestamps and define the repeatable decision that removes it.',mastery:'Show improvement across 3 consecutive completed games.'};
  return{key,stage:copy.stage,severity,title:copy.title,gamesSeen,occurrences,why:copy.why,rule:copy.rule,mastery:copy.mastery};
}

function stageRank(stage:ProFixStage){return{'QUICK WIN':1,'CONTROL':2,'DISCIPLINE':3,'ADVANCED':4,'MASTERY':5}[stage]}
function severityRank(s:ProSeverity){return{CRITICAL:4,MAJOR:3,ACTIVE:2,POLISH:1}[s]}

function scoreTrend(values:number[]):ProTrend{
  if(values.length<3)return'BUILDING';
  const split=Math.max(1,Math.floor(values.length/2));
  const old=avg(values.slice(0,split)),recent=avg(values.slice(split));
  if(recent-old>=6)return'IMPROVING';
  if(old-recent>=6)return'WORSENING';
  return'STABLE';
}
function inverseTrend(values:number[]):ProTrend{
  const trend=scoreTrend(values.map(v=>100-v*10));
  return trend;
}
function patternTrend(rows:HistoryAnalysisRow[],primary:string):ProTrend{
  if(rows.length<4)return'BUILDING';
  const split=Math.floor(rows.length/2);
  const old=rows.slice(0,split),recent=rows.slice(split);
  const rate=(group:HistoryAnalysisRow[])=>group.length?group.filter(r=>r.analysis.fingerprint.primary===primary).length/group.length:0;
  const delta=rate(recent)-rate(old);
  if(delta<=-.2)return'IMPROVING';
  if(delta>=.2)return'WORSENING';
  return'STABLE';
}
function avg(values:number[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0}
function trendSentence(t:ProTrend){return t==='IMPROVING'?'The pattern is appearing less often recently.':t==='WORSENING'?'The pattern is becoming more frequent recently.':t==='STABLE'?'Its frequency is currently stable.':'More games are needed for a reliable trend.'}
