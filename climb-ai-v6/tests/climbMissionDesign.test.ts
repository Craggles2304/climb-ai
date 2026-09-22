import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDraftSituationContext} from '../lib/decisionTwin';
import {buildClimbMatchMission,reviewClimbMatchMission} from '../lib/climbMissionDesign';

function lesson(key:any,label:string):any{
  return{
    behaviourKey:key,label,phase:'PRACTISE',readiness:'ACTIVE',confidence:'HIGH',priority:90,
    prerequisite:null,prerequisiteLabel:null,whyNow:'Current Curriculum lesson.',gameRule:'USE THE CLEAN TARGET BRANCH.',
    graduationRule:'PROVE REPEATED CLEAN EXECUTION.',evidence:'Repeated verified evidence.',comparableGames:5,cleanStreak:1,
    memoryStrength:62,transferStrength:null,transferGames:0,transferCleanStreak:0,
    repLadder:{version:1,level:2,maxLevel:5,stage:'EXECUTE',label:'Execute the branch',objective:'Execute the target branch.',difficultyRule:'EXECUTE THE TARGET BRANCH.',promotionGate:'Repeated clean evidence.',demotionRule:'Regression lowers difficulty.',reason:'Synthetic Level 2 fixture.',evidence:'fixture'},
    nextUnlock:null,
  };
}

test('Mission Design turns Carry Preservation into one draft-specific multi-access rep',()=>{
  const situationContext=buildDraftSituationContext({
    champion:'Jinx',
    role:'ADC',
    enemies:[
      {champion:'Nocturne',role:'JUNGLE'},
      {champion:'Rakan',role:'SUPPORT'},
      {champion:'Orianna',role:'MID'},
      {champion:'Ornn',role:'TOP'},
      {champion:'Jhin',role:'ADC'},
    ],
  });
  const mission=buildClimbMatchMission({
    lesson:lesson('CARRY_PRESERVATION','Carry Preservation'),
    situationContext,
    coach:{
      threatAnswer:'HOLD RANGE UNTIL NOCTURNE AND RAKAN SPEND FIRST ACCESS.',
      never:'DO NOT CROSS THE FRONT EDGE TO REACH JHIN.',
      fightTrigger:'NOCTURNE OR RAKAN COMMIT → KITE FIRST → DPS CLOSEST SAFE TARGET.',
    },
    champion:'Jinx',
    role:'ADC',
  });
  assert.ok(mission);
  assert.equal(mission?.status,'READY');
  assert.equal(mission?.targetTag,'MULTI_ACCESS');
  assert.deepEqual(mission?.relevantEnemies.slice(0,2),['Nocturne','Rakan']);
  assert.match(mission?.trigger||'',/Nocturne \+ Rakan/i);
  assert.match(mission?.action||'',/DO NOT CROSS/i);
  assert.match(mission?.successDefinition||'',/GOOD/);
  assert.match(mission?.reviewRule||'',/NOT OBSERVED/);
});

test('Mission Design does not force an Objective Arrival rep into a draft without a relevant setup cue',()=>{
  const situationContext=buildDraftSituationContext({
    champion:'Draven',
    role:'ADC',
    enemies:[
      {champion:'Garen',role:'TOP'},
      {champion:'Master Yi',role:'JUNGLE'},
      {champion:'Corki',role:'MID'},
      {champion:'Ezreal',role:'ADC'},
      {champion:'Soraka',role:'SUPPORT'},
    ],
  });
  const mission=buildClimbMatchMission({
    lesson:lesson('OBJECTIVE_READINESS','Objective Arrival'),
    situationContext,
    coach:{objectiveSetup:'ARRIVE FIRST AND HOLD THE RIVER ENTRANCE.'},
    champion:'Draven',
    role:'ADC',
  });
  assert.equal(mission?.targetTag,'GENERAL');
  assert.equal(mission?.status,'NOT_RELEVANT');
  const review=reviewClimbMatchMission(mission,[]);
  assert.equal(review.status,'NO_MISSION');
  assert.match(review.note,/did not force/i);
});

