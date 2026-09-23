import {buildDecisionTwinV2,type DecisionTwinV2Profile} from './decisionTwinV2';
import {buildScenarioMemory,type ScenarioMemoryProfile,type ScenarioMemoryCard} from './scenarioMemory';
import {buildDecisionTransfer,selectDecisionTransferPrime,type DecisionTransferProfile,type DecisionTransferPrime} from './decisionTransfer';
import {buildClimbCurriculum,type ClimbCurriculum,type CurriculumLesson} from './climbCurriculum';
import {buildDraftSituationContext,type DecisionBehaviourKey,type DecisionSituationTag} from './decisionTwin';
import {buildClimbMatchMission,type ClimbMatchMission} from './climbMissionDesign';
import {buildClimbCoachTwin,selectClimbCoachIntervention,type ClimbCoachTwin,type ClimbCoachIntervention} from './climbCoachTwin';
import {buildClimbCoachingStrategy,type ClimbCoachingStrategy} from './climbCoachingStrategy';
import {buildClimbIntentProbe,answerClimbIntentProbe,type ClimbIntentProbe} from './climbIntentGap';
import {buildClimbAutonomyProfile,type ClimbAutonomyProfile,type ClimbAutonomyCard} from './climbAutonomy';
import {buildClimbInterventionValueProfile,type ClimbInterventionValueProfile,type ClimbInterventionValueCard} from './climbInterventionValue';
import {buildClimbExperimentSchedule,type ClimbExperimentSchedule} from './climbExperimentScheduler';
import type {ClimbLearningContract} from './climbAutonomousCurriculumV6';
import {buildDecisionGraph,type DecisionGraph,type LockedDecisionPlan} from './decisionGraph';
import type {HistoryAnalysisRow} from './riot/proHistory';
import type {ProMatchAnalysis} from './riot/proAnalysis';
import type {StrengthTimeline,FightReview} from './riot/liveStrength';

export type SimulationPolicyId='PRODUCT'|'ALWAYS_SCAFFOLD'|'EARLY_FADE';

export type SimulationArchetypeId=
  |'FAST_LEARNER'
  |'STEADY_LEARNER'
  |'STUBBORN_REPEATER'
  |'CONTEXT_MEMORIZER'
  |'REGRESSION_CASE'
  |'SPARSE_EVIDENCE';

export interface SimulationArchetype{
  id:SimulationArchetypeId;
  label:string;
  initialSkill:number;
  learningRate:number;
  maxSkill:number;
  novelPenalty:number;
  notObservedRate:number;
  irrelevantDraftRate:number;
  regressionAt:number|null;
  regressionDrop:number;
}

export interface SimulationGameEvent{
  game:number;
  champion:string;
  situationTag:DecisionSituationTag;
  curriculumStatus:ClimbCurriculum['status'];
  curriculumPhase:CurriculumLesson['phase']|null;
  repLevel:number|null;
  repStage:string|null;
  missionStatus:ClimbMatchMission['status']|null;
  missionReview:string;
  coachMethod:string|null;
  coachSelectionMode:string|null;
  coachReview:string;
  strategyMode:string|null;
  strategyIntervened:boolean|null;
  strategyReview:string;
  strategyIntentDiagnosis:string|null;
  strategyIntentEvidenceStreak:number|null;
  intentCorrect:boolean|null;
  intentDiagnosis:string;
  autonomyState:string|null;
  autonomyStrength:number|null;
  interventionValueState:string|null;
  interventionResponseDifference:number|null;
  experimentType:string|null;
  experimentPolicy:string|null;
  experimentReview:string;
  learningContractId:string|null;
  autonomousState:string|null;
  autonomousAction:string|null;
  autonomousSupportPolicy:string|null;
  autonomousTestMode:string|null;
  transferPrime:boolean;
  outcome:'GOOD'|'IMPROVE'|'NOT_OBSERVED';
  latentSkill:number;
  comparableGames:number;
  memoryState:string|null;
  transferState:string|null;
  postRepLevel:number|null;
  postCurriculumPhase:CurriculumLesson['phase']|null;
}

export interface SimulationCareerReport{
  archetype:SimulationArchetypeId;
  label:string;
  games:number;
  missionsReady:number;
  missionsNotRelevant:number;
  notObserved:number;
  goodDecisions:number;
  improveDecisions:number;
  promotions:number;
  demotions:number;
  maxLevel:number;
  finalLevel:number|null;
  finalPhase:string|null;
  principleOwned:boolean;
  finalMemoryState:string|null;
  finalTransferState:string|null;
  finalSkill:number;
  invariants:string[];
  events:SimulationGameEvent[];
}

export interface ClimbSimulationLabReport{
  version:1;
  gamesPerCareer:number;
  careers:SimulationCareerReport[];
  totalGames:number;
  totalPromotions:number;
  totalDemotions:number;
  totalNotObserved:number;
  invariantViolations:string[];
  summary:string;
}

type ProfileBundle={
  twin:DecisionTwinV2Profile;
  memory:ScenarioMemoryProfile;
  transfer:DecisionTransferProfile;
  curriculum:ClimbCurriculum;
  coachTwin:ClimbCoachTwin;
  autonomy:ClimbAutonomyProfile;
  interventionValue:ClimbInterventionValueProfile;
};

