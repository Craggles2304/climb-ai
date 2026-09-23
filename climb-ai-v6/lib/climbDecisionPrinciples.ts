import type {HistoryAnalysisRow} from './riot/proHistory';
import type {DecisionBehaviourKey,DecisionSituationTag,DraftSituationContext} from './decisionTwin';
import type {SkillTransferGraph,SkillNodeState} from './climbSkillTransferGraph';

export type DecisionPrincipleKey=
  |'TEMPO_OVER_GREED'
  |'PRESERVE_INFORMATION_BEFORE_COMMITMENT'
  |'PROTECT_FUTURE_VALUE_OVER_IMMEDIATE_ACCESS';

export type DecisionPrincipleState='BUILDING'|'CONNECTED'|'GENERALISING'|'PRINCIPLE_STABLE'|'REGRESSION_WATCH';
export type DecisionPrincipleConfidence='LOW'|'MEDIUM'|'HIGH';

export interface DecisionPrincipleProfile{
  key:DecisionPrincipleKey;
  label:string;
  rule:string;
  behaviours:DecisionBehaviourKey[];
  observedBehaviours:DecisionBehaviourKey[];
  stableBehaviours:DecisionBehaviourKey[];
  directGames:number;
  directMoments:number;
  cleanRate:number|null;
  championBreadth:number;
  contextBreadth:number;
  state:DecisionPrincipleState;
  confidence:DecisionPrincipleConfidence;
  evidence:string;
  boundary:string;
}

export interface DecisionPrincipleEngine{
  version:1;
  generatedAt:string;
  gamesAnalyzed:number;
  status:'BUILDING'|'READY';
  principles:DecisionPrincipleProfile[];
  strongestPrinciple:DecisionPrincipleProfile|null;
  summary:string;
  boundary:string;
}

export interface DecisionPrinciplePrime{
  version:1;
  active:true;
  principleKey:DecisionPrincipleKey;
  principleLabel:string;
  principleRule:string;
  sourceBehaviour:DecisionBehaviourKey;
  sourceLabel:string;
  targetBehaviour:DecisionBehaviourKey;
  targetLabel:string;
  sourceState:SkillNodeState;
  sourceEvidence:string;
  targetQuestion:string;
  relevantTags:DecisionSituationTag[];
  evidence:string;
  boundary:string;
}

export interface DecisionPrincipleReview{
  version:1;
  active:boolean;
  principleKey:DecisionPrincipleKey|null;
  targetBehaviour:DecisionBehaviourKey|null;
  status:'NO_TEST'|'NOT_OBSERVED'|'APPLIED'|'MISSED'|'MIXED';
  matchedTargetMoments:number;
  cleanTargetMoments:number;
  improveTargetMoments:number;
  note:string;
  boundary:string;
}

type PrincipleDefinition={
  key:DecisionPrincipleKey;
  label:string;
  rule:string;
  behaviours:DecisionBehaviourKey[];
};

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

const DEFINITIONS:PrincipleDefinition[]=[
  {
    key:'TEMPO_OVER_GREED',
    label:'Tempo Over Greed',
    rule:'Protect the next high-value timing instead of taking one more low-value action.',
    behaviours:['RESET_DISCIPLINE','FARM_VS_SETUP','OBJECTIVE_READINESS','POWER_SPIKE_CONVERSION','DEATH_RECOVERY'],
  },
  {
    key:'PRESERVE_INFORMATION_BEFORE_COMMITMENT',
    label:'Preserve Information Before Commitment',
    rule:'Keep options and information alive until the remaining threat or game state is clear enough to commit.',
    behaviours:['FIGHT_SELECTION','THREAT_ADAPTATION','OBJECTIVE_READINESS','CARRY_PRESERVATION'],
  },
  {
    key:'PROTECT_FUTURE_VALUE_OVER_IMMEDIATE_ACCESS',
    label:'Protect Future Value Over Immediate Access',
    rule:'Do not trade future uptime, lead value or carry access for a lower-value immediate action.',
    behaviours:['LEAD_PROTECTION','CARRY_PRESERVATION','SURVIVAL_VALUE','DEATH_RECOVERY','FIGHT_SELECTION'],
  },
];

