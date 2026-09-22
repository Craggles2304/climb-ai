import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildClimbCoachingStrategy,reviewClimbCoachingStrategy} from '../lib/climbCoachingStrategy';
import {selectClimbCoachIntervention} from '../lib/climbCoachTwin';
import type {HistoryAnalysisRow} from '../lib/riot/proHistory';
import type {ClimbMatchMission,ClimbMatchMissionReview} from '../lib/climbMissionDesign';

function mission(level=3,stage='STABILISE'):ClimbMatchMission{
  return{
    version:1,
    id:'climb-mission:fight_selection:multi_access:jinx',
    status:'READY',
    behaviourKey:'FIGHT_SELECTION',
    behaviourLabel:'Fight Selection',
    curriculumPhase:'PRACTISE',
    repLevel:level as any,
    repStage:stage as any,
    repLabel:'Test',
    repObjective:'Choose the right branch.',
    repDifficultyRule:'Repeated verified execution.',
    repPromotionGate:'Repeated clean evidence.',
    champion:'Jinx',
    role:'ADC',
    targetTag:'MULTI_ACCESS',
    title:'Fight Selection',
    whyThisGame:'Multiple access threats.',
    trigger:'FIRST CONTACT STARTS.',
    action:'CHECK ACCESS AND ENTER ONLY WHEN THE FROZEN TRIGGER IS TRUE.',
    cue:'CHECK ACCESS BEFORE YOU ENTER.',
    successDefinition:'Verified Fight Selection is GOOD.',
    failureDefinition:'Verified Fight Selection is IMPROVE.',
    rehearsalQuestion:'What must be true before you enter?',
    relevantEnemies:['Nocturne','Rakan'],
    reviewRule:'Only matching verified decisions count.',
    graduationRule:'Repeated evidence required.',
    source:'CLIMB_CURRICULUM',
    boundary:'Frozen before play.',
  };
}

function missionReview(index:number,status:'EXECUTED'|'MISSED'|'MIXED'|'NOT_OBSERVED'):ClimbMatchMissionReview{
  const matched=status==='NOT_OBSERVED'?0:status==='MIXED'?2:1;
  const clean=status==='EXECUTED'?1:status==='MIXED'?1:0;
  return{
    version:1,
    active:true,
    missionId:'mission-'+index,
    behaviourKey:'FIGHT_SELECTION',
    behaviourLabel:'Fight Selection',
    targetTag:'MULTI_ACCESS',
    repLevel:3,
    repStage:'STABILISE',
    status,
    matchedMoments:matched,
    cleanMoments:clean,
    improveMoments:matched-clean,
    note:'synthetic mission review',
    boundary:'verified only',
  };
}

function row(index:number,review:ClimbMatchMissionReview,strategyReview:any=null):HistoryAnalysisRow{
  return{
    champion:'Jinx',
    role:'ADC',
    createdAt:'2026-08-'+String(index+1).padStart(2,'0')+'T12:00:00.000Z',
    analysis:{
      version:1,
      champion:'Jinx',
      role:'ADC',
      evidenceSources:['TEST'],
      metrics:{},
      leakSignals:[],
      fingerprint:{primary:'TEST',sequence:[],confidence:'HIGH',explanation:'test'},
      decisionGraph:{version:1,nodes:[],summary:{climbMission:review,coachingStrategy:strategyReview}} as any,
    } as any,
  };
}

function curriculum(){
  return{version:1,status:'ACTIVE',currentLesson:{behaviourKey:'FIGHT_SELECTION'},queue:[],graduated:[]} as any;
}

function coachTwin(status='BUILDING'){
  return{
    version:1,
    generatedAt:'2026-09-22T10:00:00.000Z',
    gamesAnalyzed:10,
    interventionsFrozen:4,
    interventionsObserved:4,
    behavioursProfiled:1,
    behaviourProfiles:[{
      behaviourKey:'FIGHT_SELECTION',
      behaviourLabel:'Fight Selection',
      targetTag:'ANY',
      totalFrozen:4,
      totalObserved:4,
      methods:[],
      preferredMethod:null,
      preferredMethodLabel:null,
      preferenceConfidence:'LOW',
      preferenceEdge:null,
      status,
      evidence:'test',
    }],
    overallMethods:[],
    summary:'test',
    boundary:'test',
  } as any;
}

test('new or recognition-stage learning receives explicit TEACH support',()=>{
  const strategy=buildClimbCoachingStrategy({
    rows:[],
    curriculum:curriculum(),
    mission:mission(1,'RECOGNISE'),
    coachTwin:coachTwin(),
  });
  assert.ok(strategy);
  assert.equal(strategy?.mode,'TEACH');
  assert.equal(strategy?.deliveryPolicy,'FULL');
  assert.equal(strategy?.intervene,true);
  assert.equal(strategy?.autonomyTest,false);
});

test('repeated clean observed decisions fade adaptive coaching without removing the frozen mission',()=>{
  const rows=[
    row(0,missionReview(0,'MISSED')),
    row(1,missionReview(1,'EXECUTED')),
    row(2,missionReview(2,'EXECUTED')),
    row(3,missionReview(3,'EXECUTED')),
    row(4,missionReview(4,'EXECUTED')),
  ];
  const strategy=buildClimbCoachingStrategy({
    rows,
    curriculum:curriculum(),
    mission:mission(3,'STABILISE'),
    coachTwin:coachTwin('PREFERENCE_EMERGING'),
  });
  assert.equal(strategy?.mode,'FADE');
  assert.equal(strategy?.deliveryPolicy,'NONE');
  assert.equal(strategy?.intervene,false);
  assert.equal(strategy?.autonomyTest,true);

  const intervention=selectClimbCoachIntervention({
    twin:coachTwin('PREFERENCE_EMERGING'),
    mission:mission(3,'STABILISE'),
    deliveryPolicy:strategy?.deliveryPolicy,
  });
  assert.equal(intervention,null,'FADE must remove the adaptive Coach Twin overlay, not the mission itself.');
});

