import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildClimbIntentProbe,
  publicClimbIntentProbe,
  answerClimbIntentProbe,
  reviewClimbIntentGap,
  summarizeIntentGapHistory,
  type ClimbIntentGapReview,
} from '../lib/climbIntentGap';
import {buildClimbCoachingStrategy} from '../lib/climbCoachingStrategy';
import type {HistoryAnalysisRow} from '../lib/riot/proHistory';
import type {ClimbMatchMission,ClimbMatchMissionReview} from '../lib/climbMissionDesign';

function mission():ClimbMatchMission{
  return{
    version:1,
    id:'climb-mission:fight_selection:multi_access:jinx',
    status:'READY',
    behaviourKey:'FIGHT_SELECTION',
    behaviourLabel:'Fight Selection',
    curriculumPhase:'PRACTISE',
    repLevel:3,
    repStage:'STABILISE',
    repLabel:'Stabilise under repetition',
    repObjective:'Choose deliberately before first contact chooses for you.',
    repDifficultyRule:'Hold the branch across repeated windows.',
    repPromotionGate:'Repeated clean evidence.',
    champion:'Jinx',
    role:'ADC',
    targetTag:'MULTI_ACCESS',
    title:'Fight Selection',
    whyThisGame:'Nocturne and Rakan create multiple access layers.',
    trigger:'NOCTURNE + RAKAN START OR THREATEN FIRST CONTACT.',
    action:'CHECK ACCESS AND ENTER ONLY WHEN THE FROZEN FIGHT TRIGGER IS TRUE.',
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

function review(status:'EXECUTED'|'MISSED'|'MIXED'|'NOT_OBSERVED'):ClimbMatchMissionReview{
  const matched=status==='NOT_OBSERVED'?0:status==='MIXED'?2:1;
  const clean=status==='EXECUTED'?1:status==='MIXED'?1:0;
  return{
    version:1,
    active:true,
    missionId:mission().id,
    behaviourKey:'FIGHT_SELECTION',
    behaviourLabel:'Fight Selection',
    targetTag:'MULTI_ACCESS',
    repLevel:3,
    repStage:'STABILISE',
    status,
    matchedMoments:matched,
    cleanMoments:clean,
    improveMoments:matched-clean,
    note:'synthetic',
    boundary:'verified only',
  };
}

function answered(correct:boolean){
  const probe=buildClimbIntentProbe(mission());
  assert.ok(probe);
  const option=probe!.options.find(item=>(item.id===probe!.answerKey)===correct);
  assert.ok(option);
  return answerClimbIntentProbe(probe!,option!.id,'2026-09-22T12:00:00.000Z');
}

function intentReview(correct:boolean,status:'EXECUTED'|'MISSED'|'MIXED'|'NOT_OBSERVED'){
  return reviewClimbIntentGap(answered(correct),review(status));
}

function row(index:number,missionStatus:'EXECUTED'|'MISSED'|'MIXED',intent:ClimbIntentGapReview):HistoryAnalysisRow{
  return{
    champion:'Jinx',
    role:'ADC',
    createdAt:'2026-09-'+String(index+1).padStart(2,'0')+'T12:00:00.000Z',
    analysis:{
      version:1,
      champion:'Jinx',
      role:'ADC',
      evidenceSources:['TEST'],
      metrics:{},
      leakSignals:[],
      fingerprint:{primary:'TEST',sequence:[],confidence:'HIGH',explanation:'test'},
      decisionGraph:{version:1,nodes:[],summary:{climbMission:review(missionStatus),intentGap:intent}} as any,
    } as any,
  };
}

function curriculum(){
  return{version:1,status:'ACTIVE',currentLesson:{behaviourKey:'FIGHT_SELECTION'},queue:[],graduated:[]} as any;
}
function coachTwin(){
  return{
    version:1,generatedAt:'2026-09-22T12:00:00.000Z',gamesAnalyzed:5,interventionsFrozen:4,interventionsObserved:4,behavioursProfiled:1,
    behaviourProfiles:[{behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',targetTag:'ANY',totalFrozen:4,totalObserved:4,methods:[],preferredMethod:null,preferredMethodLabel:null,preferenceConfidence:'LOW',preferenceEdge:null,status:'BUILDING',evidence:'test'}],
    overallMethods:[],summary:'test',boundary:'test',
  } as any;
}

test('Intent Gap freezes a two-branch probe without leaking the answer in the public payload',()=>{
  const probe=buildClimbIntentProbe(mission());
  assert.ok(probe);
  assert.equal(probe?.options.length,2);
  assert.ok(probe?.answerKey);
  assert.ok(probe?.correctBranch.includes('CHECK ACCESS'));
  const view=publicClimbIntentProbe(probe);
  assert.ok(view);
  assert.equal('answerKey' in (view as any),false);
  assert.equal('correctBranch' in (view as any),false);
  assert.equal('oldBranch' in (view as any),false);
  assert.match(view!.prompt,/BEFORE THE COACHING CUE/i);
});

test('correct pre-cue intent plus missed execution becomes EXECUTION_GAP',()=>{
  const result=reviewClimbIntentGap(answered(true),review('MISSED'));
  assert.equal(result.status,'EXECUTION_GAP');
  assert.equal(result.diagnosis,'EXECUTION_GAP');
  assert.equal(result.intentCorrect,true);
  assert.equal(result.nextCoachingNeed,'REDUCE_EXECUTION_FRICTION');
  assert.match(result.note,/knew the correct branch/i);
});

test('wrong pre-cue intent plus missed execution becomes KNOWLEDGE_GAP',()=>{
  const result=reviewClimbIntentGap(answered(false),review('MISSED'));
  assert.equal(result.status,'KNOWLEDGE_GAP');
  assert.equal(result.diagnosis,'KNOWLEDGE_GAP');
  assert.equal(result.intentCorrect,false);
  assert.equal(result.nextCoachingNeed,'TEACH_UNDERSTANDING');
  assert.match(result.note,/selected the wrong branch/i);
});

test('wrong pre-cue intent followed by clean execution is recovery evidence, not causal attribution',()=>{
  const result=reviewClimbIntentGap(answered(false),review('EXECUTED'));
  assert.equal(result.status,'RECOVERED_AFTER_MISREAD');
  assert.equal(result.diagnosis,'RECOVERED');
  assert.match(result.note,/without claiming/i);
});

test('unobserved match moments never score frozen intent',()=>{
  const result=reviewClimbIntentGap(answered(true),review('NOT_OBSERVED'));
  assert.equal(result.status,'NOT_OBSERVED');
  assert.equal(result.diagnosis,'NO_EVIDENCE');
  assert.equal(result.nextCoachingNeed,'TEST_AGAIN');
});

test('unanswered probes never let telemetry invent player intent',()=>{
  const result=reviewClimbIntentGap(buildClimbIntentProbe(mission()),review('MISSED'));
  assert.equal(result.status,'NOT_ANSWERED');
  assert.equal(result.intentCorrect,null);
  assert.match(result.note,/will not infer intent/i);
});

test('Intent Gap history separates repeated knowledge gaps from repeated execution gaps',()=>{
  const knowledge=[
    row(0,'MISSED',intentReview(false,'MISSED')),
    row(1,'MISSED',intentReview(false,'MISSED')),
  ];
  const execution=[
    row(0,'MISSED',intentReview(true,'MISSED')),
    row(1,'MISSED',intentReview(true,'MISSED')),
  ];
  const k=summarizeIntentGapHistory(knowledge,'FIGHT_SELECTION');
  const e=summarizeIntentGapHistory(execution,'FIGHT_SELECTION');
  assert.equal(k.recentDiagnosis,'KNOWLEDGE_GAP');
  assert.equal(k.recentSameDiagnosisStreak,2);
  assert.equal(e.recentDiagnosis,'EXECUTION_GAP');
  assert.equal(e.recentSameDiagnosisStreak,2);
});

test('repeated knowledge gaps make Coaching Strategy teach understanding instead of generic diagnosis',()=>{
  const rows=[
    row(0,'MISSED',intentReview(false,'MISSED')),
    row(1,'MISSED',intentReview(false,'MISSED')),
  ];
  const strategy=buildClimbCoachingStrategy({rows,curriculum:curriculum(),mission:mission(),coachTwin:coachTwin()});
  assert.equal(strategy?.mode,'TEACH');
  assert.equal(strategy?.intentDiagnosis,'KNOWLEDGE_GAP');
  assert.match(strategy?.title||'',/KNOWLEDGE GAP/i);
  assert.match(strategy?.coachDirective||'',/why this branch is correct/i);
});

test('repeated execution gaps prevent re-teaching and use light execution reinforcement',()=>{
  const rows=[
    row(0,'MISSED',intentReview(true,'MISSED')),
    row(1,'MISSED',intentReview(true,'MISSED')),
  ];
  const strategy=buildClimbCoachingStrategy({rows,curriculum:curriculum(),mission:mission(),coachTwin:coachTwin()});
  assert.equal(strategy?.mode,'REINFORCE');
  assert.equal(strategy?.deliveryPolicy,'LIGHT');
  assert.equal(strategy?.intentDiagnosis,'EXECUTION_GAP');
  assert.match(strategy?.coachDirective||'',/Do not re-explain/i);
});

test('Intent Gap is frozen server-side and Companion withholds the cue until answer',()=>{
  const draft=fs.readFileSync('app/api/live/draft-coach/route.ts','utf8');
  const route=fs.readFileSync('app/api/live/intent-probe/route.ts','utf8');
  const graph=fs.readFileSync('lib/decisionGraph.ts','utf8');
  const main=fs.readFileSync('companion/electron/main.cjs','utf8');
  const preload=fs.readFileSync('companion/electron/preload.cjs','utf8');
  const companion=fs.readFileSync('companion/electron/remember-v5-esports.js','utf8');
  const post=fs.readFileSync('companion/electron/review-v2-core.js','utf8');

  assert.ok(draft.includes('buildClimbIntentProbe'));
  assert.ok(draft.includes('publicClimbIntentProbe(intentProbe)'));
  assert.ok(route.includes('answerClimbIntentProbe'));
  assert.ok(route.includes('Intent Gap answer is already frozen and cannot be changed.'));
  assert.ok(graph.includes('reviewClimbIntentGap(plan?.intentProbe,climbMissionReview)'));
  assert.ok(graph.includes('intentProbe:raw.intentProbe??null'));
  assert.ok(main.includes('/api/live/intent-probe'));
  assert.ok(main.includes("ipcMain.handle('companion:intent-probe'"));
  assert.ok(preload.includes("answerIntentProbe:(context)=>ipcRenderer.invoke('companion:intent-probe',context)"));
  assert.ok(companion.includes('ANSWER THE INTENT CHECK ABOVE TO UNLOCK THIS COACHING CUE'));
  assert.ok(companion.includes('FREEZE YOUR OWN DECISION FIRST · THE COACHING CUE IS DELIBERATELY HIDDEN'));
  assert.ok(companion.includes('SKIP · SHOW COACHING CUE'));
  assert.ok(companion.includes('INTENT CHECK SKIPPED · NO KNOWLEDGE/EXECUTION DIAGNOSIS WILL BE CREATED'));
  assert.ok(post.includes('INTENT GAP · KNOWING VS DOING'));
  assert.ok(post.includes('function renderIntentGapReview'));
});
