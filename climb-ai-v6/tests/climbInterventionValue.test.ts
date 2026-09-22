import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildClimbInterventionValueProfile} from '../lib/climbInterventionValue';
import {buildClimbCoachingStrategy} from '../lib/climbCoachingStrategy';
import type {HistoryAnalysisRow} from '../lib/riot/proHistory';

type Status='CLEAN'|'MISSED'|'MIXED'|'NOT_OBSERVED';

function row(index:number,input:{
  intervened:boolean;
  mode?:'TEACH'|'REINFORCE'|'DIAGNOSE'|'FADE';
  status:Status;
  targetTag?:string;
  repLevel?:number;
  behaviourKey?:string;
  behaviourLabel?:string;
  cleanMoments?:number;
  matchedMoments?:number;
}):HistoryAnalysisRow{
  const behaviourKey=(input.behaviourKey??'FIGHT_SELECTION') as any;
  const behaviourLabel=input.behaviourLabel??'Fight Selection';
  const targetTag=(input.targetTag??'MULTI_ACCESS') as any;
  const repLevel=input.repLevel??3;
  const missionStatus=input.status==='CLEAN'?'EXECUTED':input.status==='MISSED'?'MISSED':input.status==='MIXED'?'MIXED':'NOT_OBSERVED';
  const matched=input.status==='NOT_OBSERVED'?0:(input.matchedMoments??(input.status==='MIXED'?2:1));
  const clean=input.status==='CLEAN'?matched:input.status==='MIXED'?(input.cleanMoments??1):0;
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
      decisionGraph:{
        version:1,
        nodes:[],
        summary:{
          climbMission:{
            version:1,active:true,missionId:'mission-'+index,behaviourKey,behaviourLabel,targetTag,
            repLevel,repStage:'STABILISE',status:missionStatus,matchedMoments:matched,cleanMoments:clean,
            improveMoments:Math.max(0,matched-clean),note:'synthetic',boundary:'test',
          },
          coachingStrategy:{
            version:1,active:true,strategyId:'strategy-'+index,missionId:'mission-'+index,
            behaviourKey,behaviourLabel,targetTag,mode:input.mode??(input.intervened?'REINFORCE':'FADE'),
            intervened:input.intervened,status:input.status,matchedMoments:matched,cleanMoments:clean,
            improveMoments:Math.max(0,matched-clean),autonomyEvidence:!input.intervened&&input.status==='CLEAN',
            note:'synthetic',boundary:'test',
          },
        },
      } as any,
    } as any,
  };
}

test('tiny matched samples remain BUILDING and never create a coaching-value claim',()=>{
  const profile=buildClimbInterventionValueProfile([
    row(0,{intervened:true,status:'CLEAN'}),
    row(1,{intervened:false,mode:'FADE',status:'MISSED'}),
  ]);
  const card=profile.cards[0];
  assert.equal(card?.state,'BUILDING');
  assert.equal(card?.confidence,'LOW');
  assert.equal(card?.comparablePairs,1);
  assert.match(profile.boundary,/not causal treatment effects/i);
});

test('unmatched contexts are not compared against each other',()=>{
  const rows=[
    row(0,{intervened:true,status:'CLEAN',targetTag:'MULTI_ACCESS'}),
    row(1,{intervened:true,status:'CLEAN',targetTag:'MULTI_ACCESS'}),
    row(2,{intervened:true,status:'CLEAN',targetTag:'MULTI_ACCESS'}),
    row(3,{intervened:false,mode:'FADE',status:'MISSED',targetTag:'PICK_PRESSURE'}),
    row(4,{intervened:false,mode:'FADE',status:'MISSED',targetTag:'PICK_PRESSURE'}),
    row(5,{intervened:false,mode:'FADE',status:'MISSED',targetTag:'PICK_PRESSURE'}),
  ];
  const card=buildClimbInterventionValueProfile(rows).cards[0];
  assert.equal(card?.matchedCells,0);
  assert.equal(card?.supportedObserved,0);
  assert.equal(card?.fadedObserved,0);
  assert.equal(card?.matchedResponseDifference,null);
  assert.equal(card?.state,'BUILDING');
});

