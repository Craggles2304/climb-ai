import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildClimbCurriculum} from '../lib/climbCurriculum';

function twin(active:any[],games=8):any{
  return{
    version:2,baseVersion:1,generatedAt:'2026-09-21T12:00:00.000Z',gamesAnalyzed:games,
    identity:{status:'READY',headline:'TEST',summary:'',confidence:'HIGH',primary:null,strongest:null},
    archetypes:[],contextProfiles:[],activeFive:active,targetTwin:{label:'NEXT TWIN',currentAverage:50,targetAverage:65,metrics:[],rule:''},
    riskLedger:{frozenRiskMaps:0,forecastRisks:0,observedRisks:0,hitRisks:0,beatenRisks:0,mixedRisks:0,unobservedRisks:0,observedRate:null,hitShare:null,beatShare:null,boundary:''},
    challenge:null,
  };
}
function focus(key:string,priority=90):any{
  return{rank:1,key,label:key.replaceAll('_',' '),status:'FIX_NOW',priority,confidence:'HIGH',currentScore:42,targetScore:62,trend:'WORSENING',state:'LIMITER',situationTag:null,reason:'Repeated limiter.',rule:'RULE '+key,evidence:'8 games'};
}
function memory(cards:any[]):any{
  return{version:1,gamesAnalyzed:8,generatedAt:'x',cards,dueNextGame:0,mastered:0,regressed:0,strongestMemory:null,activeRep:null,summary:'',boundary:''};
}
function card(key:string,state:string,extra:any={}):any{
  return{
    id:'m:'+key,behaviourKey:key,behaviourLabel:key.replaceAll('_',' '),situationTag:'GENERAL',state,confidence:'HIGH',
    comparableGames:5,cleanGames:3,improveGames:2,cleanRate:60,recentComparableGames:4,recentCleanGames:3,recentCleanRate:75,
    cleanStreak:2,gamesSinceLastSeen:0,reviewIntervalGames:0,gamesUntilReview:0,dueNextGame:true,memoryStrength:68,lastSeenAt:'x',
    lastVerdict:'GOOD',trigger:'trigger',oldBranch:'old',targetBranch:'target',evidence:'5 comparable games',summary:'',...extra,
  };
}
function transfer(cards:any[]):any{
  return{version:1,gamesAnalyzed:8,generatedAt:'x',cards,locallyMastered:cards.length,transferring:0,principleOwned:0,regressed:0,activeTransfer:null,summary:'',boundary:''};
}
function tx(key:string,state:string,strength=60):any{
  return{id:'t:'+key,behaviourKey:key,behaviourLabel:key.replaceAll('_',' '),state,confidence:'HIGH',sourceMemoryId:'m:'+key,sourceTag:'GENERAL',
    sourceChampion:'Jinx',sourceRole:'ADC',sourceStrength:90,sourceMasteredGame:4,principle:'principle',transferGames:3,cleanTransferGames:2,
    improveTransferGames:1,transferCleanRate:67,recentTransferGames:3,recentCleanRate:67,transferCleanStreak:2,novelChampions:['Ashe'],
    novelContexts:['PICK_PRESSURE'],dimension:'BOTH',breadthScore:2,transferStrength:strength,lastTransferAt:'x',nextTransferNeeded:true,summary:'',evidence:'3 novel games'};
}

function previous(key:string):any{
  return{
    version:1,generatedAt:'old',gamesAnalyzed:7,status:'ACTIVE',
    currentLesson:{behaviourKey:key},
    nextLesson:null,queue:[],graduated:[],
    decision:{action:'KEEP',previousLesson:key,currentLesson:key,changed:false,reason:'old'},
    summary:'',boundary:'',
  };
}

test('curriculum teaches Reset Discipline before Power-Spike Conversion when prerequisite is unstable',()=>{
  const result=buildClimbCurriculum(
    twin([focus('POWER_SPIKE_CONVERSION',100),focus('RESET_DISCIPLINE',70)]),
    memory([card('RESET_DISCIPLINE','DUE'),card('POWER_SPIKE_CONVERSION','DUE')]),
    transfer([]),
  );
  assert.equal(result.currentLesson?.behaviourKey,'RESET_DISCIPLINE');
  const power=result.queue.find((item:any)=>item.behaviourKey==='POWER_SPIKE_CONVERSION');
  assert.ok(power);
  assert.equal(power.readiness,'LOCKED');
  assert.equal(power.prerequisite,'RESET_DISCIPLINE');
  assert.match(power.whyNow,/prerequisite/i);
});

