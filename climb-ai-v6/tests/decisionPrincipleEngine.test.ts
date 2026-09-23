import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionPrincipleEngine,reviewDecisionPrinciplePrime,selectDecisionPrinciplePrime,type DecisionPrinciplePrime} from '../lib/climbDecisionPrinciples';
import type {HistoryAnalysisRow} from '../lib/riot/proHistory';
import type {SkillTransferGraph,SkillTransferNode} from '../lib/climbSkillTransferGraph';
import type {DecisionBehaviourKey} from '../lib/decisionTwin';

const labels:Record<DecisionBehaviourKey,string>={
  FIGHT_SELECTION:'Fight Selection',DEATH_RECOVERY:'Recovery After Death',LEAD_PROTECTION:'Lead Protection',RESET_DISCIPLINE:'Reset Discipline',
  OBJECTIVE_READINESS:'Objective Arrival',FARM_VS_SETUP:'Farm vs Setup',THREAT_ADAPTATION:'Threat Adaptation',CARRY_PRESERVATION:'Carry Preservation',
  POWER_SPIKE_CONVERSION:'Power-Spike Conversion',SURVIVAL_VALUE:'Survival Value',
};
function skill(key:DecisionBehaviourKey,state:SkillTransferNode['state'],directGames=4):SkillTransferNode{
  return{key,label:labels[key],state,directGames,cleanRate:75,memoryStrength:70,transferStrength:null,championBreadth:2,roleBreadth:1,contextBreadth:2,directEvidence:String(directGames)+' direct verified games.'};
}
function graph(nodes:SkillTransferNode[]):SkillTransferGraph{
  const all=(Object.keys(labels) as DecisionBehaviourKey[]).map(key=>nodes.find(n=>n.key===key)??skill(key,'BUILDING',0));
  return{version:1,generatedAt:'2026-09-23T00:00:00.000Z',gamesAnalyzed:8,status:'READY',nodes:all,edges:[],bridgeCandidates:[],nextBridge:null,summary:'ready',boundary:'direct only'};
}
function row(day:number,champion:string,nodes:Array<{behaviourKey:DecisionBehaviourKey;verdict:'GOOD'|'IMPROVE';situationTags?:string[]}>):HistoryAnalysisRow{
  return{champion,role:'ADC',createdAt:new Date(Date.UTC(2026,8,day)).toISOString(),analysis:{version:1,decisionGraph:{nodes:nodes.map(node=>({...node,confidence:'HIGH',situationTags:node.situationTags??['GENERAL']}))}} as any};
}

test('tempo principle requires different direct skill manifestations before becoming connected',()=>{
  const skillGraph=graph([skill('RESET_DISCIPLINE','STABLE'),skill('FARM_VS_SETUP','LEARNING')]);
  const one=[row(1,'Jinx',[{behaviourKey:'RESET_DISCIPLINE',verdict:'GOOD'}]),row(2,'Jinx',[{behaviourKey:'RESET_DISCIPLINE',verdict:'GOOD'}])];
  const building=buildDecisionPrincipleEngine({rows:one,skillGraph});
  assert.equal(building.principles.find(p=>p.key==='TEMPO_OVER_GREED')?.state,'BUILDING');

  const cross=[
    ...one,
    row(3,'Jinx',[{behaviourKey:'FARM_VS_SETUP',verdict:'GOOD',situationTags:['FARM_SETUP_TRADEOFF']}]),
    row(4,'Aphelios',[{behaviourKey:'FARM_VS_SETUP',verdict:'GOOD',situationTags:['ZONE_OBJECTIVE']}]),
  ];
  const ready=buildDecisionPrincipleEngine({rows:cross,skillGraph});
  const tempo=ready.principles.find(p=>p.key==='TEMPO_OVER_GREED');
  assert.ok(tempo);
  assert.notEqual(tempo?.state,'BUILDING');
  assert.deepEqual(new Set(tempo?.observedBehaviours),new Set(['RESET_DISCIPLINE','FARM_VS_SETUP']));
});

