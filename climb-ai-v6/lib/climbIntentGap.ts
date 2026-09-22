import type {HistoryAnalysisRow} from './riot/proHistory';
import type {DecisionBehaviourKey,DecisionSituationTag} from './decisionTwin';
import type {ClimbMatchMission,ClimbMatchMissionReview} from './climbMissionDesign';

export type ClimbIntentBranch='CORRECT'|'OLD_BRANCH';
export type ClimbIntentDiagnosis='NO_EVIDENCE'|'ALIGNED'|'KNOWLEDGE_GAP'|'EXECUTION_GAP'|'RECOVERED'|'UNSTABLE';
export type ClimbIntentReviewStatus='NO_PROBE'|'NOT_ANSWERED'|'NOT_OBSERVED'|'ALIGNED'|'KNOWLEDGE_GAP'|'EXECUTION_GAP'|'RECOVERED_AFTER_MISREAD'|'UNSTABLE';

export interface ClimbIntentProbeOption{
  id:string;
  label:string;
}

export interface ClimbIntentProbeResponse{
  selectedOptionId:string;
  selectedBranch:ClimbIntentBranch;
  correct:boolean;
  capturedAt:string;
  source:'PLAYER_ONE_TAP';
}

export interface ClimbIntentProbe{
  version:1;
  id:string;
  missionId:string;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  targetTag:DecisionSituationTag;
  prompt:string;
  options:ClimbIntentProbeOption[];
  answerKey:string;
  correctBranch:string;
  oldBranch:string;
  response:ClimbIntentProbeResponse|null;
  source:'CLIMB_INTENT_GAP';
  boundary:string;
}

export interface ClimbIntentProbeView{
  version:1;
  id:string;
  missionId:string;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  targetTag:DecisionSituationTag;
  prompt:string;
  options:ClimbIntentProbeOption[];
  response:{selectedOptionId:string;capturedAt:string}|null;
  source:'CLIMB_INTENT_GAP';
  boundary:string;
}

export interface ClimbIntentGapReview{
  version:1;
  active:boolean;
  probeId:string|null;
  missionId:string|null;
  behaviourKey:DecisionBehaviourKey|null;
  behaviourLabel:string|null;
  targetTag:DecisionSituationTag|null;
  selectedBranch:ClimbIntentBranch|null;
  intentCorrect:boolean|null;
  missionStatus:ClimbMatchMissionReview['status'];
  status:ClimbIntentReviewStatus;
  diagnosis:ClimbIntentDiagnosis;
  matchedMoments:number;
  note:string;
  nextCoachingNeed:'NONE'|'TEACH_UNDERSTANDING'|'REDUCE_EXECUTION_FRICTION'|'TEST_AGAIN';
  boundary:string;
}

export interface ClimbIntentGapHistory{
  behaviourKey:DecisionBehaviourKey;
  observedReviews:number;
  aligned:number;
  knowledgeGaps:number;
  executionGaps:number;
  recovered:number;
  unstable:number;
  recentDiagnosis:ClimbIntentDiagnosis;
  recentSameDiagnosisStreak:number;
}

const BOUNDARY='CLIMB Intent Gap captures a one-tap branch prediction before the adaptive coaching cue is revealed, then compares that frozen pre-game intent with verified matching mission execution. It distinguishes what the player planned from what they later did; it does not infer hidden thoughts from telemetry.';
const REVIEW_BOUNDARY='Intent Gap uses only the player\'s frozen pre-cue answer and the verified CLIMB Mission review. NOT OBSERVED is neutral. A correct pre-game answer plus a missed execution is an execution gap; a wrong pre-game answer plus a missed execution is a knowledge gap.';

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function hash(value:string){
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}
function oldBranchFor(mission:ClimbMatchMission){
  switch(mission.behaviourKey){
    case'FIGHT_SELECTION':return'ENTER ON FIRST CONTACT BEFORE CHECKING WHETHER THE FROZEN FIGHT TRIGGER IS TRUE.';
    case'DEATH_RECOVERY':return'TRY TO WIN BACK THE LOST TEMPO IMMEDIATELY INSTEAD OF STABILISING THE NEXT SAFE RESOURCE WINDOW.';
    case'LEAD_PROTECTION':return'FORCE THE NEXT FIGHT BECAUSE YOU ARE AHEAD, EVEN IF THE ACCESS OR NUMBERS CHECK IS NOT CLEAN.';
    case'RESET_DISCIPLINE':return'STAY FOR ONE MORE WAVE OR FIGHT WHILE HOLDING GOLD INSTEAD OF TAKING THE SAFE RESET.';
    case'OBJECTIVE_READINESS':return'KEEP FARMING UNTIL THE OBJECTIVE STARTS, THEN MOVE AFTER THE SETUP WINDOW HAS ALREADY CLOSED.';
    case'FARM_VS_SETUP':return'TAKE THE NEAREST FARM FIRST EVEN WHEN THE TEAM SETUP WINDOW IS THE HIGHER-VALUE DECISION.';
    case'THREAT_ADAPTATION':return'PLAY THE NORMAL SPACE AS IF THE ENEMY ACCESS THREAT HAS NOT CHANGED YOUR SAFE branch.';
    case'CARRY_PRESERVATION':return'MOVE FORWARD FOR DAMAGE BEFORE THE RELEVANT ACCESS THREATS HAVE BEEN SPENT OR ACCOUNTED FOR.';
    case'POWER_SPIKE_CONVERSION':return'KEEP FARMING THROUGH THE POWER WINDOW INSTEAD OF USING THE TIMING TO CREATE PRESSURE.';
    case'SURVIVAL_VALUE':return'TAKE THE EXTRA DAMAGE WINDOW EVEN WHEN PRESERVING YOUR LIFE IS WORTH MORE TO THE NEXT PLAY.';
    default:return'ACT BEFORE THE FROZEN TRIGGER IS TRUE.';
  }
}
function optionOrder(id:string,correct:string,wrong:string):{options:ClimbIntentProbeOption[];answerKey:string}{
  const correctOption={id:'A',label:correct};
  const wrongOption={id:'B',label:wrong};
  if(hash(id)%2===0)return{options:[correctOption,wrongOption],answerKey:'A'};
  return{options:[{id:'A',label:wrong},{id:'B',label:correct}],answerKey:'B'};
}

