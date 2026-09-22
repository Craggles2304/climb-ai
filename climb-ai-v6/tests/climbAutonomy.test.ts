import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildClimbAutonomyProfile} from '../lib/climbAutonomy';
import {buildClimbCoachingStrategy} from '../lib/climbCoachingStrategy';
import type {HistoryAnalysisRow} from '../lib/riot/proHistory';
import type {ClimbMatchMission} from '../lib/climbMissionDesign';

type StrategyStatus='CLEAN'|'MISSED'|'MIXED'|'NOT_OBSERVED';

function row(index:number,input:{
  mode:'TEACH'|'REINFORCE'|'DIAGNOSE'|'FADE';
  intervened:boolean;
  status:StrategyStatus;
  intentCorrect?:boolean|null;
  champion?:string;
  targetTag?:string;
}):HistoryAnalysisRow{
  const missionStatus=input.status==='CLEAN'?'EXECUTED':input.status==='MISSED'?'MISSED':input.status==='MIXED'?'MIXED':'NOT_OBSERVED';
  const intentActive=typeof input.intentCorrect==='boolean';
  return{
    champion:input.champion??'Jinx',
    role:'ADC',
    createdAt:'2026-08-'+String(index+1).padStart(2,'0')+'T12:00:00.000Z',
    analysis:{
      version:1,
      champion:input.champion??'Jinx',
      role:'ADC',
      evidenceSources:['TEST'],
      metrics:{},
      leakSignals:[],
      fingerprint:{primary:'TEST',sequence:[],confidence:'HIGH',explanation:'test'},
      decisionGraph:{
        version:1,
        nodes:[],
        summary:{
          climbMission:{
            version:1,active:true,missionId:'mission-'+index,behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',
            targetTag:(input.targetTag??'MULTI_ACCESS') as any,repLevel:3,repStage:'STABILISE',status:missionStatus,
            matchedMoments:missionStatus==='NOT_OBSERVED'?0:1,cleanMoments:missionStatus==='EXECUTED'?1:0,
            improveMoments:missionStatus==='MISSED'?1:0,note:'synthetic',boundary:'test',
          },
          coachingStrategy:{
            version:1,active:true,strategyId:'strategy-'+index,missionId:'mission-'+index,
            behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',targetTag:(input.targetTag??'MULTI_ACCESS') as any,
            mode:input.mode,intervened:input.intervened,status:input.status,
            matchedMoments:input.status==='NOT_OBSERVED'?0:1,cleanMoments:input.status==='CLEAN'?1:0,
            improveMoments:input.status==='MISSED'?1:0,autonomyEvidence:input.mode==='FADE'&&input.status==='CLEAN',
            note:'synthetic',boundary:'test',
          },
          intentGap:intentActive?{
            version:1,active:true,probeId:'probe-'+index,missionId:'mission-'+index,
            behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',targetTag:(input.targetTag??'MULTI_ACCESS') as any,
            selectedBranch:input.intentCorrect?'CORRECT':'OLD_BRANCH',intentCorrect:input.intentCorrect,
            missionStatus, status:input.intentCorrect?'ALIGNED':'KNOWLEDGE_GAP',
            diagnosis:input.intentCorrect?'ALIGNED':'KNOWLEDGE_GAP',matchedMoments:1,
            note:'synthetic intent',nextCoachingNeed:input.intentCorrect?'NONE':'TEACH_UNDERSTANDING',boundary:'test',
          }:null,
        },
      } as any,
    } as any,
  };
}

function mission():ClimbMatchMission{
  return{
    version:1,id:'mission-next',status:'READY',behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',
    curriculumPhase:'STABILISE',repLevel:3,repStage:'STABILISE',repLabel:'Stabilise',repObjective:'Repeat it.',
    repDifficultyRule:'Repeat.',repPromotionGate:'Repeated clean evidence.',champion:'Jinx',role:'ADC',targetTag:'MULTI_ACCESS',
    title:'Fight Selection',whyThisGame:'Multiple access threats.',trigger:'FIRST CONTACT STARTS.',
    action:'CHECK ACCESS BEFORE ENTERING.',cue:'CHECK ACCESS.',successDefinition:'GOOD',failureDefinition:'IMPROVE',
    rehearsalQuestion:'What must be true?',relevantEnemies:['Nocturne','Rakan'],reviewRule:'Verified only.',
    graduationRule:'Repeated evidence.',source:'CLIMB_CURRICULUM',boundary:'Frozen.',
  };
}

