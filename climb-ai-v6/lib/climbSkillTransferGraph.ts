import type {HistoryAnalysisRow} from './riot/proHistory';
import type {DecisionBehaviourKey,DecisionSituationTag,DraftSituationContext} from './decisionTwin';
import type {DecisionTwinV2Profile} from './decisionTwinV2';
import type {ScenarioMemoryProfile} from './scenarioMemory';
import type {DecisionTransferProfile} from './decisionTransfer';

export type SkillTransferEdgeType='PREREQUISITE'|'SUPPORTS'|'OBSERVED_LINK';
export type SkillGraphConfidence='LOW'|'MEDIUM'|'HIGH';
export type SkillNodeState='BUILDING'|'LEARNING'|'STABLE'|'TRANSFERRED'|'OWNED'|'REGRESSED';

export interface SkillTransferNode{
  key:DecisionBehaviourKey;
  label:string;
  state:SkillNodeState;
  directGames:number;
  cleanRate:number|null;
  memoryStrength:number|null;
  transferStrength:number|null;
  championBreadth:number;
  roleBreadth:number;
  contextBreadth:number;
  directEvidence:string;
}

export interface SkillTransferEdge{
  id:string;
  source:DecisionBehaviourKey;
  sourceLabel:string;
  target:DecisionBehaviourKey;
  targetLabel:string;
  type:SkillTransferEdgeType;
  strength:number;
  confidence:SkillGraphConfidence;
  sourceStable:boolean;
  targetDirectGames:number;
  coObservedGames:number;
  sourceCleanGames:number;
  sourceMissGames:number;
  targetCleanWhenSourceClean:number|null;
  targetCleanWhenSourceMiss:number|null;
  associationLift:number|null;
  championBreadth:number;
  roleBreadth:number;
  contextBreadth:number;
  reason:string;
  evidence:string;
  boundary:string;
}

export interface SkillBridgeCandidate{
  source:DecisionBehaviourKey;
  sourceLabel:string;
  target:DecisionBehaviourKey;
  targetLabel:string;
  edgeType:SkillTransferEdgeType;
  edgeStrength:number;
  score:number;
  sourceState:SkillNodeState;
  targetState:SkillNodeState;
  targetDirectGames:number;
  relevantTags:DecisionSituationTag[];
  whyNow:string;
  testRule:string;
  evidence:string;
}

export interface SkillTransferGraph{
  version:1;
  generatedAt:string;
  gamesAnalyzed:number;
  status:'BUILDING'|'READY';
  nodes:SkillTransferNode[];
  edges:SkillTransferEdge[];
  bridgeCandidates:SkillBridgeCandidate[];
  nextBridge:SkillBridgeCandidate|null;
  summary:string;
  boundary:string;
}

export interface SkillBridgePrime{
  version:1;
  active:true;
  source:DecisionBehaviourKey;
  sourceLabel:string;
  target:DecisionBehaviourKey;
  targetLabel:string;
  edgeType:SkillTransferEdgeType;
  edgeStrength:number;
  title:string;
  inheritedPrinciple:string;
  targetQuestion:string;
  exactDraftRead:string;
  relevantTags:DecisionSituationTag[];
  evidence:string;
  boundary:string;
}

export interface SkillBridgeReview{
  version:1;
  active:boolean;
  source:DecisionBehaviourKey|null;
  target:DecisionBehaviourKey|null;
  status:'NO_TEST'|'NOT_OBSERVED'|'BRIDGED'|'MISSED'|'MIXED';
  matchedTargetMoments:number;
  cleanTargetMoments:number;
  improveTargetMoments:number;
  note:string;
  boundary:string;
}

type CanonicalEdge={source:DecisionBehaviourKey;target:DecisionBehaviourKey;type:'PREREQUISITE'|'SUPPORTS';weight:number;reason:string};
type GameSkill={verdict:'GOOD'|'IMPROVE';champion:string;role:string|null;tags:DecisionSituationTag[]};

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

