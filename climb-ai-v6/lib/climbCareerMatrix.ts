import type {DecisionBehaviourKey,DecisionTwinConfidence} from './decisionTwin';
import type {DecisionTwinV2Profile} from './decisionTwinV2';
import type {ScenarioMemoryProfile,ScenarioMemoryCard} from './scenarioMemory';
import type {DecisionTransferProfile,DecisionTransferCard} from './decisionTransfer';

export type CareerMatrixState='LOCKED'|'CANDIDATE'|'ACTIVE'|'REINFORCING'|'TRANSFER_TEST'|'MASTERED'|'DORMANT';
export type CareerMatrixSelectionMode='START'|'HOLD'|'REGRESSION_OVERRIDE'|'COMPLETE';

export interface CareerMatrixSignal{
  key:DecisionBehaviourKey;
  label:string;
  currentScore:number;
  severity:number;
  recurrence:number;
  impact:number;
  prioritySignal:number;
  confidence:DecisionTwinConfidence;
  regressionRisk:number;
  locallyMastered:boolean;
  transferStrength:number;
  principleOwned:boolean;
  strictPrerequisite:DecisionBehaviourKey|null;
  prerequisiteSatisfied:boolean;
  evidence:string;
}

export interface CareerMatrixCandidate extends CareerMatrixSignal{
  state:CareerMatrixState;
  downstreamSkills:DecisionBehaviourKey[];
  rootCauseLeverage:number;
  trainabilityNow:number;
  noveltyNeed:number;
  curriculumDebt:number;
  coachingExposureGames:number;
  developmentLeverage:number;
  priorityScore:number;
  whyNow:string;
  deferredReason:string|null;
}

export interface ClimbCareerMatrix{
  version:1;
  generatedAt:string;
  gamesAnalyzed:number;
  recommendedSkill:DecisionBehaviourKey|null;
  selectionMode:CareerMatrixSelectionMode;
  recommendationReason:string;
  candidates:CareerMatrixCandidate[];
  deferred:CareerMatrixCandidate[];
  boundary:string;
}

export interface CareerMatrixRankOptions{
  generatedAt?:string;
  gamesAnalyzed?:number;
  activeBehaviourKey?:DecisionBehaviourKey|null;
  previous?:ClimbCareerMatrix|null;
}

const LABELS:Record<DecisionBehaviourKey,string>={
  FIGHT_SELECTION:'Fight Selection',
  DEATH_RECOVERY:'Recovery After Death',
  LEAD_PROTECTION:'Lead Protection',
  RESET_DISCIPLINE:'Reset Discipline',
  OBJECTIVE_READINESS:'Objective Arrival',
  FARM_VS_SETUP:'Farm vs Setup',
  THREAT_ADAPTATION:'Threat Adaptation',
  CARRY_PRESERVATION:'Carry Preservation',
  POWER_SPIKE_CONVERSION:'Power-Spike Conversion',
  SURVIVAL_VALUE:'Survival Value',
};

const IMPACT:Record<DecisionBehaviourKey,number>={
  FIGHT_SELECTION:88,
  DEATH_RECOVERY:82,
  LEAD_PROTECTION:84,
  RESET_DISCIPLINE:80,
  OBJECTIVE_READINESS:86,
  FARM_VS_SETUP:78,
  THREAT_ADAPTATION:84,
  CARRY_PRESERVATION:90,
  POWER_SPIKE_CONVERSION:86,
  SURVIVAL_VALUE:88,
};

export const CAREER_MATRIX_PREREQUISITE:Partial<Record<DecisionBehaviourKey,DecisionBehaviourKey>>={
  OBJECTIVE_READINESS:'FARM_VS_SETUP',
  LEAD_PROTECTION:'FIGHT_SELECTION',
  POWER_SPIKE_CONVERSION:'RESET_DISCIPLINE',
  CARRY_PRESERVATION:'THREAT_ADAPTATION',
  SURVIVAL_VALUE:'CARRY_PRESERVATION',
};

export const CAREER_MATRIX_DEPENDENCIES:Partial<Record<DecisionBehaviourKey,Partial<Record<DecisionBehaviourKey,number>>>>={
  THREAT_ADAPTATION:{FIGHT_SELECTION:.9,CARRY_PRESERVATION:1,SURVIVAL_VALUE:.55},
  FIGHT_SELECTION:{LEAD_PROTECTION:.85},
  RESET_DISCIPLINE:{POWER_SPIKE_CONVERSION:1},
  FARM_VS_SETUP:{OBJECTIVE_READINESS:1},
  CARRY_PRESERVATION:{SURVIVAL_VALUE:.9},
};