function curriculum(){return{version:1,status:'ACTIVE',currentLesson:{behaviourKey:'FIGHT_SELECTION'},queue:[],graduated:[]} as any}
function coachTwin(){return{version:1,generatedAt:'2026-09-22T12:00:00.000Z',gamesAnalyzed:10,interventionsFrozen:5,interventionsObserved:5,behavioursProfiled:1,behaviourProfiles:[],overallMethods:[],summary:'test',boundary:'test'} as any}

test('clean supported execution is scaffolded evidence, not autonomy',()=>{
  const rows=[
    row(0,{mode:'TEACH',intervened:true,status:'CLEAN',intentCorrect:true}),
    row(1,{mode:'REINFORCE',intervened:true,status:'CLEAN',intentCorrect:true}),
    row(2,{mode:'REINFORCE',intervened:true,status:'CLEAN',intentCorrect:true}),
    row(3,{mode:'REINFORCE',intervened:true,status:'CLEAN',intentCorrect:true}),
  ];
  const card=buildClimbAutonomyProfile(rows).cards[0];
  assert.ok(card);
  assert.equal(card.state,'SCAFFOLDED');
  assert.equal(card.supportedCleanRate,100);
  assert.equal(card.fadedGames,0);
  assert.equal(card.autonomyStrength,null);
});

test('one clean faded game can never create autonomy',()=>{
  const rows=[
    row(0,{mode:'REINFORCE',intervened:true,status:'CLEAN',intentCorrect:true}),
    row(1,{mode:'REINFORCE',intervened:true,status:'CLEAN',intentCorrect:true}),
    row(2,{mode:'REINFORCE',intervened:true,status:'CLEAN',intentCorrect:true}),
    row(3,{mode:'FADE',intervened:false,status:'CLEAN',intentCorrect:true}),
  ];
  const profile=buildClimbAutonomyProfile(rows);
  assert.equal(profile.autonomous,0);
  assert.notEqual(profile.cards[0]?.state,'AUTONOMOUS');
  assert.match(profile.boundary,/one clean faded game can never create autonomy/i);
});

test('repeated correct pre-cue intent plus clean faded execution becomes AUTONOMOUS',()=>{
  const rows=[
    row(0,{mode:'REINFORCE',intervened:true,status:'CLEAN',intentCorrect:true}),
    row(1,{mode:'FADE',intervened:false,status:'CLEAN',intentCorrect:true,champion:'Jinx',targetTag:'MULTI_ACCESS'}),
    row(2,{mode:'FADE',intervened:false,status:'CLEAN',intentCorrect:true,champion:'Ashe',targetTag:'PICK_PRESSURE'}),
    row(3,{mode:'FADE',intervened:false,status:'CLEAN',intentCorrect:true,champion:'Caitlyn',targetTag:'MULTI_ACCESS'}),
  ];
  const card=buildClimbAutonomyProfile(rows).cards[0];
  assert.equal(card?.state,'AUTONOMOUS');
  assert.equal(card?.fadedCleanRate,100);
  assert.equal(card?.preCueCorrectRate,100);
  assert.equal(card?.independentAlignedGames,3);
  assert.equal(card?.independentAlignedStreak,3);
  assert.ok((card?.autonomyStrength??0)>=80);
});

test('strong supported execution with failed faded reps is SUPPORT_DEPENDENT',()=>{
  const rows=[
    row(0,{mode:'TEACH',intervened:true,status:'CLEAN'}),
    row(1,{mode:'REINFORCE',intervened:true,status:'CLEAN'}),
    row(2,{mode:'REINFORCE',intervened:true,status:'CLEAN'}),
    row(3,{mode:'REINFORCE',intervened:true,status:'CLEAN'}),
    row(4,{mode:'FADE',intervened:false,status:'MISSED'}),
    row(5,{mode:'FADE',intervened:false,status:'MISSED'}),
  ];
  const card=buildClimbAutonomyProfile(rows).cards[0];
  assert.equal(card?.state,'SUPPORT_DEPENDENT');
  assert.equal(card?.supportedCleanRate,100);
  assert.equal(card?.fadedCleanRate,0);
  assert.equal(card?.supportDependenceGap,100);
  assert.equal(card?.supportNeed,'DIAGNOSTIC');
});

