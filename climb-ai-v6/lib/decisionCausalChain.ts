import type {GameReadCalibrationReview,GameReadCalibrationItem} from './gameReadCalibration';

export type CausalChainDiagnosis=
  |'MISREAD_COMPOUNDED'
  |'PRIORITY_DEVIATION'
  |'EXECUTION_GAP'
  |'MISREAD_RECOVERED'
  |'CLEAN_CHAIN'
  |'NOT_VERIFIABLE';

export type CausalPriorityAlignment='MATCHED'|'CONFLICTED'|'NOT_VERIFIABLE';
export type CausalCoachLayer='GAME_READ'|'FOLLOW_THROUGH'|'EXECUTION'|'RECOGNITION'|'AUTONOMY'|'EVIDENCE';

type NodeConfidence='HIGH'|'MEDIUM'|'LOW';
type NodeVerdict='GOOD'|'IMPROVE'|'NEUTRAL';
type NodeType='FIGHT'|'RESET'|'RECOVERY'|'OBJECTIVE'|'FARM'|'ADAPTATION'|'POWER_WINDOW'|'SURVIVAL';

export interface CausalDecisionNode{
  id:string;
  atSeconds:number;
  minuteLabel?:string|null;
  type:NodeType|string;
  behaviourKey?:string|null;
  behaviourLabel?:string|null;
  verdict:NodeVerdict|string;
  confidence:NodeConfidence|string;
  title?:string|null;
  decisionRead?:string|null;
  consequence?:string|null;
  evidence?:string[];
}

export interface DecisionCausalChainItem{
  version:1;
  checkpointMinute:number;
  readAtSeconds:number;
  decisionAtSeconds:number|null;
  delaySeconds:number|null;
  stateRead:string;
  actualState:string|null;
  readStatus:string;
  confidenceRead:string|null;
  priorityRead:string|null;
  priorityAlignment:CausalPriorityAlignment;
  decisionNodeId:string|null;
  decisionType:string|null;
  behaviourKey:string|null;
  behaviourLabel:string|null;
  decisionVerdict:string|null;
  decisionConfidence:string|null;
  diagnosis:CausalChainDiagnosis;
  coachLayer:CausalCoachLayer;
  title:string;
  readEvidence:string;
  decisionEvidence:string|null;
  outcome:string|null;
  explanation:string;
  nextCoachAction:string;
  confidence:NodeConfidence;
  boundary:string;
}

export interface DecisionCausalChainReview{
  version:1;
  active:boolean;
  totalChains:number;
  verifiableChains:number;
  diagnosisCounts:Record<CausalChainDiagnosis,number>;
  primaryDiagnosis:CausalChainDiagnosis|'BUILDING';
  primaryCoachLayer:CausalCoachLayer|'BUILDING';
  primaryHeadline:string;
  primaryAction:string;
  chains:DecisionCausalChainItem[];
  boundary:string;
}

const BOUNDARY='CAUSAL CHAIN RECONSTRUCTS THE ORDER OF FROZEN PLAYER READS AND LATER VERIFIED DECISION EVIDENCE. IT IDENTIFIES THE EARLIEST SUPPORTED COACHING FAILURE IN THAT SEQUENCE; IT DOES NOT CLAIM THE EARLIER READ OR PRIORITY CAUSED THE LATER RESULT.';

const PRIORITY_TYPES:Record<string,NodeType[]>={
  FIGHT:['FIGHT','POWER_WINDOW'],
  RESET:['RESET','RECOVERY'],
  FARM:['FARM'],
  'OBJECTIVE SETUP':['OBJECTIVE'],
  STABILISE:['SURVIVAL','RECOVERY','RESET'],
};

const DIAGNOSIS_PRIORITY:Record<CausalChainDiagnosis,number>={
  MISREAD_COMPOUNDED:6,
  PRIORITY_DEVIATION:5,
  EXECUTION_GAP:4,
  MISREAD_RECOVERED:2,
  CLEAN_CHAIN:1,
  NOT_VERIFIABLE:0,
};

