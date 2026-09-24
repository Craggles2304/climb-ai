import {
  buildDecisionTwin,
  type DecisionBehaviourKey,
  type DecisionPatternState,
  type DecisionSituationTag,
  type DecisionTwinConfidence,
  type DecisionTwinProfile,
  type DecisionTwinState,
} from './decisionTwin';
import type {HistoryAnalysisRow,ProTrend} from './riot/proHistory';
import type {LearningPatchContext} from './patchIntelligence';

export type DecisionArchetypeKind='RISK'|'STRENGTH';
export type DecisionContextState='BUILDING'|'RISK'|'IMPROVING'|'MASTERED'|'REGRESSING';
export type ActiveFiveState='FIX_NOW'|'TRAIN'|'PROVE'|'REOPEN'|'MAINTAIN';

export interface DecisionTwinArchetype{
  key:DecisionBehaviourKey;
  kind:DecisionArchetypeKind;
  label:string;
  behaviourLabel:string;
  confidence:DecisionTwinConfidence;
  score:number;
  recentScore:number|null;
  applicableGames:number;
  trend:ProTrend;
  state:DecisionTwinState;
  explanation:string;
  evidence:string;
}

export interface DecisionContextProfile{
  tag:DecisionSituationTag;
  label:string;
  state:DecisionContextState;
  confidence:DecisionTwinConfidence;
  observations:number;
  failures:number;
  failureRate:number|null;
  recentObservations:number;
  recentFailures:number;
  recentFailureRate:number|null;
  behaviours:DecisionBehaviourKey[];
  behaviourLabels:string[];
  summary:string;
}

export interface DecisionTwinTargetMetric{
  key:DecisionBehaviourKey;
  label:string;
  currentScore:number;
  targetScore:number;
  gap:number;
  confidence:DecisionTwinConfidence;
  status:ActiveFiveState;
}

export interface DecisionTwinTarget{
  label:'NEXT TWIN';
  currentAverage:number|null;
  targetAverage:number|null;
  metrics:DecisionTwinTargetMetric[];
  rule:string;
}

export interface DecisionTwinActiveFocus{
  rank:1|2|3|4|5;
  key:DecisionBehaviourKey;
  label:string;
  status:ActiveFiveState;
  priority:number;
  confidence:DecisionTwinConfidence;
  currentScore:number;
  targetScore:number;
  trend:ProTrend;
  state:DecisionTwinState;
  situationTag:DecisionSituationTag|null;
  reason:string;
  rule:string;
  evidence:string;
}

export interface DecisionTwinChallenge{
  id:string;
  matchAt:string;
  minuteLabel:string;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  situation:string;
  actual:string;
  alternative:string;
  whyBetter:string;
  tradeoff:string;
  confidence:'HIGH'|'MEDIUM'|'LOW';
  twinTendency:'ACTUAL'|'ALTERNATIVE'|'UNKNOWN';
  twinEvidence:string;
  outcomeBoundary:string;
}

export interface DecisionTwinRiskLedger{
  frozenRiskMaps:number;
  forecastRisks:number;
  observedRisks:number;
  hitRisks:number;
  beatenRisks:number;
  mixedRisks:number;
  unobservedRisks:number;
  observedRate:number|null;
  hitShare:number|null;
  beatShare:number|null;
  boundary:string;
}

export interface DecisionTwinV2Profile{
  version:2;
  baseVersion:DecisionTwinProfile['version'];
  generatedAt:string;
  gamesAnalyzed:number;
  identity:{
    status:'BUILDING'|'READY';
    headline:string;
    summary:string;
    confidence:DecisionTwinConfidence;
    primary:DecisionTwinArchetype|null;
    strongest:DecisionTwinArchetype|null;
  };
  archetypes:DecisionTwinArchetype[];
  contextProfiles:DecisionContextProfile[];
  activeFive:DecisionTwinActiveFocus[];
  targetTwin:DecisionTwinTarget;
  riskLedger:DecisionTwinRiskLedger;
  challenge:DecisionTwinChallenge|null;
  patchContext?:LearningPatchContext;
}