const RELEVANT_TAGS:Record<DecisionBehaviourKey,DecisionSituationTag[]>={
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

const CANONICAL:CanonicalEdge[]=[
  {source:'FIGHT_SELECTION',target:'LEAD_PROTECTION',type:'PREREQUISITE',weight:92,reason:'Protecting a lead assumes the player can first reject low-value fights instead of treating advantage as permission to force.'},
  {source:'FARM_VS_SETUP',target:'OBJECTIVE_READINESS',type:'PREREQUISITE',weight:92,reason:'Objective arrival depends on recognising when one more resource is worth less than connecting to setup.'},
  {source:'RESET_DISCIPLINE',target:'POWER_SPIKE_CONVERSION',type:'PREREQUISITE',weight:92,reason:'A power spike cannot be converted reliably if banked gold is not turned into real combat power first.'},
  {source:'THREAT_ADAPTATION',target:'CARRY_PRESERVATION',type:'PREREQUISITE',weight:92,reason:'Carry preservation requires recognising and adapting to the enemy access pattern before choosing the safe damage line.'},
  {source:'CARRY_PRESERVATION',target:'SURVIVAL_VALUE',type:'PREREQUISITE',weight:92,reason:'Survival value builds on preserving uptime and refusing low-value access when your continued presence matters most.'},
  {source:'OBJECTIVE_READINESS',target:'FIGHT_SELECTION',type:'SUPPORTS',weight:72,reason:'Arriving early creates more information and positional choice before a fight starts.'},
  {source:'THREAT_ADAPTATION',target:'FIGHT_SELECTION',type:'SUPPORTS',weight:74,reason:'Recognising enemy access improves the quality of the fight-entry decision.'},
  {source:'FIGHT_SELECTION',target:'CARRY_PRESERVATION',type:'SUPPORTS',weight:70,reason:'Choosing a valid fight and choosing the correct damage line are adjacent parts of the same commitment decision.'},
  {source:'DEATH_RECOVERY',target:'RESET_DISCIPLINE',type:'SUPPORTS',weight:68,reason:'Recovery discipline and reset discipline both require interrupting emotional or tempo-driven re-entry.'},
  {source:'RESET_DISCIPLINE',target:'FIGHT_SELECTION',type:'SUPPORTS',weight:66,reason:'Spending before voluntary fights improves whether the visible state actually supports commitment.'},
  {source:'POWER_SPIKE_CONVERSION',target:'LEAD_PROTECTION',type:'SUPPORTS',weight:68,reason:'Converting a power window into controlled pressure is one route to protecting rather than gambling an advantage.'},
  {source:'FARM_VS_SETUP',target:'RESET_DISCIPLINE',type:'SUPPORTS',weight:62,reason:'Both skills depend on valuing the next team window over one more low-value resource action.'},
];

const BOUNDARY='SKILL TRANSFER GRAPH CONNECTS DECISION SKILLS USING DESIGNED DEPENDENCIES AND REPEATED WITHIN-PLAYER ASSOCIATIONS. AN EDGE MAY PRIORITISE A TEST OR EXPLAIN WHY ONE SKILL SHOULD FOLLOW ANOTHER, BUT IT NEVER TRANSFERS MASTERY, GRADUATION, REP CREDIT OR DIRECT EVIDENCE FROM THE SOURCE SKILL TO THE TARGET. OBSERVED LINKS ARE ASSOCIATIONS, NOT CAUSAL CLAIMS.';

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function pct(a:number,b:number){return b?Math.round(a/b*100):null}
function cap(value:number){return Math.max(0,Math.min(100,Math.round(value)))}
function confidence(games:number,strength:number):SkillGraphConfidence{
  if(games>=8&&strength>=70)return'HIGH';
  if(games>=4)return'MEDIUM';
  return'LOW';
}
function tagsFor(node:any):DecisionSituationTag[]{
  const tags=(Array.isArray(node?.situationTags)?node.situationTags:[])
    .map((tag:unknown)=>clean(tag).toUpperCase())
    .filter(Boolean) as DecisionSituationTag[];
  return tags.length?[...new Set(tags)]:['GENERAL'];
}
function gameSkills(rows:HistoryAnalysisRow[]){
  return [...rows]
    .filter(row=>row.analysis?.version===1)
    .sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))
    .slice(-50)
    .map(row=>{
      const map=new Map<DecisionBehaviourKey,GameSkill>();
      const nodes=((row.analysis as any)?.decisionGraph?.nodes??[]) as any[];
      for(const node of nodes){
        if(!node||node.confidence==='LOW'||!['GOOD','IMPROVE'].includes(node.verdict))continue;
        const key=clean(node.behaviourKey).toUpperCase() as DecisionBehaviourKey;
        if(!LABELS[key])continue;
        const next:GameSkill={
          verdict:node.verdict,
          champion:clean(row.champion)||'Unknown',
          role:clean(row.role)||null,
          tags:tagsFor(node),
        };
        const current=map.get(key);
        if(!current||next.verdict==='IMPROVE')map.set(key,next);
      }
      return map;
    });
}
function nodeState(key:DecisionBehaviourKey,memory:ScenarioMemoryProfile,transfer:DecisionTransferProfile):SkillNodeState{
  const mem=memory.cards.filter(card=>card.behaviourKey===key).sort((a,b)=>b.memoryStrength-a.memoryStrength)[0]??null;
  const tx=transfer.cards.find(card=>card.behaviourKey===key)??null;
  if(mem?.state==='REGRESSED'||tx?.state==='REGRESSED')return'REGRESSED';
  if(tx?.state==='PRINCIPLE_OWNED')return'OWNED';
  if(['GENERALISING','TRANSFERRING'].includes(tx?.state??''))return'TRANSFERRED';
  if(mem?.state==='MASTERED')return'STABLE';
  if(mem&&mem.state!=='BUILDING')return'LEARNING';
  return'BUILDING';
}
function stableState(state:SkillNodeState){return['STABLE','TRANSFERRED','OWNED'].includes(state)}
function buildNodes(rows:HistoryAnalysisRow[],games:Map<DecisionBehaviourKey,GameSkill>[],memory:ScenarioMemoryProfile,transfer:DecisionTransferProfile):SkillTransferNode[]{
  const keys=Object.keys(LABELS) as DecisionBehaviourKey[];
  return keys.map(key=>{
    const observed=games.map(game=>game.get(key)).filter((item):item is GameSkill=>Boolean(item));
    const cleanGames=observed.filter(item=>item.verdict==='GOOD').length;
    const mem=memory.cards.filter(card=>card.behaviourKey===key).sort((a,b)=>b.memoryStrength-a.memoryStrength)[0]??null;
    const tx=transfer.cards.find(card=>card.behaviourKey===key)??null;
    const champions=[...new Set(observed.map(item=>item.champion).filter(Boolean))];
    const roles=[...new Set(observed.map(item=>item.role).filter(Boolean))];
    const contexts=[...new Set(observed.flatMap(item=>item.tags).filter(tag=>tag!=='GENERAL'))];
    const state=nodeState(key,memory,transfer);
    return{
      key,label:LABELS[key],state,directGames:observed.length,cleanRate:pct(cleanGames,observed.length),
      memoryStrength:mem?.memoryStrength??null,transferStrength:tx?.transferStrength??null,
      championBreadth:champions.length,roleBreadth:roles.length,contextBreadth:contexts.length,
      directEvidence:!observed.length
        ?'No direct verified '+LABELS[key]+' decision evidence yet.'
        :String(observed.length)+' direct verified game'+(observed.length===1?'':'s')+' · '+String(pct(cleanGames,observed.length)??0)+'% clean · state '+state.replaceAll('_',' ').toLowerCase()+'.',
    };
  });
}
function canonicalEdges(nodes:SkillTransferNode[]):SkillTransferEdge[]{
  return CANONICAL.map(edge=>{
    const source=nodes.find(node=>node.key===edge.source)!;
    const target=nodes.find(node=>node.key===edge.target)!;
    return{
      id:'skill-edge:'+edge.type.toLowerCase()+':'+edge.source.toLowerCase()+':'+edge.target.toLowerCase(),
      source:edge.source,sourceLabel:LABELS[edge.source],target:edge.target,targetLabel:LABELS[edge.target],type:edge.type,
      strength:edge.weight,confidence:'HIGH',sourceStable:stableState(source.state),targetDirectGames:target.directGames,
      coObservedGames:0,sourceCleanGames:0,sourceMissGames:0,targetCleanWhenSourceClean:null,targetCleanWhenSourceMiss:null,associationLift:null,
      championBreadth:0,roleBreadth:0,contextBreadth:0,reason:edge.reason,
      evidence:edge.type==='PREREQUISITE'
        ?LABELS[edge.source]+' is a designed prerequisite for '+LABELS[edge.target]+'. Target mastery still requires direct '+LABELS[edge.target]+' evidence.'
        :LABELS[edge.source]+' is a designed supporting decision for '+LABELS[edge.target]+'. This relationship can prioritise a bridge test, not award target progress.',
      boundary:BOUNDARY,
    };
  });
}
function empiricalEdges(games:Map<DecisionBehaviourKey,GameSkill>[],nodes:SkillTransferNode[],canonical:SkillTransferEdge[]){
  const keys=nodes.map(node=>node.key);
  const out:SkillTransferEdge[]=[];
  for(const source of keys){
    for(const target of keys){
      if(source===target)continue;
      if(canonical.some(edge=>edge.source===source&&edge.target===target))continue;
      const paired=games.map(game=>({source:game.get(source),target:game.get(target)})).filter(item=>item.source&&item.target) as {source:GameSkill;target:GameSkill}[];
      if(paired.length<5)continue;
      const sourceClean=paired.filter(item=>item.source.verdict==='GOOD');
      const sourceMiss=paired.filter(item=>item.source.verdict==='IMPROVE');
      if(sourceClean.length<2||sourceMiss.length<2)continue;
      const targetCleanGivenSource=pct(sourceClean.filter(item=>item.target.verdict==='GOOD').length,sourceClean.length)??0;
      const targetCleanGivenMiss=pct(sourceMiss.filter(item=>item.target.verdict==='GOOD').length,sourceMiss.length)??0;
      const lift=targetCleanGivenSource-targetCleanGivenMiss;
      if(lift<18)continue;
      const championBreadth=new Set(paired.map(item=>item.target.champion)).size;
      const roleBreadth=new Set(paired.map(item=>item.target.role).filter(Boolean)).size;
      const contextBreadth=new Set(paired.flatMap(item=>item.target.tags).filter(tag=>tag!=='GENERAL')).size;
      const strength=cap(45+lift*.55+Math.min(12,paired.length*1.5)+Math.min(8,contextBreadth*2));
      const sourceNode=nodes.find(node=>node.key===source)!;
      const targetNode=nodes.find(node=>node.key===target)!;
      out.push({
        id:'skill-edge:observed:'+source.toLowerCase()+':'+target.toLowerCase(),
        source,sourceLabel:LABELS[source],target,targetLabel:LABELS[target],type:'OBSERVED_LINK',
        strength,confidence:confidence(paired.length,strength),sourceStable:stableState(sourceNode.state),targetDirectGames:targetNode.directGames,
        coObservedGames:paired.length,sourceCleanGames:sourceClean.length,sourceMissGames:sourceMiss.length,
        targetCleanWhenSourceClean:targetCleanGivenSource,targetCleanWhenSourceMiss:targetCleanGivenMiss,associationLift:lift,
        championBreadth,roleBreadth,contextBreadth,
        reason:'This player has repeatedly shown cleaner '+LABELS[target]+' decisions in games where '+LABELS[source]+' was also clean.',
        evidence:String(paired.length)+' co-observed games · target clean '+String(targetCleanGivenSource)+'% when source clean vs '+String(targetCleanGivenMiss)+'% when source missed · +'+String(lift)+' point association.',
        boundary:BOUNDARY,
      });
    }
  }
  return out.sort((a,b)=>b.strength-a.strength||b.coObservedGames-a.coObservedGames);
}
function targetEligible(target:SkillTransferNode,twin:DecisionTwinV2Profile){
  if(['OWNED','TRANSFERRED'].includes(target.state))return false;
  return target.directGames>=1||twin.activeFive.some(item=>item.key===target.key);
}
function bridgeCandidates(nodes:SkillTransferNode[],edges:SkillTransferEdge[],twin:DecisionTwinV2Profile):SkillBridgeCandidate[]{
  return edges
    .filter(edge=>edge.sourceStable)
    .map(edge=>{
      const source=nodes.find(node=>node.key===edge.source)!;
      const target=nodes.find(node=>node.key===edge.target)!;
      if(!targetEligible(target,twin))return null;
      const focus=twin.activeFive.find(item=>item.key===edge.target);
      const activeBoost=focus?Math.min(24,Math.max(6,focus.priority*.22)):0;
      const edgeTypeBoost=edge.type==='PREREQUISITE'?18:edge.type==='OBSERVED_LINK'?10:5;
      const directNeed=target.directGames<3?12:target.state==='REGRESSED'?18:6;
      const score=cap(edge.strength*.58+activeBoost+edgeTypeBoost+directNeed);
      return{
        source:edge.source,sourceLabel:edge.sourceLabel,target:edge.target,targetLabel:edge.targetLabel,
        edgeType:edge.type,edgeStrength:edge.strength,score,sourceState:source.state,targetState:target.state,targetDirectGames:target.directGames,
        relevantTags:RELEVANT_TAGS[edge.target],
        whyNow:edge.sourceLabel+' is '+source.state.toLowerCase()+' and can now be used as a bridge into '+edge.targetLabel+' without assuming the target skill is already learned.',
        testRule:'USE '+edge.sourceLabel.toUpperCase()+' AS THE FAMILIAR PRINCIPLE, THEN REQUIRE A DIRECT '+edge.targetLabel.toUpperCase()+' DECISION. CREDIT ONLY THE TARGET DECISION.',
        evidence:edge.evidence,
      } satisfies SkillBridgeCandidate;
    })
    .filter((item):item is SkillBridgeCandidate=>Boolean(item))
    .sort((a,b)=>b.score-a.score||b.edgeStrength-a.edgeStrength||a.targetLabel.localeCompare(b.targetLabel));
}

