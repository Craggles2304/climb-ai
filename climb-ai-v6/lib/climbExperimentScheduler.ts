import type {HistoryAnalysisRow} from './riot/proHistory';
import type {DecisionBehaviourKey,DecisionSituationTag} from './decisionTwin';
import type {ClimbMatchMission,ClimbMatchMissionReview} from './climbMissionDesign';
import type {ClimbCoachingStrategyReview} from './climbCoachingStrategy';
import {summarizeIntentGapHistory,type ClimbIntentDiagnosis} from './climbIntentGap';
import {buildClimbAutonomyProfile,type ClimbAutonomyState} from './climbAutonomy';
import {buildClimbInterventionValueProfile,type ClimbInterventionValueState} from './climbInterventionValue';

export type ClimbExperimentStatus='DEFERRED'|'SCHEDULED';
export type ClimbExperimentType='SUPPORTED_RETEST'|'FADE_HOLDOUT'|'DIAGNOSTIC_RETEST'|'AUTONOMY_RECHECK'|'MATCHED_COMPARISON';
export type ClimbExperimentDeliveryPolicy='LIGHT'|'DIAGNOSTIC'|'NONE';
export type ClimbExperimentInformationGain='LOW'|'MEDIUM'|'HIGH';
export type ClimbExperimentReviewStatus='NO_EXPERIMENT'|'NOT_OBSERVED'|'COMPLETED'|'POLICY_MISMATCH';

export interface ClimbExperimentSchedule{
  version:1;
  id:string;
  missionId:string;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  targetTag:DecisionSituationTag;
  repLevel:number;
  cellKey:string;
  status:ClimbExperimentStatus;
  experimentType:ClimbExperimentType;
  requestedDeliveryPolicy:ClimbExperimentDeliveryPolicy;
  supportedObservedInCell:number;
  fadedObservedInCell:number;
  comparablePairsInCell:number;
  intentDiagnosis:ClimbIntentDiagnosis;
  intentEvidenceStreak:number;
  autonomyState:ClimbAutonomyState;
  interventionValueState:ClimbInterventionValueState;
  informationGain:ClimbExperimentInformationGain;
  hypothesis:string;
  informationNeed:string;
  safetyReason:string;
  successRead:string;
  source:'CLIMB_EXPERIMENT_SCHEDULER';
  boundary:string;
}

export interface ClimbExperimentReview{
  version:1;
  active:boolean;
  experimentId:string|null;
  missionId:string|null;
  behaviourKey:DecisionBehaviourKey|null;
  behaviourLabel:string|null;
  targetTag:DecisionSituationTag|null;
  repLevel:number|null;
  experimentType:ClimbExperimentType|null;
  requestedDeliveryPolicy:ClimbExperimentDeliveryPolicy|null;
  status:ClimbExperimentReviewStatus;
  observedDeliveryPolicy:'SUPPORTED'|'FADED'|'NONE';
  missionStatus:ClimbMatchMissionReview['status'];
  responseScore:number|null;
  informationAdded:boolean;
  note:string;
  boundary:string;
}

