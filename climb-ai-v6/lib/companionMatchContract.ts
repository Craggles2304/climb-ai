import type {FrozenGamePlaybook,FrozenBranchKey} from './frozenGamePlaybook';
import type {ClimbMatchMission,ClimbMatchMissionReview} from './climbMissionDesign';
import type {ClimbCoachIntervention} from './climbCoachTwin';
import type {ClimbCoachingStrategy} from './climbCoachingStrategy';
import type {ClimbExperimentSchedule} from './climbExperimentScheduler';
import type {PersonalTrap} from './decisionTwin';
import type {ScenarioPrime,ScenarioPrimeReview} from './scenarioMemory';
import type {DecisionTransferPrime,DecisionTransferReview} from './decisionTransfer';
import type {ClimbIntentProbe} from './climbIntentGap';
import type {HistoryAnalysisRow} from './riot/proHistory';

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
  scaffolding:{
    strategyMode:string;
    deliveryPolicy:'FULL'|'LIGHT'|'DIAGNOSTIC'|'NONE';
    intentProbeId:string|null;
    intentPrompt:string|null;
    intentRequiredBeforeCue:boolean;
    revealSpecificCueAfterIntent:boolean;
    autonomyTest:boolean;
    playerInstruction:string;
  };
  continuity:{
    available:boolean;
    previousStatus:'EXECUTED'|'MISSED'|'MIXED'|'NOT_OBSERVED'|'NONE';
    previousBehaviour:string|null;
    previousMode:string|null;
    previousSummary:string;
    whyNow:string;
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


function continuityFromHistory(rows:HistoryAnalysisRow[]|undefined,input:{
  mission:ClimbMatchMission|null|undefined;
  scenarioPrime:ScenarioPrime|null|undefined;
  transferPrime:DecisionTransferPrime|null|undefined;
}):CompanionMatchContract['continuity']{
  const ordered=[...(rows??[])].filter(row=>row?.analysis?.version===1).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  let previous:any=null;
  for(let i=ordered.length-1;i>=0;i--){
    const summary=(ordered[i].analysis as any)?.decisionGraph?.summary;
    const matchContract=summary?.matchContract;
    const mission=summary?.climbMission;
    if(matchContract?.active){
      previous={
        status:String(matchContract.status||'NONE').toUpperCase(),
        behaviour:clean(matchContract.behaviour)||null,
        mode:clean(matchContract.mode)||null,
        note:clean(matchContract.proof||matchContract.headline),
      };
      break;
    }
    if(mission?.active){
      previous={
        status:String(mission.status||'NONE').toUpperCase(),
        behaviour:clean(mission.behaviourLabel)||null,
        mode:'CURRICULUM_REP',
        note:clean(mission.note),
      };
      break;
    }
  }

  const status=(['EXECUTED','MISSED','MIXED','NOT_OBSERVED'].includes(previous?.status)?previous.status:'NONE') as CompanionMatchContract['continuity']['previousStatus'];
  const previousSummary=
    status==='EXECUTED'?'LAST VERIFIED REP WAS CLEAN. THE COACH WILL ONLY ADD DIFFICULTY WHEN THE LEARNING EVIDENCE SUPPORTS IT.':
    status==='MISSED'?'LAST VERIFIED REP MISSED THE TARGET BRANCH. THE PRINCIPLE STAYS ACTIVE UNTIL THE EVIDENCE CHANGES.':
    status==='MIXED'?'LAST VERIFIED REP WAS MIXED. THE CORRECT BRANCH APPEARED, BUT IT IS NOT STABLE YET.':
    status==='NOT_OBSERVED'?'LAST PLANNED REP DID NOT APPEAR. NO PASS OR FAIL WAS RECORDED.':
    'NO PRIOR MATCH OS REP IS AVAILABLE YET.';

  const whyNow=compact(
    input.transferPrime?.whyNow
    ||input.scenarioPrime?.dueReason
    ||input.mission?.whyThisGame
    ||'EXECUTE THE FROZEN DRAFT PLAN AND LET VERIFIED POST-GAME EVIDENCE DECIDE WHAT COMES NEXT.',
    190,
  );

  return{
    available:status!=='NONE',
    previousStatus:status,
    previousBehaviour:previous?.behaviour??null,
    previousMode:previous?.mode??null,
    previousSummary:previous?.note?compact(previous.note,180):previousSummary,
    whyNow,
  };
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
  intentProbe?:ClimbIntentProbe|null;
  historyRows?:HistoryAnalysisRow[];
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
    ||(input.transferPrime?.principle?('APPLY THE PRINCIPLE CLEANLY: '+input.transferPrime.principle):'')
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
  const deliveryPolicy=(input.coachingStrategy?.deliveryPolicy||input.coachIntervention?.deliveryPolicy||'FULL') as 'FULL'|'LIGHT'|'DIAGNOSTIC'|'NONE';
  const supportMode=upper(deliveryPolicy);
  const intentRequired=Boolean(input.intentProbe?.version===1&&!input.intentProbe?.response);
  const revealSpecificCueAfterIntent=deliveryPolicy!=='NONE';
  const autonomyTest=Boolean(input.coachingStrategy?.autonomyTest||deliveryPolicy==='NONE');
  const playerInstruction=deliveryPolicy==='NONE'
    ?'AUTONOMY TEST · OP CLIMB WILL NOT GIVE THE DECISION CUE. READ THE TRIGGER AND EXECUTE THE PRINCIPLE YOURSELF.'
    :deliveryPolicy==='DIAGNOSTIC'
      ?'DIAGNOSTIC REP · COMMIT TO YOUR OWN READ BEFORE COACH SUPPORT IS REVEALED.'
      :deliveryPolicy==='LIGHT'
        ?'LIGHT SUPPORT · ONE SHORT CUE ONLY. YOU OWN THE DECISION.'
        :'FULL SUPPORT · USE THE CUE, THEN EXECUTE THE DECISION YOURSELF.';
  const experiment=input.experimentSchedule?.status==='SCHEDULED'
    ?compact(input.experimentSchedule?.experimentType||'SCHEDULED TEST',100)
    :null;

  const continuity=continuityFromHistory(input.historyRows,input);

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
    scaffolding:{
      strategyMode:upper(input.coachingStrategy?.mode||'TEACH'),
      deliveryPolicy,
      intentProbeId:clean(input.intentProbe?.id)||null,
      intentPrompt:clean(input.intentProbe?.prompt)||null,
      intentRequiredBeforeCue:intentRequired,
      revealSpecificCueAfterIntent,
      autonomyTest,
      playerInstruction,
    },
    continuity,
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


export type CompanionContractReviewStatus='NO_CONTRACT'|'NOT_OBSERVED'|'EXECUTED'|'MISSED'|'MIXED';

export interface CompanionMatchContractReview{
  version:1;
  active:boolean;
  mode:CompanionLearningMode|null;
  behaviour:string|null;
  status:CompanionContractReviewStatus;
  matchedMoments:number;
  cleanMoments:number;
  improveMoments:number;
  headline:string;
  proof:string;
  nextAction:string;
  boundary:string;
}

export function reviewCompanionMatchContract(input:{
  contract:CompanionMatchContract|null|undefined;
  mission:ClimbMatchMissionReview;
  scenarioPrime:ScenarioPrimeReview;
  transfer:DecisionTransferReview;
}):CompanionMatchContractReview{
  const contract=input.contract;
  if(!contract||contract.version!=='MATCH_OS_V1'){
    return{
      version:1,active:false,mode:null,behaviour:null,status:'NO_CONTRACT',
      matchedMoments:0,cleanMoments:0,improveMoments:0,
      headline:'NO FROZEN MATCH CONTRACT',
      proof:'This game predates Match OS or no contract was persisted before play.',
      nextAction:'Use the normal Decision Graph review.',
      boundary:'No Match OS claim is made without a frozen pre-game contract.',
    };
  }

  const mode=contract.learning.mode;
  const source=mode==='TRANSFER_TEST'?input.transfer:mode==='SPACED_REP'?input.scenarioPrime:input.mission;
  const matched=Number(source?.matchedMoments||0);
  const cleanMoments=Number(source?.cleanMoments||0);
  const improveMoments=Number(source?.improveMoments||0);
  const raw=String(source?.status||'').toUpperCase();

  const status:CompanionContractReviewStatus=
    raw==='TRANSFERRED'||raw==='EXECUTED'?'EXECUTED':
    raw==='FAILED_TRANSFER'||raw==='MISSED'?'MISSED':
    raw==='MIXED'?'MIXED':
    raw==='NOT_OBSERVED'||raw==='NO_TEST'||raw==='NO_REP'||raw==='NO_MISSION'?'NOT_OBSERVED':
    matched===0?'NOT_OBSERVED':
    cleanMoments>0&&improveMoments===0?'EXECUTED':
    improveMoments>0&&cleanMoments===0?'MISSED':'MIXED';

  const headline=
    status==='EXECUTED'?'CONTRACT REP EXECUTED':
    status==='MISSED'?'CONTRACT REP MISSED':
    status==='MIXED'?'CONTRACT REP MIXED':
    status==='NOT_OBSERVED'?'CONTRACT REP NOT OBSERVED':'NO CONTRACT';

  const nextAction=
    status==='EXECUTED'
      ?'KEEP THE EVIDENCE. CURRICULUM DECIDES WHETHER TO REPEAT, FADE SUPPORT OR MOVE THE DIFFICULTY.'
      :status==='MISSED'
        ?'KEEP THE SAME LEARNING TARGET UNTIL REPEATED EVIDENCE JUSTIFIES A CHANGE.'
        :status==='MIXED'
          ?'DO NOT PROMOTE THE SKILL YET. THE CLEAN BRANCH IS NOT STABLE.'
          :'DO NOT SCORE THE PLAYER. THE PLANNED DECISION WINDOW DID NOT APPEAR.';

  return{
    version:1,
    active:true,
    mode,
    behaviour:contract.learning.behaviour,
    status,
    matchedMoments:matched,
    cleanMoments,
    improveMoments,
    headline,
    proof:clean(source?.note)||contract.proof.target,
    nextAction,
    boundary:'MATCH OS ONLY SCORES VERIFIED DECISION-GRAPH MOMENTS AGAINST THE CONTRACT FROZEN BEFORE PLAY. NOT OBSERVED IS NEUTRAL.',
  };
}
