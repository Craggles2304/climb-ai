import test from 'node:test';
import assert from 'node:assert/strict';
import type {ILPTask} from '../lib/types';
import {buildCoachMemoryCandidates,mergeCoachMemoryEvidence} from '../lib/coachMemoryModel';

const mission:ILPTask={
  id:'dna-strand-adc-teamfights-1',accountId:'a',title:'Survive the first threat cycle',dnaDomain:'TEAMFIGHTS',category:'TEAMFIGHTING',why:'',gameRule:'Wait out the first threat.',metric:'survival_value',target:'3 proven games',progress:100,status:'MASTERED',source:'SYSTEM',evidence:[],roleScope:'ADC',roleEvidence:['ADC'],masteryRequired:3,
  missionHistory:[
    {matchId:'m1',at:'2026-10-01T00:00:00.000Z',adherence:'TRACKED',clearedBar:true,outcome:'CONFIRMED',banksPass:true},
    {matchId:'m2',at:'2026-10-02T00:00:00.000Z',adherence:'TRACKED',clearedBar:true,outcome:'CONFIRMED',banksPass:true},
    {matchId:'m3',at:'2026-10-03T00:00:00.000Z',adherence:'TRACKED',clearedBar:true,outcome:'CONFIRMED',banksPass:true},
  ],
};

test('Coach Memory keeps mission mastery as durable role-specific history',()=>{
  const rows=buildCoachMemoryCandidates({tasks:[mission],roleProfiles:{},now:'2026-10-05T00:00:00.000Z'});
  const memory=rows.find(row=>row.key.includes('mission:ADC'))!;
  assert.equal(memory.type,'MASTERY');
  assert.equal(memory.status,'MASTERED');
  assert.equal(memory.memoryState,'MASTERED');
  assert.equal(memory.role,'ADC');
  assert.equal((memory.snapshot as any).confirmed,3);
});

test('Coach Memory stores regression and transfer without erasing prior mastery',()=>{
  const roleProfiles={ADC:{gamesAnalyzed:20,recentChange:{generatedAt:'2026-10-05T00:00:00.000Z',scenarioMemory:{cards:[{id:'memory:carry:general',behaviourKey:'CARRY_PRESERVATION',behaviourLabel:'Carry Preservation',situationTag:'GENERAL',state:'REGRESSED',confidence:'HIGH',comparableGames:10,cleanGames:7,cleanRate:70,recentCleanRate:25,memoryStrength:58,lastSeenAt:'2026-10-04T00:00:00.000Z',lastVerdict:'IMPROVE',summary:'Carry Preservation had stabilised, but comparable mistakes have returned.',trigger:'Enemy access opens.',targetBranch:'Preserve the safe damage line.',evidence:'10 comparable games'}]},decisionTransfer:{cards:[{id:'transfer:carry',behaviourKey:'CARRY_PRESERVATION',behaviourLabel:'Carry Preservation',state:'PRINCIPLE_OWNED',confidence:'HIGH',sourceChampion:'Caitlyn',sourceTag:'GENERAL',dimension:'BOTH',transferGames:6,cleanTransferGames:5,transferCleanRate:83,recentCleanRate:100,transferStrength:88,breadthScore:4,novelChampions:['Jinx'],novelContexts:['DIVE'],principle:'Preserve safe damage access.',summary:'Carry Preservation has transferred across novel conditions.',evidence:'6 transfer games',lastTransferAt:'2026-10-04T00:00:00.000Z'}]}}}};
  const rows=buildCoachMemoryCandidates({tasks:[mission],roleProfiles,now:'2026-10-05T00:00:00.000Z'});
  const regression=rows.find(row=>row.key.includes('scenario:ADC'))!;
  const transfer=rows.find(row=>row.key.includes('transfer:ADC'))!;
  assert.equal(regression.memoryState,'REGRESSED');
  assert.equal(regression.status,'ACTIVE');
  assert.equal(transfer.memoryState,'PRINCIPLE_OWNED');
  assert.equal(transfer.status,'MASTERED');
});

test('Coach Memory evidence only appends when the state fingerprint changes',()=>{
  const first={fingerprint:'x',at:'a'};
  const same=mergeCoachMemoryEvidence([first],{fingerprint:'x',at:'b'});
  assert.equal(same.changed,false);
  assert.equal(same.evidence.length,1);
  const changed=mergeCoachMemoryEvidence([first],{fingerprint:'y',at:'c'});
  assert.equal(changed.changed,true);
  assert.equal(changed.evidence.length,2);
});