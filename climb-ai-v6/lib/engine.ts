import {AnalysisReport,Match,Mission,Signal} from './types';

const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const n=(v:number|undefined,d=1)=>typeof v==='number'?v.toFixed(d):'Unavailable';

/**
 * Deterministic first-match analysis.
 *
 * A brand-new player has no historical baseline. Treating that missing history
 * as zero made the first game look like a catastrophic farming game regardless
 * of what actually happened. The current match is therefore the baseline until
 * OP CLIMB has previous games to compare it with.
 */
export function analyseMatch(match:Match,recent:Match[]):AnalysisReport{
  const last5=recent.slice(0,5);
  const post=match.metrics.post15CsPerMin??match.metrics.csPerMin;
  const historicalPost=last5.map(m=>m.metrics.post15CsPerMin??m.metrics.csPerMin);
  const recentPost=historicalPost.length?avg(historicalPost):post;
  const recentDeaths=last5.length?avg(last5.map(m=>m.deaths)):match.deaths;

  const farmingSeverity=Math.max(0,Math.min(1,(6.0-Math.min(post,recentPost))/2.1));
  const deathSeverity=Math.max(0,Math.min(1,(Math.max(match.deaths,recentDeaths)-4)/5));

  let primary:Signal;
  let mission:Mission;

  if(farmingSeverity>=deathSeverity){
    primary={
      category:'RESOURCE_COLLECTION',
      severity:+farmingSeverity.toFixed(2),
      confidence:last5.length>=3?.86:last5.length?.72:.62,
      facts:[
        `Lane pace: ${n(match.metrics.laneCsPerMin)} CS/min; post-15 pace: ${n(match.metrics.post15CsPerMin)} CS/min.`,
        `CS@10 ${match.metrics.csAt10??'Unavailable'} · CS@15 ${match.metrics.csAt15??'Unavailable'} · full-game ${match.metrics.csPerMin.toFixed(1)} CS/min.`,
        last5.length?`Previous tracked post-15 baseline: ${recentPost.toFixed(1)} CS/min.`:'First tracked game — no multi-game economy baseline yet.',
      ],
      inference:last5.length
        ?'Your lane economy is healthier than your post-lane collection. That pattern points to lane assignment / resource access after the first towers fall, not simply last-hitting mechanics.'
        :'This first game gives OP CLIMB an economy baseline. The next games will show whether resource collection is a recurring leak or just one result.',
      suggestion:'Treat each post-15 recall as a lane-assignment decision. Before defaulting mid, identify the next safe wave, objective timer and the enemy engage threats that could punish the route.',
    };
    mission={
      id:`m-${match.riotAccountId}-economy`,riotAccountId:match.riotAccountId,
      category:'RESOURCE_COLLECTION',title:'POST-LANE ECONOMY',metric:'post15CsPerMin',target:6.0,unit:'post-15 CS/min',
      gamesRequired:3,gamesCompleted:0,successfulGames:0,
      rules:[
        'On every recall after 15:00: check objective timer first, then identify the safest wave you can catch.',
        'If Dragon, Herald or Baron is more than 60 seconds away, do not sacrifice guaranteed safe gold just to stand mid.',
        'Do not side-lane past safe territory unless you can account for the enemy champions that can engage or collapse on you.',
      ],
      status:'DISCOVER',createdAt:new Date().toISOString(),
    };
  }else{
    primary={
      category:'DEATHS',
      severity:+deathSeverity.toFixed(2),
      confidence:last5.length>=3?.82:last5.length?.70:.60,
      facts:[
        `Deaths: ${match.deaths}${last5.length?`; previous tracked average: ${recentDeaths.toFixed(1)}`:' · first tracked game, so there is no death baseline yet.'}`,
        `Death split: pre-10 ${match.metrics.deathsPre10??'Unavailable'} · 10–20 ${match.metrics.deaths10to20??'Unavailable'} · post-20 ${match.metrics.deathsPost20??'Unavailable'}.`,
        `Teamfight deaths: ${match.metrics.teamfightDeaths??'Unavailable'} · solo deaths: ${match.metrics.soloDeaths??'Unavailable'}.`,
      ],
      inference:last5.length
        ?'The cost is not just KDA. Late deaths remove your uptime during objective setup and can surrender Baron, Soul or Elder windows even when your damage output is otherwise adequate.'
        :'This first game gives OP CLIMB a survival baseline. More timeline evidence is needed before it can claim exactly where the deaths came from.',
      suggestion:'Before every post-20 fight, identify the primary hard-engage or burst threat and position outside that champion’s reliable threat range until it commits.',
    };
    mission={
      id:`m-${match.riotAccountId}-survival`,riotAccountId:match.riotAccountId,
      category:'DEATHS',title:'LATE-FIGHT SURVIVAL',metric:'deathsPost20',target:1,unit:'post-20 death or fewer',
      gamesRequired:3,gamesCompleted:0,successfulGames:0,
      rules:[
        'Before objective setup, name the enemy spell or champion that can start the fight on you.',
        'Do not walk into fog first; arrive behind your frontline or with information.',
        'Hold Flash or your defensive summoner for the threat that actually reaches you, not incidental poke.',
      ],
      status:'DISCOVER',createdAt:new Date().toISOString(),
    };
  }

  const good=[
    match.metrics.goldDiffAt15!==undefined&&match.metrics.goldDiffAt15>0
      ?`You exited lane +${match.metrics.goldDiffAt15} gold at 15 versus your lane opponent.`
      :'You now have a clear lane benchmark to compare against.',
    (match.metrics.killParticipation||0)>=.6
      ?`You were involved in ${Math.round((match.metrics.killParticipation||0)*100)}% of team takedowns.`
      :'OP CLIMB has a first-game involvement baseline without overstating impact.',
    match.metrics.firstItemMinute
      ?`First completed item at ${match.metrics.firstItemMinute.toFixed(1)} minutes gives us a real economy breakpoint to track.`
      :'Item timing is unavailable for this source.',
  ].slice(0,3);

  return {
    matchId:match.id,
    performance:Math.max(1,Math.min(10,+((match.result==='WIN'?1:0)+5.2+(match.metrics.csPerMin-5.5)*.5-(match.deaths-5)*.17).toFixed(1))),
    good,primary,mission,
    summary:`${primary.category==='RESOURCE_COLLECTION'?'Post-lane economy':'Late-fight survival'} is the highest-priority signal in this sample. Keep the same mission for three relevant games so OP CLIMB can tell improvement from one-game variance.`,
  };
}

export function missionResult(mission:Mission,match:Match){
  let value=0;
  if(mission.metric==='deathsPost20')value=match.metrics.deathsPost20??match.deaths;
  else if(mission.metric==='post15CsPerMin')value=match.metrics.post15CsPerMin??match.metrics.csPerMin;
  else value=match.metrics.csPerMin;
  const pass=mission.metric==='deathsPost20'?value<=mission.target:value>=mission.target;
  return {value,pass};
}

export function climbScore(matches:Match[]){
  if(!matches.length)return 0;
  const last=matches.slice(0,10);
  const cs=Math.min(100,avg(last.map(m=>m.metrics.csPerMin))/7.3*100);
  const deaths=Math.max(0,100-(avg(last.map(m=>m.deaths))-2)*12);
  const kp=Math.min(100,avg(last.map(m=>(m.metrics.killParticipation||.5)*100))*1.25);
  const consistency=Math.max(0,100-(Math.max(...last.map(m=>m.metrics.csPerMin))-Math.min(...last.map(m=>m.metrics.csPerMin)))*16);
  return Math.round(cs*.30+deaths*.26+kp*.18+consistency*.26);
}
