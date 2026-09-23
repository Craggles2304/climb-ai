import type {HistoryAnalysisRow} from './riot/proHistory';
import type {DecisionBehaviourKey,DecisionSituationTag,DraftSituationContext} from './decisionTwin';
import type {ClimbMatchMission,ClimbMatchMissionReview} from './climbMissionDesign';

export type ClimbCoachMethod='WHEN_THEN'|'CONTRAST_BRANCH'|'THREAT_ANCHOR'|'SELF_EXPLAIN';
export type ClimbCoachSelectionMode='EXPLORE'|'PREFERRED'|'RETEST'|'STAGE_DEFAULT'|'DIAGNOSTIC'|'CAUSAL_ROUTE'|'LEARNING_VELOCITY';
export type ClimbCoachDeliveryPolicy='FULL'|'LIGHT'|'DIAGNOSTIC';
export type ClimbCoachReviewStatus='NO_INTERVENTION'|'NOT_OBSERVED'|'EXECUTED'|'MISSED'|'MIXED';

export interface ClimbCoachIntervention{
  version:1;
  id:string;
  missionId:string;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  targetTag:DecisionSituationTag;
  method:ClimbCoachMethod;
  selectionMode:ClimbCoachSelectionMode;
  deliveryPolicy:ClimbCoachDeliveryPolicy;
  methodLabel:string;
  title:string;
  primaryCue:string;
  secondaryPrompt:string|null;
  whyThisMethod:string;
  frozenEvidence:string;
  relevantEnemies:string[];
  source:'CLIMB_COACH_TWIN';
  boundary:string;
}

export interface ClimbCoachInterventionReview{
  version:1;
  active:boolean;
  interventionId:string|null;
  missionId:string|null;
  behaviourKey:DecisionBehaviourKey|null;
  behaviourLabel:string|null;
  targetTag:DecisionSituationTag|null;
  method:ClimbCoachMethod|null;
  methodLabel:string|null;
  selectionMode:ClimbCoachSelectionMode|null;
  deliveryPolicy:ClimbCoachDeliveryPolicy|null;
  status:ClimbCoachReviewStatus;
  matchedMoments:number;
  cleanMoments:number;
  improveMoments:number;
  responseScore:number|null;
  note:string;
  boundary:string;
}

export interface ClimbCoachMethodStats{
  method:ClimbCoachMethod;
  label:string;
  frozenGames:number;
  observedGames:number;
  notObservedGames:number;
  executedGames:number;
  mixedGames:number;
  missedGames:number;
  cleanMoments:number;
  matchedMoments:number;
  executionRate:number|null;
  cleanMomentRate:number|null;
  recentObservedGames:number;
  recentExecutionRate:number|null;
}

export interface ClimbCoachBehaviourProfile{
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  targetTag:DecisionSituationTag|'ANY';
  totalFrozen:number;
  totalObserved:number;
  methods:ClimbCoachMethodStats[];
  preferredMethod:ClimbCoachMethod|null;
  preferredMethodLabel:string|null;
  preferenceConfidence:'LOW'|'MEDIUM'|'HIGH';
  preferenceEdge:number|null;
  status:'BUILDING'|'EXPLORING'|'PREFERENCE_EMERGING'|'PREFERRED'|'RETESTING';
  evidence:string;
}

export interface ClimbCoachTwin{
  version:1;
  generatedAt:string;
  gamesAnalyzed:number;
  interventionsFrozen:number;
  interventionsObserved:number;
  behavioursProfiled:number;
  behaviourProfiles:ClimbCoachBehaviourProfile[];
  overallMethods:ClimbCoachMethodStats[];
  summary:string;
  boundary:string;
}