export function buildSkillTransferGraph(input:{
  rows:HistoryAnalysisRow[];
  twin:DecisionTwinV2Profile;
  memory:ScenarioMemoryProfile;
  transfer:DecisionTransferProfile;
  generatedAt?:string;
}):SkillTransferGraph{
  const generatedAt=input.generatedAt??new Date().toISOString();
  const games=gameSkills(input.rows);
  const nodes=buildNodes(input.rows,games,input.memory,input.transfer);
  const designed=canonicalEdges(nodes);
  const observed=empiricalEdges(games,nodes,designed);
  const edges=[...designed,...observed].sort((a,b)=>{
    const type=(value:SkillTransferEdgeType)=>value==='PREREQUISITE'?3:value==='OBSERVED_LINK'?2:1;
    return type(b.type)-type(a.type)||b.strength-a.strength;
  });
  const candidates=bridgeCandidates(nodes,edges,input.twin);
  const ready=input.rows.length>=4&&nodes.some(node=>node.directGames>=3);
  return{
    version:1,generatedAt,gamesAnalyzed:input.rows.length,status:ready?'READY':'BUILDING',
    nodes,edges,bridgeCandidates:candidates,nextBridge:ready?candidates[0]??null:null,
    summary:!ready
      ?'Skill Transfer Graph is building direct decision evidence before it recommends cross-skill bridge tests.'
      :candidates[0]
        ?candidates[0].sourceLabel+' can now bridge into '+candidates[0].targetLabel+'. The target still requires its own direct verified decisions.'
        :'No cross-skill bridge test is currently strong enough to change sequencing.',
    boundary:BOUNDARY,
  };
}

