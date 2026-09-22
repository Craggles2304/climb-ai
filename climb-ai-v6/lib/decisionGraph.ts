import type {ProMatchAnalysis,ProMetric,ProEvidence} from './riot/proAnalysis';
import type {StrengthTimeline,FightReview} from './riot/liveStrength';
import type {DecisionBehaviourKey,DecisionSituationTag,DraftSituationContext} from './decisionTwin';
import {reviewDecisionPremortem,type DecisionPremortem,type DecisionPremortemReview} from './decisionPremortem';
import {reviewDecisionSimulation,type DecisionSimulation,type DecisionSimulationReview} from './decisionSimulation';
import {reviewScenarioPrime,type ScenarioPrime,type ScenarioPrimeReview} from './scenarioMemory';
import {reviewDecisionTransfer,type DecisionTransferPrime,type DecisionTransferReview} from './decisionTransfer';
import {reviewClimbMatchMission,type ClimbMatchMission,type ClimbMatchMissionReview} from './climbMissionDesign';
import {reviewClimbCoachIntervention,type ClimbCoachIntervention,type ClimbCoachInterventionReview} from './climbCoachTwin';

export type DecisionNodeConfidence='HIGH'|'MEDIUM'|'LOW';
export type DecisionNodeVerdict='GOOD'|'IMPROVE'|'NEUTRAL';
export type DecisionPlanAlignment='MATCHED'|'CONFLICTED'|'NOT_VERIFIABLE';
export type DecisionNodeType='FIGHT'|'RESET'|'RECOVERY'|'OBJECTIVE'|'FARM'|'ADAPTATION'|'POWER_WINDOW'|'SURVIVAL';
export type CounterfactualBasis='RECORDED_ALTERNATIVE'|'LOCKED_PLAN'|'COACHING_RULE';
export type CoachingResponseStatus='EXECUTED'|'MISSED'|'NOT_VERIFIABLE';

export interface DecisionCoachingResponse{
  version:1;
  status:CoachingResponseStatus;
  cue:string;
  behaviourKey:DecisionBehaviourKey;
  situationTag:DecisionSituationTag|null;
  confidence:DecisionNodeConfidence;
  proof:string;
  boundary:string;
}

