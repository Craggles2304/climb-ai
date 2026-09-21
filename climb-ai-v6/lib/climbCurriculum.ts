import type {DecisionBehaviourKey,DecisionTwinConfidence} from './decisionTwin';
import type {DecisionTwinV2Profile,DecisionTwinActiveFocus} from './decisionTwinV2';
import type {ScenarioMemoryProfile,ScenarioMemoryCard} from './scenarioMemory';
import type {DecisionTransferProfile,DecisionTransferCard} from './decisionTransfer';

export type CurriculumPhase='BUILDING'|'FOUNDATION'|'PRACTISE'|'STABILISE'|'TRANSFER'|'GRADUATED'|'REOPEN';
export type CurriculumReadiness='LOCKED'|'READY'|'ACTIVE'|'COMPLETE';

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
  nextUnlock:string|null;
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
function phaseFor(mem:ScenarioMemoryCard|null,tx:DecisionTransferCard|null):CurriculumPhase{
  if(tx?.state==='PRINCIPLE_OWNED')return'GRADUATED';
  if(mem?.state==='REGRESSED'||tx?.state==='REGRESSED')return'REOPEN';
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
function makeLesson(
  key:DecisionBehaviourKey,
  twin:DecisionTwinV2Profile,
  memory:ScenarioMemoryProfile,
  transfer:DecisionTransferProfile,
):CurriculumLesson{
  const focus=focusFor(twin,key);
  const mem=bestMemory(memory,key);
  const tx=transferCard(transfer,key);
  const prerequisite=PREREQUISITE[key]??null;
  const prerequisiteStable=prerequisite?behaviourStable(memory,transfer,prerequisite):true;
  const phase=phaseFor(mem,tx);
  const readiness:CurriculumReadiness=phase==='GRADUATED'
    ?'COMPLETE'
    :prerequisite&&!prerequisiteStable
      ?'LOCKED'
      :focus||mem||tx
        ?'ACTIVE'
        :'READY';
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
    comparableGames:mem?.comparableGames??0,
    cleanStreak:mem?.cleanStreak??0,
    memoryStrength:mem?.memoryStrength??null,
    transferStrength:tx?.transferStrength??null,
    nextUnlock:null,
  };
}

function curriculumOrder(twin:DecisionTwinV2Profile,memory:ScenarioMemoryProfile,transfer:DecisionTransferProfile){
  const keys=new Set<DecisionBehaviourKey>();
  for(const item of twin.activeFive)keys.add(item.key);
  for(const card of memory.cards.filter(card=>card.state!=='BUILDING'))keys.add(card.behaviourKey);
  for(const card of transfer.cards)keys.add(card.behaviourKey);

  const expanded=[...keys];
  for(const key of expanded){
    const prerequisite=PREREQUISITE[key];
    if(prerequisite&&!behaviourStable(memory,transfer,prerequisite))keys.add(prerequisite);
  }

  const lessons=[...keys].map(key=>makeLesson(key,twin,memory,transfer));
  for(const locked of lessons.filter(item=>item.readiness==='LOCKED'&&item.prerequisite)){
    const prerequisite=lessons.find(item=>item.behaviourKey===locked.prerequisite);
    if(prerequisite&&prerequisite.readiness==='READY'){
      prerequisite.readiness='ACTIVE';
      prerequisite.priority=Math.max(prerequisite.priority,locked.priority+1);
      prerequisite.whyNow='This foundation unlocks '+locked.label+'. OP CLIMB will not skip the prerequisite just because the later skill currently scores worse.';
    }
  }
  const phaseWeight=(phase:CurriculumPhase)=>phase==='REOPEN'?80:phase==='PRACTISE'?65:phase==='STABILISE'?55:phase==='TRANSFER'?45:phase==='FOUNDATION'?40:phase==='BUILDING'?20:0;
  return lessons.sort((a,b)=>{
    const aUnlock=lessons.some(item=>item.prerequisite===a.behaviourKey&&item.readiness==='LOCKED')?18:0;
    const bUnlock=lessons.some(item=>item.prerequisite===b.behaviourKey&&item.readiness==='LOCKED')?18:0;
    const readiness=(value:CurriculumReadiness)=>value==='ACTIVE'?30:value==='READY'?15:value==='LOCKED'?-30:-50;
    return readiness(b.readiness)-readiness(a.readiness)
      ||phaseWeight(b.phase)-phaseWeight(a.phase)
      ||bUnlock-aUnlock
      ||b.priority-a.priority
      ||a.label.localeCompare(b.label);
  });
}

export function buildClimbCurriculum(
  twin:DecisionTwinV2Profile,
  memory:ScenarioMemoryProfile,
  transfer:DecisionTransferProfile,
  generatedAt=new Date().toISOString(),
):ClimbCurriculum{
  const lessons=curriculumOrder(twin,memory,transfer);
  const active=lessons.filter(item=>item.readiness==='ACTIVE'||item.readiness==='READY');
  const graduated=lessons.filter(item=>item.readiness==='COMPLETE');
  const current=active[0]??null;
  const next=active[1]??null;
  const blocked=lessons.filter(item=>item.readiness==='LOCKED');

  if(current){
    const unlock=lessons.find(item=>item.prerequisite===current.behaviourKey&&item.readiness==='LOCKED');
    current.nextUnlock=unlock?.label??next?.label??null;
  }
  if(next){
    const unlock=lessons.find(item=>item.prerequisite===next.behaviourKey&&item.readiness==='LOCKED');
    next.nextUnlock=unlock?.label??null;
  }

  const status:ClimbCurriculum['status']=!lessons.length||twin.gamesAnalyzed<3?'BUILDING':current?'ACTIVE':'COMPLETE';
  return{
    version:1,
    generatedAt,
    gamesAnalyzed:twin.gamesAnalyzed,
    status,
    currentLesson:current,
    nextLesson:next,
    queue:lessons.filter(item=>item.readiness!=='COMPLETE').slice(0,5),
    graduated,
    summary:status==='BUILDING'
      ?'CLIMB Curriculum is still building. OP CLIMB needs repeated verified decisions before it chooses a development sequence.'
      :current
        ?'Current lesson: '+current.label+'. '+(blocked.length?String(blocked.length)+' later skill'+(blocked.length===1?' is':'s are')+' locked behind prerequisite evidence.':'The next lesson will unlock only when repeated evidence justifies moving on.')
        :'Every evidence-backed lesson currently in the curriculum is graduated. OP CLIMB will maintain them on spaced review and wait for a new verified limiter.',
    boundary:BOUNDARY,
  };
}
