import type {DecisionBehaviourKey,DecisionTwinConfidence} from './decisionTwin';
import type {DecisionTwinV2Profile,DecisionTwinActiveFocus} from './decisionTwinV2';
import type {ScenarioMemoryProfile,ScenarioMemoryCard} from './scenarioMemory';
import type {DecisionTransferProfile,DecisionTransferCard} from './decisionTransfer';
import {buildClimbRepLadder,type ClimbRepLadder,type ClimbRepLevel} from './climbRepLadder';
import {buildClimbCareerMatrix,type ClimbCareerMatrix} from './climbCareerMatrix';
import {buildClimbAutonomousCurriculum,type ClimbAutonomousCurriculum} from './climbAutonomousCurriculumV6';

export type CurriculumPhase='BUILDING'|'FOUNDATION'|'PRACTISE'|'STABILISE'|'TRANSFER'|'GRADUATED'|'REOPEN';
export type CurriculumReadiness='LOCKED'|'READY'|'ACTIVE'|'COMPLETE';
export type CurriculumDecisionAction='BUILDING'|'START'|'KEEP'|'ADVANCE'|'REOPEN'|'PREREQUISITE'|'COMPLETE';

export interface CurriculumDecision{
  action:CurriculumDecisionAction;
  previousLesson:DecisionBehaviourKey|null;
  currentLesson:DecisionBehaviourKey|null;
  changed:boolean;
  reason:string;
}

export interface CurriculumLesson{
  behaviourKey:DecisionBehaviourKey;
  label:string;
  phase:CurriculumPhase;
  readiness:CurriculumReadiness;
  confidence:DecisionTwinConfidence;
  priority:number;
  prerequisite:DecisionBehaviourKey|null;
  prerequisiteLabel:string|null;
  whyNow:string;
  gameRule:string;
  graduationRule:string;
  evidence:string;
  comparableGames:number;
  cleanStreak:number;
  memoryStrength:number|null;
  transferStrength:number|null;
  transferGames:number;
  transferCleanStreak:number;
  repLadder:ClimbRepLadder;
  nextUnlock:string|null;
}

export interface CurriculumRepLedgerEntry{
  level:ClimbRepLevel;
  phase:CurriculumPhase;
}

export interface ClimbCurriculum{
  version:1;
  generatedAt:string;
  gamesAnalyzed:number;
  status:'BUILDING'|'ACTIVE'|'COMPLETE';
  currentLesson:CurriculumLesson|null;
  nextLesson:CurriculumLesson|null;
  queue:CurriculumLesson[];
  graduated:CurriculumLesson[];
  repLedger:Partial<Record<DecisionBehaviourKey,CurriculumRepLedgerEntry>>;
  careerMatrix?:ClimbCareerMatrix;
  autonomous?:ClimbAutonomousCurriculum;
  decision:CurriculumDecision;
  summary:string;
  boundary:string;
}

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

const PREREQUISITE:Partial<Record<DecisionBehaviourKey,DecisionBehaviourKey>>={
  OBJECTIVE_READINESS:'FARM_VS_SETUP',
  LEAD_PROTECTION:'FIGHT_SELECTION',
  POWER_SPIKE_CONVERSION:'RESET_DISCIPLINE',
  CARRY_PRESERVATION:'THREAT_ADAPTATION',
  SURVIVAL_VALUE:'CARRY_PRESERVATION',
};