test('locally mastered lesson moves into transfer instead of being called graduated',()=>{
  const result=buildClimbCurriculum(
    twin([focus('CARRY_PRESERVATION',90)]),
    memory([card('THREAT_ADAPTATION','MASTERED',{memoryStrength:92,cleanStreak:4}),card('CARRY_PRESERVATION','MASTERED',{memoryStrength:90,cleanStreak:4})]),
    transfer([tx('CARRY_PRESERVATION','LOCAL_ONLY',0)]),
  );
  const lesson=result.queue.find((item:any)=>item.behaviourKey==='CARRY_PRESERVATION');
  assert.ok(lesson);
  assert.equal(lesson.phase,'TRANSFER');
  assert.notEqual(lesson.readiness,'COMPLETE');
  assert.match(lesson.graduationRule,/novel/i);
});

test('principle-owned lesson graduates and no longer blocks the active queue',()=>{
  const result=buildClimbCurriculum(
    twin([focus('THREAT_ADAPTATION',80),focus('CARRY_PRESERVATION',75)]),
    memory([
      card('THREAT_ADAPTATION','MASTERED',{memoryStrength:95,cleanStreak:5}),
      card('CARRY_PRESERVATION','MASTERED',{memoryStrength:94,cleanStreak:4}),
    ]),
    transfer([tx('THREAT_ADAPTATION','PRINCIPLE_OWNED',95),tx('CARRY_PRESERVATION','PRINCIPLE_OWNED',93)]),
  );
  assert.equal(result.queue.length,0);
  assert.equal(result.graduated.length,2);
  assert.equal(result.status,'COMPLETE');
});

test('regression reopens a lesson even after prior progress',()=>{
  const result=buildClimbCurriculum(
    twin([focus('FIGHT_SELECTION',90)]),
    memory([card('FIGHT_SELECTION','REGRESSED',{memoryStrength:55,lastVerdict:'IMPROVE'})]),
    transfer([]),
  );
  assert.equal(result.currentLesson?.phase,'REOPEN');
  assert.match(result.currentLesson?.whyNow||'',/returned/i);
  assert.match(result.currentLesson?.graduationRule||'',/three clean comparable/i);
});

test('curriculum will not claim a teaching sequence from too little history',()=>{
  const result=buildClimbCurriculum(
    twin([focus('FIGHT_SELECTION')],2),
    memory([card('FIGHT_SELECTION','BUILDING',{comparableGames:1,confidence:'LOW'})]),
    transfer([]),
  );
  assert.equal(result.status,'BUILDING');
  assert.match(result.summary,/still building/i);
  assert.match(result.boundary,/one clean game cannot graduate/i);
});


test('foundation prerequisite becomes the current lesson even before it has its own repeated memory',()=>{
  const result=buildClimbCurriculum(
    twin([focus('POWER_SPIKE_CONVERSION',100)]),
    memory([card('POWER_SPIKE_CONVERSION','DUE')]),
    transfer([]),
  );
  assert.equal(result.currentLesson?.behaviourKey,'RESET_DISCIPLINE');
  assert.equal(result.currentLesson?.phase,'FOUNDATION');
  assert.match(result.currentLesson?.whyNow||'',/unlock/i);
  const power=result.queue.find((item:any)=>item.behaviourKey==='POWER_SPIKE_CONVERSION');
  assert.equal(power?.readiness,'LOCKED');
});