const ARCHETYPE:Record<DecisionBehaviourKey,{risk:string;strength:string;explanation:string;rule:string}>={
  FIGHT_SELECTION:{
    risk:'THE FIGHT INHERITOR',
    strength:'THE FIGHT SELECTOR',
    explanation:'Whether first contact makes the decision for you, or you wait for a fight that matches the visible state.',
    rule:'DO NOT LET FIRST CONTACT CHOOSE THE FIGHT. ENTER ONLY WHEN NUMBERS, POSITION OR YOUR PLANNED TRIGGER ARE TRUE.',
  },
  DEATH_RECOVERY:{
    risk:'THE FAST RE-ENTRY',
    strength:'THE RESETTER',
    explanation:'How reliably you break the second-death cycle after a lost exchange or death.',
    rule:'AFTER A DEATH, REBUILD RESOURCES AND INFORMATION BEFORE THE NEXT CONTESTED ACTION.',
  },
  LEAD_PROTECTION:{
    risk:'THE LEAD ACCELERATOR',
    strength:'THE LEAD CONVERTER',
    explanation:'Whether a lead becomes controlled objective pressure or permission to take a harder fight.',
    rule:'WHEN AHEAD, CONVERT CONTROL. MAKE THEM ENTER YOUR SETUP INSTEAD OF CHASING EXTRA RISK.',
  },
  RESET_DISCIPLINE:{
    risk:'THE UNSPENT ADVANTAGE',
    strength:'THE POWER BANKER',
    explanation:'Whether earned gold becomes combat power before voluntary fights and major windows.',
    rule:'IF YOUR BANK COMPLETES REAL POWER, SPEND BEFORE YOU VOLUNTEER FOR THE FIGHT.',
  },
  OBJECTIVE_READINESS:{
    risk:'THE REACTIVE ARRIVER',
    strength:'THE FIRST ARRIVAL',
    explanation:'Whether you reach important space early enough to shape the objective rather than react to it.',
    rule:'LEAVE THE LAST LOW-VALUE RESOURCE IF TAKING IT MAKES YOU SECOND TO THE IMPORTANT SPACE.',
  },
  FARM_VS_SETUP:{
    risk:'THE EXTRA-WAVE PULL',
    strength:'THE TEMPO TRADER',
    explanation:'How well you trade one more resource for the value of arriving to the connected team action.',
    rule:'IF THE EXTRA WAVE OR CAMP MAKES YOU SECOND TO THE REAL WINDOW, CONNECT FIRST AND FARM AFTER.',
  },
  THREAT_ADAPTATION:{
    risk:'THE REPEAT-THREAT LOOP',
    strength:'THE ADAPTER',
    explanation:'Whether your positioning changes after an enemy has already shown how they can punish you.',
    rule:'AFTER A THREAT SHOWS ITS PATTERN ONCE, CHANGE YOUR POSITION OR ENTRY BEFORE THE NEXT REP.',
  },
  CARRY_PRESERVATION:{
    risk:'THE THREAT-LINE CROSSER',
    strength:'THE UPTIME CARRY',
    explanation:'Whether you preserve high-value damage uptime or cross the threat line for a lower-value target.',
    rule:'FIRST ENGAGE DOES NOT MEAN WALK FORWARD. KEEP THE SAFE DAMAGE LINE AND HIT THE CLOSEST SAFE TARGET.',
  },
  POWER_SPIKE_CONVERSION:{
    risk:'THE DELAYED SPIKE',
    strength:'THE SPIKE CONVERTER',
    explanation:'Whether completed item and level windows turn into timely pressure before the opponent neutralises them.',
    rule:'WHEN THE REAL SPIKE COMPLETES, CONNECT TO THE NEXT PRESSURE WINDOW BEFORE DRIFTING BACK INTO FARM.',
  },
  SURVIVAL_VALUE:{
    risk:'THE HIGH-VALUE RISK TAKER',
    strength:'THE SURVIVAL ANCHOR',
    explanation:'Whether you preserve your life when your continued presence has disproportionate fight or objective value.',
    rule:'WHEN YOUR LIFE HOLDS HIGH TEAM VALUE, SURVIVAL OUTRANKS ACCESS TO A LOWER-VALUE TARGET.',
  },
};

