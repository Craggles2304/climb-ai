import type {HistoryAnalysisRow} from './riot/proHistory';
import type {DecisionBehaviourKey,DecisionSituationTag} from './decisionTwin';
import type {ClimbCurriculum} from './climbCurriculum';
import type {ClimbMatchMission,ClimbMatchMissionReview} from './climbMissionDesign';
import type {ClimbCoachTwin} from './climbCoachTwin';
import {summarizeIntentGapHistory,type ClimbIntentDiagnosis} from './climbIntentGap';
import {buildClimbAutonomyProfile,type ClimbAutonomyState} from './climbAutonomy';
import {buildClimbInterventionValueProfile,type ClimbInterventionValueState} from './climbInterventionValue';

export type ClimbCoachingStrategyMode='TEACH'|'REINFORCE'|'DIAGNOSE'|'FADE';
export type ClimbCoachingDeliveryPolicy='FULL'|'LIGHT'|'DIAGNOSTIC'|'NONE';
export type ClimbCoachingStrategyReviewStatus='NO_STRATEGY'|'NOT_OBSERVED'|'CLEAN'|'MIXED'|'MISSED';

export interface ClimbCoachingStrategy{
  version:1;
  id:string;
  missionId:string;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  targetTag:DecisionSituationTag;
  mode:ClimbCoachingStrategyMode;
  intervene:boolean;
  deliveryPolicy:ClimbCoachingDeliveryPolicy;
  repLevel:number;
  repStage:string;
  recentObservedMissions:number;
  recentExecutionRate:number|null;
  recentCleanStreak:number;
  recentMissStreak:number;
  coachTwinStatus:string;
  intentDiagnosis:ClimbIntentDiagnosis;
  intentEvidenceStreak:number;
  autonomyState:ClimbAutonomyState;
  autonomyStrength:number|null;
  supportDependenceGap:number|null;
  interventionValueState:ClimbInterventionValueState;
  interventionResponseDifference:number|null;
  interventionValueConfidence:'LOW'|'MEDIUM'|'HIGH';
  title:string;
  playerMessage:string;
  decision:string;
  coachDirective:string;
  successDefinition:string;
  autonomyTest:boolean;
  source:'CLIMB_COACHING_STRATEGY';
  boundary:string;
}

export interface ClimbCoachingStrategyReview{
  version:1;
  active:boolean;
  strategyId:string|null;
  missionId:string|null;
  behaviourKey:DecisionBehaviourKey|null;
  behaviourLabel:string|null;
  targetTag:DecisionSituationTag|null;
  mode:ClimbCoachingStrategyMode|null;
  intervened:boolean;
  status:ClimbCoachingStrategyReviewStatus;
  matchedMoments:number;
  cleanMoments:number;
  improveMoments:number;
  autonomyEvidence:boolean;
  note:string;
  boundary:string;
}