test('curriculum keeps one sticky active objective until its graduation gate is met',()=>{
  const result=buildClimbCurriculum(
    twin([focus('POWER_SPIKE_CONVERSION',100),focus('FIGHT_SELECTION',60)]),
    memory([
      card('RESET_DISCIPLINE','MASTERED',{memoryStrength:92,cleanStreak:4}),
      card('POWER_SPIKE_CONVERSION','DUE'),
      card('FIGHT_SELECTION','DUE'),
    ]),
    transfer([]),
    '2026-09-21T13:00:00.000Z',
    previous('FIGHT_SELECTION'),
  );
  assert.equal(result.currentLesson?.behaviourKey,'FIGHT_SELECTION');
  assert.equal(result.decision.action,'KEEP');
  assert.equal(result.decision.changed,false);
  assert.equal(result.queue.filter((item:any)=>item.readiness==='ACTIVE').length,1);
  assert.equal(result.queue.find((item:any)=>item.behaviourKey==='POWER_SPIKE_CONVERSION')?.readiness,'READY');
});

test('Rep Ledger preserves earned difficulty when a lesson leaves and later re-enters the visible queue',()=>{
  const prior:any=previous('DEATH_RECOVERY');
  prior.currentLesson.repLadder={level:2};
  prior.repLedger={FIGHT_SELECTION:4,DEATH_RECOVERY:2};
  prior.queue=[prior.currentLesson];

  const result=buildClimbCurriculum(
    twin([focus('FIGHT_SELECTION',90)]),
    memory([card('FIGHT_SELECTION','DUE',{cleanStreak:0,memoryStrength:55,lastVerdict:'IMPROVE'})]),
    transfer([]),
    '2026-09-21T13:00:00.000Z',
    prior,
  );

  const fight=result.currentLesson?.behaviourKey==='FIGHT_SELECTION'
    ?result.currentLesson
    :result.queue.find((item:any)=>item.behaviourKey==='FIGHT_SELECTION');
  assert.ok(fight);
  assert.equal(fight?.repLadder.level,4);
  assert.equal(result.repLedger.FIGHT_SELECTION,4);
});

test('curriculum preserves earned Rep Ladder difficulty through an isolated miss',()=>{
  const prior:any=previous('FIGHT_SELECTION');
  prior.currentLesson.repLadder={level:4};
  const result=buildClimbCurriculum(
    twin([focus('FIGHT_SELECTION',90)]),
    memory([card('FIGHT_SELECTION','DUE',{cleanStreak:0,memoryStrength:58,lastVerdict:'IMPROVE'})]),
    transfer([]),
    '2026-09-21T13:00:00.000Z',
    prior,
  );
  assert.equal(result.currentLesson?.behaviourKey,'FIGHT_SELECTION');
  assert.equal(result.currentLesson?.phase,'PRACTISE');
  assert.equal(result.currentLesson?.repLadder.level,4);
  assert.match(result.currentLesson?.repLadder.reason||'',/do not erase earned difficulty|hold this level/i);
});

test('curriculum steps down only one Rep Ladder layer after sustained verified regression',()=>{
  const prior:any=previous('FIGHT_SELECTION');
  prior.currentLesson.repLadder={level:5};
  const result=buildClimbCurriculum(
    twin([focus('FIGHT_SELECTION',90)]),
    memory([card('FIGHT_SELECTION','REGRESSED',{cleanStreak:0,memoryStrength:48,lastVerdict:'IMPROVE'})]),
    transfer([]),
    '2026-09-21T13:00:00.000Z',
    prior,
  );
  assert.equal(result.currentLesson?.phase,'REOPEN');
  assert.equal(result.currentLesson?.repLadder.level,4);
});

test('graduation advances the curriculum to the next unlocked lesson',()=>{
  const result=buildClimbCurriculum(
    twin([focus('CARRY_PRESERVATION',90),focus('FIGHT_SELECTION',80)]),
    memory([
      card('THREAT_ADAPTATION','MASTERED',{memoryStrength:95,cleanStreak:5}),
      card('CARRY_PRESERVATION','MASTERED',{memoryStrength:94,cleanStreak:5}),
      card('FIGHT_SELECTION','DUE'),
    ]),
    transfer([tx('CARRY_PRESERVATION','PRINCIPLE_OWNED',95)]),
    '2026-09-21T13:00:00.000Z',
    previous('CARRY_PRESERVATION'),
  );
  assert.equal(result.currentLesson?.behaviourKey,'FIGHT_SELECTION');
  assert.equal(result.decision.action,'ADVANCE');
  assert.equal(result.decision.previousLesson,'CARRY_PRESERVATION');
  assert.equal(result.decision.changed,true);
});