function upper(value:unknown){return String(value??'').replace(/\s+/g,' ').trim().toUpperCase()}
function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function rank(value:unknown){const v=upper(value);return v==='HIGH'?3:v==='MEDIUM'?2:1}
function confidence(a:unknown,b:unknown):NodeConfidence{
  const score=Math.min(rank(a),rank(b));
  return score>=3?'HIGH':score===2?'MEDIUM':'LOW';
}
function nearestNext(nodes:CausalDecisionNode[],at:number){
  const candidates=nodes
    .filter(node=>Number.isFinite(Number(node?.atSeconds))&&Number(node.atSeconds)>=at&&Number(node.atSeconds)<=at+150)
    .sort((a,b)=>Number(a.atSeconds)-Number(b.atSeconds)||rank(b.confidence)-rank(a.confidence));
  return candidates[0]??null;
}
function priorityAlignment(priority:unknown,node:CausalDecisionNode|null):CausalPriorityAlignment{
  if(!node)return'NOT_VERIFIABLE';
  const selected=upper(priority);
  const expected=PRIORITY_TYPES[selected];
  if(!expected?.length)return'NOT_VERIFIABLE';
  const type=upper(node.type) as NodeType;
  return expected.includes(type)?'MATCHED':'CONFLICTED';
}
function diagnosis(read:GameReadCalibrationItem,node:CausalDecisionNode|null,alignment:CausalPriorityAlignment):CausalChainDiagnosis{
  if(read.status==='NOT_VERIFIABLE'||!node||upper(node.verdict)==='NEUTRAL')return'NOT_VERIFIABLE';
  if(read.status==='REVIEW'){
    return upper(node.verdict)==='IMPROVE'?'MISREAD_COMPOUNDED':'MISREAD_RECOVERED';
  }
  if(read.status==='SUPPORTED'&&upper(node.verdict)==='IMPROVE'){
    return alignment==='CONFLICTED'?'PRIORITY_DEVIATION':'EXECUTION_GAP';
  }
  if(read.status==='SUPPORTED'&&upper(node.verdict)==='GOOD')return'CLEAN_CHAIN';
  return'NOT_VERIFIABLE';
}
function layerFor(value:CausalChainDiagnosis):CausalCoachLayer{
  if(value==='MISREAD_COMPOUNDED')return'GAME_READ';
  if(value==='PRIORITY_DEVIATION')return'FOLLOW_THROUGH';
  if(value==='EXECUTION_GAP')return'EXECUTION';
  if(value==='MISREAD_RECOVERED')return'RECOGNITION';
  if(value==='CLEAN_CHAIN')return'AUTONOMY';
  return'EVIDENCE';
}
function copy(value:CausalChainDiagnosis,read:GameReadCalibrationItem,node:CausalDecisionNode|null,alignment:CausalPriorityAlignment){
  const readText=upper(read.stateRead);
  const actual=read.actualState?upper(read.actualState):'NOT VERIFIABLE';
  const priority=upper(read.priorityRead)||'NO PRIORITY FROZEN';
  const behaviour=clean(node?.behaviourLabel)||clean(node?.title)||upper(node?.type)||'later decision';
  if(value==='MISREAD_COMPOUNDED')return{
    title:'ROOT CAUSE · GAME READ',
    explanation:'You froze '+readText+' but the recorded visible state was '+actual+'. The next verified decision was also graded for improvement. The earliest supported coaching error is the read, not just the later '+behaviour+'.',
    action:'TRAIN THE READ FIRST. KEEP THE PLAYER COMMITTING TO A STATE BEFORE ADDING MORE EXECUTION INSTRUCTION.',
  };
  if(value==='PRIORITY_DEVIATION')return{
    title:'ROOT CAUSE · FOLLOW-THROUGH',
    explanation:'Your game-state read was supported, but you froze '+priority+' and the next verified graded decision came from a different action family. Because that later decision was graded for improvement, the first supported gap is following your own priority.',
    action:'TRAIN BRANCH COMMITMENT: STATE THE PRIORITY, THEN CHECK WHETHER THE NEXT DECISION ACTUALLY SERVES IT.',
  };
  if(value==='EXECUTION_GAP')return{
    title:'ROOT CAUSE · EXECUTION',
    explanation:'Your game-state read was supported and there is no verified priority conflict, but the next graded decision still needs improvement. OP CLIMB should preserve the read demand and coach the execution layer instead.',
    action:'DO NOT RETEACH THE GAME STATE. KEEP THE SELF-READ, THEN COACH THE SPECIFIC DECISION BEHAVIOUR.',
  };
  if(value==='MISREAD_RECOVERED')return{
    title:'MISREAD · RECOVERED',
    explanation:'Your frozen game-state read was not supported by the later evidence, but the next verified decision was clean. The player recovered after the inaccurate read, so the coaching target stays recognition rather than punishing the later action.',
    action:'RETEST GAME-STATE RECOGNITION. CREDIT THE CLEAN RECOVERY AND AVOID OVERCOACHING THE EXECUTION.',
  };
  if(value==='CLEAN_CHAIN')return{
    title:'CLEAN CHAIN · READ TO ACTION',
    explanation:'Your frozen game-state read was supported and the next verified decision was clean. There is no evidence-backed failure in this chain.',
    action:'REINFORCE THE SELF-READ AND CONSIDER FADING SUPPORT IF THIS REPEATS ACROSS VERIFIED GAMES.',
  };
  return{
    title:'CHAIN NOT VERIFIABLE',
    explanation:'OP CLIMB does not have enough close, gradeable evidence to connect this frozen read to a later decision without guessing.',
    action:'KEEP COLLECTING FROZEN READS AND VERIFIED DECISION MOMENTS. DO NOT LABEL A ROOT CAUSE YET.',
  };
}

