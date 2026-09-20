import type {ProMatchAnalysis,ProMetric,ProEvidence} from './riot/proAnalysis';
import type {StrengthTimeline,FightReview} from './riot/liveStrength';
import type {DecisionBehaviourKey,DecisionSituationTag,DraftSituationContext} from './decisionTwin';

export type DecisionNodeConfidence='HIGH'|'MEDIUM'|'LOW';
export type DecisionNodeVerdict='GOOD'|'IMPROVE'|'NEUTRAL';
export type DecisionPlanAlignment='MATCHED'|'CONFLICTED'|'NOT_VERIFIABLE';
export type DecisionNodeType='FIGHT'|'RESET'|'RECOVERY'|'OBJECTIVE'|'FARM'|'ADAPTATION'|'POWER_WINDOW'|'SURVIVAL';

export interface LockedDecisionPlan{
  source?:string|null;
  headline?:string|null;
  why?:string|null;
  theirPlan?:string|null;
  threatAnswer?:string|null;
  fightTrigger?:string|null;
  objectiveSetup?:string|null;
  never?:string|null;
  ifBehind?:string|null;
  personalTrap?:{
    status?:string|null;
    behaviourKey?:string|null;
    behaviourLabel?:string|null;
    cue?:string|null;
    proof?:string|null;
    relevantEnemies?:string[];
  }|null;
  situationContext?:DraftSituationContext|null;
}

export interface DecisionGraphNode{
  id:string;
  atSeconds:number;
  minuteLabel:string;
  type:DecisionNodeType;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  verdict:DecisionNodeVerdict;
  confidence:DecisionNodeConfidence;
  title:string;
  situation:string;
  decisionRead:string;
  consequence:string;
  lockedPrinciple:string|null;
  planAlignment:DecisionPlanAlignment;
  situationTags:DecisionSituationTag[];
  contextEnemies:string[];
  evidence:string[];
  limitation:string;
}