const TARGET_BEHAVIOUR:DecisionBehaviourKey='FIGHT_SELECTION';

export const DEFAULT_SIMULATION_ARCHETYPES:SimulationArchetype[]=[
  {id:'FAST_LEARNER',label:'Fast learner',initialSkill:.58,learningRate:.14,maxSkill:.96,novelPenalty:.05,notObservedRate:.04,irrelevantDraftRate:.04,regressionAt:null,regressionDrop:0},
  {id:'STEADY_LEARNER',label:'Steady learner',initialSkill:.46,learningRate:.085,maxSkill:.93,novelPenalty:.08,notObservedRate:.07,irrelevantDraftRate:.08,regressionAt:null,regressionDrop:0},
  {id:'STUBBORN_REPEATER',label:'Stubborn repeater',initialSkill:.22,learningRate:.008,maxSkill:.46,novelPenalty:.20,notObservedRate:.05,irrelevantDraftRate:.05,regressionAt:null,regressionDrop:0},
  {id:'CONTEXT_MEMORIZER',label:'Context memorizer',initialSkill:.54,learningRate:.10,maxSkill:.91,novelPenalty:.48,notObservedRate:.05,irrelevantDraftRate:.05,regressionAt:null,regressionDrop:0},
  {id:'REGRESSION_CASE',label:'Regression case',initialSkill:.52,learningRate:.10,maxSkill:.92,novelPenalty:.08,notObservedRate:.05,irrelevantDraftRate:.05,regressionAt:.62,regressionDrop:.42},
  {id:'SPARSE_EVIDENCE',label:'Sparse evidence',initialSkill:.48,learningRate:.075,maxSkill:.90,novelPenalty:.10,notObservedRate:.38,irrelevantDraftRate:.30,regressionAt:null,regressionDrop:0},
];

function clamp(value:number,min=0,max=1){return Math.max(min,Math.min(max,value))}
function rng(seed:number){
  let state=(seed>>>0)||1;
  return()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/4294967296;
  };
}
function bestMemory(memory:ScenarioMemoryProfile){
  return memory.cards
    .filter(card=>card.behaviourKey===TARGET_BEHAVIOUR)
    .sort((a,b)=>b.comparableGames-a.comparableGames||b.memoryStrength-a.memoryStrength)[0]??null;
}
function transferCard(transfer:DecisionTransferProfile){
  return transfer.cards.find(card=>card.behaviourKey===TARGET_BEHAVIOUR)??null;
}
function lessonFor(curriculum:ClimbCurriculum):CurriculumLesson|null{
  if(curriculum.currentLesson?.behaviourKey===TARGET_BEHAVIOUR)return curriculum.currentLesson;
  return curriculum.queue.find(item=>item.behaviourKey===TARGET_BEHAVIOUR)
    ??curriculum.graduated.find(item=>item.behaviourKey===TARGET_BEHAVIOUR)
    ??null;
}
function rebuild(rows:HistoryAnalysisRow[],previous:ClimbCurriculum|null,at:string):ProfileBundle{
  const twin=buildDecisionTwinV2(rows,at);
  const memory=buildScenarioMemory(rows,at);
  const transfer=buildDecisionTransfer(rows,memory,at);
  const curriculum=buildClimbCurriculum(twin,memory,transfer,at,previous);
  const coachTwin=buildClimbCoachTwin(rows,at);
  const autonomy=buildClimbAutonomyProfile(rows,at);
  const interventionValue=buildClimbInterventionValueProfile(rows,at);
  return{twin,memory,transfer,curriculum,coachTwin,autonomy,interventionValue};
}

type DraftKind='SOURCE'|'NOVEL_PICK'|'NOVEL_CHAMPION'|'IRRELEVANT';
function draftFor(kind:DraftKind,game:number){
  if(kind==='SOURCE')return{
    champion:'Jinx',
    enemies:[
      {champion:'Nocturne',role:'JUNGLE'},
      {champion:'Rakan',role:'SUPPORT'},
      {champion:'Orianna',role:'MID'},
      {champion:'Ornn',role:'TOP'},
      {champion:'Jhin',role:'ADC'},
    ],
  };
  if(kind==='NOVEL_PICK')return{
    champion:game%2?'Ashe':'Caitlyn',
    enemies:[
      {champion:'Blitzcrank',role:'SUPPORT'},
      {champion:'Pyke',role:'MID'},
      {champion:'Lux',role:'SUPPORT'},
      {champion:'Garen',role:'TOP'},
      {champion:'Ezreal',role:'ADC'},
    ],
  };
  if(kind==='NOVEL_CHAMPION')return{
    champion:game%2?'Ashe':'Caitlyn',
    enemies:[
      {champion:'Nocturne',role:'JUNGLE'},
      {champion:'Rakan',role:'SUPPORT'},
      {champion:'Orianna',role:'MID'},
      {champion:'Ornn',role:'TOP'},
      {champion:'Jhin',role:'ADC'},
    ],
  };
  return{
    champion:'Jinx',
    enemies:[
      {champion:'Garen',role:'TOP'},
      {champion:'Master Yi',role:'JUNGLE'},
      {champion:'Corki',role:'MID'},
      {champion:'Ezreal',role:'ADC'},
      {champion:'Soraka',role:'SUPPORT'},
    ],
  };
}
function chooseDraft(input:{
  random:()=>number;
  archetype:SimulationArchetype;
  curriculum:ClimbCurriculum;
  game:number;
}):DraftKind{
  if(input.random()<input.archetype.irrelevantDraftRate)return'IRRELEVANT';
  const lesson=lessonFor(input.curriculum);
  const advanced=Boolean(lesson&&(lesson.phase==='TRANSFER'||lesson.repLadder.level>=4));
  if(!advanced)return'SOURCE';
  return input.game%3===0?'NOVEL_CHAMPION':'NOVEL_PICK';
}