const RULES:Record<DecisionBehaviourKey,string>={
  FIGHT_SELECTION:'DO NOT LET FIRST CONTACT CHOOSE THE FIGHT. ENTER ONLY WHEN NUMBERS, POSITION OR YOUR PLANNED TRIGGER ARE TRUE.',
  DEATH_RECOVERY:'AFTER A SETBACK, REBUILD RESOURCES AND INFORMATION BEFORE THE NEXT CONTEST.',
  LEAD_PROTECTION:'WHEN AHEAD, CONVERT CONTROL. MAKE THEM ENTER YOUR SETUP INSTEAD OF CHASING EXTRA RISK.',
  RESET_DISCIPLINE:'IF YOUR BANK COMPLETES REAL POWER, SPEND BEFORE YOU VOLUNTEER FOR THE NEXT FIGHT.',
  OBJECTIVE_READINESS:'LEAVE THE LAST LOW-VALUE RESOURCE IF TAKING IT MAKES YOU SECOND TO IMPORTANT SPACE.',
  FARM_VS_SETUP:'IF THE EXTRA WAVE OR CAMP MAKES YOU SECOND TO THE REAL WINDOW, CONNECT FIRST.',
  THREAT_ADAPTATION:'AFTER A THREAT SHOWS ITS ACCESS PATTERN, CHANGE YOUR NEXT POSITION OR ENTRY.',
  CARRY_PRESERVATION:'FIRST CONTACT DOES NOT REMOVE THE NEXT THREAT. KEEP THE SAFE DAMAGE LINE.',
  POWER_SPIKE_CONVERSION:'WHEN YOUR REAL SPIKE COMPLETES, CONNECT TO PRESSURE BEFORE DRIFTING BACK INTO FARM.',
  SURVIVAL_VALUE:'WHEN YOUR LIFE HOLDS HIGH TEAM VALUE, SURVIVAL OUTRANKS LOWER-VALUE ACCESS.',
};

const BOUNDARY='CLIMB Curriculum advances from repeated verified decision evidence. One clean game cannot graduate a lesson, an unobserved lesson does not fail, and prerequisite skills cannot be skipped just because a later skill has a worse score.';

