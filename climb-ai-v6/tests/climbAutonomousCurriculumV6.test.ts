import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runClimbAutonomousCurriculumBench} from '../lib/climbAutonomousCurriculumBench';
import {buildClimbAutonomousCurriculum} from '../lib/climbAutonomousCurriculumV6';
import {buildClimbMatchMission} from '../lib/climbMissionDesign';
import {buildDraftSituationContext} from '../lib/decisionTwin';

function lesson(phase='TRANSFER'):any{
  return{
    behaviourKey:'CARRY_PRESERVATION',label:'Carry Preservation',phase,readiness:'ACTIVE',confidence:'HIGH',priority:90,
    prerequisite:'THREAT_ADAPTATION',prerequisiteLabel:'Threat Adaptation',whyNow:'Local mastery is stable.',
    gameRule:'KEEP THE SAFE DAMAGE LINE.',graduationRule:'Repeated novel evidence required.',evidence:'5 comparable games',
    comparableGames:6,cleanStreak:4,memoryStrength:92,transferStrength:40,transferGames:1,transferCleanStreak:1,
    repLadder:{version:1,level:4,maxLevel:5,stage:'ADAPT',label:'Adapt when the cue changes',objective:'Keep the principle under a changed cue.',
      difficultyRule:'Preserve the principle.',promotionGate:'Repeated novel evidence.',demotionRule:'Verified regression only.',reason:'Local mastery is stable.',evidence:'synthetic'},
    nextUnlock:'Fight Selection',
  };
}
function matrix():any{
  return{
    version:1,generatedAt:'x',gamesAnalyzed:8,recommendedSkill:'CARRY_PRESERVATION',selectionMode:'HOLD',recommendationReason:'active contract',
    candidates:[],deferred:[],boundary:'test',
  };
}

test('Autonomous Curriculum V6 lifecycle bench passes every sequencing trap',()=>{
  const report=runClimbAutonomousCurriculumBench();
  assert.equal(report.cases,10);
  assert.equal(report.passed,10);
  assert.equal(report.lifecycleAccuracy,100);
  assert.equal(report.contractContinuity,100);
  assert.equal(report.transferDiscipline,100);
  assert.equal(report.interruptionDiscipline,100);
  assert.deepEqual(report.failures,[]);
});

test('transfer-stage learning contract schedules a frozen novel test instead of declaring mastery',()=>{
  const autonomous=buildClimbAutonomousCurriculum({
    generatedAt:'2026-09-23T00:00:00.000Z',
    gamesAnalyzed:8,
    status:'ACTIVE',
    currentLesson:lesson(),
    nextLesson:null,
    decision:{action:'KEEP',previousLesson:'CARRY_PRESERVATION',currentLesson:'CARRY_PRESERVATION',changed:false,reason:'Keep the current lesson.'},
    careerMatrix:matrix(),
  });
  assert.equal(autonomous.state,'TRANSFER_TEST');
  assert.equal(autonomous.action,'SCHEDULE_TRANSFER_TEST');
  assert.equal(autonomous.activeContract?.testDirective.mode,'TRANSFER_TEST');
  assert.equal(autonomous.activeContract?.testDirective.needsNovelChampionOrContext,true);
  assert.ok((autonomous.activeContract?.completion??100)<100);
  assert.match(autonomous.activeContract?.graduateWhen||'',/principle owned/i);
});

test('stabilising contract fades adaptive support only after repeated clean local evidence',()=>{
  const current=lesson('STABILISE');
  current.comparableGames=5;
  current.cleanStreak=3;
  current.memoryStrength=76;
  current.repLadder={...current.repLadder,level:3,stage:'STABILISE'};
  const autonomous=buildClimbAutonomousCurriculum({
    generatedAt:'2026-09-23T00:00:00.000Z',gamesAnalyzed:8,status:'ACTIVE',currentLesson:current,nextLesson:null,
    decision:{action:'KEEP',previousLesson:'CARRY_PRESERVATION',currentLesson:'CARRY_PRESERVATION',changed:false,reason:'Keep.'},
    careerMatrix:matrix(),
  });
  assert.equal(autonomous.state,'STABILISE');
  assert.equal(autonomous.activeContract?.supportPolicy,'FADED');
});

test('transfer test always removes adaptive teaching overlay while keeping the frozen mission',()=>{
  const autonomous=buildClimbAutonomousCurriculum({
    generatedAt:'2026-09-23T00:00:00.000Z',gamesAnalyzed:8,status:'ACTIVE',currentLesson:lesson('TRANSFER'),nextLesson:null,
    decision:{action:'KEEP',previousLesson:'CARRY_PRESERVATION',currentLesson:'CARRY_PRESERVATION',changed:false,reason:'Keep.'},
    careerMatrix:matrix(),
  });
  assert.equal(autonomous.state,'TRANSFER_TEST');
  assert.equal(autonomous.activeContract?.supportPolicy,'FADED');
  assert.equal(autonomous.activeContract?.testDirective.mode,'TRANSFER_TEST');
});

test('V6 transfer contract refuses to force a mission when no matching frozen transfer prime exists',()=>{
  const current=lesson();
  const autonomous=buildClimbAutonomousCurriculum({
    generatedAt:'2026-09-23T00:00:00.000Z',
    gamesAnalyzed:8,
    status:'ACTIVE',
    currentLesson:current,
    nextLesson:null,
    decision:{action:'KEEP',previousLesson:'CARRY_PRESERVATION',currentLesson:'CARRY_PRESERVATION',changed:false,reason:'Keep.'},
    careerMatrix:matrix(),
  });
  const situationContext=buildDraftSituationContext({
    champion:'Jinx',role:'ADC',
    enemies:[{champion:'Nocturne',role:'JUNGLE'},{champion:'Rakan',role:'SUPPORT'}],
  });
  const mission=buildClimbMatchMission({
    lesson:current,
    situationContext,
    coach:{never:'KEEP THE SAFE DAMAGE LINE.'},
    champion:'Jinx',
    role:'ADC',
    learningContract:autonomous.activeContract,
  });
  assert.equal(mission?.autonomousTestMode,'TRANSFER_TEST');
  assert.equal(mission?.learningContractId,autonomous.activeContract?.id);
  assert.equal(mission?.status,'NOT_RELEVANT');
});

test('production surfaces and pregame route are wired to the V6 contract',()=>{
  const curriculum=fs.readFileSync('lib/climbCurriculum.ts','utf8');
  const route=fs.readFileSync('app/api/live/draft-coach/route.ts','utf8');
  const mission=fs.readFileSync('lib/climbMissionDesign.ts','utf8');
  const component=fs.readFileSync('components/DecisionTwinCommandCenter.tsx','utf8');

  assert.ok(curriculum.includes('buildClimbAutonomousCurriculum'));
  assert.ok(curriculum.includes('autonomous,'));
  assert.ok(route.includes("enabled:transferDirective?.mode==='TRANSFER_TEST'"));
  assert.ok(route.includes('behaviourKey:transferDirective?.behaviourKey??null'));
  assert.ok(route.includes('autonomousCurriculum:proModel?(coachingContext.curriculum.autonomous??null):null'));
  assert.ok(route.includes('learningContract,'));
  assert.ok(mission.includes("contractRequiresTransfer=input.learningContract?.testDirective.mode==='TRANSFER_TEST'"));
  assert.ok(component.includes('AUTONOMOUS CURRICULUM V6'));
  assert.ok(component.includes('SUPPORT POLICY'));
  assert.ok(component.includes('NEXT TEST'));
  assert.ok(component.includes('REPLACEMENT'));
});