function fakeFight(clean:boolean,atSeconds:number):FightReview{
  return{
    atSeconds,
    category:clean?'STRENGTH':'WEAKNESS',
    outcome:clean?'ASSIST':'DEATH',
    opponent:'Pantheon',
    opponentChampion:'Pantheon',
    score:clean?18:-24,
    verdict:clean?'EVEN':'THEM_STRONGER',
    headline:clean?'Synthetic clean fight selection':'Synthetic red-state death',
    summary:clean
      ?'The simulated player waited for the planned entry condition and produced a positive fight result.'
      :'The simulated player entered while the visible state was already enemy-favoured.',
    evidence:{
      youLevel:11,
      themLevel:clean?11:12,
      levelDelta:clean?0:-1,
      youItemGold:6200,
      themItemGold:clean?6150:6900,
      itemGoldDelta:clean?50:-700,
      currentGold:420,
      healthPct:.82,
      manaPct:.68,
    },
    why:[clean?'The entry matched the planned condition.':'The enemy held the stronger visible state.'],
    howToWin:['Wait for the frozen fight trigger before committing.'],
    howYouLose:['Let first contact choose the fight.'],
    betterDecision:['Decline the first contact and enter only after the planned trigger becomes true.'],
    limitation:'Synthetic Simulation Lab evidence generated to exercise the coaching pipeline.',
  };
}
function fakeAnalysis(champion:string,clean:boolean|null,atSeconds:number):ProMatchAnalysis{
  const observed=clean!==null;
  const metrics:any={};
  if(observed){
    const score=clean?90:38;
    metrics.fight_selection={
      key:'fight_selection',
      label:'FIGHT SELECTION',
      score,
      value:String(score)+'/100',
      status:'DERIVED',
      confidence:'HIGH',
      sources:['SIMULATION_LAB'],
      summary:'Synthetic comparable fight-selection decision.',
      evidence:[{atSeconds,label:clean?'Clean decision':'Red-state decision',detail:clean?'Waited for the planned trigger.':'Entered before the planned trigger was true.'}],
    };
  }
  return{
    version:1,
    champion,
    role:'ADC',
    evidenceSources:['SIMULATION_LAB'],
    metrics,
    leakSignals:observed&&!clean?[{
      key:'RED_STATE',
      label:'Bad fight selection',
      count:1,
      severity:'ACTIVE',
      detail:'Synthetic red-state fight used by CLIMB Simulation Lab.',
      evidenceSeconds:[atSeconds],
    }]:[],
    fingerprint:{
      primary:!observed?'NO COMPARABLE DECISION':clean?'CLEAN FIGHT SELECTION':'BAD FIGHT SELECTION',
      sequence:!observed?['No comparable decision window']:clean?['Recognise trigger','Wait','Enter cleanly']:['First contact','Enter early','Enemy-favoured fight'],
      confidence:observed?'HIGH':'LOW',
      explanation:'Synthetic career evidence for CLIMB Simulation Lab.',
    },
  };
}
function fakeSummary(clean:boolean|null,atSeconds:number):StrengthTimeline{
  return{
    points:[],
    opportunities:[],
    fightReviews:clean===null?[]:[fakeFight(clean,atSeconds)],
    strongestWindow:null,
    weakestWindow:null,
    modelNote:'Synthetic Simulation Lab strength timeline.',
  };
}
function chanceFor(input:{
  archetype:SimulationArchetype;
  skill:number;
  level:number;
  novel:boolean;
  missionReady:boolean;
  coachingAdjustment?:number;
}){
  const difficultyPenalty=[0,.00,.06,.13,.22,.29][Math.max(1,Math.min(5,input.level))]??0;
  const novelty=input.novel?input.archetype.novelPenalty:0;
  const coaching=input.missionReady?.045:0;
  return clamp(.10+input.skill*.92-difficultyPenalty-novelty+coaching+(input.coachingAdjustment??0),.04,.97);
}
function applyLearning(input:{
  archetype:SimulationArchetype;
  skill:number;
  clean:boolean;
  novel:boolean;
}){
  const novelScale=input.novel&&input.archetype.id==='CONTEXT_MEMORIZER'?.12:1;
  const signal=input.clean?1:.32;
  const gain=input.archetype.learningRate*novelScale*signal*(1-input.skill);
  return Math.min(input.archetype.maxSkill,clamp(input.skill+gain));
}

