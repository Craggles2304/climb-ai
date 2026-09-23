import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCausalCoachRoute,reviewCausalCoachRoute} from '../lib/causalCoachRouter';

function strategy(overrides:Record<string,unknown>={}){
  return{
    version:1,id:'strategy',missionId:'mission',behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',targetTag:'GENERAL',
    mode:'REINFORCE',intervene:true,deliveryPolicy:'LIGHT',repLevel:3,repStage:'STABILISE',recentObservedMissions:4,recentExecutionRate:65,
    recentCleanStreak:1,recentMissStreak:0,coachTwinStatus:'BUILDING',intentDiagnosis:'NO_GAP',intentEvidenceStreak:0,
    autonomyState:'BUILDING',autonomyStrength:null,supportDependenceGap:null,interventionValueState:'BUILDING',interventionResponseDifference:null,
    interventionValueConfidence:'LOW',experimentId:null,experimentType:null,experimentInformationNeed:null,title:'test',playerMessage:'test',
    decision:'test',coachDirective:'test',successDefinition:'test',autonomyTest:false,source:'CLIMB_COACHING_STRATEGY',boundary:'test',
    ...overrides,
  } as any;
}
function mission(){
  return{version:1,status:'READY',behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection'} as any;
}
function profile(layer:string,status='REPEATED_ROOT_CAUSE'){
  return{
    version:1,status,dominantLayer:layer,dominantLayerLabel:layer,summary:'Repeated evidence supports '+layer,
  } as any;
}

test('game-read root cause routes to recognition-first self-explain coaching',()=>{
  const route=buildCausalCoachRoute({profile:profile('GAME_READ'),strategy:strategy(),mission:mission()});
  assert.equal(route.active,true);
  assert.equal(route.mode,'RECOGNITION_FIRST');
  assert.equal(route.deliveryPolicy,'DIAGNOSTIC');
  assert.equal(route.forceCoachMethod,'SELF_EXPLAIN');
  assert.deepEqual(route.checkpointMinutes,[5,10,15]);
});

test('follow-through root cause routes to commitment test without replacing the curriculum behaviour',()=>{
  const route=buildCausalCoachRoute({profile:profile('FOLLOW_THROUGH'),strategy:strategy(),mission:mission()});
  assert.equal(route.mode,'COMMITMENT_TEST');
  assert.equal(route.forceCoachMethod,'WHEN_THEN');
  assert.equal(route.behaviourKey,'FIGHT_SELECTION');
  assert.match(route.liveDirective,/PRIORITY/);
});

test('execution root cause reduces live interruption and keeps coaching downstream',()=>{
  const route=buildCausalCoachRoute({profile:profile('EXECUTION'),strategy:strategy(),mission:mission()});
  assert.equal(route.mode,'EXECUTION_ONLY');
  assert.equal(route.deliveryPolicy,'LIGHT');
  assert.deepEqual(route.checkpointMinutes,[10]);
  assert.match(route.pregameDirective,/DO NOT RETEACH GAME-STATE THEORY/);
});

test('stable-clean profile creates autonomy test only when safety strategy allows it',()=>{
  const route=buildCausalCoachRoute({profile:profile('AUTONOMY','STABLE_CLEAN'),strategy:strategy({mode:'FADE',deliveryPolicy:'NONE',autonomyState:'AUTONOMOUS'}),mission:mission()});
  assert.equal(route.mode,'AUTONOMY_TEST');
  assert.equal(route.deliveryPolicy,'NONE');
  assert.equal(route.safetyConstrained,false);
  assert.deepEqual(route.checkpointMinutes,[10]);
});

test('safety strategy blocks causal autonomy fade',()=>{
  const route=buildCausalCoachRoute({profile:profile('AUTONOMY','STABLE_CLEAN'),strategy:strategy({mode:'TEACH',deliveryPolicy:'FULL',intentDiagnosis:'KNOWLEDGE_GAP'}),mission:mission()});
  assert.equal(route.mode,'AUTONOMY_TEST');
  assert.equal(route.deliveryPolicy,'FULL');
  assert.equal(route.safetyConstrained,true);
});

test('building or emerging causal memory cannot hard-route coaching',()=>{
  const building=buildCausalCoachRoute({profile:profile('GAME_READ','BUILDING'),strategy:strategy(),mission:mission()});
  const emerging=buildCausalCoachRoute({profile:profile('GAME_READ','PATTERN_EMERGING'),strategy:strategy(),mission:mission()});
  assert.equal(building.active,false);
  assert.equal(building.mode,'EVIDENCE_BUILD');
  assert.equal(emerging.active,false);
  assert.equal(emerging.deliveryPolicy,'LIGHT');
});

test('post-game route review confirms same layer but does not claim causation',()=>{
  const route=buildCausalCoachRoute({profile:profile('EXECUTION'),strategy:strategy(),mission:mission()});
  const review=reviewCausalCoachRoute(route,{
    version:1,active:true,totalChains:2,verifiableChains:2,diagnosisCounts:{} as any,primaryDiagnosis:'EXECUTION_GAP',
    primaryCoachLayer:'EXECUTION',primaryHeadline:'Execution',primaryAction:'Execution',chains:[],boundary:'test',
  });
  assert.equal(review.status,'CONFIRMED');
  assert.equal(review.observedLayer,'EXECUTION');
  assert.match(review.boundary,/DOES NOT/);
});

test('one different observed layer requests evidence shift rather than immediate model rewrite',()=>{
  const route=buildCausalCoachRoute({profile:profile('GAME_READ'),strategy:strategy(),mission:mission()});
  const review=reviewCausalCoachRoute(route,{
    version:1,active:true,totalChains:1,verifiableChains:1,diagnosisCounts:{} as any,primaryDiagnosis:'EXECUTION_GAP',
    primaryCoachLayer:'EXECUTION',primaryHeadline:'Execution',primaryAction:'Execution',chains:[],boundary:'test',
  });
  assert.equal(review.status,'SHIFT_REQUIRED');
  assert.match(review.nextAction,/DO NOT SWITCH FROM ONE GAME/);
});