function bestMemory(memory:ScenarioMemoryProfile,key:DecisionBehaviourKey){
  return memory.cards
    .filter(card=>card.behaviourKey===key)
    .sort((a,b)=>{
      const weight=(card:ScenarioMemoryCard)=>card.state==='REGRESSED'?7:card.state==='DUE'?6:card.state==='LEARNING'?5:card.state==='STABILISING'?4:card.state==='MASTERED'?3:1;
      return weight(b)-weight(a)||b.comparableGames-a.comparableGames||b.memoryStrength-a.memoryStrength;
    })[0]??null;
}
function transferCard(transfer:DecisionTransferProfile,key:DecisionBehaviourKey){
  return transfer.cards.find(card=>card.behaviourKey===key)??null;
}
function focusFor(twin:DecisionTwinV2Profile,key:DecisionBehaviourKey){
  return twin.activeFive.find(item=>item.key===key)??null;
}
function behaviourStable(memory:ScenarioMemoryProfile,transfer:DecisionTransferProfile,key:DecisionBehaviourKey){
  const mem=bestMemory(memory,key);
  const tx=transferCard(transfer,key);
  if(tx?.state==='PRINCIPLE_OWNED')return true;
  return mem?.state==='MASTERED';
}
function phaseFor(mem:ScenarioMemoryCard|null,tx:DecisionTransferCard|null,previousPhase:CurriculumPhase|null=null):CurriculumPhase{
  if(mem?.state==='REGRESSED'||tx?.state==='REGRESSED')return'REOPEN';
  // A regression episode is a learning contract, not a one-game label. Once
  // reopened, require the published recovery gate (three clean comparable
  // decisions) before returning to normal progression. This prevents a single
  // clean rep from closing the episode and a later miss streak from reopening it
  // as a brand-new demotion.
  if(previousPhase==='REOPEN'&&(mem?.cleanStreak??0)<3)return'REOPEN';
  if(tx?.state==='PRINCIPLE_OWNED')return'GRADUATED';
  if(mem?.state==='MASTERED')return'TRANSFER';
  if(mem?.state==='STABILISING')return'STABILISE';
  if(mem?.state==='DUE'||mem?.state==='LEARNING')return'PRACTISE';
  if(mem?.state==='BUILDING'||!mem)return'FOUNDATION';
  return'BUILDING';
}
function graduationRule(phase:CurriculumPhase){
  if(phase==='REOPEN')return'REBUILD THREE CLEAN COMPARABLE DECISIONS BEFORE THIS SKILL CAN RETURN TO TRANSFER.';
  if(phase==='TRANSFER')return'PROVE THE SAME PRINCIPLE ACROSS REPEATED NOVEL CHAMPION OR CONTEXT TESTS; ONE CLEAN TRANSFER IS NOT ENOUGH.';
  if(phase==='STABILISE')return'REACH AT LEAST THREE CLEAN COMPARABLE DECISIONS WITH 80%+ RECENT EXECUTION.';
  if(phase==='PRACTISE')return'BUILD A REPEATED CLEAN STREAK IN THE SAME DECISION CONTEXT BEFORE OP CLIMB SPACES THE REP.';
  if(phase==='GRADUATED')return'KEEP ON SPACED MAINTENANCE. REOPEN ONLY IF COMPARABLE VERIFIED MISTAKES RETURN.';
  return'BUILD AT LEAST THREE COMPARABLE VERIFIED DECISIONS BEFORE OP CLIMB CLAIMS THIS SKILL IS STABLE.';
}
function whyNow(input:{
  focus:DecisionTwinActiveFocus|null;
  mem:ScenarioMemoryCard|null;
  tx:DecisionTransferCard|null;
  prerequisite:DecisionBehaviourKey|null;
  prerequisiteStable:boolean;
}){
  if(input.prerequisite&&!input.prerequisiteStable)return LABELS[input.prerequisite]+' is a prerequisite and is not stable enough to skip.';
  if(input.mem?.state==='REGRESSED')return'This skill was previously stable, but comparable mistakes have returned. Reopen it before adding complexity.';
  if(input.mem?.state==='DUE')return'The latest comparable decision missed the target branch, so this lesson stays active.';
  if(input.mem?.state==='STABILISING')return'The behaviour is improving, but the clean branch is not stable enough to graduate yet.';
  if(input.mem?.state==='MASTERED'&&input.tx?.state!=='PRINCIPLE_OWNED')return'Local execution is stable. The next job is proving that the principle survives a different cue.';
  if(input.focus)return input.focus.reason;
  return'OP CLIMB has enough repeated evidence to keep this skill in the development queue.';
}
function previousLessonFor(previous:ClimbCurriculum|null|undefined,key:DecisionBehaviourKey){
  const candidates=[
    previous?.currentLesson,
    previous?.nextLesson,
    ...(previous?.queue??[]),
    ...(previous?.graduated??[]),
  ].filter(Boolean) as CurriculumLesson[];
  return candidates.find(item=>item.behaviourKey===key)??null;
}
function previousRepState(previous:ClimbCurriculum|null|undefined,key:DecisionBehaviourKey){
  const lesson=previousLessonFor(previous,key);
  const stored=(previous as any)?.repLedger?.[key];
  if(typeof stored==='number')return{level:stored as ClimbRepLevel,phase:lesson?.phase??null};
  if(stored&&typeof stored==='object'&&typeof stored.level==='number'){
    return{level:stored.level as ClimbRepLevel,phase:(stored.phase??lesson?.phase??null) as CurriculumPhase|null};
  }
  return{level:lesson?.repLadder?.level??null,phase:lesson?.phase??null};
}

