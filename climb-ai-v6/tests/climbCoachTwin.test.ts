import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildClimbCoachTwin,
  selectClimbCoachIntervention,
  reviewClimbCoachIntervention,
  type ClimbCoachInterventionReview,
} from '../lib/climbCoachTwin';
import type {HistoryAnalysisRow} from '../lib/riot/proHistory';
import type {ClimbMatchMission} from '../lib/climbMissionDesign';

function mission():ClimbMatchMission{
  return{
    version:1,
    id:'climb-mission:carry_preservation:multi_access:jinx',
    status:'READY',
    behaviourKey:'CARRY_PRESERVATION',
    behaviourLabel:'Carry Preservation',
    curriculumPhase:'PRACTISE',
    repLevel:2,
    repStage:'EXECUTE',
    repLabel:'Execute the Branch',
    repObjective:'Execute the right branch when the cue appears.',
    repDifficultyRule:'Same branch, repeated execution.',
    repPromotionGate:'Repeated verified clean evidence.',
    champion:'Jinx',
    role:'ADC',
    targetTag:'MULTI_ACCESS',
    title:'REP 2/5 · EXECUTE · Carry Preservation',
    whyThisGame:'Nocturne and Rakan create multiple access layers.',
    trigger:'NOCTURNE + RAKAN START OR THREATEN FIRST CONTACT.',
    action:'KEEP THE SAFE DAMAGE LINE UNTIL THEIR ACCESS IS SPENT.',
    cue:'REP 2/5 · HOLD THE SAFE DAMAGE LINE.',
    successDefinition:'Verified Carry Preservation is GOOD.',
    failureDefinition:'Verified Carry Preservation is IMPROVE.',
    rehearsalQuestion:'When first contact starts, what must still be accounted for?',
    relevantEnemies:['Nocturne','Rakan'],
    reviewRule:'Only matching verified decisions count.',
    graduationRule:'Repeated evidence required.',
    source:'CLIMB_CURRICULUM',
    boundary:'Frozen before play.',
  };
}

function review(index:number,method:string,status:'EXECUTED'|'MISSED'|'MIXED'|'NOT_OBSERVED',score=100):ClimbCoachInterventionReview{
  const matched=status==='NOT_OBSERVED'?0:status==='MIXED'?2:1;
  const clean=status==='EXECUTED'?1:status==='MIXED'?Math.round(score/100*matched):0;
  return{
    version:1,
    active:true,
    interventionId:'coach-'+index,
    missionId:'mission-'+index,
    behaviourKey:'CARRY_PRESERVATION',
    behaviourLabel:'Carry Preservation',
    targetTag:'MULTI_ACCESS',
    method:method as any,
    methodLabel:method,
    selectionMode:'EXPLORE',
    deliveryPolicy:'FULL',
    status,
    matchedMoments:matched,
    cleanMoments:clean,
    improveMoments:matched-clean,
    responseScore:status==='NOT_OBSERVED'?null:score,
    note:'synthetic coach response',
    boundary:'association only',
  };
}

function row(index:number,item:ClimbCoachInterventionReview):HistoryAnalysisRow{
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
      decisionGraph:{version:1,nodes:[],summary:{coachIntervention:item}} as any,
    } as any,
  };
}

test('Coach Twin refuses to infer a preferred teaching method from one clean game',()=>{
  const twin=buildClimbCoachTwin([row(0,review(0,'WHEN_THEN','EXECUTED'))]);
  const profile=twin.behaviourProfiles[0];
  assert.ok(profile);
  assert.equal(profile.preferredMethod,null);
  assert.equal(profile.preferenceConfidence,'LOW');
  assert.equal(profile.status,'EXPLORING');
  assert.match(twin.boundary,/does not prefer a method from one game/i);
});

test('Coach Twin explores under-tested coaching formats before exploiting a preference',()=>{
  const twin=buildClimbCoachTwin([
    row(0,review(0,'WHEN_THEN','EXECUTED')),
    row(1,review(1,'WHEN_THEN','EXECUTED')),
  ]);
  const intervention=selectClimbCoachIntervention({twin,mission:mission()});
  assert.ok(intervention);
  assert.equal(intervention?.selectionMode,'EXPLORE');
  assert.notEqual(intervention?.method,'WHEN_THEN');
});

