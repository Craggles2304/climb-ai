import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAdaptiveCoachingSession,applyAdaptiveCoachingSession} from '../lib/climbAdaptiveCoachingSession';

function identity(overrides:Record<string,unknown>={}){
  return{
    version:1,gamesAnalyzed:8,status:'READY',confidence:'MEDIUM',identityKey:'test',headline:'Test',summary:'Test',
    rootCause:{status:'REPEATED_ROOT_CAUSE',layer:'GAME_READ',label:'Game-State Recognition',share:70,games:4,evidence:'root'},
    knowledgeExecution:{behaviourKey:'FIGHT_SELECTION',diagnosis:'ALIGNED',observedReviews:4,sameDiagnosisStreak:2,evidence:'intent'},
    coachingResponse:{behaviourKey:'FIGHT_SELECTION',preferredMethod:'SELF_EXPLAIN',preferredMethodLabel:'Self-Explain',preferenceStatus:'PREFERRED',preferenceConfidence:'HIGH',observedGames:4,evidence:'coach'},
    autonomy:{behaviourKey:'FIGHT_SELECTION',state:'EMERGING',supportNeed:'LIGHT',autonomyStrength:55,supportDependenceGap:4,evidence:'auto',nextTest:'test'},
    interventionValue:{behaviourKey:'FIGHT_SELECTION',state:'BUILDING',confidence:'LOW',responseDifference:null,evidence:'value'},
    development:{behaviourKey:'FIGHT_SELECTION',label:'Fight Selection',phase:'PRACTISE',repLevel:2,repStage:'EXECUTE',gameRule:'RULE',graduationRule:'GRAD',nextLesson:'Lead Protection',evidence:'dev'},
    coachBrief:{focus:'Fight Selection',firstQuestion:'WHAT STATE ARE WE IN?',delivery:'Self Explain',support:'LIGHT',liveInterruptions:3,avoid:[],success:'clean',oneSentence:'coach'},
    stability:{score:67,stableFacets:4,totalFacets:6,reason:'stable'},
    change:{status:'UNCHANGED',changedFields:[],summary:'same'},source:'OP_CLIMB_PLAYER_COACHING_IDENTITY',boundary:'boundary',
    ...overrides,
  } as any;
}
function curriculum(overrides:Record<string,unknown>={}){
  return{
    version:1,gamesAnalyzed:8,status:'ACTIVE',
    currentLesson:{
      behaviourKey:'FIGHT_SELECTION',label:'Fight Selection',phase:'PRACTISE',readiness:'ACTIVE',
      repLadder:{level:2,stage:'EXECUTE'},gameRule:'RULE',graduationRule:'GRAD',whyNow:'why',nextUnlock:'Lead Protection',
    },
    nextLesson:{behaviourKey:'LEAD_PROTECTION',label:'Lead Protection'},
    autonomous:{activeContract:{state:'PRACTISE',supportPolicy:'LIGHT',testDirective:{mode:'LOCAL_REP'}}},
    ...overrides,
  } as any;
}
function row(day:number,input:{
  mission?:string;strategy?:string;intent?:string;route?:string;layer?:string|null;transfer?:string;intervened?:boolean;autonomyEvidence?:boolean;
}={}){
  const mission=input.mission??'EXECUTED';
  const strategy=input.strategy??(mission==='EXECUTED'?'CLEAN':'MISSED');
  return{
    champion:'Jinx',role:'ADC',createdAt:new Date(Date.UTC(2026,0,day)).toISOString(),
    analysis:{version:1,decisionGraph:{summary:{
      climbMission:{version:1,active:true,behaviourKey:'FIGHT_SELECTION',status:mission},
      coachingStrategy:{version:1,active:true,behaviourKey:'FIGHT_SELECTION',status:strategy,intervened:input.intervened??true,autonomyEvidence:input.autonomyEvidence??false},
      intentGap:{version:1,active:true,behaviourKey:'FIGHT_SELECTION',diagnosis:input.intent??'ALIGNED'},
      causalCoachRoute:{version:1,active:true,status:input.route??'CONFIRMED',observedLayer:input.layer??'GAME_READ'},
      decisionTransfer:{version:1,active:true,behaviourKey:'FIGHT_SELECTION',status:input.transfer??'NO_TEST'},
    }}},
  } as any;
}

test('BUILDING identity does not create a fake multi-game coaching block',()=>{
  const session=buildAdaptiveCoachingSession({
    rows:[],identity:identity({status:'BUILDING'}),curriculum:curriculum(),generatedAt:'2026-01-01T00:00:00.000Z',
  });
  assert.equal(session.status,'BUILDING');
  assert.equal(session.id,null);
  assert.equal(session.currentStep,null);
  assert.match(session.boundary,/ONE CONTRADICTORY GAME/);
});