function policyStrategy(
  strategy:ClimbCoachingStrategy|null,
  mission:ClimbMatchMission|null,
  policy:SimulationPolicyId,
):ClimbCoachingStrategy|null{
  if(!strategy||!mission||mission.status!=='READY'||policy==='PRODUCT')return strategy;
  if(policy==='ALWAYS_SCAFFOLD'){
    if(strategy.intervene)return strategy;
    return{
      ...strategy,
      id:strategy.id+':bench-always-scaffold',
      mode:'REINFORCE',
      intervene:true,
      deliveryPolicy:'LIGHT',
      title:'BENCH · ALWAYS SCAFFOLD',
      playerMessage:'BENCH BASELINE: KEEP ONE SUPPORT CUE ACTIVE.',
      decision:'Synthetic Coach Bench baseline keeps light scaffolding active instead of testing autonomy.',
      coachDirective:'Keep one concise cue active for the matching mission.',
      successDefinition:'Synthetic benchmark only.',
      autonomyTest:false,
      experimentId:null,
      experimentType:null,
      experimentInformationNeed:null,
    };
  }
  if(mission.repLevel<2)return strategy;
  return{
    ...strategy,
    id:strategy.id+':bench-early-fade',
    mode:'FADE',
    intervene:false,
    deliveryPolicy:'NONE',
    title:'BENCH · EARLY FADE',
    playerMessage:'BENCH BASELINE: REMOVE SUPPORT EARLY.',
    decision:'Synthetic Coach Bench baseline fades support from Rep Level 2 without production safety gates.',
    coachDirective:'Remove the adaptive cue and observe independent execution.',
    successDefinition:'Synthetic benchmark only.',
    autonomyTest:true,
    experimentId:null,
    experimentType:null,
    experimentInformationNeed:null,
  };
}
function benchCoachingAdjustment(strategy:ClimbCoachingStrategy|null,skill:number,enabled:boolean){
  if(!enabled||!strategy)return 0;
  if(strategy.mode==='TEACH')return skill<.62?.10:.045;
  if(strategy.mode==='REINFORCE')return skill<.72?.065:.03;
  if(strategy.mode==='DIAGNOSE')return skill<.58?.045:.02;
  if(skill<.42)return-.12;
  if(skill<.58)return-.07;
  if(skill<.70)return-.025;
  return .005;
}
function transitionInvariant(input:{
  archetype:SimulationArchetypeId;
  game:number;
  preLevel:number|null;
  postLevel:number|null;
  preLesson:CurriculumLesson|null;
  postLesson:CurriculumLesson|null;
  preMemory:ScenarioMemoryCard|null;
  postMemory:ScenarioMemoryCard|null;
  preTransfer:ReturnType<typeof transferCard>;
  postTransfer:ReturnType<typeof transferCard>;
  mission:ClimbMatchMission|null;
  transferPrime:DecisionTransferPrime|null;
  review:DecisionGraph['summary']['climbMission'];
  intervention:ClimbCoachIntervention|null;
  coachReview:DecisionGraph['summary']['coachIntervention'];
  strategy:ClimbCoachingStrategy|null;
  strategyReview:DecisionGraph['summary']['coachingStrategy'];
  intentProbe:ClimbIntentProbe|null;
  intentReview:DecisionGraph['summary']['intentGap'];
  postAutonomy:ClimbAutonomyCard|null;
  postInterventionValue:ClimbInterventionValueCard|null;
  experimentSchedule:ClimbExperimentSchedule|null;
  experimentReview:DecisionGraph['summary']['experimentSchedule'];
  learningContract:NonNullable<ClimbCurriculum['autonomous']>['activeContract']|null;
}){
  const errors:string[]=[];
  const prefix=input.archetype+' game '+String(input.game)+': ';
  if(input.review.status==='NOT_OBSERVED'&&input.preLevel!==null&&input.postLevel!==null&&input.postLevel!==input.preLevel){
    errors.push(prefix+'NOT_OBSERVED changed Rep Ladder difficulty from '+String(input.preLevel)+' ('+String(input.preLesson?.behaviourKey??'none')+' / '+String(input.preLesson?.phase??'none')+' / memory '+String(input.preMemory?.state??'none')+' / transfer '+String(input.preTransfer?.state??'none')+') to '+String(input.postLevel)+' ('+String(input.postLesson?.behaviourKey??'none')+' / '+String(input.postLesson?.phase??'none')+' / memory '+String(input.postMemory?.state??'none')+' / transfer '+String(input.postTransfer?.state??'none')+').');
  }
  if(input.review.status==='NOT_OBSERVED'&&input.preLesson?.behaviourKey!==input.postLesson?.behaviourKey){
    errors.push(prefix+'NOT_OBSERVED changed active objective from '+String(input.preLesson?.behaviourKey??'none')+' to '+String(input.postLesson?.behaviourKey??'none')+'.');
  }
  if(input.preLevel!==null&&input.postLevel!==null&&input.postLevel<input.preLevel-1){
    errors.push(prefix+'difficulty demoted more than one layer ('+String(input.preLevel)+' → '+String(input.postLevel)+').');
  }
  if(input.mission&&input.review.missionId!==input.mission.id){
    errors.push(prefix+'post-game review did not use the frozen pre-game mission.');
  }
  if(input.intervention&&input.coachReview.interventionId!==input.intervention.id){
    errors.push(prefix+'post-game Coach Twin review did not use the frozen pre-game coaching intervention.');
  }
  if(input.intervention&&input.coachReview.missionId!==input.intervention.missionId){
    errors.push(prefix+'Coach Twin review detached from its frozen mission.');
  }
  if(input.coachReview.status==='NOT_OBSERVED'&&input.review.status!=='NOT_OBSERVED'){
    errors.push(prefix+'Coach Twin became NOT_OBSERVED while its frozen mission was graded.');
  }
  if(input.strategy&&input.strategyReview.strategyId!==input.strategy.id){
    errors.push(prefix+'post-game Coaching Strategy review did not use the frozen pre-game support policy.');
  }
  if(input.strategy&&input.strategyReview.missionId!==input.strategy.missionId){
    errors.push(prefix+'Coaching Strategy review detached from its frozen mission.');
  }
  if(input.strategy?.intervene===false&&input.intervention){
    errors.push(prefix+'FADE/no-intervention strategy still created a Coach Twin intervention.');
  }
  if(input.strategy?.deliveryPolicy==='NONE'&&input.coachReview.active){
    errors.push(prefix+'no-intervention strategy still produced an active Coach Twin review.');
  }
  if(input.strategyReview.status==='NOT_OBSERVED'&&input.review.status!=='NOT_OBSERVED'){
    errors.push(prefix+'Coaching Strategy became NOT_OBSERVED while its frozen mission was graded.');
  }
  if(input.learningContract&&input.mission?.learningContractId!==input.learningContract.id){
    errors.push(prefix+'frozen mission detached from Autonomous Curriculum contract '+input.learningContract.id+'.');
  }
  if(input.learningContract&&input.mission?.autonomousSupportPolicy!==input.learningContract.supportPolicy){
    errors.push(prefix+'frozen mission support policy '+String(input.mission?.autonomousSupportPolicy)+' does not match contract '+input.learningContract.supportPolicy+'.');
  }
  if(input.learningContract&&['FULL','LIGHT'].includes(input.learningContract.supportPolicy)&&input.strategy?.deliveryPolicy==='NONE'){
    errors.push(prefix+'Autonomous Curriculum '+input.learningContract.supportPolicy+' floor was violated by a no-support strategy.');
  }
  if(input.learningContract?.testDirective.mode==='TRANSFER_TEST'&&input.mission?.status==='READY'&&!input.transferPrime){
    errors.push(prefix+'transfer-test contract created a READY mission without a frozen transfer prime.');
  }
  if(input.review.status==='NOT_OBSERVED'&&input.learningContract&&input.postLesson?.behaviourKey!==input.learningContract.objectiveKey){
    errors.push(prefix+'NOT_OBSERVED detached the active lesson from learning contract '+input.learningContract.objectiveKey+'.');
  }

  if(input.intentProbe?.response&&input.review.status==='MISSED'){
    const expected=input.intentProbe.response.correct?'EXECUTION_GAP':'KNOWLEDGE_GAP';
    if(input.intentReview.diagnosis!==expected){
      errors.push(prefix+'Intent Gap collapsed knowing and doing: expected '+expected+' but got '+String(input.intentReview.diagnosis)+'.');
    }
  }
  if(input.review.status==='NOT_OBSERVED'&&input.intentReview.diagnosis!=='NO_EVIDENCE'){
    errors.push(prefix+'NOT_OBSERVED created an Intent Gap diagnosis.');
  }
  if(input.postAutonomy?.state==='AUTONOMOUS'){
    if(input.postAutonomy.fadedGames<3||input.postAutonomy.independentAlignedGames<3||input.postAutonomy.independentAlignedStreak<2){
      errors.push(prefix+'Autonomy was claimed without repeated clean unscaffolded intent-aligned evidence.');
    }
  }
  if(input.postAutonomy?.state==='SUPPORT_DEPENDENT'&&(input.postAutonomy.supportDependenceGap??0)<=0){
    errors.push(prefix+'Support dependence was claimed without cleaner supported execution than faded execution.');
  }
  if(input.postInterventionValue&&input.postInterventionValue.state!=='BUILDING'){
    if(input.postInterventionValue.supportedObserved<3||input.postInterventionValue.fadedObserved<3||input.postInterventionValue.comparablePairs<3){
      errors.push(prefix+'Intervention Value left BUILDING without enough matched supported/faded evidence.');
    }
  }
  if(input.postInterventionValue?.state==='STRONG_SUPPORT_ASSOCIATED_LIFT'&&input.postInterventionValue.comparablePairs<5){
    errors.push(prefix+'Strong Intervention Value signal appeared before five matched pairs.');
  }
  if(input.experimentSchedule&&input.experimentReview.experimentId!==input.experimentSchedule.id){
    errors.push(prefix+'post-game experiment review did not use the frozen pre-game experiment.');
  }
  if(input.experimentSchedule?.status==='SCHEDULED'&&input.review.status!=='NOT_OBSERVED'&&input.experimentReview.status!=='COMPLETED'){
    errors.push(prefix+'scheduled experiment was observed but did not complete under the requested support policy'
      +' · experiment='+String(input.experimentSchedule.experimentType)
      +' requested='+String(input.experimentSchedule.requestedDeliveryPolicy)
      +' observed='+String(input.experimentReview.observedDeliveryPolicy)
      +' strategy='+String(input.strategy?.mode??'NONE')+'/'+String(input.strategy?.deliveryPolicy??'NONE')
      +' contract='+String(input.learningContract?.supportPolicy??'NONE')
      +' autonomous='+String(input.learningContract?.state??'NONE')
      +'.');
  }
  if(input.experimentSchedule?.requestedDeliveryPolicy==='NONE'&&input.experimentSchedule.status==='SCHEDULED'&&input.strategy?.intervene){
    errors.push(prefix+'scheduled FADE experiment still delivered adaptive coaching support.');
  }
  if(input.experimentSchedule?.status==='DEFERRED'&&input.experimentSchedule.requestedDeliveryPolicy==='NONE'){
    errors.push(prefix+'deferred experiment incorrectly requested a support-removal condition.');
  }
  if(input.mission?.repLevel===5&&input.mission.status==='READY'&&!input.transferPrime){
    errors.push(prefix+'Level 5 mission was forced without a frozen transfer test.');
  }
  if(input.postLevel&&input.preLevel&&input.postLevel>input.preLevel){
    if(input.postLevel>=2&&(input.postMemory?.comparableGames??0)<3){
      errors.push(prefix+'difficulty promoted without three comparable games.');
    }
    if(input.postLevel>=3&&input.postLesson?.phase==='PRACTISE'){
      if((input.postMemory?.cleanStreak??0)<2||(input.postMemory?.memoryStrength??0)<60){
        errors.push(prefix+'Level 3 promotion lacked stabilising evidence.');
      }
    }
    if(input.postLevel>=4&&!['TRANSFER','GRADUATED'].includes(String(input.postLesson?.phase))){
      errors.push(prefix+'advanced difficulty appeared before local mastery/transfer.');
    }
    if(input.postLevel===5&&input.postLesson?.phase==='TRANSFER'){
      if((input.postTransfer?.transferGames??0)<2||(input.postTransfer?.transferStrength??0)<65||(input.postTransfer?.transferCleanStreak??0)<1){
        errors.push(prefix+'Level 5 promotion lacked repeated transfer evidence.');
      }
    }
  }
  return errors;
}

