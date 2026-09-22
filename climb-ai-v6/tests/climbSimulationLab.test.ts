import test from 'node:test';
import assert from 'node:assert/strict';
import {runClimbSimulationLab} from '../lib/climbSimulationLab';

test('CLIMB Simulation Lab runs 540 full synthetic career games without breaking learning invariants',()=>{
  const report=runClimbSimulationLab({gamesPerCareer:90,seed:23042026});
  assert.equal(report.totalGames,540);
  assert.equal(report.careers.length,6);
  assert.deepEqual(report.invariantViolations,[],report.invariantViolations.slice(0,12).join('\n'));

  const byId=Object.fromEntries(report.careers.map(career=>[career.archetype,career]));
  assert.equal(byId.FAST_LEARNER.maxLevel,5,'Fast learner should reach the hardest transfer rep.');
  assert.ok(byId.STEADY_LEARNER.maxLevel>=4,'Steady learner should reach adaptive/transfer testing.');
  assert.ok(byId.STUBBORN_REPEATER.maxLevel<=3,'Stubborn repeater should not be promoted into transfer without evidence.');
  assert.ok(byId.CONTEXT_MEMORIZER.maxLevel<=4,'Context memorizer should not receive Level 5 without credible transfer evidence.');
  assert.equal(byId.CONTEXT_MEMORIZER.principleOwned,false,'Context memorizer should not be called principle-owned.');
  assert.ok(byId.REGRESSION_CASE.demotions>=1,'Regression case should trigger at least one deliberate difficulty reduction.');
  assert.ok(byId.SPARSE_EVIDENCE.notObserved>=20,'Sparse evidence career should contain substantial neutral NOT_OBSERVED games.');
});

test('Simulation Lab keeps frozen pre-game missions aligned with post-game Decision Graph review',()=>{
  const report=runClimbSimulationLab({gamesPerCareer:45,seed:88});
  for(const career of report.careers){
    assert.equal(career.invariants.length,0,career.invariants.join('\n'));
    const frozen=career.events.filter(event=>event.missionStatus==='READY');
    assert.ok(frozen.length>0,career.archetype+' should eventually receive at least one frozen match mission.');
    assert.ok(frozen.some(event=>event.missionReview==='EXECUTED'||event.missionReview==='MISSED'||event.missionReview==='NOT_OBSERVED'));
  }
});