export interface DecisionGraph{
  version:1;
  generatedAt:string;
  champion:string;
  role:string|null;
  nodeCount:number;
  highConfidenceCount:number;
  planAvailable:boolean;
  nodes:DecisionGraphNode[];
  summary:{
    cleanDecisions:number;
    improveDecisions:number;
    neutralDecisions:number;
    mostRepeatedBehaviour:DecisionBehaviourKey|null;
    mostRepeatedLabel:string|null;
  };
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

const METRIC_TO_BEHAVIOUR:Partial<Record<string,DecisionBehaviourKey>>={
  objective_readiness:'OBJECTIVE_READINESS',
  farm_fight_tradeoff:'FARM_VS_SETUP',
  opponent_adaptation:'THREAT_ADAPTATION',
  power_spike_conversion:'POWER_SPIKE_CONVERSION',
  reset_quality:'RESET_DISCIPLINE',
  historical_recovery:'DEATH_RECOVERY',
  carry_preservation:'CARRY_PRESERVATION',
  survival_value:'SURVIVAL_VALUE',
};

const LEAK_TO_BEHAVIOUR:Record<string,DecisionBehaviourKey>={
  BANKING_LEAK:'RESET_DISCIPLINE',
  RED_STATE:'FIGHT_SELECTION',
  CHAIN_DEATH:'DEATH_RECOVERY',
  LEAD_THROW:'LEAD_PROTECTION',
  CARRY_DEATH:'CARRY_PRESERVATION',
};

const LIMITATION='Decision Graph v1 uses recorded Riot-visible state and OP CLIMB match evidence. It does not claim to know player intent, exact mouse inputs, hidden cooldowns, fog information or unseen team communication.';

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function minute(seconds:number){const safe=Math.max(0,Math.round(seconds));return Math.floor(safe/60)+':'+String(safe%60).padStart(2,'0')}
function nodeId(type:string,behaviour:string,at:number,index:number){return [type,behaviour,Math.round(at),index].join(':').toLowerCase()}
function scoreVerdict(score:number|null|undefined):DecisionNodeVerdict{
  if(typeof score!=='number')return'NEUTRAL';
  return score>=75?'GOOD':score<60?'IMPROVE':'NEUTRAL';
}
function scoreConfidence(score:number|null|undefined,evidenceCount=1):DecisionNodeConfidence{
  if(typeof score!=='number')return evidenceCount>=2?'MEDIUM':'LOW';
  if(evidenceCount>=2&&Math.abs(score-67)>=12)return'HIGH';
  return evidenceCount>=1?'MEDIUM':'LOW';
}
function nearestFight(fights:FightReview[],at:number){return fights.reduce<FightReview|null>((best,item)=>{
  const diff=Math.abs(item.atSeconds-at);
  if(diff>18)return best;
  if(!best||diff<Math.abs(best.atSeconds-at))return item;
  return best;
},null)}
function planText(plan:LockedDecisionPlan|undefined|null,behaviour:DecisionBehaviourKey){
  if(!plan)return null;
  if(behaviour==='OBJECTIVE_READINESS'||behaviour==='FARM_VS_SETUP')return clean(plan.objectiveSetup)||clean(plan.headline)||null;
  if(behaviour==='CARRY_PRESERVATION'||behaviour==='SURVIVAL_VALUE')return clean(plan.never)||clean(plan.threatAnswer)||clean(plan.fightTrigger)||null;
  if(behaviour==='THREAT_ADAPTATION')return clean(plan.threatAnswer)||clean(plan.fightTrigger)||null;
  if(behaviour==='FIGHT_SELECTION'||behaviour==='LEAD_PROTECTION')return clean(plan.fightTrigger)||clean(plan.headline)||null;
  if(behaviour==='RESET_DISCIPLINE')return clean(plan.headline)||clean(plan.why)||null;
  if(behaviour==='DEATH_RECOVERY')return clean(plan.ifBehind)||clean(plan.headline)||null;
  if(behaviour==='POWER_SPIKE_CONVERSION')return clean(plan.headline)||clean(plan.why)||null;
  return clean(plan.headline)||null;
}
function alignment(plan:LockedDecisionPlan|undefined|null,behaviour:DecisionBehaviourKey,verdict:DecisionNodeVerdict):DecisionPlanAlignment{
  if(!planText(plan,behaviour))return'NOT_VERIFIABLE';
  return verdict==='GOOD'?'MATCHED':verdict==='IMPROVE'?'CONFLICTED':'NOT_VERIFIABLE';
}

function situationTagsFor(plan:LockedDecisionPlan|undefined|null,behaviour:DecisionBehaviourKey){
  const context=plan?.situationContext;
  const tags:DecisionSituationTag[]=[];
  const enemies:string[]=[];
  const add=(tag:DecisionSituationTag,names:string[]=[]):void=>{
    if(context?.tags?.includes(tag)&&!tags.includes(tag))tags.push(tag);
    for(const name of names.map(clean).filter(Boolean))if(!enemies.includes(name))enemies.push(name);
  };
  if(['CARRY_PRESERVATION','SURVIVAL_VALUE','THREAT_ADAPTATION','FIGHT_SELECTION','LEAD_PROTECTION'].includes(behaviour)){
    add('MULTI_ACCESS',context?.enemyAccess??[]);
    add('PICK_PRESSURE',context?.enemyPicks??[]);
  }
  if(['OBJECTIVE_READINESS','FARM_VS_SETUP'].includes(behaviour))add('ZONE_OBJECTIVE',context?.enemyZones??[]);
  if(behaviour==='POWER_SPIKE_CONVERSION')add('SCALING_WINDOW',[]);
  if(!tags.length&&context?.tags?.includes('GENERAL'))tags.push('GENERAL');
  return{tags,enemies};
}
function fightBehaviour(fight:FightReview,analysis:ProMatchAnalysis):DecisionBehaviourKey{
  if(fight.outcome==='DEATH'&&fight.evidence.currentGold>=1200)return'RESET_DISCIPLINE';
  if(fight.outcome==='DEATH'&&fight.verdict==='THEM_STRONGER')return'FIGHT_SELECTION';
  if(fight.outcome==='DEATH'&&fight.verdict==='YOU_STRONGER')return'LEAD_PROTECTION';
  const carryMetric=analysis.metrics?.carry_preservation;
  const carryEvidence=(carryMetric?.evidence??[]).some(e=>typeof e.atSeconds==='number'&&Math.abs((e.atSeconds??0)-fight.atSeconds)<=8);
  if(fight.outcome==='DEATH'&&carryEvidence)return'CARRY_PRESERVATION';
  return fight.verdict==='YOU_STRONGER'?'LEAD_PROTECTION':'FIGHT_SELECTION';
}
function fightVerdict(fight:FightReview):DecisionNodeVerdict{
  if(fight.outcome==='DEATH')return'IMPROVE';
  return'GOOD';
}
function fightDecisionRead(fight:FightReview){
  if(fight.outcome==='DEATH'&&fight.verdict==='THEM_STRONGER')return'Accepted or remained in a fight while the opponent already held the stronger visible combat state.';
  if(fight.outcome==='DEATH'&&fight.verdict==='YOU_STRONGER')return'Entered a fight from a stronger visible state but the advantage was not protected through the exchange.';
  if(fight.outcome==='DEATH'&&fight.evidence.currentGold>=1200)return`Fought while carrying about ${Math.round(fight.evidence.currentGold)}g that had not yet become purchased combat power.`;
  if(fight.outcome==='KILL')return'Converted the visible fight state into a kill.';
  return'Joined a fight that produced a positive assist outcome.';
}
function fightSituation(fight:FightReview){
  const opponent=clean(fight.opponentChampion||fight.opponent)||'the enemy';
  const raw=fight.verdict==='YOU_STRONGER'?'you visibly stronger':fight.verdict==='THEM_STRONGER'?'enemy visibly stronger':'visible state roughly even';
  return`${opponent} interaction · ${raw} · ${fight.evidence.currentGold?Math.round(fight.evidence.currentGold)+'g in pocket':'bank unknown'}.`;
}

function metricNodes(metric:ProMetric|undefined,behaviour:DecisionBehaviourKey,type:DecisionNodeType,fights:FightReview[],plan:LockedDecisionPlan|undefined|null,startIndex:number):DecisionGraphNode[]{
  if(!metric||['UNAVAILABLE','BUILDING'].includes(String(metric.status)))return[];
  const evidence=(metric.evidence??[]).filter((item):item is ProEvidence&{atSeconds:number}=>typeof item?.atSeconds==='number'&&Number.isFinite(item.atSeconds));
  return evidence.slice(0,8).map((item,index)=>{
    const verdict=scoreVerdict(metric.score);
    const fight=nearestFight(fights,item.atSeconds);
    const consequence=fight?fight.summary:clean(item.detail)||clean(metric.summary)||'Recorded evidence changed this behaviour score.';
    const locked=planText(plan,behaviour);
    return{
      id:nodeId(type,behaviour,item.atSeconds,startIndex+index),
      atSeconds:Math.round(item.atSeconds),
      minuteLabel:minute(item.atSeconds),
      type,
      behaviourKey:behaviour,
      behaviourLabel:LABELS[behaviour],
      verdict,
      confidence:scoreConfidence(metric.score,evidence.length),
      title:clean(item.label)||LABELS[behaviour],
      situation:clean(metric.summary)||`${LABELS[behaviour]} evidence was measurable at this point.`,
      decisionRead:clean(item.detail)||'Recorded state created a measurable coaching decision point.',
      consequence,
      lockedPrinciple:locked,
      planAlignment:alignment(plan,behaviour,verdict),
      situationTags:situationTagsFor(plan,behaviour).tags,
      contextEnemies:situationTagsFor(plan,behaviour).enemies,
      evidence:[clean(item.label),clean(item.detail),clean(metric.value)].filter(Boolean),
      limitation:LIMITATION,
    } satisfies DecisionGraphNode;
  });
}

function leakNodes(analysis:ProMatchAnalysis,fights:FightReview[],plan:LockedDecisionPlan|undefined|null,startIndex:number){
  const nodes:DecisionGraphNode[]=[];
  let index=startIndex;
  for(const leak of analysis.leakSignals??[]){
    const behaviour=LEAK_TO_BEHAVIOUR[String(leak.key)];
    if(!behaviour)continue;
    for(const at of (leak.evidenceSeconds??[]).slice(0,6)){
      if(!Number.isFinite(at))continue;
      const fight=nearestFight(fights,at);
      const locked=planText(plan,behaviour);
      nodes.push({
        id:nodeId('LEAK',behaviour,at,index++),
        atSeconds:Math.round(at),
        minuteLabel:minute(at),
        type:behaviour==='DEATH_RECOVERY'?'RECOVERY':behaviour==='RESET_DISCIPLINE'?'RESET':behaviour==='CARRY_PRESERVATION'?'SURVIVAL':'FIGHT',
        behaviourKey:behaviour,
        behaviourLabel:LABELS[behaviour],
        verdict:'IMPROVE',
        confidence:(leak.count>=2||leak.severity==='CRITICAL'||leak.severity==='MAJOR')?'HIGH':'MEDIUM',
        title:clean(leak.label)||LABELS[behaviour],
        situation:fight?fightSituation(fight):clean(leak.detail)||'Repeated match evidence marked this as a coaching leak.',
        decisionRead:fight?fightDecisionRead(fight):clean(leak.detail)||'The recorded state matched a known development leak.',
        consequence:fight?fight.summary:clean(leak.detail)||'This occurrence contributed to the repeated behaviour pattern.',
        lockedPrinciple:locked,
        planAlignment:alignment(plan,behaviour,'IMPROVE'),
        situationTags:situationTagsFor(plan,behaviour).tags,
        contextEnemies:situationTagsFor(plan,behaviour).enemies,
        evidence:[clean(leak.detail),fight?.headline||''].filter(Boolean),
        limitation:LIMITATION,
      });
    }
  }
  return nodes;
}

function fightNodes(analysis:ProMatchAnalysis,summary:StrengthTimeline,plan:LockedDecisionPlan|undefined|null,startIndex:number){
  return (summary.fightReviews??[]).slice(0,20).map((fight,index)=>{
    const behaviour=fightBehaviour(fight,analysis);
    const verdict=fightVerdict(fight);
    const locked=planText(plan,behaviour);
    return{
      id:nodeId('FIGHT',behaviour,fight.atSeconds,startIndex+index),
      atSeconds:Math.round(fight.atSeconds),
      minuteLabel:minute(fight.atSeconds),
      type:behaviour==='RESET_DISCIPLINE'?'RESET':behaviour==='CARRY_PRESERVATION'?'SURVIVAL':'FIGHT',
      behaviourKey:behaviour,
      behaviourLabel:LABELS[behaviour],
      verdict,
      confidence:fight.verdict==='EVEN'?'MEDIUM':'HIGH',
      title:fight.headline,
      situation:fightSituation(fight),
      decisionRead:fightDecisionRead(fight),
      consequence:fight.summary,
      lockedPrinciple:locked,
      planAlignment:alignment(plan,behaviour,verdict),
      situationTags:situationTagsFor(plan,behaviour).tags,
      contextEnemies:situationTagsFor(plan,behaviour).enemies,
      evidence:[
        `Visible power: ${fight.verdict}`,
        typeof fight.evidence.levelDelta==='number'?(`Level delta: ${fight.evidence.levelDelta>=0?'+':''}${fight.evidence.levelDelta}`):'',
        typeof fight.evidence.itemGoldDelta==='number'?(`Visible item-gold delta: ${fight.evidence.itemGoldDelta>=0?'+':''}${Math.round(fight.evidence.itemGoldDelta)}g`):'',
        fight.evidence.currentGold>=900?`${Math.round(fight.evidence.currentGold)}g unspent`:'',
      ].filter(Boolean),
      limitation:fight.limitation||LIMITATION,
    } satisfies DecisionGraphNode;
  });
}

function dedupe(nodes:DecisionGraphNode[]){
  const ordered=[...nodes].sort((a,b)=>a.atSeconds-b.atSeconds||confidenceRank(b.confidence)-confidenceRank(a.confidence));
  const output:DecisionGraphNode[]=[];
  for(const node of ordered){
    const duplicate=output.find(existing=>existing.behaviourKey===node.behaviourKey&&Math.abs(existing.atSeconds-node.atSeconds)<=12);
    if(!duplicate){output.push(node);continue}
    if(confidenceRank(node.confidence)>confidenceRank(duplicate.confidence)){
      const index=output.indexOf(duplicate);output[index]=node;
    }
  }
  return output.sort((a,b)=>a.atSeconds-b.atSeconds);
}
function confidenceRank(value:DecisionNodeConfidence){return value==='HIGH'?3:value==='MEDIUM'?2:1}

export function buildDecisionGraph(input:{analysis:ProMatchAnalysis;summary:StrengthTimeline;lockedPlan?:LockedDecisionPlan|null;generatedAt?:string}):DecisionGraph{
  const {analysis,summary}=input;
  const plan=input.lockedPlan??null;
  const nodes:DecisionGraphNode[]=[];
  nodes.push(...fightNodes(analysis,summary,plan,nodes.length));
  nodes.push(...leakNodes(analysis,summary.fightReviews??[],plan,nodes.length));

  const specs:Array<[keyof ProMatchAnalysis['metrics'],DecisionBehaviourKey,DecisionNodeType]>= [
    ['objective_readiness','OBJECTIVE_READINESS','OBJECTIVE'],
    ['farm_fight_tradeoff','FARM_VS_SETUP','FARM'],
    ['opponent_adaptation','THREAT_ADAPTATION','ADAPTATION'],
    ['power_spike_conversion','POWER_SPIKE_CONVERSION','POWER_WINDOW'],
    ['reset_quality','RESET_DISCIPLINE','RESET'],
    ['carry_preservation','CARRY_PRESERVATION','SURVIVAL'],
    ['survival_value','SURVIVAL_VALUE','SURVIVAL'],
  ];
  for(const [metricKey,behaviour,type] of specs){
    nodes.push(...metricNodes(analysis.metrics?.[metricKey],behaviour,type,summary.fightReviews??[],plan,nodes.length));
  }

  const finalNodes=dedupe(nodes).slice(0,30);
  const counts=new Map<DecisionBehaviourKey,number>();
  for(const node of finalNodes)counts.set(node.behaviourKey,(counts.get(node.behaviourKey)||0)+1);
  const repeated=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]??null;

