import {analyseMatch} from './engine';
import type {Match} from './types';

export interface PublicPreviewInsight{
  label:string;
  value:string;
  detail:string;
  tone:'GOOD'|'WATCH'|'NEUTRAL';
}

export interface PublicPreviewReport{
  gamesAnalyzed:number;
  rank:string;
  primaryRole:string;
  mainChampion:string;
  winRate:number;
  insights:PublicPreviewInsight[];
  focus:{
    title:string;
    category:string;
    detail:string;
    rule:string;
    evidence:string;
  };
  trend:string;
}

const avg=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const pct=(value:number)=>Math.round(value*100);
const round=(value:number,digits=1)=>Number(value.toFixed(digits));

function mostCommon(values:string[],fallback:string){
  if(!values.length)return fallback;
  const counts=new Map<string,number>();
  for(const value of values)counts.set(value,(counts.get(value)||0)+1);
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||fallback;
}

function ownTrend(matches:Match[]){
  if(matches.length<6)return 'More ranked games will make the trend clearer.';
  const recent=matches.slice(0,5);
  const older=matches.slice(5);
  const recentEarly=recent.filter(m=>(m.metrics.deathsPre10??0)>0).length/recent.length;
  const olderEarly=older.filter(m=>(m.metrics.deathsPre10??0)>0).length/older.length;
  if(recentEarly<=olderEarly-.15)return 'Your last five games show fewer early-death games than your earlier sample.';
  if(recentEarly>=olderEarly+.15)return 'Your last five games show more early-death games than your earlier sample.';
  const recentCs=recent.map(m=>m.metrics.csAt10).filter((v):v is number=>typeof v==='number');
  const olderCs=older.map(m=>m.metrics.csAt10).filter((v):v is number=>typeof v==='number');
  if(recentCs.length>=3&&olderCs.length>=3){
    const delta=avg(recentCs)-avg(olderCs);
    if(delta>=5)return `Your CS@10 is up about ${Math.round(delta)} in the last five games versus your earlier sample.`;
    if(delta<=-5)return `Your CS@10 is down about ${Math.abs(Math.round(delta))} in the last five games versus your earlier sample.`;
  }
  return 'Your latest five games are broadly stable against your own earlier baseline.';
}

export function buildPublicPreview(matchesInput:Match[],rankLabel:string):PublicPreviewReport{
  const matches=[...matchesInput].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
  if(!matches.length)throw new Error('No ranked matches were available for this Riot ID.');

  const games=matches.length;
  const wins=matches.filter(m=>m.result==='WIN').length;
  const primaryRole=mostCommon(matches.map(m=>m.role),'UNKNOWN');
  const mainChampion=mostCommon(matches.map(m=>m.champion),'Unknown');
  const cs10=matches.map(m=>m.metrics.csAt10).filter((v):v is number=>typeof v==='number');
  const earlyDeathGames=matches.filter(m=>(m.metrics.deathsPre10??0)>0).length;
  const deaths=matches.map(m=>m.deaths);
  const post15=matches.map(m=>m.metrics.post15CsPerMin).filter((v):v is number=>typeof v==='number');
  const lane=matches.map(m=>m.metrics.laneCsPerMin).filter((v):v is number=>typeof v==='number');

  const analyses=matches.map((match,index)=>analyseMatch(match,matches.slice(index+1,index+6)));
  const categoryCounts=new Map<string,number>();
  for(const report of analyses)categoryCounts.set(report.primary.category,(categoryCounts.get(report.primary.category)||0)+1);
  const primaryCategory=[...categoryCounts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||analyses[0].primary.category;
  const focusReport=analyses.find(report=>report.primary.category===primaryCategory)||analyses[0];
  const occurrence=categoryCounts.get(primaryCategory)||1;

  const insights:PublicPreviewInsight[]=[];
  if(cs10.length){
    const value=round(avg(cs10),1);
    insights.push({
      label:'YOUR CS @ 10',
      value:String(value),
      detail:`Average across ${cs10.length} recent ranked game${cs10.length===1?'':'s'} with timeline data. This is your own baseline, not an external rank benchmark.`,
      tone:value>=70?'GOOD':value<55?'WATCH':'NEUTRAL',
    });
  }
  const earlyRate=earlyDeathGames/games;
  insights.push({
    label:'GAMES WITH A DEATH BEFORE 10',
    value:`${pct(earlyRate)}%`,
    detail:`${earlyDeathGames} of ${games} analysed ranked games contained at least one death before 10:00.`,
    tone:earlyRate<=.2?'GOOD':earlyRate>=.45?'WATCH':'NEUTRAL',
  });
  insights.push({
    label:'AVERAGE DEATHS',
    value:round(avg(deaths),1).toFixed(1),
    detail:`Across the same ${games}-game sample. OP CLIMB uses the timeline to care about when those deaths happened, not just the KDA total.`,
    tone:avg(deaths)<=4?'GOOD':avg(deaths)>=6?'WATCH':'NEUTRAL',
  });
  if(post15.length&&lane.length){
    const post=avg(post15),lanePace=avg(lane);
    insights.push({
      label:'POST-15 FARM PACE',
      value:`${round(post,1)} CS/MIN`,
      detail:`Lane pace: ${round(lanePace,1)} CS/min. The gap helps separate last-hitting from post-lane resource access.`,
      tone:post>=lanePace-.4?'GOOD':post<=lanePace-1?'WATCH':'NEUTRAL',
    });
  }

  return {
    gamesAnalyzed:games,
    rank:rankLabel||matches[0].rank||'UNRANKED',
    primaryRole,
    mainChampion,
    winRate:pct(wins/games),
    insights:insights.slice(0,3),
    focus:{
      title:focusReport.mission.title,
      category:focusReport.primary.category,
      detail:focusReport.primary.inference,
      rule:focusReport.primary.suggestion,
      evidence:`${primaryCategory.replaceAll('_',' ')} was the top coaching category in ${occurrence} of ${games} analysed games.`,
    },
    trend:ownTrend(matches),
  };
}
