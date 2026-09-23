import type {DecisionCausalProfile,CausalProfileStatus} from './decisionCausalProfile';
import type {CausalCoachLayer,DecisionCausalChainReview} from './decisionCausalChain';
import type {ClimbCoachingDeliveryPolicy,ClimbCoachingStrategy,ClimbCoachingStrategyMode} from './climbCoachingStrategy';
import type {ClimbMatchMission} from './climbMissionDesign';

export type CausalCoachRouteMode=
  |'EVIDENCE_BUILD'
  |'RECOGNITION_FIRST'
  |'COMMITMENT_TEST'
  |'EXECUTION_ONLY'
  |'RECOGNITION_RETEST'
  |'AUTONOMY_TEST';

export type CausalCheckpointFocus='CALIBRATION'|'GAME_READ'|'FOLLOW_THROUGH'|'EXECUTION'|'AUTONOMY';
export type CausalCoachRouteReviewStatus='NO_ROUTE'|'NOT_OBSERVED'|'CONFIRMED'|'CLEAN_REP'|'SHIFT_REQUIRED';

export interface CausalCoachRoute{
  version:1;
  active:boolean;
  profileStatus:CausalProfileStatus;
  sourceLayer:CausalCoachLayer|null;
  sourceLayerLabel:string|null;
  mode:CausalCoachRouteMode;
  behaviourKey:string|null;
  behaviourLabel:string|null;
  baseStrategyMode:ClimbCoachingStrategyMode|null;
  baseDeliveryPolicy:ClimbCoachingDeliveryPolicy|'NONE';
  deliveryPolicy:ClimbCoachingDeliveryPolicy|'NONE';
  forceCoachMethod:'SELF_EXPLAIN'|'WHEN_THEN'|null;
  checkpointMinutes:number[];
  checkpointFocus:CausalCheckpointFocus;
  checkpointPrompt:string;
  pregameDirective:string;
  liveDirective:string;
  reviewQuestion:string;
  safetyConstrained:boolean;
  evidence:string;
  boundary:string;
}

export interface CausalCoachRouteReview{
  version:1;
  active:boolean;
  routeMode:CausalCoachRouteMode|null;
  routedLayer:CausalCoachLayer|null;
  observedLayer:CausalCoachLayer|null;
  status:CausalCoachRouteReviewStatus;
  verifiableChains:number;
  note:string;
  nextAction:string;
  boundary:string;
}

const BOUNDARY='CAUSAL COACH ROUTER USES REPEATED ROOT-CAUSE MEMORY TO CHOOSE WHICH COACHING LAYER GETS EMPHASIS BEFORE THE NEXT GAME. IT DOES NOT CHANGE THE FROZEN WIN CONDITION OR CURRICULUM OBJECTIVE, AND IT NEVER TREATS ONE MATCH AS PROOF THAT A ROUTE CAUSED THE RESULT.';
const REVIEW_BOUNDARY='ROUTE REVIEW COMPARES THE FROZEN PRE-GAME COACHING LAYER WITH THE POST-GAME VERIFIED CAUSAL CHAIN. A MISMATCH IS ONE NEW EVIDENCE POINT, NOT AN AUTOMATIC MODEL REWRITE.';