  return{
    version:1,
    generatedAt:input.generatedAt??new Date().toISOString(),
    champion:analysis.champion,
    role:analysis.role,
    nodeCount:finalNodes.length,
    highConfidenceCount:finalNodes.filter(node=>node.confidence==='HIGH').length,
    planAvailable:Boolean(plan&&(clean(plan.headline)||clean(plan.fightTrigger)||clean(plan.objectiveSetup))),
    nodes:finalNodes,
    summary:{
      cleanDecisions:finalNodes.filter(node=>node.verdict==='GOOD').length,
      improveDecisions:finalNodes.filter(node=>node.verdict==='IMPROVE').length,
      neutralDecisions:finalNodes.filter(node=>node.verdict==='NEUTRAL').length,
      mostRepeatedBehaviour:repeated,
      mostRepeatedLabel:repeated?LABELS[repeated]:null,
    },
  };
}

export function lockedPlanFromPregameContext(context:any):LockedDecisionPlan|null{
  const raw=context?.deepCoach??context?.lockedCoach??null;
  if(!raw||typeof raw!=='object')return null;
  return{
    source:clean(raw.source)||null,
    headline:clean(raw.headline)||null,
    why:clean(raw.why)||null,
    theirPlan:clean(raw.theirPlan)||null,
    threatAnswer:clean(raw.threatAnswer)||null,
    fightTrigger:clean(raw.fightTrigger)||null,
    objectiveSetup:clean(raw.objectiveSetup)||null,
    never:clean(raw.never)||null,
    ifBehind:clean(raw.ifBehind)||null,
    personalTrap:raw.personalTrap??null,
    situationContext:raw.situationContext??null,
  };
}