test('different Rep Ladder difficulty is treated as a different comparison cell',()=>{
  const rows=[
    row(0,{intervened:true,status:'CLEAN',repLevel:2}),
    row(1,{intervened:true,status:'CLEAN',repLevel:2}),
    row(2,{intervened:true,status:'CLEAN',repLevel:2}),
    row(3,{intervened:false,mode:'FADE',status:'MISSED',repLevel:4}),
    row(4,{intervened:false,mode:'FADE',status:'MISSED',repLevel:4}),
    row(5,{intervened:false,mode:'FADE',status:'MISSED',repLevel:4}),
  ];
  const card=buildClimbInterventionValueProfile(rows).cards[0];
  assert.equal(card?.matchedCells,0);
  assert.equal(card?.state,'BUILDING');
});

test('repeated matched support advantage becomes a support-associated lift signal',()=>{
  const rows:HistoryAnalysisRow[]=[];
  for(let i=0;i<4;i++)rows.push(row(i,{intervened:true,status:'CLEAN'}));
  rows.push(row(4,{intervened:false,mode:'FADE',status:'CLEAN'}));
  rows.push(row(5,{intervened:false,mode:'FADE',status:'MISSED'}));
  rows.push(row(6,{intervened:false,mode:'FADE',status:'MISSED'}));
  rows.push(row(7,{intervened:false,mode:'FADE',status:'MISSED'}));
  const card=buildClimbInterventionValueProfile(rows).cards[0];
  assert.equal(card?.state,'SUPPORT_ASSOCIATED_LIFT');
  assert.equal(card?.supportedResponseRate,100);
  assert.equal(card?.fadedResponseRate,25);
  assert.equal(card?.matchedResponseDifference,75);
  assert.match(card?.interpretation||'',/not strong enough to stop holdout testing/i);
});

test('strong support signal requires at least five matched pairs',()=>{
  const rows:HistoryAnalysisRow[]=[];
  for(let i=0;i<5;i++)rows.push(row(i,{intervened:true,status:'CLEAN'}));
  for(let i=5;i<10;i++)rows.push(row(i,{intervened:false,mode:'FADE',status:'MISSED'}));
  const card=buildClimbInterventionValueProfile(rows).cards[0];
  assert.equal(card?.state,'STRONG_SUPPORT_ASSOCIATED_LIFT');
  assert.equal(card?.comparablePairs,5);
  assert.equal(card?.matchedResponseDifference,100);
  assert.ok(['MEDIUM','HIGH'].includes(card?.confidence??''));
  assert.match(card?.interpretation||'',/not proof of causation/i);
});

test('faded reps can be associated with equal or better execution',()=>{
  const rows:HistoryAnalysisRow[]=[];
  for(let i=0;i<4;i++)rows.push(row(i,{intervened:true,status:i===0?'CLEAN':'MISSED'}));
  for(let i=4;i<8;i++)rows.push(row(i,{intervened:false,mode:'FADE',status:'CLEAN'}));
  const card=buildClimbInterventionValueProfile(rows).cards[0];
  assert.equal(card?.state,'FADE_ASSOCIATED_BETTER');
  assert.ok((card?.matchedResponseDifference??0)<=-15);
  assert.match(card?.interpretation||'',/support minimal/i);
});

test('similar supported and faded reps produce NO_CLEAR_DIFFERENCE',()=>{
  const rows=[
    row(0,{intervened:true,status:'CLEAN'}),
    row(1,{intervened:true,status:'CLEAN'}),
    row(2,{intervened:true,status:'MISSED'}),
    row(3,{intervened:false,mode:'FADE',status:'CLEAN'}),
    row(4,{intervened:false,mode:'FADE',status:'CLEAN'}),
    row(5,{intervened:false,mode:'FADE',status:'MISSED'}),
  ];
  const card=buildClimbInterventionValueProfile(rows).cards[0];
  assert.equal(card?.state,'NO_CLEAR_DIFFERENCE');
  assert.equal(card?.matchedResponseDifference,0);
});

test('NOT_OBSERVED reps are neutral and never enter intervention-value denominators',()=>{
  const rows=[
    row(0,{intervened:true,status:'CLEAN'}),
    row(1,{intervened:false,mode:'FADE',status:'CLEAN'}),
    row(2,{intervened:true,status:'NOT_OBSERVED'}),
    row(3,{intervened:false,mode:'FADE',status:'NOT_OBSERVED'}),
  ];
  const card=buildClimbInterventionValueProfile(rows).cards[0];
  assert.equal(card?.supportedObserved,1);
  assert.equal(card?.fadedObserved,1);
  assert.equal(card?.comparablePairs,1);
});