test('new practice objective starts at Reinforce rather than blindly restarting Game 1 teaching',()=>{
  const session=buildAdaptiveCoachingSession({
    rows:[],identity:identity(),curriculum:curriculum(),generatedAt:'2026-01-01T00:00:00.000Z',
  });
  assert.equal(session.currentStep?.phase,'REINFORCE');
  assert.equal(session.currentStepNumber,2);
  assert.equal(session.blockPlan.length,5);
});


test('new session never fast-forwards by replaying historical reps',()=>{
  const session=buildAdaptiveCoachingSession({
    rows:[row(1),row(2),row(3)],identity:identity(),curriculum:curriculum(),generatedAt:'2026-01-03T23:00:00.000Z',
  });
  assert.equal(session.currentStep?.phase,'REINFORCE');
  assert.equal(session.observedGames,0);
  assert.equal(session.notObservedGames,0);
  assert.equal(session.events.filter(item=>item.action==='ADVANCE').length,0);
  assert.equal(session.lastEvaluatedAt,new Date(Date.UTC(2026,0,3)).toISOString());
});

test('NOT OBSERVED holds the current phase and awards no progression',()=>{
  const start=buildAdaptiveCoachingSession({rows:[],identity:identity(),curriculum:curriculum(),generatedAt:'2026-01-01T00:00:00.000Z'});
  const next=buildAdaptiveCoachingSession({
    rows:[row(2,{mission:'NOT_OBSERVED',strategy:'NOT_OBSERVED'})],
    identity:identity(),curriculum:curriculum(),previous:start,generatedAt:'2026-01-02T23:00:00.000Z',
  });
  assert.equal(next.currentStep?.phase,'REINFORCE');
  assert.equal(next.observedGames,0);
  assert.equal(next.notObservedGames,1);
  assert.equal(next.events.at(-1)?.action,'NOT_OBSERVED');
});

test('one different causal layer creates an evidence watch, not an immediate session rewrite',()=>{
  const start=buildAdaptiveCoachingSession({rows:[],identity:identity(),curriculum:curriculum(),generatedAt:'2026-01-01T00:00:00.000Z'});
  const next=buildAdaptiveCoachingSession({
    rows:[row(2,{route:'SHIFT_REQUIRED',layer:'EXECUTION'})],
    identity:identity(),curriculum:curriculum(),previous:start,generatedAt:'2026-01-02T23:00:00.000Z',
  });
  assert.equal(next.currentStep?.phase,'REINFORCE');
  assert.equal(next.routeWatchLayer,'EXECUTION');
  assert.equal(next.routeWatchCount,1);
  assert.equal(next.events.at(-1)?.action,'EVIDENCE_WATCH');
});

test('two repeated causal mismatches can replan the session without replacing the Curriculum objective',()=>{
  const start=buildAdaptiveCoachingSession({rows:[],identity:identity(),curriculum:curriculum(),generatedAt:'2026-01-01T00:00:00.000Z'});
  const oldIdentity=identity({rootCause:{status:'REPEATED_ROOT_CAUSE',layer:'FOLLOW_THROUGH',label:'Follow-Through',share:70,games:4,evidence:'old'}});
  const first=buildAdaptiveCoachingSession({
    rows:[row(2,{route:'SHIFT_REQUIRED',layer:'GAME_READ'})],
    identity:oldIdentity,curriculum:curriculum(),previous:start,generatedAt:'2026-01-02T23:00:00.000Z',
  });
  const second=buildAdaptiveCoachingSession({
    rows:[row(2,{route:'SHIFT_REQUIRED',layer:'GAME_READ'}),row(3,{route:'SHIFT_REQUIRED',layer:'GAME_READ'})],
    identity:oldIdentity,curriculum:curriculum(),previous:first,generatedAt:'2026-01-03T23:00:00.000Z',
  });
  assert.equal(second.objectiveKey,'FIGHT_SELECTION');
  assert.equal(second.currentStep?.phase,'DIAGNOSE_TEACH');
  assert.equal(second.replanCount,1);
  assert.equal(second.events.at(-1)?.action,'REPLAN');
});

test('support dependence blocks Fade and restores an earlier support phase',()=>{
  const base=curriculum();
  const fadeCurriculum=curriculum({
    currentLesson:{...base.currentLesson,phase:'STABILISE',repLadder:{level:3,stage:'STABILISE'}},
    autonomous:{activeContract:{state:'STABILISE',supportPolicy:'FADED',testDirective:{mode:'LOCAL_REP'}}},
  });
  const start=buildAdaptiveCoachingSession({
    rows:[],
    identity:identity({autonomy:{...identity().autonomy,state:'EMERGING',supportNeed:'LIGHT'}}),
    curriculum:fadeCurriculum,generatedAt:'2026-01-01T00:00:00.000Z',
  });
  assert.equal(start.currentStep?.phase,'FADE_TEST');
  const dependent=identity({autonomy:{...identity().autonomy,state:'SUPPORT_DEPENDENT',supportNeed:'FULL'}});
  const next=buildAdaptiveCoachingSession({
    rows:[row(2,{intervened:false,autonomyEvidence:true})],identity:dependent,curriculum:fadeCurriculum,previous:start,generatedAt:'2026-01-02T23:00:00.000Z',
  });
  assert.equal(next.currentStep?.phase,'DIAGNOSE_TEACH');
  assert.equal(next.events.at(-1)?.action,'REGRESS');
  assert.match(next.nextGameBrief.blocker||'',/safety-blocked/i);
});