function upper(value:unknown){return String(value??'').replace(/\s+/g,' ').trim().toUpperCase()}
function label(layer:CausalCoachLayer|null){
  if(layer==='GAME_READ')return'GAME-STATE RECOGNITION';
  if(layer==='FOLLOW_THROUGH')return'FOLLOW-THROUGH';
  if(layer==='EXECUTION')return'DECISION EXECUTION';
  if(layer==='RECOGNITION')return'RECOGNITION RETEST';
  if(layer==='AUTONOMY')return'AUTONOMY';
  if(layer==='EVIDENCE')return'EVIDENCE BUILDING';
  return null;
}
function basePolicy(strategy:ClimbCoachingStrategy|null|undefined):ClimbCoachingDeliveryPolicy|'NONE'{
  return strategy?.deliveryPolicy??'NONE';
}
function safetyProtected(strategy:ClimbCoachingStrategy|null|undefined){
  if(!strategy)return false;
  return strategy.mode==='TEACH'
    ||strategy.deliveryPolicy==='FULL'
    ||strategy.autonomyState==='SUPPORT_DEPENDENT'
    ||strategy.autonomyState==='REGRESSION_WATCH'
    ||strategy.intentDiagnosis==='KNOWLEDGE_GAP';
}
function modeFor(layer:CausalCoachLayer|null):CausalCoachRouteMode{
  if(layer==='GAME_READ')return'RECOGNITION_FIRST';
  if(layer==='FOLLOW_THROUGH')return'COMMITMENT_TEST';
  if(layer==='EXECUTION')return'EXECUTION_ONLY';
  if(layer==='RECOGNITION')return'RECOGNITION_RETEST';
  if(layer==='AUTONOMY')return'AUTONOMY_TEST';
  return'EVIDENCE_BUILD';
}
function checkpointPlan(mode:CausalCoachRouteMode){
  if(mode==='EXECUTION_ONLY')return{minutes:[10],focus:'EXECUTION' as const,prompt:'CAPTURE ONE SELF-READ FOR EVIDENCE, THEN KEEP COACHING ON EXECUTION ONLY.'};
  if(mode==='AUTONOMY_TEST')return{minutes:[10],focus:'AUTONOMY' as const,prompt:'ONE LOW-INTERRUPTION SELF-READ. NO EXTRA LIVE COACHING AFTER THE LOCK.'};
  if(mode==='RECOGNITION_FIRST'||mode==='RECOGNITION_RETEST')return{minutes:[5,10,15],focus:'GAME_READ' as const,prompt:'CLASSIFY AHEAD / EVEN / BEHIND BEFORE ANY BRANCH OR EXECUTION HELP.'};
  if(mode==='COMMITMENT_TEST')return{minutes:[5,10,15],focus:'FOLLOW_THROUGH' as const,prompt:'FREEZE THE PRIORITY, THEN MAKE THE NEXT DECISION SERVE YOUR OWN CHOICE.'};
  return{minutes:[5,10,15],focus:'CALIBRATION' as const,prompt:'KEEP BUILDING VERIFIED SELF-READ EVIDENCE WITHOUT REVEALING THE ANSWER.'};
}
function deliveryFor(mode:CausalCoachRouteMode,strategy:ClimbCoachingStrategy|null|undefined){
  const base=basePolicy(strategy);
  const protectedSupport=safetyProtected(strategy);
  if(mode==='EVIDENCE_BUILD')return{policy:base,safety:false};
  if(mode==='RECOGNITION_FIRST'||mode==='RECOGNITION_RETEST'){
    if(protectedSupport&&base==='FULL')return{policy:'FULL' as const,safety:true};
    return{policy:'DIAGNOSTIC' as const,safety:false};
  }
  if(mode==='COMMITMENT_TEST'){
    if(protectedSupport&&base==='FULL')return{policy:'FULL' as const,safety:true};
    if(base==='DIAGNOSTIC')return{policy:'DIAGNOSTIC' as const,safety:true};
    return{policy:'LIGHT' as const,safety:false};
  }
  if(mode==='EXECUTION_ONLY'){
    if(protectedSupport&&base==='FULL')return{policy:'FULL' as const,safety:true};
    if(base==='DIAGNOSTIC')return{policy:'DIAGNOSTIC' as const,safety:true};
    return{policy:'LIGHT' as const,safety:false};
  }
  if(mode==='AUTONOMY_TEST'){
    if(protectedSupport)return{policy:base,safety:true};
    return{policy:'NONE' as const,safety:false};
  }
  return{policy:base,safety:false};
}
function copy(mode:CausalCoachRouteMode,mission:ClimbMatchMission|null|undefined){
  const behaviour=mission?.behaviourLabel||'the active decision behaviour';
  if(mode==='RECOGNITION_FIRST')return{
    pre:'ROOT CAUSE MEMORY SAYS THE READ IS THE BOTTLENECK. MAKE THE PLAYER CLASSIFY THE GAME STATE BEFORE ADDING EXECUTION DETAIL.',
    live:'ASK FOR THE STATE FIRST. DO NOT REVEAL AHEAD / EVEN / BEHIND FOR THEM.',
    review:'DID THE PLAYER IDENTIFY THE VISIBLE GAME STATE BEFORE THE NEXT GRADED DECISION?',
  };
  if(mode==='RECOGNITION_RETEST')return{
    pre:'THE PLAYER HAS RECOVERED AFTER SOME BAD READS. RETEST RECOGNITION WITHOUT OVERCOACHING THE CLEAN EXECUTION THAT FOLLOWED.',
    live:'FREEZE THE STATE READ. CREDIT A CLEAN RECOVERY; DO NOT TURN IT INTO AN EXECUTION LECTURE.',
    review:'WAS THE GAME-STATE READ ACCURATE, AND DID CLEAN RECOVERY STILL HOLD?',
  };
  if(mode==='COMMITMENT_TEST')return{
    pre:'THE PLAYER CAN OFTEN SEE THE STATE. THE TEST IS WHETHER THEIR NEXT DECISION FOLLOWS THE PRIORITY THEY CHOSE.',
    live:'AFTER THE PLAYER LOCKS A PRIORITY, REMIND THEM ONLY TO MAKE THE NEXT DECISION SERVE THAT PRIORITY.',
    review:'DID THE NEXT VERIFIED DECISION SERVE THE PLAYER’S OWN FROZEN PRIORITY?',
  };
  if(mode==='EXECUTION_ONLY')return{
    pre:'DO NOT RETEACH GAME-STATE THEORY. PRESERVE THE SELF-READ AND COACH '+upper(behaviour)+' AT THE EXECUTION LAYER.',
    live:'KEEP LIVE HELP TIGHT: ONE EXECUTION CUE, NO EXTRA STATE EXPLANATION.',
    review:'AFTER A SUPPORTED READ, DID '+upper(behaviour)+' EXECUTION IMPROVE?',
  };
  if(mode==='AUTONOMY_TEST')return{
    pre:'REPEATED CLEAN READ → ACTION CHAINS SUPPORT AN AUTONOMY TEST. KEEP THE WIN CONDITION, REMOVE NONESSENTIAL SCAFFOLDING.',
    live:'ONE LOW-INTERRUPTION CHECKPOINT ONLY. DO NOT ADD A NEW LIVE CUE UNLESS A SAFETY RULE RESTORES SUPPORT.',
    review:'DID THE PLAYER KEEP A CLEAN READ → ACTION CHAIN WITH REDUCED SUPPORT?',
  };
  return{
    pre:'ROOT-CAUSE MEMORY IS NOT STRONG ENOUGH TO ROUTE COACHING YET. KEEP THE EXISTING COACHING STRATEGY AND COLLECT BETTER EVIDENCE.',
    live:'KEEP THE STANDARD SELF-READ CHECKPOINTS WITHOUT REVEALING THE ANSWER.',
    review:'WHICH COACHING LAYER REPEATS ACROSS VERIFIED READ → DECISION CHAINS?',
  };
}