const BOUNDARY='Multi-Skill Career Matrix prioritises evidence-backed development leverage, not raw mistake count. Dependency edges are coaching hypotheses, not universal causal claims: a skill only gains root-cause leverage when the downstream weakness is also observed. Low-evidence one-offs remain dormant, prerequisites stay locked, and local mastery still requires transfer evidence before principle ownership.';

function clamp(value:number,min=0,max=100){return Math.max(min,Math.min(max,Math.round(value)))}
function confidenceWeight(value:DecisionTwinConfidence){return value==='HIGH'?1:value==='MEDIUM'?0.72:0.45}
function memoryScore(card:ScenarioMemoryCard|null){
  if(!card)return 55;
  if(card.state==='MASTERED')return 88;
  if(card.state==='STABILISING')return 72;
  if(card.state==='LEARNING')return 58;
  if(card.state==='DUE')return 46;
  if(card.state==='REGRESSED')return 42;
  return 55;
}
function bestMemory(memory:ScenarioMemoryProfile,key:DecisionBehaviourKey){
  const weight=(card:ScenarioMemoryCard)=>card.state==='REGRESSED'?7:card.state==='DUE'?6:card.state==='LEARNING'?5:card.state==='STABILISING'?4:card.state==='MASTERED'?3:1;
  return memory.cards
    .filter(card=>card.behaviourKey===key)
    .sort((a,b)=>weight(b)-weight(a)||b.comparableGames-a.comparableGames||b.memoryStrength-a.memoryStrength)[0]??null;
}
function transferCard(transfer:DecisionTransferProfile,key:DecisionBehaviourKey){
  return transfer.cards.find(card=>card.behaviourKey===key)??null;
}
function stable(memory:ScenarioMemoryProfile,transfer:DecisionTransferProfile,key:DecisionBehaviourKey){
  const tx=transferCard(transfer,key);
  if(tx?.state==='PRINCIPLE_OWNED')return true;
  return bestMemory(memory,key)?.state==='MASTERED';
}
function recurrenceFor(card:ScenarioMemoryCard|null,confidence:DecisionTwinConfidence,gamesAnalyzed:number){
  if(card)return clamp(card.comparableGames*12.5);
  if(confidence==='HIGH')return clamp(Math.min(gamesAnalyzed,8)*12.5);
  if(confidence==='MEDIUM')return clamp(Math.min(gamesAnalyzed,5)*12.5);
  return 0;
}
function noveltyFor(signal:CareerMatrixSignal){
  if(signal.principleOwned)return 0;
  return signal.locallyMastered?clamp(100-signal.transferStrength):0;
}
function stateFor(input:{signal:CareerMatrixSignal;rootCauseLeverage:number;curriculumDebt:number;active:boolean}):CareerMatrixState{
  const {signal,rootCauseLeverage,curriculumDebt,active}=input;
  if(signal.principleOwned)return'MASTERED';
  if(!signal.prerequisiteSatisfied)return'LOCKED';
  if(signal.locallyMastered)return'TRANSFER_TEST';
  if(active)return'ACTIVE';
  if(signal.regressionRisk>=70)return'REINFORCING';
  if(signal.confidence==='LOW'&&signal.recurrence<25&&rootCauseLeverage<30&&curriculumDebt<20)return'DORMANT';
  return'CANDIDATE';
}
function rootCauseFor(signal:CareerMatrixSignal,byKey:Map<DecisionBehaviourKey,CareerMatrixSignal>){
  const edges=CAREER_MATRIX_DEPENDENCIES[signal.key]??{};
  let weighted=0,totalWeight=0;
  const downstreamSkills:DecisionBehaviourKey[]=[];
  for(const [rawKey,rawWeight] of Object.entries(edges)){
    const key=rawKey as DecisionBehaviourKey;
    const downstream=byKey.get(key);
    if(!downstream||downstream.principleOwned)continue;
    const weight=Number(rawWeight)||0;
    const need=downstream.severity*confidenceWeight(downstream.confidence);
    if(need<=0)continue;
    weighted+=need*weight;
    totalWeight+=weight;
    downstreamSkills.push(key);
  }
  return{
    downstreamSkills,
    rootCauseLeverage:totalWeight?clamp(weighted/totalWeight):0,
  };
}
function debtFor(signal:CareerMatrixSignal,previous:CareerMatrixCandidate|null,newGame:boolean,active:boolean){
  if(signal.principleOwned)return 0;
  const prior=previous?.curriculumDebt??0;
  if(!newGame)return prior;
  if(active)return clamp(prior-12);
  if(!signal.prerequisiteSatisfied)return prior;
  if(signal.confidence==='LOW'&&signal.recurrence<25)return prior;
  return clamp(prior+4+signal.recurrence*.04+signal.severity*.03);
}
function exposureFor(previous:CareerMatrixCandidate|null,newGame:boolean,active:boolean){
  const prior=previous?.coachingExposureGames??0;
  if(!newGame)return prior;
  return active?prior+1:0;
}
function whyNow(candidate:CareerMatrixCandidate){
  if(candidate.state==='LOCKED'&&candidate.strictPrerequisite)return LABELS[candidate.strictPrerequisite]+' is not stable enough yet, so this skill stays locked.';
  if(candidate.state==='TRANSFER_TEST')return'Local execution is stable, but transfer is not owned. Test the principle under a genuinely different champion or pressure pattern before moving on.';
  if(candidate.regressionRisk>=70)return'Comparable evidence has worsened again, so this skill needs reinforcement before the system adds more complexity.';
  if(candidate.curriculumDebt>=40)return'This is a legitimate recurring weakness that has been deferred long enough to deserve renewed coaching attention.';
  if(candidate.rootCauseLeverage>=45&&candidate.downstreamSkills.length){
    return'This skill sits upstream of '+candidate.downstreamSkills.map(key=>LABELS[key]).join(', ')+' and has enough evidence to offer higher development leverage than coaching the symptoms separately.';
  }
  return'This is the highest evidence-backed combination of severity, recurrence, game impact and trainability available now.';
}
function deferredReason(candidate:CareerMatrixCandidate,recommended:CareerMatrixCandidate|null){
  if(candidate.state==='LOCKED'&&candidate.strictPrerequisite)return'Locked behind '+LABELS[candidate.strictPrerequisite]+'.';
  if(candidate.state==='MASTERED')return'Principle owned; keep on maintenance rather than spending the active coaching slot.';
  if(candidate.state==='DORMANT')return'Observed, but evidence is too weak to spend the active coaching slot yet.';
  if(!recommended)return null;
  if(candidate.key===recommended.key)return null;
  if(candidate.priorityScore+8<recommended.priorityScore)return'Real weakness, but lower current development leverage than '+recommended.label+'.';
  return'Keep in the queue while '+recommended.label+' owns the single active development slot.';
}