const CONTEXT_LABELS:Record<DecisionSituationTag,string>={
  MULTI_ACCESS:'UNDER DIVE PRESSURE',
  PICK_PRESSURE:'AGAINST PICK',
  ZONE_OBJECTIVE:'AT OBJECTIVE CHOKES',
  SCALING_WINDOW:'ON SCALING WINDOWS',
  HIGH_BANK_FIGHT:'WITH GOLD UNSPENT',
  ENEMY_STRONG_FIGHT:'IN ENEMY-FAVOURED FIGHTS',
  LEAD_CONVERSION:'WHEN AHEAD',
  RECOVERY_WINDOW:'AFTER A SETBACK',
  FARM_SETUP_TRADEOFF:'FARM VS SETUP',
  HIGH_VALUE_CARRY:'AS A HIGH-VALUE CARRY',
  GENERAL:'GENERAL',
};

function round(value:number){return Math.round(value)}
function clamp(value:number,min=0,max=100){return Math.max(min,Math.min(max,round(value)))}
function avg(values:number[]){return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0}
function confidenceWeight(value:DecisionTwinConfidence){return value==='HIGH'?18:value==='MEDIUM'?10:4}
function stateWeight(value:DecisionTwinState){return value==='LIMITER'?26:value==='AT_RISK'?18:value==='MASTERED'?-18:value==='STRONG'?-8:0}
function patternStateWeight(value:DecisionPatternState){return value==='REGRESSING'?26:value==='ACTIVE'?22:value==='IMPROVING'?12:value==='MASTERED'?-18:0}
function contextStateWeight(value:DecisionContextState){return value==='REGRESSING'?5:value==='RISK'?4:value==='IMPROVING'?3:value==='MASTERED'?2:1}
function confidenceFrom(observations:number,games:number):DecisionTwinConfidence{return observations>=8&&games>=5?'HIGH':observations>=4&&games>=3?'MEDIUM':'LOW'}
function nextTarget(score:number){
  if(score<55)return 62;
  if(score<65)return 70;
  if(score<75)return 80;
  if(score<86)return 88;
  return Math.min(94,score+3);
}
function activeState(state:DecisionTwinState,trend:ProTrend):ActiveFiveState{
  if(trend==='WORSENING')return'REOPEN';
  if(state==='LIMITER')return'FIX_NOW';
  if(state==='AT_RISK')return'TRAIN';
  if(trend==='IMPROVING')return'PROVE';
  return'MAINTAIN';
}
function contextState(patterns:DecisionTwinProfile['situationPatterns']):DecisionContextState{
  if(patterns.some(pattern=>pattern.state==='REGRESSING'))return'REGRESSING';
  if(patterns.some(pattern=>pattern.state==='ACTIVE'))return'RISK';
  if(patterns.some(pattern=>pattern.state==='IMPROVING'))return'IMPROVING';
  if(patterns.some(pattern=>pattern.state==='MASTERED'))return'MASTERED';
  return'BUILDING';
}
function contextSummary(label:string,state:DecisionContextState,failureRate:number|null,recentFailureRate:number|null){
  const all=failureRate===null?'building':`${failureRate}%`;
  const recent=recentFailureRate===null?'building':`${recentFailureRate}%`;
  if(state==='REGRESSING')return`${label}: the recent failure rate has risen again (${recent}).`;
  if(state==='RISK')return`${label}: repeated evidence still marks this as a live risk window (${all} all-time, ${recent} recent).`;
  if(state==='IMPROVING')return`${label}: the pattern is improving (${all} all-time, ${recent} recent) but is not yet mastered.`;
  if(state==='MASTERED')return`${label}: this used to be a verified problem and the recent evidence is now clean enough to count as mastered.`;
  return`${label}: OP CLIMB is still collecting enough comparable decisions to make a strong claim.`;
}

