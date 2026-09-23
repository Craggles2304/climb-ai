import type {HistoryAnalysisRow} from './riot/proHistory';
import type {DecisionBehaviourKey} from './decisionTwin';
import type {DecisionTwinV2Profile} from './decisionTwinV2';
import type {ClimbCurriculum} from './climbCurriculum';
import type {ClimbCoachMethod,ClimbCoachTwin} from './climbCoachTwin';
import {buildClimbAutonomyProfile,type ClimbAutonomyProfile,type ClimbAutonomyState,type ClimbAutonomySupportNeed} from './climbAutonomy';
import {buildClimbInterventionValueProfile,type ClimbInterventionValueProfile,type ClimbInterventionValueState} from './climbInterventionValue';
import {summarizeIntentGapHistory,type ClimbIntentDiagnosis} from './climbIntentGap';
import type {DecisionCausalProfile} from './decisionCausalProfile';
import type {CausalCoachLayer} from './decisionCausalChain';

export type PlayerCoachingIdentityStatus='BUILDING'|'EMERGING'|'READY'|'STABLE';
export type PlayerCoachingIdentityConfidence='LOW'|'MEDIUM'|'HIGH';
export type PlayerCoachingIdentityChange='INITIAL'|'UNCHANGED'|'REFINED'|'SHIFTED';

export interface PlayerCoachingIdentity{
  version:1;
  generatedAt:string;
  gamesAnalyzed:number;
  status:PlayerCoachingIdentityStatus;
  confidence:PlayerCoachingIdentityConfidence;
  identityKey:string;
  headline:string;
  summary:string;
  decisionStyle:{
    status:'BUILDING'|'READY';
    primaryBehaviourKey:DecisionBehaviourKey|null;
    primaryBehaviourLabel:string|null;
    primaryArchetype:string|null;
    strongestBehaviourKey:DecisionBehaviourKey|null;
    strongestBehaviourLabel:string|null;
    strongestArchetype:string|null;
    evidence:string;
  };
  rootCause:{
    status:DecisionCausalProfile['status'];
    layer:CausalCoachLayer|null;
    label:string|null;
    share:number|null;
    games:number;
    evidence:string;
  };
  knowledgeExecution:{
    behaviourKey:DecisionBehaviourKey|null;
    diagnosis:ClimbIntentDiagnosis;
    observedReviews:number;
    sameDiagnosisStreak:number;
    evidence:string;
  };
  coachingResponse:{
    behaviourKey:DecisionBehaviourKey|null;
    preferredMethod:ClimbCoachMethod|null;
    preferredMethodLabel:string|null;
    preferenceStatus:string;
    preferenceConfidence:'LOW'|'MEDIUM'|'HIGH';
    observedGames:number;
    evidence:string;
  };
  autonomy:{
    behaviourKey:DecisionBehaviourKey|null;
    state:ClimbAutonomyState;
    supportNeed:ClimbAutonomySupportNeed;
    autonomyStrength:number|null;
    supportDependenceGap:number|null;
    evidence:string;
    nextTest:string;
  };
  interventionValue:{
    behaviourKey:DecisionBehaviourKey|null;
    state:ClimbInterventionValueState|'BUILDING';
    confidence:'LOW'|'MEDIUM'|'HIGH';
    responseDifference:number|null;
    evidence:string;
  };
  development:{
    behaviourKey:DecisionBehaviourKey|null;
    label:string|null;
    phase:string|null;
    repLevel:number|null;
    repStage:string|null;
    gameRule:string|null;
    graduationRule:string|null;
    nextLesson:string|null;
    evidence:string;
  };
  coachBrief:{
    focus:string;
    firstQuestion:string;
    delivery:string;
    support:string;
    liveInterruptions:number;
    avoid:string[];
    success:string;
    oneSentence:string;
  };
  stability:{
    score:number;
    stableFacets:number;
    totalFacets:number;
    reason:string;
  };
  change:{
    status:PlayerCoachingIdentityChange;
    changedFields:string[];
    summary:string;
  };
  source:'OP_CLIMB_PLAYER_COACHING_IDENTITY';
  boundary:string;
}