const TAGS:Partial<Record<DecisionBehaviourKey,DecisionSituationTag[]>>={
  FIGHT_SELECTION:['ENEMY_STRONG_FIGHT','LEAD_CONVERSION','HIGH_VALUE_CARRY'],
  DEATH_RECOVERY:['RECOVERY_WINDOW'],
  LEAD_PROTECTION:['LEAD_CONVERSION'],
  RESET_DISCIPLINE:['HIGH_BANK_FIGHT'],
  OBJECTIVE_READINESS:['ZONE_OBJECTIVE'],
  FARM_VS_SETUP:['FARM_SETUP_TRADEOFF','ZONE_OBJECTIVE'],
  THREAT_ADAPTATION:['MULTI_ACCESS','PICK_PRESSURE'],
  CARRY_PRESERVATION:['HIGH_VALUE_CARRY','MULTI_ACCESS','PICK_PRESSURE'],
  POWER_SPIKE_CONVERSION:['SCALING_WINDOW'],
  SURVIVAL_VALUE:['HIGH_VALUE_CARRY','MULTI_ACCESS'],
};

const BOUNDARY='DECISION PRINCIPLE ENGINE MAY SUMMARISE REPEATED DIRECT EVIDENCE ACROSS DIFFERENT DECISION SKILLS AS A SHARED HIGHER-LEVEL RULE. IT NEVER AWARDS SKILL MASTERY, TRANSFER, GRADUATION OR REP CREDIT BY ASSOCIATION. A PRINCIPLE TEST EARNS EVIDENCE ONLY FROM THE DIRECT TARGET BEHAVIOUR OBSERVED AFTER THE GAME.';
const REVIEW_BOUNDARY='PRINCIPLE REVIEW SCORES ONLY VERIFIED DIRECT TARGET-BEHAVIOUR MOMENTS. THE SOURCE SKILL, PRINCIPLE STATE OR SIMILARITY BETWEEN SKILLS CANNOT PASS THE TARGET TEST. NOT OBSERVED IS NEUTRAL.';

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function isStable(state:SkillNodeState){return['STABLE','TRANSFERRED','OWNED'].includes(state)}
function confidence(state:DecisionPrincipleState,directGames:number,observed:number):DecisionPrincipleConfidence{
  if(state==='PRINCIPLE_STABLE'&&directGames>=8&&observed>=3)return'HIGH';
  if(observed>=2&&directGames>=4)return'MEDIUM';
  return'LOW';
}
function pct(a:number,b:number){return b?Math.round(a/b*100):null}

function directEvidence(rows:HistoryAnalysisRow[],definition:PrincipleDefinition){
  const behaviours=new Set(definition.behaviours);
  const observed=new Set<DecisionBehaviourKey>();
  const champions=new Set<string>();
  const contexts=new Set<DecisionSituationTag>();
  let games=0,moments=0,cleanMoments=0;
  for(const row of rows){
    const nodes=((row.analysis as any)?.decisionGraph?.nodes??[]) as any[];
    let gameObserved=false;
    for(const node of nodes){
      if(!node||node.confidence==='LOW'||!['GOOD','IMPROVE'].includes(node.verdict))continue;
      const key=clean(node.behaviourKey).toUpperCase() as DecisionBehaviourKey;
      if(!behaviours.has(key))continue;
      gameObserved=true; moments++; observed.add(key);
      if(node.verdict==='GOOD')cleanMoments++;
      const tags=(Array.isArray(node.situationTags)?node.situationTags:[]) as DecisionSituationTag[];
      for(const tag of tags)if(tag&&tag!=='GENERAL')contexts.add(tag);
    }
    if(gameObserved){
      games++;
      const champion=clean(row.champion);
      if(champion)champions.add(champion);
    }
  }
  return{observed:[...observed],champions,contexts,games,moments,cleanMoments};
}