function chainFor(read:GameReadCalibrationItem,nodes:CausalDecisionNode[]):DecisionCausalChainItem{
  const node=nearestNext(nodes,Number(read.gameSeconds)||Number(read.checkpointMinute)*60);
  const alignment=priorityAlignment(read.priorityRead,node);
  const diagnosed=diagnosis(read,node,alignment);
  const text=copy(diagnosed,read,node,alignment);
  const delay=node?Math.max(0,Math.round(Number(node.atSeconds)-Number(read.gameSeconds))):null;
  return{
    version:1,
    checkpointMinute:Number(read.checkpointMinute),
    readAtSeconds:Number(read.gameSeconds),
    decisionAtSeconds:node?Math.round(Number(node.atSeconds)):null,
    delaySeconds:delay,
    stateRead:upper(read.stateRead),
    actualState:read.actualState?upper(read.actualState):null,
    readStatus:upper(read.status),
    confidenceRead:read.confidenceRead?upper(read.confidenceRead):null,
    priorityRead:read.priorityRead?upper(read.priorityRead):null,
    priorityAlignment:alignment,
    decisionNodeId:node?.id??null,
    decisionType:node?upper(node.type):null,
    behaviourKey:node?.behaviourKey?upper(node.behaviourKey):null,
    behaviourLabel:node?.behaviourLabel?clean(node.behaviourLabel):null,
    decisionVerdict:node?upper(node.verdict):null,
    decisionConfidence:node?upper(node.confidence):null,
    diagnosis:diagnosed,
    coachLayer:layerFor(diagnosed),
    title:text.title,
    readEvidence:clean(read.proof),
    decisionEvidence:node?[clean(node.title),clean(node.decisionRead),...(node.evidence??[]).map(clean)].filter(Boolean).join(' · '):null,
    outcome:node?clean(node.consequence)||null:null,
    explanation:text.explanation,
    nextCoachAction:text.action,
    confidence:node?confidence(read.confidence,node.confidence):'LOW',
    boundary:BOUNDARY,
  };
}

export function buildDecisionCausalChain(input:{readCalibration?:GameReadCalibrationReview|null;nodes?:CausalDecisionNode[]|null}):DecisionCausalChainReview{
  const reads=input.readCalibration?.items??[];
  const nodes=(input.nodes??[]).filter(node=>Number.isFinite(Number(node?.atSeconds))).sort((a,b)=>Number(a.atSeconds)-Number(b.atSeconds));
  const chains=reads.map(read=>chainFor(read,nodes));
  const diagnosisCounts={
    MISREAD_COMPOUNDED:0,
    PRIORITY_DEVIATION:0,
    EXECUTION_GAP:0,
    MISREAD_RECOVERED:0,
    CLEAN_CHAIN:0,
    NOT_VERIFIABLE:0,
  } satisfies Record<CausalChainDiagnosis,number>;
  for(const item of chains)diagnosisCounts[item.diagnosis]+=1;
  const verifiable=chains.filter(item=>item.diagnosis!=='NOT_VERIFIABLE');
  const primary=verifiable
    .slice()
    .sort((a,b)=>DIAGNOSIS_PRIORITY[b.diagnosis]-DIAGNOSIS_PRIORITY[a.diagnosis]||rank(b.confidence)-rank(a.confidence)||a.readAtSeconds-b.readAtSeconds)[0]??null;
  return{
    version:1,
    active:chains.length>0,
    totalChains:chains.length,
    verifiableChains:verifiable.length,
    diagnosisCounts,
    primaryDiagnosis:primary?.diagnosis??(chains.length?'NOT_VERIFIABLE':'BUILDING'),
    primaryCoachLayer:primary?.coachLayer??(chains.length?'EVIDENCE':'BUILDING'),
    primaryHeadline:primary?.title??(chains.length?'NO CAUSAL CHAIN VERIFIED':'CAUSAL CHAIN IS BUILDING'),
    primaryAction:primary?.nextCoachAction??(chains.length?'COLLECT MORE VERIFIED READ → DECISION PAIRS BEFORE CHANGING THE COACHING LAYER.':'COMPLETE LIVE READ CHECKPOINTS TO BUILD THE FIRST CAUSAL CHAIN.'),
    chains,
    boundary:BOUNDARY,
  };
}

export const DECISION_CAUSAL_CHAIN_BOUNDARY=BOUNDARY;
