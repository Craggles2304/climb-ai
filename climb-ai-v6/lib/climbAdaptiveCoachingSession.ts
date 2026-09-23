import type {HistoryAnalysisRow} from './riot/proHistory';
import type {DecisionBehaviourKey} from './decisionTwin';
import type {ClimbCurriculum} from './climbCurriculum';
import type {ClimbCoachingDeliveryPolicy,ClimbCoachingStrategy,ClimbCoachingStrategyMode} from './climbCoachingStrategy';
import type {PlayerCoachingIdentity} from './playerCoachingIdentity';
import type {CausalCoachLayer} from './decisionCausalChain';

export type AdaptiveCoachingSessionPhase=
  |'DIAGNOSE_TEACH'
  |'REINFORCE'
  |'FADE_TEST'
  |'TRANSFER_TEST'
  |'GRADUATE_REPLAN';

export type AdaptiveCoachingSessionStatus=
  |'BUILDING'
  |'ACTIVE'
  |'READY_TO_GRADUATE'
  |'REPLANNED'
  |'COMPLETE';

export type AdaptiveCoachingSessionEventAction=
  |'START'
  |'NOT_OBSERVED'
  |'HOLD'
  |'ADVANCE'
  |'REGRESS'
  |'EVIDENCE_WATCH'
  |'REPLAN'
  |'READY_TO_GRADUATE'
  |'COMPLETE';

export interface AdaptiveCoachingSessionStep{
  number:1|2|3|4|5;
  phase:AdaptiveCoachingSessionPhase;
  label:string;
  purpose:string;
  plannedSupport:'FULL'|'LIGHT'|'MINIMAL'|'NONE';
  coachMode:'TEACH'|'DIAGNOSE'|'REINFORCE'|'FADE';
  advanceRule:string;
  failureRule:string;
}

export interface AdaptiveCoachingSessionEvent{
  at:string;
  gameNumber:number;
  phaseBefore:AdaptiveCoachingSessionPhase;
  phaseAfter:AdaptiveCoachingSessionPhase;
  action:AdaptiveCoachingSessionEventAction;
  missionStatus:string;
  strategyStatus:string;
  intentDiagnosis:string;
  routeStatus:string;
  observedLayer:CausalCoachLayer|null;
  transferStatus:string;
  note:string;
}

export interface AdaptiveCoachingSession{
  version:1;
  id:string|null;
  generatedAt:string;
  gamesAnalyzed:number;
  status:AdaptiveCoachingSessionStatus;
  objectiveKey:DecisionBehaviourKey|null;
  objectiveLabel:string|null;
  startedGame:number|null;
  ageGames:number;
  plannedGames:5;
  currentStep:AdaptiveCoachingSessionStep|null;
  currentStepNumber:number|null;
  blockPlan:AdaptiveCoachingSessionStep[];
  observedGames:number;
  notObservedGames:number;
  completedSteps:number;
  replanCount:number;
  routeWatchLayer:CausalCoachLayer|null;
  routeWatchCount:number;
  lastEvaluatedAt:string|null;
  previousSessionId:string|null;
  events:AdaptiveCoachingSessionEvent[];
  nextGameBrief:{
    title:string;
    phase:AdaptiveCoachingSessionPhase|null;
    gameLabel:string;
    objective:string;
    support:string;
    coachingMode:string;
    firstQuestion:string;
    instruction:string;
    success:string;
    blocker:string|null;
  };
  summary:string;
  boundary:string;
}

const BOUNDARY='ADAPTIVE COACHING SESSIONS PLAN MULTI-GAME DEVELOPMENT BLOCKS FROM THE EXISTING PLAYER COACHING IDENTITY, CURRICULUM AND VERIFIED POST-GAME REVIEWS. NOT OBSERVED HOLDS THE CURRENT PHASE. ONE CONTRADICTORY GAME CREATES AN EVIDENCE WATCH, NOT A PLAYER-MODEL REWRITE. SUPPORT MAY BE RESTORED IMMEDIATELY FOR A VERIFIED KNOWLEDGE GAP, SUPPORT DEPENDENCE OR REGRESSION, BUT TRANSFER AND GRADUATION REMAIN LOCKED TO THE EXISTING CURRICULUM EVIDENCE GATES.';