function profileFor(rows:HistoryAnalysisRow[],graph:SkillTransferGraph,definition:PrincipleDefinition):DecisionPrincipleProfile{
  const direct=directEvidence(rows,definition);
  const stable=definition.behaviours.filter(key=>{
    const node=graph.nodes.find(item=>item.key===key);
    return Boolean(node&&isStable(node.state));
  });
  const regressed=definition.behaviours.some(key=>graph.nodes.find(item=>item.key===key)?.state==='REGRESSED');
  let state:DecisionPrincipleState='BUILDING';
  if(direct.observed.length>=2){
    if(regressed)state='REGRESSION_WATCH';
    else if(stable.length>=2&&direct.observed.length>=3&&direct.games>=6&&direct.champions.size>=2)state='PRINCIPLE_STABLE';
    else if(direct.games>=4&&(direct.champions.size>=2||direct.contexts.size>=2))state='GENERALISING';
    else state='CONNECTED';
  }
  const cleanRate=pct(direct.cleanMoments,direct.moments);
  return{
    key:definition.key,label:definition.label,rule:definition.rule,behaviours:definition.behaviours,
    observedBehaviours:direct.observed,stableBehaviours:stable,directGames:direct.games,directMoments:direct.moments,
    cleanRate,championBreadth:direct.champions.size,contextBreadth:direct.contexts.size,state,
    confidence:confidence(state,direct.games,direct.observed.length),
    evidence:direct.observed.length<2
      ?definition.label+' is still a hypothesis: fewer than two different mapped skills have direct verified evidence.'
      :String(direct.observed.length)+' different skill manifestations · '+String(direct.games)+' directly observed games · '+String(cleanRate??0)+'% clean verified moments · '+String(direct.champions.size)+' champion context'+(direct.champions.size===1?'':'s')+'.',
    boundary:BOUNDARY,
  };
}

export function buildDecisionPrincipleEngine(input:{rows:HistoryAnalysisRow[];skillGraph:SkillTransferGraph;generatedAt?:string}):DecisionPrincipleEngine{
  const generatedAt=input.generatedAt??new Date().toISOString();
  const rows=[...input.rows].filter(row=>row.analysis?.version===1).slice(-50);
  const principles=DEFINITIONS.map(def=>profileFor(rows,input.skillGraph,def));
  const ready=principles.some(p=>p.observedBehaviours.length>=2&&p.directGames>=4);
  const ranked=[...principles].filter(p=>p.state!=='BUILDING').sort((a,b)=>{
    const stateScore=(x:DecisionPrincipleState)=>x==='PRINCIPLE_STABLE'?5:x==='GENERALISING'?4:x==='REGRESSION_WATCH'?3:2;
    return stateScore(b.state)-stateScore(a.state)||b.stableBehaviours.length-a.stableBehaviours.length||b.directGames-a.directGames;
  });
  const strongest=ranked[0]??null;
  return{
    version:1,generatedAt,gamesAnalyzed:rows.length,status:ready?'READY':'BUILDING',principles,strongestPrinciple:strongest,
    summary:!ready
      ?'Decision Principle Engine is building cross-skill evidence before it treats behaviours as manifestations of a shared rule.'
      :strongest
        ?strongest.label+' currently has the strongest cross-skill evidence. It summarises connected direct decisions; it does not replace skill-level proof.'
        :'No higher-level principle has enough direct cross-skill evidence yet.',
    boundary:BOUNDARY,
  };
}

