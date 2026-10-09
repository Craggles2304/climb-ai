import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningLadder,LADDER} from '../lib/dashboard/learningLadder';
import type {DecisionTransferCard} from '../lib/decisionTransfer';
import type {ScenarioMemoryCard} from '../lib/scenarioMemory';

function transferCard(overrides:Partial<DecisionTransferCard>):DecisionTransferCard{
  return{
    id:'transfer:carry_preservation',behaviourKey:'CARRY_PRESERVATION',behaviourLabel:'Carry Preservation',
    state:'LOCAL_ONLY',confidence:'MEDIUM',sourceMemoryId:'mem-1',sourceTag:'HIGH_VALUE_CARRY',sourceChampion:'Aphelios',
    sourceRole:'ADC',sourceStrength:82,sourceMasteredGame:9,principle:'Do not commit while another threat can still reach you.',
    transferGames:0,cleanTransferGames:0,improveTransferGames:0,transferCleanRate:null,recentTransferGames:0,recentCleanRate:null,
    transferCleanStreak:0,novelChampions:[],novelContexts:[],dimension:'NONE',breadthScore:0,transferStrength:0,
    lastTransferAt:null,nextTransferNeeded:true,summary:'Mastered on Aphelios.',evidence:'4 clean high-value-carry fights on Aphelios.',
    ...overrides,
  };
}
function memoryCard(overrides:Partial<ScenarioMemoryCard>):ScenarioMemoryCard{
  return{
    id:'mem-2',behaviourKey:'RESET_DISCIPLINE',behaviourLabel:'Reset Discipline',situationTag:'HIGH_BANK_FIGHT',state:'LEARNING',
    confidence:'MEDIUM',comparableGames:5,cleanGames:2,improveGames:3,cleanRate:40,recentComparableGames:3,recentCleanGames:1,
    recentCleanRate:33,cleanStreak:0,gamesSinceLastSeen:1,reviewIntervalGames:2,gamesUntilReview:1,dueNextGame:false,
    memoryStrength:38,lastSeenAt:'2026-10-08T12:00:00.000Z',lastVerdict:'IMPROVE',trigger:'1,200+ gold and a fight starting',
    oldBranch:'Fight with the gold',targetBranch:'Reset first',evidence:'2 of 5 comparable situations were clean.',summary:'Learning.',
    ...overrides,
  };
}

test('the ladder has the seven Decision Twin V5 stages in order',()=>{
  assert.deepEqual([...LADDER],['MISTAKE','REPEATED PATTERN','SCENARIO MEMORY','LOCAL MASTERY','TRANSFER','GENERALISATION','PRINCIPLE OWNED']);
});

test('a lesson learned on Aphelios is LOCAL ONLY until another champion shows it',()=>{
  const ladder=buildLearningLadder({decisionTransfer:{version:1,gamesAnalyzed:14,generatedAt:'',cards:[transferCard({})],locallyMastered:1,transferring:0,principleOwned:0,regressed:0,activeTransfer:null,summary:'',boundary:''}});
  const row=ladder!.rows[0];
  assert.equal(row.status,'LOCAL_ONLY');
  assert.equal(LADDER[row.reached],'LOCAL MASTERY');
  assert.equal(LADDER[row.working!],'TRANSFER');
  assert.equal(row.sourceChampion,'Aphelios');
  assert.deepEqual(row.testedOn,[]);
  assert.match(row.next,/Not yet seen on another champion/);
});

test('one unclean Jinx test is TESTING, not TRANSFERRED',()=>{
  const card=transferCard({state:'TESTING',transferGames:2,cleanTransferGames:1,improveTransferGames:1,novelChampions:['Jinx'],dimension:'CHAMPION'});
  const row=buildLearningLadder({decisionTransfer:{version:1,gamesAnalyzed:16,generatedAt:'',cards:[card],locallyMastered:1,transferring:0,principleOwned:0,regressed:0,activeTransfer:null,summary:'',boundary:''}})!.rows[0];
  assert.equal(row.status,'TESTING');
  assert.equal(LADDER[row.reached],'LOCAL MASTERY');
  assert.deepEqual(row.testedOn,['Jinx']);
  assert.match(row.next,/1\/2 clean/);
});

test('transfer, generalisation and ownership each need their own evidence state',()=>{
  const cards=[
    transferCard({behaviourKey:'CARRY_PRESERVATION',state:'TRANSFERRING',novelChampions:['Jinx'],cleanTransferGames:2,transferGames:2}),
    transferCard({behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',state:'GENERALISING',novelChampions:['Jinx',"Kai'Sa"]}),
    transferCard({behaviourKey:'LEAD_PROTECTION',behaviourLabel:'Lead Protection',state:'PRINCIPLE_OWNED',novelChampions:['Jinx','Ezreal'],novelContexts:['LEAD_CONVERSION']}),
  ];
  const ladder=buildLearningLadder({decisionTransfer:{version:1,gamesAnalyzed:30,generatedAt:'',cards,locallyMastered:0,transferring:2,principleOwned:1,regressed:0,activeTransfer:null,summary:'',boundary:''}},6)!;
  const byKey=Object.fromEntries(ladder.rows.map(row=>[row.behaviourKey,row]));
  assert.equal(byKey.CARRY_PRESERVATION.status,'TRANSFERRED');
  assert.equal(LADDER[byKey.CARRY_PRESERVATION.reached],'TRANSFER');
  assert.equal(byKey.FIGHT_SELECTION.status,'GENERALISING');
  assert.equal(LADDER[byKey.FIGHT_SELECTION.reached],'GENERALISATION');
  assert.equal(byKey.LEAD_PROTECTION.status,'PRINCIPLE_OWNED');
  assert.equal(LADDER[byKey.LEAD_PROTECTION.reached],'PRINCIPLE OWNED');
  assert.equal(byKey.LEAD_PROTECTION.working,null);
  assert.deepEqual(ladder.counts,{localOnly:0,testing:0,transferred:2,principleOwned:1,regressed:0});
});

test('scenario memory without a transfer card never claims mastery it has not shown',()=>{
  const ladder=buildLearningLadder({scenarioMemory:{version:1,gamesAnalyzed:9,generatedAt:'',cards:[memoryCard({}),memoryCard({id:'mem-3',behaviourKey:'FIGHT_SELECTION',state:'BUILDING'})],dueNextGame:0,mastered:0,regressed:0,strongestMemory:null,activeRep:null,summary:'',boundary:''}})!;
  assert.equal(ladder.rows.length,1,'BUILDING memories are not promoted');
  assert.equal(LADDER[ladder.rows[0].reached],'SCENARIO MEMORY');
  assert.equal(ladder.rows[0].status,'NOT_READY');
});

test('no payload or no evidence yields no invented rows',()=>{
  assert.equal(buildLearningLadder(null),null);
  const empty=buildLearningLadder({twin:null,scenarioMemory:null,decisionTransfer:null})!;
  assert.deepEqual(empty.rows,[]);
  assert.equal(empty.gamesAnalyzed,0);
});