const STEPS:AdaptiveCoachingSessionStep[]=[
  {
    number:1,
    phase:'DIAGNOSE_TEACH',
    label:'Diagnose / Teach',
    purpose:'Confirm the player can recognise the correct branch before asking for lower-support execution.',
    plannedSupport:'FULL',
    coachMode:'DIAGNOSE',
    advanceRule:'Advance after an observed clean mission with no verified knowledge gap.',
    failureRule:'A knowledge gap or unstable read stays here and restores explicit teaching.',
  },
  {
    number:2,
    phase:'REINFORCE',
    label:'Reinforce',
    purpose:'Repeat the same principle with less explanation and test follow-through.',
    plannedSupport:'LIGHT',
    coachMode:'REINFORCE',
    advanceRule:'Advance after a clean observed repetition when the safety layer allows support reduction.',
    failureRule:'A knowledge gap returns to Diagnose / Teach; other misses hold the phase.',
  },
  {
    number:3,
    phase:'FADE_TEST',
    label:'Fade',
    purpose:'Remove unnecessary scaffolding and test independent execution of the active principle.',
    plannedSupport:'MINIMAL',
    coachMode:'FADE',
    advanceRule:'Advance only after a clean reduced-support rep and when Curriculum local-mastery gates allow transfer.',
    failureRule:'Support dependence or regression restores support instead of forcing the fade.',
  },
  {
    number:4,
    phase:'TRANSFER_TEST',
    label:'Transfer Test',
    purpose:'Test the same principle under a genuinely different champion or decision context.',
    plannedSupport:'MINIMAL',
    coachMode:'FADE',
    advanceRule:'Advance only after verified Decision Transfer evidence reports TRANSFERRED.',
    failureRule:'Failed transfer returns to reinforcement without erasing previously earned local mastery.',
  },
  {
    number:5,
    phase:'GRADUATE_REPLAN',
    label:'Graduate / Replan',
    purpose:'Run a final proof rep and let the existing Curriculum decide whether the principle graduates or the block needs another cycle.',
    plannedSupport:'NONE',
    coachMode:'FADE',
    advanceRule:'Complete only when the Curriculum actually moves on or marks the objective complete.',
    failureRule:'If graduation gates are still open, replan to the evidence-backed phase instead of awarding fake mastery.',
  },
];

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function phaseIndex(phase:AdaptiveCoachingSessionPhase){return STEPS.findIndex(step=>step.phase===phase)}
function stepFor(index:number){return STEPS[Math.max(0,Math.min(4,index))]??STEPS[0]!}
function labelKey(key:DecisionBehaviourKey|null){return key?key.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,m=>m.toUpperCase()):'Development objective'}
function activeLesson(curriculum:ClimbCurriculum){return curriculum.status==='ACTIVE'?curriculum.currentLesson:null}
function activeContract(curriculum:ClimbCurriculum){return curriculum.autonomous?.activeContract??null}
function initialIndex(identity:PlayerCoachingIdentity,curriculum:ClimbCurriculum){
  const contract=activeContract(curriculum);
  if(identity.knowledgeExecution.diagnosis==='KNOWLEDGE_GAP'||identity.autonomy.supportNeed==='FULL')return 0;
  if(contract?.state==='TRANSFER_TEST')return 3;
  if(contract?.state==='STABILISE'&&['LIGHT','MINIMAL'].includes(identity.autonomy.supportNeed))return 2;
  if(contract?.state==='PRACTISE'||contract?.state==='STABILISE')return 1;
  if(identity.rootCause.layer==='AUTONOMY'&&identity.autonomy.supportNeed==='MINIMAL')return 2;
  return 0;
}
function phaseForLayer(layer:CausalCoachLayer|null){
  if(layer==='GAME_READ'||layer==='RECOGNITION')return 0;
  if(layer==='FOLLOW_THROUGH'||layer==='EXECUTION')return 1;
  if(layer==='AUTONOMY')return 2;
  return 0;
}
function transferReady(curriculum:ClimbCurriculum){
  const contract=activeContract(curriculum);
  return contract?.state==='TRANSFER_TEST'||contract?.testDirective?.mode==='TRANSFER_TEST'||curriculum.currentLesson?.phase==='TRANSFER';
}
function canFade(identity:PlayerCoachingIdentity,curriculum:ClimbCurriculum){
  const contract=activeContract(curriculum);
  if(identity.knowledgeExecution.diagnosis==='KNOWLEDGE_GAP')return false;
  if(['SUPPORT_DEPENDENT','REGRESSION_WATCH'].includes(identity.autonomy.state))return false;
  if(['FULL','DIAGNOSTIC','UNKNOWN'].includes(identity.autonomy.supportNeed))return false;
  if(contract?.supportPolicy==='FULL')return false;
  return true;
}
function fallbackIndex(identity:PlayerCoachingIdentity,curriculum:ClimbCurriculum){
  if(identity.knowledgeExecution.diagnosis==='KNOWLEDGE_GAP'||identity.autonomy.supportNeed==='FULL')return 0;
  if(!canFade(identity,curriculum))return 1;
  if(transferReady(curriculum))return 3;
  return 2;
}
function reviewRows(rows:HistoryAnalysisRow[],objectiveKey:DecisionBehaviourKey,after:string|null){
  const afterMs=after?Date.parse(after):Number.NEGATIVE_INFINITY;
  return [...rows]
    .filter(row=>row.analysis?.version===1&&Date.parse(row.createdAt)>afterMs)
    .sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))
    .map(row=>{
      const summary=(row.analysis as any)?.decisionGraph?.summary??{};
      const mission=summary.climbMission??null;
      if(!mission?.version||!mission.active||mission.behaviourKey!==objectiveKey)return null;
      return{
        at:row.createdAt,
        mission,
        strategy:summary.coachingStrategy??null,
        intent:summary.intentGap??null,
        route:summary.causalCoachRoute??null,
        transfer:summary.decisionTransfer??null,
      };
    })
    .filter((item):item is NonNullable<typeof item>=>Boolean(item));
}
function briefFor(input:{
  identity:PlayerCoachingIdentity;
  curriculum:ClimbCurriculum;
  step:AdaptiveCoachingSessionStep|null;
  gameNumber:number;
  blocker:string|null;
}):AdaptiveCoachingSession['nextGameBrief']{
  const {identity,curriculum,step,gameNumber,blocker}=input;
  const objective=curriculum.currentLesson?.label??identity.development.label??'Build verified decision evidence';
  if(!step){
    return{
      title:'SESSION BUILDING',
      phase:null,
      gameLabel:'WAITING FOR EVIDENCE',
      objective,
      support:'EVIDENCE BUILDING',
      coachingMode:'BUILDING',
      firstQuestion:identity.coachBrief.firstQuestion,
      instruction:'Do not force a coaching block until OP CLIMB has one evidence-backed active objective.',
      success:'Create repeated verified decision evidence first.',
      blocker,
    };
  }
  const support=step.phase==='DIAGNOSE_TEACH'
    ?identity.autonomy.supportNeed==='FULL'?'FULL SCAFFOLDING':'DIAGNOSTIC / FULL AS NEEDED'
    :step.phase==='REINFORCE'
      ?'LIGHT SUPPORT'
      :step.phase==='FADE_TEST'
        ?'MINIMAL SUPPORT'
        :step.phase==='TRANSFER_TEST'
          ?'MINIMAL SUPPORT · NOVEL CONDITION'
          :'NO EXTRA SUPPORT UNLESS SAFETY RESTORES IT';
  const instruction=step.phase==='DIAGNOSE_TEACH'
    ?identity.coachBrief.firstQuestion+' Then teach only the missing branch before the rep.'
    :step.phase==='REINFORCE'
      ?'Keep the same principle. Give one concise cue after the player commits to their read.'
      :step.phase==='FADE_TEST'
        ?'Protect the self-read. Do not add the old cue before the player commits.'
        :step.phase==='TRANSFER_TEST'
          ?'Test the same principle in a genuinely different champion or decision context. Do not count an unobserved transfer window.'
          :'Run one final evidence-backed proof rep. The Curriculum, not this session, decides graduation.';
  return{
    title:'GAME '+String(Math.min(5,Math.max(1,gameNumber)))+' · '+step.label.toUpperCase(),
    phase:step.phase,
    gameLabel:'STEP '+String(step.number)+'/5',
    objective,
    support,
    coachingMode:step.coachMode,
    firstQuestion:identity.coachBrief.firstQuestion,
    instruction,
    success:step.advanceRule,
    blocker,
  };
}
function blank(input:{
  generatedAt:string;
  gamesAnalyzed:number;
  identity:PlayerCoachingIdentity;
  curriculum:ClimbCurriculum;
  previous?:AdaptiveCoachingSession|null;
}):AdaptiveCoachingSession{
  const blocker=input.curriculum.status==='BUILDING'
    ?'Curriculum is still building.'
    :input.identity.status==='BUILDING'
      ?'Player Coaching Identity is still building.'
      :'No active evidence-backed lesson is available.';
  return{
    version:1,id:null,generatedAt:input.generatedAt,gamesAnalyzed:input.gamesAnalyzed,status:'BUILDING',
    objectiveKey:null,objectiveLabel:null,startedGame:null,ageGames:0,plannedGames:5,currentStep:null,currentStepNumber:null,
    blockPlan:STEPS,observedGames:0,notObservedGames:0,completedSteps:0,replanCount:input.previous?.replanCount??0,
    routeWatchLayer:null,routeWatchCount:0,lastEvaluatedAt:input.previous?.lastEvaluatedAt??null,
    previousSessionId:input.previous?.id??null,events:[],
    nextGameBrief:briefFor({identity:input.identity,curriculum:input.curriculum,step:null,gameNumber:1,blocker}),
    summary:'Adaptive Coaching Session is waiting for one active evidence-backed development objective before planning a multi-game block.',
    boundary:BOUNDARY,
  };
}
function sessionId(key:DecisionBehaviourKey,startedGame:number){return'adaptive-session:'+key.toLowerCase()+':g'+String(startedGame)}
function event(input:{
  at:string;gameNumber:number;before:number;after:number;action:AdaptiveCoachingSessionEventAction;rep:any;note:string;
}):AdaptiveCoachingSessionEvent{
  return{
    at:input.at,
    gameNumber:input.gameNumber,
    phaseBefore:stepFor(input.before).phase,
    phaseAfter:stepFor(input.after).phase,
    action:input.action,
    missionStatus:clean(input.rep.mission?.status)||'UNKNOWN',
    strategyStatus:clean(input.rep.strategy?.status)||'UNKNOWN',
    intentDiagnosis:clean(input.rep.intent?.diagnosis)||'NO_EVIDENCE',
    routeStatus:clean(input.rep.route?.status)||'NO_ROUTE',
    observedLayer:(input.rep.route?.observedLayer??null) as CausalCoachLayer|null,
    transferStatus:clean(input.rep.transfer?.status)||'NO_TEST',
    note:input.note,
  };
}

