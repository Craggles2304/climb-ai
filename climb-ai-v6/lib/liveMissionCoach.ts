import type {LiveTelemetryPlayer,LiveTelemetrySnapshot} from '@/lib/riot/liveTelemetry';
import type {ProLearningProfile,ProHistoryFix} from '@/lib/riot/proHistory';

export type LiveMissionTask={
  id?:string;
  title?:string;
  category?:string;
  gameRule?:string;
  target?:string;
  metric?:string;
  priority?:number;
  progress?:number;
};

export type LiveMissionTip={
  id:string;
  number:number;
  title:string;
  category:string;
  liveRead:string;
  cue:string;
  nextLevel:string;
  evidence:string;
  source:'LIVE'|'HISTORY'|'MISSION';
};

type Input={
  tasks:LiveMissionTask[];
  snapshot:LiveTelemetrySnapshot|null;
  history:ProLearningProfile|null;
  currentTier:string;
  depth:number;
};

const TIERS=['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'] as const;

export function buildLiveMissionTips(input:Input):LiveMissionTip[]{
  const nextTier=nextRankTier(input.currentTier);
  const view=liveView(input.snapshot);
  return input.tasks.slice(0,3).map((task,index)=>{
    const category=String(task.category||'CONSISTENCY').toUpperCase();
    const historyFix=matchingHistoryFix(task,input.history);
    return{
      id:String(task.id||`mission-${index+1}`),
      number:index+1,
      title:short(String(task.title||`Mission ${index+1}`),input.depth<=2?42:64),
      category:category.replaceAll('_',' '),
      liveRead:short(buildRead(category,view,historyFix,input.depth),input.depth<=2?68:input.depth<=5?92:125),
      cue:short(buildCue(category,task,view,historyFix),input.depth<=2?76:input.depth<=5?105:145),
      nextLevel:short(buildNextLevel(category,task,historyFix,nextTier,input.depth),input.depth<=2?72:input.depth<=5?100:140),
      evidence:short(buildEvidence(task,view,historyFix,input.history,input.depth),input.depth<=3?70:input.depth<=6?105:150),
      source:view?'LIVE':historyFix?'HISTORY':'MISSION',
    };
  });
}

export function nextRankTier(tier:string){
  const current=String(tier||'SILVER').toUpperCase();
  const index=TIERS.indexOf(current as typeof TIERS[number]);
  if(index<0)return'GOLD';
  return TIERS[Math.min(TIERS.length-1,index+1)];
}

type View={
  timeMin:number;
  me:LiveTelemetryPlayer;
  opponent:LiveTelemetryPlayer|null;
  csPerMin:number;
  kp:number|null;
  levelDelta:number|null;
  itemGoldDelta:number|null;
  currentGold:number;
  healthPct:number|null;
  recentDeath:boolean;
  teamEconomyRank:number;
};

function liveView(snapshot:LiveTelemetrySnapshot|null):View|null{
  if(!snapshot||snapshot.gameTime<=0)return null;
  const me=findMe(snapshot);if(!me)return null;
  const team=snapshot.players.filter(p=>p.team===me.team);
  const teamKills=Math.max(0,team.reduce((sum,p)=>sum+p.scores.kills,0));
  const kp=teamKills>0?Math.min(100,Math.round(((me.scores.kills+me.scores.assists)/teamKills)*100)):null;
  const economy=[...team].sort((a,b)=>b.itemGold-a.itemGold);
  const teamEconomyRank=Math.max(1,economy.findIndex(p=>samePlayer(p,me))+1);
  const opponent=findRoleOpponent(snapshot,me);
  const maxHealth=snapshot.active.stats.maxHealth;
  const health=snapshot.active.stats.currentHealth;
  const healthPct=typeof maxHealth==='number'&&maxHealth>0&&typeof health==='number'?Math.round(health/maxHealth*100):null;
  const recentDeath=snapshot.events.some(event=>{
    if(snapshot.gameTime-event.time>100||snapshot.gameTime-event.time<0)return false;
    const target=String(event.target||'').toLowerCase();
    const mine=[me.summonerName,me.riotId,me.championName].filter(Boolean).map(v=>String(v).toLowerCase());
    return /kill/i.test(event.name)&&mine.some(v=>target===v||target.includes(v));
  });
  const minutes=Math.max(snapshot.gameTime/60,1/60);
  return{
    timeMin:Number(minutes.toFixed(1)),me,opponent,
    csPerMin:Number((me.scores.creepScore/minutes).toFixed(1)),kp,
    levelDelta:opponent?me.level-opponent.level:null,
    itemGoldDelta:opponent?me.itemGold-opponent.itemGold:null,
    currentGold:Math.max(0,Math.round(snapshot.active.currentGold||0)),
    healthPct,recentDeath,teamEconomyRank,
  };
}

