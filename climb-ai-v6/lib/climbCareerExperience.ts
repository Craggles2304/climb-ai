import type {DecisionBehaviourKey} from './decisionTwin';
import type {ClimbCurriculum,CurriculumLesson,CurriculumPhase} from './climbCurriculum';
import type {LearningJourney,LearningTimelineEvent} from './learningJourney';

export type CareerSkillState='OWNED'|'ACTIVE'|'NEXT'|'READY'|'LOCKED'|'REOPENED'|'BUILDING';
export type CareerMilestoneTone='BREAKTHROUGH'|'PROGRESS'|'REGRESSION'|'DIRECTION';

export interface CareerSkillNode{
  key:DecisionBehaviourKey;
  label:string;
  group:'DECISION_FOUNDATIONS'|'CONVERSION_AND_TIMING'|'CARRY_OWNERSHIP';
  state:CareerSkillState;
  phase:CurriculumPhase|'UNSEEN';
  prerequisite:DecisionBehaviourKey|null;
  prerequisiteLabel:string|null;
  pathPosition:number;
  reason:string;
  evidence:string;
  gameRule:string|null;
  nextUnlock:string|null;
}

export interface CareerMilestone{
  id:string;
  at:string;
  gameNumber:number;
  tone:CareerMilestoneTone;
  title:string;
  detail:string;
  behaviourKey:DecisionBehaviourKey|null;
  label:string;
}