export function rankCareerMatrixSignals(signals:CareerMatrixSignal[],options:CareerMatrixRankOptions={}):ClimbCareerMatrix{
  const generatedAt=options.generatedAt??new Date().toISOString();
  const gamesAnalyzed=Math.max(0,Math.floor(options.gamesAnalyzed??0));
  const activeBehaviourKey=options.activeBehaviourKey??null;
  const previous=options.previous??null;
  const byKey=new Map(signals.map(signal=>[signal.key,signal]));
  const previousByKey=new Map((previous?.candidates??[]).map(candidate=>[candidate.key,candidate]));
  const newGame=!previous||gamesAnalyzed>previous.gamesAnalyzed;

  const candidates=signals.map(signal=>{
    const active=activeBehaviourKey===signal.key;
    const root=rootCauseFor(signal,byKey);
    const prior=previousByKey.get(signal.key)??null;
    const curriculumDebt=debtFor(signal,prior,newGame,active);
    const coachingExposureGames=exposureFor(prior,newGame,active);
    const noveltyNeed=noveltyFor(signal);
    const trainabilityNow=clamp(
      confidenceWeight(signal.confidence)*55+
      signal.recurrence*.25+
      (signal.prerequisiteSatisfied?20:0)
    );
    const developmentLeverage=clamp(
      signal.impact*.25+
      root.rootCauseLeverage*.45+
      signal.severity*.2+
      curriculumDebt*.1
    );
    let priorityScore=
      signal.severity*.22+
      signal.recurrence*.13+
      signal.impact*.14+
      root.rootCauseLeverage*.24+
      trainabilityNow*.08+
      signal.prioritySignal*.09+
      curriculumDebt*.06+
      signal.regressionRisk*.04+
      noveltyNeed*.04+
      (signal.locallyMastered&&!signal.principleOwned&&(active||signal.prioritySignal>0||signal.transferStrength>0)?8:0)+
      (active?6:0);
    if(signal.confidence==='LOW'&&root.rootCauseLeverage<25&&curriculumDebt<20)priorityScore-=18;
    if(!signal.prerequisiteSatisfied)priorityScore-=40;
    if(signal.principleOwned)priorityScore=0;
    const state=stateFor({signal,rootCauseLeverage:root.rootCauseLeverage,curriculumDebt,active});
    const candidate:CareerMatrixCandidate={
      ...signal,
      state,
      downstreamSkills:root.downstreamSkills,
      rootCauseLeverage:root.rootCauseLeverage,
      trainabilityNow,
      noveltyNeed,
      curriculumDebt,
      coachingExposureGames,
      developmentLeverage,
      priorityScore:clamp(priorityScore),
      whyNow:'',
      deferredReason:null,
    };
    candidate.whyNow=whyNow(candidate);
    return candidate;
  }).sort((a,b)=>
    b.priorityScore-a.priorityScore||
    b.developmentLeverage-a.developmentLeverage||
    b.rootCauseLeverage-a.rootCauseLeverage||
    b.severity-a.severity||
    a.label.localeCompare(b.label)
  );

  const eligible=candidates.filter(candidate=>!['LOCKED','MASTERED','DORMANT'].includes(candidate.state));
  const top=eligible[0]??null;
  const activeCandidate=activeBehaviourKey
    ?eligible.find(candidate=>candidate.key===activeBehaviourKey)??null
    :null;
  const regressionOverride=activeCandidate
    ?eligible.find(candidate=>
      candidate.key!==activeCandidate.key&&
      candidate.regressionRisk>=90&&
      candidate.priorityScore>=activeCandidate.priorityScore+3
    )??null
    :null;
  const recommended=activeCandidate
    ?regressionOverride??activeCandidate
    :top;
  const selectionMode:CareerMatrixSelectionMode=!recommended
    ?'COMPLETE'
    :regressionOverride
      ?'REGRESSION_OVERRIDE'
      :activeCandidate
        ?'HOLD'
        :'START';
  const recommendationReason=selectionMode==='HOLD'&&recommended
    ?'Keep coaching '+recommended.label+' until its current ownership gate is complete. A different weakness must show verified regression, not merely a slightly higher score, to steal the active development slot.'
    :selectionMode==='REGRESSION_OVERRIDE'&&recommended
      ?recommended.label+' has verified regression strong enough to interrupt the current learning contract.'
      :recommended
        ?recommended.whyNow
        :'No skill currently has enough unlocked evidence to justify owning the active coaching slot.';
  if(recommended&&selectionMode==='HOLD')recommended.whyNow=recommendationReason;
  for(const candidate of candidates)candidate.deferredReason=deferredReason(candidate,recommended);

  return{
    version:1,
    generatedAt,
    gamesAnalyzed,
    recommendedSkill:recommended?.key??null,
    selectionMode,
    recommendationReason,
    candidates,
    deferred:candidates.filter(candidate=>candidate.key!==recommended?.key&&candidate.state!=='MASTERED'),
    boundary:BOUNDARY,
  };
}