const BOUNDARY='CLIMB Coaching Strategy decides the amount and purpose of coaching support before the game. It never changes the frozen win condition or Curriculum lesson. NOT OBSERVED is neutral, one miss cannot erase learned evidence, and reduced support is used to test independent execution rather than to withhold the game plan.';
const REVIEW_BOUNDARY='Strategy review grades only the frozen support policy against the matching verified CLIMB Mission. A clean faded rep is evidence of independent execution in that observed context, not proof of permanent mastery.';

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function observedMissionReviews(rows:HistoryAnalysisRow[],behaviourKey:DecisionBehaviourKey){
  return [...rows]
    .filter(row=>row.analysis?.version===1)
    .sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))
    .slice(-50)
    .map(row=>(row.analysis as any)?.decisionGraph?.summary?.climbMission as ClimbMatchMissionReview|undefined)
    .filter((review):review is ClimbMatchMissionReview=>Boolean(
      review?.version===1&&
      review.active&&
      review.behaviourKey===behaviourKey&&
      ['EXECUTED','MISSED','MIXED'].includes(clean(review.status).toUpperCase())
    ));
}
function observedStrategyReviews(rows:HistoryAnalysisRow[],behaviourKey:DecisionBehaviourKey){
  return [...rows]
    .filter(row=>row.analysis?.version===1)
    .sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))
    .slice(-50)
    .map(row=>(row.analysis as any)?.decisionGraph?.summary?.coachingStrategy as ClimbCoachingStrategyReview|undefined)
    .filter((review):review is ClimbCoachingStrategyReview=>Boolean(
      review?.version===1&&
      review.active&&
      review.behaviourKey===behaviourKey&&
      ['CLEAN','MISSED','MIXED'].includes(clean(review.status).toUpperCase())
    ));
}
function missionScore(review:ClimbMatchMissionReview){
  if(review.status==='EXECUTED')return 100;
  if(review.status==='MISSED')return 0;
  if(review.status==='MIXED'&&review.matchedMoments)return Math.round(review.cleanMoments/review.matchedMoments*100);
  return null;
}
function streak(reviews:ClimbMatchMissionReview[],target:'EXECUTED'|'MISSED'){
  let total=0;
  for(let i=reviews.length-1;i>=0;i--){
    if(reviews[i]?.status!==target)break;
    total++;
  }
  return total;
}
function coachStatus(twin:ClimbCoachTwin,key:DecisionBehaviourKey){
  return twin.behaviourProfiles.find(item=>item.behaviourKey===key)?.status??'BUILDING';
}
function strategyFor(mode:ClimbCoachingStrategyMode,input:{
  mission:ClimbMatchMission;
  observed:number;
  executionRate:number|null;
  cleanStreak:number;
  missStreak:number;
  coachTwinStatus:string;
  intentDiagnosis:ClimbIntentDiagnosis;
  intentEvidenceStreak:number;
  autonomyState:ClimbAutonomyState;
  autonomyStrength:number|null;
  supportDependenceGap:number|null;
  interventionValueState:ClimbInterventionValueState;
  interventionResponseDifference:number|null;
  interventionValueConfidence:'LOW'|'MEDIUM'|'HIGH';
}):ClimbCoachingStrategy{
  const mission=input.mission;
  const base={
    version:1 as const,
    id:['coaching-strategy',mission.id,mode].join(':').toLowerCase(),
    missionId:mission.id,
    behaviourKey:mission.behaviourKey,
    behaviourLabel:mission.behaviourLabel,
    targetTag:mission.targetTag,
    mode,
    repLevel:mission.repLevel,
    repStage:mission.repStage,
    recentObservedMissions:input.observed,
    recentExecutionRate:input.executionRate,
    recentCleanStreak:input.cleanStreak,
    recentMissStreak:input.missStreak,
    coachTwinStatus:input.coachTwinStatus,
    intentDiagnosis:input.intentDiagnosis,
    intentEvidenceStreak:input.intentEvidenceStreak,
    autonomyState:input.autonomyState,
    autonomyStrength:input.autonomyStrength,
    supportDependenceGap:input.supportDependenceGap,
    interventionValueState:input.interventionValueState,
    interventionResponseDifference:input.interventionResponseDifference,
    interventionValueConfidence:input.interventionValueConfidence,
    source:'CLIMB_COACHING_STRATEGY' as const,
    boundary:BOUNDARY,
  };
  if(mode==='FADE')return{
    ...base,
    intervene:false,
    deliveryPolicy:'NONE',
    title:'FADE THE COACHING',
    playerMessage:'YOU OWN THE READ · EXECUTE THE FROZEN MISSION WITHOUT AN EXTRA COACH TWIN CUE.',
    decision:input.autonomyState==='AUTONOMOUS'
      ?'Autonomy Engine has repeated clean unscaffolded evidence for this decision. OP CLIMB keeps the mission visible while leaving the adaptive teaching overlay off unless regression evidence appears.'
      :'Recent verified execution is strong enough to reduce scaffolding for this rep. OP CLIMB keeps the mission visible but removes the adaptive teaching overlay.',
    coachDirective:'Do not add a new teaching format. Preserve the exact frozen mission and observe whether the player executes it independently.',
    successDefinition:'A matching verified clean mission moment is autonomy evidence. NOT OBSERVED scores nothing. One miss does not erase prior learning.',
    autonomyTest:true,
  };
  if(mode==='DIAGNOSE')return{
    ...base,
    intervene:true,
    deliveryPolicy:'DIAGNOSTIC',
    title:'DIAGNOSE THE BRANCH',
    playerMessage:'DO NOT ADD MORE ADVICE · TEST WHETHER YOU CAN IDENTIFY THE RIGHT BRANCH BEFORE THE MOMENT ARRIVES.',
    decision:input.autonomyState==='SUPPORT_DEPENDENT'
      ?'The player is substantially cleaner with support than during faded reps. OP CLIMB is diagnosing what disappears when scaffolding is removed before difficulty increases.'
      :input.coachTwinStatus==='RETESTING'
        ?'The previously strongest coaching format has stopped producing stable response, so OP CLIMB is testing a different delivery route.'
        :'Repeated verified misses mean simply repeating the same cue is low-value. OP CLIMB will use a diagnostic coaching format before adding difficulty.',
    coachDirective:'Use a diagnostic or retest format. Test recognition of the branch; do not change the Curriculum lesson or tactical game plan.',
    successDefinition:'The same frozen mission must be judged from verified matching decisions. Diagnostic support does not lower the evidence gate.',
    autonomyTest:false,
  };
  if(mode==='REINFORCE')return{
    ...base,
    intervene:true,
    deliveryPolicy:'LIGHT',
    title:input.intentDiagnosis==='EXECUTION_GAP'?'EXECUTION GAP · REINFORCE':'REINFORCE · DO NOT OVERCOACH',
    playerMessage:input.intentDiagnosis==='EXECUTION_GAP'?'YOU ALREADY KNOW THE BRANCH · MAKE THE DECISION EARLY ENOUGH TO EXECUTE IT.':'ONE SHORT REMINDER · THEN PLAY.',
    decision:input.autonomyState==='REGRESSION_WATCH'
      ?'Independent execution had previously held, but recent faded reps regressed. OP CLIMB is restoring one short scaffold without deleting the earlier autonomy evidence.'
      :input.interventionValueState==='STRONG_SUPPORT_ASSOCIATED_LIFT'
        ?'Matched supported-versus-faded reps show a strong repeated support-associated response difference for this branch. OP CLIMB will use light support selectively while continuing autonomy checks; this is association evidence, not proof of causation.'
        :input.intentDiagnosis==='EXECUTION_GAP'
          ?'Repeated pre-cue answers show the correct decision model was already present, but verified execution still broke down. OP CLIMB should reduce execution friction rather than add more theory.'
          :'The player has usable recent evidence on this branch, but it is not stable enough to remove support completely.',
    coachDirective:input.intentDiagnosis==='EXECUTION_GAP'
      ?'Use one short trigger/action cue. Do not re-explain the concept; support timing, attention and execution.'
      :'Keep the Coach Twin format concise. Reinforce the existing branch; do not introduce a new concept or extra instruction.',
    successDefinition:'Repeated matching clean decisions strengthen the lesson. A single miss should not trigger a full reset.',
    autonomyTest:false,
  };
  return{
    ...base,
    intervene:true,
    deliveryPolicy:'FULL',
    title:input.intentDiagnosis==='KNOWLEDGE_GAP'?'KNOWLEDGE GAP · TEACH THE READ':'TEACH THE BRANCH',
    playerMessage:input.intentDiagnosis==='KNOWLEDGE_GAP'?'REBUILD THE DECISION MODEL · GET THE BRANCH RIGHT BEFORE EXECUTION SPEED MATTERS.':'MAKE THE DECISION RULE EXPLICIT BEFORE THE GAME.',
    decision:input.intentDiagnosis==='KNOWLEDGE_GAP'
      ?'Repeated pre-cue answers selected the wrong branch and verified execution also failed. OP CLIMB should teach understanding before demanding cleaner mechanics or timing.'
      :input.observed<2
        ?'There is not enough observed mission evidence to assume the branch is understood yet.'
        :'The branch is still unstable, so explicit coaching remains appropriate.',
    coachDirective:input.intentDiagnosis==='KNOWLEDGE_GAP'
      ?'Explain why this branch is correct and contrast it with the old branch. Do not treat this as execution-only.'
      :'Use the Coach Twin delivery method to make the trigger and action explicit. Keep the intervention to this one Curriculum lesson.',
    successDefinition:'Build repeated verified evidence before reducing support. One clean game cannot move directly to independent execution.',
    autonomyTest:false,
  };
}

