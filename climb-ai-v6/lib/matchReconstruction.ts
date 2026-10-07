import type {DnaDomain} from './types';
import type {DecisionGraph,DecisionGraphNode} from './decisionGraph';
import type {RiotMatchDto,RiotTimelineDto,RiotTimelineEvent,RiotTimelineFrame,RiotParticipant} from './riot/riotTypes';
import type {LiveTelemetrySnapshot,LiveTelemetryEvent,LiveTelemetryPlayer} from './riot/liveTelemetry';
import type {StrengthTimeline,FightReview} from './riot/liveStrength';

export type ReconstructionSide='GOOD'|'CRITICAL';
export type ReconstructionSource='MATCH_V5_TIMELINE'|'LIVE_TELEMETRY';
export type ReconstructionEvidenceKind='VERIFIED'|'CONNECTED'|'COACHING_INFERENCE';

export interface ReconstructionEvidence{
  kind:ReconstructionEvidenceKind;
  atSeconds?:number;
  label:string;
  detail:string;
}
export interface MatchReconstructionStory{
  id:string;
  side:ReconstructionSide;
  atSeconds:number;
  clock:string;
  title:string;
  behaviourLabel:string;
  dnaDomain:DnaDomain;
  before:string;
  decision:string;
  consequence:string;
  coaching:string;
  evidence:ReconstructionEvidence[];
  source:ReconstructionSource;
  confidence:'HIGH'|'MEDIUM'|'LOW';
  severity:number;
}
export interface MatchReconstruction{
  version:2;
  source:ReconstructionSource;
  generatedAt:string;
  stories:MatchReconstructionStory[];
  boundary:string;
}