export function buildClimbIntentProbe(mission:ClimbMatchMission|null|undefined):ClimbIntentProbe|null{
  if(!mission||mission.status!=='READY')return null;
  const id=['intent-probe',mission.id].join(':').toLowerCase();
  const correct=clean(mission.action);
  const wrong=oldBranchFor(mission);
  const ordered=optionOrder(id,correct,wrong);
  return{
    version:1,
    id,
    missionId:mission.id,
    behaviourKey:mission.behaviourKey,
    behaviourLabel:mission.behaviourLabel,
    targetTag:mission.targetTag,
    prompt:'BEFORE THE COACHING CUE: '+clean(mission.trigger)+' — WHICH BRANCH ARE YOU PLANNING TO TAKE?',
    options:ordered.options,
    answerKey:ordered.answerKey,
    correctBranch:correct,
    oldBranch:wrong,
    response:null,
    source:'CLIMB_INTENT_GAP',
    boundary:BOUNDARY,
  };
}

export function publicClimbIntentProbe(probe:ClimbIntentProbe|null|undefined):ClimbIntentProbeView|null{
  if(!probe)return null;
  return{
    version:1,
    id:probe.id,
    missionId:probe.missionId,
    behaviourKey:probe.behaviourKey,
    behaviourLabel:probe.behaviourLabel,
    targetTag:probe.targetTag,
    prompt:probe.prompt,
    options:probe.options,
    response:probe.response?{selectedOptionId:probe.response.selectedOptionId,capturedAt:probe.response.capturedAt}:null,
    source:'CLIMB_INTENT_GAP',
    boundary:probe.boundary,
  };
}

export function answerClimbIntentProbe(probe:ClimbIntentProbe,selectedOptionId:string,capturedAt=new Date().toISOString()):ClimbIntentProbe{
  const option=probe.options.find(item=>item.id===clean(selectedOptionId).toUpperCase());
  if(!option)throw new Error('Unknown Intent Gap option.');
  const correct=option.id===probe.answerKey;
  return{
    ...probe,
    response:{
      selectedOptionId:option.id,
      selectedBranch:correct?'CORRECT':'OLD_BRANCH',
      correct,
      capturedAt,
      source:'PLAYER_ONE_TAP',
    },
  };
}

