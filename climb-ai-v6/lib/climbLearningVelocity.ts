import type {HistoryAnalysisRow} from './riot/proHistory';
import type {DecisionBehaviourKey} from './decisionTwin';
import type {ClimbCoachMethod,ClimbCoachTwin} from './climbCoachTwin';
import type {ClimbInterventionValueProfile} from './climbInterventionValue';
import type {PlayerCoachingIdentity} from './playerCoachingIdentity';
import type {ClimbCurriculum} from './climbCurriculum';

export type LearningVelocityStatus='BUILDING'|'EMERGING'|'READY'|'STABLE';
export type LearningPaceState='BUILDING'|'CONSOLIDATE'|'STANDARD'|'EARLY_TEST_CANDIDATE';
export type LearningVelocityConfidence='LOW'|'MEDIUM'|'HIGH';
export type LearningExperimentBias='CONSOLIDATE'|'BALANCED'|'FADE_WHEN_SAFE';
export type LearningMethodMode='EXPLORE'|'USE_ASSOCIATED_METHOD'|'RETEST_ALTERNATIVE';

export interface LearningVelocityMethodSignal{
  method:ClimbCoachMethod;
  label:string;
  observedGames:number;
  executedGames:number;
  executionRate:number|null;
  independentWithin2:number;
  independentWithin2Rate:number|null;
  transferWithin3:number;
  transferWithin3Rate:number|null;
  medianObservedRepsToIndependent:number|null;
  signalScore:number|null;
  confidence:LearningVelocityConfidence;
  evidence:string;
}

export interface LearningVelocityBehaviourCard{
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  observedMissions:number;
  cleanMissions:number;
  independentCleanMissions:number;
  transferTests:number;
  transferredTests:number;
  regressionSignals:number;
  cleanRate:number|null;
  independentRate:number|null;
  transferRate:number|null;
  observedRepsToFirstClean:number|null;
  observedRepsToFirstIndependent:number|null;
  observedRepsToFirstTransfer:number|null;
  paceState:LearningPaceState;
  confidence:LearningVelocityConfidence;
  methodSignals:LearningVelocityMethodSignal[];
  recommendedMethod:ClimbCoachMethod|null;
  recommendedMethodLabel:string|null;
  recommendationConfidence:LearningVelocityConfidence;
  evidence:string;
}

export interface LearningVelocityPolicy{
  behaviourKey:DecisionBehaviourKey|null;
  behaviourLabel:string|null;
  paceState:LearningPaceState;
  reinforceCleanRepsRequired:1|2|3;
  fadeCleanRepsRequired:1|2;
  experimentBias:LearningExperimentBias;
  methodMode:LearningMethodMode;
  recommendedMethod:ClimbCoachMethod|null;
  recommendedMethodLabel:string|null;
  explanationDensity:'FULL'|'STANDARD'|'CONCISE';
  reason:string;
  boundary:string;
}

export interface LearningVelocityProfile{
  version:1;
  generatedAt:string;
  gamesAnalyzed:number;
  status:LearningVelocityStatus;
  confidence:LearningVelocityConfidence;
  activeBehaviourKey:DecisionBehaviourKey|null;
  activeBehaviourLabel:string|null;
  cards:LearningVelocityBehaviourCard[];
  activeCard:LearningVelocityBehaviourCard|null;
  policy:LearningVelocityPolicy;
  change:{
    status:'INITIAL'|'UNCHANGED'|'REFINED'|'SHIFTED';
    changedFields:string[];
    summary:string;
  };
  summary:string;
  boundary:string;
}

const METHOD_LABELS:Record<ClimbCoachMethod,string>={
  WHEN_THEN:'When → Then',
  CONTRAST_BRANCH:'Old Branch → New Branch',
  THREAT_ANCHOR:'Threat Anchor',
  SELF_EXPLAIN:'Self-Explain',
};
const METHODS:ClimbCoachMethod[]=['WHEN_THEN','CONTRAST_BRANCH','THREAT_ANCHOR','SELF_EXPLAIN'];
const BOUNDARY='LEARNING VELOCITY MEASURES HOW QUICKLY VERIFIED DECISION EVIDENCE MOVES FROM CLEAN READS TO INDEPENDENT EXECUTION AND TRANSFER. COACHING-METHOD SIGNALS ARE WITHIN-PLAYER ASSOCIATIONS, NOT CAUSAL EFFECT ESTIMATES. NOT OBSERVED GAMES ARE NEUTRAL. VELOCITY MAY CHANGE TEST TIMING, REP COUNTS AND COACHING-FORMAT RETESTS, BUT IT CANNOT BYPASS CURRICULUM, TRANSFER, CAUSAL OR SAFETY GATES.';