test('a principle can become stable only from repeated direct evidence across several manifestations',()=>{
  const skillGraph=graph([
    skill('RESET_DISCIPLINE','STABLE',5),skill('FARM_VS_SETUP','TRANSFERRED',5),skill('OBJECTIVE_READINESS','LEARNING',4),
  ]);
  const rows=[
    row(1,'Jinx',[{behaviourKey:'RESET_DISCIPLINE',verdict:'GOOD'},{behaviourKey:'FARM_VS_SETUP',verdict:'GOOD'}]),
    row(2,'Jinx',[{behaviourKey:'RESET_DISCIPLINE',verdict:'GOOD'}]),
    row(3,'Aphelios',[{behaviourKey:'FARM_VS_SETUP',verdict:'GOOD'},{behaviourKey:'OBJECTIVE_READINESS',verdict:'GOOD',situationTags:['ZONE_OBJECTIVE']}]),
    row(4,'Aphelios',[{behaviourKey:'OBJECTIVE_READINESS',verdict:'GOOD',situationTags:['ZONE_OBJECTIVE']}]),
    row(5,'Caitlyn',[{behaviourKey:'RESET_DISCIPLINE',verdict:'GOOD'}]),
    row(6,'Caitlyn',[{behaviourKey:'FARM_VS_SETUP',verdict:'IMPROVE',situationTags:['FARM_SETUP_TRADEOFF']}]),
  ];
  const engine=buildDecisionPrincipleEngine({rows,skillGraph});
  const tempo=engine.principles.find(p=>p.key==='TEMPO_OVER_GREED');
  assert.equal(tempo?.state,'PRINCIPLE_STABLE');
  assert.equal(tempo?.stableBehaviours.length,2);
  assert.match(tempo?.boundary??'',/NEVER AWARDS SKILL MASTERY/);
});

test('principle prime uses a familiar sibling skill but targets the active direct behaviour',()=>{
  const skillGraph=graph([skill('THREAT_ADAPTATION','STABLE',6),skill('CARRY_PRESERVATION','LEARNING',3)]);
  const rows=[
    row(1,'Aphelios',[{behaviourKey:'THREAT_ADAPTATION',verdict:'GOOD',situationTags:['MULTI_ACCESS']}]),
    row(2,'Aphelios',[{behaviourKey:'THREAT_ADAPTATION',verdict:'GOOD',situationTags:['MULTI_ACCESS']}]),
    row(3,'Jinx',[{behaviourKey:'CARRY_PRESERVATION',verdict:'IMPROVE',situationTags:['PICK_PRESSURE']}]),
    row(4,'Jinx',[{behaviourKey:'CARRY_PRESERVATION',verdict:'GOOD',situationTags:['MULTI_ACCESS']}]),
  ];
  const engine=buildDecisionPrincipleEngine({rows,skillGraph});
  const prime=selectDecisionPrinciplePrime({
    engine,skillGraph,behaviourKey:'CARRY_PRESERVATION',
    situationContext:{tags:['MULTI_ACCESS'],champion:'Jinx',role:'ADC',enemyAccess:['Nocturne'],enemyPicks:[],enemyZones:[]},
  });
  assert.ok(prime);
  assert.equal(prime?.sourceBehaviour,'THREAT_ADAPTATION');
  assert.equal(prime?.targetBehaviour,'CARRY_PRESERVATION');
  assert.match(prime?.principleRule??'',/information|future/i);
});

test('source-only evidence is NOT_OBSERVED and cannot pass the principle test',()=>{
  const prime={
    version:1,active:true,principleKey:'PRESERVE_INFORMATION_BEFORE_COMMITMENT',principleLabel:'Preserve Information Before Commitment',
    principleRule:'Keep options and information alive until commitment.',sourceBehaviour:'THREAT_ADAPTATION',sourceLabel:'Threat Adaptation',
    targetBehaviour:'CARRY_PRESERVATION',targetLabel:'Carry Preservation',sourceState:'STABLE',sourceEvidence:'stable',
    targetQuestion:'apply it?',relevantTags:['MULTI_ACCESS'],evidence:'cross-skill',boundary:'direct only',
  } satisfies DecisionPrinciplePrime;
  const sourceOnly=reviewDecisionPrinciplePrime(prime,[{behaviourKey:'THREAT_ADAPTATION',verdict:'GOOD',confidence:'HIGH'}]);
  assert.equal(sourceOnly.status,'NOT_OBSERVED');
  assert.equal(sourceOnly.matchedTargetMoments,0);
  const applied=reviewDecisionPrinciplePrime(prime,[{behaviourKey:'CARRY_PRESERVATION',verdict:'GOOD',confidence:'HIGH'}]);
  assert.equal(applied.status,'APPLIED');
  const missed=reviewDecisionPrinciplePrime(prime,[{behaviourKey:'CARRY_PRESERVATION',verdict:'IMPROVE',confidence:'HIGH'}]);
  assert.equal(missed.status,'MISSED');
  assert.match(missed.boundary,/ONLY VERIFIED DIRECT TARGET-BEHAVIOUR/);
});