export function runSimulationCareer(input:{
  archetype:SimulationArchetype;
  games:number;
  seed:number;
  policy?:SimulationPolicyId;
  policyAffectsOutcomes?:boolean;
}):SimulationCareerReport{
  const policy=input.policy??'PRODUCT';
  const random=rng(input.seed);
  const intentRandom=rng((input.seed^0x5f3759df)>>>0);
  const rows:HistoryAnalysisRow[]=[];
  const events:SimulationGameEvent[]=[];
  const invariants:string[]=[];
  let previousCurriculum:ClimbCurriculum|null=null;
  let skill=input.archetype.initialSkill;
  let regressionApplied=false;
  let promotions=0;
  let demotions=0;
  let maxLevel=0;
  let missionsReady=0;
  let missionsNotRelevant=0;
  let notObserved=0;
  let goodDecisions=0;
  let improveDecisions=0;

  for(let game=1;game<=input.games;game++){
    const at=new Date(Date.UTC(2026,0,1,12,0,0)+(game-1)*86_400_000).toISOString();
    let pre=rebuild(rows,previousCurriculum,at);
    previousCurriculum=pre.curriculum;
    const preLesson=lessonFor(pre.curriculum);
    const preLevel=preLesson?.repLadder.level??null;
    maxLevel=Math.max(maxLevel,preLevel??0);

    if(!regressionApplied&&input.archetype.regressionAt!==null&&game>=Math.ceil(input.games*input.archetype.regressionAt)){
      skill=clamp(skill-input.archetype.regressionDrop,.08,input.archetype.maxSkill);
      regressionApplied=true;
    }

    const draftKind=chooseDraft({random,archetype:input.archetype,curriculum:pre.curriculum,game});
    const draft=draftFor(draftKind,game);
    const situationContext=buildDraftSituationContext({champion:draft.champion,role:'ADC',enemies:draft.enemies});
    const learningContract=pre.curriculum.autonomous?.activeContract??null;
    const transferPrime=selectDecisionTransferPrime({
      transfer:pre.transfer,
      memory:pre.memory,
      scenarioPrime:null,
      situationContext,
      simulation:null,
      champion:draft.champion,
      role:'ADC',
      enabled:learningContract?.testDirective.mode==='TRANSFER_TEST',
      behaviourKey:learningContract?.testDirective.behaviourKey??null,
    });
    const activeLesson=pre.curriculum.status==='ACTIVE'?pre.curriculum.currentLesson:null;
    const mission=buildClimbMatchMission({
      lesson:activeLesson,
      situationContext,
      coach:{
        headline:'WAIT FOR YOUR FROZEN FIGHT TRIGGER.',
        fightTrigger:'FIRST CONTACT → CHECK NUMBERS AND ACCESS → ENTER ONLY WHEN THE FROZEN TRIGGER IS TRUE.',
        never:'DO NOT LET FIRST CONTACT CHOOSE THE FIGHT.',
      },
      champion:draft.champion,
      role:'ADC',
      transferPrime,
      learningContract,
    });
    if(mission?.status==='READY')missionsReady++;
    if(mission?.status==='NOT_RELEVANT')missionsNotRelevant++;
    const rawIntentProbe=buildClimbIntentProbe(mission);
    const intentCorrectChance=clamp(.18+skill*.82-(draftKind==='NOVEL_CHAMPION'?.13:draftKind==='NOVEL_PICK'?.08:0),.08,.96);
    const intentCorrect=rawIntentProbe&&mission?.status==='READY'?intentRandom()<intentCorrectChance:null;
    const intentOption=rawIntentProbe&&intentCorrect!==null
      ?rawIntentProbe.options.find(item=>(item.id===rawIntentProbe.answerKey)===intentCorrect)
      :null;
    const intentProbe=rawIntentProbe&&intentOption
      ?answerClimbIntentProbe(rawIntentProbe,intentOption.id,at)
      :rawIntentProbe;
    const experimentSchedule=policy==='PRODUCT'?buildClimbExperimentSchedule({rows,mission}):null;
    const baseCoachingStrategy=buildClimbCoachingStrategy({
      rows,
      curriculum:pre.curriculum,
      mission,
      coachTwin:pre.coachTwin,
      experimentSchedule,
    });
    const coachingStrategy=policyStrategy(baseCoachingStrategy,mission,policy);
    const coachIntervention=selectClimbCoachIntervention({
      twin:pre.coachTwin,
      mission,
      situationContext,
      deliveryPolicy:coachingStrategy?.deliveryPolicy??'NONE',
    });

    const relevant=situationContext.tags.includes('MULTI_ACCESS')||situationContext.tags.includes('PICK_PRESSURE');
    const missionReady=mission?.status==='READY';
    const forcedUnobserved=!relevant||(missionReady&&random()<input.archetype.notObservedRate);
    const novel=draftKind==='NOVEL_PICK'||draftKind==='NOVEL_CHAMPION';
    const level=mission?.repLevel??preLevel??1;
    const clean=forcedUnobserved?null:random()<chanceFor({
      archetype:input.archetype,
      skill,
      level,
      novel,
      missionReady:Boolean(missionReady),
      coachingAdjustment:benchCoachingAdjustment(coachingStrategy,skill,Boolean(input.policyAffectsOutcomes)),
    });

    if(clean===null)notObserved++;
    else if(clean)goodDecisions++;
    else improveDecisions++;

    const atSeconds=600+(game%7)*65;
    const analysis=fakeAnalysis(draft.champion,clean,atSeconds);
    const summary=fakeSummary(clean,atSeconds);
    const lockedPlan:LockedDecisionPlan={
      source:'SIMULATION_LAB',
      headline:'WAIT FOR YOUR FROZEN FIGHT TRIGGER.',
      fightTrigger:'FIRST CONTACT → CHECK NUMBERS AND ACCESS → ENTER ONLY WHEN THE FROZEN TRIGGER IS TRUE.',
      never:'DO NOT LET FIRST CONTACT CHOOSE THE FIGHT.',
      situationContext,
      decisionTransferPrime:transferPrime,
      climbMission:mission,
      intentProbe,
      experimentSchedule,
      coachingStrategy,
      coachIntervention,
    };
    const graph=buildDecisionGraph({analysis,summary,lockedPlan,generatedAt:at});
    analysis.decisionGraph=graph;
    rows.push({champion:draft.champion,role:'ADC',createdAt:at,analysis});

    if(clean!==null)skill=applyLearning({archetype:input.archetype,skill,clean,novel});

    const postAt=new Date(Date.parse(at)+1_000).toISOString();
    const post=rebuild(rows,pre.curriculum,postAt);
    previousCurriculum=post.curriculum;
    const postLesson=lessonFor(post.curriculum);
    const postLevel=postLesson?.repLadder.level??null;
    maxLevel=Math.max(maxLevel,postLevel??0);
    if(preLevel!==null&&postLevel!==null&&postLevel>preLevel)promotions++;
    if(preLevel!==null&&postLevel!==null&&postLevel<preLevel)demotions++;

    const preMemory=bestMemory(pre.memory);
    const preTransfer=transferCard(pre.transfer);
    const postMemory=bestMemory(post.memory);
    const postTransfer=transferCard(post.transfer);
    const postAutonomy=post.autonomy.cards.find(card=>card.behaviourKey===TARGET_BEHAVIOUR)??null;
    const postInterventionValue=post.interventionValue.cards.find(card=>card.behaviourKey===TARGET_BEHAVIOUR)??null;
    invariants.push(...transitionInvariant({
      archetype:input.archetype.id,
      game,
      preLevel,
      postLevel,
      preLesson,
      postLesson,
      preMemory,
      postMemory,
      preTransfer,
      postTransfer,
      mission,
      transferPrime,
      review:graph.summary.climbMission,
      intervention:coachIntervention,
      coachReview:graph.summary.coachIntervention,
      strategy:coachingStrategy,
      strategyReview:graph.summary.coachingStrategy,
      intentProbe,
      intentReview:graph.summary.intentGap,
      postAutonomy,
      postInterventionValue,
      experimentSchedule,
      experimentReview:graph.summary.experimentSchedule,
      learningContract,
    }));

    const activeCount=post.curriculum.queue.filter(item=>item.readiness==='ACTIVE').length;
    if(activeCount>1)invariants.push(input.archetype.id+' game '+String(game)+': Curriculum exposed more than one ACTIVE lesson.');

    events.push({
      game,
      champion:draft.champion,
      situationTag:mission?.targetTag??situationContext.tags[0]??'GENERAL',
      curriculumStatus:pre.curriculum.status,
      curriculumPhase:activeLesson?.phase??null,
      repLevel:mission?.repLevel??preLevel,
      repStage:mission?.repStage??preLesson?.repLadder.stage??null,
      missionStatus:mission?.status??null,
      missionReview:graph.summary.climbMission.status,
      coachMethod:coachIntervention?.method??null,
      coachSelectionMode:coachIntervention?.selectionMode??null,
      coachReview:graph.summary.coachIntervention.status,
      strategyMode:coachingStrategy?.mode??null,
      strategyIntervened:coachingStrategy?.intervene??null,
      strategyReview:graph.summary.coachingStrategy.status,
      strategyIntentDiagnosis:coachingStrategy?.intentDiagnosis??null,
      strategyIntentEvidenceStreak:coachingStrategy?.intentEvidenceStreak??null,
      intentCorrect:intentProbe?.response?.correct??null,
      intentDiagnosis:graph.summary.intentGap.diagnosis,
      autonomyState:postAutonomy?.state??null,
      autonomyStrength:postAutonomy?.autonomyStrength??null,
      interventionValueState:postInterventionValue?.state??null,
      interventionResponseDifference:postInterventionValue?.matchedResponseDifference??null,
      experimentType:experimentSchedule?.experimentType??null,
      experimentPolicy:experimentSchedule?.requestedDeliveryPolicy??null,
      experimentReview:graph.summary.experimentSchedule.status,
      learningContractId:learningContract?.id??null,
      autonomousState:learningContract?.state??pre.curriculum.autonomous?.state??null,
      autonomousAction:learningContract?.action??pre.curriculum.autonomous?.action??null,
      autonomousSupportPolicy:learningContract?.supportPolicy??null,
      autonomousTestMode:learningContract?.testDirective.mode??null,
      transferPrime:Boolean(transferPrime),
      outcome:clean===null?'NOT_OBSERVED':clean?'GOOD':'IMPROVE',
      latentSkill:Number(skill.toFixed(3)),
      comparableGames:postMemory?.comparableGames??0,
      memoryState:postMemory?.state??null,
      transferState:postTransfer?.state??null,
      postRepLevel:postLevel,
      postCurriculumPhase:postLesson?.phase??null,
    });
  }

  const finalAt=new Date(Date.UTC(2026,0,1,12,0,0)+input.games*86_400_000).toISOString();
  const final=rebuild(rows,previousCurriculum,finalAt);
  const finalLesson=lessonFor(final.curriculum);
  const finalMemory=bestMemory(final.memory);
  const finalTransfer=transferCard(final.transfer);

  return{
    archetype:input.archetype.id,
    label:input.archetype.label,
    games:input.games,
    missionsReady,
    missionsNotRelevant,
    notObserved,
    goodDecisions,
    improveDecisions,
    promotions,
    demotions,
    maxLevel,
    finalLevel:finalLesson?.repLadder.level??null,
    finalPhase:finalLesson?.phase??null,
    principleOwned:finalTransfer?.state==='PRINCIPLE_OWNED'||finalLesson?.phase==='GRADUATED',
    finalMemoryState:finalMemory?.state??null,
    finalTransferState:finalTransfer?.state??null,
    finalSkill:Number(skill.toFixed(3)),
    invariants,
    events,
  };
}

