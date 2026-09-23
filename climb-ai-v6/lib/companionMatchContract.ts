import type {FrozenGamePlaybook,FrozenBranchKey} from './frozenGamePlaybook';
import type {ClimbMatchMission} from './climbMissionDesign';
import type {ClimbCoachIntervention} from './climbCoachTwin';
import type {ClimbCoachingStrategy} from './climbCoachingStrategy';
import type {ClimbExperimentSchedule} from './climbExperimentScheduler';
import type {PersonalTrap} from './decisionTwin';
import type {ScenarioPrime} from './scenarioMemory';
import type {DecisionTransferPrime} from './decisionTransfer';

export type CompanionLearningMode='EXECUTE_PLAN'|'CURRICULUM_REP'|'SPACED_REP'|'TRANSFER_TEST';
export type CompanionMatchPhase='LOAD_IN'|'LANE'|'FIRST_CHECK'|'MID_GAME'|'OPEN_GAME';

export interface CompanionMatchContract{
  version:'MATCH_OS_V1';
  frozenBeforePlay:true;
  champion:string;
  role:string|null;
  rank:string|null;
  strategic:{
    ourWinCondition:string;
    why:string;
    theirWinCondition:string;
    yourJob:string;
    mainThreat:string;
    threatAnswer:string;
    fightRule:string;
    objectiveRule:string;
    never:string;
  };
  learning:{
    mode:CompanionLearningMode;
    title:string;
    behaviour:string|null;
    cue:string;
    trigger:string;
    success:string;
    failure:string;
    rehearsalQuestion:string;
    supportMode:string;
    experiment:string|null;
    memoryState:string|null;
    transferState:string|null;
    source:string;
  };
  personal:{
    status:string;
    title:string;
    trap:string|null;
    proof:string|null;
  };
  branches:Record<FrozenBranchKey,{
    headline:string;
    priority:string;
    job:string;
    fightWhen:string;
    objective:string;
    stop:string;
    decisionRisk:string;
  }>;
  checkpoints:Array<{minute:number;headline:string;questions:string[]}>;
  phaseDeck:Array<{
    phase:CompanionMatchPhase;
    fromSeconds:number;
    toSeconds:number|null;
    label:string;
    primary:string;
    secondary:string;
    guardrail:string;
  }>;
  proof:{
    target:string;
    pass:string;
    fail:string;
    notObserved:string;
  };
  policy:{
    frozenFromPregame:true;
    usesLiveTelemetryForTactics:false;
    clockOnlyPhaseProgression:true;
    playerChoosesGameState:true;
    playerChoosesContingency:true;
  };
}

type CoachLike={
  headline?:string|null;
  why?:string|null;
  theirPlan?:string|null;
  threats?:string[]|null;
  threatAnswer?:string|null;
  fightTrigger?:string|null;
  objectiveSetup?:string|null;
  never?:string|null;
};

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function compact(value:unknown,max=180){
  const text=clean(value);
  return text.length<=max?text:text.slice(0,max-1).replace(/\s+\S*$/,'')+'…';
}
function upper(value:unknown){return clean(value).toUpperCase()}

function learningMode(input:{
  mission:ClimbMatchMission|null|undefined;
  scenarioPrime:ScenarioPrime|null|undefined;
  transferPrime:DecisionTransferPrime|null|undefined;
}):CompanionLearningMode{
  if(input.transferPrime?.transferId)return'TRANSFER_TEST';
  if(input.scenarioPrime?.memoryId)return'SPACED_REP';
  if(input.mission?.status==='READY')return'CURRICULUM_REP';
  return'EXECUTE_PLAN';
}

function learningTitle(mode:CompanionLearningMode,input:{
  mission:ClimbMatchMission|null|undefined;
  scenarioPrime:ScenarioPrime|null|undefined;
  transferPrime:DecisionTransferPrime|null|undefined;
}){
  if(mode==='TRANSFER_TEST')return compact(input.transferPrime?.title||'TRANSFER TEST',88);
  if(mode==='SPACED_REP')return compact(input.scenarioPrime?.title||'SPACED REP',88);
  if(mode==='CURRICULUM_REP')return compact(input.mission?.title||input.mission?.behaviourLabel||'ONE CLEAN REP',88);
  return'EXECUTE THE FROZEN GAME PLAN';
}

