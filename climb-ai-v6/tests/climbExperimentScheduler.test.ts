import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildClimbExperimentSchedule,reviewClimbExperimentSchedule} from '../lib/climbExperimentScheduler';
import {buildClimbCoachingStrategy} from '../lib/climbCoachingStrategy';
import type {HistoryAnalysisRow} from '../lib/riot/proHistory';
import type {ClimbMatchMission,ClimbMatchMissionReview} from '../lib/climbMissionDesign';
import type {ClimbCoachingStrategyReview} from '../lib/climbCoachingStrategy';

function mission(level=3,stage='STABILISE'):ClimbMatchMission{
  return{
    version:1,id:'mission-next',status:'READY',behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',
    curriculumPhase:'PRACTISE',repLevel:level as any,repStage:stage as any,repLabel:'Test',repObjective:'Choose the right branch.',
    repDifficultyRule:'Repeated verified execution.',repPromotionGate:'Repeated clean evidence.',champion:'Jinx',role:'ADC',
    targetTag:'MULTI_ACCESS',title:'Fight Selection',whyThisGame:'Multiple access threats.',trigger:'FIRST CONTACT STARTS.',
    action:'CHECK ACCESS BEFORE ENTERING.',cue:'CHECK ACCESS.',successDefinition:'GOOD',failureDefinition:'IMPROVE',
    rehearsalQuestion:'What must be true?',relevantEnemies:['Nocturne','Rakan'],reviewRule:'Verified only.',
    graduationRule:'Repeated evidence.',source:'CLIMB_CURRICULUM',boundary:'Frozen.',
  };
}
function row(index:number,input:{
  supported:boolean;
  clean:boolean;
  intent?:'ALIGNED'|'KNOWLEDGE_GAP'|'EXECUTION_GAP'|null;
  targetTag?:string;
  repLevel?:number;
}):HistoryAnalysisRow{
  const missionStatus=input.clean?'EXECUTED':'MISSED';
  const strategyStatus=input.clean?'CLEAN':'MISSED';
  const diagnosis=input.intent??'ALIGNED';
  const intentCorrect=diagnosis==='ALIGNED'||diagnosis==='EXECUTION_GAP';
  return{
    champion:'Jinx',role:'ADC',createdAt:'2026-08-'+String(index+1).padStart(2,'0')+'T12:00:00.000Z',
    analysis:{
      version:1,champion:'Jinx',role:'ADC',evidenceSources:['TEST'],metrics:{},leakSignals:[],
      fingerprint:{primary:'TEST',sequence:[],confidence:'HIGH',explanation:'test'},
      decisionGraph:{version:1,nodes:[],summary:{
        climbMission:{
          version:1,active:true,missionId:'m-'+index,behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',
          targetTag:(input.targetTag??'MULTI_ACCESS') as any,repLevel:input.repLevel??3,repStage:'STABILISE',
          status:missionStatus,matchedMoments:1,cleanMoments:input.clean?1:0,improveMoments:input.clean?0:1,note:'test',boundary:'test',
        },
        coachingStrategy:{
          version:1,active:true,strategyId:'s-'+index,missionId:'m-'+index,behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',
          targetTag:(input.targetTag??'MULTI_ACCESS') as any,mode:input.supported?'REINFORCE':'FADE',intervened:input.supported,
          status:strategyStatus,matchedMoments:1,cleanMoments:input.clean?1:0,improveMoments:input.clean?0:1,
          autonomyEvidence:!input.supported&&input.clean,note:'test',boundary:'test',
        },
        intentGap:input.intent?{
          version:1,active:true,probeId:'p-'+index,missionId:'m-'+index,behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',
          targetTag:(input.targetTag??'MULTI_ACCESS') as any,selectedBranch:intentCorrect?'CORRECT':'OLD_BRANCH',intentCorrect,
          missionStatus,status:diagnosis,diagnosis,matchedMoments:1,note:'test',
          nextCoachingNeed:diagnosis==='KNOWLEDGE_GAP'?'TEACH_UNDERSTANDING':diagnosis==='EXECUTION_GAP'?'REDUCE_EXECUTION_FRICTION':'NONE',boundary:'test',
        }:null,
      }} as any,
    } as any,
  };
}
function curriculum(){return{version:1,status:'ACTIVE',currentLesson:{behaviourKey:'FIGHT_SELECTION'},queue:[],graduated:[]} as any}
function coachTwin(){return{version:1,generatedAt:'2026-09-22T12:00:00.000Z',gamesAnalyzed:10,interventionsFrozen:5,interventionsObserved:5,behavioursProfiled:1,behaviourProfiles:[],overallMethods:[],summary:'test',boundary:'test'} as any}
function missionReview(status:'EXECUTED'|'MISSED'|'NOT_OBSERVED'):ClimbMatchMissionReview{
  return{
    version:1,active:true,missionId:'mission-next',behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',
    targetTag:'MULTI_ACCESS',repLevel:3,repStage:'STABILISE',status,
    matchedMoments:status==='NOT_OBSERVED'?0:1,cleanMoments:status==='EXECUTED'?1:0,improveMoments:status==='MISSED'?1:0,
    note:'test',boundary:'test',
  };
}
function strategyReview(intervened:boolean,status:'CLEAN'|'MISSED'|'NOT_OBSERVED'):ClimbCoachingStrategyReview{
  return{
    version:1,active:true,strategyId:'strategy',missionId:'mission-next',behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',
    targetTag:'MULTI_ACCESS',mode:intervened?'REINFORCE':'FADE',intervened,status,
    matchedMoments:status==='NOT_OBSERVED'?0:1,cleanMoments:status==='CLEAN'?1:0,improveMoments:status==='MISSED'?1:0,
    autonomyEvidence:!intervened&&status==='CLEAN',note:'test',boundary:'test',
  };
}