export function runClimbSimulationLab(input:{
  gamesPerCareer?:number;
  archetypes?:SimulationArchetype[];
  seed?:number;
}={}):ClimbSimulationLabReport{
  const gamesPerCareer=Math.max(20,Math.floor(input.gamesPerCareer??120));
  const archetypes=input.archetypes??DEFAULT_SIMULATION_ARCHETYPES;
  const baseSeed=input.seed??23042026;
  const careers=archetypes.map((archetype,index)=>runSimulationCareer({
    archetype,
    games:gamesPerCareer,
    seed:baseSeed+index*7919,
  }));
  const invariantViolations=careers.flatMap(career=>career.invariants);
  const totalGames=careers.reduce((sum,career)=>sum+career.games,0);
  const totalPromotions=careers.reduce((sum,career)=>sum+career.promotions,0);
  const totalDemotions=careers.reduce((sum,career)=>sum+career.demotions,0);
  const totalNotObserved=careers.reduce((sum,career)=>sum+career.notObserved,0);
  return{
    version:1,
    gamesPerCareer,
    careers,
    totalGames,
    totalPromotions,
    totalDemotions,
    totalNotObserved,
    invariantViolations,
    summary:invariantViolations.length
      ?'CLIMB Simulation Lab found '+String(invariantViolations.length)+' learning invariant violation'+(invariantViolations.length===1?'':'s')+' across '+String(totalGames)+' synthetic games.'
      :'CLIMB Simulation Lab completed '+String(totalGames)+' synthetic games with no learning invariant violations.',
  };
}