test('two recent faded misses after previously clean independence trigger REGRESSION_WATCH',()=>{
  const rows=[
    row(0,{mode:'FADE',intervened:false,status:'CLEAN',intentCorrect:true}),
    row(1,{mode:'FADE',intervened:false,status:'CLEAN',intentCorrect:true}),
    row(2,{mode:'FADE',intervened:false,status:'CLEAN',intentCorrect:true}),
    row(3,{mode:'FADE',intervened:false,status:'MISSED',intentCorrect:true}),
    row(4,{mode:'FADE',intervened:false,status:'MISSED',intentCorrect:true}),
  ];
  const card=buildClimbAutonomyProfile(rows).cards[0];
  assert.equal(card?.state,'REGRESSION_WATCH');
  assert.equal(card?.supportNeed,'LIGHT');
  assert.match(card?.evidence||'',/prior learning is retained/i);
});

test('NOT_OBSERVED autonomy tests are neutral',()=>{
  const rows=[
    row(0,{mode:'FADE',intervened:false,status:'CLEAN',intentCorrect:true}),
    row(1,{mode:'FADE',intervened:false,status:'NOT_OBSERVED',intentCorrect:true}),
  ];
  const card=buildClimbAutonomyProfile(rows).cards[0];
  assert.equal(card?.observedGames,1);
  assert.equal(card?.fadedGames,1);
});

test('Coaching Strategy diagnoses support dependence before increasing difficulty',()=>{
  const rows=[
    row(0,{mode:'TEACH',intervened:true,status:'CLEAN'}),
    row(1,{mode:'REINFORCE',intervened:true,status:'CLEAN'}),
    row(2,{mode:'REINFORCE',intervened:true,status:'CLEAN'}),
    row(3,{mode:'FADE',intervened:false,status:'MISSED'}),
    row(4,{mode:'FADE',intervened:false,status:'MISSED'}),
  ];
  const strategy=buildClimbCoachingStrategy({rows,curriculum:curriculum(),mission:mission(),coachTwin:coachTwin()});
  assert.equal(strategy?.autonomyState,'SUPPORT_DEPENDENT');
  assert.equal(strategy?.mode,'DIAGNOSE');
  assert.equal(strategy?.deliveryPolicy,'DIAGNOSTIC');
});

test('AUTONOMOUS decisions stay faded unless regression evidence appears',()=>{
  const rows=[
    row(0,{mode:'FADE',intervened:false,status:'CLEAN',intentCorrect:true}),
    row(1,{mode:'FADE',intervened:false,status:'CLEAN',intentCorrect:true}),
    row(2,{mode:'FADE',intervened:false,status:'CLEAN',intentCorrect:true}),
  ];
  const strategy=buildClimbCoachingStrategy({rows,curriculum:curriculum(),mission:mission(),coachTwin:coachTwin()});
  assert.equal(strategy?.autonomyState,'AUTONOMOUS');
  assert.equal(strategy?.mode,'FADE');
  assert.equal(strategy?.intervene,false);
});

test('learning profile and Progress surface the same Autonomy Engine',()=>{
  const repo=fs.readFileSync('lib/server/proLearningRepository.ts','utf8');
  const route=fs.readFileSync('app/api/decision-twin/route.ts','utf8');
  const progress=fs.readFileSync('components/DecisionTwinCommandCenter.tsx','utf8');
  assert.ok(repo.includes('buildClimbAutonomyProfile'));
  assert.ok(repo.includes('autonomyProfile'));
  assert.ok(route.includes('buildClimbAutonomyProfile'));
  assert.ok(route.includes('autonomyProfile'));
  assert.ok(progress.includes('CLIMB AUTONOMY'));
  assert.ok(progress.includes('autonomyProfile'));
});