export function buildClimbCoachingStrategy(input:{
  rows:HistoryAnalysisRow[];
  curriculum:ClimbCurriculum;
  mission:ClimbMatchMission|null|undefined;
  coachTwin:ClimbCoachTwin;
}):ClimbCoachingStrategy|null{
  const mission=input.mission;
  if(!mission||mission.status!=='READY')return null;

  const reviews=observedMissionReviews(input.rows,mission.behaviourKey);
  const recent=reviews.slice(-4);
  const scores=recent.map(missionScore).filter((value):value is number=>typeof value==='number');
  const executionRate=scores.length?Math.round(scores.reduce((sum,value)=>sum+value,0)/scores.length):null;
  const cleanStreak=streak(reviews,'EXECUTED');
  const missStreak=streak(reviews,'MISSED');
  const strategyReviews=observedStrategyReviews(input.rows,mission.behaviourKey);
  const recentFaded=strategyReviews.filter(review=>review.mode==='FADE').slice(-2);
  const fadedMisses=recentFaded.filter(review=>review.status==='MISSED').length;
  const twinStatus=coachStatus(input.coachTwin,mission.behaviourKey);
  const intentHistory=summarizeIntentGapHistory(input.rows,mission.behaviourKey);
  const autonomyProfile=buildClimbAutonomyProfile(input.rows);
  const autonomyCard=autonomyProfile.cards.find(card=>card.behaviourKey===mission.behaviourKey)??null;
  const interventionValueProfile=buildClimbInterventionValueProfile(input.rows);
  const interventionValueCard=interventionValueProfile.cards.find(card=>card.behaviourKey===mission.behaviourKey)??null;

  const facts={
    mission,
    observed:reviews.length,
    executionRate,
    cleanStreak,
    missStreak,
    coachTwinStatus:twinStatus,
    intentDiagnosis:intentHistory.recentDiagnosis,
    intentEvidenceStreak:intentHistory.recentSameDiagnosisStreak,
    autonomyState:autonomyCard?.state??'BUILDING',
    autonomyStrength:autonomyCard?.autonomyStrength??null,
    supportDependenceGap:autonomyCard?.supportDependenceGap??null,
    interventionValueState:interventionValueCard?.state??'BUILDING',
    interventionResponseDifference:interventionValueCard?.matchedResponseDifference??null,
    interventionValueConfidence:interventionValueCard?.confidence??'LOW',
  };

  // Intent Gap separates knowing from doing before generic miss streaks are interpreted.
  // Repeated knowledge gaps need teaching; repeated execution gaps need less theory and tighter execution support.
  if(intentHistory.recentDiagnosis==='KNOWLEDGE_GAP'&&intentHistory.recentSameDiagnosisStreak>=2){
    return strategyFor('TEACH',facts);
  }
  if(intentHistory.recentDiagnosis==='EXECUTION_GAP'&&intentHistory.recentSameDiagnosisStreak>=2){
    return strategyFor('REINFORCE',facts);
  }

  // Autonomy Engine controls support after intent has been interpreted.
  // A support-dependent player should be diagnosed before difficulty increases.
  // A regression watch restores light scaffolding without deleting prior ownership.
  if(autonomyCard?.state==='REGRESSION_WATCH')return strategyFor('REINFORCE',facts);
  if(autonomyCard?.state==='SUPPORT_DEPENDENT')return strategyFor('DIAGNOSE',facts);
  if(autonomyCard?.state==='AUTONOMOUS'&&mission.repLevel>=3)return strategyFor('FADE',facts);

  // A previously reduced-support rep that misses once gets light scaffolding back,
  // not a wholesale re-teach. Two faded misses are enough to diagnose the branch.
  if(fadedMisses>=2)return strategyFor('DIAGNOSE',facts);
  if(fadedMisses===1&&recentFaded.at(-1)?.status==='MISSED')return strategyFor('REINFORCE',facts);

  // Intervention Value is lower-priority than Intent Gap and Autonomy. It can tune
  // support only after those stronger learning-state signals have been handled.
  // Matched response difference is association evidence, never a causal override.
  if(interventionValueCard?.state==='FADE_ASSOCIATED_BETTER'&&mission.repLevel>=3&&cleanStreak>=2){
    return strategyFor('FADE',facts);
  }
  if(interventionValueCard?.state==='STRONG_SUPPORT_ASSOCIATED_LIFT'&&mission.repLevel>=2){
    return strategyFor('REINFORCE',facts);
  }

  // Delivery instability or repeated verified branch misses should change the
  // coaching approach before difficulty or curriculum changes.
  if(twinStatus==='RETESTING'||missStreak>=2||(reviews.length>=4&&(executionRate??100)<35)){
    return strategyFor('DIAGNOSE',facts);
  }

  // New/recognition-stage learning receives explicit scaffolding.
  if(reviews.length<2||mission.repLevel<=1||mission.repStage==='RECOGNISE'){
    return strategyFor('TEACH',facts);
  }

  // Fade only after repeated clean observed decisions. This is an autonomy test,
  // not graduation and not a claim that the skill is permanently mastered.
  if(
    reviews.length>=4&&
    cleanStreak>=3&&
    (executionRate??0)>=75&&
    mission.repLevel>=3
  ){
    return strategyFor('FADE',facts);
  }

  // Improving but not yet independent: one concise reminder is enough.
  if(cleanStreak>=1||(reviews.length>=3&&(executionRate??0)>=50)){
    return strategyFor('REINFORCE',facts);
  }

  return strategyFor('TEACH',facts);
}

