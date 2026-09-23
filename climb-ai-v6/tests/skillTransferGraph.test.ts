import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSkillTransferGraph,reviewSkillBridgePrime,selectSkillBridgePrime,skillGraphPriorityBoost} from '../lib/climbSkillTransferGraph';

function twin(active:any[]=[{key:'LEAD_PROTECTION',label:'Lead Protection',priority:70,confidence:'MEDIUM',reason:'limiter'}]){
  return {version:2,gamesAnalyzed:8,identity:{status:'READY'},activeFive:active,targetTwin:{},riskLedger:{},archetypes:[],contextProfiles:[],challenge:null} as any;
}
function memory(cards:any[]){
  return {version:1,gamesAnalyzed:8,generatedAt:'2026-09-23T00:00:00.000Z',cards,dueNextGame:0,mastered:cards.filter(x=>x.state==='MASTERED').length,regressed:0,strongestMemory:cards[0]??null,activeRep:null,summary:'memory',boundary:'b'} as any;
}
function mem(key:string,state:string,direct=5){
  return {id:'memory:'+key.toLowerCase(),behaviourKey:key,behaviourLabel:key,state,confidence:'HIGH',comparableGames:direct,cleanGames:direct,improveGames:0,cleanRate:100,recentComparableGames:4,recentCleanGames:4,recentCleanRate:100,cleanStreak:4,gamesSinceLastSeen:0,reviewIntervalGames:4,gamesUntilReview:4,dueNextGame:false,memoryStrength:88,lastSeenAt:'2026-09-22T00:00:00.000Z',lastVerdict:'GOOD',trigger:'t',oldBranch:'o',targetBranch:'n',evidence:'verified',summary:'stable'};
}
function transfer(cards:any[]=[]){return{version:1,gamesAnalyzed:8,generatedAt:'2026-09-23T00:00:00.000Z',cards,locallyMastered:cards.length,transferring:0,principleOwned:0,regressed:0,activeTransfer:null,summary:'transfer',boundary:'b'} as any}
function row(day:number,nodes:any[],champion='Jinx',role='ADC'){
  return {champion,role,createdAt:new Date(Date.UTC(2026,0,day)).toISOString(),analysis:{version:1,decisionGraph:{nodes}}} as any;
}
function node(key:string,verdict:'GOOD'|'IMPROVE',tags:string[]=['GENERAL']){
  return {behaviourKey:key,verdict,confidence:'HIGH',situationTags:tags};
}

test('designed prerequisite creates a bridge but never inherits target mastery',()=>{
  const rows=[
    row(1,[node('FIGHT_SELECTION','GOOD'),node('LEAD_PROTECTION','IMPROVE')]),
    row(2,[node('FIGHT_SELECTION','GOOD'),node('LEAD_PROTECTION','GOOD')]),
    row(3,[node('FIGHT_SELECTION','GOOD'),node('LEAD_PROTECTION','IMPROVE')]),
    row(4,[node('FIGHT_SELECTION','GOOD'),node('LEAD_PROTECTION','GOOD')]),
  ];
  const graph=buildSkillTransferGraph({
    rows,
    twin:twin(),
    memory:memory([mem('FIGHT_SELECTION','MASTERED'),mem('LEAD_PROTECTION','LEARNING',4)]),
    transfer:transfer(),
  });
  const edge=graph.edges.find(x=>x.source==='FIGHT_SELECTION'&&x.target==='LEAD_PROTECTION'&&x.type==='PREREQUISITE');
  assert.ok(edge);
  assert.equal(edge?.sourceStable,true);
  const target=graph.nodes.find(x=>x.key==='LEAD_PROTECTION');
  assert.equal(target?.state,'LEARNING');
  assert.equal(target?.directGames,4);
  assert.equal(graph.nextBridge?.target,'LEAD_PROTECTION');
  assert.match(graph.boundary,/NEVER TRANSFERS MASTERY/);
});

test('a stable source with zero target evidence cannot create target progress by proxy',()=>{
  const rows=[1,2,3,4].map(day=>row(day,[node('FIGHT_SELECTION','GOOD')]));
  const graph=buildSkillTransferGraph({
    rows,
    twin:twin([]),
    memory:memory([mem('FIGHT_SELECTION','MASTERED')]),
    transfer:transfer(),
  });
  const target=graph.nodes.find(x=>x.key==='LEAD_PROTECTION');
  assert.equal(target?.directGames,0);
  assert.equal(target?.state,'BUILDING');
  assert.equal(graph.bridgeCandidates.some(x=>x.target==='LEAD_PROTECTION'),false);
});