export interface DecisionCounterfactual{
  version:1;
  actual:string;
  alternative:string;
  whyBetter:string;
  tradeoff:string;
  confidence:DecisionNodeConfidence;
  basis:CounterfactualBasis[];
  priority:number;
  outcomeBoundary:string;
}

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
    source?:string|null;
    situationTag?:DecisionSituationTag|null;
  }|null;
  situationContext?:DraftSituationContext|null;
  decisionPremortem?:DecisionPremortem|null;
  decisionSimulation?:DecisionSimulation|null;
  scenarioPrime?:ScenarioPrime|null;
  decisionTransferPrime?:DecisionTransferPrime|null;
  climbMission?:ClimbMatchMission|null;
  coachIntervention?:ClimbCoachIntervention|null;
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
  counterfactual:DecisionCounterfactual|null;
  coachingResponse:DecisionCoachingResponse|null;
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
    counterfactualCount:number;
    topCounterfactualNodeIds:string[];
    coachingResponse:{
      activeCue:boolean;
      cue:string|null;
      behaviourKey:DecisionBehaviourKey|null;
      situationTag:DecisionSituationTag|null;
      matchedMoments:number;
      executed:number;
      missed:number;
      responseRate:number|null;
      status:'NO_CUE'|'NO_MATCH'|'EXECUTING'|'MIXED'|'MISSING';
      note:string;
    };
    premortem:DecisionPremortemReview;
    simulation:DecisionSimulationReview;
    scenarioPrime:ScenarioPrimeReview;
    decisionTransfer:DecisionTransferReview;
    climbMission:ClimbMatchMissionReview;
    coachIntervention:ClimbCoachInterventionReview;
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
const COUNTERFACTUAL_BOUNDARY='This is a coaching alternative supported by the recorded state. It does not claim the alternative would guarantee survival, a kill, an objective, or a win.';
const RESPONSE_BOUNDARY='OP CLIMB measures whether a verified decision after the pre-game cue matched the trained behaviour. It does not claim the cue caused the result.';

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
function counterfactualTradeoff(behaviour:DecisionBehaviourKey){
  if(behaviour==='FIGHT_SELECTION')return'You may give up immediate damage, tempo or a tempting low-percentage fight in exchange for a cleaner trigger.';
  if(behaviour==='RESET_DISCIPLINE')return'You temporarily give up map presence to turn banked gold into real combat power.';
  if(behaviour==='DEATH_RECOVERY')return'You may concede one low-value wave or camp while rebuilding a playable state.';
  if(behaviour==='LEAD_PROTECTION')return'You give up the fastest possible snowball attempt to protect the stronger state you already earned.';
  if(behaviour==='OBJECTIVE_READINESS')return'You may leave a low-value wave or camp earlier to buy first setup and safer objective geometry.';
  if(behaviour==='FARM_VS_SETUP')return'You sacrifice some immediate farm so the next team action starts with you connected.';
  if(behaviour==='THREAT_ADAPTATION')return'You may deal less immediate damage while repositioning away from the repeated access angle.';
  if(behaviour==='CARRY_PRESERVATION'||behaviour==='SURVIVAL_VALUE')return'You may hit a lower-priority target or delay damage briefly to preserve safe uptime.';
  if(behaviour==='POWER_SPIKE_CONVERSION')return'You stop one extra farm cycle and spend the spike window on coordinated pressure instead.';
  return'You trade a little immediate value for a decision that better preserves the game plan.';
}
function counterfactualRule(behaviour:DecisionBehaviourKey,contextEnemies:string[]){
  const enemies=contextEnemies.slice(0,3).join(' + ');
  if(behaviour==='FIGHT_SELECTION')return enemies?'Delay or decline the commit until '+enemies+' have spent enough access for your planned fight trigger to be safe.':'Delay or decline the commit until the visible fight state matches your planned trigger.';
  if(behaviour==='RESET_DISCIPLINE')return'Reset before the next voluntary fight when the bank can become a meaningful purchase, then re-enter with the gold converted.';
  if(behaviour==='DEATH_RECOVERY')return'Break the chain: take the safest available resource/reset cycle before entering another contested action.';
  if(behaviour==='LEAD_PROTECTION')return'Protect the stronger state: make the enemy enter your setup instead of buying a harder fight.';
  if(behaviour==='OBJECTIVE_READINESS')return'Leave the last low-value resource early enough to arrive before the enemy owns the river entrance or choke.';
  if(behaviour==='FARM_VS_SETUP')return'Give up the extra wave when taking it would make you second to the next meaningful team action.';
  if(behaviour==='THREAT_ADAPTATION')return enemies?'After '+enemies+' show the first access pattern, reposition before re-entering the same space.':'After the threat shows its first access pattern, reposition before re-entering the same space.';
  if(behaviour==='CARRY_PRESERVATION'||behaviour==='SURVIVAL_VALUE')return enemies?'Stay behind the front edge, account for '+enemies+', and hit the closest safe target until the remaining access is gone.':'Stay behind the front edge and hit the closest safe target until the remaining access is gone.';
  if(behaviour==='POWER_SPIKE_CONVERSION')return'When the real item/power spike completes, connect to the next team pressure window instead of drifting into another farm cycle.';
  return'Use the safer branch of the locked plan before committing.';
}
function counterfactualPriority(input:{behaviour:DecisionBehaviourKey;confidence:DecisionNodeConfidence;planAlignment:DecisionPlanAlignment;hasRecordedAlternative:boolean}){
  const behaviourWeight:Record<DecisionBehaviourKey,number>={
    FIGHT_SELECTION:24,DEATH_RECOVERY:20,LEAD_PROTECTION:22,RESET_DISCIPLINE:19,OBJECTIVE_READINESS:23,
    FARM_VS_SETUP:17,THREAT_ADAPTATION:22,CARRY_PRESERVATION:25,POWER_SPIKE_CONVERSION:18,SURVIVAL_VALUE:24,
  };
  return (input.confidence==='HIGH'?50:input.confidence==='MEDIUM'?30:0)
    +(input.planAlignment==='CONFLICTED'?25:0)
    +(input.hasRecordedAlternative?12:0)
    +(behaviourWeight[input.behaviour]||0);
}
function buildCounterfactual(input:{
  behaviour:DecisionBehaviourKey;
  verdict:DecisionNodeVerdict;
  confidence:DecisionNodeConfidence;
  decisionRead:string;
  lockedPrinciple:string|null;
  planAlignment:DecisionPlanAlignment;
  contextEnemies:string[];
  recordedAlternative?:string|null;
}):DecisionCounterfactual|null{
  if(input.verdict!=='IMPROVE'||input.confidence==='LOW')return null;
  const recorded=clean(input.recordedAlternative);
  const alternative=recorded||counterfactualRule(input.behaviour,input.contextEnemies);
  if(!alternative)return null;
  const basis:CounterfactualBasis[]=[];
  if(recorded)basis.push('RECORDED_ALTERNATIVE');
  if(clean(input.lockedPrinciple))basis.push('LOCKED_PLAN');
  if(!recorded||!basis.length)basis.push('COACHING_RULE');
  const whyBetter=clean(input.lockedPrinciple)
    ?'It better matches the frozen pre-game principle: '+clean(input.lockedPrinciple)
    :'It reduces the specific '+LABELS[input.behaviour].toLowerCase()+' risk supported by the recorded evidence at this moment.';
  return{
    version:1,
    actual:clean(input.decisionRead)||'The recorded decision was graded for improvement.',
    alternative,
    whyBetter,
    tradeoff:counterfactualTradeoff(input.behaviour),
    confidence:input.confidence,
    basis:[...new Set(basis)],
    priority:counterfactualPriority({behaviour:input.behaviour,confidence:input.confidence,planAlignment:input.planAlignment,hasRecordedAlternative:Boolean(recorded)}),
    outcomeBoundary:COUNTERFACTUAL_BOUNDARY,
  };
}

