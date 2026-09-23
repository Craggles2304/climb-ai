import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLearningVelocityProfile,learningVelocityExperimentBias,selectLearningVelocityCoachMethod} from '../lib/climbLearningVelocity';
import {buildAdaptiveCoachingSession} from '../lib/climbAdaptiveCoachingSession';

function identity(overrides:Record<string,unknown>={}){
  return {
    version:1,gamesAnalyzed:10,status:'READY',confidence:'MEDIUM',
    identityKey:'test',headline:'Test',summary:'Test',
    rootCause:{status:'REPEATED_ROOT_CAUSE',layer:'FOLLOW_THROUGH',label:'Follow-Through',share:60,games:4,evidence:'root'},
    knowledgeExecution:{behaviourKey:'FIGHT_SELECTION',diagnosis:'ALIGNED',observedReviews:5,sameDiagnosisStreak:3,evidence:'intent'},
    coachingResponse:{behaviourKey:'FIGHT_SELECTION',preferredMethod:null,preferredMethodLabel:null,preferenceStatus:'EXPLORING',preferenceConfidence:'LOW',observedGames:0,evidence:'coach'},
    autonomy:{behaviourKey:'FIGHT_SELECTION',state:'EMERGING',supportNeed:'LIGHT',autonomyStrength:60,supportDependenceGap:0,evidence:'auto',nextTest:'test'},
    interventionValue:{behaviourKey:'FIGHT_SELECTION',state:'BUILDING',confidence:'LOW',responseDifference:null,evidence:'value'},
    development:{behaviourKey:'FIGHT_SELECTION',label:'Fight Selection',phase:'PRACTISE',repLevel:2,repStage:'EXECUTE',gameRule:'RULE',graduationRule:'GRAD',nextLesson:'Lead Protection',evidence:'dev'},
    coachBrief:{focus:'Fight Selection',firstQuestion:'WHAT IS YOUR PRIORITY?',delivery:'Standard',support:'LIGHT',liveInterruptions:2,avoid:[],success:'clean',oneSentence:'coach'},
    stability:{score:70,stableFacets:4,totalFacets:6,reason:'stable'},
    change:{status:'UNCHANGED',changedFields:[],summary:'same'},source:'OP_CLIMB_PLAYER_COACHING_IDENTITY',boundary:'boundary',
    ...overrides,
  } as any;
}
function curriculum(){
  return {
    version:1,gamesAnalyzed:10,status:'ACTIVE',
    currentLesson:{behaviourKey:'FIGHT_SELECTION',label:'Fight Selection',phase:'PRACTISE',readiness:'ACTIVE',repLadder:{level:2,stage:'EXECUTE'},gameRule:'RULE',graduationRule:'GRAD',whyNow:'why',nextUnlock:'Lead Protection'},
    nextLesson:{behaviourKey:'LEAD_PROTECTION',label:'Lead Protection'},
    autonomous:{activeContract:{state:'PRACTISE',supportPolicy:'LIGHT',testDirective:{mode:'LOCAL_REP'}}},
  } as any;
}
function twin(){
  const method=(name:string,label:string,observed=0,executionRate:number|null=null)=>({method:name,label,frozenGames:observed,observedGames:observed,notObservedGames:0,executedGames:executionRate==null?0:Math.round(observed*executionRate/100),mixedGames:0,missedGames:executionRate==null?0:observed-Math.round(observed*executionRate/100),cleanMoments:0,matchedMoments:0,executionRate,cleanMomentRate:null,recentObservedGames:Math.min(3,observed),recentExecutionRate:executionRate});
  return {
    version:1,gamesAnalyzed:10,interventionsFrozen:10,interventionsObserved:10,behavioursProfiled:1,
    behaviourProfiles:[{behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',targetTag:'ANY',totalFrozen:10,totalObserved:10,
      methods:[method('WHEN_THEN','When → Then',6,100),method('CONTRAST_BRANCH','Old Branch → New Branch'),method('THREAT_ANCHOR','Threat Anchor'),method('SELF_EXPLAIN','Self-Explain',3,0)],
      preferredMethod:null,preferredMethodLabel:null,preferenceConfidence:'LOW',preferenceEdge:null,status:'EXPLORING',evidence:'testing'}],
    overallMethods:[],summary:'coach twin',boundary:'boundary'
  } as any;
}
function value(state='BUILDING'){
  return {version:1,generatedAt:'2026-09-23T00:00:00.000Z',gamesAnalyzed:10,behavioursProfiled:1,supportLiftSignals:0,strongSupportLiftSignals:0,fadeBetterSignals:0,
    cards:[{behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',state,confidence:'MEDIUM',matchedCells:1,comparablePairs:3,supportedObserved:4,fadedObserved:4,supportedResponseRate:75,fadedResponseRate:75,matchedResponseDifference:0,supportingCells:0,neutralCells:1,fadeBetterCells:0,consistency:100,nextTest:'BALANCE',evidence:'value',interpretation:'value',cells:[]}],
    summary:'value',boundary:'boundary'} as any;
}
function row(day:number,input:{mission?:string;strategy?:string;intervened?:boolean;autonomy?:boolean;method?:string|null;coachStatus?:string;transfer?:string;route?:string}={}){
  const mission=input.mission??'EXECUTED';
  const strategy=input.strategy??(mission==='EXECUTED'?'CLEAN':'MISSED');
  return {
    champion:'Jinx',role:'ADC',createdAt:new Date(Date.UTC(2026,0,day)).toISOString(),
    analysis:{version:1,decisionGraph:{summary:{
      climbMission:{version:1,active:true,behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',targetTag:'GENERAL',repLevel:3,status:mission},
      coachingStrategy:{version:1,active:true,behaviourKey:'FIGHT_SELECTION',status:strategy,intervened:input.intervened??true,autonomyEvidence:input.autonomy??false},
      coachIntervention:input.method?{version:1,active:true,behaviourKey:'FIGHT_SELECTION',method:input.method,status:input.coachStatus??(mission==='EXECUTED'?'EXECUTED':'MISSED')}:{version:1,active:false,status:'NO_INTERVENTION'},
      decisionTransfer:{version:1,active:true,behaviourKey:'FIGHT_SELECTION',status:input.transfer??'NO_TEST'},
      causalCoachRoute:{version:1,active:true,status:input.route??'CONFIRMED',observedLayer:'FOLLOW_THROUGH'},
      intentGap:{version:1,active:true,behaviourKey:'FIGHT_SELECTION',diagnosis:'ALIGNED'},
    }}}} as any;
}

test('small samples remain BUILDING and do not create a coaching-method shortcut',()=>{
  const p=buildLearningVelocityProfile({rows:[row(1),row(2),row(3)],coachTwin:twin(),interventionValue:value(),identity:identity(),curriculum:curriculum()});
  assert.equal(p.status,'BUILDING');
  assert.equal(p.activeCard?.paceState,'BUILDING');
  assert.equal(p.policy.methodMode,'EXPLORE');
  assert.equal(selectLearningVelocityCoachMethod(p,'FIGHT_SELECTION'),null);
  assert.match(p.boundary,/NOT CAUSAL EFFECT ESTIMATES/);
});

test('stable early independence becomes an EARLY_TEST_CANDIDATE without changing mastery gates',()=>{
  const rows=[
    row(1,{intervened:true}),
    row(2,{intervened:false,autonomy:true}),
    row(3,{intervened:false,autonomy:true}),
    row(4,{intervened:false,autonomy:true}),
    row(5,{intervened:false,autonomy:true}),
  ];
  const p=buildLearningVelocityProfile({rows,coachTwin:twin(),interventionValue:value(),identity:identity(),curriculum:curriculum()});
  assert.equal(p.activeCard?.paceState,'EARLY_TEST_CANDIDATE');
  assert.equal(p.policy.reinforceCleanRepsRequired,1);
  assert.equal(p.policy.fadeCleanRepsRequired,1);
  assert.equal(p.policy.experimentBias,'FADE_WHEN_SAFE');
  assert.match(p.policy.reason,/test reduced support/i);
});

test('knowledge gaps or support dependence force consolidation even with clean history',()=>{
  const rows=[1,2,3,4,5,6].map(day=>row(day,{intervened:false,autonomy:true}));
  const dependent=identity({
    knowledgeExecution:{...identity().knowledgeExecution,diagnosis:'KNOWLEDGE_GAP'},
    autonomy:{...identity().autonomy,state:'SUPPORT_DEPENDENT',supportNeed:'FULL'},
  });
  const p=buildLearningVelocityProfile({rows,coachTwin:twin(),interventionValue:value(),identity:dependent,curriculum:curriculum()});
  assert.equal(p.policy.paceState,'CONSOLIDATE');
  assert.equal(p.policy.reinforceCleanRepsRequired,3);
  assert.equal(p.policy.fadeCleanRepsRequired,2);
  assert.equal(p.policy.experimentBias,'CONSOLIDATE');
});

test('strong support-associated lift also slows test cadence without claiming causation',()=>{
  const rows=[1,2,3,4,5].map(day=>row(day,{intervened:true}));
  const p=buildLearningVelocityProfile({rows,coachTwin:twin(),interventionValue:value('STRONG_SUPPORT_ASSOCIATED_LIFT'),identity:identity(),curriculum:curriculum()});
  assert.equal(p.policy.paceState,'CONSOLIDATE');
  assert.match(p.boundary,/ASSOCIATIONS/);
});

test('repeated method evidence can recommend the format associated with faster independent follow-through',()=>{
  const rows=[
    row(1,{method:'WHEN_THEN'}),
    row(2,{method:'WHEN_THEN',intervened:false,autonomy:true}),
    row(3,{method:'WHEN_THEN',intervened:false,autonomy:true}),
    row(4,{method:'WHEN_THEN',intervened:false,autonomy:true}),
    row(5,{method:'WHEN_THEN',intervened:false,autonomy:true}),
    row(6,{method:'WHEN_THEN',intervened:false,autonomy:true}),
    row(7,{mission:'MISSED',strategy:'MISSED',method:'SELF_EXPLAIN',coachStatus:'MISSED'}),
    row(8,{mission:'MISSED',strategy:'MISSED',method:'SELF_EXPLAIN',coachStatus:'MISSED'}),
    row(9,{mission:'MISSED',strategy:'MISSED',method:'SELF_EXPLAIN',coachStatus:'MISSED'}),
  ];
  const p=buildLearningVelocityProfile({rows,coachTwin:twin(),interventionValue:value(),identity:identity(),curriculum:curriculum()});
  const whenThen=p.activeCard?.methodSignals.find(x=>x.method==='WHEN_THEN');
  const self=p.activeCard?.methodSignals.find(x=>x.method==='SELF_EXPLAIN');
  assert.ok((whenThen?.signalScore??0)>(self?.signalScore??0));
  assert.equal(p.activeCard?.recommendedMethod,'WHEN_THEN');
  assert.equal(selectLearningVelocityCoachMethod(p,'FIGHT_SELECTION'),'WHEN_THEN');
});

test('Learning Velocity exposes a safe experiment bias only for the active behaviour',()=>{
  const p=buildLearningVelocityProfile({rows:[1,2,3,4,5].map(day=>row(day,{intervened:false,autonomy:true})),coachTwin:twin(),interventionValue:value(),identity:identity(),curriculum:curriculum()});
  assert.equal(learningVelocityExperimentBias(p,'FIGHT_SELECTION'),'FADE_WHEN_SAFE');
  assert.equal(learningVelocityExperimentBias(p,'LEAD_PROTECTION'),'BALANCED');
});

test('Adaptive Session honours a consolidation rep target before Fade',()=>{
  const policy={
    behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',paceState:'CONSOLIDATE',
    reinforceCleanRepsRequired:3,fadeCleanRepsRequired:2,experimentBias:'CONSOLIDATE',methodMode:'EXPLORE',
    recommendedMethod:null,recommendedMethodLabel:null,explanationDensity:'FULL',reason:'consolidate',boundary:'boundary'
  } as any;
  const first=buildAdaptiveCoachingSession({rows:[],identity:identity(),curriculum:curriculum(),learningPolicy:policy,generatedAt:'2026-01-01T00:00:00.000Z'});
  assert.equal(first.currentStep?.phase,'REINFORCE');
  const one=buildAdaptiveCoachingSession({rows:[row(2)],identity:identity(),curriculum:curriculum(),previous:first,learningPolicy:policy,generatedAt:'2026-01-02T23:00:00.000Z'});
  assert.equal(one.currentStep?.phase,'REINFORCE');
  assert.equal(one.phaseCleanStreak,1);
  assert.match(one.nextGameBrief.blocker??'',/1\/3/);
  const two=buildAdaptiveCoachingSession({rows:[row(2),row(3)],identity:identity(),curriculum:curriculum(),previous:one,learningPolicy:policy,generatedAt:'2026-01-03T23:00:00.000Z'});
  assert.equal(two.currentStep?.phase,'REINFORCE');
  assert.equal(two.phaseCleanStreak,2);
  const three=buildAdaptiveCoachingSession({rows:[row(2),row(3),row(4)],identity:identity(),curriculum:curriculum(),previous:two,learningPolicy:policy,generatedAt:'2026-01-04T23:00:00.000Z'});
  assert.equal(three.currentStep?.phase,'FADE_TEST');
  assert.equal(three.phaseCleanStreak,0);
});

test('policy change is explicit when repeated evidence changes cadence',()=>{
  const base=buildLearningVelocityProfile({rows:[row(1),row(2),row(3)],coachTwin:twin(),interventionValue:value(),identity:identity(),curriculum:curriculum()});
  const next=buildLearningVelocityProfile({rows:[1,2,3,4,5].map(day=>row(day,{intervened:false,autonomy:true})),coachTwin:twin(),interventionValue:value(),identity:identity(),curriculum:curriculum(),previous:base});
  assert.equal(next.change.status,'SHIFTED');
  assert.ok(next.change.changedFields.includes('PACE_STATE'));
});