export function selectDecisionPrinciplePrime(input:{
  engine:DecisionPrincipleEngine|null|undefined;
  skillGraph:SkillTransferGraph|null|undefined;
  situationContext:DraftSituationContext;
  behaviourKey?:DecisionBehaviourKey|null;
}):DecisionPrinciplePrime|null{
  const {engine,skillGraph}=input;
  const target=input.behaviourKey??null;
  if(!engine||engine.status!=='READY'||!skillGraph||!target)return null;
  const options=engine.principles.filter(p=>p.state!=='BUILDING'&&p.behaviours.includes(target)).map(p=>{
    const siblings=p.observedBehaviours.filter(key=>key!==target).map(key=>skillGraph.nodes.find(n=>n.key===key)).filter(Boolean) as NonNullable<ReturnType<typeof skillGraph.nodes.find>>[];
    const source=[...siblings].sort((a,b)=>(isStable(b.state)?1:0)-(isStable(a.state)?1:0)||b.directGames-a.directGames)[0]??null;
    const relevant=TAGS[target]??['GENERAL'];
    const matched=relevant.filter(tag=>input.situationContext.tags.includes(tag));
    const stateScore=p.state==='PRINCIPLE_STABLE'?30:p.state==='GENERALISING'?22:p.state==='REGRESSION_WATCH'?18:12;
    return{p,source,relevant,matched,score:stateScore+(source?(isStable(source.state)?25:10):0)+(matched.length?15:0)};
  }).filter(x=>x.source).sort((a,b)=>b.score-a.score);
  const selected=options[0];
  if(!selected?.source)return null;
  const targetLabel=LABELS[target];
  return{
    version:1,active:true,principleKey:selected.p.key,principleLabel:selected.p.label,principleRule:selected.p.rule,
    sourceBehaviour:selected.source.key,sourceLabel:selected.source.label,targetBehaviour:target,targetLabel,
    sourceState:selected.source.state,sourceEvidence:selected.source.directEvidence,
    targetQuestion:'Can you apply “'+selected.p.rule+'” through '+targetLabel+' without relying on the familiar '+selected.source.label+' cue?',
    relevantTags:selected.matched.length?selected.matched:selected.relevant,
    evidence:selected.p.evidence,
    boundary:BOUNDARY,
  };
}

export function reviewDecisionPrinciplePrime(prime:DecisionPrinciplePrime|null|undefined,nodes:Array<{behaviourKey?:unknown;verdict?:unknown;confidence?:unknown}>):DecisionPrincipleReview{
  if(!prime)return{version:1,active:false,principleKey:null,targetBehaviour:null,status:'NO_TEST',matchedTargetMoments:0,cleanTargetMoments:0,improveTargetMoments:0,note:'No Decision Principle test was frozen before the game.',boundary:REVIEW_BOUNDARY};
  const target=nodes.filter(node=>clean(node?.behaviourKey).toUpperCase()===prime.targetBehaviour&&clean(node?.confidence).toUpperCase()!=='LOW'&&['GOOD','IMPROVE'].includes(clean(node?.verdict).toUpperCase()));
  const cleanCount=target.filter(node=>clean(node.verdict).toUpperCase()==='GOOD').length;
  const improveCount=target.filter(node=>clean(node.verdict).toUpperCase()==='IMPROVE').length;
  const status:DecisionPrincipleReview['status']=!target.length?'NOT_OBSERVED':cleanCount&&improveCount?'MIXED':cleanCount?'APPLIED':'MISSED';
  return{
    version:1,active:true,principleKey:prime.principleKey,targetBehaviour:prime.targetBehaviour,status,
    matchedTargetMoments:target.length,cleanTargetMoments:cleanCount,improveTargetMoments:improveCount,
    note:status==='NOT_OBSERVED'
      ?'The target manifestation did not occur in verified evidence, so the principle test remains neutral.'
      :status==='APPLIED'
        ?'The direct target behaviour cleanly expressed the frozen higher-level principle in this game.'
        :status==='MISSED'
          ?'The target behaviour was directly observed but did not yet express the frozen higher-level principle cleanly.'
          :'The target behaviour showed both clean and missed manifestations of the frozen principle.',
    boundary:REVIEW_BOUNDARY,
  };
}