export function skillGraphPriorityBoost(graph:SkillTransferGraph|null|undefined,target:DecisionBehaviourKey){
  if(!graph||graph.status!=='READY')return 0;
  const candidate=graph.bridgeCandidates.find(item=>item.target===target);
  if(!candidate)return 0;
  return Math.min(18,Math.round(candidate.score*.18));
}

export function selectSkillBridgePrime(input:{
  graph:SkillTransferGraph|null|undefined;
  situationContext:DraftSituationContext;
  behaviourKey?:DecisionBehaviourKey|null;
}):SkillBridgePrime|null{
  const graph=input.graph;
  if(!graph||graph.status!=='READY')return null;
  const candidates=graph.bridgeCandidates
    .filter(item=>!input.behaviourKey||item.target===input.behaviourKey)
    .map(item=>{
      const matched=item.relevantTags.filter(tag=>input.situationContext.tags.includes(tag));
      const contextBoost=matched.length?18:input.situationContext.tags.includes('GENERAL')?0:-6;
      return{item,matched,score:item.score+contextBoost};
    })
    .filter(item=>item.score>=58)
    .sort((a,b)=>b.score-a.score);
  const selected=candidates[0];
  if(!selected)return null;
  const bridge=selected.item;
  const tags=selected.matched.length?selected.matched:bridge.relevantTags;
  return{
    version:1,active:true,source:bridge.source,sourceLabel:bridge.sourceLabel,target:bridge.target,targetLabel:bridge.targetLabel,
    edgeType:bridge.edgeType,edgeStrength:bridge.edgeStrength,
    title:'SKILL BRIDGE · '+bridge.sourceLabel.toUpperCase()+' → '+bridge.targetLabel.toUpperCase(),
    inheritedPrinciple:'USE THE STABLE '+bridge.sourceLabel.toUpperCase()+' READ AS CONTEXT, NOT AS CREDIT FOR '+bridge.targetLabel.toUpperCase()+'.',
    targetQuestion:'WHAT DIRECT '+bridge.targetLabel.toUpperCase()+' DECISION DOES THIS SITUATION REQUIRE AFTER THE '+bridge.sourceLabel.toUpperCase()+' READ?',
    exactDraftRead:tags.length
      ?'This draft contains '+tags.map(tag=>tag.replaceAll('_',' ').toLowerCase()).join(' / ')+' cues that can expose the '+bridge.sourceLabel+' → '+bridge.targetLabel+' bridge.'
      :'This draft can test whether the familiar '+bridge.sourceLabel+' principle helps the player reach a direct '+bridge.targetLabel+' decision.',
    relevantTags:tags,
    evidence:bridge.evidence,
    boundary:'This is a bridge test. Source-skill mastery may make the target decision easier to recognise, but only direct verified '+bridge.targetLabel+' evidence can change '+bridge.targetLabel+' progress.',
  };
}