function findMe(snapshot:LiveTelemetrySnapshot){
  const active=snapshot.active;
  return snapshot.players.find(p=>active.riotId&&p.riotId===active.riotId)
    ??snapshot.players.find(p=>active.summonerName&&p.summonerName===active.summonerName)
    ??snapshot.players.find(p=>active.championName&&p.championName===active.championName)
    ??null;
}

function samePlayer(a:LiveTelemetryPlayer,b:LiveTelemetryPlayer){
  if(a.riotId&&b.riotId)return a.riotId===b.riotId;
  if(a.summonerName&&b.summonerName)return a.summonerName===b.summonerName;
  return a.championName===b.championName;
}

function findRoleOpponent(snapshot:LiveTelemetrySnapshot,me:LiveTelemetryPlayer){
  const role=normaliseRole(me.position||snapshot.active.position);
  if(!role)return null;
  return snapshot.players.find(p=>p.team!==me.team&&normaliseRole(p.position)===role)??null;
}

function buildRead(category:string,view:View|null,fix:ProHistoryFix|null,depth:number){
  if(!view){
    if(fix)return`History: ${fix.occurrences} repeat${fix.occurrences===1?'':'s'} across ${fix.gamesSeen} tracked game${fix.gamesSeen===1?'':'s'}.`;
    return'Waiting for enough live match evidence.';
  }
  const deaths=view.me.scores.deaths;
  if(isFarm(category))return`${view.csPerMin.toFixed(1)} CS/min at ${Math.floor(view.timeMin)}m.`;
  if(category==='DEATHS')return`${deaths} death${deaths===1?'':'s'} at ${Math.floor(view.timeMin)}m${view.recentDeath?' · one was recent':''}.`;
  if(category==='POSITIONING')return positionRead(view);
  if(['TRADING','LANING','MATCHUPS'].includes(category))return laneRead(view);
  if(['TEMPO','WAVE_MANAGEMENT','ITEMISATION'].includes(category))return`${view.currentGold}g unspent · ${laneState(view)}.`;
  if(['VISION','MAP_AWARENESS'].includes(category))return`${view.me.scores.wardScore.toFixed(0)} vision score at ${Math.floor(view.timeMin)}m${view.kp!==null?` · ${view.kp}% KP`:''}.`;
  if(['OBJECTIVE_CONTROL','TEAMFIGHTING','MACRO'].includes(category))return`${view.kp===null?'No team kill yet':`${view.kp}% kill participation`} · ${deaths} death${deaths===1?'':'s'}.`;
  if(category==='CONSISTENCY'&&fix)return`${fix.title} has appeared ${fix.occurrences} time${fix.occurrences===1?'':'s'} across ${fix.gamesSeen} tracked games.`;
  if(depth>=6)return`${view.me.scores.kills}/${deaths}/${view.me.scores.assists} · ${view.csPerMin.toFixed(1)} CS/min · ${view.currentGold}g held.`;
  return`${view.me.scores.kills}/${deaths}/${view.me.scores.assists} at ${Math.floor(view.timeMin)}m.`;
}