function makeLesson(
  key:DecisionBehaviourKey,
  twin:DecisionTwinV2Profile,
  memory:ScenarioMemoryProfile,
  transfer:DecisionTransferProfile,
  previousState:{level:ClimbRepLevel|null;phase:CurriculumPhase|null}={level:null,phase:null},
):CurriculumLesson{
  const focus=focusFor(twin,key);
  const mem=bestMemory(memory,key);
  const tx=transferCard(transfer,key);
  const prerequisite=PREREQUISITE[key]??null;
  const prerequisiteStable=prerequisite?behaviourStable(memory,transfer,prerequisite):true;
  const phase=phaseFor(mem,tx,previousState.phase);
  const readiness:CurriculumReadiness=phase==='GRADUATED'
    ?'COMPLETE'
    :prerequisite&&!prerequisiteStable
      ?'LOCKED'
      :'READY';
  const comparableGames=mem?.comparableGames??0;
  const cleanStreak=mem?.cleanStreak??0;
  const memoryStrength=mem?.memoryStrength??null;
  const transferStrength=tx?.transferStrength??null;
  const transferGames=tx?.transferGames??0;
  const transferCleanStreak=tx?.transferCleanStreak??0;
  const repLadder=buildClimbRepLadder({
    behaviourKey:key,
    phase,
    comparableGames,
    cleanStreak,
    memoryStrength,
    transferGames,
    transferCleanStreak,
    transferStrength,
    previousLevel:previousState.level,
    previousPhase:previousState.phase,
  });
  return{
    behaviourKey:key,
    label:LABELS[key],
    phase,
    readiness,
    confidence:focus?.confidence??mem?.confidence??tx?.confidence??'LOW',
    priority:focus?.priority??0,
    prerequisite,
    prerequisiteLabel:prerequisite?LABELS[prerequisite]:null,
    whyNow:whyNow({focus,mem,tx,prerequisite,prerequisiteStable}),
    gameRule:focus?.rule??mem?.targetBranch??tx?.principle??RULES[key],
    graduationRule:graduationRule(phase),
    evidence:mem?.evidence??tx?.evidence??focus?.evidence??'More repeated verified decision evidence is required.',
    comparableGames,
    cleanStreak,
    memoryStrength,
    transferStrength,
    transferGames,
    transferCleanStreak,
    repLadder,
    nextUnlock:null,
  };
}

function curriculumOrder(
  twin:DecisionTwinV2Profile,
  memory:ScenarioMemoryProfile,
  transfer:DecisionTransferProfile,
  previous:ClimbCurriculum|null|undefined,
  careerMatrix:ClimbCareerMatrix,
){
  const keys=new Set<DecisionBehaviourKey>();
  for(const item of twin.activeFive)keys.add(item.key);
  for(const card of memory.cards.filter(card=>card.state!=='BUILDING'))keys.add(card.behaviourKey);
  for(const card of transfer.cards)keys.add(card.behaviourKey);

  const expanded=[...keys];
  for(const key of expanded){
    const prerequisite=PREREQUISITE[key];
    if(prerequisite&&!behaviourStable(memory,transfer,prerequisite))keys.add(prerequisite);
  }

  const lessons=[...keys].map(key=>makeLesson(key,twin,memory,transfer,previousRepState(previous,key)));
  for(const locked of lessons.filter(item=>item.readiness==='LOCKED'&&item.prerequisite)){
    const prerequisite=lessons.find(item=>item.behaviourKey===locked.prerequisite);
    if(prerequisite&&prerequisite.readiness==='READY'){
      prerequisite.priority=Math.max(prerequisite.priority,locked.priority+1);
      prerequisite.whyNow='This foundation unlocks '+locked.label+'. OP CLIMB will not skip the prerequisite just because the later skill currently scores worse.';
    }
  }
  const phaseWeight=(phase:CurriculumPhase)=>phase==='REOPEN'?80:phase==='PRACTISE'?65:phase==='STABILISE'?55:phase==='TRANSFER'?45:phase==='FOUNDATION'?40:phase==='BUILDING'?20:0;
  const matrixScore=(key:DecisionBehaviourKey)=>careerMatrix.candidates.find(item=>item.key===key)?.priorityScore??0;
  return lessons.sort((a,b)=>{
    const aUnlock=lessons.some(item=>item.prerequisite===a.behaviourKey&&item.readiness==='LOCKED')?18:0;
    const bUnlock=lessons.some(item=>item.prerequisite===b.behaviourKey&&item.readiness==='LOCKED')?18:0;
    const readiness=(value:CurriculumReadiness)=>value==='READY'?20:value==='LOCKED'?-30:-50;
    return readiness(b.readiness)-readiness(a.readiness)
      ||matrixScore(b.behaviourKey)-matrixScore(a.behaviourKey)
      ||phaseWeight(b.phase)-phaseWeight(a.phase)
      ||bUnlock-aUnlock
      ||b.priority-a.priority
      ||a.label.localeCompare(b.label);
  });
}

