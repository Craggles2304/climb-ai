import type {CurriculumLesson} from './climbCurriculum';
import type {DecisionBehaviourKey,DecisionSituationTag,DraftSituationContext} from './decisionTwin';

export type ClimbMatchMissionStatus='READY'|'NOT_RELEVANT';
export type ClimbMatchMissionReviewStatus='NO_MISSION'|'NOT_OBSERVED'|'EXECUTED'|'MISSED'|'MIXED';

export interface ClimbMatchMission{
  version:1;
  id:string;
  status:ClimbMatchMissionStatus;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  curriculumPhase:CurriculumLesson['phase'];
  champion:string;
  role:string|null;
  targetTag:DecisionSituationTag;
  title:string;
  whyThisGame:string;
  trigger:string;
  action:string;
  cue:string;
  successDefinition:string;
  failureDefinition:string;
  rehearsalQuestion:string;
  relevantEnemies:string[];
  reviewRule:string;
  graduationRule:string;
  source:'CLIMB_CURRICULUM';
  boundary:string;
}

export interface ClimbMatchMissionObservedDecision{
  behaviourKey:DecisionBehaviourKey;
  verdict:'GOOD'|'IMPROVE'|'NEUTRAL';
  confidence:'HIGH'|'MEDIUM'|'LOW';
  situationTags:DecisionSituationTag[];
}

export interface ClimbMatchMissionReview{
  version:1;
  active:boolean;
  missionId:string|null;
  behaviourKey:DecisionBehaviourKey|null;
  behaviourLabel:string|null;
  targetTag:DecisionSituationTag|null;
  status:ClimbMatchMissionReviewStatus;
  matchedMoments:number;
  cleanMoments:number;
  improveMoments:number;
  note:string;
  boundary:string;
}

type DraftCoachLike={
  headline?:string|null;
  theirPlan?:string|null;
  threatAnswer?:string|null;
  fightTrigger?:string|null;
  objectiveSetup?:string|null;
  never?:string|null;
  ifBehind?:string|null;
};

const BOUNDARY='CLIMB Mission Design freezes one match-specific repetition from the active Curriculum lesson before play. It only scores verified Decision Graph moments after the game. If the planned decision never appears, the mission is NOT OBSERVED rather than passed or failed.';