const METHODS:ClimbCoachMethod[]=['WHEN_THEN','CONTRAST_BRANCH','THREAT_ANCHOR','SELF_EXPLAIN'];
const METHOD_LABELS:Record<ClimbCoachMethod,string>={
  WHEN_THEN:'When → Then',
  CONTRAST_BRANCH:'Old Branch → New Branch',
  THREAT_ANCHOR:'Threat Anchor',
  SELF_EXPLAIN:'Self-Explain',
};
const BOUNDARY='CLIMB Coach Twin measures which frozen coaching formats are associated with cleaner verified decisions for this player. It does not claim the wording caused the result, and it does not prefer a method from one game. NOT OBSERVED games are neutral.';
const REVIEW_BOUNDARY='This review scores the frozen coaching format only through the same verified match mission it was attached to. It records response association, not proof that the coaching format caused the decision.';

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function rate(a:number,b:number){return b?Math.round(a/b*100):null}
function score(review:ClimbCoachInterventionReview){
  if(review.status==='EXECUTED')return 100;
  if(review.status==='MISSED')return 0;
  if(review.status==='MIXED'&&review.matchedMoments)return Math.round(review.cleanMoments/review.matchedMoments*100);
  return null;
}
function asMethod(value:unknown):ClimbCoachMethod|null{
  const method=clean(value).toUpperCase() as ClimbCoachMethod;
  return METHODS.includes(method)?method:null;
}
function eligibleMethods(mission:ClimbMatchMission){
  return METHODS.filter(method=>method!=='THREAT_ANCHOR'||mission.relevantEnemies.length>0);
}
function stageDefault(mission:ClimbMatchMission,eligible:ClimbCoachMethod[]):ClimbCoachMethod{
  if(mission.repStage==='RECOGNISE'&&eligible.includes('THREAT_ANCHOR'))return'THREAT_ANCHOR';
  if(mission.repStage==='EXECUTE')return'WHEN_THEN';
  if(mission.repStage==='STABILISE')return'CONTRAST_BRANCH';
  return'SELF_EXPLAIN';
}
function statsFor(reviews:ClimbCoachInterventionReview[],method:ClimbCoachMethod):ClimbCoachMethodStats{
  const all=reviews.filter(item=>item.method===method);
  const observed=all.filter(item=>item.status!=='NOT_OBSERVED'&&item.status!=='NO_INTERVENTION');
  const executed=observed.filter(item=>item.status==='EXECUTED').length;
  const mixed=observed.filter(item=>item.status==='MIXED').length;
  const missed=observed.filter(item=>item.status==='MISSED').length;
  const matchedMoments=observed.reduce((sum,item)=>sum+item.matchedMoments,0);
  const cleanMoments=observed.reduce((sum,item)=>sum+item.cleanMoments,0);
  const recent=observed.slice(-3);
  const recentScores=recent.map(score).filter((value):value is number=>typeof value==='number');
  return{
    method,
    label:METHOD_LABELS[method],
    frozenGames:all.length,
    observedGames:observed.length,
    notObservedGames:all.filter(item=>item.status==='NOT_OBSERVED').length,
    executedGames:executed,
    mixedGames:mixed,
    missedGames:missed,
    cleanMoments,
    matchedMoments,
    executionRate:observed.length?Math.round((executed+mixed*.5)/observed.length*100):null,
    cleanMomentRate:rate(cleanMoments,matchedMoments),
    recentObservedGames:recent.length,
    recentExecutionRate:recentScores.length?Math.round(recentScores.reduce((sum,value)=>sum+value,0)/recentScores.length):null,
  };
}
function preference(methods:ClimbCoachMethodStats[]){
  const supported=methods.filter(item=>item.observedGames>=2&&item.executionRate!==null)
    .sort((a,b)=>(b.executionRate??-1)-(a.executionRate??-1)||b.observedGames-a.observedGames||a.method.localeCompare(b.method));
  const best=supported[0]??null;
  const second=supported[1]??null;
  if(!best||best.observedGames<3)return{method:null as ClimbCoachMethod|null,edge:null as number|null,confidence:'LOW' as const};
  const edge=second?Math.max(0,(best.executionRate??0)-(second.executionRate??0)):null;
  if(second&&edge!==null&&edge<15)return{method:null,edge,confidence:best.observedGames>=5?'MEDIUM' as const:'LOW' as const};
  const confidence=best.observedGames>=6&&(!second||second.observedGames>=3)&&((edge??20)>=20)?'HIGH' as const:'MEDIUM' as const;
  return{method:best.method,edge,confidence};
}
function reviewRows(rows:HistoryAnalysisRow[]){
  return [...rows]
    .filter(row=>row.analysis?.version===1)
    .sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))
    .slice(-50)
    .map(row=>(row.analysis as any)?.decisionGraph?.summary?.coachIntervention as ClimbCoachInterventionReview|undefined)
    .filter((item):item is ClimbCoachInterventionReview=>Boolean(item?.version===1&&item.active&&item.method));
}
function labelFor(key:DecisionBehaviourKey,reviews:ClimbCoachInterventionReview[]){
  return reviews.find(item=>item.behaviourKey===key)?.behaviourLabel??key.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
}