export interface ClimbCareerExperience{
  version:1;
  generatedAt:string;
  gamesAnalyzed:number;
  developmentStage:'BUILDING_MODEL'|'LEARNING_FOUNDATIONS'|'BUILDING_INDEPENDENCE'|'GENERALISING'|'PRINCIPLE_OWNERSHIP';
  headline:string;
  activeObjective:{
    key:DecisionBehaviourKey;
    label:string;
    phase:CurriculumPhase;
    completion:number|null;
    supportPolicy:string|null;
    nextTest:string|null;
    graduationRule:string;
    replacementLabel:string|null;
  }|null;
  nextObjective:{
    key:DecisionBehaviourKey;
    label:string;
    reason:string;
  }|null;
  summary:{
    owned:number;
    active:number;
    ready:number;
    locked:number;
    reopened:number;
    milestones:number;
  };
  skills:CareerSkillNode[];
  milestones:CareerMilestone[];
  recentBreakthrough:CareerMilestone|null;
  latestRegression:CareerMilestone|null;
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

const ORDER:DecisionBehaviourKey[]=[
  'FIGHT_SELECTION',
  'DEATH_RECOVERY',
  'RESET_DISCIPLINE',
  'FARM_VS_SETUP',
  'THREAT_ADAPTATION',
  'LEAD_PROTECTION',
  'OBJECTIVE_READINESS',
  'POWER_SPIKE_CONVERSION',
  'CARRY_PRESERVATION',
  'SURVIVAL_VALUE',
];

const PREREQUISITE:Partial<Record<DecisionBehaviourKey,DecisionBehaviourKey>>={
  LEAD_PROTECTION:'FIGHT_SELECTION',
  OBJECTIVE_READINESS:'FARM_VS_SETUP',
  POWER_SPIKE_CONVERSION:'RESET_DISCIPLINE',
  CARRY_PRESERVATION:'THREAT_ADAPTATION',
  SURVIVAL_VALUE:'CARRY_PRESERVATION',
};

const GROUP:Record<DecisionBehaviourKey,CareerSkillNode['group']>={
  FIGHT_SELECTION:'DECISION_FOUNDATIONS',
  DEATH_RECOVERY:'DECISION_FOUNDATIONS',
  RESET_DISCIPLINE:'DECISION_FOUNDATIONS',
  FARM_VS_SETUP:'DECISION_FOUNDATIONS',
  THREAT_ADAPTATION:'DECISION_FOUNDATIONS',
  LEAD_PROTECTION:'CONVERSION_AND_TIMING',
  OBJECTIVE_READINESS:'CONVERSION_AND_TIMING',
  POWER_SPIKE_CONVERSION:'CONVERSION_AND_TIMING',
  CARRY_PRESERVATION:'CARRY_OWNERSHIP',
  SURVIVAL_VALUE:'CARRY_OWNERSHIP',
};

const PHASE_POSITION:Record<CurriculumPhase,number>={
  BUILDING:5,
  FOUNDATION:20,
  PRACTISE:40,
  STABILISE:60,
  TRANSFER:80,
  GRADUATED:100,
  REOPEN:55,
};

const BOUNDARY='Career Experience is a player-facing projection of verified CLIMB Curriculum and Learning Journey evidence. It does not create new mastery, progress or causal claims. OWNED requires curriculum graduation/principle ownership, REOPENED requires verified regression, and unseen skills remain BUILDING until the underlying models have enough evidence.';

function lessonMap(curriculum:ClimbCurriculum){
  const map=new Map<DecisionBehaviourKey,CurriculumLesson>();
  for(const lesson of [
    ...(curriculum.queue??[]),
    ...(curriculum.graduated??[]),
    curriculum.currentLesson,
    curriculum.nextLesson,
  ].filter(Boolean) as CurriculumLesson[]){
    const existing=map.get(lesson.behaviourKey);
    if(!existing||lesson.phase==='GRADUATED'||lesson.readiness==='ACTIVE')map.set(lesson.behaviourKey,lesson);
  }
  return map;
}

function stateFor(key:DecisionBehaviourKey,lesson:CurriculumLesson|null,curriculum:ClimbCurriculum):CareerSkillState{
  if(lesson?.phase==='GRADUATED'||curriculum.graduated.some(item=>item.behaviourKey===key))return'OWNED';
  if(lesson?.phase==='REOPEN')return'REOPENED';
  if(curriculum.currentLesson?.behaviourKey===key)return'ACTIVE';
  if(curriculum.nextLesson?.behaviourKey===key)return'NEXT';
  if(lesson?.readiness==='LOCKED')return'LOCKED';
  if(lesson?.readiness==='READY')return'READY';
  const candidate=curriculum.careerMatrix?.candidates.find(item=>item.key===key);
  if(candidate?.principleOwned)return'OWNED';
  if(candidate?.state==='LOCKED')return'LOCKED';
  if(candidate&&candidate.confidence!=='LOW')return'READY';
  return'BUILDING';
}

function fallbackReason(state:CareerSkillState,key:DecisionBehaviourKey){
  if(state==='OWNED')return'This principle has passed the current ownership gate and remains on maintenance.';
  if(state==='REOPENED')return'Comparable mistakes returned after prior progress, so this skill has been reopened.';
  if(state==='LOCKED'){
    const prerequisite=PREREQUISITE[key];
    return prerequisite?LABELS[prerequisite]+' must become stable before this skill unlocks.':'A prerequisite is not stable enough yet.';
  }
  if(state==='BUILDING')return'OP CLIMB is still collecting enough comparable evidence to place this skill accurately.';
  return'This skill is in the verified development queue.';
}

function milestoneTone(event:LearningTimelineEvent):CareerMilestoneTone{
  if(event.type==='REGRESSED')return'REGRESSION';
  if(event.type==='MASTERED'||event.type==='FIRST_EXECUTION')return'BREAKTHROUGH';
  if(event.type==='IMPROVING'||event.type==='COACHING_STARTED')return'PROGRESS';
  return'DIRECTION';
}

function milestoneLabel(event:LearningTimelineEvent){
  if(event.type==='MASTERED')return'PRINCIPLE BREAKTHROUGH';
  if(event.type==='FIRST_EXECUTION')return'FIRST PROOF';
  if(event.type==='IMPROVING')return'IMPROVEMENT';
  if(event.type==='REGRESSED')return'REOPENED';
  if(event.type==='FOCUS_CHANGED')return'NEXT CHAPTER';
  if(event.type==='FOCUS_SELECTED')return'FOCUS CHOSEN';
  if(event.type==='COACHING_STARTED')return'COACHING STARTED';
  return'PATTERN FOUND';
}

function stageFor(curriculum:ClimbCurriculum,owned:number):ClimbCareerExperience['developmentStage']{
  if(curriculum.gamesAnalyzed<3||curriculum.status==='BUILDING')return'BUILDING_MODEL';
  if(owned>0)return'PRINCIPLE_OWNERSHIP';
  if(curriculum.currentLesson?.phase==='TRANSFER')return'GENERALISING';
  if(curriculum.autonomous?.activeContract?.supportPolicy==='FADED'||curriculum.currentLesson?.phase==='STABILISE')return'BUILDING_INDEPENDENCE';
  return'LEARNING_FOUNDATIONS';
}

function headlineFor(stage:ClimbCareerExperience['developmentStage'],active:string|null,owned:number){
  if(stage==='BUILDING_MODEL')return'Your development career is still being mapped from repeated decisions.';
  if(stage==='PRINCIPLE_OWNERSHIP')return owned+' decision principle'+(owned===1?' is':'s are')+' owned. '+(active?active+' is the current development chapter.':'OP CLIMB is waiting for the next evidence-backed objective.');
  if(stage==='GENERALISING')return active?active+' is locally stable. Now prove the principle beyond the original cue.':'Your next job is proving learning beyond familiar situations.';
  if(stage==='BUILDING_INDEPENDENCE')return active?active+' is being tested with less coaching support.':'OP CLIMB is testing whether your decisions survive with less help.';
  return active?'Your current chapter is '+active+'. Build the correct decision until it becomes stable.':'OP CLIMB is selecting the first evidence-backed development chapter.';
}

export function buildClimbCareerExperience(
  curriculum:ClimbCurriculum,
  journey:LearningJourney|null,
  generatedAt=new Date().toISOString(),
):ClimbCareerExperience{
  const byKey=lessonMap(curriculum);
  const skills:CareerSkillNode[]=ORDER.map(key=>{
    const lesson=byKey.get(key)??null;
    const state=stateFor(key,lesson,curriculum);
    const prerequisite=lesson?.prerequisite??PREREQUISITE[key]??null;
    const candidate=curriculum.careerMatrix?.candidates.find(item=>item.key===key)??null;
    return{
      key,
      label:lesson?.label??LABELS[key],
      group:GROUP[key],
      state,
      phase:lesson?.phase??'UNSEEN',
      prerequisite,
      prerequisiteLabel:lesson?.prerequisiteLabel??(prerequisite?LABELS[prerequisite]:null),
      pathPosition:lesson?PHASE_POSITION[lesson.phase]:(state==='OWNED'?100:0),
      reason:lesson?.whyNow??candidate?.deferredReason??candidate?.whyNow??fallbackReason(state,key),
      evidence:lesson?.evidence??candidate?.evidence??'No verified curriculum evidence yet.',
      gameRule:lesson?.gameRule??null,
      nextUnlock:lesson?.nextUnlock??null,
    };
  });

  const milestones:CareerMilestone[]=(journey?.events??[]).map(event=>({
    id:event.id,
    at:event.at,
    gameNumber:event.gameNumber,
    tone:milestoneTone(event),
    title:event.title,
    detail:event.detail,
    behaviourKey:event.behaviourKey,
    label:milestoneLabel(event),
  }));

  const owned=skills.filter(skill=>skill.state==='OWNED').length;
  const active=skills.filter(skill=>skill.state==='ACTIVE').length;
  const ready=skills.filter(skill=>skill.state==='READY'||skill.state==='NEXT').length;
  const locked=skills.filter(skill=>skill.state==='LOCKED').length;
  const reopened=skills.filter(skill=>skill.state==='REOPENED').length;
  const developmentStage=stageFor(curriculum,owned);
  const contract=curriculum.autonomous?.activeContract??null;
  const activeLesson=curriculum.currentLesson;
  const nextLesson=curriculum.nextLesson;

  return{
    version:1,
    generatedAt,
    gamesAnalyzed:curriculum.gamesAnalyzed,
    developmentStage,
    headline:headlineFor(developmentStage,activeLesson?.label??null,owned),
    activeObjective:activeLesson?{
      key:activeLesson.behaviourKey,
      label:activeLesson.label,
      phase:activeLesson.phase,
      completion:contract?.objectiveKey===activeLesson.behaviourKey?contract.completion:null,
      supportPolicy:contract?.objectiveKey===activeLesson.behaviourKey?contract.supportPolicy:null,
      nextTest:contract?.objectiveKey===activeLesson.behaviourKey?contract.testDirective.instruction:null,
      graduationRule:activeLesson.graduationRule,
      replacementLabel:contract?.replacement.nextLabel??nextLesson?.label??null,
    }:null,
    nextObjective:nextLesson?{
      key:nextLesson.behaviourKey,
      label:nextLesson.label,
      reason:nextLesson.whyNow,
    }:null,
    summary:{owned,active,ready,locked,reopened,milestones:milestones.length},
    skills,
    milestones:milestones.slice(0,18),
    recentBreakthrough:milestones.find(item=>item.tone==='BREAKTHROUGH')??null,
    latestRegression:milestones.find(item=>item.tone==='REGRESSION')??null,
    boundary:BOUNDARY,
  };
}

export const CLIMB_CAREER_EXPERIENCE_BOUNDARY=BOUNDARY;