test('repeated within-player response can produce an evidence-backed coaching preference',()=>{
  const rows:HistoryAnalysisRow[]=[
    row(0,review(0,'WHEN_THEN','EXECUTED')),
    row(1,review(1,'WHEN_THEN','EXECUTED')),
    row(2,review(2,'WHEN_THEN','EXECUTED')),
    row(3,review(3,'CONTRAST_BRANCH','MISSED',0)),
    row(4,review(4,'CONTRAST_BRANCH','MIXED',50)),
    row(5,review(5,'THREAT_ANCHOR','MISSED',0)),
    row(6,review(6,'THREAT_ANCHOR','MISSED',0)),
    row(7,review(7,'SELF_EXPLAIN','MIXED',50)),
    row(8,review(8,'SELF_EXPLAIN','MISSED',0)),
  ];
  const twin=buildClimbCoachTwin(rows);
  const profile=twin.behaviourProfiles[0];
  assert.equal(profile.preferredMethod,'WHEN_THEN');
  assert.ok(['MEDIUM','HIGH'].includes(profile.preferenceConfidence));
  const intervention=selectClimbCoachIntervention({twin,mission:mission()});
  assert.equal(intervention?.method,'WHEN_THEN');
  assert.equal(intervention?.selectionMode,'PREFERRED');
  assert.match(intervention?.whyThisMethod||'',/repeated verified response/i);
});

test('Coach Twin discovers a hidden coaching-format advantage without being told the affinity',()=>{
  const rows:HistoryAnalysisRow[]=[];
  const methodsSeen=new Set<string>();
  const hiddenBest='WHEN_THEN';

  for(let game=0;game<12;game++){
    const twin=buildClimbCoachTwin(rows);
    const intervention=selectClimbCoachIntervention({twin,mission:mission()});
    assert.ok(intervention);
    methodsSeen.add(intervention!.method);

    // The hidden player model is deliberately outside Coach Twin.
    // Coach Twin sees only the frozen method and the verified response afterwards.
    const outcome=intervention!.method===hiddenBest?'EXECUTED':'MISSED';
    rows.push(row(game,review(game,intervention!.method,outcome,outcome==='EXECUTED'?100:0)));
  }

  const learned=buildClimbCoachTwin(rows);
  const profile=learned.behaviourProfiles[0];
  assert.ok(methodsSeen.size>=4,'Coach Twin should explore multiple formats before exploiting one.');
  assert.equal(profile.preferredMethod,hiddenBest);
  assert.ok(['MEDIUM','HIGH'].includes(profile.preferenceConfidence));

  const next=selectClimbCoachIntervention({twin:learned,mission:mission()});
  assert.equal(next?.method,hiddenBest);
  assert.equal(next?.selectionMode,'PREFERRED');
});

test('Coach Twin challenges an old preference when hidden response changes',()=>{
  const rows:HistoryAnalysisRow[]=[];

  // Establish a real preference first.
  for(let game=0;game<12;game++){
    const twin=buildClimbCoachTwin(rows);
    const intervention=selectClimbCoachIntervention({twin,mission:mission()});
    assert.ok(intervention);
    const outcome=intervention!.method==='WHEN_THEN'?'EXECUTED':'MISSED';
    rows.push(row(game,review(game,intervention!.method,outcome,outcome==='EXECUTED'?100:0)));
  }
  assert.equal(buildClimbCoachTwin(rows).behaviourProfiles[0]?.preferredMethod,'WHEN_THEN');

  // The hidden player response changes. Coach Twin is not told this happened.
  let retest:any=null;
  for(let game=12;game<20;game++){
    const twin=buildClimbCoachTwin(rows);
    const intervention=selectClimbCoachIntervention({twin,mission:mission()});
    assert.ok(intervention);
    if(intervention!.selectionMode==='RETEST'){
      retest=intervention;
      break;
    }
    const outcome=intervention!.method==='SELF_EXPLAIN'?'EXECUTED':'MISSED';
    rows.push(row(game,review(game,intervention!.method,outcome,outcome==='EXECUTED'?100:0)));
  }

  assert.ok(retest,'Coach Twin should retest rather than permanently lock to a historical preference.');
  assert.notEqual(retest.method,'WHEN_THEN');
  assert.equal(retest.selectionMode,'RETEST');
});

test('NOT_OBSERVED coaching tests are neutral and do not create false preference evidence',()=>{
  const twin=buildClimbCoachTwin([
    row(0,review(0,'WHEN_THEN','NOT_OBSERVED')),
    row(1,review(1,'WHEN_THEN','NOT_OBSERVED')),
    row(2,review(2,'CONTRAST_BRANCH','EXECUTED')),
  ]);
  const when=twin.overallMethods.find(item=>item.method==='WHEN_THEN');
  assert.equal(when?.frozenGames,2);
  assert.equal(when?.observedGames,0);
  assert.equal(when?.executionRate,null);
  assert.equal(twin.behaviourProfiles[0]?.preferredMethod,null);
});