export function buildClimbCoachTwin(rows:HistoryAnalysisRow[],generatedAt=new Date().toISOString()):ClimbCoachTwin{
  const ordered=[...rows].filter(row=>row.analysis?.version===1).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-50);
  const reviews=reviewRows(ordered);
  const keys=[...new Set(reviews.map(item=>item.behaviourKey).filter((value):value is DecisionBehaviourKey=>Boolean(value)))];
  const behaviourProfiles:ClimbCoachBehaviourProfile[]=[];
  for(const key of keys){
    const subset=reviews.filter(item=>item.behaviourKey===key);
    const methods=METHODS.map(method=>statsFor(subset,method));
    const pref=preference(methods);
    const preferred=methods.find(item=>item.method===pref.method)??null;
    const retesting=Boolean(preferred&&preferred.observedGames>=5&&preferred.recentObservedGames===3&&(preferred.recentExecutionRate??100)<40);
    const totalObserved=subset.filter(item=>item.status!=='NOT_OBSERVED'&&item.status!=='NO_INTERVENTION').length;
    const underTest=methods.some(item=>item.observedGames<2);
    const status:ClimbCoachBehaviourProfile['status']=retesting
      ?'RETESTING'
      :pref.method&&pref.confidence==='HIGH'
        ?'PREFERRED'
        :pref.method
          ?'PREFERENCE_EMERGING'
          :underTest
            ?'EXPLORING'
            :'BUILDING';
    behaviourProfiles.push({
      behaviourKey:key,
      behaviourLabel:labelFor(key,subset),
      targetTag:'ANY',
      totalFrozen:subset.length,
      totalObserved,
      methods,
      preferredMethod:pref.method,
      preferredMethodLabel:pref.method?METHOD_LABELS[pref.method]:null,
      preferenceConfidence:retesting?'LOW':pref.confidence,
      preferenceEdge:pref.edge,
      status,
      evidence:!subset.length
        ?'No frozen coaching-format tests yet.'
        :pref.method&&!retesting
          ?METHOD_LABELS[pref.method]+' has the strongest repeated verified response so far ('+String(preferred?.observedGames??0)+' observed tests).'
          :retesting
            ?METHOD_LABELS[preferred!.method]+' was previously strongest, but its recent verified response fell below the retest threshold.'
            :'OP CLIMB is still rotating coaching formats until enough comparable observed tests exist.',
    });
  }
  const overallMethods=METHODS.map(method=>statsFor(reviews,method));
  return{
    version:1,
    generatedAt,
    gamesAnalyzed:ordered.length,
    interventionsFrozen:reviews.length,
    interventionsObserved:reviews.filter(item=>item.status!=='NOT_OBSERVED'&&item.status!=='NO_INTERVENTION').length,
    behavioursProfiled:behaviourProfiles.length,
    behaviourProfiles,
    overallMethods,
    summary:!reviews.length
      ?'Coach Twin is building. OP CLIMB has not yet frozen enough coaching-format tests to learn how this player responds best.'
      :behaviourProfiles.some(item=>item.status==='PREFERRED')
        ?'Coach Twin has at least one high-confidence coaching-format preference and will keep retesting it rather than assuming it stays optimal forever.'
        :'Coach Twin is still exploring coaching formats. It will not call one method better from one or two games.',
    boundary:BOUNDARY,
  };
}