function buildArchetypes(twin:DecisionTwinProfile):DecisionTwinArchetype[]{
  const patternByBehaviour=new Map<DecisionBehaviourKey,DecisionTwinProfile['situationPatterns'][number][]>();
  for(const pattern of twin.situationPatterns){
    const current=patternByBehaviour.get(pattern.behaviourKey)??[];
    current.push(pattern);
    patternByBehaviour.set(pattern.behaviourKey,current);
  }

  const risk=twin.behaviours
    .filter(item=>item.applicableGames>=3&&item.recentScore!==null)
    .filter(item=>item.state==='LIMITER'||item.state==='AT_RISK'||item.trend==='WORSENING')
    .map(item=>{
      const patterns=patternByBehaviour.get(item.key)??[];
      const patternBoost=patterns.reduce((best,pattern)=>Math.max(best,patternStateWeight(pattern.state)),0);
      const score=clamp((100-(item.recentScore??70))*.9+confidenceWeight(item.confidence)+stateWeight(item.state)+patternBoost+Math.min(12,item.applicableGames));
      return{
        key:item.key,
        kind:'RISK' as const,
        label:ARCHETYPE[item.key].risk,
        behaviourLabel:item.label,
        confidence:item.confidence,
        score,
        recentScore:item.recentScore,
        applicableGames:item.applicableGames,
        trend:item.trend,
        state:item.state,
        explanation:ARCHETYPE[item.key].explanation,
        evidence:`${item.confidence} confidence · ${item.applicableGames} measurable games · recent ${item.recentScore}/100 · ${item.evidenceCount} evidence points.`,
      };
    })
    .sort((a,b)=>b.score-a.score||b.applicableGames-a.applicableGames);

  const strength=twin.behaviours
    .filter(item=>item.applicableGames>=3&&item.recentScore!==null)
    .filter(item=>item.state==='STRONG'||item.state==='MASTERED')
    .map(item=>({
      key:item.key,
      kind:'STRENGTH' as const,
      label:ARCHETYPE[item.key].strength,
      behaviourLabel:item.label,
      confidence:item.confidence,
      score:clamp((item.recentScore??0)*.7+confidenceWeight(item.confidence)+Math.min(12,item.applicableGames)),
      recentScore:item.recentScore,
      applicableGames:item.applicableGames,
      trend:item.trend,
      state:item.state,
      explanation:ARCHETYPE[item.key].explanation,
      evidence:`${item.confidence} confidence · ${item.applicableGames} measurable games · recent ${item.recentScore}/100 · ${item.evidenceCount} evidence points.`,
    }))
    .sort((a,b)=>b.score-a.score||b.applicableGames-a.applicableGames);

  return[...risk.slice(0,3),...strength.slice(0,2)];
}

function buildContextProfiles(twin:DecisionTwinProfile):DecisionContextProfile[]{
  const tags=[...new Set(twin.situationPatterns.map(pattern=>pattern.tag).filter(tag=>tag!=='GENERAL'))];
  return tags.map(tag=>{
    const patterns=twin.situationPatterns.filter(pattern=>pattern.tag===tag);
    const observations=patterns.reduce((sum,pattern)=>sum+pattern.decisions,0);
    const failures=patterns.reduce((sum,pattern)=>sum+pattern.failures,0);
    const recentObservations=patterns.reduce((sum,pattern)=>sum+pattern.recentDecisions,0);
    const recentFailures=patterns.reduce((sum,pattern)=>sum+pattern.recentFailures,0);
    const games=Math.max(0,...patterns.map(pattern=>pattern.applicableGames));
    const state=contextState(patterns);
    const label=CONTEXT_LABELS[tag];
    const behaviourMap=new Map<DecisionBehaviourKey,string>();
    for(const pattern of patterns)behaviourMap.set(pattern.behaviourKey,pattern.behaviourLabel);
    const failureRate=observations?round(failures/observations*100):null;
    const recentFailureRate=recentObservations?round(recentFailures/recentObservations*100):null;
    return{
      tag,
      label,
      state,
      confidence:confidenceFrom(observations,games),
      observations,
      failures,
      failureRate,
      recentObservations,
      recentFailures,
      recentFailureRate,
      behaviours:[...behaviourMap.keys()],
      behaviourLabels:[...behaviourMap.values()],
      summary:contextSummary(label,state,failureRate,recentFailureRate),
    } satisfies DecisionContextProfile;
  }).sort((a,b)=>contextStateWeight(b.state)-contextStateWeight(a.state)||(b.recentFailureRate??-1)-(a.recentFailureRate??-1)||b.observations-a.observations);
}