const LABELS:Record<DecisionBehaviourKey,string>={
  FIGHT_SELECTION:'Fight Selection',
  DEATH_RECOVERY:'Recovery After Death',
  LEAD_PROTECTION:'Lead Protection',
  RESET_DISCIPLINE:'Reset Discipline',
  OBJECTIVE_READINESS:'Objective Arrival',
  FARM_VS_SETUP:'Farm vs Setup',
  THREAT_ADAPTATION:'Threat Adaptation',
  CARRY_PRESERVATION:'Carry Preservation',
  POWER_SPIKE_CONVERSION:'Power-Spike Conversion',
  SURVIVAL_VALUE:'Survival Value',
};

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function named(values:string[]){return [...new Set(values.map(clean).filter(Boolean))]}
function packageText(values:string[]){return named(values).slice(0,3).join(' + ')}
function targetTagFor(key:DecisionBehaviourKey,context:DraftSituationContext):DecisionSituationTag{
  const tags=context.tags??[];
  const first=(...choices:DecisionSituationTag[])=>choices.find(tag=>tags.includes(tag))??'GENERAL';
  if(key==='CARRY_PRESERVATION'||key==='SURVIVAL_VALUE')return first('MULTI_ACCESS','PICK_PRESSURE','ZONE_OBJECTIVE');
  if(key==='THREAT_ADAPTATION')return first('MULTI_ACCESS','PICK_PRESSURE','ZONE_OBJECTIVE');
  if(key==='OBJECTIVE_READINESS'||key==='FARM_VS_SETUP')return first('ZONE_OBJECTIVE','PICK_PRESSURE');
  if(key==='POWER_SPIKE_CONVERSION')return first('SCALING_WINDOW');
  if(key==='FIGHT_SELECTION'||key==='LEAD_PROTECTION')return first('MULTI_ACCESS','PICK_PRESSURE','ZONE_OBJECTIVE');
  return'GENERAL';
}
function enemiesFor(key:DecisionBehaviourKey,context:DraftSituationContext){
  if(key==='CARRY_PRESERVATION'||key==='SURVIVAL_VALUE'||key==='FIGHT_SELECTION'||key==='LEAD_PROTECTION')return named([...context.enemyAccess,...context.enemyPicks]);
  if(key==='THREAT_ADAPTATION')return named([...context.enemyAccess,...context.enemyPicks,...context.enemyZones]);
  if(key==='OBJECTIVE_READINESS'||key==='FARM_VS_SETUP')return named([...context.enemyZones,...context.enemyPicks]);
  return named([...context.enemyAccess,...context.enemyPicks,...context.enemyZones]);
}
function isRelevant(key:DecisionBehaviourKey,tag:DecisionSituationTag,context:DraftSituationContext){
  if(tag!=='GENERAL')return true;
  if(['RESET_DISCIPLINE','DEATH_RECOVERY','LEAD_PROTECTION','POWER_SPIKE_CONVERSION'].includes(key))return true;
  if(key==='OBJECTIVE_READINESS'||key==='FARM_VS_SETUP')return context.tags.includes('ZONE_OBJECTIVE')||context.tags.includes('PICK_PRESSURE');
  if(key==='THREAT_ADAPTATION')return context.enemyAccess.length+context.enemyPicks.length+context.enemyZones.length>0;
  if(key==='CARRY_PRESERVATION'||key==='SURVIVAL_VALUE'||key==='FIGHT_SELECTION')return context.enemyAccess.length+context.enemyPicks.length>0;
  return true;
}
function triggerFor(key:DecisionBehaviourKey,enemies:string[],coach:DraftCoachLike){
  const threat=packageText(enemies);
  if(key==='FIGHT_SELECTION')return clean(coach.fightTrigger)||(threat?`WHEN ${threat} CREATE FIRST CONTACT OR THE FIGHT STARTS AROUND THEM.`:'WHEN THE NEXT VOLUNTARY FIGHT STARTS.');
  if(key==='DEATH_RECOVERY')return'AFTER YOUR FIRST DEATH OR MAJOR SETBACK, BEFORE THE NEXT CONTESTED ACTION.';
  if(key==='LEAD_PROTECTION')return'WHEN YOU HOLD A VISIBLE ADVANTAGE AND THE NEXT FIGHT IS OPTIONAL.';
  if(key==='RESET_DISCIPLINE')return'WHEN YOUR BANK CAN BECOME A MEANINGFUL PURCHASE BEFORE THE NEXT VOLUNTARY FIGHT.';
  if(key==='OBJECTIVE_READINESS')return clean(coach.objectiveSetup)||'WHEN THE NEXT IMPORTANT OBJECTIVE SETUP WINDOW OPENS.';
  if(key==='FARM_VS_SETUP')return'WHEN AN EXTRA WAVE OR CAMP COMPETES WITH ARRIVING TO THE NEXT TEAM SETUP.';
  if(key==='THREAT_ADAPTATION')return threat?`AFTER ${threat} SHOW THEIR ACCESS PATTERN ONCE.`:'AFTER THE SAME ENEMY THREAT SHOWS ITS ACCESS PATTERN ONCE.';
  if(key==='CARRY_PRESERVATION')return threat?`WHEN ${threat} START OR THREATEN FIRST CONTACT.`:'WHEN FIRST CONTACT STARTS AND A SECOND THREAT STILL HAS ACCESS.';
  if(key==='POWER_SPIKE_CONVERSION')return'WHEN YOUR REAL ITEM OR LEVEL SPIKE COMPLETES.';
  if(key==='SURVIVAL_VALUE')return threat?`WHEN ${threat} CAN REACH YOU AND YOUR LIFE HOLDS HIGH TEAM VALUE.`:'WHEN YOUR LIFE HOLDS HIGH TEAM VALUE IN A CONTESTED FIGHT.';
  return'WHEN THE TARGET DECISION WINDOW APPEARS.';
}
function actionFor(key:DecisionBehaviourKey,enemies:string[],coach:DraftCoachLike,lesson:CurriculumLesson){
  const threat=packageText(enemies);
  if(key==='FIGHT_SELECTION')return lesson.gameRule;
  if(key==='DEATH_RECOVERY')return clean(coach.ifBehind)||'REBUILD SAFE RESOURCES, INFORMATION AND POSITION BEFORE YOU RE-ENTER.';
  if(key==='LEAD_PROTECTION')return'CONVERT CONTROL. MAKE THEM ENTER YOUR SETUP INSTEAD OF CHASING EXTRA RISK.';
  if(key==='RESET_DISCIPLINE')return'SPEND THE BANK BEFORE YOU VOLUNTEER FOR THE NEXT FIGHT.';
  if(key==='OBJECTIVE_READINESS')return clean(coach.objectiveSetup)||'LEAVE THE LAST LOW-VALUE RESOURCE EARLY ENOUGH TO OWN IMPORTANT SPACE FIRST.';
  if(key==='FARM_VS_SETUP')return'GIVE UP THE EXTRA RESOURCE IF TAKING IT MAKES YOU SECOND TO THE REAL TEAM WINDOW.';
  if(key==='THREAT_ADAPTATION')return threat?`CHANGE YOUR NEXT POSITION OR ENTRY AFTER ${threat} SHOW THE FIRST ACCESS ANGLE.`:'CHANGE YOUR NEXT POSITION OR ENTRY AFTER THE THREAT SHOWS ITS FIRST ACCESS ANGLE.';
  if(key==='CARRY_PRESERVATION')return clean(coach.never)||clean(coach.threatAnswer)||'KEEP THE SAFE DAMAGE LINE; HIT THE CLOSEST SAFE TARGET UNTIL THE REMAINING ACCESS IS GONE.';
  if(key==='POWER_SPIKE_CONVERSION')return'CONNECT TO THE NEXT PRESSURE WINDOW BEFORE DRIFTING BACK INTO ANOTHER FARM CYCLE.';
  if(key==='SURVIVAL_VALUE')return clean(coach.never)||'PRESERVE UPTIME BEFORE REACHING FOR A LOWER-VALUE TARGET.';
  return lesson.gameRule;
}
function whyThisGame(key:DecisionBehaviourKey,tag:DecisionSituationTag,enemies:string[],lesson:CurriculumLesson){
  const threat=packageText(enemies);
  if(tag!=='GENERAL'&&threat)return`${lesson.label} is the active Curriculum lesson, and this draft creates a ${tag.replaceAll('_',' ').toLowerCase()} test through ${threat}.`;
  if(tag!=='GENERAL')return`${lesson.label} is the active Curriculum lesson, and this draft creates a ${tag.replaceAll('_',' ').toLowerCase()} decision window.`;
  if(key==='RESET_DISCIPLINE'||key==='DEATH_RECOVERY'||key==='LEAD_PROTECTION'||key==='POWER_SPIKE_CONVERSION')return`${lesson.label} is the active Curriculum lesson. This game can test it if its natural trigger appears.`;
  return`${lesson.label} stays the Curriculum focus, but this draft does not create a strong specialised cue. OP CLIMB will only score the mission if a verified comparable decision actually appears.`;
}

