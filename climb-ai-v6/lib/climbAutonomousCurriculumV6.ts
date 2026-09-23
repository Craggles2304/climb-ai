import type {DecisionBehaviourKey} from './decisionTwin';
import type {ClimbCareerMatrix} from './climbCareerMatrix';
import type {CurriculumDecision,CurriculumLesson} from './climbCurriculum';

export type AutonomousCurriculumState=
  |'BUILDING'
  |'TEACH'
  |'PRACTISE'
  |'STABILISE'
  |'TRANSFER_TEST'
  |'REOPEN'
  |'COMPLETE';

export type AutonomousCurriculumAction=
  |'WAIT_FOR_EVIDENCE'
  |'START_OBJECTIVE'
  |'HOLD_OBJECTIVE'
  |'FADE_SUPPORT'
  |'SCHEDULE_TRANSFER_TEST'
  |'RETEST_TRANSFER'
  |'PREREQUISITE_REDIRECT'
  |'REGRESSION_INTERRUPT'
  |'REPLACE_OBJECTIVE'
  |'COMPLETE_CURRICULUM';

export type AutonomousSupportPolicy='FULL'|'LIGHT'|'FADED'|'NONE';
export type AutonomousTestMode='NONE'|'LOCAL_REP'|'TRANSFER_TEST';

export interface AutonomousCurriculumGate{
  id:'EVIDENCE'|'EXECUTION'|'LOCAL_MASTERY'|'TRANSFER'|'OWNERSHIP';
  label:string;
  current:number;
  target:number;
  unit:'GAMES'|'STREAK'|'SCORE'|'STATE';
  met:boolean;
  evidence:string;
}

export interface AutonomousTestDirective{
  mode:AutonomousTestMode;
  required:boolean;
  behaviourKey:DecisionBehaviourKey|null;
  freezeBeforeGame:boolean;
  needsNovelChampionOrContext:boolean;
  scoreNotObservedAs:'NO_CHANGE';
  instruction:string;
}

export interface AutonomousReplacementDirective{
  nextBehaviourKey:DecisionBehaviourKey|null;
  nextLabel:string|null;
  reason:string;
  blockedBy:string|null;
}

export interface ClimbLearningContract{
  id:string;
  objectiveKey:DecisionBehaviourKey;
  objectiveLabel:string;
  state:Exclude<AutonomousCurriculumState,'BUILDING'|'COMPLETE'>;
  action:Exclude<AutonomousCurriculumAction,'WAIT_FOR_EVIDENCE'|'COMPLETE_CURRICULUM'>;
  startedGame:number;
  ageGames:number;
  supportPolicy:AutonomousSupportPolicy;
  testDirective:AutonomousTestDirective;
  gates:AutonomousCurriculumGate[];
  completion:number;
  stopTeachingWhen:string;
  graduateWhen:string;
  replacement:AutonomousReplacementDirective;
  decisionReason:string;
  evidenceSummary:string;
}

export interface ClimbAutonomousCurriculum{
  version:1;
  generatedAt:string;
  gamesAnalyzed:number;
  state:AutonomousCurriculumState;
  action:AutonomousCurriculumAction;
  activeContract:ClimbLearningContract|null;
  previousObjectiveKey:DecisionBehaviourKey|null;
  objectiveChanges:number;
  summary:string;
  boundary:string;
}

export interface BuildAutonomousCurriculumInput{
  generatedAt:string;
  gamesAnalyzed:number;
  status:'BUILDING'|'ACTIVE'|'COMPLETE';
  currentLesson:CurriculumLesson|null;
  nextLesson:CurriculumLesson|null;
  decision:CurriculumDecision;
  careerMatrix:ClimbCareerMatrix;
}

const BOUNDARY='Autonomous Curriculum V6 owns sequencing, not truth creation. It may choose, hold, fade, test, reopen or replace an objective only from existing verified Curriculum, Scenario Memory, Decision Transfer and Career Matrix evidence. NOT OBSERVED never counts as success or failure, local mastery never equals principle ownership, and a new weakness cannot steal the active learning contract without an explicit prerequisite or verified-regression transition.';

function clamp(value:number,min=0,max=100){
  return Math.max(min,Math.min(max,Math.round(value)));
}