function profileFor(twin:ClimbCoachTwin,key:DecisionBehaviourKey){
  return twin.behaviourProfiles.find(item=>item.behaviourKey===key)??null;
}
function chooseMethod(twin:ClimbCoachTwin,mission:ClimbMatchMission){
  const eligible=eligibleMethods(mission);
  const profile=profileFor(twin,mission.behaviourKey);
  const stats=profile?.methods.filter(item=>eligible.includes(item.method))??eligible.map(method=>statsFor([],method));
  const preferred=profile?.preferredMethod&&eligible.includes(profile.preferredMethod)?profile.preferredMethod:null;
  if(preferred){
    const prefStats=stats.find(item=>item.method===preferred);
    if(prefStats&&prefStats.observedGames>=5&&prefStats.recentObservedGames===3&&(prefStats.recentExecutionRate??100)<40){
      const alternatives=stats.filter(item=>item.method!==preferred).sort((a,b)=>a.observedGames-b.observedGames||a.frozenGames-b.frozenGames);
      return{method:alternatives[0]?.method??stageDefault(mission,eligible),mode:'RETEST' as const,reason:'The previously strongest coaching format has missed repeatedly in recent observed tests, so OP CLIMB is retesting a different format instead of assuming the old preference still fits.'};
    }
    return{method:preferred,mode:'PREFERRED' as const,reason:'Repeated verified response evidence currently supports this coaching format for '+mission.behaviourLabel+'. OP CLIMB will still keep checking it over time.'};
  }
  const underTest=stats.filter(item=>item.observedGames<2).sort((a,b)=>a.observedGames-b.observedGames||a.frozenGames-b.frozenGames||METHODS.indexOf(a.method)-METHODS.indexOf(b.method));
  if(underTest.length){
    const defaultMethod=stageDefault(mission,eligible);
    const least=underTest.filter(item=>item.observedGames===underTest[0].observedGames&&item.frozenGames===underTest[0].frozenGames);
    const chosen=least.find(item=>item.method===defaultMethod)??least[0];
    return{method:chosen.method,mode:'EXPLORE' as const,reason:'Coach Twin needs repeated observed tests across more than one coaching format before it can prefer a delivery method.'};
  }
  return{method:stageDefault(mission,eligible),mode:'STAGE_DEFAULT' as const,reason:'No coaching format has a clear evidence-backed edge yet, so OP CLIMB is using the format that best fits this Rep Ladder stage.'};
}
function interventionCopy(method:ClimbCoachMethod,mission:ClimbMatchMission){
  const enemies=mission.relevantEnemies.slice(0,3).join(' + ');
  if(method==='CONTRAST_BRANCH')return{
    title:'OLD BRANCH → NEW BRANCH',
    primaryCue:'OLD: ACT BEFORE THE TRIGGER IS TRUE. NEW: '+mission.action,
    secondaryPrompt:'What must be true before you leave the old branch? '+mission.trigger,
  };
  if(method==='THREAT_ANCHOR')return{
    title:'THREAT ANCHOR',
    primaryCue:(enemies?'TRACK '+enemies+'. ':'TRACK THE ACCESS THREAT. ')+mission.trigger+' → '+mission.action,
    secondaryPrompt:enemies?'Which of '+enemies+' still has access before you move forward?':mission.rehearsalQuestion,
  };
  if(method==='SELF_EXPLAIN')return{
    title:'SELF-EXPLAIN',
    primaryCue:mission.rehearsalQuestion,
    secondaryPrompt:'Your answer must preserve this branch: '+mission.action,
  };
  return{
    title:'WHEN → THEN',
    primaryCue:'WHEN '+mission.trigger+' → THEN '+mission.action,
    secondaryPrompt:null,
  };
}

function lightInterventionCopy(method:ClimbCoachMethod,mission:ClimbMatchMission){
  const enemies=mission.relevantEnemies.slice(0,2).join(' + ');
  if(method==='CONTRAST_BRANCH')return{
    title:'REINFORCE · NEW BRANCH',
    primaryCue:'NEW BRANCH · '+mission.action,
    secondaryPrompt:null,
  };
  if(method==='THREAT_ANCHOR')return{
    title:'REINFORCE · THREAT ANCHOR',
    primaryCue:(enemies?'TRACK '+enemies+' · ':'TRACK ACCESS · ')+mission.action,
    secondaryPrompt:null,
  };
  if(method==='SELF_EXPLAIN')return{
    title:'REINFORCE · SELF-CHECK',
    primaryCue:'CHECK · '+mission.rehearsalQuestion,
    secondaryPrompt:null,
  };
  return{
    title:'REINFORCE · WHEN → THEN',
    primaryCue:'WHEN '+mission.trigger+' → '+mission.action,
    secondaryPrompt:null,
  };
}