export function buildClimbMatchMission(input:{
  lesson:CurriculumLesson|null|undefined;
  situationContext:DraftSituationContext;
  coach:DraftCoachLike;
  champion:string;
  role:string|null|undefined;
}):ClimbMatchMission|null{
  const lesson=input.lesson;
  if(!lesson)return null;
  const targetTag=targetTagFor(lesson.behaviourKey,input.situationContext);
  const enemies=enemiesFor(lesson.behaviourKey,input.situationContext);
  const action=actionFor(lesson.behaviourKey,enemies,input.coach,lesson);
  const trigger=triggerFor(lesson.behaviourKey,enemies,input.coach);
  const relevant=isRelevant(lesson.behaviourKey,targetTag,input.situationContext);
  const cue=`${trigger} ${action}`;
  return{
    version:1,
    id:['climb-mission',lesson.behaviourKey,targetTag,clean(input.champion)||'unknown'].join(':').toLowerCase(),
    status:relevant?'READY':'NOT_RELEVANT',
    behaviourKey:lesson.behaviourKey,
    behaviourLabel:lesson.label||LABELS[lesson.behaviourKey],
    curriculumPhase:lesson.phase,
    champion:clean(input.champion)||'Unknown',
    role:clean(input.role)||null,
    targetTag,
    title:`${lesson.label} · ${targetTag==='GENERAL'?'MATCH REP':targetTag.replaceAll('_',' ')}`,
    whyThisGame:whyThisGame(lesson.behaviourKey,targetTag,enemies,lesson),
    trigger,
    action,
    cue,
    successDefinition:`A verified ${lesson.label} decision${targetTag==='GENERAL'?'':` tagged ${targetTag.replaceAll('_',' ')}`} is graded GOOD.`,
    failureDefinition:`A verified ${lesson.label} decision${targetTag==='GENERAL'?'':` tagged ${targetTag.replaceAll('_',' ')}`} is graded IMPROVE.`,
    rehearsalQuestion:`When ${trigger.toLowerCase()} what exactly will you do?`,
    relevantEnemies:enemies,
    reviewRule:'Score only medium/high-confidence Decision Graph moments matching this behaviour and mission context. No matching moment = NOT OBSERVED.',
    graduationRule:lesson.graduationRule,
    source:'CLIMB_CURRICULUM',
    boundary:BOUNDARY,
  };
}