export function buildClimbCareerMatrix(
  twin:DecisionTwinV2Profile,
  memory:ScenarioMemoryProfile,
  transfer:DecisionTransferProfile,
  options:CareerMatrixRankOptions={},
):ClimbCareerMatrix{
  const keys=new Set<DecisionBehaviourKey>();
  for(const item of twin.activeFive)keys.add(item.key);
  for(const card of memory.cards.filter(card=>card.state!=='BUILDING'))keys.add(card.behaviourKey);
  for(const card of transfer.cards)keys.add(card.behaviourKey);

  const expanded=[...keys];
  for(const key of expanded){
    const prerequisite=CAREER_MATRIX_PREREQUISITE[key];
    if(prerequisite&&!stable(memory,transfer,prerequisite))keys.add(prerequisite);
  }

  const signals:CareerMatrixSignal[]=[...keys].map(key=>{
    const focus=twin.activeFive.find(item=>item.key===key)??null;
    const mem=bestMemory(memory,key);
    const tx=transferCard(transfer,key);
    const confidence=focus?.confidence??mem?.confidence??tx?.confidence??'LOW';
    const currentScore=clamp(focus?.currentScore??memoryScore(mem));
    const strictPrerequisite=CAREER_MATRIX_PREREQUISITE[key]??null;
    return{
      key,
      label:LABELS[key],
      currentScore,
      severity:clamp(100-currentScore),
      recurrence:recurrenceFor(mem,confidence,twin.gamesAnalyzed),
      impact:IMPACT[key],
      prioritySignal:clamp(focus?.priority??0),
      confidence,
      regressionRisk:mem?.state==='REGRESSED'?100:focus?.trend==='WORSENING'?75:tx?.state==='REGRESSED'?90:0,
      locallyMastered:mem?.state==='MASTERED'||tx?.state==='LOCAL_ONLY'||tx?.state==='TESTING'||tx?.state==='TRANSFERRING'||tx?.state==='GENERALISING'||tx?.state==='PRINCIPLE_OWNED',
      transferStrength:clamp(tx?.transferStrength??0),
      principleOwned:tx?.state==='PRINCIPLE_OWNED',
      strictPrerequisite,
      prerequisiteSatisfied:strictPrerequisite?stable(memory,transfer,strictPrerequisite):true,
      evidence:mem?.evidence??tx?.evidence??focus?.evidence??'Foundation skill inferred from a verified downstream prerequisite.',
    };
  });

  return rankCareerMatrixSignals(signals,{
    ...options,
    gamesAnalyzed:twin.gamesAnalyzed,
  });
}

export const CLIMB_CAREER_MATRIX_BOUNDARY=BOUNDARY;