test('post-game mission review awards execution only from matching verified Decision Graph evidence',()=>{
  const situationContext=buildDraftSituationContext({
    champion:'Jinx',
    role:'ADC',
    enemies:[{champion:'Nocturne'},{champion:'Rakan'}],
  });
  const mission=buildClimbMatchMission({
    lesson:lesson('CARRY_PRESERVATION','Carry Preservation'),
    situationContext,
    coach:{never:'KEEP THE SAFE DAMAGE LINE.'},
    champion:'Jinx',
    role:'ADC',
  });
  const executed=reviewClimbMatchMission(mission,[
    {behaviourKey:'CARRY_PRESERVATION',verdict:'GOOD',confidence:'HIGH',situationTags:['MULTI_ACCESS']},
  ]);
  assert.equal(executed.status,'EXECUTED');
  assert.equal(executed.matchedMoments,1);
  assert.equal(executed.cleanMoments,1);

  const notObserved=reviewClimbMatchMission(mission,[
    {behaviourKey:'CARRY_PRESERVATION',verdict:'GOOD',confidence:'HIGH',situationTags:['GENERAL']},
    {behaviourKey:'FIGHT_SELECTION',verdict:'IMPROVE',confidence:'HIGH',situationTags:['MULTI_ACCESS']},
  ]);
  assert.equal(notObserved.status,'NOT_OBSERVED');
  assert.equal(notObserved.matchedMoments,0);
});

test('mission review distinguishes missed and mixed repetitions',()=>{
  const mission:any={
    version:1,id:'m',status:'READY',behaviourKey:'RESET_DISCIPLINE',behaviourLabel:'Reset Discipline',
    curriculumPhase:'PRACTISE',champion:'Jinx',role:'ADC',targetTag:'GENERAL',title:'Reset Discipline',
    whyThisGame:'x',trigger:'x',action:'x',cue:'x',successDefinition:'x',failureDefinition:'x',
    rehearsalQuestion:'x',relevantEnemies:[],reviewRule:'x',graduationRule:'x',source:'CLIMB_CURRICULUM',boundary:'x',
  };
  const missed=reviewClimbMatchMission(mission,[
    {behaviourKey:'RESET_DISCIPLINE',verdict:'IMPROVE',confidence:'MEDIUM',situationTags:['HIGH_BANK_FIGHT']},
  ]);
  assert.equal(missed.status,'MISSED');

  const mixed=reviewClimbMatchMission(mission,[
    {behaviourKey:'RESET_DISCIPLINE',verdict:'GOOD',confidence:'HIGH',situationTags:['HIGH_BANK_FIGHT']},
    {behaviourKey:'RESET_DISCIPLINE',verdict:'IMPROVE',confidence:'HIGH',situationTags:['GENERAL']},
  ]);
  assert.equal(mixed.status,'MIXED');
  assert.equal(mixed.cleanMoments,1);
  assert.equal(mixed.improveMoments,1);
});

test('draft coach, Decision Graph and Companion share the same frozen CLIMB match mission',()=>{
  const draft=fs.readFileSync('app/api/live/draft-coach/route.ts','utf8');
  const graph=fs.readFileSync('lib/decisionGraph.ts','utf8');
  const companion=fs.readFileSync('companion/electron/remember-v5-esports.js','utf8');
  const review=fs.readFileSync('companion/electron/review-v2-core.js','utf8');
  assert.ok(draft.includes('buildClimbMatchMission'));
  assert.ok(draft.includes('climbMission:input.climbMission'));
  assert.ok(draft.includes('climbMission,'));
  assert.ok(graph.includes('reviewClimbMatchMission(plan?.climbMission,observedDecisions)'));
  assert.ok(graph.includes('climbMission:climbMissionReview'));
  assert.ok(graph.includes('climbMission:raw.climbMission??null'));
  assert.ok(companion.includes('enrichedCoach._climbMission=response?.climbMission||null'));
  assert.ok(companion.includes('climbMission:coach?._climbMission||null'));
  assert.ok(companion.includes("const climbMission=coach?._climbMission||null"));
  assert.ok(companion.includes("coachIntervention?.primaryCue||(climbMission?.status==='READY'"));
  assert.ok(review.includes('CLIMB MISSION · FROZEN REP REVIEW'));
  assert.ok(review.includes('function renderClimbMissionReview'));
  assert.ok(review.includes('MISSION NOT TESTED'));
  assert.ok(review.includes('ONE CLEAN REP ≠ DIFFICULTY PROMOTION OR GRADUATION'));
  assert.ok(review.includes('renderClimbMissionReview(review)'));
});