export function reviewClimbIntentGap(
  probe:ClimbIntentProbe|null|undefined,
  missionReview:ClimbMatchMissionReview,
):ClimbIntentGapReview{
  const base={
    version:1 as const,
    missionId:missionReview.missionId,
    behaviourKey:missionReview.behaviourKey,
    behaviourLabel:missionReview.behaviourLabel,
    targetTag:missionReview.targetTag,
    missionStatus:missionReview.status,
    matchedMoments:missionReview.matchedMoments,
    boundary:REVIEW_BOUNDARY,
  };
  if(!probe){
    return{...base,active:false,probeId:null,selectedBranch:null,intentCorrect:null,status:'NO_PROBE',diagnosis:'NO_EVIDENCE',note:'No pre-cue Intent Gap probe was frozen for this mission.',nextCoachingNeed:'NONE'};
  }
  if(!probe.response){
    return{...base,active:true,probeId:probe.id,selectedBranch:null,intentCorrect:null,status:'NOT_ANSWERED',diagnosis:'NO_EVIDENCE',note:'The player did not answer the pre-cue branch probe, so OP CLIMB will not infer intent.',nextCoachingNeed:'TEST_AGAIN'};
  }
  if(missionReview.status==='NOT_OBSERVED'||missionReview.status==='NO_MISSION'){
    return{...base,active:true,probeId:probe.id,selectedBranch:probe.response.selectedBranch,intentCorrect:probe.response.correct,status:'NOT_OBSERVED',diagnosis:'NO_EVIDENCE',note:'The pre-game intent was captured, but no verified matching mission moment appeared. Intent is not scored.',nextCoachingNeed:'TEST_AGAIN'};
  }
  if(probe.response.correct&&missionReview.status==='EXECUTED'){
    return{...base,active:true,probeId:probe.id,selectedBranch:'CORRECT',intentCorrect:true,status:'ALIGNED',diagnosis:'ALIGNED',note:'The player selected the correct branch before seeing the adaptive cue and then executed it in every verified matching mission moment.',nextCoachingNeed:'NONE'};
  }
  if(probe.response.correct&&missionReview.status==='MISSED'){
    return{...base,active:true,probeId:probe.id,selectedBranch:'CORRECT',intentCorrect:true,status:'EXECUTION_GAP',diagnosis:'EXECUTION_GAP',note:'The player knew the correct branch before the cue but missed it in the verified match moment. The next intervention should reduce execution friction rather than re-teach the answer.',nextCoachingNeed:'REDUCE_EXECUTION_FRICTION'};
  }
  if(probe.response.correct&&missionReview.status==='MIXED'){
    return{...base,active:true,probeId:probe.id,selectedBranch:'CORRECT',intentCorrect:true,status:'UNSTABLE',diagnosis:'EXECUTION_GAP',note:'The player knew the correct branch before the cue but execution was mixed across verified moments. Understanding appears present; execution is not stable yet.',nextCoachingNeed:'REDUCE_EXECUTION_FRICTION'};
  }
  if(!probe.response.correct&&missionReview.status==='EXECUTED'){
    return{...base,active:true,probeId:probe.id,selectedBranch:'OLD_BRANCH',intentCorrect:false,status:'RECOVERED_AFTER_MISREAD',diagnosis:'RECOVERED',note:'The pre-cue branch answer was wrong, but the player later executed the mission cleanly. OP CLIMB records the recovery without claiming the coaching cue caused it.',nextCoachingNeed:'TEST_AGAIN'};
  }
  if(!probe.response.correct&&missionReview.status==='MIXED'){
    return{...base,active:true,probeId:probe.id,selectedBranch:'OLD_BRANCH',intentCorrect:false,status:'UNSTABLE',diagnosis:'KNOWLEDGE_GAP',note:'The pre-cue branch answer was wrong and match execution was mixed. The decision model is not secure enough to treat this as execution-only.',nextCoachingNeed:'TEACH_UNDERSTANDING'};
  }
  return{...base,active:true,probeId:probe.id,selectedBranch:'OLD_BRANCH',intentCorrect:false,status:'KNOWLEDGE_GAP',diagnosis:'KNOWLEDGE_GAP',note:'The player selected the wrong branch before seeing the cue and then missed the verified matching mission moment. The next intervention should teach the decision model, not just demand cleaner execution.',nextCoachingNeed:'TEACH_UNDERSTANDING'};
}

export function summarizeIntentGapHistory(rows:HistoryAnalysisRow[],behaviourKey:DecisionBehaviourKey):ClimbIntentGapHistory{
  const reviews=[...rows]
    .filter(row=>row.analysis?.version===1)
    .sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))
    .slice(-50)
    .map(row=>(row.analysis as any)?.decisionGraph?.summary?.intentGap as ClimbIntentGapReview|undefined)
    .filter((item):item is ClimbIntentGapReview=>Boolean(item?.version===1&&item.active&&item.behaviourKey===behaviourKey))
    .filter(item=>!['NO_PROBE','NOT_ANSWERED','NOT_OBSERVED'].includes(item.status));
  const last=reviews.at(-1)??null;
  const diagnosis=last?.diagnosis??'NO_EVIDENCE';
  let streak=0;
  for(let i=reviews.length-1;i>=0;i--){
    if(reviews[i]?.diagnosis!==diagnosis)break;
    streak++;
  }
  return{
    behaviourKey,
    observedReviews:reviews.length,
    aligned:reviews.filter(item=>item.diagnosis==='ALIGNED').length,
    knowledgeGaps:reviews.filter(item=>item.diagnosis==='KNOWLEDGE_GAP').length,
    executionGaps:reviews.filter(item=>item.diagnosis==='EXECUTION_GAP').length,
    recovered:reviews.filter(item=>item.diagnosis==='RECOVERED').length,
    unstable:reviews.filter(item=>item.diagnosis==='UNSTABLE').length,
    recentDiagnosis:diagnosis,
    recentSameDiagnosisStreak:diagnosis==='NO_EVIDENCE'?0:streak,
  };
}

export const CLIMB_INTENT_GAP_BOUNDARY=BOUNDARY;
