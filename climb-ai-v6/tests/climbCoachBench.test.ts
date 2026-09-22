import test from 'node:test';
import assert from 'node:assert/strict';
import {runClimbCoachBench} from '../lib/climbCoachBench';

test('CLIMB Coach Bench compares production against scaffold and early-fade baselines',()=>{
  const report=runClimbCoachBench({gamesPerCareer:90,seeds:[101,202,303]});
  assert.equal(report.totalSyntheticGames,4860);
  assert.equal(report.policies.length,3);
  assert.deepEqual(report.invariantViolations,[],report.invariantViolations.slice(0,15).join('\n'));
  assert.deepEqual(report.guardrails.filter(item=>!item.pass),[],report.guardrails.filter(item=>!item.pass).map(item=>item.key+': '+item.detail).join('\n'));

  const byId=Object.fromEntries(report.policies.map(policy=>[policy.policyId,policy]));
  const product=byId.PRODUCT.metrics;
  const scaffold=byId.ALWAYS_SCAFFOLD.metrics;
  const earlyFade=byId.EARLY_FADE.metrics;

  console.table(report.policies.map(policy=>({
    policy:policy.policyId,
    score:policy.metrics.score,
    eligible:policy.selectionEligible,
    disqualifiedBy:policy.disqualifications.join(',')||'—',
    cleanRate:policy.metrics.cleanDecisionRate,
    supportRate:policy.metrics.supportRate,
    autonomy:policy.metrics.autonomyCareerRate,
    owned:policy.metrics.principleOwnedRate,
    churn:policy.metrics.difficultyChangesPer100,
    unsafeFade:policy.metrics.unsafeFadeCount,
  })));

  assert.equal(product.experimentPolicyMismatches,0);
  assert.equal(product.unsafeFadeCount,0);
  assert.equal(product.falseRegressionCount,0);
  assert.ok(scaffold.supportRate>product.supportRate,'Always-scaffold baseline should consume more support.');
  assert.ok(product.autonomyCareerRate>scaffold.autonomyCareerRate,'Production should create more verified autonomy than permanent scaffolding.');
  assert.ok(earlyFade.unsafeFadeCount>product.unsafeFadeCount,'Early-fade baseline should expose why production safety gates matter.');
  assert.equal(byId.PRODUCT.selectionEligible,true);
  assert.equal(byId.EARLY_FADE.selectionEligible,false,'Unsafe early fading must be excluded from policy selection even if its raw score is high.');
  assert.ok(byId.EARLY_FADE.disqualifications.includes('UNSAFE_FADE'));
  assert.equal(report.winner,'PRODUCT','Production should be the highest-scoring policy that passes hard safety/evidence gates.');
});

test('Coach Bench remains deterministic for the same seeds',()=>{
  const a=runClimbCoachBench({gamesPerCareer:60,seeds:[77]});
  const b=runClimbCoachBench({gamesPerCareer:60,seeds:[77]});
  assert.deepEqual(
    a.policies.map(item=>({id:item.policyId,metrics:item.metrics})),
    b.policies.map(item=>({id:item.policyId,metrics:item.metrics})),
  );
  assert.deepEqual(a.guardrails,b.guardrails);
  assert.equal(a.winner,b.winner);
  assert.equal(a.scoreLeader,b.scoreLeader);
});

test('Coach Bench score never hides hard guardrail failure',()=>{
  const report=runClimbCoachBench({gamesPerCareer:60,seeds:[909]});
  const early=report.policies.find(item=>item.policyId==='EARLY_FADE');
  assert.ok(early);
  assert.ok(early.metrics.unsafeFadeCount>0,'Synthetic early fading should create unsafe reps in the benchmark.');
  assert.equal(early.selectionEligible,false);
  assert.ok(early.disqualifications.includes('UNSAFE_FADE'));
  const safety=report.guardrails.find(item=>item.key==='SAFER_THAN_EARLY_FADE');
  assert.equal(safety?.pass,true);
  assert.match(report.boundary,/Raw metrics and hard safety guardrails take priority over score/i);
});