function buildCue(category:string,task:LiveMissionTask,view:View|null,fix:ProHistoryFix|null){
  const base=String(task.gameRule||'').trim();
  if(!view)return fix?.rule||base||'Play the next clean decision and build evidence.';
  const deaths=view.me.scores.deaths;
  const target=parseFirstNumber(`${task.target||''} ${task.metric||''} ${task.title||''}`);

  if(category==='DEATHS'){
    if(view.recentDeath)return'Break the chain now: safe resources, rebuild vision, then re-enter. No revenge fight.';
    if(deaths>=3)return'Protect the next life. Take the next fight only with numbers, information or a clear first hit.';
    return deaths===0?'Keep the zero: do not spend a life for a low-value chase or facecheck.':'Make this death the last one: reset the quality of the next decision.';
  }
  if(isFarm(category)){
    if(target&&view.csPerMin<target-.35)return'Farm is below your mission pace. For the next 3 minutes, take the safe wave before moving to a low-value fight.';
    return'Farm pace is usable. Keep taking the nearest safe wave before you move, then arrive to the important fight.';
  }
  if(category==='POSITIONING'){
    if(view.me.isDead||view.recentDeath)return'Reset your positioning rule: do not be first into threat. Re-enter behind the player who can safely take first contact.';
    if(view.healthPct!==null&&view.healthPct<38)return'You are low. Preserve uptime: back out of first-contact range and only re-enter after the threat cycle.';
    if(view.teamEconomyRank<=2)return'You are carrying high team economy. Stay one layer behind first contact and hit the nearest safe target.';
    return'Play one layer behind first contact. Hit the nearest safe target instead of reaching through danger.';
  }
  if(['TRADING','LANING','MATCHUPS'].includes(category)){
    if((view.levelDelta??0)<0||(view.itemGoldDelta??0)<-350)return'You are in a red lane state. Short trade only after cooldown, wave or numbers advantage; do not extend.';
    if((view.levelDelta??0)>0||(view.itemGoldDelta??0)>350)return'You have a visible edge. Make them walk into you for farm; convert pressure instead of chasing.';
    return'Keep trades conditional: first damage, cooldown or wave edge first; extend only after the state turns green.';
  }
  if(['TEMPO','WAVE_MANAGEMENT','ITEMISATION'].includes(category)){
    if(view.currentGold>=1300)return`You are holding ${view.currentGold}g. Find the next safe reset before choosing a voluntary fight.`;
    if(view.currentGold>=850)return'Your bank is becoming meaningful. Finish the wave cleanly and look for a reset before the next major contest.';
    return'After the next wave, make one decision: reset, objective setup or pressure. Do not drift between all three.';
  }
  if(['VISION','MAP_AWARENESS'].includes(category))return'Before the next river or objective move: get information first, then move with a teammate or a visible numbers edge.';
  if(['OBJECTIVE_CONTROL','TEAMFIGHTING','MACRO'].includes(category)){
    if(deaths>=3)return'Stop forcing the map through fights. Catch the next safe resource, group on timing, then contest with your team.';
    return'After the next won exchange, convert immediately: objective, tower or wave. Do not turn the win into a low-value chase.';
  }
  if(category==='CONSISTENCY'&&fix)return liveAdjustmentForFix(fix,view);
  return fix?.rule||base||'Play the next decision cleanly and stay connected to the mission.';
}

function buildNextLevel(category:string,task:LiveMissionTask,fix:ProHistoryFix|null,nextTier:string,depth:number){
  const prefix=nextTier==='CHALLENGER'?'Challenger standard':`To reach ${titleCase(nextTier)}`;
  if(fix&&depth>=4)return`${prefix}: ${fix.mastery}`;
  if(category==='DEATHS')return`${prefix}: remove the repeat death after the first mistake and protect bad-game floors.`;
  if(isFarm(category))return`${prefix}: keep useful farm after lane without arriving late to the fights that matter.`;
  if(category==='POSITIONING')return`${prefix}: preserve damage uptime when you hold meaningful team economy.`;
  if(['TRADING','LANING','MATCHUPS'].includes(category))return`${prefix}: stop taking neutral fights; commit only after the visible state is favourable.`;
  if(['TEMPO','WAVE_MANAGEMENT','ITEMISATION'].includes(category))return`${prefix}: turn earned gold and wave control into earlier, cleaner reset timings.`;
  if(['VISION','MAP_AWARENESS'].includes(category))return`${prefix}: move on information, not hope — especially before river and objective contests.`;
  if(['OBJECTIVE_CONTROL','TEAMFIGHTING','MACRO'].includes(category))return`${prefix}: convert won states instead of extending them into coin-flip fights.`;
  if(category==='CONSISTENCY')return`${prefix}: repeat the correct decision across 3 games, not just when the game is easy.`;
  const target=String(task.target||'').trim();
  return target?`${prefix}: prove the mission target consistently — ${target}.`:`${prefix}: repeat this behaviour cleanly across the next three reviewed games.`;
}

function buildEvidence(task:LiveMissionTask,view:View|null,fix:ProHistoryFix|null,history:ProLearningProfile|null,depth:number){
  if(depth<=2)return fix?`Repeated in ${fix.gamesSeen} tracked game${fix.gamesSeen===1?'':'s'}.`:'Live match + Active Five.';
  const parts:string[]=[];
  if(view)parts.push(`Live: ${view.csPerMin.toFixed(1)} CS/min, ${view.me.scores.deaths} deaths${view.kp!==null?`, ${view.kp}% KP`:''}`);
  if(fix)parts.push(`History: ${fix.occurrences} occurrences / ${fix.gamesSeen} games`);
  else if(history?.gamesAnalyzed)parts.push(`History: ${history.gamesAnalyzed} tracked games`);
  const target=String(task.target||'').trim();if(target&&depth>=6)parts.push(`Mission pass: ${target}`);
  return parts.join(' · ')||'Active Five mission evidence.';
}