export function reviewSkillBridgePrime(
  prime:SkillBridgePrime|null|undefined,
  nodes:{behaviourKey:DecisionBehaviourKey;verdict:'GOOD'|'IMPROVE'|'NEUTRAL';confidence:'HIGH'|'MEDIUM'|'LOW'}[],
):SkillBridgeReview{
  if(!prime){
    return{
      version:1,active:false,source:null,target:null,status:'NO_TEST',matchedTargetMoments:0,cleanTargetMoments:0,improveTargetMoments:0,
      note:'No Skill Bridge test was frozen before this game.',
      boundary:'No frozen bridge means no cross-skill transfer score. OP CLIMB does not infer a bridge after seeing the result.',
    };
  }
  const matched=nodes.filter(node=>node.behaviourKey===prime.target&&node.confidence!=='LOW'&&(node.verdict==='GOOD'||node.verdict==='IMPROVE'));
  const clean=matched.filter(node=>node.verdict==='GOOD').length;
  const improve=matched.filter(node=>node.verdict==='IMPROVE').length;
  const status:SkillBridgeReview['status']=!matched.length?'NOT_OBSERVED':clean&&improve?'MIXED':improve?'MISSED':'BRIDGED';
  return{
    version:1,active:true,source:prime.source,target:prime.target,status,
    matchedTargetMoments:matched.length,cleanTargetMoments:clean,improveTargetMoments:improve,
    note:status==='NOT_OBSERVED'
      ?'The target skill did not produce a verified direct decision, so the source skill earns no target credit.'
      :status==='BRIDGED'
        ?'The familiar source principle was present and the target skill also produced a direct clean decision. Credit belongs to the target decision; this is bridge evidence, not inherited mastery.'
        :status==='MISSED'
          ?'The target skill was directly observed and missed. Source-skill mastery did not transfer automatically.'
          :'The target skill produced both clean and missed direct decisions. Keep testing the bridge without promoting target mastery.',
    boundary:'Skill Bridge Review scores only direct verified target-skill decisions. Source mastery, edge strength and observed associations cannot pass or graduate the target skill.',
  };
}

export const SKILL_TRANSFER_GRAPH_BOUNDARY=BOUNDARY;