function coachingResponseFor(plan:LockedDecisionPlan|undefined|null,input:{behaviour:DecisionBehaviourKey;verdict:DecisionNodeVerdict;confidence:DecisionNodeConfidence;situationTags:DecisionSituationTag[]}):DecisionCoachingResponse|null{
  const trap=plan?.personalTrap;
  if(!trap||clean(trap.status).toUpperCase()!=='READY')return null;
  const behaviour=clean(trap.behaviourKey).toUpperCase();
  if(!behaviour||behaviour!==input.behaviour)return null;
  const requestedTag=clean(trap.situationTag).toUpperCase() as DecisionSituationTag;
  if(requestedTag&&requestedTag!=='GENERAL'&&!input.situationTags.includes(requestedTag))return null;
  if(input.confidence==='LOW')return null;
  const status:CoachingResponseStatus=input.verdict==='GOOD'?'EXECUTED':input.verdict==='IMPROVE'?'MISSED':'NOT_VERIFIABLE';
  const cue=clean(trap.cue)||'Execute the pre-game personal cue.';
  return{
    version:1,
    status,
    cue,
    behaviourKey:input.behaviour,
    situationTag:requestedTag||null,
    confidence:input.confidence,
    proof:status==='EXECUTED'
      ?'A verified comparable decision matched the behaviour OP CLIMB asked you to train before the game.'
      :status==='MISSED'
        ?'A verified comparable decision still reproduced the behaviour OP CLIMB asked you to correct before the game.'
        :'The situation appeared, but the recorded evidence was not decisive enough to grade execution.',
    boundary:RESPONSE_BOUNDARY,
  };
}