function matchingHistoryFix(task:LiveMissionTask,history:ProLearningProfile|null){
  if(!history?.fixLadder?.length)return null;
  const hay=`${task.title||''} ${task.category||''} ${task.gameRule||''}`.toLowerCase();
  const category=String(task.category||'').toUpperCase();
  const categoryKey:Record<string,string[]>={
    DEATHS:['CHAIN_DEATH'],TEMPO:['BANKING_LEAK'],TRADING:['RED_STATE'],LANING:['RED_STATE'],MATCHUPS:['RED_STATE'],
    POSITIONING:['CARRY_DEATH'],CONSISTENCY:['LEAD_THROW'],TEAMFIGHTING:['CARRY_DEATH','LEAD_THROW'],MACRO:['LEAD_THROW'],
  };
  const direct=history.fixLadder.find(f=>categoryKey[category]?.includes(f.key));
  if(direct)return direct;
  return history.fixLadder.find(f=>hay.includes(f.title.toLowerCase())||hay.includes(f.key.toLowerCase().replaceAll('_',' ')))??null;
}

function liveAdjustmentForFix(fix:ProHistoryFix,view:View){
  if(fix.key==='BANKING_LEAK'&&view.currentGold>=1100)return`Spend the ${view.currentGold}g before the next voluntary fight if a meaningful purchase is available.`;
  if(fix.key==='CHAIN_DEATH'&&view.recentDeath)return'Your repeat leak is live: break the second death with safe resources and information before re-entering.';
  if(fix.key==='RED_STATE'&&((view.levelDelta??0)<0||(view.itemGoldDelta??0)<-300))return'The visible state is red right now. Add numbers, first damage or a cooldown edge before committing.';
  if(fix.key==='CARRY_DEATH'&&view.teamEconomyRank<=2)return'You are carrying high team economy. Survival is worth more than reaching a lower-value target.';
  if(fix.key==='LEAD_THROW'&&((view.levelDelta??0)>0||(view.itemGoldDelta??0)>350))return'You are ahead. Make the enemy enter your threat; do not turn the lead into an uncontrolled chase.';
  return fix.rule;
}

function positionRead(view:View){
  if(view.me.isDead)return`Dead at ${Math.floor(view.timeMin)}m · your damage uptime is currently zero.`;
  const health=view.healthPct===null?'HP unknown':`${view.healthPct}% HP`;
  const economy=view.teamEconomyRank<=2?`top-${view.teamEconomyRank} team economy`:`team economy #${view.teamEconomyRank}`;
  return`${health} · ${economy} · ${laneState(view)}.`;
}

function laneRead(view:View){
  if(view.levelDelta===null&&view.itemGoldDelta===null)return`Lane opponent unresolved at ${Math.floor(view.timeMin)}m.`;
  const level=view.levelDelta===null?'level unknown':view.levelDelta===0?'level even':`${signed(view.levelDelta)} level`;
  const gold=view.itemGoldDelta===null?'item state unknown':Math.abs(view.itemGoldDelta)<150?'items even':`${signed(view.itemGoldDelta)}g items`;
  return`${level} · ${gold}.`;
}

function laneState(view:View){
  const level=view.levelDelta??0,gold=view.itemGoldDelta??0;
  if(level>0||gold>=350)return'ahead state';
  if(level<0||gold<=-350)return'behind state';
  return'even state';
}

function isFarm(category:string){return['FARMING','RESOURCE_COLLECTION'].includes(category)}
function normaliseRole(value:unknown){const role=String(value||'').trim().toUpperCase();if(role==='BOTTOM')return'ADC';if(role==='UTILITY')return'SUPPORT';if(role==='MIDDLE')return'MID';return role}
function parseFirstNumber(value:string){const match=value.match(/(\d+(?:\.\d+)?)/);return match?Number(match[1]):null}
function signed(value:number){return`${value>0?'+':''}${Math.round(value)}`}
function titleCase(value:string){return value.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())}
function short(value:string,max:number){const text=String(value||'').replace(/\s+/g,' ').trim();if(text.length<=max)return text;return`${text.slice(0,max-1).replace(/\s+\S*$/,'')}…`}