function buildActiveFive(twin:DecisionTwinProfile):DecisionTwinActiveFocus[]{
  const patternByBehaviour=new Map<DecisionBehaviourKey,DecisionTwinProfile['situationPatterns'][number][]>();
  for(const pattern of twin.situationPatterns){
    const current=patternByBehaviour.get(pattern.behaviourKey)??[];
    current.push(pattern);
    patternByBehaviour.set(pattern.behaviourKey,current);
  }

  return twin.behaviours
    .filter(item=>item.applicableGames>=3&&item.recentScore!==null&&item.state!=='MASTERED')
    .map(item=>{
      const patterns=(patternByBehaviour.get(item.key)??[])
        .filter(pattern=>pattern.state!=='BUILDING')
        .sort((a,b)=>patternStateWeight(b.state)-patternStateWeight(a.state)||(b.recentFailureRate??-1)-(a.recentFailureRate??-1));
      const topPattern=patterns[0]??null;
      const priority=clamp(
        (100-(item.recentScore??70))*.85
        +confidenceWeight(item.confidence)
        +stateWeight(item.state)
        +(item.trend==='WORSENING'?18:item.trend==='IMPROVING'?8:0)
        +(topPattern?patternStateWeight(topPattern.state):0)
        +Math.min(10,item.applicableGames),
      );
      const targetScore=nextTarget(item.recentScore!);
      const status=activeState(item.state,item.trend);
      const reason=topPattern&&topPattern.state!=='MASTERED'
        ?`${topPattern.behaviourLabel} is showing in ${topPattern.tag.replaceAll('_',' ').toLowerCase()} situations: ${topPattern.failures}/${topPattern.decisions} comparable decisions need improvement.`
        :`${item.label} is at ${item.recentScore}/100 across ${item.applicableGames} measurable games (${item.trend.toLowerCase()}).`;
      return{
        key:item.key,
        label:item.label,
        status,
        priority,
        confidence:item.confidence,
        currentScore:item.recentScore!,
        targetScore,
        trend:item.trend,
        state:item.state,
        situationTag:topPattern?.tag??null,
        reason,
        rule:ARCHETYPE[item.key].rule,
        evidence:`${item.evidenceCount} evidence points · ${item.applicableGames} games${topPattern?` · ${topPattern.decisions} comparable context decisions`:''}.`,
      };
    })
    .sort((a,b)=>b.priority-a.priority||a.currentScore-b.currentScore)
    .slice(0,5)
    .map((item,index)=>({...item,rank:(index+1) as 1|2|3|4|5}));
}

function buildTargetTwin(activeFive:DecisionTwinActiveFocus[],twin:DecisionTwinProfile):DecisionTwinTarget{
  const established=twin.behaviours.filter(item=>item.applicableGames>=3&&item.recentScore!==null);
  const metrics=activeFive.map(item=>({
    key:item.key,
    label:item.label,
    currentScore:item.currentScore,
    targetScore:item.targetScore,
    gap:item.targetScore-item.currentScore,
    confidence:item.confidence,
    status:item.status,
  }));
  const currentAverage=established.length?round(avg(established.map(item=>item.recentScore!))):null;
  const targetAverage=metrics.length&&currentAverage!==null
    ?Math.min(94,round(currentAverage+avg(metrics.map(item=>item.gap))/Math.max(1,Math.min(3,metrics.length))))
    :currentAverage;
  return{
    label:'NEXT TWIN',
    currentAverage,
    targetAverage,
    metrics,
    rule:'THE TARGET TWIN IS THE NEXT REALISTIC VERSION OF THIS PLAYER, NOT CHALLENGER PERFECTION. TARGETS MOVE ONLY AFTER NEW EVIDENCE.',
  };
}