const BOUNDARY='PLAYER COACHING IDENTITY IS AN EVIDENCE-BOUNDED MODEL OF HOW OP CLIMB SHOULD COACH THIS PLAYER. IT SUMMARISES VERIFIED GAME DECISIONS, COACHING RESPONSE, AUTONOMY, CAUSAL ROOT-CAUSE MEMORY AND THE ACTIVE CURRICULUM. IT IS NOT A PERSONALITY, INTELLIGENCE, MENTAL-STATE OR TALENT JUDGMENT; IT DOES NOT CLAIM COACHING CAUSED AN OUTCOME, AND ONE MATCH CANNOT REWRITE A STABLE IDENTITY.';

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function labelKey(key:DecisionBehaviourKey|null){
  return key?key.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,m=>m.toUpperCase()):null;
}
function severity(need:ClimbAutonomySupportNeed){
  return need==='FULL'?5:need==='DIAGNOSTIC'?4:need==='LIGHT'?3:need==='MINIMAL'?1:0;
}
function focusedBehaviour(twin:DecisionTwinV2Profile,curriculum:ClimbCurriculum):DecisionBehaviourKey|null{
  return curriculum.currentLesson?.behaviourKey
    ??twin.identity.primary?.key
    ??twin.activeFive[0]?.key
    ??null;
}
function autonomyFor(profile:ClimbAutonomyProfile,key:DecisionBehaviourKey|null){
  if(key){
    const exact=profile.cards.find(card=>card.behaviourKey===key);
    if(exact)return exact;
  }
  return [...profile.cards].sort((a,b)=>severity(b.supportNeed)-severity(a.supportNeed)||b.observedGames-a.observedGames)[0]??null;
}
function methodFor(twin:ClimbCoachTwin,key:DecisionBehaviourKey|null){
  const candidates=twin.behaviourProfiles.filter(item=>!key||item.behaviourKey===key);
  return [...candidates].sort((a,b)=>{
    const status=(value:string)=>value==='PREFERRED'?5:value==='PREFERENCE_EMERGING'?4:value==='RETESTING'?3:value==='EXPLORING'?2:1;
    const any=(value:string)=>value==='ANY'?1:0;
    return status(b.status)-status(a.status)
      ||b.totalObserved-a.totalObserved
      ||any(b.targetTag)-any(a.targetTag)
      ||(b.preferenceEdge??-1)-(a.preferenceEdge??-1);
  })[0]??null;
}
function interventionFor(profile:ClimbInterventionValueProfile,key:DecisionBehaviourKey|null){
  if(key){
    const exact=profile.cards.find(card=>card.behaviourKey===key);
    if(exact)return exact;
  }
  return [...profile.cards].sort((a,b)=>{
    const confidence=(value:string)=>value==='HIGH'?3:value==='MEDIUM'?2:1;
    return confidence(b.confidence)-confidence(a.confidence)||b.comparablePairs-a.comparablePairs;
  })[0]??null;
}
function firstQuestion(layer:CausalCoachLayer|null,diagnosis:ClimbIntentDiagnosis,behaviour:string){
  if(diagnosis==='KNOWLEDGE_GAP'||layer==='GAME_READ')return'WHAT STATE ARE WE IN, AND WHAT VISIBLE FACTS MAKE THAT TRUE?';
  if(layer==='FOLLOW_THROUGH')return'WHAT IS YOUR PRIORITY NOW, AND WHAT MUST YOUR NEXT DECISION SERVE?';
  if(diagnosis==='EXECUTION_GAP'||layer==='EXECUTION')return'YOU HAVE THE READ. WHAT EXACTLY WILL YOU EXECUTE WHEN THE '+behaviour.toUpperCase()+' TRIGGER APPEARS?';
  if(layer==='RECOGNITION')return'CALL THE STATE FIRST. CAN YOU NOW RECOGNISE THE SAME PRINCIPLE WITHOUT THE OLD CUE?';
  if(layer==='AUTONOMY')return'WHAT DO YOU SEE, AND WHAT WILL YOU DO WITHOUT AN EXTRA COACH CUE?';
  return'WHAT DO YOU SEE, WHAT IS YOUR PRIORITY, AND WHY?';
}
function supportText(need:ClimbAutonomySupportNeed){
  if(need==='FULL')return'FULL SCAFFOLDING · TEACH BEFORE TESTING.';
  if(need==='DIAGNOSTIC')return'DIAGNOSTIC SUPPORT · ASK FIRST, THEN ADD ONLY THE MISSING LAYER.';
  if(need==='LIGHT')return'LIGHT SUPPORT · ONE CONCISE CUE AFTER THE PLAYER COMMITS.';
  if(need==='MINIMAL')return'MINIMAL SUPPORT · PROTECT THE SELF-READ AND TEST AUTONOMY.';
  return'EVIDENCE BUILDING · DO NOT ASSUME HOW MUCH SUPPORT THIS PLAYER NEEDS.';
}
function deliveryText(methodLabel:string|null,confidence:string){
  return methodLabel
    ?methodLabel.toUpperCase()+' · '+confidence+' CONFIDENCE PREFERENCE'
    :'NO STABLE FORMAT PREFERENCE YET · KEEP TESTING EVIDENCE-BOUNDED METHODS';
}
function liveInterruptions(layer:CausalCoachLayer|null,supportNeed:ClimbAutonomySupportNeed){
  if(layer==='AUTONOMY'||supportNeed==='MINIMAL')return 1;
  if(layer==='EXECUTION'&&supportNeed!=='FULL')return 1;
  return 3;
}
function changeFrom(previous:PlayerCoachingIdentity|null|undefined,current:{
  rootLayer:CausalCoachLayer|null;
  behaviourKey:DecisionBehaviourKey|null;
  preferredMethod:ClimbCoachMethod|null;
  supportNeed:ClimbAutonomySupportNeed;
  diagnosis:ClimbIntentDiagnosis;
  status:PlayerCoachingIdentityStatus;
}){
  if(!previous)return{status:'INITIAL' as const,changedFields:['INITIAL_MODEL'],summary:'This is the first unified OP CLIMB coaching identity built from the available evidence.'};
  const fields:string[]=[];
  if(previous.rootCause.layer!==current.rootLayer)fields.push('ROOT_CAUSE_LAYER');
  if(previous.development.behaviourKey!==current.behaviourKey)fields.push('ACTIVE_DEVELOPMENT');
  if(previous.coachingResponse.preferredMethod!==current.preferredMethod)fields.push('COACHING_METHOD');
  if(previous.autonomy.supportNeed!==current.supportNeed)fields.push('SUPPORT_NEED');
  if(previous.knowledgeExecution.diagnosis!==current.diagnosis)fields.push('KNOWLEDGE_EXECUTION');
  if(previous.status!==current.status)fields.push('MODEL_CONFIDENCE');
  if(!fields.length)return{status:'UNCHANGED' as const,changedFields:[],summary:'The unified coaching identity is stable. New evidence reinforced the existing model without changing its coaching contract.'};
  const structural=fields.some(field=>['ROOT_CAUSE_LAYER','ACTIVE_DEVELOPMENT','SUPPORT_NEED'].includes(field));
  return{
    status:structural?'SHIFTED' as const:'REFINED' as const,
    changedFields:fields,
    summary:structural
      ?'Repeated evidence changed a structural part of the coaching contract: '+fields.join(', ').replaceAll('_',' ')+'.'
      :'New evidence refined the coaching identity without changing its core development direction: '+fields.join(', ').replaceAll('_',' ')+'.',
  };
}