test('one missed faded rep restores light support instead of fully re-teaching the player',()=>{
  const fadedMiss={
    version:1,active:true,strategyId:'fade',missionId:'m',behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',
    targetTag:'MULTI_ACCESS',mode:'FADE',intervened:false,status:'MISSED',matchedMoments:1,cleanMoments:0,improveMoments:1,
    autonomyEvidence:false,note:'miss',boundary:'test',
  };
  const rows=[
    row(0,missionReview(0,'EXECUTED')),
    row(1,missionReview(1,'EXECUTED')),
    row(2,missionReview(2,'EXECUTED')),
    row(3,missionReview(3,'MISSED'),fadedMiss),
  ];
  const strategy=buildClimbCoachingStrategy({
    rows,
    curriculum:curriculum(),
    mission:mission(3,'STABILISE'),
    coachTwin:coachTwin(),
  });
  assert.equal(strategy?.mode,'REINFORCE');
  assert.equal(strategy?.deliveryPolicy,'LIGHT');
});

test('repeated verified misses switch the support policy to DIAGNOSE before changing the lesson',()=>{
  const rows=[
    row(0,missionReview(0,'EXECUTED')),
    row(1,missionReview(1,'MISSED')),
    row(2,missionReview(2,'MISSED')),
  ];
  const strategy=buildClimbCoachingStrategy({
    rows,
    curriculum:curriculum(),
    mission:mission(2,'EXECUTE'),
    coachTwin:coachTwin(),
  });
  assert.equal(strategy?.mode,'DIAGNOSE');
  assert.equal(strategy?.deliveryPolicy,'DIAGNOSTIC');
  assert.equal(strategy?.behaviourKey,'FIGHT_SELECTION');
});

test('Coach Twin RETESTING forces a diagnostic strategy even without a mission miss streak',()=>{
  const rows=[
    row(0,missionReview(0,'EXECUTED')),
    row(1,missionReview(1,'MIXED')),
    row(2,missionReview(2,'EXECUTED')),
  ];
  const strategy=buildClimbCoachingStrategy({
    rows,
    curriculum:curriculum(),
    mission:mission(3,'STABILISE'),
    coachTwin:coachTwin('RETESTING'),
  });
  assert.equal(strategy?.mode,'DIAGNOSE');

  const intervention=selectClimbCoachIntervention({
    twin:coachTwin('BUILDING'),
    mission:mission(3,'STABILISE'),
    deliveryPolicy:'DIAGNOSTIC',
  });
  assert.ok(intervention);
  assert.equal(intervention?.method,'SELF_EXPLAIN');
  assert.equal(intervention?.selectionMode,'DIAGNOSTIC');
});

test('NOT_OBSERVED games are neutral when Strategy decides how much support to give',()=>{
  const rows=[
    row(0,missionReview(0,'EXECUTED')),
    row(1,missionReview(1,'NOT_OBSERVED')),
  ];
  const strategy=buildClimbCoachingStrategy({
    rows,
    curriculum:curriculum(),
    mission:mission(2,'EXECUTE'),
    coachTwin:coachTwin(),
  });
  assert.equal(strategy?.recentObservedMissions,1);
  assert.notEqual(strategy?.mode,'DIAGNOSE');
});

test('FADE review creates autonomy evidence only from a matching clean verified mission',()=>{
  const strategy=buildClimbCoachingStrategy({
    rows:[
      row(0,missionReview(0,'EXECUTED')),
      row(1,missionReview(1,'EXECUTED')),
      row(2,missionReview(2,'EXECUTED')),
      row(3,missionReview(3,'EXECUTED')),
    ],
    curriculum:curriculum(),
    mission:mission(3,'STABILISE'),
    coachTwin:coachTwin(),
  });
  assert.equal(strategy?.mode,'FADE');

  const clean=reviewClimbCoachingStrategy(strategy,missionReview(5,'EXECUTED'));
  assert.equal(clean.status,'CLEAN');
  assert.equal(clean.autonomyEvidence,true);
  assert.match(clean.note,/independent execution/i);

  const unseen=reviewClimbCoachingStrategy(strategy,missionReview(6,'NOT_OBSERVED'));
  assert.equal(unseen.status,'NOT_OBSERVED');
  assert.equal(unseen.autonomyEvidence,false);
});

test('LIGHT reinforcement keeps the selected coaching method but compresses the cue',()=>{
  const intervention=selectClimbCoachIntervention({
    twin:coachTwin(),
    mission:mission(3,'STABILISE'),
    deliveryPolicy:'LIGHT',
  });
  assert.ok(intervention);
  assert.equal(intervention?.deliveryPolicy,'LIGHT');
  assert.equal(intervention?.secondaryPrompt,null);
  assert.match(intervention?.title||'',/REINFORCE/i);
});

test('Draft Coach and Decision Graph freeze and review one Coaching Strategy',()=>{
  const draft=fs.readFileSync('app/api/live/draft-coach/route.ts','utf8');
  const graph=fs.readFileSync('lib/decisionGraph.ts','utf8');
  assert.ok(draft.includes('buildClimbCoachingStrategy'));
  assert.ok(draft.includes("deliveryPolicy:coachingStrategy?.deliveryPolicy??'NONE'"));
  assert.ok(draft.includes('coachingStrategy:input.coachingStrategy'));
  assert.ok(graph.includes('reviewClimbCoachingStrategy(plan?.coachingStrategy,climbMissionReview)'));
  assert.ok(graph.includes('coachingStrategy:raw.coachingStrategy??null'));
});