function buildChallenge(rows:HistoryAnalysisRow[],twin:DecisionTwinProfile):DecisionTwinChallenge|null{
  for(const row of [...rows].reverse()){
    const nodes=(((row.analysis as any)?.decisionGraph?.nodes??[]) as any[])
      .filter(node=>node?.counterfactual&&node?.verdict==='IMPROVE'&&node?.confidence!=='LOW')
      .sort((a,b)=>Number(b?.counterfactual?.priority||0)-Number(a?.counterfactual?.priority||0));
    const node=nodes[0];
    if(!node)continue;
    const cf=node.counterfactual;
    const tags=(Array.isArray(node.situationTags)?node.situationTags:[]) as DecisionSituationTag[];
    const patterns=twin.situationPatterns
      .filter(pattern=>pattern.behaviourKey===node.behaviourKey)
      .filter(pattern=>tags.includes(pattern.tag))
      .sort((a,b)=>b.decisions-a.decisions||(b.recentFailureRate??-1)-(a.recentFailureRate??-1));
    const pattern=patterns[0]??null;
    const behaviour=twin.behaviours.find(item=>item.key===node.behaviourKey)??null;
    let twinTendency:DecisionTwinChallenge['twinTendency']='UNKNOWN';
    let twinEvidence='Not enough repeated comparable evidence to claim what your Twin usually chooses here.';
    if(pattern&&pattern.decisions>=4){
      const recent=pattern.recentFailureRate??pattern.failureRate;
      if(pattern.state==='MASTERED'||recent<=30){
        twinTendency='ALTERNATIVE';
        twinEvidence=`Your current Twin has beaten this ${pattern.tag.replaceAll('_',' ').toLowerCase()} pattern in enough recent comparable decisions to lean toward the reviewed alternative (${pattern.recentSuccesses}/${pattern.recentDecisions} recent clean).`;
      }else if(recent>=50){
        twinTendency='ACTUAL';
        twinEvidence=`Your Twin has reproduced this ${pattern.tag.replaceAll('_',' ').toLowerCase()} risk in ${pattern.failures}/${pattern.decisions} comparable decisions (${pattern.failureRate}% all-time failure rate).`;
      }
    }else if(behaviour&&behaviour.applicableGames>=3&&behaviour.recentScore!==null){
      if(behaviour.recentScore<60){
        twinTendency='ACTUAL';
        twinEvidence=`${behaviour.label} is currently ${behaviour.recentScore}/100 across ${behaviour.applicableGames} measurable games, so the Twin still leans toward repeating the reviewed mistake.`;
      }else if(behaviour.recentScore>=75){
        twinTendency='ALTERNATIVE';
        twinEvidence=`${behaviour.label} is currently ${behaviour.recentScore}/100 across ${behaviour.applicableGames} measurable games, so the current Twin leans toward the cleaner branch.`;
      }
    }
    return{
      id:String(node.id||[row.createdAt,node.behaviourKey,node.minuteLabel].join(':')),
      matchAt:row.createdAt,
      minuteLabel:String(node.minuteLabel||''),
      behaviourKey:node.behaviourKey as DecisionBehaviourKey,
      behaviourLabel:String(node.behaviourLabel||node.behaviourKey),
      situation:String(node.situation||node.title||'A reviewed decision window appeared.'),
      actual:String(cf.actual||'Recorded decision'),
      alternative:String(cf.alternative||'Reviewed alternative'),
      whyBetter:String(cf.whyBetter||'The alternative better matched the recorded state and frozen coaching plan.'),
      tradeoff:String(cf.tradeoff||'The alternative still carries trade-offs and does not guarantee a better result.'),
      confidence:String(cf.confidence||node.confidence||'MEDIUM') as 'HIGH'|'MEDIUM'|'LOW',
      twinTendency,
      twinEvidence,
      outcomeBoundary:String(cf.outcomeBoundary||'This is a coaching alternative supported by the recorded state, not a guaranteed outcome.'),
    };
  }
  return null;
}

