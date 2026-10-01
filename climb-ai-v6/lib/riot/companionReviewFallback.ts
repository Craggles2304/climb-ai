import type {RiotMatchDetails} from '@/lib/services/riotService';

export function riotCompanionReview(matchId:string,details:RiotMatchDetails,coachLevel:unknown){
  const match=details.match;
  const minutes=Math.max(match.durationSeconds/60,1/60);
  const cs=match.metrics.cs;
  const reviewMatch={
    champion:match.champion,role:match.role,durationSeconds:match.durationSeconds,
    kda:`${match.kills} / ${match.deaths} / ${match.assists}`,
    csPerMin:Number.isFinite(cs)?Math.round(Number(cs)/minutes*10)/10:null,
  };
  const measured=Object.values(details.proAnalysis?.metrics??{})
    .filter(metric=>metric&&['MEASURED','DERIVED'].includes(metric.status)&&Number.isFinite(metric.score)&&metric.evidence.length>0);
  const ranked=[...measured].sort((a,b)=>Number(b.score)-Number(a.score));
  const strongest=ranked[0],weakest=[...ranked].reverse().find(metric=>metric.key!==strongest?.key);
  const good=strongest
    ?[{title:strongest.label,detail:strongest.summary,verified:true}]
    :[{title:'Riot match recorded',detail:'The match result is available, but no decision strength was verified from its timeline.',verified:false}];
  const critical=weakest&&Number(weakest.score)<70
    ?[{title:weakest.label,detail:weakest.summary,verified:true}]
    :[{title:'No decision leak verified',detail:'The available Riot evidence does not support naming a specific mistake.',verified:false}];
  const nextFocus=weakest&&Number(weakest.score)<70
    ?{title:weakest.label.toUpperCase(),rule:weakest.summary}
    :{title:'KEEP YOUR CURRENT MISSION',rule:'Build more observed evidence before changing your next-game focus.'};
  return{
    sessionId:`RIOT-${matchId}`,matchId,endedAt:match.createdAt,partial:true,source:'RIOT_MATCH',coachLevel,rankChange:null,
    match:reviewMatch,doneWell:good,improve:critical,good,critical,nextFocus,
    neutral:[{title:'Evidence source',detail:'Riot match and timeline. Local Companion recording was unavailable for this game.'}],
    evidenceCount:measured.length,reviewFormat:'RIOT_FALLBACK',
  };
}

export function isNewRecentRiotMatch(riotEndedAt:string,liveEndedAt:string|null,now=Date.now()){
  const riotTime=Date.parse(riotEndedAt),liveTime=liveEndedAt?Date.parse(liveEndedAt):NaN;
  return Number.isFinite(riotTime)&&riotTime<=now&&now-riotTime<=8*60*60_000
    &&(!Number.isFinite(liveTime)||riotTime>liveTime+2*60_000);
}