export function buildPlayerCoachingIdentity(input:{
  rows:HistoryAnalysisRow[];
  twin:DecisionTwinV2Profile;
  curriculum:ClimbCurriculum;
  coachTwin:ClimbCoachTwin;
  causalProfile:DecisionCausalProfile;
  autonomyProfile?:ClimbAutonomyProfile|null;
  interventionValue?:ClimbInterventionValueProfile|null;
  previous?:PlayerCoachingIdentity|null;
  generatedAt?:string;
}):PlayerCoachingIdentity{
  const generatedAt=input.generatedAt??new Date().toISOString();
  const autonomyProfile=input.autonomyProfile??buildClimbAutonomyProfile(input.rows,generatedAt);
  const interventionValue=input.interventionValue??buildClimbInterventionValueProfile(input.rows,generatedAt);
  const behaviourKey=focusedBehaviour(input.twin,input.curriculum);
  const behaviourLabel=input.curriculum.currentLesson?.label
    ??input.twin.identity.primary?.behaviourLabel
    ??input.twin.activeFive.find(item=>item.key===behaviourKey)?.label
    ??labelKey(behaviourKey);
  const intent=behaviourKey?summarizeIntentGapHistory(input.rows,behaviourKey):null;
  const method=methodFor(input.coachTwin,behaviourKey);
  const autonomy=autonomyFor(autonomyProfile,behaviourKey);
  const intervention=interventionFor(interventionValue,behaviourKey);
  const rootLayer=input.causalProfile.status==='REPEATED_ROOT_CAUSE'||input.causalProfile.status==='STABLE_CLEAN'
    ?input.causalProfile.dominantLayer
    :null;
  const supportNeed=autonomy?.supportNeed??'UNKNOWN';
  const diagnosis=intent?.recentDiagnosis??'NO_EVIDENCE';
  const stableFacets=[
    input.twin.identity.status==='READY',
    input.curriculum.status!=='BUILDING',
    input.causalProfile.status==='REPEATED_ROOT_CAUSE'||input.causalProfile.status==='STABLE_CLEAN',
    Boolean(method&&['PREFERRED','PREFERENCE_EMERGING'].includes(method.status)&&method.totalObserved>=2),
    Boolean(autonomy&&autonomy.state!=='BUILDING'&&autonomy.observedGames>=2),
    Boolean(intent&&intent.observedReviews>=2),
  ].filter(Boolean).length;
  const stabilityScore=Math.round(stableFacets/6*100);
  const games=Math.max(input.twin.gamesAnalyzed,input.curriculum.gamesAnalyzed,input.coachTwin.gamesAnalyzed,input.causalProfile.gamesAnalyzed);
  const status:PlayerCoachingIdentityStatus=
    games<3||input.twin.identity.status==='BUILDING'||input.curriculum.status==='BUILDING'
      ?'BUILDING'
      :stableFacets<3
        ?'EMERGING'
        :games>=8&&stableFacets>=5
          ?'STABLE'
          :'READY';
  const confidence:PlayerCoachingIdentityConfidence=status==='STABLE'?'HIGH':status==='READY'?'MEDIUM':'LOW';
  const lesson=input.curriculum.currentLesson;
  const preferredMethod=method&&['PREFERRED','PREFERENCE_EMERGING'].includes(method.status)?method.preferredMethod:null;
  const preferredMethodLabel=method&&preferredMethod?method.preferredMethodLabel:null;
  const ask=firstQuestion(rootLayer,diagnosis,behaviourLabel||'decision');
  const avoid=[
    rootLayer==='EXECUTION'||diagnosis==='EXECUTION_GAP'?'DO NOT RETEACH GAME-STATE THEORY AFTER A CORRECT READ.':null,
    rootLayer==='GAME_READ'||diagnosis==='KNOWLEDGE_GAP'?'DO NOT FADE SUPPORT UNTIL THE PLAYER CAN EXPLAIN THE BRANCH.':null,
    rootLayer==='FOLLOW_THROUGH'?'DO NOT REPLACE THE PLAYER’S FROZEN PRIORITY WITH A NEW LIVE ANSWER.':null,
    rootLayer==='AUTONOMY'?'DO NOT ADD A CUE BEFORE THE PLAYER’S SELF-READ.':null,
    'DO NOT REPLACE THE ACTIVE CURRICULUM OBJECTIVE FROM ONE GAME.',
    'DO NOT TURN A COACHING-RESPONSE ASSOCIATION INTO A CAUSAL CLAIM.',
  ].filter((value):value is string=>Boolean(value));
  const change=changeFrom(input.previous,{
    rootLayer,behaviourKey,preferredMethod,supportNeed,diagnosis,status,
  });
  const identityKey=[
    behaviourKey??'NONE',
    rootLayer??'BUILDING',
    preferredMethod??'UNSET',
    supportNeed,
    diagnosis,
  ].join(':');
  const stylePrimary=input.twin.identity.primary;
  const styleStrong=input.twin.identity.strongest;
  const headline=status==='BUILDING'
    ?'COACHING IDENTITY BUILDING'
    :[
        stylePrimary?.label??behaviourLabel??'PLAYER MODEL',
        input.causalProfile.dominantLayerLabel??(rootLayer==='AUTONOMY'?'AUTONOMY':'EVIDENCE-LED COACHING'),
      ].filter(Boolean).join(' · ');
  const focus=lesson
    ?lesson.label+' · '+lesson.phase+' · REP '+String(lesson.repLadder.level)+'/5 '+lesson.repLadder.stage
    :(behaviourLabel||'BUILD MORE VERIFIED DECISION EVIDENCE');
  const success=lesson?.graduationRule
    ??(input.causalProfile.status==='BUILDING'?'BUILD REPEATED VERIFIED READ → DECISION EVIDENCE.':'REPEAT CLEAN VERIFIED DECISIONS BEFORE THE COACHING CONTRACT CHANGES.');
  const delivery=deliveryText(preferredMethodLabel,method?.preferenceConfidence??'LOW');
  const support=supportText(supportNeed);
  const oneSentence=ask+' THEN '+(lesson?.gameRule??input.causalProfile.nextCoachRule)+' '+support;
  const summary=status==='BUILDING'
    ?'OP CLIMB is combining Decision Twin, Curriculum, Intent Gap, Coach Twin, Autonomy and Causal Memory, but repeated evidence is not yet strong enough to treat the resulting coaching identity as stable.'
    :'OP CLIMB should coach '+(behaviourLabel||'the active behaviour')+' with '+support.toLowerCase()+' '+(rootLayer?('The repeated root-cause layer is '+(input.causalProfile.dominantLayerLabel||rootLayer)+'. '):'')+(preferredMethodLabel?('The strongest current coaching-format association is '+preferredMethodLabel+'. '):'No coaching format is treated as preferred yet. ');

  return{
    version:1,
    generatedAt,
    gamesAnalyzed:games,
    status,
    confidence,
    identityKey,
    headline,
    summary,
    decisionStyle:{
      status:input.twin.identity.status,
      primaryBehaviourKey:stylePrimary?.key??null,
      primaryBehaviourLabel:stylePrimary?.behaviourLabel??null,
      primaryArchetype:stylePrimary?.label??null,
      strongestBehaviourKey:styleStrong?.key??null,
      strongestBehaviourLabel:styleStrong?.behaviourLabel??null,
      strongestArchetype:styleStrong?.label??null,
      evidence:input.twin.identity.summary,
    },
    rootCause:{
      status:input.causalProfile.status,
      layer:rootLayer,
      label:rootLayer?input.causalProfile.dominantLayerLabel:null,
      share:rootLayer?input.causalProfile.dominantShare:null,
      games:rootLayer?input.causalProfile.dominantGames:0,
      evidence:input.causalProfile.summary,
    },
    knowledgeExecution:{
      behaviourKey,
      diagnosis,
      observedReviews:intent?.observedReviews??0,
      sameDiagnosisStreak:intent?.recentSameDiagnosisStreak??0,
      evidence:!intent||intent.observedReviews===0
        ?'No verified pre-cue intent history exists yet for the active behaviour.'
        :diagnosis+' is the latest verified intent/execution diagnosis across '+String(intent.observedReviews)+' observed review'+(intent.observedReviews===1?'':'s')+'.',
    },
    coachingResponse:{
      behaviourKey,
      preferredMethod,
      preferredMethodLabel,
      preferenceStatus:method?.status??'BUILDING',
      preferenceConfidence:method?.preferenceConfidence??'LOW',
      observedGames:method?.totalObserved??0,
      evidence:method?.evidence??input.coachTwin.summary,
    },
    autonomy:{
      behaviourKey:autonomy?.behaviourKey??behaviourKey,
      state:autonomy?.state??'BUILDING',
      supportNeed,
      autonomyStrength:autonomy?.autonomyStrength??null,
      supportDependenceGap:autonomy?.supportDependenceGap??null,
      evidence:autonomy?.evidence??autonomyProfile.summary,
      nextTest:autonomy?.nextTest??'Collect more observed supported and reduced-support reps before changing scaffolding.',
    },
    interventionValue:{
      behaviourKey:intervention?.behaviourKey??behaviourKey,
      state:intervention?.state??'BUILDING',
      confidence:intervention?.confidence??'LOW',
      responseDifference:intervention?.matchedResponseDifference??null,
      evidence:intervention?.interpretation??intervention?.evidence??interventionValue.summary,
    },
    development:{
      behaviourKey,
      label:behaviourLabel,
      phase:lesson?.phase??null,
      repLevel:lesson?.repLadder.level??null,
      repStage:lesson?.repLadder.stage??null,
      gameRule:lesson?.gameRule??null,
      graduationRule:lesson?.graduationRule??null,
      nextLesson:input.curriculum.nextLesson?.label??lesson?.nextUnlock??null,
      evidence:lesson?.whyNow??input.curriculum.summary,
    },
    coachBrief:{
      focus,
      firstQuestion:ask,
      delivery,
      support,
      liveInterruptions:liveInterruptions(rootLayer,supportNeed),
      avoid,
      success,
      oneSentence,
    },
    stability:{
      score:stabilityScore,
      stableFacets,
      totalFacets:6,
      reason:'Identity stability requires repeated evidence across decision style, curriculum, causal root cause, coaching response, autonomy and pre-cue intent. '+String(stableFacets)+'/6 facets currently clear their evidence gate.',
    },
    change,
    source:'OP_CLIMB_PLAYER_COACHING_IDENTITY',
    boundary:BOUNDARY,
  };
}

export const PLAYER_COACHING_IDENTITY_BOUNDARY=BOUNDARY;