test('clean Fade rep cannot force Transfer while Curriculum transfer gate is locked',()=>{
  const base=curriculum();
  const fadeCurriculum=curriculum({
    currentLesson:{...base.currentLesson,phase:'STABILISE',repLadder:{level:3,stage:'STABILISE'}},
    autonomous:{activeContract:{state:'STABILISE',supportPolicy:'FADED',testDirective:{mode:'LOCAL_REP'}}},
  });
  const autonomous=identity({autonomy:{...identity().autonomy,state:'EMERGING',supportNeed:'MINIMAL'}});
  const start=buildAdaptiveCoachingSession({rows:[],identity:autonomous,curriculum:fadeCurriculum,generatedAt:'2026-01-01T00:00:00.000Z'});
  const next=buildAdaptiveCoachingSession({
    rows:[row(2,{intervened:false,autonomyEvidence:true})],identity:autonomous,curriculum:fadeCurriculum,previous:start,generatedAt:'2026-01-02T23:00:00.000Z',
  });
  assert.equal(next.currentStep?.phase,'FADE_TEST');
  assert.match(next.nextGameBrief.blocker||'',/transfer remains locked/i);
});

test('verified transfer advances to final Graduate / Replan proof step',()=>{
  const base=curriculum();
  const tx=curriculum({
    currentLesson:{...base.currentLesson,phase:'TRANSFER',repLadder:{level:5,stage:'TRANSFER'}},
    autonomous:{activeContract:{state:'TRANSFER_TEST',supportPolicy:'FADED',testDirective:{mode:'TRANSFER_TEST'}}},
  });
  const autonomous=identity({autonomy:{...identity().autonomy,state:'AUTONOMOUS',supportNeed:'MINIMAL'}});
  const start=buildAdaptiveCoachingSession({rows:[],identity:autonomous,curriculum:tx,generatedAt:'2026-01-01T00:00:00.000Z'});
  assert.equal(start.currentStep?.phase,'TRANSFER_TEST');
  const next=buildAdaptiveCoachingSession({
    rows:[row(2,{transfer:'TRANSFERRED',intervened:false,autonomyEvidence:true})],
    identity:autonomous,curriculum:tx,previous:start,generatedAt:'2026-01-02T23:00:00.000Z',
  });
  assert.equal(next.status,'READY_TO_GRADUATE');
  assert.equal(next.currentStep?.phase,'GRADUATE_REPLAN');
  assert.equal(next.events.at(-1)?.action,'READY_TO_GRADUATE');
});

test('session Fade policy cannot override a FULL safety strategy',()=>{
  const base=curriculum();
  const tx=curriculum({
    currentLesson:{...base.currentLesson,phase:'TRANSFER',repLadder:{level:5,stage:'TRANSFER'}},
    autonomous:{activeContract:{state:'TRANSFER_TEST',supportPolicy:'FADED',testDirective:{mode:'TRANSFER_TEST'}}},
  });
  const autonomous=identity({autonomy:{...identity().autonomy,state:'AUTONOMOUS',supportNeed:'MINIMAL'}});
  const session=buildAdaptiveCoachingSession({rows:[],identity:autonomous,curriculum:tx,generatedAt:'2026-01-01T00:00:00.000Z'});
  const strategy={
    version:1,id:'s',missionId:'m',behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',targetTag:'GENERAL',
    mode:'TEACH',intervene:true,deliveryPolicy:'FULL',repLevel:5,repStage:'TRANSFER',
    recentObservedMissions:4,recentExecutionRate:70,recentCleanStreak:1,recentMissStreak:0,coachTwinStatus:'PREFERRED',
    intentDiagnosis:'KNOWLEDGE_GAP',intentEvidenceStreak:2,autonomyState:'SUPPORT_DEPENDENT',autonomyStrength:40,supportDependenceGap:30,
    interventionValueState:'BUILDING',interventionResponseDifference:null,interventionValueConfidence:'LOW',
    experimentId:null,experimentType:null,experimentInformationNeed:null,title:'base',playerMessage:'base',decision:'base',coachDirective:'base',
    successDefinition:'base',autonomyTest:false,source:'CLIMB_COACHING_STRATEGY',boundary:'base',
  } as any;
  const routed=applyAdaptiveCoachingSession(strategy,session);
  assert.ok(routed);
  assert.equal(routed.mode,'TEACH');
  assert.equal(routed.deliveryPolicy,'FULL');
  assert.equal(routed.adaptiveSessionConstrained,true);
  assert.equal(routed.adaptiveSessionPhase,'TRANSFER_TEST');
});