interface Rep{
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  gameOrdinal:number;
  clean:boolean;
  independent:boolean;
  transferTest:boolean;
  transferred:boolean;
  regression:boolean;
  method:ClimbCoachMethod|null;
  methodObserved:boolean;
  methodExecuted:boolean;
}

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function rate(a:number,b:number){return b?Math.round(a/b*100):null}
function median(values:number[]){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const mid=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[mid]!:Math.round((sorted[mid-1]!+sorted[mid]!)/2);
}
function behaviourLabel(key:DecisionBehaviourKey){
  return key.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
}
function confidence(observed:number,hasIndependent=false):LearningVelocityConfidence{
  if(observed>=8&&hasIndependent)return'HIGH';
  if(observed>=4)return'MEDIUM';
  return'LOW';
}
function rowsToReps(rows:HistoryAnalysisRow[]):Rep[]{
  const out:Rep[]=[];
  const ordered=[...rows].filter(row=>row.analysis?.version===1).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-50);
  ordered.forEach((row,gameIndex)=>{
    const summary=(row.analysis as any)?.decisionGraph?.summary??{};
    const mission=summary.climbMission;
    if(!mission?.version||!mission.active||!mission.behaviourKey)return;
    const missionStatus=clean(mission.status).toUpperCase();
    if(!['EXECUTED','MISSED','MIXED'].includes(missionStatus))return;
    const strategy=summary.coachingStrategy??{};
    const strategyStatus=clean(strategy.status).toUpperCase();
    const coach=summary.coachIntervention??{};
    const coachStatus=clean(coach.status).toUpperCase();
    const transfer=summary.decisionTransfer??{};
    const transferStatus=clean(transfer.status).toUpperCase();
    const route=summary.causalCoachRoute??{};
    const cleanRep=missionStatus==='EXECUTED'&&(strategyStatus==='CLEAN'||!strategyStatus);
    const independent=cleanRep&&(Boolean(strategy.autonomyEvidence)||strategy.intervened===false);
    const method=(METHODS.includes(coach.method)?coach.method:null) as ClimbCoachMethod|null;
    out.push({
      behaviourKey:mission.behaviourKey as DecisionBehaviourKey,
      behaviourLabel:clean(mission.behaviourLabel)||behaviourLabel(mission.behaviourKey as DecisionBehaviourKey),
      gameOrdinal:gameIndex+1,
      clean:cleanRep,
      independent,
      transferTest:['TRANSFERRED','FAILED_TRANSFER','MIXED'].includes(transferStatus),
      transferred:transferStatus==='TRANSFERRED',
      regression:['SHIFT_REQUIRED','REGRESSION'].includes(clean(route.status).toUpperCase())||strategyStatus==='MISSED',
      method,
      methodObserved:Boolean(method&&['EXECUTED','MISSED','MIXED'].includes(coachStatus)),
      methodExecuted:coachStatus==='EXECUTED',
    });
  });
  return out;
}
function firstRepIndex(reps:Rep[],predicate:(rep:Rep)=>boolean){
  const idx=reps.findIndex(predicate);
  return idx>=0?idx+1:null;
}
function methodSignals(reps:Rep[],twin:ClimbCoachTwin,key:DecisionBehaviourKey){
  const byMethod=METHODS.map(method=>{
    const anchors=reps.map((rep,index)=>({rep,index})).filter(item=>item.rep.method===method&&item.rep.methodObserved);
    let independentWithin2=0;
    let transferWithin3=0;
    const independentDistances:number[]=[];
    for(const anchor of anchors){
      const next=reps.slice(anchor.index+1,anchor.index+4);
      const independentIndex=next.slice(0,2).findIndex(rep=>rep.independent);
      if(independentIndex>=0){
        independentWithin2+=1;
        independentDistances.push(independentIndex+1);
      }
      if(next.some(rep=>rep.transferred))transferWithin3+=1;
    }
    const twinProfile=twin.behaviourProfiles.find(profile=>profile.behaviourKey===key);
    const twinStats=twinProfile?.methods.find(item=>item.method===method);
    const observed=anchors.length;
    const executed=anchors.filter(item=>item.rep.methodExecuted).length;
    const executionRate=twinStats?.executionRate??rate(executed,observed);
    const independentRate=rate(independentWithin2,observed);
    const transferRate=rate(transferWithin3,observed);
    const signalScore=observed>=3
      ?Math.round((executionRate??0)*0.5+(independentRate??0)*0.35+(transferRate??0)*0.15)
      :null;
    return{
      method,
      label:METHOD_LABELS[method],
      observedGames:observed,
      executedGames:executed,
      executionRate,
      independentWithin2,
      independentWithin2Rate:independentRate,
      transferWithin3,
      transferWithin3Rate:transferRate,
      medianObservedRepsToIndependent:median(independentDistances),
      signalScore,
      confidence:confidence(observed,independentWithin2>0),
      evidence:observed<3
        ?METHOD_LABELS[method]+' has only '+String(observed)+' observed coaching rep'+(observed===1?'':'s')+' for this behaviour, so no efficiency claim is made.'
        :METHOD_LABELS[method]+' is associated with '+String(executionRate??0)+'% immediate execution and '+String(independentRate??0)+'% independent execution within the next two observed reps across '+String(observed)+' observed coaching reps.',
    } satisfies LearningVelocityMethodSignal;
  });
  return byMethod;
}
function recommendation(signals:LearningVelocityMethodSignal[],twin:ClimbCoachTwin,key:DecisionBehaviourKey){
  const comparable=signals.filter(item=>item.signalScore!==null&&item.observedGames>=3).sort((a,b)=>(b.signalScore??0)-(a.signalScore??0)||b.observedGames-a.observedGames);
  const top=comparable[0]??null;
  const second=comparable[1]??null;
  const twinProfile=twin.behaviourProfiles.find(profile=>profile.behaviourKey===key);
  if(top&&second&&(top.signalScore??0)-(second.signalScore??0)>=10){
    return{method:top.method,label:top.label,confidence:top.observedGames>=6?'HIGH' as const:'MEDIUM' as const};
  }
  if(top&&!second&&top.observedGames>=5&&twinProfile?.preferredMethod===top.method){
    return{method:top.method,label:top.label,confidence:'MEDIUM' as const};
  }
  if(twinProfile?.status==='PREFERRED'&&twinProfile.preferredMethod){
    const signal=signals.find(item=>item.method===twinProfile.preferredMethod);
    if(signal&&signal.observedGames>=4){
      return{method:signal.method,label:signal.label,confidence:twinProfile.preferenceConfidence};
    }
  }
  return{method:null,label:null,confidence:'LOW' as const};
}
function pace(reps:Rep[],identity:PlayerCoachingIdentity){
  const observed=reps.length;
  const firstIndependent=firstRepIndex(reps,rep=>rep.independent);
  const independentRate=rate(reps.filter(rep=>rep.independent).length,observed);
  const regressionSignals=reps.filter(rep=>rep.regression).length;
  if(observed<4)return'BUILDING' as const;
  if(
    identity.knowledgeExecution.diagnosis==='KNOWLEDGE_GAP'
    ||identity.autonomy.state==='SUPPORT_DEPENDENT'
    ||identity.autonomy.state==='REGRESSION_WATCH'
    ||regressionSignals>=2
    ||(observed>=6&&!firstIndependent)
  )return'CONSOLIDATE' as const;
  if(firstIndependent!==null&&firstIndependent<=3&&(independentRate??0)>=60&&regressionSignals===0)return'EARLY_TEST_CANDIDATE' as const;
  return'STANDARD' as const;
}
function buildCard(key:DecisionBehaviourKey,reps:Rep[],twin:ClimbCoachTwin,identity:PlayerCoachingIdentity):LearningVelocityBehaviourCard{
  const cleanMissions=reps.filter(rep=>rep.clean).length;
  const independent=reps.filter(rep=>rep.independent).length;
  const transferTests=reps.filter(rep=>rep.transferTest).length;
  const transferred=reps.filter(rep=>rep.transferred).length;
  const regressions=reps.filter(rep=>rep.regression).length;
  const signals=methodSignals(reps,twin,key);
  const rec=recommendation(signals,twin,key);
  const state=pace(reps,identity);
  return{
    behaviourKey:key,
    behaviourLabel:reps[0]?.behaviourLabel??behaviourLabel(key),
    observedMissions:reps.length,
    cleanMissions,
    independentCleanMissions:independent,
    transferTests,
    transferredTests:transferred,
    regressionSignals:regressions,
    cleanRate:rate(cleanMissions,reps.length),
    independentRate:rate(independent,reps.length),
    transferRate:rate(transferred,transferTests),
    observedRepsToFirstClean:firstRepIndex(reps,rep=>rep.clean),
    observedRepsToFirstIndependent:firstRepIndex(reps,rep=>rep.independent),
    observedRepsToFirstTransfer:firstRepIndex(reps,rep=>rep.transferred),
    paceState:state,
    confidence:confidence(reps.length,independent>0),
    methodSignals:signals,
    recommendedMethod:rec.method,
    recommendedMethodLabel:rec.label,
    recommendationConfidence:rec.confidence,
    evidence:state==='BUILDING'
      ?'Only '+String(reps.length)+' observed mission reps exist for '+(reps[0]?.behaviourLabel??behaviourLabel(key))+'. Learning pace remains evidence-building.'
      :state==='CONSOLIDATE'
        ?'This behaviour still shows support, regression or independence evidence that favours extra consolidation before another support-removal test.'
        :state==='EARLY_TEST_CANDIDATE'
          ?'Independent execution appeared early and has remained stable enough to justify testing reduced support sooner when the existing safety gates permit it.'
          :'Observed learning progression supports the standard test cadence; there is not enough evidence to deliberately accelerate or slow the next support-removal test.',
  };
}
function activeKey(curriculum:ClimbCurriculum,identity:PlayerCoachingIdentity){
  return curriculum.currentLesson?.behaviourKey??identity.development.behaviourKey??null;
}
function policyFor(card:LearningVelocityBehaviourCard|null,identity:PlayerCoachingIdentity,value:ClimbInterventionValueProfile):LearningVelocityPolicy{
  const key=card?.behaviourKey??identity.development.behaviourKey??null;
  const valueCard=key?value.cards.find(item=>item.behaviourKey===key):null;
  const forcedConsolidate=
    identity.knowledgeExecution.diagnosis==='KNOWLEDGE_GAP'
    ||identity.autonomy.state==='SUPPORT_DEPENDENT'
    ||identity.autonomy.state==='REGRESSION_WATCH'
    ||valueCard?.state==='STRONG_SUPPORT_ASSOCIATED_LIFT';
  const paceState:LearningPaceState=forcedConsolidate?'CONSOLIDATE':card?.paceState??'BUILDING';
  const reinforce:1|2|3=paceState==='CONSOLIDATE'?3:paceState==='EARLY_TEST_CANDIDATE'?1:2;
  const fade:1|2=paceState==='CONSOLIDATE'?2:1;
  const bias:LearningExperimentBias=paceState==='CONSOLIDATE'?'CONSOLIDATE':paceState==='EARLY_TEST_CANDIDATE'?'FADE_WHEN_SAFE':'BALANCED';
  const recommended=card?.recommendedMethod??null;
  const methodMode:LearningMethodMode=recommended
    ?'USE_ASSOCIATED_METHOD'
    :card&&card.observedMissions>=6
      ?'RETEST_ALTERNATIVE'
      :'EXPLORE';
  const density=paceState==='CONSOLIDATE'?'FULL':paceState==='EARLY_TEST_CANDIDATE'?'CONCISE':'STANDARD';
  return{
    behaviourKey:key,
    behaviourLabel:card?.behaviourLabel??identity.development.label??null,
    paceState,
    reinforceCleanRepsRequired:reinforce,
    fadeCleanRepsRequired:fade,
    experimentBias:bias,
    methodMode,
    recommendedMethod:recommended,
    recommendedMethodLabel:card?.recommendedMethodLabel??null,
    explanationDensity:density,
    reason:paceState==='CONSOLIDATE'
      ?'Require more clean consolidation evidence before reducing support again. This changes test timing, not mastery criteria.'
      :paceState==='EARLY_TEST_CANDIDATE'
        ?'Independent execution has appeared quickly enough to test reduced support after fewer clean consolidation reps when all existing safety gates permit it.'
        :'Use the standard coaching cadence until repeated velocity evidence supports a different test timing.',
    boundary:BOUNDARY,
  };
}
function changeFrom(previous:LearningVelocityProfile|null|undefined,policy:LearningVelocityPolicy,active:LearningVelocityBehaviourCard|null){
  if(!previous)return{status:'INITIAL' as const,changedFields:['INITIAL_PROFILE'],summary:'This is the first Learning Velocity profile built from verified coaching and mission evidence.'};
  const fields:string[]=[];
  if(previous.policy.paceState!==policy.paceState)fields.push('PACE_STATE');
  if(previous.policy.reinforceCleanRepsRequired!==policy.reinforceCleanRepsRequired)fields.push('REINFORCE_REP_TARGET');
  if(previous.policy.fadeCleanRepsRequired!==policy.fadeCleanRepsRequired)fields.push('FADE_REP_TARGET');
  if(previous.policy.recommendedMethod!==policy.recommendedMethod)fields.push('COACHING_METHOD');
  if(previous.activeCard?.observedRepsToFirstIndependent!==active?.observedRepsToFirstIndependent)fields.push('INDEPENDENCE_MILESTONE');
  if(!fields.length)return{status:'UNCHANGED' as const,changedFields:[],summary:'New evidence reinforced the existing learning-velocity policy.'};
  const structural=fields.some(field=>['PACE_STATE','REINFORCE_REP_TARGET','FADE_REP_TARGET'].includes(field));
  return{
    status:structural?'SHIFTED' as const:'REFINED' as const,
    changedFields:fields,
    summary:(structural?'The coaching cadence changed because repeated evidence altered ':'The profile was refined by ')+fields.join(', ').replaceAll('_',' ').toLowerCase()+'.',
  };
}