test('no ready mission means no experiment is invented',()=>{
  assert.equal(buildClimbExperimentSchedule({rows:[],mission:null}),null);
});

test('early Rep Ladder learning defers holdout experimentation',()=>{
  const experiment=buildClimbExperimentSchedule({rows:[],mission:mission(1,'RECOGNISE')});
  assert.equal(experiment?.status,'DEFERRED');
  assert.equal(experiment?.experimentType,'SUPPORTED_RETEST');
  assert.equal(experiment?.requestedDeliveryPolicy,'LIGHT');
  assert.match(experiment?.safetyReason||'',/premature|confound/i);
});

test('repeated knowledge gap blocks support removal even when a comparison would be informative',()=>{
  const rows=[
    row(0,{supported:true,clean:false,intent:'KNOWLEDGE_GAP'}),
    row(1,{supported:true,clean:false,intent:'KNOWLEDGE_GAP'}),
    row(2,{supported:true,clean:true,intent:'ALIGNED'}),
  ];
  // Keep the latest repeated diagnosis as knowledge gap.
  rows.push(row(3,{supported:true,clean:false,intent:'KNOWLEDGE_GAP'}));
  rows.push(row(4,{supported:true,clean:false,intent:'KNOWLEDGE_GAP'}));
  const experiment=buildClimbExperimentSchedule({rows,mission:mission()});
  assert.equal(experiment?.status,'DEFERRED');
  assert.equal(experiment?.experimentType,'DIAGNOSTIC_RETEST');
  assert.equal(experiment?.requestedDeliveryPolicy,'DIAGNOSTIC');
  assert.match(experiment?.safetyReason||'',/knowledge-gap/i);
});

test('three supported matched reps with insufficient faded evidence schedule a FADE holdout',()=>{
  const rows=[
    row(0,{supported:true,clean:true,intent:'ALIGNED'}),
    row(1,{supported:true,clean:true,intent:'ALIGNED'}),
    row(2,{supported:true,clean:true,intent:'ALIGNED'}),
  ];
  const experiment=buildClimbExperimentSchedule({rows,mission:mission()});
  assert.equal(experiment?.status,'SCHEDULED');
  assert.equal(experiment?.experimentType,'FADE_HOLDOUT');
  assert.equal(experiment?.requestedDeliveryPolicy,'NONE');
  assert.equal(experiment?.supportedObservedInCell,3);
  assert.equal(experiment?.fadedObservedInCell,0);
  assert.equal(experiment?.informationGain,'HIGH');
});

test('last observed miss restores support before another holdout',()=>{
  const rows=[
    row(0,{supported:true,clean:true,intent:'ALIGNED'}),
    row(1,{supported:true,clean:true,intent:'ALIGNED'}),
    row(2,{supported:true,clean:true,intent:'ALIGNED'}),
    row(3,{supported:false,clean:false,intent:'ALIGNED'}),
  ];
  const experiment=buildClimbExperimentSchedule({rows,mission:mission()});
  assert.equal(experiment?.experimentType,'SUPPORTED_RETEST');
  assert.equal(experiment?.requestedDeliveryPolicy,'LIGHT');
  assert.match(experiment?.safetyReason||'',/back-to-back FADE/i);
});

