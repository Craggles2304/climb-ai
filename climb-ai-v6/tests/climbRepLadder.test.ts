import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClimbRepLadder} from '../lib/climbRepLadder';
import {buildClimbMatchMission,reviewClimbMatchMission} from '../lib/climbMissionDesign';
import {buildDraftSituationContext} from '../lib/decisionTwin';

function evidence(overrides:any={}):any{
  return{
    behaviourKey:'CARRY_PRESERVATION',
    phase:'FOUNDATION',
    comparableGames:0,
    cleanStreak:0,
    memoryStrength:null,
    transferGames:0,
    transferCleanStreak:0,
    transferStrength:null,
    ...overrides,
  };
}
function lesson(rep:any):any{
  return{
    behaviourKey:'CARRY_PRESERVATION',label:'Carry Preservation',phase:rep.level>=4?'TRANSFER':'PRACTISE',
    readiness:'ACTIVE',confidence:'HIGH',priority:90,prerequisite:null,prerequisiteLabel:null,
    whyNow:'Current Curriculum lesson.',gameRule:'KEEP THE SAFE DAMAGE LINE.',graduationRule:'Repeated evidence required.',
    evidence:'synthetic career',comparableGames:5,cleanStreak:2,memoryStrength:70,transferStrength:0,transferGames:0,
    transferCleanStreak:0,repLadder:rep,nextUnlock:null,
  };
}

test('fake career raises Rep Ladder difficulty only after repeated evidence',()=>{
  const snapshots=[
    buildClimbRepLadder(evidence({phase:'FOUNDATION'})),
    buildClimbRepLadder(evidence({phase:'PRACTISE',comparableGames:3,cleanStreak:1,memoryStrength:48})),
    buildClimbRepLadder(evidence({phase:'PRACTISE',comparableGames:4,cleanStreak:2,memoryStrength:68})),
    buildClimbRepLadder(evidence({phase:'TRANSFER',comparableGames:5,cleanStreak:4,memoryStrength:92,transferGames:0,transferStrength:0})),
    buildClimbRepLadder(evidence({phase:'TRANSFER',comparableGames:5,cleanStreak:4,memoryStrength:92,transferGames:3,transferCleanStreak:2,transferStrength:74})),
  ];
  assert.deepEqual(snapshots.map(item=>item.level),[1,2,3,4,5]);
  assert.deepEqual(snapshots.map(item=>item.stage),['RECOGNISE','EXECUTE','STABILISE','ADAPT','TRANSFER']);
});

test('one clean fake game cannot raise difficulty',()=>{
  const rep=buildClimbRepLadder(evidence({phase:'PRACTISE',comparableGames:1,cleanStreak:1,memoryStrength:100}));
  assert.equal(rep.level,1);
  assert.match(rep.promotionGate,/3 comparable/i);
});

test('verified regression deliberately lowers difficulty before complexity returns',()=>{
  const before=buildClimbRepLadder(evidence({phase:'TRANSFER',comparableGames:8,cleanStreak:4,memoryStrength:92,transferGames:4,transferCleanStreak:3,transferStrength:82}));
  const reopened=buildClimbRepLadder(evidence({phase:'REOPEN',comparableGames:9,cleanStreak:0,memoryStrength:52,transferGames:4,transferCleanStreak:0,transferStrength:48}));
  assert.equal(before.level,5);
  assert.equal(reopened.level,2);
  assert.match(reopened.reason,/reduced the difficulty/i);
});

test('Level 5 mission only activates when a matching frozen transfer test exists',()=>{
  const rep=buildClimbRepLadder(evidence({phase:'TRANSFER',comparableGames:6,cleanStreak:4,memoryStrength:95,transferGames:3,transferCleanStreak:2,transferStrength:76}));
  const situationContext=buildDraftSituationContext({
    champion:'Jinx',role:'ADC',
    enemies:[{champion:'Nocturne',role:'JUNGLE'},{champion:'Rakan',role:'SUPPORT'}],
  });
  const noTransfer=buildClimbMatchMission({
    lesson:lesson(rep),
    situationContext,
    coach:{never:'KEEP THE SAFE DAMAGE LINE.'},
    champion:'Jinx',
    role:'ADC',
  });
  assert.equal(noTransfer?.repLevel,5);
  assert.equal(noTransfer?.status,'NOT_RELEVANT');

  const withTransfer=buildClimbMatchMission({
    lesson:lesson(rep),
    situationContext,
    coach:{never:'KEEP THE SAFE DAMAGE LINE.'},
    champion:'Jinx',
    role:'ADC',
    transferPrime:{
      version:1,transferId:'tx:carry',behaviourKey:'CARRY_PRESERVATION',behaviourLabel:'Carry Preservation',
      sourceMemoryId:'m:carry',sourceTag:'MULTI_ACCESS',sourceChampion:'Aphelios',targetTag:'PICK_PRESSURE',
      targetChampion:'Jinx',targetRole:'ADC',dimension:'BOTH',state:'GENERALISING',confidence:'HIGH',transferStrength:76,
      title:'Novel carry preservation',principle:'Preserve safe damage access.',trigger:'WHEN RAKAN HOLDS PICK ACCESS AFTER FIRST CONTACT.',
      targetMove:'HOLD THE SAFE LINE UNTIL RAKAN ACCESS IS SPENT.',exactDraftRead:'Different access order.',whyNow:'Novel test.',
      rehearsalQuestion:'What changes?',evidence:'3 novel games',simulationScenarioId:null,boundary:'Frozen before play.',
    },
  });
  assert.equal(withTransfer?.status,'READY');
  assert.equal(withTransfer?.targetTag,'PICK_PRESSURE');
  assert.equal(withTransfer?.trigger,'WHEN RAKAN HOLDS PICK ACCESS AFTER FIRST CONTACT.');
  assert.equal(withTransfer?.action,'HOLD THE SAFE LINE UNTIL RAKAN ACCESS IS SPENT.');
  assert.match(withTransfer?.title||'',/REP 5\/5 · TRANSFER/);
});

test('post-game Level 3 execution preserves level but does not auto-promote',()=>{
  const rep=buildClimbRepLadder(evidence({phase:'PRACTISE',comparableGames:4,cleanStreak:2,memoryStrength:68}));
  const situationContext=buildDraftSituationContext({
    champion:'Jinx',role:'ADC',
    enemies:[{champion:'Nocturne'},{champion:'Rakan'}],
  });
  const mission=buildClimbMatchMission({
    lesson:lesson(rep),situationContext,coach:{never:'KEEP THE SAFE DAMAGE LINE.'},champion:'Jinx',role:'ADC',
  });
  const review=reviewClimbMatchMission(mission,[{
    behaviourKey:'CARRY_PRESERVATION',verdict:'GOOD',confidence:'HIGH',situationTags:['MULTI_ACCESS'],
  }]);
  assert.equal(review.status,'EXECUTED');
  assert.equal(review.repLevel,3);
  assert.equal(review.repStage,'STABILISE');
  assert.match(review.note,/does not raise difficulty by itself/i);
});