export function buildLearningVelocityProfile(input:{
  rows:HistoryAnalysisRow[];
  coachTwin:ClimbCoachTwin;
  interventionValue:ClimbInterventionValueProfile;
  identity:PlayerCoachingIdentity;
  curriculum:ClimbCurriculum;
  previous?:LearningVelocityProfile|null;
  generatedAt?:string;
}):LearningVelocityProfile{
  const generatedAt=input.generatedAt??new Date().toISOString();
  const reps=rowsToReps(input.rows);
  const keys=[...new Set(reps.map(rep=>rep.behaviourKey))];
  const cards=keys
    .map(key=>buildCard(key,reps.filter(rep=>rep.behaviourKey===key),input.coachTwin,input.identity))
    .sort((a,b)=>b.observedMissions-a.observedMissions);
  const key=activeKey(input.curriculum,input.identity);
  const activeCard=(key?cards.find(card=>card.behaviourKey===key):null)??null;
  const policy=policyFor(activeCard,input.identity,input.interventionValue);
  const stableCards=cards.filter(card=>card.confidence!=='LOW').length;
  const status:LearningVelocityStatus=input.rows.length<4||!activeCard
    ?'BUILDING'
    :activeCard.confidence==='LOW'
      ?'EMERGING'
      :input.rows.length>=10&&activeCard.confidence==='HIGH'
        ?'STABLE'
        :'READY';
  const profileConfidence:LearningVelocityConfidence=status==='STABLE'?'HIGH':status==='READY'?'MEDIUM':'LOW';
  const change=changeFrom(input.previous,policy,activeCard);
  return{
    version:1,
    generatedAt,
    gamesAnalyzed:input.rows.length,
    status,
    confidence:profileConfidence,
    activeBehaviourKey:key,
    activeBehaviourLabel:activeCard?.behaviourLabel??input.identity.development.label??null,
    cards,
    activeCard,
    policy,
    change,
    summary:!activeCard
      ?'Learning Velocity is waiting for repeated observed mission evidence on the active development objective.'
      :activeCard.behaviourLabel+' has '+String(activeCard.observedMissions)+' observed mission reps, '+String(activeCard.independentCleanMissions)+' independent clean reps and '+String(activeCard.transferredTests)+' verified transfer'+(activeCard.transferredTests===1?'':'s')+'. '+policy.reason,
    boundary:BOUNDARY,
  };
}

export function selectLearningVelocityCoachMethod(
  profile:LearningVelocityProfile|null|undefined,
  behaviourKey:DecisionBehaviourKey|null|undefined,
):ClimbCoachMethod|null{
  if(!profile||!behaviourKey||profile.status==='BUILDING')return null;
  if(profile.policy.behaviourKey!==behaviourKey)return null;
  if(profile.policy.methodMode!=='USE_ASSOCIATED_METHOD')return null;
  return profile.policy.recommendedMethod;
}

export function learningVelocityExperimentBias(
  profile:LearningVelocityProfile|null|undefined,
  behaviourKey:DecisionBehaviourKey|null|undefined,
):LearningExperimentBias{
  if(!profile||!behaviourKey||profile.status==='BUILDING'||profile.policy.behaviourKey!==behaviourKey)return'BALANCED';
  return profile.policy.experimentBias;
}

export const LEARNING_VELOCITY_BOUNDARY=BOUNDARY;