export function buildCausalCoachRoute(input:{
  profile?:DecisionCausalProfile|null;
  strategy?:ClimbCoachingStrategy|null;
  mission?:ClimbMatchMission|null;
}):CausalCoachRoute{
  const profile=input.profile??null;
  const eligible=profile?.status==='REPEATED_ROOT_CAUSE'||profile?.status==='STABLE_CLEAN';
  const layer=eligible?(profile?.dominantLayer??null):null;
  const mode=eligible?modeFor(layer):'EVIDENCE_BUILD';
  const delivery=deliveryFor(mode,input.strategy);
  const checkpoint=checkpointPlan(mode);
  const words=copy(mode,input.mission);
  const forceCoachMethod=
    mode==='RECOGNITION_FIRST'||mode==='RECOGNITION_RETEST'
      ?'SELF_EXPLAIN'
      :mode==='COMMITMENT_TEST'
        ?'WHEN_THEN'
        :null;
  return{
    version:1,
    active:Boolean(eligible&&layer),
    profileStatus:profile?.status??'BUILDING',
    sourceLayer:layer,
    sourceLayerLabel:label(layer),
    mode,
    behaviourKey:input.mission?.behaviourKey??null,
    behaviourLabel:input.mission?.behaviourLabel??null,
    baseStrategyMode:input.strategy?.mode??null,
    baseDeliveryPolicy:basePolicy(input.strategy),
    deliveryPolicy:delivery.policy,
    forceCoachMethod,
    checkpointMinutes:checkpoint.minutes,
    checkpointFocus:checkpoint.focus,
    checkpointPrompt:checkpoint.prompt,
    pregameDirective:words.pre,
    liveDirective:words.live,
    reviewQuestion:words.review,
    safetyConstrained:delivery.safety,
    evidence:profile?.summary??'Causal Coach Memory is still building.',
    boundary:BOUNDARY,
  };
}