const BOUNDARY='CLIMB Experiment Scheduler chooses the most informative safe next support condition before the match. It never changes the frozen game plan, Curriculum lesson or Rep Ladder difficulty. A scheduled FADE holdout is only allowed when existing learning evidence makes reduced support reasonable; knowledge gaps, regression and unsafe early-stage learning keep support on. Results update evidence only after the frozen experiment is reviewed.';
const REVIEW_BOUNDARY='Experiment review checks whether the pre-game support condition was actually tested in a verified matching mission moment. NOT OBSERVED adds no evidence. The result informs future within-player comparisons; it does not create a causal claim from one trial.';

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function cellKey(targetTag:string,repLevel:number){return clean(targetTag).toUpperCase()+'|L'+String(repLevel)}
function missionReviewRows(rows:HistoryAnalysisRow[],behaviourKey:DecisionBehaviourKey){
  return [...rows]
    .filter(row=>row.analysis?.version===1)
    .sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))
    .slice(-50)
    .map(row=>(row.analysis as any)?.decisionGraph?.summary)
    .filter(summary=>summary?.climbMission?.version===1&&summary?.climbMission?.active&&summary.climbMission.behaviourKey===behaviourKey);
}
function cellCounts(rows:HistoryAnalysisRow[],mission:ClimbMatchMission){
  const key=cellKey(mission.targetTag,mission.repLevel);
  let supported=0;
  let faded=0;
  const relevant=missionReviewRows(rows,mission.behaviourKey);
  for(const summary of relevant){
    const review=summary.climbMission as ClimbMatchMissionReview;
    const strategy=summary.coachingStrategy as ClimbCoachingStrategyReview|undefined;
    if(!strategy?.version||!strategy.active)continue;
    if(review.status==='NOT_OBSERVED'||review.status==='NO_MISSION')continue;
    if(cellKey(review.targetTag??mission.targetTag,review.repLevel??mission.repLevel)!==key)continue;
    if(strategy.intervened)supported++;
    else if(strategy.mode==='FADE')faded++;
  }
  return{supported,faded,pairs:Math.min(supported,faded)};
}
function lastObservedMission(rows:HistoryAnalysisRow[],behaviourKey:DecisionBehaviourKey){
  const summaries=missionReviewRows(rows,behaviourKey);
  for(let i=summaries.length-1;i>=0;i--){
    const review=summaries[i]?.climbMission as ClimbMatchMissionReview|undefined;
    if(review&&['EXECUTED','MISSED','MIXED'].includes(review.status))return review;
  }
  return null;
}
function schedule(input:{
  mission:ClimbMatchMission;
  status:ClimbExperimentStatus;
  type:ClimbExperimentType;
  policy:ClimbExperimentDeliveryPolicy;
  supported:number;
  faded:number;
  pairs:number;
  intentDiagnosis:ClimbIntentDiagnosis;
  intentStreak:number;
  autonomyState:ClimbAutonomyState;
  valueState:ClimbInterventionValueState;
  informationGain:ClimbExperimentInformationGain;
  hypothesis:string;
  informationNeed:string;
  safetyReason:string;
  successRead:string;
}):ClimbExperimentSchedule{
  return{
    version:1,
    id:['climb-experiment',input.mission.id,input.type,input.mission.targetTag,'l'+String(input.mission.repLevel)].join(':').toLowerCase(),
    missionId:input.mission.id,
    behaviourKey:input.mission.behaviourKey,
    behaviourLabel:input.mission.behaviourLabel,
    targetTag:input.mission.targetTag,
    repLevel:input.mission.repLevel,
    cellKey:cellKey(input.mission.targetTag,input.mission.repLevel),
    status:input.status,
    experimentType:input.type,
    requestedDeliveryPolicy:input.policy,
    supportedObservedInCell:input.supported,
    fadedObservedInCell:input.faded,
    comparablePairsInCell:input.pairs,
    intentDiagnosis:input.intentDiagnosis,
    intentEvidenceStreak:input.intentStreak,
    autonomyState:input.autonomyState,
    interventionValueState:input.valueState,
    informationGain:input.informationGain,
    hypothesis:input.hypothesis,
    informationNeed:input.informationNeed,
    safetyReason:input.safetyReason,
    successRead:input.successRead,
    source:'CLIMB_EXPERIMENT_SCHEDULER',
    boundary:BOUNDARY,
  };
}