function stateFor(lesson:CurriculumLesson):Exclude<AutonomousCurriculumState,'BUILDING'|'COMPLETE'>{
  if(lesson.phase==='REOPEN')return'REOPEN';
  if(lesson.phase==='TRANSFER')return'TRANSFER_TEST';
  if(lesson.phase==='STABILISE')return'STABILISE';
  if(lesson.phase==='PRACTISE')return'PRACTISE';
  return'TEACH';
}

function supportFor(lesson:CurriculumLesson,state:ClimbLearningContract['state']):AutonomousSupportPolicy{
  if(state==='REOPEN')return'FULL';
  if(state==='TEACH')return'FULL';
  if(state==='PRACTISE')return lesson.repLadder.level>=2?'LIGHT':'FULL';
  if(state==='STABILISE')return lesson.cleanStreak>=3&&lesson.comparableGames>=4?'FADED':'LIGHT';
  if(state==='TRANSFER_TEST')return'FADED';
  return'NONE';
}

function gatesFor(lesson:CurriculumLesson,state:ClimbLearningContract['state']):AutonomousCurriculumGate[]{
  const evidenceGate:AutonomousCurriculumGate={
    id:'EVIDENCE',
    label:'Comparable verified decisions',
    current:lesson.comparableGames,
    target:3,
    unit:'GAMES',
    met:lesson.comparableGames>=3,
    evidence:String(lesson.comparableGames)+' comparable verified game'+(lesson.comparableGames===1?'':'s'),
  };
  const executionGate:AutonomousCurriculumGate={
    id:'EXECUTION',
    label:'Clean local decision streak',
    current:lesson.cleanStreak,
    target:3,
    unit:'STREAK',
    met:lesson.cleanStreak>=3,
    evidence:String(lesson.cleanStreak)+' clean comparable decision'+(lesson.cleanStreak===1?'':'s')+' in the current streak',
  };
  const localMastery:AutonomousCurriculumGate={
    id:'LOCAL_MASTERY',
    label:'Scenario Memory strength',
    current:lesson.memoryStrength??0,
    target:80,
    unit:'SCORE',
    met:lesson.phase==='TRANSFER'||lesson.phase==='GRADUATED'||(lesson.memoryStrength??0)>=80,
    evidence:lesson.memoryStrength===null?'Scenario Memory is still building':String(lesson.memoryStrength)+'/100 Scenario Memory',
  };
  const transferGate:AutonomousCurriculumGate={
    id:'TRANSFER',
    label:'Novel-condition evidence',
    current:lesson.transferGames,
    target:3,
    unit:'GAMES',
    met:lesson.transferGames>=3,
    evidence:String(lesson.transferGames)+' verified novel-condition game'+(lesson.transferGames===1?'':'s'),
  };
  const ownershipGate:AutonomousCurriculumGate={
    id:'OWNERSHIP',
    label:'Decision Transfer strength',
    current:lesson.transferStrength??0,
    target:80,
    unit:'SCORE',
    met:lesson.phase==='GRADUATED',
    evidence:lesson.phase==='GRADUATED'
      ?'Decision Transfer has marked the principle owned.'
      :lesson.transferStrength===null
        ?'Transfer has not produced enough evidence yet.'
        :String(lesson.transferStrength)+'/100 transfer strength; Decision Transfer has not marked the principle owned yet.',
  };

  if(state==='TEACH')return[evidenceGate];
  if(state==='PRACTISE')return[evidenceGate,executionGate];
  if(state==='STABILISE')return[evidenceGate,executionGate,localMastery];
  if(state==='TRANSFER_TEST')return[localMastery,transferGate,ownershipGate];
  return[evidenceGate,executionGate,localMastery];
}

function completionFor(lesson:CurriculumLesson,state:ClimbLearningContract['state'],gates:AutonomousCurriculumGate[]){
  const met=gates.filter(gate=>gate.met).length;
  const gateProgress=gates.length?met/gates.length:0;
  const base=state==='TEACH'?10:state==='PRACTISE'?30:state==='STABILISE'?55:state==='TRANSFER_TEST'?78:35;
  const ceiling=state==='TEACH'?29:state==='PRACTISE'?54:state==='STABILISE'?77:state==='TRANSFER_TEST'?99:60;
  const raw=base+(ceiling-base)*gateProgress;
  if(lesson.phase==='REOPEN')return clamp(Math.min(raw,59));
  return clamp(raw);
}