function buildRiskLedger(rows:HistoryAnalysisRow[]):DecisionTwinRiskLedger{
  let frozenRiskMaps=0,forecastRisks=0,observedRisks=0,hitRisks=0,beatenRisks=0,mixedRisks=0,unobservedRisks=0;
  for(const row of rows){
    const review=(row.analysis as any)?.decisionGraph?.summary?.premortem;
    if(!review?.active)continue;
    frozenRiskMaps++;
    forecastRisks+=Number(review.forecastCount||0);
    observedRisks+=Number(review.observedRisks||0);
    hitRisks+=Number(review.hitRisks||0);
    beatenRisks+=Number(review.beatenRisks||0);
    mixedRisks+=Number(review.mixedRisks||0);
    unobservedRisks+=Number(review.unobservedRisks||0);
  }
  return{
    frozenRiskMaps,
    forecastRisks,
    observedRisks,
    hitRisks,
    beatenRisks,
    mixedRisks,
    unobservedRisks,
    observedRate:forecastRisks?round(observedRisks/forecastRisks*100):null,
    hitShare:observedRisks?round(hitRisks/observedRisks*100):null,
    beatShare:observedRisks?round(beatenRisks/observedRisks*100):null,
    boundary:'UNOBSERVED RISK WINDOWS ARE NOT FAILURES. THE LEDGER ONLY SCORES RIOT-VISIBLE COMPARABLE DECISIONS THAT ACTUALLY OCCURRED.',
  };
}

export function buildDecisionTwinV2(rows:HistoryAnalysisRow[],generatedAt=new Date().toISOString(),patchContext?:LearningPatchContext):DecisionTwinV2Profile{
  const ordered=[...rows].filter(row=>row.analysis?.version===1).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-50);
  const twin=buildDecisionTwin(ordered,generatedAt);
  const archetypes=buildArchetypes(twin);
  const primary=archetypes.find(item=>item.kind==='RISK')??null;
  const strongest=archetypes.find(item=>item.kind==='STRENGTH')??null;
  const activeFive=buildActiveFive(twin);
  const identityStatus=ordered.length>=3&&(primary||strongest)?'READY':'BUILDING';
  const confidence:DecisionTwinConfidence=primary?.confidence??strongest?.confidence??'LOW';
  const headline=identityStatus==='BUILDING'
    ?'BUILDING YOUR DECISION IDENTITY'
    :primary?.label??strongest?.label??'BUILDING YOUR DECISION IDENTITY';
  const identitySummary=identityStatus==='BUILDING'
    ?'OP CLIMB will not name a player identity from too little evidence. Complete more fully tracked games.'
    :primary&&strongest
      ?`${primary.label} is the clearest current risk identity; ${strongest.label} is the strongest verified counterweight.`
      :primary
        ?`${primary.label} is the clearest current risk identity. It stays provisional until more comparable evidence arrives.`
        :`${strongest?.label??'A verified strength'} is currently the clearest established decision identity.`;
  const summary=patchContext&&patchContext.status==='CROSS_PATCH'
    ?identitySummary+' Patch-aware mode is active: Riot balance changes are treated as context, so cross-patch movement is not labelled as pure player improvement or regression.'
    :identitySummary;

  return{
    version:2,
    baseVersion:twin.version,
    generatedAt,
    gamesAnalyzed:ordered.length,
    identity:{status:identityStatus,headline,summary,confidence,primary,strongest},
    archetypes,
    contextProfiles:buildContextProfiles(twin),
    activeFive,
    targetTwin:buildTargetTwin(activeFive,twin),
    riskLedger:buildRiskLedger(ordered),
    challenge:buildChallenge(ordered,twin),
    patchContext,
  };
}