export function reviewClimbMatchMission(
  mission:ClimbMatchMission|null|undefined,
  observed:ClimbMatchMissionObservedDecision[],
):ClimbMatchMissionReview{
  if(!mission||mission.status!=='READY'){
    return{
      version:1,active:false,missionId:mission?.id??null,behaviourKey:mission?.behaviourKey??null,behaviourLabel:mission?.behaviourLabel??null,
      targetTag:mission?.targetTag??null,status:'NO_MISSION',matchedMoments:0,cleanMoments:0,improveMoments:0,
      note:mission?.status==='NOT_RELEVANT'?'The active Curriculum lesson did not have a strong draft-specific repetition in this game, so OP CLIMB did not force one.':'No frozen CLIMB match mission was available for review.',
      boundary:BOUNDARY,
    };
  }
  const matched=observed.filter(item=>
    item.behaviourKey===mission.behaviourKey
    &&item.confidence!=='LOW'
    &&item.verdict!=='NEUTRAL'
    &&(mission.targetTag==='GENERAL'||item.situationTags.includes(mission.targetTag))
  );
  const cleanMoments=matched.filter(item=>item.verdict==='GOOD').length;
  const improveMoments=matched.filter(item=>item.verdict==='IMPROVE').length;
  const status:ClimbMatchMissionReviewStatus=!matched.length?'NOT_OBSERVED':cleanMoments===matched.length?'EXECUTED':improveMoments===matched.length?'MISSED':'MIXED';
  return{
    version:1,
    active:true,
    missionId:mission.id,
    behaviourKey:mission.behaviourKey,
    behaviourLabel:mission.behaviourLabel,
    targetTag:mission.targetTag,
    status,
    matchedMoments:matched.length,
    cleanMoments,
    improveMoments,
    note:status==='NOT_OBSERVED'
      ?'The planned decision window did not produce a verified comparable Decision Graph moment. No pass or fail is awarded.'
      :status==='EXECUTED'
        ?'Every verified mission moment matched the target branch.'
        :status==='MISSED'
          ?'Every verified mission moment reproduced the behaviour OP CLIMB was trying to change.'
          :'The mission was executed in some verified moments and missed in others.',
    boundary:BOUNDARY,
  };
}