export function reviewClimbCoachingStrategy(
  strategy:ClimbCoachingStrategy|null|undefined,
  missionReview:ClimbMatchMissionReview,
):ClimbCoachingStrategyReview{
  if(!strategy){
    return{
      version:1,
      active:false,
      strategyId:null,
      missionId:missionReview.missionId,
      behaviourKey:missionReview.behaviourKey,
      behaviourLabel:missionReview.behaviourLabel,
      targetTag:missionReview.targetTag,
      mode:null,
      intervened:false,
      status:'NO_STRATEGY',
      matchedMoments:0,
      cleanMoments:0,
      improveMoments:0,
      autonomyEvidence:false,
      note:'No frozen Coaching Strategy was attached to this match mission.',
      boundary:REVIEW_BOUNDARY,
    };
  }

  const status:ClimbCoachingStrategyReviewStatus=missionReview.status==='EXECUTED'
    ?'CLEAN'
    :missionReview.status==='MISSED'
      ?'MISSED'
      :missionReview.status==='MIXED'
        ?'MIXED'
        :'NOT_OBSERVED';
  const autonomyEvidence=strategy.mode==='FADE'&&status==='CLEAN';

  let note='The frozen support policy was not tested because the matching mission decision was not observed.';
  if(status==='CLEAN'&&strategy.mode==='FADE')note='The player executed the matching mission cleanly with the adaptive coaching overlay removed. This is observed autonomy evidence for this context, not permanent mastery.';
  else if(status==='CLEAN')note='The player executed the matching mission cleanly with '+strategy.mode.toLowerCase()+' support. This is scaffolded execution evidence, not proof that support is no longer needed.';
  else if(status==='MISSED'&&strategy.mode==='FADE')note='The faded-support rep was missed. One miss does not erase prior learning; the next strategy may restore light scaffolding before any full re-teach.';
  else if(status==='MISSED')note='The matching mission was missed under '+strategy.mode.toLowerCase()+' support. Repeated verified misses, not one game, determine whether the coaching strategy changes.';
  else if(status==='MIXED')note='The branch was partly executed under '+strategy.mode.toLowerCase()+' support, so support should not be removed on this result alone.';

  return{
    version:1,
    active:true,
    strategyId:strategy.id,
    missionId:strategy.missionId,
    behaviourKey:strategy.behaviourKey,
    behaviourLabel:strategy.behaviourLabel,
    targetTag:strategy.targetTag,
    mode:strategy.mode,
    intervened:strategy.intervene,
    status,
    matchedMoments:missionReview.matchedMoments,
    cleanMoments:missionReview.cleanMoments,
    improveMoments:missionReview.improveMoments,
    autonomyEvidence,
    note,
    boundary:REVIEW_BOUNDARY,
  };
}

export const CLIMB_COACHING_STRATEGY_BOUNDARY=BOUNDARY;