export function buildAdaptiveCoachingSession(input:{
  rows:HistoryAnalysisRow[];
  identity:PlayerCoachingIdentity;
  curriculum:ClimbCurriculum;
  previous?:AdaptiveCoachingSession|null;
  generatedAt?:string;
}):AdaptiveCoachingSession{
  const generatedAt=input.generatedAt??new Date().toISOString();
  const gamesAnalyzed=Math.max(input.identity.gamesAnalyzed,input.curriculum.gamesAnalyzed,input.rows.length);
  const lesson=activeLesson(input.curriculum);
  if(!lesson||input.identity.status==='BUILDING')return blank({generatedAt,gamesAnalyzed,identity:input.identity,curriculum:input.curriculum,previous:input.previous});

  const objectiveKey=lesson.behaviourKey;
  const objectiveLabel=lesson.label||labelKey(objectiveKey);
  const same=Boolean(input.previous?.id&&input.previous.objectiveKey===objectiveKey&&!['COMPLETE'].includes(input.previous.status));
  const startedGame=same&&input.previous?.startedGame?input.previous.startedGame:gamesAnalyzed;
  let currentIndex=same&&input.previous?.currentStep?phaseIndex(input.previous.currentStep.phase):initialIndex(input.identity,input.curriculum);
  if(currentIndex<0)currentIndex=0;
  let status:AdaptiveCoachingSessionStatus=same?(input.previous!.status==='REPLANNED'?'ACTIVE':input.previous!.status):'ACTIVE';
  let observedGames=same?input.previous!.observedGames:0;
  let notObservedGames=same?input.previous!.notObservedGames:0;
  let completedSteps=same?input.previous!.completedSteps:Math.max(0,currentIndex);
  let replanCount=same?input.previous!.replanCount:0;
  let routeWatchLayer:CausalCoachLayer|null=same?input.previous!.routeWatchLayer:null;
  let routeWatchCount=same?input.previous!.routeWatchCount:0;
  let lastEvaluatedAt=same?input.previous!.lastEvaluatedAt:null;
  let blocker:string|null=null;
  const events:AdaptiveCoachingSessionEvent[]=same?[...(input.previous!.events??[])].slice(-12):[];
  if(!same){
    events.push({
      at:generatedAt,gameNumber:1,phaseBefore:stepFor(currentIndex).phase,phaseAfter:stepFor(currentIndex).phase,action:'START',
      missionStatus:'NO_GAME_YET',strategyStatus:'NO_GAME_YET',intentDiagnosis:input.identity.knowledgeExecution.diagnosis,
      routeStatus:'NO_GAME_YET',observedLayer:null,transferStatus:'NO_TEST',
      note:'Started a five-phase coaching block for '+objectiveLabel+' at the evidence-appropriate phase.',
    });
  }

  const reps=reviewRows(input.rows,objectiveKey,lastEvaluatedAt);
  for(const rep of reps){
    const before=currentIndex;
    const gameNumber=Math.max(1,observedGames+notObservedGames+1);
    lastEvaluatedAt=rep.at;
    const missionStatus=clean(rep.mission?.status).toUpperCase();
    if(missionStatus==='NOT_OBSERVED'||missionStatus==='NO_MISSION'){
      notObservedGames+=1;
      events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'NOT_OBSERVED',rep,note:'The planned decision window did not produce gradeable evidence. Hold the same session phase; no pass or failure is awarded.'}));
      continue;
    }
    observedGames+=1;

    const routeStatus=clean(rep.route?.status).toUpperCase();
    const observedLayer=(rep.route?.observedLayer??null) as CausalCoachLayer|null;
    if(routeStatus==='SHIFT_REQUIRED'&&observedLayer){
      if(routeWatchLayer===observedLayer)routeWatchCount+=1;
      else{routeWatchLayer=observedLayer;routeWatchCount=1}
      const identityAlreadyShifted=input.identity.change.status==='SHIFTED'&&input.identity.rootCause.layer===observedLayer;
      if(routeWatchCount>=2||identityAlreadyShifted){
        currentIndex=phaseForLayer(observedLayer);
        replanCount+=1;
        status='REPLANNED';
        blocker='Session replanned around repeated '+clean(observedLayer).replaceAll('_',' ')+' evidence without rewriting the Curriculum objective.';
        events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'REPLAN',rep,note:blocker}));
        continue;
      }
      events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'EVIDENCE_WATCH',rep,note:'A different causal layer appeared once. Keep the current block and watch for repetition before replanning.'}));
      continue;
    }else if(routeStatus==='CONFIRMED'||routeStatus==='CLEAN_REP'){
      routeWatchLayer=null;routeWatchCount=0;
    }

    const intent=clean(rep.intent?.diagnosis).toUpperCase();
    const missionClean=missionStatus==='EXECUTED';
    const strategyStatus=clean(rep.strategy?.status).toUpperCase();
    const strategyClean=strategyStatus==='CLEAN'||(!strategyStatus&&missionClean);
    const transferStatus=clean(rep.transfer?.status).toUpperCase();

    if(intent==='KNOWLEDGE_GAP'){
      currentIndex=0;
      status='ACTIVE';
      blocker='Verified knowledge gap restored Diagnose / Teach.';
      events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:before===0?'HOLD':'REGRESS',rep,note:blocker}));
      continue;
    }

    if(before>=2&&!canFade(input.identity,input.curriculum)){
      currentIndex=input.identity.autonomy.supportNeed==='FULL'?0:1;
      status='ACTIVE';
      blocker='Fade is safety-blocked by the current support/autonomy evidence.';
      events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'REGRESS',rep,note:blocker}));
      continue;
    }

    if(before===0){
      if(missionClean&&strategyClean&&intent!=='UNSTABLE'){
        currentIndex=1;completedSteps=Math.max(completedSteps,1);blocker=null;
        events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'ADVANCE',rep,note:'The player produced a clean observed rep without a verified knowledge gap. Move from Diagnose / Teach to Reinforce.'}));
      }else{
        events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'HOLD',rep,note:'The teaching/diagnostic rep is not clean enough to reduce support yet.'}));
      }
      continue;
    }

    if(before===1){
      if(missionClean&&strategyClean&&canFade(input.identity,input.curriculum)){
        currentIndex=2;completedSteps=Math.max(completedSteps,2);blocker=null;
        events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'ADVANCE',rep,note:'Reinforcement held under verified evidence and the safety layer allows a reduced-support test.'}));
      }else{
        if(missionClean&&strategyClean&&!canFade(input.identity,input.curriculum))blocker='The rep was clean, but support cannot fade until autonomy/support evidence clears the safety gate.';
        events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'HOLD',rep,note:blocker??'Reinforcement has not produced a clean enough observed rep to start fading support.'}));
      }
      continue;
    }

    if(before===2){
      const autonomyEvidence=Boolean(rep.strategy?.autonomyEvidence)||Boolean(rep.strategy&&!rep.strategy.intervened);
      if(missionClean&&strategyClean&&autonomyEvidence){
        if(transferReady(input.curriculum)){
          currentIndex=3;completedSteps=Math.max(completedSteps,3);blocker=null;
          events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'ADVANCE',rep,note:'A clean reduced-support rep is verified and the existing Curriculum now allows a transfer test.'}));
        }else{
          blocker='Clean autonomy evidence earned, but transfer remains locked until the existing Curriculum reaches its local-mastery gate.';
          events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'HOLD',rep,note:blocker}));
        }
      }else{
        events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'HOLD',rep,note:'The fade test did not yet produce verified independent execution. Keep the phase without erasing earlier learning.'}));
      }
      continue;
    }

    if(before===3){
      if(!transferReady(input.curriculum)){
        currentIndex=2;status='REPLANNED';replanCount+=1;
        blocker='Transfer became unavailable under the current Curriculum evidence, so the session returned to Fade / local stability.';
        events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'REPLAN',rep,note:blocker}));
      }else if(transferStatus==='TRANSFERRED'){
        currentIndex=4;completedSteps=Math.max(completedSteps,4);status='READY_TO_GRADUATE';blocker=null;
        events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'READY_TO_GRADUATE',rep,note:'The novel-condition test transferred cleanly. Move to the final proof / Curriculum graduation check.'}));
      }else if(transferStatus==='FAILED_TRANSFER'){
        currentIndex=1;status='REPLANNED';replanCount+=1;
        blocker='Transfer failed. Preserve local mastery, restore reinforcement and rebuild generalisation evidence.';
        events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'REPLAN',rep,note:blocker}));
      }else{
        events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'HOLD',rep,note:'Transfer was not cleanly verified. Keep the transfer phase; NOT OBSERVED or MIXED evidence does not award principle ownership.'}));
      }
      continue;
    }

    if(before===4){
      const movedOn=input.curriculum.currentLesson?.behaviourKey!==objectiveKey||input.curriculum.status==='COMPLETE';
      if(movedOn){
        status='COMPLETE';completedSteps=5;blocker=null;
        events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'COMPLETE',rep,note:'The existing Curriculum moved on. This coaching block is complete.'}));
      }else{
        currentIndex=fallbackIndex(input.identity,input.curriculum);
        status='REPLANNED';replanCount+=1;
        blocker='The final proof rep did not unlock Curriculum graduation yet. Replan to the current evidence-backed phase instead of awarding fake mastery.';
        events.push(event({at:rep.at,gameNumber,before,after:currentIndex,action:'REPLAN',rep,note:blocker}));
      }
    }
  }

  if(status==='REPLANNED')status='ACTIVE';
  const currentStep=status==='COMPLETE'?null:stepFor(currentIndex);
  const ageGames=Math.max(1,gamesAnalyzed-startedGame+1);
  const nextGameNumber=Math.min(5,Math.max(1,observedGames+notObservedGames+1));
  const nextGameBrief=briefFor({identity:input.identity,curriculum:input.curriculum,step:currentStep,gameNumber:nextGameNumber,blocker});
  const summary=status==='COMPLETE'
    ?objectiveLabel+' coaching block is complete because the existing Curriculum moved on.'
    :currentStep
      ?objectiveLabel+' session is on '+currentStep.label+' (step '+String(currentStep.number)+'/5). '+(blocker??currentStep.purpose)
      :'Adaptive Coaching Session is waiting for the next evidence-backed phase.';

  return{
    version:1,
    id:same?input.previous!.id:sessionId(objectiveKey,startedGame),
    generatedAt,
    gamesAnalyzed,
    status,
    objectiveKey,
    objectiveLabel,
    startedGame,
    ageGames,
    plannedGames:5,
    currentStep,
    currentStepNumber:currentStep?.number??null,
    blockPlan:STEPS,
    observedGames,
    notObservedGames,
    completedSteps,
    replanCount,
    routeWatchLayer,
    routeWatchCount,
    lastEvaluatedAt,
    previousSessionId:same?input.previous?.previousSessionId??null:input.previous?.id??null,
    events:events.slice(-12),
    nextGameBrief,
    summary,
    boundary:BOUNDARY,
  };
}