export function buildClimbExperimentSchedule(input:{
  rows:HistoryAnalysisRow[];
  mission:ClimbMatchMission|null|undefined;
}):ClimbExperimentSchedule|null{
  const mission=input.mission;
  if(!mission||mission.status!=='READY')return null;

  const counts=cellCounts(input.rows,mission);
  const intent=summarizeIntentGapHistory(input.rows,mission.behaviourKey);
  const autonomy=buildClimbAutonomyProfile(input.rows).cards.find(card=>card.behaviourKey===mission.behaviourKey)??null;
  const value=buildClimbInterventionValueProfile(input.rows).cards.find(card=>card.behaviourKey===mission.behaviourKey)??null;
  const autonomyState=autonomy?.state??'BUILDING';
  const valueState=value?.state??'BUILDING';
  const last=lastObservedMission(input.rows,mission.behaviourKey);

  if(intent.recentDiagnosis==='KNOWLEDGE_GAP'&&intent.recentSameDiagnosisStreak>=2){
    return schedule({
      mission,status:'DEFERRED',type:'DIAGNOSTIC_RETEST',policy:'DIAGNOSTIC',
      supported:counts.supported,faded:counts.faded,pairs:counts.pairs,
      intentDiagnosis:intent.recentDiagnosis,intentStreak:intent.recentSameDiagnosisStreak,
      autonomyState,valueState,informationGain:'HIGH',
      hypothesis:'The limiting uncertainty is understanding, not intervention value.',
      informationNeed:'Re-establish the correct branch before removing support or comparing support conditions.',
      safetyReason:'Repeated knowledge-gap evidence makes a FADE holdout premature.',
      successRead:'Correct pre-cue intent plus a verified mission rep can reopen support-vs-fade experimentation later.',
    });
  }

  if(autonomyState==='REGRESSION_WATCH'){
    return schedule({
      mission,status:'SCHEDULED',type:'SUPPORTED_RETEST',policy:'LIGHT',
      supported:counts.supported,faded:counts.faded,pairs:counts.pairs,
      intentDiagnosis:intent.recentDiagnosis,intentStreak:intent.recentSameDiagnosisStreak,
      autonomyState,valueState,informationGain:'HIGH',
      hypothesis:'A short scaffold should restore execution without re-teaching the whole branch.',
      informationNeed:'Test whether previously independent execution stabilises when one concise cue returns.',
      safetyReason:'Recent faded regression means another immediate holdout would add less useful information than a supported recovery rep.',
      successRead:'A clean supported recovery rep supports scheduling another FADE autonomy recheck later.',
    });
  }

  if(autonomyState==='SUPPORT_DEPENDENT'){
    return schedule({
      mission,status:'SCHEDULED',type:'DIAGNOSTIC_RETEST',policy:'DIAGNOSTIC',
      supported:counts.supported,faded:counts.faded,pairs:counts.pairs,
      intentDiagnosis:intent.recentDiagnosis,intentStreak:intent.recentSameDiagnosisStreak,
      autonomyState,valueState,informationGain:'HIGH',
      hypothesis:'Something useful disappears when support is removed.',
      informationNeed:'Diagnose whether the missing component is recognition, timing or execution before scheduling another holdout.',
      safetyReason:'Support dependence is already observed; blindly repeating FADE would measure failure without isolating the missing component.',
      successRead:'A diagnostic clean rep with correct pre-cue intent narrows the next experiment to execution support rather than re-teaching.',
    });
  }

  if(mission.repLevel<3||mission.repStage==='RECOGNISE'){
    return schedule({
      mission,status:'DEFERRED',type:'SUPPORTED_RETEST',policy:'LIGHT',
      supported:counts.supported,faded:counts.faded,pairs:counts.pairs,
      intentDiagnosis:intent.recentDiagnosis,intentStreak:intent.recentSameDiagnosisStreak,
      autonomyState,valueState,informationGain:'LOW',
      hypothesis:'The skill is still too early in the Rep Ladder for a clean autonomy holdout.',
      informationNeed:'Build enough stable supported evidence to make a later support-removal test interpretable.',
      safetyReason:'Removing support at Recognition/early Execute would confound learning with testing.',
      successRead:'Repeated clean supported reps move this decision toward a legitimate FADE holdout.',
    });
  }

  if(last?.status==='MISSED'){
    return schedule({
      mission,status:'SCHEDULED',type:'SUPPORTED_RETEST',policy:'LIGHT',
      supported:counts.supported,faded:counts.faded,pairs:counts.pairs,
      intentDiagnosis:intent.recentDiagnosis,intentStreak:intent.recentSameDiagnosisStreak,
      autonomyState,valueState,informationGain:'MEDIUM',
      hypothesis:'The previous observed miss should be stabilised before another support-removal comparison.',
      informationNeed:'Check whether one concise scaffold restores the branch at the same difficulty.',
      safetyReason:'Back-to-back FADE after an observed miss would prioritise experimentation over learning quality.',
      successRead:'A clean supported rep makes the next faded comparison safer and more interpretable.',
    });
  }

  if(counts.supported>=3&&counts.faded<3){
    return schedule({
      mission,status:'SCHEDULED',type:autonomyState==='AUTONOMOUS'?'AUTONOMY_RECHECK':'FADE_HOLDOUT',policy:'NONE',
      supported:counts.supported,faded:counts.faded,pairs:counts.pairs,
      intentDiagnosis:intent.recentDiagnosis,intentStreak:intent.recentSameDiagnosisStreak,
      autonomyState,valueState,informationGain:'HIGH',
      hypothesis:'This matched cell has enough supported evidence but too little unscaffolded evidence.',
      informationNeed:'Remove the adaptive cue for this rep to test independent execution in the same behaviour, context and difficulty.',
      safetyReason:'Supported evidence is already repeated and no active knowledge-gap/regression gate blocks reduced support.',
      successRead:'A verified clean faded rep increases autonomy evidence and improves the matched intervention-value comparison.',
    });
  }

  if(counts.faded>=3&&counts.supported<3){
    return schedule({
      mission,status:'SCHEDULED',type:'SUPPORTED_RETEST',policy:'LIGHT',
      supported:counts.supported,faded:counts.faded,pairs:counts.pairs,
      intentDiagnosis:intent.recentDiagnosis,intentStreak:intent.recentSameDiagnosisStreak,
      autonomyState,valueState,informationGain:'HIGH',
      hypothesis:'This matched cell has enough faded evidence but too little supported evidence.',
      informationNeed:'Add a concise supported comparator at the same behaviour, context and difficulty.',
      safetyReason:'The experiment adds the missing comparison condition without changing the lesson or rep difficulty.',
      successRead:'The observed supported rep increases the matched pair count and sharpens Intervention Value.',
    });
  }

  if(valueState==='STRONG_SUPPORT_ASSOCIATED_LIFT'){
    return schedule({
      mission,status:'SCHEDULED',type:'FADE_HOLDOUT',policy:'NONE',
      supported:counts.supported,faded:counts.faded,pairs:counts.pairs,
      intentDiagnosis:intent.recentDiagnosis,intentStreak:intent.recentSameDiagnosisStreak,
      autonomyState,valueState,informationGain:'MEDIUM',
      hypothesis:'The support-associated lift should be challenged periodically so useful support does not become permanent dependency.',
      informationNeed:'Re-test unscaffolded execution in the matched cell while the player is stable enough for a holdout.',
      safetyReason:'A strong association is not a reason to stop holdout testing; repeated safe challenges protect autonomy.',
      successRead:'If faded execution stays clean, the apparent support value should shrink; if it drops repeatedly, the support signal strengthens.',
    });
  }

  if(valueState==='FADE_ASSOCIATED_BETTER'||autonomyState==='AUTONOMOUS'){
    return schedule({
      mission,status:'SCHEDULED',type:'AUTONOMY_RECHECK',policy:'NONE',
      supported:counts.supported,faded:counts.faded,pairs:counts.pairs,
      intentDiagnosis:intent.recentDiagnosis,intentStreak:intent.recentSameDiagnosisStreak,
      autonomyState,valueState,informationGain:'MEDIUM',
      hypothesis:'Extra support is not currently needed to preserve this decision.',
      informationNeed:'Keep the adaptive overlay off and verify that independence continues to hold.',
      safetyReason:'Current autonomy/intervention evidence supports the least intrusive coaching condition.',
      successRead:'Another clean faded rep preserves autonomy; repeated misses will trigger support restoration through Coaching Strategy.',
    });
  }

  const chooseFade=counts.supported>counts.faded;
  return schedule({
    mission,status:'SCHEDULED',type:'MATCHED_COMPARISON',policy:chooseFade?'NONE':'LIGHT',
    supported:counts.supported,faded:counts.faded,pairs:counts.pairs,
    intentDiagnosis:intent.recentDiagnosis,intentStreak:intent.recentSameDiagnosisStreak,
    autonomyState,valueState,informationGain:'MEDIUM',
    hypothesis:'The current matched cell still has comparison uncertainty.',
    informationNeed:chooseFade
      ?'Add the under-represented faded condition to balance the matched comparison.'
      :'Add the under-represented supported condition to balance the matched comparison.',
    safetyReason:'No higher-priority knowledge, regression or support-dependence gate blocks a matched comparison at this rep difficulty.',
    successRead:'The observed rep reduces support-condition imbalance and increases the information available to Intervention Value.',
  });
}