function situationTagsFor(plan:LockedDecisionPlan|undefined|null,behaviour:DecisionBehaviourKey){
  const context=plan?.situationContext;
  const tags:DecisionSituationTag[]=[];
  const enemies:string[]=[];
  const add=(tag:DecisionSituationTag,names:string[]=[]):void=>{
    if(!context?.tags?.includes(tag))return;
    if(!tags.includes(tag))tags.push(tag);
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
    const confidence=scoreConfidence(metric.score,evidence.length);
    const planAlignment=alignment(plan,behaviour,verdict);
    const context=situationTagsFor(plan,behaviour);
    const decisionRead=clean(item.detail)||'Recorded state created a measurable coaching decision point.';
    return{
      id:nodeId(type,behaviour,item.atSeconds,startIndex+index),
      atSeconds:Math.round(item.atSeconds),
      minuteLabel:minute(item.atSeconds),
      type,
      behaviourKey:behaviour,
      behaviourLabel:LABELS[behaviour],
      verdict,
      confidence,
      title:clean(item.label)||LABELS[behaviour],
      situation:clean(metric.summary)||`${LABELS[behaviour]} evidence was measurable at this point.`,
      decisionRead,
      consequence,
      lockedPrinciple:locked,
      planAlignment,
      situationTags:context.tags,
      contextEnemies:context.enemies,
      evidence:[clean(item.label),clean(item.detail),clean(metric.value)].filter(Boolean),
      counterfactual:buildCounterfactual({behaviour,verdict,confidence,decisionRead,lockedPrinciple:locked,planAlignment,contextEnemies:context.enemies,recordedAlternative:fight?.betterDecision?.[0]??null}),
      coachingResponse:coachingResponseFor(plan,{behaviour,verdict,confidence,situationTags:context.tags}),
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
      const confidence:DecisionNodeConfidence=(leak.count>=2||leak.severity==='CRITICAL'||leak.severity==='MAJOR')?'HIGH':'MEDIUM';
      const planAlignment=alignment(plan,behaviour,'IMPROVE');
      const context=situationTagsFor(plan,behaviour);
      const decisionRead=fight?fightDecisionRead(fight):clean(leak.detail)||'The recorded state matched a known development leak.';
      nodes.push({
        id:nodeId('LEAK',behaviour,at,index++),
        atSeconds:Math.round(at),
        minuteLabel:minute(at),
        type:behaviour==='DEATH_RECOVERY'?'RECOVERY':behaviour==='RESET_DISCIPLINE'?'RESET':behaviour==='CARRY_PRESERVATION'?'SURVIVAL':'FIGHT',
        behaviourKey:behaviour,
        behaviourLabel:LABELS[behaviour],
        verdict:'IMPROVE',
        confidence,
        title:clean(leak.label)||LABELS[behaviour],
        situation:fight?fightSituation(fight):clean(leak.detail)||'Repeated match evidence marked this as a coaching leak.',
        decisionRead,
        consequence:fight?fight.summary:clean(leak.detail)||'This occurrence contributed to the repeated behaviour pattern.',
        lockedPrinciple:locked,
        planAlignment,
        situationTags:context.tags,
        contextEnemies:context.enemies,
        evidence:[clean(leak.detail),fight?.headline||''].filter(Boolean),
        counterfactual:buildCounterfactual({behaviour,verdict:'IMPROVE',confidence,decisionRead,lockedPrinciple:locked,planAlignment,contextEnemies:context.enemies,recordedAlternative:fight?.betterDecision?.[0]??null}),
        coachingResponse:coachingResponseFor(plan,{behaviour,verdict:'IMPROVE',confidence,situationTags:context.tags}),
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
    const confidence:DecisionNodeConfidence=fight.verdict==='EVEN'?'MEDIUM':'HIGH';
    const planAlignment=alignment(plan,behaviour,verdict);
    const context=situationTagsFor(plan,behaviour);
    const decisionRead=fightDecisionRead(fight);
    return{
      id:nodeId('FIGHT',behaviour,fight.atSeconds,startIndex+index),
      atSeconds:Math.round(fight.atSeconds),
      minuteLabel:minute(fight.atSeconds),
      type:behaviour==='RESET_DISCIPLINE'?'RESET':behaviour==='CARRY_PRESERVATION'?'SURVIVAL':'FIGHT',
      behaviourKey:behaviour,
      behaviourLabel:LABELS[behaviour],
      verdict,
      confidence,
      title:fight.headline,
      situation:fightSituation(fight),
      decisionRead,
      consequence:fight.summary,
      lockedPrinciple:locked,
      planAlignment,
      situationTags:context.tags,
      contextEnemies:context.enemies,
      evidence:[
        `Visible power: ${fight.verdict}`,
        typeof fight.evidence.levelDelta==='number'?(`Level delta: ${fight.evidence.levelDelta>=0?'+':''}${fight.evidence.levelDelta}`):'',
        typeof fight.evidence.itemGoldDelta==='number'?(`Visible item-gold delta: ${fight.evidence.itemGoldDelta>=0?'+':''}${Math.round(fight.evidence.itemGoldDelta)}g`):'',
        fight.evidence.currentGold>=900?`${Math.round(fight.evidence.currentGold)}g unspent`:'',
      ].filter(Boolean),
      counterfactual:buildCounterfactual({behaviour,verdict,confidence,decisionRead,lockedPrinciple:locked,planAlignment,contextEnemies:context.enemies,recordedAlternative:fight.betterDecision?.[0]??null}),
      coachingResponse:coachingResponseFor(plan,{behaviour,verdict,confidence,situationTags:context.tags}),
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
  const counterfactualNodes=finalNodes.filter(node=>node.counterfactual).sort((a,b)=>(b.counterfactual?.priority??0)-(a.counterfactual?.priority??0));
  const activeTrap=plan?.personalTrap&&clean(plan.personalTrap.status).toUpperCase()==='READY'?plan.personalTrap:null;
  const responseNodes=finalNodes.filter(node=>node.coachingResponse&&node.coachingResponse.status!=='NOT_VERIFIABLE');
  const executed=responseNodes.filter(node=>node.coachingResponse?.status==='EXECUTED').length;
  const missed=responseNodes.filter(node=>node.coachingResponse?.status==='MISSED').length;
  const matchedMoments=executed+missed;
  const responseRate=matchedMoments?Math.round(executed/matchedMoments*100):null;
  const responseStatus=!activeTrap?'NO_CUE':matchedMoments===0?'NO_MATCH':executed===matchedMoments?'EXECUTING':missed===matchedMoments?'MISSING':'MIXED';
  const observedDecisions=finalNodes.map(node=>({behaviourKey:node.behaviourKey,verdict:node.verdict,confidence:node.confidence,situationTags:node.situationTags}));
  const premortemReview=reviewDecisionPremortem(plan?.decisionPremortem,observedDecisions);
  const simulationReview=reviewDecisionSimulation(plan?.decisionSimulation,observedDecisions);
  const scenarioPrimeReview=reviewScenarioPrime(plan?.scenarioPrime,observedDecisions);
  const decisionTransferReview=reviewDecisionTransfer(plan?.decisionTransferPrime,observedDecisions);
  const climbMissionReview=reviewClimbMatchMission(plan?.climbMission,observedDecisions);
  const coachInterventionReview=reviewClimbCoachIntervention(plan?.coachIntervention,climbMissionReview);

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
      counterfactualCount:counterfactualNodes.length,
      topCounterfactualNodeIds:counterfactualNodes.slice(0,3).map(node=>node.id),
      coachingResponse:{
        activeCue:Boolean(activeTrap),
        cue:activeTrap?clean(activeTrap.cue)||null:null,
        behaviourKey:activeTrap&&clean(activeTrap.behaviourKey)?clean(activeTrap.behaviourKey).toUpperCase() as DecisionBehaviourKey:null,
        situationTag:activeTrap&&clean(activeTrap.situationTag)?clean(activeTrap.situationTag).toUpperCase() as DecisionSituationTag:null,
        matchedMoments,
        executed,
        missed,
        responseRate,
        status:responseStatus,
        note:!activeTrap
          ?'No verified Personal Trap was active before this game.'
          :matchedMoments===0
            ?'The game did not produce a verified comparable decision, so OP CLIMB will not score cue execution.'
            :responseStatus==='EXECUTING'
              ?'Every verified comparable decision this game matched the trained behaviour.'
              :responseStatus==='MISSING'
                ?'Every verified comparable decision this game still reproduced the trained behaviour.'
                :'The trained behaviour was executed in some comparable moments and missed in others.',
      },
      premortem:premortemReview,
      simulation:simulationReview,
      scenarioPrime:scenarioPrimeReview,
      decisionTransfer:decisionTransferReview,
      climbMission:climbMissionReview,
      coachIntervention:coachInterventionReview,
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
    decisionPremortem:raw.decisionPremortem??raw.playbook?.decisionPremortem??null,
    decisionSimulation:raw.decisionSimulation??null,
    scenarioPrime:raw.scenarioPrime??null,
    decisionTransferPrime:raw.decisionTransferPrime??null,
    climbMission:raw.climbMission??null,
    coachIntervention:raw.coachIntervention??null,
  };
}