export function buildCompanionMatchContract(input:{
  champion:string;
  role:string|null;
  rank:string|null;
  coach:CoachLike;
  playbook:FrozenGamePlaybook;
  personalTrap:PersonalTrap|null|undefined;
  mission:ClimbMatchMission|null|undefined;
  scenarioPrime:ScenarioPrime|null|undefined;
  transferPrime:DecisionTransferPrime|null|undefined;
  coachIntervention:ClimbCoachIntervention|null|undefined;
  coachingStrategy:ClimbCoachingStrategy|null|undefined;
  experimentSchedule:ClimbExperimentSchedule|null|undefined;
}):CompanionMatchContract{
  const {coach,playbook}=input;
  const mode=learningMode(input);
  const threatNames=Array.isArray(coach.threats)?coach.threats.map(clean).filter(Boolean):[];
  const mainThreat=threatNames.join(' + ')||'THEIR CLEANEST ACCESS';
  const yourJob=compact(playbook.carryMap?.playerJob||playbook.baseCall||coach.headline||'EXECUTE THE DRAFT PLAN',140);
  const cue=compact(
    input.coachIntervention?.primaryCue
    ||input.transferPrime?.targetMove
    ||input.scenarioPrime?.targetBranch
    ||input.mission?.cue
    ||input.mission?.action
    ||yourJob,
    170,
  );
  const trigger=compact(
    input.mission?.trigger
    ||input.transferPrime?.trigger
    ||input.scenarioPrime?.trigger
    ||coach.fightTrigger
    ||'WHEN THE NEXT RELEVANT DECISION WINDOW APPEARS.',
    170,
  );
  const success=compact(
    input.mission?.successDefinition
    ||input.transferPrime?.successDefinition
    ||'EXECUTE THE CLEAN BRANCH WHEN THE PLANNED DECISION WINDOW APPEARS.',
    180,
  );
  const failure=compact(
    input.mission?.failureDefinition
    ||'THE OLD BRANCH REAPPEARS IN A VERIFIED COMPARABLE DECISION.',
    180,
  );
  const rehearsal=compact(
    input.mission?.rehearsalQuestion
    ||'WHAT WILL YOU DO WHEN THE TRIGGER APPEARS?',
    160,
  );
  const supportMode=upper(input.coachingStrategy?.deliveryPolicy||input.coachIntervention?.deliveryPolicy||'FULL');
  const experiment=input.experimentSchedule?.status==='SCHEDULED'
    ?compact(input.experimentSchedule?.experimentType||'SCHEDULED TEST',100)
    :null;

  const theirWinCondition=compact(
    coach.theirPlan
    ||(mainThreat+' GETS CLEAN FIRST ACCESS BEFORE YOUR TEAM IS SET.'),
    180,
  );

  const branch=(key:FrozenBranchKey)=>{
    const item=playbook.branches[key];
    return{
      headline:compact(item.headline,100),
      priority:upper(item.priority),
      job:compact(item.job||item.rule,150),
      fightWhen:compact(item.fightWhen||item.fight,150),
      objective:compact(item.objective,150),
      stop:compact(item.stop||item.never,150),
      decisionRisk:compact(item.decisionRisk,150),
    };
  };

  const personalReady=input.personalTrap?.status==='READY';
  const personalTrap=personalReady
    ?compact(input.personalTrap?.cue||input.personalTrap?.historicalSummary,170)
    :null;

  const strategic={
    ourWinCondition:compact(playbook.baseCall||coach.headline||'EXECUTE THE DRAFT PLAN',120),
    why:compact(playbook.baseWhy||coach.why,180),
    theirWinCondition,
    yourJob,
    mainThreat:compact(mainThreat,100),
    threatAnswer:compact(playbook.threatRule||coach.threatAnswer,160),
    fightRule:compact(playbook.fightRule||coach.fightTrigger,160),
    objectiveRule:compact(playbook.objectiveRule||coach.objectiveSetup,160),
    never:compact(playbook.never||coach.never,160),
  };

  return{
    version:'MATCH_OS_V1',
    frozenBeforePlay:true,
    champion:clean(input.champion),
    role:clean(input.role)||null,
    rank:clean(input.rank)||null,
    strategic,
    learning:{
      mode,
      title:learningTitle(mode,input),
      behaviour:clean(input.mission?.behaviourLabel)||clean(input.transferPrime?.behaviourLabel)||clean(input.scenarioPrime?.behaviourLabel)||null,
      cue,
      trigger,
      success,
      failure,
      rehearsalQuestion:rehearsal,
      supportMode,
      experiment,
      memoryState:clean(input.scenarioPrime?.state)||null,
      transferState:clean(input.transferPrime?.state)||null,
      source:mode==='TRANSFER_TEST'?'DECISION_TRANSFER':mode==='SPACED_REP'?'SCENARIO_MEMORY':mode==='CURRICULUM_REP'?'AUTONOMOUS_CURRICULUM':'FROZEN_GAME_PLAN',
    },
    personal:{
      status:personalReady?'READY':upper(input.personalTrap?.status||'BUILDING'),
      title:compact(input.personalTrap?.title||(personalReady?'PERSONAL TRAP':'PROFILE BUILDING'),100),
      trap:personalTrap,
      proof:personalReady?compact(input.personalTrap?.proof||input.personalTrap?.historicalSummary,170):null,
    },
    branches:{AHEAD:branch('AHEAD'),EVEN:branch('EVEN'),BEHIND:branch('BEHIND')},
    checkpoints:(playbook.checkpoints??[]).map(item=>({
      minute:Number(item.minute),
      headline:compact(item.prompt,100),
      questions:(item.questions??[]).map(question=>compact(question,160)).filter(Boolean).slice(0,5),
    })),
    phaseDeck:[
      {
        phase:'LOAD_IN',fromSeconds:0,toSeconds:150,label:'LOAD IN · LOCK THE CONTRACT',
        primary:yourJob,
        secondary:cue,
        guardrail:strategic.never,
      },
      {
        phase:'LANE',fromSeconds:150,toSeconds:300,label:'LANE · EXECUTE, DO NOT OVERLOAD',
        primary:cue,
        secondary:trigger,
        guardrail:strategic.threatAnswer,
      },
      {
        phase:'FIRST_CHECK',fromSeconds:300,toSeconds:600,label:'5 MIN · READ THE BOARD YOURSELF',
        primary:compact(playbook.checkpoints?.[0]?.questions?.[0]||'CHOOSE AHEAD / EVEN / BEHIND YOURSELF.',160),
        secondary:compact(playbook.checkpoints?.[0]?.questions?.[2]||strategic.fightRule,160),
        guardrail:'OP CLIMB DOES NOT AUTO-SELECT YOUR GAME STATE.',
      },
      {
        phase:'MID_GAME',fromSeconds:600,toSeconds:900,label:'10 MIN · RECONNECT TO THE WIN CONDITION',
        primary:strategic.ourWinCondition,
        secondary:strategic.objectiveRule,
        guardrail:strategic.never,
      },
      {
        phase:'OPEN_GAME',fromSeconds:900,toSeconds:null,label:'15+ · FIGHT THE RIGHT GAME',
        primary:strategic.fightRule,
        secondary:strategic.threatAnswer,
        guardrail:strategic.never,
      },
    ],
    proof:{
      target:compact(input.mission?.reviewRule||'POST-GAME: SCORE ONLY VERIFIED COMPARABLE DECISIONS.',180),
      pass:success,
      fail:failure,
      notObserved:'IF THE PLANNED DECISION NEVER OCCURS: NOT OBSERVED. NO FAKE PASS, NO FAKE FAIL.',
    },
    policy:{
      frozenFromPregame:true,
      usesLiveTelemetryForTactics:false,
      clockOnlyPhaseProgression:true,
      playerChoosesGameState:true,
      playerChoosesContingency:true,
    },
  };
}