function policyRank(policy:ClimbCoachingDeliveryPolicy|'NONE'){return policy==='FULL'?4:policy==='DIAGNOSTIC'?3:policy==='LIGHT'?2:0}
function safetyProtected(strategy:ClimbCoachingStrategy){
  return strategy.mode==='TEACH'
    ||strategy.deliveryPolicy==='FULL'
    ||strategy.autonomyState==='SUPPORT_DEPENDENT'
    ||strategy.autonomyState==='REGRESSION_WATCH'
    ||strategy.intentDiagnosis==='KNOWLEDGE_GAP';
}

export function applyAdaptiveCoachingSession(
  strategy:ClimbCoachingStrategy,
  session:AdaptiveCoachingSession|null|undefined,
):ClimbCoachingStrategy&{
  adaptiveSessionId?:string|null;
  adaptiveSessionPhase?:AdaptiveCoachingSessionPhase|null;
  adaptiveSessionStep?:number|null;
  adaptiveSessionConstrained?:boolean;
}{
  if(!session?.id||session.status==='BUILDING'||session.status==='COMPLETE'||!session.currentStep)return strategy;
  const step=session.currentStep;
  let mode:ClimbCoachingStrategyMode=step.coachMode==='DIAGNOSE'?'DIAGNOSE':step.coachMode;
  let delivery:ClimbCoachingDeliveryPolicy|'NONE'=
    step.phase==='DIAGNOSE_TEACH'?'DIAGNOSTIC':
    step.phase==='REINFORCE'?'LIGHT':
    step.phase==='FADE_TEST'?'NONE':
    step.phase==='TRANSFER_TEST'?'LIGHT':'NONE';

  const constrained=safetyProtected(strategy)&&policyRank(delivery)<policyRank(strategy.deliveryPolicy);
  if(constrained){
    mode=strategy.mode;
    delivery=strategy.deliveryPolicy;
  }
  const directive='SESSION '+String(step.number)+'/5 · '+step.label.toUpperCase()+': '+session.nextGameBrief.instruction;
  return{
    ...strategy,
    mode,
    intervene:delivery!=='NONE',
    deliveryPolicy:delivery==='NONE'?'NONE':delivery,
    title:step.label.toUpperCase()+' · '+strategy.title,
    playerMessage:session.nextGameBrief.firstQuestion+' '+strategy.playerMessage,
    coachDirective:directive+' '+strategy.coachDirective,
    successDefinition:session.nextGameBrief.success+' '+strategy.successDefinition,
    adaptiveSessionId:session.id,
    adaptiveSessionPhase:step.phase,
    adaptiveSessionStep:step.number,
    adaptiveSessionConstrained:constrained,
  };
}

export const ADAPTIVE_COACHING_SESSION_BOUNDARY=BOUNDARY;