test('cell weighting uses matched pair count rather than letting an imbalanced easy cell dominate',()=>{
  const rows:HistoryAnalysisRow[]=[];
  let i=0;
  // Cell A: lots of supported games but only one faded comparator, +100.
  for(let n=0;n<8;n++)rows.push(row(i++,{intervened:true,status:'CLEAN',targetTag:'MULTI_ACCESS',repLevel:3}));
  rows.push(row(i++,{intervened:false,mode:'FADE',status:'MISSED',targetTag:'MULTI_ACCESS',repLevel:3}));
  // Cell B: one supported comparator and four faded reps, -100.
  rows.push(row(i++,{intervened:true,status:'MISSED',targetTag:'PICK_PRESSURE',repLevel:3}));
  for(let n=0;n<4;n++)rows.push(row(i++,{intervened:false,mode:'FADE',status:'CLEAN',targetTag:'PICK_PRESSURE',repLevel:3}));

  const card=buildClimbInterventionValueProfile(rows).cards[0];
  assert.equal(card?.matchedCells,2);
  assert.equal(card?.comparablePairs,2);
  assert.equal(card?.matchedResponseDifference,0);
  assert.equal(card?.state,'BUILDING');
});

test('learning profile, API and Progress expose the same Intervention Value model',()=>{
  const repo=fs.readFileSync('lib/server/proLearningRepository.ts','utf8');
  const route=fs.readFileSync('app/api/decision-twin/route.ts','utf8');
  const progress=fs.readFileSync('components/DecisionTwinCommandCenter.tsx','utf8');
  assert.ok(repo.includes('buildClimbInterventionValueProfile'));
  assert.ok(repo.includes('interventionValue'));
  assert.ok(route.includes('buildClimbInterventionValueProfile'));
  assert.ok(route.includes('interventionValue'));
  assert.ok(progress.includes('CLIMB INTERVENTION VALUE'));
  assert.ok(progress.includes('matched response difference'));
  assert.ok(progress.includes('interventionValue'));
});

function mission(){
  return{
    version:1,id:'mission-next',status:'READY',behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',
    curriculumPhase:'STABILISE',repLevel:3,repStage:'STABILISE',repLabel:'Stabilise',repObjective:'Repeat it.',
    repDifficultyRule:'Repeat.',repPromotionGate:'Repeated clean evidence.',champion:'Jinx',role:'ADC',targetTag:'MULTI_ACCESS',
    title:'Fight Selection',whyThisGame:'Multiple access threats.',trigger:'FIRST CONTACT STARTS.',
    action:'CHECK ACCESS BEFORE ENTERING.',cue:'CHECK ACCESS.',successDefinition:'GOOD',failureDefinition:'IMPROVE',
    rehearsalQuestion:'What must be true?',relevantEnemies:['Nocturne','Rakan'],reviewRule:'Verified only.',
    graduationRule:'Repeated evidence.',source:'CLIMB_CURRICULUM',boundary:'Frozen.',
  } as any;
}
function curriculum(){return{version:1,status:'ACTIVE',currentLesson:{behaviourKey:'FIGHT_SELECTION'},queue:[],graduated:[]} as any}
function coachTwin(){return{version:1,generatedAt:'2026-09-22T12:00:00.000Z',gamesAnalyzed:10,interventionsFrozen:5,interventionsObserved:5,behavioursProfiled:1,behaviourProfiles:[],overallMethods:[],summary:'test',boundary:'test'} as any}

test('strong matched support signal tunes Strategy without overriding autonomy hierarchy',()=>{
  const rows:HistoryAnalysisRow[]=[];
  let i=0;
  for(let n=0;n<5;n++)rows.push(row(i++,{intervened:true,status:'CLEAN'}));
  for(const status of ['MISSED','CLEAN','MISSED','CLEAN','CLEAN'] as Status[]){
    rows.push(row(i++,{intervened:false,mode:'FADE',status}));
  }
  const value=buildClimbInterventionValueProfile(rows).cards[0];
  assert.equal(value?.state,'STRONG_SUPPORT_ASSOCIATED_LIFT');
  assert.equal(value?.matchedResponseDifference,40);

  const strategy=buildClimbCoachingStrategy({rows,curriculum:curriculum(),mission:mission(),coachTwin:coachTwin()});
  assert.equal(strategy?.interventionValueState,'STRONG_SUPPORT_ASSOCIATED_LIFT');
  assert.equal(strategy?.interventionResponseDifference,40);
  assert.equal(strategy?.mode,'REINFORCE');
  assert.equal(strategy?.deliveryPolicy,'LIGHT');
  assert.match(strategy?.decision||'',/association evidence, not proof of causation/i);
});