test('observed links require repeated paired evidence and are labelled associative',()=>{
  const rows=[
    row(1,[node('DEATH_RECOVERY','GOOD'),node('OBJECTIVE_READINESS','GOOD')]),
    row(2,[node('DEATH_RECOVERY','GOOD'),node('OBJECTIVE_READINESS','GOOD')]),
    row(3,[node('DEATH_RECOVERY','GOOD'),node('OBJECTIVE_READINESS','GOOD')]),
    row(4,[node('DEATH_RECOVERY','GOOD'),node('OBJECTIVE_READINESS','GOOD')]),
    row(5,[node('DEATH_RECOVERY','IMPROVE'),node('OBJECTIVE_READINESS','IMPROVE')]),
    row(6,[node('DEATH_RECOVERY','IMPROVE'),node('OBJECTIVE_READINESS','IMPROVE')]),
  ];
  const graph=buildSkillTransferGraph({
    rows,
    twin:twin([{key:'OBJECTIVE_READINESS',label:'Objective Arrival',priority:60,confidence:'MEDIUM',reason:'limiter'}]),
    memory:memory([mem('DEATH_RECOVERY','MASTERED'),mem('OBJECTIVE_READINESS','LEARNING',6)]),
    transfer:transfer(),
  });
  const edge=graph.edges.find(x=>x.source==='DEATH_RECOVERY'&&x.target==='OBJECTIVE_READINESS'&&x.type==='OBSERVED_LINK');
  assert.ok(edge);
  assert.equal(edge?.coObservedGames,6);
  assert.equal(edge?.associationLift,100);
  assert.match(edge?.boundary??'',/ASSOCIATIONS, NOT CAUSAL/);
});

test('graph priority boost only applies to an evidence-backed bridge candidate',()=>{
  const rows=[1,2,3,4].map(day=>row(day,[node('FIGHT_SELECTION','GOOD'),node('LEAD_PROTECTION',day%2?'GOOD':'IMPROVE')]));
  const graph=buildSkillTransferGraph({rows,twin:twin(),memory:memory([mem('FIGHT_SELECTION','MASTERED'),mem('LEAD_PROTECTION','LEARNING',4)]),transfer:transfer()});
  assert.ok(skillGraphPriorityBoost(graph,'LEAD_PROTECTION')>0);
  assert.equal(skillGraphPriorityBoost(graph,'DEATH_RECOVERY'),0);
});

test('Skill Bridge prime is selected only for a direct target lesson and relevant draft context',()=>{
  const rows=[1,2,3,4].map(day=>row(day,[node('THREAT_ADAPTATION','GOOD'),node('CARRY_PRESERVATION',day<3?'IMPROVE':'GOOD')]));
  const graph=buildSkillTransferGraph({
    rows,
    twin:twin([{key:'CARRY_PRESERVATION',label:'Carry Preservation',priority:80,confidence:'MEDIUM',reason:'limiter'}]),
    memory:memory([mem('THREAT_ADAPTATION','MASTERED'),mem('CARRY_PRESERVATION','LEARNING',4)]),
    transfer:transfer(),
  });
  const prime=selectSkillBridgePrime({graph,behaviourKey:'CARRY_PRESERVATION',situationContext:{tags:['MULTI_ACCESS'],champion:'Jinx',role:'ADC',enemyAccess:['Nocturne'],enemyPicks:[],enemyZones:[]}});
  assert.ok(prime);
  assert.equal(prime?.source,'THREAT_ADAPTATION');
  assert.equal(prime?.target,'CARRY_PRESERVATION');
  assert.match(prime?.boundary??'',/only direct verified Carry Preservation evidence/i);
});

test('Skill Bridge review scores only direct target nodes',()=>{
  const prime={
    version:1,active:true,source:'FIGHT_SELECTION',sourceLabel:'Fight Selection',target:'LEAD_PROTECTION',targetLabel:'Lead Protection',
    edgeType:'PREREQUISITE',edgeStrength:92,title:'bridge',inheritedPrinciple:'source',targetQuestion:'target?',exactDraftRead:'draft',
    relevantTags:['LEAD_CONVERSION'],evidence:'evidence',boundary:'b'
  } as any;
  const sourceOnly=reviewSkillBridgePrime(prime,[{behaviourKey:'FIGHT_SELECTION',verdict:'GOOD',confidence:'HIGH'}] as any);
  assert.equal(sourceOnly.status,'NOT_OBSERVED');
  assert.equal(sourceOnly.matchedTargetMoments,0);
  const clean=reviewSkillBridgePrime(prime,[{behaviourKey:'FIGHT_SELECTION',verdict:'GOOD',confidence:'HIGH'},{behaviourKey:'LEAD_PROTECTION',verdict:'GOOD',confidence:'HIGH'}] as any);
  assert.equal(clean.status,'BRIDGED');
  assert.equal(clean.cleanTargetMoments,1);
  const miss=reviewSkillBridgePrime(prime,[{behaviourKey:'LEAD_PROTECTION',verdict:'IMPROVE',confidence:'HIGH'}] as any);
  assert.equal(miss.status,'MISSED');
  assert.match(miss.boundary,/cannot pass or graduate the target/i);
});