export function reviewCausalCoachRoute(
  route:CausalCoachRoute|null|undefined,
  causal:DecisionCausalChainReview|null|undefined,
):CausalCoachRouteReview{
  if(!route?.active){
    return{
      version:1,active:false,routeMode:route?.mode??null,routedLayer:route?.sourceLayer??null,observedLayer:causal?.primaryCoachLayer&&causal.primaryCoachLayer!=='BUILDING'?causal.primaryCoachLayer:null,
      status:'NO_ROUTE',verifiableChains:causal?.verifiableChains??0,
      note:'No repeated causal pattern was strong enough to route this game before play.',
      nextAction:'KEEP THE EXISTING COACHING STRATEGY AND BUILD MORE VERIFIED CAUSAL EVIDENCE.',
      boundary:REVIEW_BOUNDARY,
    };
  }
  if(!causal||causal.verifiableChains===0||causal.primaryCoachLayer==='BUILDING'||causal.primaryCoachLayer==='EVIDENCE'){
    return{
      version:1,active:true,routeMode:route.mode,routedLayer:route.sourceLayer,observedLayer:null,status:'NOT_OBSERVED',verifiableChains:causal?.verifiableChains??0,
      note:'The routed coaching layer did not produce enough verified read → decision evidence to judge relevance.',
      nextAction:'REPEAT OR DEFER THE ROUTE WITHOUT TREATING THIS GAME AS A PASS OR FAIL.',
      boundary:REVIEW_BOUNDARY,
    };
  }
  const observed=causal.primaryCoachLayer;
  if(observed==='AUTONOMY'){
    return{
      version:1,active:true,routeMode:route.mode,routedLayer:route.sourceLayer,observedLayer:observed,status:'CLEAN_REP',verifiableChains:causal.verifiableChains,
      note:'The game produced a clean verified causal chain. This supports the current learning direction but does not prove the routed coaching caused the clean rep.',
      nextAction:route.mode==='AUTONOMY_TEST'?'KEEP FADING SUPPORT ONLY IF CLEAN CHAINS REPEAT.':'CREDIT THE CLEAN REP AND LET MULTI-GAME CAUSAL MEMORY DECIDE WHETHER SUPPORT CAN FADE.',
      boundary:REVIEW_BOUNDARY,
    };
  }
  if(observed===route.sourceLayer){
    return{
      version:1,active:true,routeMode:route.mode,routedLayer:route.sourceLayer,observedLayer:observed,status:'CONFIRMED',verifiableChains:causal.verifiableChains,
      note:'The same coaching layer appeared again in this game’s verified causal chain.',
      nextAction:'KEEP THE ROUTE ACTIVE UNTIL REPEATED CLEAN CHAINS OR A DIFFERENT REPEATED ROOT CAUSE JUSTIFY A CHANGE.',
      boundary:REVIEW_BOUNDARY,
    };
  }
  return{
    version:1,active:true,routeMode:route.mode,routedLayer:route.sourceLayer,observedLayer:observed,status:'SHIFT_REQUIRED',verifiableChains:causal.verifiableChains,
    note:'This game’s earliest verified coaching failure appeared in a different layer than the frozen route.',
    nextAction:'DO NOT SWITCH FROM ONE GAME. ADD THIS AS NEW CAUSAL EVIDENCE AND CHANGE THE ROUTE ONLY IF THE NEW LAYER REPEATS.',
    boundary:REVIEW_BOUNDARY,
  };
}

export const CAUSAL_COACH_ROUTER_BOUNDARY=BOUNDARY;