function deepestAvailablePrerequisite(lesson:CurriculumLesson,lessons:CurriculumLesson[]){
  let cursor:CurriculumLesson|null=lesson;
  const seen=new Set<DecisionBehaviourKey>();
  while(cursor?.readiness==='LOCKED'&&cursor.prerequisite&&!seen.has(cursor.behaviourKey)){
    seen.add(cursor.behaviourKey);
    cursor=lessons.find(item=>item.behaviourKey===cursor?.prerequisite)??null;
  }
  return cursor?.readiness==='READY'?cursor:null;
}

function selectCurriculumLesson(
  lessons:CurriculumLesson[],
  previous:ClimbCurriculum|null|undefined,
  building:boolean,
):{current:CurriculumLesson|null;decision:CurriculumDecision}{
  const previousKey=previous?.currentLesson?.behaviourKey??null;
  if(building){
    return{
      current:null,
      decision:{
        action:'BUILDING',
        previousLesson:previousKey,
        currentLesson:null,
        changed:Boolean(previousKey),
        reason:'OP CLIMB is still collecting repeated verified decisions. No lesson owns the player attention yet.',
      },
    };
  }

  const ready=lessons.filter(item=>item.readiness==='READY');
  const previousLesson=previousKey?lessons.find(item=>item.behaviourKey===previousKey)??null:null;
  const firstReady=ready[0]??null;

  if(previousLesson?.readiness==='COMPLETE'){
    return{
      current:firstReady,
      decision:{
        action:firstReady?'ADVANCE':'COMPLETE',
        previousLesson:previousKey,
        currentLesson:firstReady?.behaviourKey??null,
        changed:Boolean(firstReady&&firstReady.behaviourKey!==previousKey),
        reason:firstReady
          ?previousLesson.label+' has graduated from repeated evidence. '+firstReady.label+' is now the highest unlocked lesson.'
          :'The previous lesson graduated and no other evidence-backed lesson is currently waiting.',
      },
    };
  }

  if(previousLesson?.readiness==='LOCKED'){
    const prerequisite=deepestAvailablePrerequisite(previousLesson,lessons)??firstReady;
    return{
      current:prerequisite,
      decision:{
        action:'PREREQUISITE',
        previousLesson:previousKey,
        currentLesson:prerequisite?.behaviourKey??null,
        changed:Boolean(prerequisite&&prerequisite.behaviourKey!==previousKey),
        reason:prerequisite
          ?previousLesson.label+' is now locked behind '+prerequisite.label+'. The prerequisite takes control until it is stable again.'
          :'The previous lesson lost a prerequisite, so OP CLIMB is holding progression until a valid foundation is available.',
      },
    };
  }

  if(previousLesson?.readiness==='READY'){
    const reopened=ready.find(item=>item.phase==='REOPEN'&&item.behaviourKey!==previousLesson.behaviourKey&&item.comparableGames>=3&&item.priority>0&&item.priority>=previousLesson.priority);
    if(reopened){
      return{
        current:reopened,
        decision:{
          action:'REOPEN',
          previousLesson:previousKey,
          currentLesson:reopened.behaviourKey,
          changed:true,
          reason:reopened.label+' has a verified regression and is now at least as urgent as the current lesson, so it temporarily interrupts the sequence.',
        },
      };
    }
    return{
      current:previousLesson,
      decision:{
        action:previousLesson.phase==='REOPEN'?'REOPEN':'KEEP',
        previousLesson:previousKey,
        currentLesson:previousLesson.behaviourKey,
        changed:false,
        reason:previousLesson.phase==='REOPEN'
          ?previousLesson.label+' remains active because verified comparable mistakes reopened a previously stable skill.'
          :'Keep drilling '+previousLesson.label+'. Its graduation gate is not met yet, so a newly worse score elsewhere does not replace it.',
      },
    };
  }

  return{
    current:firstReady,
    decision:{
      action:firstReady?'START':lessons.length?'COMPLETE':'BUILDING',
      previousLesson:previousKey,
      currentLesson:firstReady?.behaviourKey??null,
      changed:Boolean(firstReady&&firstReady.behaviourKey!==previousKey),
      reason:firstReady
        ?firstReady.label+' is the highest evidence-backed unlocked lesson, so it becomes the single active objective.'
        :lessons.length
          ?'No unlocked lesson remains. OP CLIMB is maintaining graduated skills and waiting for new verified evidence.'
          :'OP CLIMB does not yet have an evidence-backed lesson to sequence.',
    },
  };
}