function observedPolicy(strategy:ClimbCoachingStrategyReview){
  if(!strategy.active)return'NONE' as const;
  return strategy.intervened?'SUPPORTED' as const:strategy.mode==='FADE'?'FADED' as const:'NONE' as const;
}
function requestedObservedPolicy(schedule:ClimbExperimentSchedule){
  return schedule.requestedDeliveryPolicy==='NONE'?'FADED' as const:'SUPPORTED' as const;
}
function responseScore(review:ClimbMatchMissionReview){
  if(review.status==='EXECUTED')return 100;
  if(review.status==='MISSED')return 0;
  if(review.status==='MIXED'&&review.matchedMoments)return Math.round(review.cleanMoments/review.matchedMoments*100);
  return null;
}

export function reviewClimbExperimentSchedule(
  experiment:ClimbExperimentSchedule|null|undefined,
  missionReview:ClimbMatchMissionReview,
  strategyReview:ClimbCoachingStrategyReview,
):ClimbExperimentReview{
  if(!experiment){
    return{
      version:1,active:false,experimentId:null,missionId:missionReview.missionId,behaviourKey:missionReview.behaviourKey,
      behaviourLabel:missionReview.behaviourLabel,targetTag:missionReview.targetTag,repLevel:missionReview.repLevel,
      experimentType:null,requestedDeliveryPolicy:null,status:'NO_EXPERIMENT',observedDeliveryPolicy:'NONE',
      missionStatus:missionReview.status,responseScore:null,informationAdded:false,
      note:'No frozen CLIMB experiment was scheduled for this mission.',boundary:REVIEW_BOUNDARY,
    };
  }
  const observed=observedPolicy(strategyReview);
  if(missionReview.status==='NOT_OBSERVED'||missionReview.status==='NO_MISSION'){
    return{
      version:1,active:true,experimentId:experiment.id,missionId:experiment.missionId,behaviourKey:experiment.behaviourKey,
      behaviourLabel:experiment.behaviourLabel,targetTag:experiment.targetTag,repLevel:experiment.repLevel,
      experimentType:experiment.experimentType,requestedDeliveryPolicy:experiment.requestedDeliveryPolicy,
      status:'NOT_OBSERVED',observedDeliveryPolicy:observed,missionStatus:missionReview.status,responseScore:null,informationAdded:false,
      note:'The experiment condition was frozen, but no verified matching mission moment appeared. No experiment evidence is added.',boundary:REVIEW_BOUNDARY,
    };
  }
  const expected=requestedObservedPolicy(experiment);
  if(observed!==expected){
    return{
      version:1,active:true,experimentId:experiment.id,missionId:experiment.missionId,behaviourKey:experiment.behaviourKey,
      behaviourLabel:experiment.behaviourLabel,targetTag:experiment.targetTag,repLevel:experiment.repLevel,
      experimentType:experiment.experimentType,requestedDeliveryPolicy:experiment.requestedDeliveryPolicy,
      status:'POLICY_MISMATCH',observedDeliveryPolicy:observed,missionStatus:missionReview.status,responseScore:responseScore(missionReview),informationAdded:false,
      note:'The observed support condition did not match the frozen experiment request, so OP CLIMB will not treat this game as evidence for that scheduled comparison.',boundary:REVIEW_BOUNDARY,
    };
  }
  return{
    version:1,active:true,experimentId:experiment.id,missionId:experiment.missionId,behaviourKey:experiment.behaviourKey,
    behaviourLabel:experiment.behaviourLabel,targetTag:experiment.targetTag,repLevel:experiment.repLevel,
    experimentType:experiment.experimentType,requestedDeliveryPolicy:experiment.requestedDeliveryPolicy,
    status:'COMPLETED',observedDeliveryPolicy:observed,missionStatus:missionReview.status,responseScore:responseScore(missionReview),informationAdded:true,
    note:'The frozen experiment condition was observed in a verified matching mission moment. The result can update future autonomy and matched intervention-value evidence.',boundary:REVIEW_BOUNDARY,
  };
}

export const CLIMB_EXPERIMENT_SCHEDULER_BOUNDARY=BOUNDARY;