test('a broken prerequisite takes control before the downstream lesson can continue',()=>{
  const result=buildClimbCurriculum(
    twin([focus('POWER_SPIKE_CONVERSION',100),focus('RESET_DISCIPLINE',90)]),
    memory([
      card('RESET_DISCIPLINE','REGRESSED',{lastVerdict:'IMPROVE'}),
      card('POWER_SPIKE_CONVERSION','DUE'),
    ]),
    transfer([]),
    '2026-09-21T13:00:00.000Z',
    previous('POWER_SPIKE_CONVERSION'),
  );
  assert.equal(result.currentLesson?.behaviourKey,'RESET_DISCIPLINE');
  assert.equal(result.decision.action,'PREREQUISITE');
  assert.equal(result.queue.find((item:any)=>item.behaviourKey==='POWER_SPIKE_CONVERSION')?.readiness,'LOCKED');
});

test('a verified higher-priority regression can interrupt the sticky lesson',()=>{
  const result=buildClimbCurriculum(
    twin([focus('DEATH_RECOVERY',90),focus('FIGHT_SELECTION',70)]),
    memory([
      card('DEATH_RECOVERY','REGRESSED',{lastVerdict:'IMPROVE'}),
      card('FIGHT_SELECTION','DUE'),
    ]),
    transfer([]),
    '2026-09-21T13:00:00.000Z',
    previous('FIGHT_SELECTION'),
  );
  assert.equal(result.currentLesson?.behaviourKey,'DEATH_RECOVERY');
  assert.equal(result.decision.action,'REOPEN');
  assert.equal(result.decision.changed,true);
});

test('building status does not secretly assign an active lesson',()=>{
  const result=buildClimbCurriculum(
    twin([focus('FIGHT_SELECTION')],2),
    memory([card('FIGHT_SELECTION','BUILDING',{comparableGames:1,confidence:'LOW'})]),
    transfer([]),
    '2026-09-21T13:00:00.000Z',
    previous('FIGHT_SELECTION'),
  );
  assert.equal(result.status,'BUILDING');
  assert.equal(result.currentLesson,null);
  assert.equal(result.decision.action,'BUILDING');
  assert.equal(result.queue.filter((item:any)=>item.readiness==='ACTIVE').length,0);
});

test('Progress, API and learning snapshot expose one evidence-gated Curriculum',()=>{
  const component=fs.readFileSync('components/DecisionTwinCommandCenter.tsx','utf8');
  const route=fs.readFileSync('app/api/decision-twin/route.ts','utf8');
  const draft=fs.readFileSync('app/api/live/draft-coach/route.ts','utf8');
  const repo=fs.readFileSync('lib/server/proLearningRepository.ts','utf8');
  assert.ok(component.includes('CLIMB CURRICULUM'));
  assert.ok(component.includes('CURRENT LESSON'));
  assert.ok(component.includes('GRADUATION TEST'));
  assert.ok(component.includes('NEXT UNLOCK'));
  assert.ok(component.includes('CURRICULUM DECISION'));
  assert.ok(route.includes("select('recent_change')"));
  assert.ok(route.includes('buildClimbCurriculum(twin,scenarioMemory,decisionTransfer,undefined,previousCurriculum)'));
  assert.ok(route.includes('curriculum,'));
  assert.ok(repo.includes("select('recent_change')"));
  assert.ok(repo.includes('buildClimbCurriculum(decisionTwinV2,scenarioMemory,decisionTransfer,now,previousCurriculum)'));
  assert.ok(repo.includes('scenarioMemory,decisionTransfer,curriculum,generatedAt:now'));
  assert.ok(draft.includes("select('learning_identity,recent_change')"));
  assert.ok(draft.includes('buildClimbCurriculum(decisionTwinV2,scenarioMemory,decisionTransfer,undefined,previousCurriculum)'));
  assert.ok(draft.includes("source:'CLIMB_CURRICULUM'"));
  assert.ok(draft.includes('Do not force the current development focus into an irrelevant draft'));
});