export function buildClimbCurriculum(
  twin:DecisionTwinV2Profile,
  memory:ScenarioMemoryProfile,
  transfer:DecisionTransferProfile,
  generatedAt=new Date().toISOString(),
  previous:ClimbCurriculum|null=null,
):ClimbCurriculum{
  const careerMatrix=buildClimbCareerMatrix(twin,memory,transfer,{
    generatedAt,
    activeBehaviourKey:previous?.currentLesson?.behaviourKey??null,
    previous:previous?.careerMatrix??null,
  });
  const lessons=curriculumOrder(twin,memory,transfer,previous,careerMatrix);
  const graduated=lessons.filter(item=>item.readiness==='COMPLETE');
  const building=!lessons.length||twin.gamesAnalyzed<3;
  const selection=selectCurriculumLesson(lessons,previous,building);
  const current=selection.current;
  if(current)current.readiness='ACTIVE';
  const next=lessons.find(item=>item.readiness==='READY')??null;
  const blocked=lessons.filter(item=>item.readiness==='LOCKED');

  if(current){
    const unlock=lessons.find(item=>item.prerequisite===current.behaviourKey&&item.readiness==='LOCKED');
    current.nextUnlock=unlock?.label??next?.label??null;
  }
  if(next){
    const unlock=lessons.find(item=>item.prerequisite===next.behaviourKey&&item.readiness==='LOCKED');
    next.nextUnlock=unlock?.label??null;
  }

  const status:ClimbCurriculum['status']=building?'BUILDING':current?'ACTIVE':'COMPLETE';
  const repLedger:Partial<Record<DecisionBehaviourKey,CurriculumRepLedgerEntry>>={...(previous?.repLedger??{}) as any};
  for(const lesson of lessons)repLedger[lesson.behaviourKey]={level:lesson.repLadder.level,phase:lesson.phase};
  const autonomous=buildClimbAutonomousCurriculum({
    generatedAt,
    gamesAnalyzed:twin.gamesAnalyzed,
    status,
    currentLesson:current,
    nextLesson:next,
    decision:selection.decision,
    careerMatrix,
  },previous?.autonomous??null);
  return{
    version:1,
    generatedAt,
    gamesAnalyzed:twin.gamesAnalyzed,
    status,
    currentLesson:current,
    nextLesson:next,
    queue:lessons.filter(item=>item.readiness!=='COMPLETE').slice(0,5),
    graduated,
    repLedger,
    careerMatrix,
    autonomous,
    decision:selection.decision,
    summary:status==='BUILDING'
      ?'CLIMB Curriculum is still building. OP CLIMB needs repeated verified decisions before it chooses a development sequence.'
      :current
        ?'Current lesson: '+current.label+'. '+selection.decision.reason+' '+(blocked.length?String(blocked.length)+' later skill'+(blocked.length===1?' is':'s are')+' locked behind prerequisite evidence.':'The next lesson will unlock only when repeated evidence justifies moving on.')
        :'Every evidence-backed lesson currently in the curriculum is graduated. OP CLIMB will maintain them on spaced review and wait for a new verified limiter.',
    boundary:BOUNDARY,
  };
}