test('a previously preferred method is retested when recent observed response collapses',()=>{
  const rows:HistoryAnalysisRow[]=[
    row(0,review(0,'WHEN_THEN','EXECUTED')),
    row(1,review(1,'WHEN_THEN','EXECUTED')),
    row(2,review(2,'WHEN_THEN','EXECUTED')),
    row(3,review(3,'WHEN_THEN','EXECUTED')),
    row(4,review(4,'WHEN_THEN','EXECUTED')),
    row(5,review(5,'CONTRAST_BRANCH','MISSED',0)),
    row(6,review(6,'CONTRAST_BRANCH','MISSED',0)),
    row(7,review(7,'THREAT_ANCHOR','MISSED',0)),
    row(8,review(8,'THREAT_ANCHOR','MISSED',0)),
    row(9,review(9,'SELF_EXPLAIN','MISSED',0)),
    row(10,review(10,'SELF_EXPLAIN','MISSED',0)),
    row(11,review(11,'WHEN_THEN','MISSED',0)),
    row(12,review(12,'WHEN_THEN','MISSED',0)),
    row(13,review(13,'WHEN_THEN','MISSED',0)),
  ];
  const twin=buildClimbCoachTwin(rows);
  const profile=twin.behaviourProfiles[0];
  assert.equal(profile.status,'RETESTING');
  assert.equal(profile.preferredMethod,'WHEN_THEN');
  assert.equal(profile.preferenceConfidence,'LOW');
  const intervention=selectClimbCoachIntervention({twin,mission:mission()});
  assert.ok(intervention);
  assert.notEqual(intervention?.method,'WHEN_THEN');
  assert.equal(intervention?.selectionMode,'RETEST');
});

test('Coach Twin review inherits only the frozen matching mission result',()=>{
  const twin=buildClimbCoachTwin([]);
  const intervention=selectClimbCoachIntervention({twin,mission:mission()});
  assert.ok(intervention);
  const notObserved=reviewClimbCoachIntervention(intervention,{
    version:1,active:true,missionId:mission().id,behaviourKey:'CARRY_PRESERVATION',behaviourLabel:'Carry Preservation',
    targetTag:'MULTI_ACCESS',repLevel:2,repStage:'EXECUTE',status:'NOT_OBSERVED',matchedMoments:0,cleanMoments:0,improveMoments:0,note:'',boundary:'',
  });
  assert.equal(notObserved.status,'NOT_OBSERVED');
  assert.equal(notObserved.responseScore,null);
  const executed=reviewClimbCoachIntervention(intervention,{
    version:1,active:true,missionId:mission().id,behaviourKey:'CARRY_PRESERVATION',behaviourLabel:'Carry Preservation',
    targetTag:'MULTI_ACCESS',repLevel:2,repStage:'EXECUTE',status:'EXECUTED',matchedMoments:1,cleanMoments:1,improveMoments:0,note:'',boundary:'',
  });
  assert.equal(executed.status,'EXECUTED');
  assert.equal(executed.responseScore,100);
  assert.match(executed.boundary,/not proof/i);
});

test('Draft Coach, Decision Graph and player profile all share Coach Twin',()=>{
  const draft=fs.readFileSync('app/api/live/draft-coach/route.ts','utf8');
  const graph=fs.readFileSync('lib/decisionGraph.ts','utf8');
  const repo=fs.readFileSync('lib/server/proLearningRepository.ts','utf8');
  const route=fs.readFileSync('app/api/decision-twin/route.ts','utf8');
  assert.ok(draft.includes('buildClimbCoachTwin'));
  assert.ok(draft.includes('selectClimbCoachIntervention'));
  assert.ok(draft.includes('coachIntervention'));
  assert.ok(graph.includes('reviewClimbCoachIntervention(plan?.coachIntervention,climbMissionReview)'));
  assert.ok(graph.includes('coachIntervention:raw.coachIntervention??null'));
  assert.ok(repo.includes('coachTwin'));
  assert.ok(route.includes('coachTwin'));
  const companion=fs.readFileSync('companion/electron/remember-v5-esports.js','utf8');
  const review=fs.readFileSync('companion/electron/review-v2-core.js','utf8');
  assert.ok(companion.includes('enrichedCoach._coachIntervention=response?.coachIntervention||null'));
  assert.ok(companion.includes('coachIntervention:coach?._coachIntervention||null'));
  assert.ok(companion.includes('coachIntervention?.primaryCue'));
  assert.ok(review.includes('COACH TWIN · DID THIS TEACHING FORMAT LAND?'));
  assert.ok(review.includes('function renderCoachTwinReview'));
  assert.ok(review.includes('RESPONSE ASSOCIATION ≠ CAUSATION'));
});