function testDirectiveFor(lesson:CurriculumLesson,state:ClimbLearningContract['state']):AutonomousTestDirective{
  if(state==='TRANSFER_TEST'){
    return{
      mode:'TRANSFER_TEST',
      required:true,
      behaviourKey:lesson.behaviourKey,
      freezeBeforeGame:true,
      needsNovelChampionOrContext:true,
      scoreNotObservedAs:'NO_CHANGE',
      instruction:'Deliberately test '+lesson.label+' under a genuinely different champion or decision context. Freeze the test before the match; if the novel condition never appears, award no credit and no failure.',
    };
  }
  if(state==='TEACH'||state==='PRACTISE'||state==='STABILISE'||state==='REOPEN'){
    return{
      mode:'LOCAL_REP',
      required:true,
      behaviourKey:lesson.behaviourKey,
      freezeBeforeGame:true,
      needsNovelChampionOrContext:false,
      scoreNotObservedAs:'NO_CHANGE',
      instruction:'Create one draft-relevant repetition of '+lesson.label+' when the target decision window is genuinely available. Do not force the objective into an irrelevant draft.',
    };
  }
  return{
    mode:'NONE',
    required:false,
    behaviourKey:null,
    freezeBeforeGame:true,
    needsNovelChampionOrContext:false,
    scoreNotObservedAs:'NO_CHANGE',
    instruction:'No deliberate test is currently required.',
  };
}

function replacementFor(
  current:CurriculumLesson,
  next:CurriculumLesson|null,
  matrix:ClimbCareerMatrix,
):AutonomousReplacementDirective{
  if(next){
    return{
      nextBehaviourKey:next.behaviourKey,
      nextLabel:next.label,
      reason:current.label+' keeps the active slot until its ownership gate is complete. '+next.label+' is currently the next unlocked lesson.',
      blockedBy:null,
    };
  }
  const deferred=matrix.deferred.find(item=>item.state==='LOCKED')??matrix.deferred[0]??null;
  return{
    nextBehaviourKey:deferred?.key??null,
    nextLabel:deferred?.label??null,
    reason:deferred
      ?deferred.label+' is visible in the Career Matrix but cannot replace '+current.label+' yet.'
      :'No evidence-backed replacement objective is waiting yet.',
    blockedBy:deferred?.state==='LOCKED'
      ?deferred.deferredReason??'A prerequisite is not yet stable.'
      :null,
  };
}

function sameObjective(previous:ClimbAutonomousCurriculum|null|undefined,key:DecisionBehaviourKey){
  return previous?.activeContract?.objectiveKey===key;
}

function actionFor(
  input:BuildAutonomousCurriculumInput,
  state:ClimbLearningContract['state'],
  previous:ClimbAutonomousCurriculum|null|undefined,
):ClimbLearningContract['action']{
  const same=sameObjective(previous,input.currentLesson!.behaviourKey);
  if(input.decision.action==='PREREQUISITE')return'PREREQUISITE_REDIRECT';
  if(input.decision.action==='REOPEN'&&input.decision.changed)return'REGRESSION_INTERRUPT';
  if(input.decision.action==='ADVANCE')return'REPLACE_OBJECTIVE';
  if(!same){
    if(!previous?.activeContract&&state==='TRANSFER_TEST')return'SCHEDULE_TRANSFER_TEST';
    return previous?.activeContract?'REPLACE_OBJECTIVE':'START_OBJECTIVE';
  }
  if(state==='TRANSFER_TEST'){
    return previous?.activeContract?.state==='TRANSFER_TEST'?'RETEST_TRANSFER':'SCHEDULE_TRANSFER_TEST';
  }
  if(state==='STABILISE'){
    const nextSupport=supportFor(input.currentLesson!,state);
    if(previous?.activeContract?.supportPolicy!==nextSupport)return'FADE_SUPPORT';
  }
  return'HOLD_OBJECTIVE';
}

function stopTeachingWhen(state:ClimbLearningContract['state']){
  if(state==='TEACH')return'Stop explicit trigger teaching only after repeated comparable evidence is strong enough to move into deliberate practice.';
  if(state==='PRACTISE')return'Stop full coaching only after the correct branch repeats without needing the original explanation every time.';
  if(state==='STABILISE')return'Stop local drilling only after Scenario Memory reaches local mastery from repeated clean comparable decisions.';
  if(state==='TRANSFER_TEST')return'Stop testing only when Decision Transfer marks the principle owned across repeated novel conditions.';
  return'Stop remediation only after the reopened skill is stable enough to return to its previously earned progression layer.';
}