test('under-represented supported condition is scheduled when faded evidence dominates',()=>{
  const rows=[
    row(0,{supported:false,clean:true,intent:'ALIGNED'}),
    row(1,{supported:false,clean:true,intent:'ALIGNED'}),
    row(2,{supported:false,clean:true,intent:'ALIGNED'}),
  ];
  const experiment=buildClimbExperimentSchedule({rows,mission:mission()});
  assert.equal(experiment?.experimentType,'SUPPORTED_RETEST');
  assert.equal(experiment?.requestedDeliveryPolicy,'LIGHT');
  assert.equal(experiment?.fadedObservedInCell,3);
});

test('Coaching Strategy obeys a safe scheduled FADE holdout',()=>{
  const rows=[
    row(0,{supported:true,clean:true,intent:'ALIGNED'}),
    row(1,{supported:true,clean:true,intent:'ALIGNED'}),
    row(2,{supported:true,clean:true,intent:'ALIGNED'}),
  ];
  const experiment=buildClimbExperimentSchedule({rows,mission:mission()});
  const strategy=buildClimbCoachingStrategy({
    rows,curriculum:curriculum(),mission:mission(),coachTwin:coachTwin(),experimentSchedule:experiment,
  });
  assert.equal(experiment?.requestedDeliveryPolicy,'NONE');
  assert.equal(strategy?.mode,'FADE');
  assert.equal(strategy?.intervene,false);
  assert.equal(strategy?.experimentId,experiment?.id);
});

test('DEFERRED experiment never overrides core teaching policy',()=>{
  const rows=[
    row(0,{supported:true,clean:false,intent:'KNOWLEDGE_GAP'}),
    row(1,{supported:true,clean:false,intent:'KNOWLEDGE_GAP'}),
  ];
  const experiment=buildClimbExperimentSchedule({rows,mission:mission()});
  const strategy=buildClimbCoachingStrategy({
    rows,curriculum:curriculum(),mission:mission(),coachTwin:coachTwin(),experimentSchedule:experiment,
  });
  assert.equal(experiment?.status,'DEFERRED');
  assert.equal(strategy?.mode,'TEACH');
});

test('experiment review adds evidence only when the frozen support condition is observed',()=>{
  const rows=[
    row(0,{supported:true,clean:true,intent:'ALIGNED'}),
    row(1,{supported:true,clean:true,intent:'ALIGNED'}),
    row(2,{supported:true,clean:true,intent:'ALIGNED'}),
  ];
  const experiment=buildClimbExperimentSchedule({rows,mission:mission()});
  assert.ok(experiment);

  const completed=reviewClimbExperimentSchedule(experiment,missionReview('EXECUTED'),strategyReview(false,'CLEAN'));
  assert.equal(completed.status,'COMPLETED');
  assert.equal(completed.informationAdded,true);
  assert.equal(completed.responseScore,100);

  const mismatch=reviewClimbExperimentSchedule(experiment,missionReview('EXECUTED'),strategyReview(true,'CLEAN'));
  assert.equal(mismatch.status,'POLICY_MISMATCH');
  assert.equal(mismatch.informationAdded,false);

  const unseen=reviewClimbExperimentSchedule(experiment,missionReview('NOT_OBSERVED'),strategyReview(false,'NOT_OBSERVED'));
  assert.equal(unseen.status,'NOT_OBSERVED');
  assert.equal(unseen.informationAdded,false);
});

test('Draft Coach and Decision Graph freeze the same experiment contract',()=>{
  const draft=fs.readFileSync('app/api/live/draft-coach/route.ts','utf8');
  const graph=fs.readFileSync('lib/decisionGraph.ts','utf8');
  assert.ok(draft.includes('buildClimbExperimentSchedule'));
  assert.ok(draft.includes('experimentSchedule:input.experimentSchedule'));
  assert.ok(draft.includes('experimentSchedule,'));
  assert.ok(graph.includes('reviewClimbExperimentSchedule(plan?.experimentSchedule,climbMissionReview,coachingStrategyReview)'));
  assert.ok(graph.includes('experimentSchedule:raw.experimentSchedule??null'));
  const companion=fs.readFileSync('companion/electron/remember-v5-esports.js','utf8');
  const review=fs.readFileSync('companion/electron/review-v2-core.js','utf8');
  assert.ok(companion.includes('enrichedCoach._experimentSchedule=response?.experimentSchedule||null'));
  assert.ok(companion.includes('experimentSchedule:coach?._experimentSchedule||null'));
  assert.ok(companion.includes('function renderExperimentSchedule'));
  assert.ok(companion.includes('EXPERIMENT SCHEDULER'));
  assert.ok(review.includes('EXPERIMENT SCHEDULER · DID THE TEST ACTUALLY RUN?'));
  assert.ok(review.includes('function renderExperimentScheduleReview'));
  assert.ok(review.includes('POLICY_MISMATCH'));
});