export function selectClimbCoachIntervention(input:{
  twin:ClimbCoachTwin;
  mission:ClimbMatchMission|null|undefined;
  situationContext?:DraftSituationContext|null;
  deliveryPolicy?:ClimbCoachDeliveryPolicy|'NONE';
  forcedMethod?:ClimbCoachMethod|null;
  forcedReason?:string|null;
  forcedSelectionMode?:'CAUSAL_ROUTE'|'LEARNING_VELOCITY'|null;
}):ClimbCoachIntervention|null{
  const mission=input.mission;
  const deliveryPolicy=input.deliveryPolicy??'FULL';
  if(!mission||mission.status!=='READY'||deliveryPolicy==='NONE')return null;
  const baseSelected=chooseMethod(input.twin,mission);
  const selected=input.forcedMethod
    ?{method:input.forcedMethod,mode:input.forcedSelectionMode??'CAUSAL_ROUTE',reason:input.forcedReason||'An evidence-gated coaching policy selected this coaching format.'}
    :deliveryPolicy==='DIAGNOSTIC'&&baseSelected.mode!=='RETEST'
      ?{method:'SELF_EXPLAIN' as ClimbCoachMethod,mode:'DIAGNOSTIC' as const,reason:'Coaching Strategy is diagnosing whether the player recognises the branch before adding more instruction or difficulty.'}
      :baseSelected;
  const copy=deliveryPolicy==='LIGHT'?lightInterventionCopy(selected.method,mission):interventionCopy(selected.method,mission);
  const profile=profileFor(input.twin,mission.behaviourKey);
  return{
    version:1,
    id:['coach-intervention',mission.id,selected.method].join(':').toLowerCase(),
    missionId:mission.id,
    behaviourKey:mission.behaviourKey,
    behaviourLabel:mission.behaviourLabel,
    targetTag:mission.targetTag,
    method:selected.method,
    selectionMode:selected.mode,
    deliveryPolicy,
    methodLabel:METHOD_LABELS[selected.method],
    title:copy.title,
    primaryCue:copy.primaryCue,
    secondaryPrompt:copy.secondaryPrompt,
    whyThisMethod:selected.reason,
    frozenEvidence:profile?.evidence??'No prior coaching-format preference exists for this behaviour yet.',
    relevantEnemies:mission.relevantEnemies,
    source:'CLIMB_COACH_TWIN',
    boundary:BOUNDARY,
  };
}

export function reviewClimbCoachIntervention(
  intervention:ClimbCoachIntervention|null|undefined,
  missionReview:ClimbMatchMissionReview,
):ClimbCoachInterventionReview{
  if(!intervention){
    return{
      version:1,active:false,interventionId:null,missionId:missionReview.missionId,behaviourKey:missionReview.behaviourKey,
      behaviourLabel:missionReview.behaviourLabel,targetTag:missionReview.targetTag,method:null,methodLabel:null,selectionMode:null,deliveryPolicy:null,
      status:'NO_INTERVENTION',matchedMoments:0,cleanMoments:0,improveMoments:0,responseScore:null,
      note:'No frozen Coach Twin intervention was attached to this match mission.',boundary:REVIEW_BOUNDARY,
    };
  }
  const status:ClimbCoachReviewStatus=missionReview.status==='EXECUTED'
    ?'EXECUTED'
    :missionReview.status==='MISSED'
      ?'MISSED'
      :missionReview.status==='MIXED'
        ?'MIXED'
        :'NOT_OBSERVED';
  const responseScore=status==='NOT_OBSERVED'?null:missionReview.matchedMoments?Math.round(missionReview.cleanMoments/missionReview.matchedMoments*100):null;
  return{
    version:1,
    active:true,
    interventionId:intervention.id,
    missionId:intervention.missionId,
    behaviourKey:intervention.behaviourKey,
    behaviourLabel:intervention.behaviourLabel,
    targetTag:intervention.targetTag,
    method:intervention.method,
    methodLabel:intervention.methodLabel,
    selectionMode:intervention.selectionMode,
    deliveryPolicy:intervention.deliveryPolicy,
    status,
    matchedMoments:missionReview.matchedMoments,
    cleanMoments:missionReview.cleanMoments,
    improveMoments:missionReview.improveMoments,
    responseScore,
    note:status==='NOT_OBSERVED'
      ?'The frozen coaching format is not scored because the target decision did not produce a verified comparable moment.'
      :status==='EXECUTED'
        ?intervention.methodLabel+' was followed in every verified matching mission moment. This is response evidence, not proof the wording caused execution.'
        :status==='MISSED'
          ?intervention.methodLabel+' was attached to a mission that was missed in every verified matching moment. One game does not make the method ineffective.'
          :'The frozen coaching format produced mixed verified response in this match.',
    boundary:REVIEW_BOUNDARY,
  };
}

export const CLIMB_COACH_TWIN_BOUNDARY=BOUNDARY;