function evidenceSummary(lesson:CurriculumLesson,gates:AutonomousCurriculumGate[]){
  const blocked=gates.filter(gate=>!gate.met);
  if(!blocked.length)return lesson.evidence;
  return blocked.map(gate=>gate.label+': '+gate.evidence).join(' · ');
}

export function buildClimbAutonomousCurriculum(
  input:BuildAutonomousCurriculumInput,
  previous:ClimbAutonomousCurriculum|null=null,
):ClimbAutonomousCurriculum{
  const previousKey=previous?.activeContract?.objectiveKey??null;

  if(input.status==='BUILDING'||!input.currentLesson){
    const complete=input.status==='COMPLETE';
    return{
      version:1,
      generatedAt:input.generatedAt,
      gamesAnalyzed:input.gamesAnalyzed,
      state:complete?'COMPLETE':'BUILDING',
      action:complete?'COMPLETE_CURRICULUM':'WAIT_FOR_EVIDENCE',
      activeContract:null,
      previousObjectiveKey:previousKey,
      objectiveChanges:previous?.objectiveChanges??0,
      summary:complete
        ?'Autonomous Curriculum has no unfinished evidence-backed objective. Graduated principles stay on maintenance until verified regression or new repeated evidence creates another contract.'
        :'Autonomous Curriculum is waiting for enough repeated verified evidence to create a learning contract.',
      boundary:BOUNDARY,
    };
  }

  const lesson=input.currentLesson;
  const state=stateFor(lesson);
  const action=actionFor(input,state,previous);
  const same=sameObjective(previous,lesson.behaviourKey);
  const startedGame=same
    ?previous!.activeContract!.startedGame
    :input.gamesAnalyzed;
  const objectiveChanges=(previous?.objectiveChanges??0)+(previous?.activeContract&&previous.activeContract.objectiveKey!==lesson.behaviourKey?1:0);
  const gates=gatesFor(lesson,state);
  const supportPolicy=supportFor(lesson,state);
  const testDirective=testDirectiveFor(lesson,state);
  const replacement=replacementFor(lesson,input.nextLesson,input.careerMatrix);
  const contractId=same
    ?previous!.activeContract!.id
    :'learning-contract:'+lesson.behaviourKey.toLowerCase()+':g'+String(startedGame);

  const contract:ClimbLearningContract={
    id:contractId,
    objectiveKey:lesson.behaviourKey,
    objectiveLabel:lesson.label,
    state,
    action,
    startedGame,
    ageGames:Math.max(1,input.gamesAnalyzed-startedGame+1),
    supportPolicy,
    testDirective,
    gates,
    completion:completionFor(lesson,state,gates),
    stopTeachingWhen:stopTeachingWhen(state),
    graduateWhen:'Graduate only when the existing Curriculum/Decision Transfer evidence marks the principle owned. Autonomous Curriculum does not infer graduation from its own score.',
    replacement,
    decisionReason:input.decision.reason,
    evidenceSummary:evidenceSummary(lesson,gates),
  };

  const actionText=action==='START_OBJECTIVE'
    ?'Start '+lesson.label+'.'
    :action==='REPLACE_OBJECTIVE'
      ?'Replace the previous objective with '+lesson.label+'.'
      :action==='PREREQUISITE_REDIRECT'
        ?'Redirect the learning contract to prerequisite '+lesson.label+'.'
        :action==='REGRESSION_INTERRUPT'
          ?'Verified regression interrupts the current sequence; reopen '+lesson.label+'.'
          :action==='SCHEDULE_TRANSFER_TEST'
            ?'Local mastery is secure enough to deliberately test transfer for '+lesson.label+'.'
            :action==='RETEST_TRANSFER'
              ?'Keep testing '+lesson.label+' under novel conditions; ownership is not proven yet.'
              :action==='FADE_SUPPORT'
                ?'Keep '+lesson.label+' active but reduce coaching support to test more independent execution.'
                :'Hold '+lesson.label+' as the single active learning contract.';

  return{
    version:1,
    generatedAt:input.generatedAt,
    gamesAnalyzed:input.gamesAnalyzed,
    state,
    action,
    activeContract:contract,
    previousObjectiveKey:previousKey,
    objectiveChanges,
    summary:actionText+' '+contract.evidenceSummary+' Next replacement: '+(replacement.nextLabel??'none yet')+'.',
    boundary:BOUNDARY,
  };
}

export const CLIMB_AUTONOMOUS_CURRICULUM_BOUNDARY=BOUNDARY;