const BOUNDARY='OP CLIMB reconstructs only Riot-visible or Companion-recorded state. VERIFIED means a recorded event or state. CONNECTED means recorded events are linked by time and team ownership. COACHING INFERENCE explains why that verified sequence matters; it does not claim hidden intent, exact positioning, cooldowns, fog information or team communication.';
const clock=(seconds:number)=>{const s=Math.max(0,Math.floor(seconds));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const clean=(value:unknown)=>String(value??'').replace(/\s+/g,' ').trim();

export function buildRiotMatchReconstruction(dto:RiotMatchDto,timeline:RiotTimelineDto,puuid:string):MatchReconstruction|null{
  const me=dto.info.participants.find(player=>player.puuid===puuid);
  if(!me)return null;
  const events=allRiotEvents(timeline);
  const myId=me.participantId,myTeam=me.teamId;
  const stories:MatchReconstructionStory[]=[];
  const interactions=events.filter(event=>event.type==='CHAMPION_KILL'&&(event.victimId===myId||event.killerId===myId||(event.assistingParticipantIds??[]).includes(myId)));

  for(const event of interactions){
    const seconds=event.timestamp/1000;
    const death=event.victimId===myId;
    const enemy=death?participantName(dto,event.killerId):participantName(dto,event.victimId);
    const before=riotStateBefore(timeline,events,myId,event.timestamp);
    const currentFrame=frameAt(timeline,event.timestamp);
    const currentGold=currentFrame?.participantFrames[String(myId)]?.currentGold??0;
    const teamRank=teamGoldRank(dto,currentFrame,me);
    const repeatCount=death&&event.killerId?events.filter(row=>row.type==='CHAMPION_KILL'&&row.victimId===myId&&row.killerId===event.killerId&&row.timestamp<=event.timestamp).length:0;
    const conversion=findConversionAfter(events,dto,myTeam,event.timestamp,death?60000:75000,death?'ENEMY':'ALLY');

    let behaviourLabel='Fight Selection';
    let dnaDomain:DnaDomain='TEAMFIGHTS';
    let title=death?'Death to '+enemy:'Positive fight vs '+enemy;
    let coaching=death?'Protect your availability before the next meaningful team action.':'Repeat the conditions that let you stay alive and convert the positive fight.';
    let severity=death?55:45;

    if(conversion?.kind==='OBJECTIVE'){
      behaviourLabel='Objective Readiness';dnaDomain='OBJECTIVES';severity+=25;
      title=death?'Death before '+conversion.name:'Fight converted into '+conversion.name;
      coaching=death?'Treat the objective timer as part of the fight. Staying alive before the objective can be worth more than taking one extra low-percentage exchange.':'Repeat this sequence: create or survive the fight, then immediately convert the objective.';
    }else if(currentGold>=1200&&death){
      behaviourLabel='Reset Discipline';dnaDomain='WAVES_CS';severity+=18;
      title='Died with '+Math.round(currentGold)+'g unspent';
      coaching='When your bank can become meaningful combat power, reset before volunteering for another high-risk fight.';
    }else if(teamRank>0&&teamRank<=2&&death){
      behaviourLabel='Carry Preservation';dnaDomain='TEAMFIGHTS';severity+=15;
      title='High-value carry death';
      coaching='Your life represented a high share of team economy. Preserve the first threat cycle before committing for damage.';
    }else if(repeatCount>=2&&death){
      behaviourLabel='Threat Adaptation';dnaDomain='VISION_MAP';severity+=12;
      title=enemy+' punished you again';
      coaching='After '+enemy+' shows the same access pattern once, change the next interaction instead of offering the same situation again.';
    }

    const decision=death
      ?'At '+clock(seconds)+', you died'+(enemy?' to '+enemy:'')+(currentGold>=900?' while holding about '+Math.round(currentGold)+'g':'')+'.'
      :'At '+clock(seconds)+', you '+(event.killerId===myId?'secured the kill':'assisted the kill')+' on '+enemy+'.';
    const consequence=conversion
      ?conversion.name+' was '+(death?'taken by the enemy':'secured by your team')+' '+Math.round((conversion.atMs-event.timestamp)/1000)+'s later.'
      :death?'No major objective or tower conversion was recorded inside the immediate consequence window.':'No major objective or tower conversion was recorded inside the immediate conversion window.';

    const evidence:ReconstructionEvidence[]=[...before.evidence,{kind:'VERIFIED',atSeconds:seconds,label:death?'Death':'Positive fight',detail:decision}];
    if(conversion){
      evidence.push({kind:'VERIFIED',atSeconds:conversion.atMs/1000,label:conversion.name,detail:(death?'Enemy':'Your team')+' conversion recorded by the Riot timeline.'});
      evidence.push({kind:'CONNECTED',label:'Sequence link',detail:'The fight event and '+conversion.name.toLowerCase()+' were '+Math.round((conversion.atMs-event.timestamp)/1000)+'s apart.'});
    }
    if(teamRank>0&&teamRank<=2&&death)evidence.push({kind:'VERIFIED',atSeconds:seconds,label:'Team economy rank',detail:'You were #'+teamRank+' on your team in total gold in the nearest Riot frame.'});
    if(repeatCount>=2&&death)evidence.push({kind:'VERIFIED',atSeconds:seconds,label:'Repeated threat',detail:'This was death #'+repeatCount+' to '+enemy+' in the Riot timeline.'});
    evidence.push({kind:'COACHING_INFERENCE',label:behaviourLabel,detail:coaching});

    stories.push({
      id:'riot-'+event.timestamp+'-'+(death?'death':'positive'),side:death?'CRITICAL':'GOOD',atSeconds:seconds,clock:clock(seconds),
      title,behaviourLabel,dnaDomain,before:before.text,decision,consequence,coaching,evidence,source:'MATCH_V5_TIMELINE',
      confidence:conversion||currentGold>=1200||(teamRank>0&&teamRank<=2)?'HIGH':'MEDIUM',severity,
    });
  }

  for(const event of events.filter(row=>row.type==='ELITE_MONSTER_KILL')){
    const team=eventTeam(dto,event);
    if(team!==myTeam)continue;
    const involved=event.killerId===myId||(event.assistingParticipantIds??[]).includes(myId);
    if(!involved)continue;
    const seconds=event.timestamp/1000,name=objectiveName(event);
    const before=riotStateBefore(timeline,events,myId,event.timestamp);
    const priorPositive=interactions.filter(row=>row.timestamp<event.timestamp&&event.timestamp-row.timestamp<=75000&&row.victimId!==myId).at(-1);
    const consequence=priorPositive?name+' followed a positive fight interaction '+Math.round((event.timestamp-priorPositive.timestamp)/1000)+'s later.':'You were directly involved when your team secured '+name+'.';
    const evidence:ReconstructionEvidence[]=[...before.evidence,{kind:'VERIFIED',atSeconds:seconds,label:name,detail:'Riot timeline recorded your direct kill or assist involvement.'}];
    if(priorPositive)evidence.push({kind:'CONNECTED',label:'Fight to objective',detail:'A positive fight interaction occurred '+Math.round((event.timestamp-priorPositive.timestamp)/1000)+'s before the objective.'});
    evidence.push({kind:'COACHING_INFERENCE',label:'Objective Readiness',detail:'Being alive and directly involved at the secure is positive objective-readiness evidence.'});
    stories.push({
      id:'riot-objective-'+event.timestamp,side:'GOOD',atSeconds:seconds,clock:clock(seconds),title:'Present for '+name,
      behaviourLabel:'Objective Readiness',dnaDomain:'OBJECTIVES',before:before.text,
      decision:'At '+clock(seconds)+', Riot recorded you as directly involved in securing '+name+'.',consequence,
      coaching:'Repeat the readiness pattern: arrive alive, connected and able to participate when the objective is actually taken.',
      evidence,source:'MATCH_V5_TIMELINE',confidence:'HIGH',severity:65,
    });
  }

  return {version:2,source:'MATCH_V5_TIMELINE',generatedAt:new Date().toISOString(),stories:dedupeStories(stories),boundary:BOUNDARY};
}

export function buildLiveMatchReconstruction(snapshots:LiveTelemetrySnapshot[],summary:StrengthTimeline,decisionGraph?:DecisionGraph|null):MatchReconstruction|null{
  const ordered=[...snapshots].sort((a,b)=>a.gameTime-b.gameTime);
  if(!ordered.length)return null;
  const liveEvents=uniqueLiveEvents(ordered);
  const stories:MatchReconstructionStory[]=[];

  for(const fight of summary.fightReviews??[]){
    const side:ReconstructionSide=fight.outcome==='DEATH'?'CRITICAL':'GOOD';
    const before=liveStateBefore(ordered,fight.atSeconds);
    const nextObjective=liveEvents.find(event=>event.time>fight.atSeconds&&event.time-fight.atSeconds<=75&&isObjectiveEvent(event));
    const node=nearestNode(decisionGraph,fight.atSeconds);
    const behaviourLabel=node?.behaviourLabel||liveBehaviour(fight,nextObjective);
    const dnaDomain=dnaForBehaviour(behaviourLabel);
    const objectiveLabel=nextObjective?liveEventLabel(nextObjective):null;
    const consequence=objectiveLabel?objectiveLabel+' appeared in the local Riot event feed '+Math.round(nextObjective!.time-fight.atSeconds)+'s later.':fight.summary;
    const coaching=node?.counterfactual?.alternative||node?.coachingResponse?.cue||fight.betterDecision?.[0]||(side==='GOOD'?fight.howToWin?.[0]:null)||'Repeat the decision conditions that produced the better outcome.';
    const evidence:ReconstructionEvidence[]=[...before.evidence,{kind:'VERIFIED',atSeconds:fight.atSeconds,label:fight.outcome,detail:fight.summary}];
    if(nextObjective&&objectiveLabel){
      evidence.push({kind:'VERIFIED',atSeconds:nextObjective.time,label:objectiveLabel,detail:'Recorded by the local Riot event feed.'});
      evidence.push({kind:'CONNECTED',label:'Sequence link',detail:'The fight event and '+objectiveLabel.toLowerCase()+' were '+Math.round(nextObjective.time-fight.atSeconds)+'s apart.'});
    }
    evidence.push({kind:'COACHING_INFERENCE',label:behaviourLabel,detail:coaching});
    stories.push({
      id:'live-'+Math.round(fight.atSeconds)+'-'+fight.outcome,side,atSeconds:fight.atSeconds,clock:clock(fight.atSeconds),
      title:node?.title||fight.headline,behaviourLabel,dnaDomain,before:before.text,decision:node?.decisionRead||fight.summary,
      consequence,coaching,evidence,source:'LIVE_TELEMETRY',confidence:node?.confidence??(fight.verdict==='EVEN'?'MEDIUM':'HIGH'),
      severity:(side==='CRITICAL'?55:45)+(nextObjective?20:0)+(fight.evidence.currentGold>=1200&&side==='CRITICAL'?15:0),
    });
  }

  return {version:2,source:'LIVE_TELEMETRY',generatedAt:new Date().toISOString(),stories:dedupeStories(stories),boundary:BOUNDARY};
}

function allRiotEvents(timeline:RiotTimelineDto){return timeline.info.frames.flatMap(frame=>frame.events??[]).sort((a,b)=>a.timestamp-b.timestamp)}
function riotStateBefore(timeline:RiotTimelineDto,events:RiotTimelineEvent[],pid:number,atMs:number){
  const frame=frameAt(timeline,Math.max(0,atMs-15000))??frameAt(timeline,atMs);
  const p=frame?.participantFrames[String(pid)];
  const cs=(p?.minionsKilled??0)+(p?.jungleMinionsKilled??0);
  const recentPurchases=events.filter(event=>event.type==='ITEM_PURCHASED'&&event.participantId===pid&&event.timestamp<atMs&&atMs-event.timestamp<=90000).length;
  const parts:string[]=[];
  if(p?.level)parts.push('level '+p.level);
  if(typeof p?.currentGold==='number')parts.push(Math.round(p.currentGold)+'g unspent');
  if(p)parts.push(cs+' CS');
  if(recentPurchases)parts.push(recentPurchases+' purchase event'+(recentPurchases===1?'':'s')+' in the previous 90s');
  const text=parts.length?'About 15s before the moment, the nearest Riot frame showed '+parts.join(' · ')+'.':'Riot did not expose a reliable participant frame immediately before this moment.';
  return {text,evidence:parts.length?[{kind:'VERIFIED' as const,atSeconds:(frame?.timestamp??atMs)/1000,label:'Pre-moment state',detail:text}]:[]};
}
function liveStateBefore(snapshots:LiveTelemetrySnapshot[],atSeconds:number){
  const target=atSeconds-12;
  let snapshot:LiveTelemetrySnapshot|null=null;
  for(const candidate of snapshots){if(candidate.gameTime<=target)snapshot=candidate;else break}
  snapshot??=snapshots.reduce((best,item)=>Math.abs(item.gameTime-target)<Math.abs(best.gameTime-target)?item:best,snapshots[0]);
  const me=findMeLive(snapshot);
  const hp=snapshot.active.stats.currentHealth&&snapshot.active.stats.maxHealth?Math.round(snapshot.active.stats.currentHealth/snapshot.active.stats.maxHealth*100):null;
  const parts=['level '+(snapshot.active.level||me?.level||0),Math.round(snapshot.active.currentGold)+'g unspent',me?me.scores.creepScore+' CS':'',hp!==null?hp+'% HP':'',me?.itemGold?Math.round(me.itemGold)+'g visible items':''].filter(Boolean);
  const text='Around '+clock(snapshot.gameTime)+', the Companion recorded '+parts.join(' · ')+'.';
  return {text,evidence:[{kind:'VERIFIED' as const,atSeconds:snapshot.gameTime,label:'Pre-moment snapshot',detail:text}]};
}
function frameAt(timeline:RiotTimelineDto,timestamp:number):RiotTimelineFrame|null{let best:RiotTimelineFrame|null=null;for(const frame of timeline.info.frames){if(frame.timestamp<=timestamp)best=frame;else break}return best}
function participantName(dto:RiotMatchDto,id?:number){return dto.info.participants.find(player=>player.participantId===id)?.championName??(id?'Participant '+id:'the enemy')}
function teamGoldRank(dto:RiotMatchDto,frame:RiotTimelineFrame|null,me:RiotParticipant){if(!frame)return 0;const team=dto.info.participants.filter(player=>player.teamId===me.teamId).map(player=>({id:player.participantId,gold:frame.participantFrames[String(player.participantId)]?.totalGold??0})).sort((a,b)=>b.gold-a.gold);return team.findIndex(row=>row.id===me.participantId)+1}
function eventTeam(dto:RiotMatchDto,event:RiotTimelineEvent){if(typeof event.killerTeamId==='number')return event.killerTeamId;const killer=dto.info.participants.find(player=>player.participantId===event.killerId);if(killer)return killer.teamId;if(event.type==='BUILDING_KILL'&&typeof event.teamId==='number')return event.teamId===100?200:event.teamId===200?100:null;return null}
function objectiveName(event:RiotTimelineEvent){if(event.type==='BUILDING_KILL'){const lane=String(event.laneType||'').replace(/_LANE$/,'').toLowerCase()||'map';const tower=String(event.towerType||event.buildingType||'tower').replace(/_/g,' ').toLowerCase();return lane+' '+tower}if(event.monsterType==='BARON_NASHOR')return'Baron';if(event.monsterType==='RIFTHERALD')return'Herald';if(event.monsterType==='HORDE')return'Voidgrubs';if(event.monsterType==='ATAKHAN')return'Atakhan';if(event.monsterType==='DRAGON'&&event.monsterSubType)return String(event.monsterSubType).replace('_DRAGON','').toLowerCase()+' dragon';if(event.monsterType==='DRAGON')return'dragon';return'objective'}
function findConversionAfter(events:RiotTimelineEvent[],dto:RiotMatchDto,myTeam:number,atMs:number,windowMs:number,side:'ALLY'|'ENEMY'){for(const event of events){if(event.timestamp<=atMs||event.timestamp-atMs>windowMs)continue;if(event.type!=='ELITE_MONSTER_KILL'&&event.type!=='BUILDING_KILL')continue;const team=eventTeam(dto,event);if(team===null)continue;const wanted=side==='ALLY'?team===myTeam:team!==myTeam;if(wanted)return{atMs:event.timestamp,name:objectiveName(event),kind:event.type==='ELITE_MONSTER_KILL'?'OBJECTIVE' as const:'TOWER' as const}}return null}
function findMeLive(snapshot:LiveTelemetrySnapshot):LiveTelemetryPlayer|null{const riotId=snapshot.active.riotId,summoner=snapshot.active.summonerName;return snapshot.players.find(player=>Boolean(riotId&&player.riotId===riotId))??snapshot.players.find(player=>Boolean(summoner&&player.summonerName===summoner))??snapshot.players.find(player=>player.championName===snapshot.active.championName&&player.team===snapshot.active.team)??null}
function uniqueLiveEvents(snapshots:LiveTelemetrySnapshot[]){const map=new Map<string,LiveTelemetryEvent>();for(const snapshot of snapshots)for(const event of snapshot.events){const key=event.id!==null?'id:'+event.id:[event.name,event.time,event.actor||'',event.target||''].join(':');map.set(key,event)}return[...map.values()].sort((a,b)=>a.time-b.time)}
function isObjectiveEvent(event:LiveTelemetryEvent){return /dragon|baron|herald|horde|voidgrub|atakhan|turret|tower|inhib/i.test(event.name)}
function liveEventLabel(event:LiveTelemetryEvent){return clean(event.name).replace(/([a-z])([A-Z])/g,'$1 $2')||'objective event'}
function nearestNode(graph:DecisionGraph|undefined|null,seconds:number):DecisionGraphNode|null{if(!graph?.nodes.length)return null;let best=graph.nodes[0];for(const node of graph.nodes){if(Math.abs(node.atSeconds-seconds)<Math.abs(best.atSeconds-seconds))best=node}return Math.abs(best.atSeconds-seconds)<=18?best:null}
function liveBehaviour(fight:FightReview,nextObjective?:LiveTelemetryEvent){if(nextObjective)return'Objective Readiness';if(fight.outcome==='DEATH'&&fight.evidence.currentGold>=1200)return'Reset Discipline';if(fight.outcome==='DEATH'&&fight.verdict==='YOU_STRONGER')return'Lead Protection';if(fight.outcome==='DEATH')return'Fight Selection';return'Fight Conversion'}
function dnaForBehaviour(label:string):DnaDomain{const value=label.toLowerCase();if(/objective/.test(value))return'OBJECTIVES';if(/reset|farm|wave/.test(value))return'WAVES_CS';if(/threat|adapt|vision|map/.test(value))return'VISION_MAP';if(/fight|carry|survival|lead/.test(value))return'TEAMFIGHTS';if(/consisten|recovery/.test(value))return'CONSISTENCY';return'LANING'}
function dedupeStories(stories:MatchReconstructionStory[]){const ordered=[...stories].sort((a,b)=>b.severity-a.severity||a.atSeconds-b.atSeconds);const seen=new Set<string>();const kept:MatchReconstructionStory[]=[];for(const story of ordered){const key=story.side+':'+story.behaviourLabel+':'+Math.round(story.atSeconds/20);if(seen.has(key))continue;seen.add(key);kept.push(story)}return kept.sort((a,b)=>a.atSeconds-b.atSeconds)}
